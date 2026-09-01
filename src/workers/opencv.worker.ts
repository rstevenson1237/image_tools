import * as Comlink from 'comlink';
import type { Point } from '../core/utils/geometry';

/**
 * Served verbatim from public/ (see scripts/vendor-opencv.mjs). It must not be a
 * module import: that keeps the 10MB bundle out of the module graph, and Vite's
 * dev server would otherwise rewrite the UMD into an ES module and break the
 * loader below.
 */
const OPENCV_URL = `${import.meta.env.BASE_URL}vendor/opencv.js`;

/**
 * OpenCV-backed processing endpoint.
 *
 * OpenCV.js is ~10MB of WASM, so it is loaded on first use rather than at module
 * scope — spinning up this worker is cheap, and a tool that never runs an
 * extraction never pays for the runtime.
 */

// The package ships the raw Emscripten build; its type surface is loose enough
// that a structural alias is more honest than pretending it is fully typed.
type Cv = typeof import('@techstark/opencv-js');
type Mat = InstanceType<Cv['Mat']>;
interface Deletable {
  delete: () => void;
}

let runtime: Promise<Cv> | null = null;

function loadOpenCv(): Promise<Cv> {
  runtime ??= (async () => {
    // OpenCV.js is a UMD bundle, and neither obvious way of loading it works
    // here: `import()`ing it wedges the worker thread outright, and importScripts
    // only exists in classic workers (which Vite leaves un-bundled in dev). So
    // fetch the asset and run it through an *indirect* eval, which evaluates in
    // global scope — that is what lets the UMD's final branch assign `self.cv`.
    // A direct eval would run in this function's scope and the assignment would
    // be lost.
    const source = await fetch(OPENCV_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Could not fetch opencv.js (HTTP ${response.status})`);
      }
      return response.text();
    });
    (0, eval)(source);

    const scope = self as unknown as { cv?: unknown };
    const raw = scope.cv;
    if (!raw) throw new Error('opencv.js loaded but did not expose a global `cv`');

    // The runtime boots asynchronously, and the handshake depends on how the
    // Emscripten bundle was built: this package exports a *thenable* module,
    // while older builds fire an `onRuntimeInitialized` callback.
    //
    // The thenable must never be `await`ed directly, nor become a promise's
    // resolution value. It resolves with *itself*, and because the result is
    // still thenable the runtime re-chains it forever — an unbreakable microtask
    // loop that wedges the whole worker thread with no error to show for it.
    // Boxing it in a wrapper object makes the resolution value non-thenable,
    // which stops the recursion here.
    let cv = raw as Cv;
    if (typeof (raw as { then?: unknown }).then === 'function') {
      const boxed = await new Promise<{ value: Cv }>((resolve, reject) => {
        try {
          (raw as { then: (cb: (m: Cv) => void, err?: (e: unknown) => void) => void }).then(
            (module) => resolve({ value: module }),
            reject,
          );
        } catch (error) {
          reject(error as Error);
        }
      });
      cv = boxed.value;
    }

    if (typeof cv.Mat !== 'function') {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('OpenCV runtime did not initialise within 60s')),
          60_000,
        );
        (cv as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }

    if (typeof cv.Mat !== 'function') {
      throw new Error('OpenCV loaded but exposed no Mat constructor');
    }

    // Now that the runtime is up, drop the `then` hook for good. Without this,
    // `return cv` below would resolve this very promise *with a thenable*, and
    // the same self-adopting recursion would hang the worker one level later —
    // which is exactly as silent and as fatal as awaiting it directly.
    delete (cv as unknown as { then?: unknown }).then;

    return cv;
  })();
  // Don't let one failed boot (a network blip on the WASM chunk) poison every
  // later attempt with a permanently rejected cached promise.
  runtime.catch(() => {
    runtime = null;
  });
  return runtime;
}

/**
 * Tracks every Mat allocated during a call so a single `dispose()` in a
 * `finally` reclaims the WASM heap even when OpenCV throws mid-pipeline.
 * Leaking Mats here is unrecoverable without a page reload, so nothing in this
 * file may allocate outside a scope.
 */
class MatScope {
  #tracked: Deletable[] = [];

  track<T extends Deletable>(value: T): T {
    this.#tracked.push(value);
    return value;
  }

  dispose(): void {
    for (const item of this.#tracked) {
      try {
        item.delete();
      } catch {
        // A double-delete must not mask the original failure.
      }
    }
    this.#tracked = [];
  }
}

export type ThresholdMode = number | 'otsu';

export interface ExtractOptions {
  /** Grey level that separates subject from background, or 'otsu' to pick automatically. */
  threshold: ThresholdMode;
  /** Treat the *lighter* region as the subject instead of the darker one. */
  invert: boolean;
  /** Discard all but the largest connected blob and fill its interior holes. */
  keepLargestBlob: boolean;
  /** Kernel size for the morphological close that seals speckle. 0 disables it. */
  smoothing: number;
}

export const defaultExtractOptions: ExtractOptions = {
  threshold: 'otsu',
  invert: false,
  keepLargestBlob: true,
  smoothing: 5,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`"${hex}" is not a valid hex colour`);
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/** Builds an 8-bit mask that is 255 inside the lasso polygon and 0 outside. */
function buildPolygonMask(cv: Cv, scope: MatScope, polygon: Point[], width: number, height: number): Mat {
  const mask = scope.track(new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(0)));

  // Fewer than three points cannot bound an area — treat it as "whole image".
  if (polygon.length < 3) {
    mask.setTo(new cv.Scalar(255));
    return mask;
  }

  const flattened: number[] = [];
  for (const point of polygon) {
    flattened.push(Math.round(point.x), Math.round(point.y));
  }

  const contour = scope.track(cv.matFromArray(polygon.length, 1, cv.CV_32SC2, flattened));
  const contours = scope.track(new cv.MatVector());
  contours.push_back(contour);
  cv.fillPoly(mask, contours, new cv.Scalar(255));
  return mask;
}

export interface BinarizeOptions {
  threshold: ThresholdMode;
  /** Treat the *lighter* region as the subject instead of the darker one. */
  invert: boolean;
  /** Gaussian kernel size. 0 disables the blur. */
  blur: number;
  /** Morphological-close kernel that seals speckle. 0 disables it. */
  smoothing: number;
  /** Intersect with the source alpha so already-transparent art traces its shape. */
  respectAlpha: boolean;
}

/**
 * greyscale -> blur -> threshold -> morphological close -> optional alpha intersect.
 *
 * Shared by the silhouette extractor and the contour tracer, which differ only
 * in what they do with the resulting mask. Returns the grey level actually
 * applied, which is the only way to find out what Otsu chose.
 */
function binarize(
  cv: Cv,
  scope: MatScope,
  src: Mat,
  options: BinarizeOptions,
): { binary: Mat; thresholdUsed: number } {
  const gray = scope.track(new cv.Mat());
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const blurred = scope.track(new cv.Mat());
  if (options.blur > 0) {
    const kernel = Math.max(3, options.blur | 1);
    cv.GaussianBlur(gray, blurred, new cv.Size(kernel, kernel), 0, 0, cv.BORDER_DEFAULT);
  } else {
    gray.copyTo(blurred);
  }

  // Subjects are usually darker than their background, so BINARY_INV marks them
  // as foreground; `invert` flips that for light-on-dark artwork.
  const binary = scope.track(new cv.Mat());
  const polarity = options.invert ? cv.THRESH_BINARY : cv.THRESH_BINARY_INV;
  const thresholdUsed =
    options.threshold === 'otsu'
      ? cv.threshold(blurred, binary, 0, 255, polarity | cv.THRESH_OTSU)
      : cv.threshold(blurred, binary, options.threshold, 255, polarity);

  if (options.smoothing > 0) {
    const kernelSize = Math.max(3, options.smoothing | 1);
    const kernel = scope.track(
      cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize)),
    );
    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);
  }

  if (options.respectAlpha) {
    const channels = scope.track(new cv.MatVector());
    cv.split(src, channels);
    const sourceAlpha = scope.track(channels.get(3));
    const opaque = scope.track(new cv.Mat());
    cv.threshold(sourceAlpha, opaque, 0, 255, cv.THRESH_BINARY);
    cv.bitwise_and(binary, opaque, binary);
  }

  return { binary, thresholdUsed };
}

/**
 * Simplifies a contour with approxPolyDP and copies it out as a flat
 * `[x0, y0, x1, y1, ...]` buffer.
 *
 * The result owns a fresh ArrayBuffer so it can be transferred to the main
 * thread rather than structured-cloned.
 */
function contourToPoints(cv: Cv, scope: MatScope, contour: Mat, epsilon: number): Float32Array {
  let source = contour;
  if (epsilon > 0) {
    const simplified = scope.track(new cv.Mat());
    cv.approxPolyDP(contour, simplified, epsilon, true);
    // approxPolyDP can collapse a tiny contour below three points; the caller
    // drops those, but keep the unsimplified ring rather than emit a degenerate.
    if (simplified.rows >= 3) source = simplified;
  }

  const data = source.data32S as Int32Array;
  const points = new Float32Array(source.rows * 2);
  for (let i = 0; i < points.length; i++) points[i] = data[i];
  return points;
}

/**
 * Replaces `binary` with only its largest external contour, drawn filled — this
 * both drops stray specks and closes interior holes (eyes, gaps between limbs)
 * that would otherwise punch transparency through the middle of a token.
 */
function keepLargestFilledBlob(cv: Cv, scope: MatScope, binary: Mat): void {
  const contours = scope.track(new cv.MatVector());
  const hierarchy = scope.track(new cv.Mat());
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let bestIndex = -1;
  let bestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    // MatVector.get() hands back a new Mat wrapper that the caller owns.
    const contour = contours.get(i);
    try {
      const area = cv.contourArea(contour);
      if (area > bestArea) {
        bestArea = area;
        bestIndex = i;
      }
    } finally {
      contour.delete();
    }
  }
  if (bestIndex < 0) return;

  binary.setTo(new cv.Scalar(0));
  cv.drawContours(binary, contours, bestIndex, new cv.Scalar(255), cv.FILLED);
}

export interface TraceOptions {
  threshold: ThresholdMode;
  invert: boolean;
  blur: number;
  smoothing: number;
  respectAlpha: boolean;
  /** approxPolyDP epsilon, in source pixels. 0 keeps every contour point. */
  simplifyTolerance: number;
  /** Contours whose area falls below this (px²) are dropped. */
  minArea: number;
  /** Emit interior contours as holes. False traces outlines only. */
  keepHoles: boolean;
  /** Cap on outer contours returned, largest-area first. */
  maxPaths: number;
}

export const defaultTraceOptions: TraceOptions = {
  threshold: 'otsu',
  invert: false,
  blur: 3,
  smoothing: 3,
  respectAlpha: true,
  simplifyTolerance: 1.5,
  minArea: 24,
  keepHoles: true,
  maxPaths: 120,
};

/** One closed ring in source-image pixels, flat `[x, y, ...]`. */
export interface TracedRing {
  points: Float32Array;
  area: number;
}

export interface TracedShape {
  outer: TracedRing;
  holes: TracedRing[];
}

export interface TraceResult {
  width: number;
  height: number;
  shapes: TracedShape[];
  /** Contours discarded by minArea or maxPaths, so the UI can say so. */
  droppedCount: number;
  /** The grey level actually applied — resolves 'otsu' to a number. */
  thresholdUsed: number;
}

const api = {
  /** Warms the WASM runtime so the first real extraction isn't stalled by it. */
  async preload(): Promise<void> {
    await loadOpenCv();
  },

  async extractSilhouette(
    source: ImageData,
    maskPoints: Point[],
    targetColorHex: string,
    options: Partial<ExtractOptions> = {},
  ): Promise<ImageData> {
    const cv = await loadOpenCv();
    const settings = { ...defaultExtractOptions, ...options };
    const { r, g, b } = hexToRgb(targetColorHex);
    const { width, height } = source;

    const scope = new MatScope();
    try {
      const src = scope.track(cv.matFromImageData(source));
      const lasso = buildPolygonMask(cv, scope, maskPoints, width, height);

      const { binary } = binarize(cv, scope, src, {
        threshold: settings.threshold,
        invert: settings.invert,
        blur: 3,
        smoothing: settings.smoothing,
        respectAlpha: true,
      });

      // Clip to the lasso *after* binarize has applied the source alpha. Order
      // matters: clipping last guarantees nothing escapes the user's selection.
      cv.bitwise_and(binary, lasso, binary);

      if (settings.keepLargestBlob) {
        keepLargestFilledBlob(cv, scope, binary);
        // Re-clip: a filled contour can bulge past the lasso edge.
        cv.bitwise_and(binary, lasso, binary);
      }

      const silhouette = binary.data as Uint8Array;
      const output = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < silhouette.length; i++) {
        if (silhouette[i] === 0) continue;
        const offset = i * 4;
        output[offset] = r;
        output[offset + 1] = g;
        output[offset + 2] = b;
        output[offset + 3] = 255;
      }

      return Comlink.transfer(new ImageData(output, width, height), [output.buffer]);
    } finally {
      scope.dispose();
    }
  },

  /**
   * Traces the image to closed polygon rings for the SVG Tracer.
   *
   * Returns points rather than SVG `d` strings: the node editor needs point
   * arrays anyway, Float32Arrays are transferable, and coordinate precision is a
   * user-facing export decision that belongs with the serializer.
   *
   * `source` is cloned rather than transferred, so the caller can re-trace the
   * same image at different settings without re-reading its pixels.
   */
  async traceContours(
    source: ImageData,
    options: Partial<TraceOptions> = {},
  ): Promise<TraceResult> {
    const cv = await loadOpenCv();
    const settings = { ...defaultTraceOptions, ...options };
    const { width, height } = source;

    const scope = new MatScope();
    try {
      const src = scope.track(cv.matFromImageData(source));
      const { binary, thresholdUsed } = binarize(cv, scope, src, settings);

      const contours = scope.track(new cv.MatVector());
      const hierarchy = scope.track(new cv.Mat());
      // RETR_CCOMP gives a strict two-level hierarchy: top-level outlines and
      // their immediate holes. It deliberately flattens deeper nesting — an
      // island inside a hole becomes a new top-level shape rather than a third
      // level — which is exactly right for even-odd fill, and surprising only if
      // you expected a tree.
      cv.findContours(
        binary,
        contours,
        hierarchy,
        settings.keepHoles ? cv.RETR_CCOMP : cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      // Groups of four per contour: next, prev, firstChild, parent.
      const tree = hierarchy.data32S as Int32Array;
      const total = contours.size();
      let droppedCount = 0;

      /** Reads one contour into a ring, or null if it is too small to keep. */
      const ringAt = (index: number): TracedRing | null => {
        const contour = contours.get(index);
        try {
          const area = Math.abs(cv.contourArea(contour));
          if (area < settings.minArea) return null;
          const points = contourToPoints(cv, scope, contour, settings.simplifyTolerance);
          if (points.length < 6) return null;
          return { points, area };
        } finally {
          // MatVector.get() hands back a new Mat wrapper that the caller owns.
          contour.delete();
        }
      };

      const shapes: TracedShape[] = [];
      for (let i = 0; i < total; i++) {
        // Under RETR_EXTERNAL every contour is top-level and the hierarchy is
        // still populated, so the parent test is correct for both modes.
        if (tree[i * 4 + 3] !== -1) continue;

        const outer = ringAt(i);
        if (!outer) {
          droppedCount++;
          continue;
        }

        const holes: TracedRing[] = [];
        if (settings.keepHoles) {
          for (let child = tree[i * 4 + 2]; child !== -1; child = tree[child * 4]) {
            const hole = ringAt(child);
            if (hole) holes.push(hole);
            else droppedCount++;
          }
        }
        shapes.push({ outer, holes });
      }

      // Largest first, so capping at maxPaths keeps the shapes that matter.
      shapes.sort((a, b) => b.outer.area - a.outer.area);
      if (shapes.length > settings.maxPaths) {
        droppedCount += shapes.length - settings.maxPaths;
        shapes.length = settings.maxPaths;
      }

      // Every ring owns a fresh buffer (contourToPoints allocates per call), so
      // this list can never contain a duplicate — which postMessage would reject.
      const buffers: ArrayBufferLike[] = [];
      for (const shape of shapes) {
        buffers.push(shape.outer.points.buffer);
        for (const hole of shape.holes) buffers.push(hole.points.buffer);
      }

      return Comlink.transfer(
        { width, height, shapes, droppedCount, thresholdUsed },
        buffers as Transferable[],
      );
    } finally {
      scope.dispose();
    }
  },
};

export type OpenCvApi = typeof api;

Comlink.expose(api);
