import * as Comlink from 'comlink';
import {
  defaultCutOptions,
  defaultTraceOptions,
  extractSilhouette as cutSilhouette,
  paletteOf,
  sliceGrid,
  sliceSprites,
  snapToPalette,
  traceImage,
  type Cell,
  type CutOptions,
  type Dither,
  type GridSlice,
  type TraceOptions,
  type TraceResult,
} from 'artgen-imagekit';
import type { Point } from '../core/utils/geometry';

/**
 * The image tools' processing endpoint. It is `artgen-imagekit`: plain TypeScript, so there is nothing to download or boot (the
 * tools ran on a 10 MB OpenCV build until R5b), and the CLI and MCP run the same functions. The work stays in a worker so a large
 * picture does not freeze the page.
 */

export type { TraceOptions, TraceResult };
export type ThresholdMode = number | 'otsu';
export type ExtractOptions = CutOptions;
export { defaultCutOptions as defaultExtractOptions, defaultTraceOptions };

/** `ImageData` as imagekit's pixels. */
const pixels = (img: ImageData) => ({ w: img.width, h: img.height, d: img.data });

/** Imagekit's output as `ImageData`, handing over its buffer (it is a fresh, unshared one). */
const imageData = (o: { w: number; h: number; d: Uint8ClampedArray }) => Comlink.transfer(new ImageData(o.d as Uint8ClampedArray<ArrayBuffer>, o.w, o.h), [o.d.buffer]);

/** Rings own fresh buffers (imagekit allocates per ring), so this list cannot hold a duplicate, which postMessage would reject. */
const ringBuffers = (r: TraceResult): ArrayBufferLike[] => r.shapes.flatMap((s) => [s.outer.points.buffer, ...s.holes.map((h) => h.points.buffer)]);

const api = {
  /** Silhouette of the subject inside the lasso, in `targetColorHex`, as the Token Cutter shows it. */
  async extractSilhouette(
    source: ImageData,
    maskPoints: Point[],
    targetColorHex: string,
    options: Partial<ExtractOptions> = {},
  ): Promise<ImageData> {
    return imageData(cutSilhouette(pixels(source), maskPoints, targetColorHex, options));
  },

  /**
   * Traces the image to closed polygon rings for the SVG Tracer. Points rather than SVG `d` strings: the node editor needs point
   * arrays anyway, Float32Arrays are transferable, and coordinate precision is an export decision that belongs with the serializer.
   */
  async traceContours(source: ImageData, options: Partial<TraceOptions> = {}): Promise<TraceResult> {
    const result = traceImage(pixels(source), options);
    return Comlink.transfer(result, ringBuffers(result) as Transferable[]);
  },

  /** The `n` dominant colours of the picture, and those grouped into ramps. */
  async extractPalette(source: ImageData, n: number) {
    return paletteOf(pixels(source), n);
  },

  /** The picture snapped to `colors`. */
  async quantize(source: ImageData, colors: string[], dither: Dither = 'none'): Promise<ImageData> {
    return imageData(snapToPalette(pixels(source), colors, { dither }));
  },

  /** The cells of a sprite sheet: a regular grid, or loose sprites found by their pixels. */
  async slice(source: ImageData, mode: 'grid' | 'sprites', grid: GridSlice, sprites: { gap?: number; minSize?: number } = {}): Promise<Cell[]> {
    return mode === 'grid' ? sliceGrid(pixels(source), grid) : sliceSprites(pixels(source), sprites);
  },
};

export type ImagekitApi = typeof api;

Comlink.expose(api);
