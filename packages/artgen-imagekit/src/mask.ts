/**
 * Binary masks and the steps that make one from a picture: grey, blur, threshold (Otsu or fixed), morphological close, alpha
 * intersect. They follow the OpenCV routines the web tools used before (R5b), step for step and in integer arithmetic, so a
 * mask is the same pixel for pixel; `fixtures/opencv/` holds the numbers that proved it.
 */

/** RGBA pixels, row by row. `Grid` is one; so is an `ImageData` as `{ w: width, h: height, d: data }`. */
export interface Pixels { readonly w: number; readonly h: number; readonly d: ArrayLike<number> }

/** A mask: 255 inside, 0 outside, `w × h` bytes. */
export interface Mask { readonly w: number; readonly h: number; readonly d: Uint8Array }

export type ThresholdMode = number | 'otsu';

export const newMask = (w: number, h: number): Mask => ({ w, h, d: new Uint8Array(w * h) });
export const cloneMask = (m: Mask): Mask => ({ w: m.w, h: m.h, d: m.d.slice() });
/** The number of pixels set. */
export function maskArea(m: Mask): number { let n = 0; for (let i = 0; i < m.d.length; i++) if (m.d[i]) n++; return n; }

/** Grey level of every pixel: 0.299 R + 0.587 G + 0.114 B in 15-bit fixed point, rounded (what OpenCV's RGBA2GRAY does). */
export function grayscale(img: Pixels): Uint8Array {
  const out = new Uint8Array(img.w * img.h), d = img.d;
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (d[j] * 9798 + d[j + 1] * 19235 + d[j + 2] * 3735 + 16384) >> 15;
  return out;
}

/**
 * The 1-D Gaussian of an odd size as 8-bit fixed point (sums to 256). Sigma comes from the size, as OpenCV derives it when none is
 * given; sizes up to 7 use its exact table, and for larger ones the rounding is carried along the kernel (each weight is the
 * difference of two rounded running sums), which is what its fixed-point path does.
 */
export function gaussianKernel(size: number): Int32Array {
  const table: Record<number, number[]> = { 1: [256], 3: [64, 128, 64], 5: [16, 64, 96, 64, 16], 7: [8, 28, 56, 72, 56, 28, 8] };
  if (table[size]) return Int32Array.from(table[size]);
  const sigma = 0.3 * ((size - 1) * 0.5 - 1) + 0.8, half = size >> 1, v: number[] = [];
  let sum = 0;
  for (let i = 0; i < size; i++) { const x = i - half; v.push(Math.exp((-0.5 * x * x) / (sigma * sigma))); sum += v[i]; }
  const k = new Int32Array(size);
  let run = 0, prev = 0;
  for (let i = 0; i < size; i++) { run += v[i] / sum; const r = Math.round(run * 256); k[i] = r - prev; prev = r; }
  return k;
}

const reflect101 = (i: number, n: number): number => {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * (n - 1) - i;
  return i;
};

/** Gaussian blur of an 8-bit plane with an odd kernel size, edges mirrored without repeating the edge row (OpenCV's default border). */
export function gaussianBlur(src: Uint8Array, w: number, h: number, size: number): Uint8Array {
  const k = gaussianKernel(size), half = size >> 1, tmp = new Int32Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = 0; i < size; i++) s += k[i] * src[y * w + reflect101(x + i - half, w)];
    tmp[y * w + x] = s;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = 0; i < size; i++) s += k[i] * tmp[reflect101(y + i - half, h) * w + x];
    out[y * w + x] = (s + 32768) >> 16;
  }
  return out;
}

/** The level Otsu's method puts between background and subject (the one that maximises the variance between the two classes). */
export function otsu(gray: Uint8Array): number {
  const hist = new Float64Array(256), n = gray.length;
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  const scale = 1 / n;
  let mu = 0;
  for (let i = 0; i < 256; i++) mu += i * hist[i];
  mu *= scale;
  let mu1 = 0, q1 = 0, best = 0, bestLevel = 0;
  const eps = 1.1920929e-7;
  for (let i = 0; i < 256; i++) {
    const p = hist[i] * scale;
    mu1 *= q1;
    q1 += p;
    const q2 = 1 - q1;
    if (Math.min(q1, q2) < eps || Math.max(q1, q2) > 1 - eps) continue;
    mu1 = (mu1 + i * p) / q1;
    const mu2 = (mu - q1 * mu1) / q2, sigma = q1 * q2 * (mu1 - mu2) * (mu1 - mu2);
    if (sigma > best) { best = sigma; bestLevel = i; }
  }
  return bestLevel;
}

/** Above the level is the subject when `light`, else below or equal to it. */
export function thresholdPlane(gray: Uint8Array, w: number, h: number, level: number, light: boolean): Mask {
  const out = newMask(w, h), t = Math.floor(level);
  for (let i = 0; i < gray.length; i++) out.d[i] = (gray[i] > t) === light ? 255 : 0;
  return out;
}

/** The structuring element OpenCV calls MORPH_ELLIPSE: for each row, the half-width of the ellipse inscribed in a `size × size` box. */
export function ellipseKernel(size: number): number[] {
  const r = size >> 1, c = size >> 1, inv = r ? 1 / (r * r) : 0, half: number[] = [];
  for (let i = 0; i < size; i++) {
    const dy = i - r;
    half.push(Math.abs(dy) <= r ? Math.round(c * Math.sqrt((r * r - dy * dy) * inv)) : -1);
  }
  return half;
}

/** Binary dilation by an ellipse; pixels outside the image count as unset. */
export function dilate(m: Mask, size: number): Mask {
  const { w, h } = m, half = ellipseKernel(size), r = size >> 1, out = newMask(w, h);
  // the kernel rows that share a half-width (the ellipse is symmetric, so most come in pairs)
  const rowsOf = new Map<number, number[]>();
  half.forEach((hw, i) => { if (hw >= 0) rowsOf.set(hw, [...(rowsOf.get(hw) ?? []), i - r]); });
  const wide = new Uint8Array(w * h), pre = new Int32Array(w + 1);
  for (const [hw, dys] of rowsOf) {
    // every pixel with a set pixel within `hw` on its row (one plane at a time, so memory stays one image)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + (m.d[y * w + x] ? 1 : 0);
      for (let x = 0; x < w; x++) wide[y * w + x] = pre[Math.min(w, x + hw + 1)] - pre[Math.max(0, x - hw)] > 0 ? 255 : 0;
    }
    for (const dy of dys) for (let y = 0; y < h; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) if (wide[sy * w + x]) out.d[y * w + x] = 255;
    }
  }
  return out;
}

/** Binary erosion by an ellipse; pixels outside the image do not count against a pixel. */
export function erode(m: Mask, size: number): Mask {
  const inv = newMask(m.w, m.h);
  for (let i = 0; i < m.d.length; i++) inv.d[i] = m.d[i] ? 0 : 255;
  const d = dilate(inv, size);
  for (let i = 0; i < d.d.length; i++) d.d[i] = d.d[i] ? 0 : 255;
  return d;
}

/** Dilate then erode: seals gaps and speckle narrower than the kernel. */
export const close = (m: Mask, size: number): Mask => erode(dilate(m, size), size);

export interface BinarizeOptions {
  threshold: ThresholdMode;
  /** The lighter region is the subject, not the darker one. */
  invert: boolean;
  /** Gaussian kernel size. 0 disables the blur. */
  blur: number;
  /** Morphological-close kernel that seals speckle. 0 disables it. */
  smoothing: number;
  /** Intersect with the source alpha so art that is already transparent traces its own shape. */
  respectAlpha: boolean;
}

/**
 * Grey → blur → threshold → close → alpha intersect, shared by the silhouette cut and the contour trace. Subjects are usually darker
 * than their background, so the dark side is the subject; `invert` flips that. Returns the level used, which is how to learn what
 * Otsu chose.
 */
export function binarize(img: Pixels, o: BinarizeOptions): { binary: Mask; thresholdUsed: number } {
  const { w, h } = img;
  let gray = grayscale(img);
  if (o.blur > 0) gray = gaussianBlur(gray, w, h, Math.max(3, o.blur | 1));
  const level = o.threshold === 'otsu' ? otsu(gray) : Math.floor(o.threshold);
  let binary = thresholdPlane(gray, w, h, level, o.invert);
  if (o.smoothing > 0) binary = close(binary, Math.max(3, o.smoothing | 1));
  if (o.respectAlpha) for (let i = 0; i < binary.d.length; i++) if (img.d[i * 4 + 3] === 0) binary.d[i] = 0;
  return { binary, thresholdUsed: level };
}
