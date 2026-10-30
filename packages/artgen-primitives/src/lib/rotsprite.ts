/**
 * RotSprite (docs/STAGES.md §8.1): rotate pixel art without inventing colours or smearing edges. The image is scaled up
 * 8× with Scale2x (EPX) three times, which rounds the corners of every diagonal step without blending, and each output
 * pixel then takes the 8× sample its centre maps to under the inverse rotation (nearest). Multiples of 90° skip the
 * upscale and are exact grid rotations. Angles are degrees, clockwise on screen (y down), like the facing tables.
 */
import { Grid } from './grid.ts';
import { getNormal, putNormal } from './normals.ts';

/** Two pixels are the same colour when their bytes match; every fully transparent pixel counts as the same. */
function same(d: Uint8ClampedArray, i: number, j: number): boolean {
  if (d[i + 3] !== d[j + 3]) return false;
  return d[i + 3] === 0 || (d[i] === d[j] && d[i + 1] === d[j + 1] && d[i + 2] === d[j + 2]);
}

/**
 * Scale2x (EPX): each pixel becomes 2×2. With P the pixel and A, B, C, D the ones above, right, left and below (outside
 * the image = P): 1 = A when C = A and C ≠ D and A ≠ B, else P; 2 = B when A = B and A ≠ C and B ≠ D; 3 = C when D = C
 * and D ≠ B and C ≠ A; 4 = D when B = D and B ≠ A and D ≠ C. Equality is exact on all four bytes (alpha included).
 */
export function scale2x(g: Grid): Grid {
  const { w, h, d } = g, out = new Grid(w * 2, h * 2), o = out.d;
  const put = (x: number, y: number, i: number) => { const k = (y * w * 2 + x) * 4; o[k] = d[i]; o[k + 1] = d[i + 1]; o[k + 2] = d[i + 2]; o[k + 3] = d[i + 3]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, a = y > 0 ? p - w * 4 : p, b = x < w - 1 ? p + 4 : p, c = x > 0 ? p - 4 : p, e = y < h - 1 ? p + w * 4 : p;
    const ca = same(d, c, a), ab = same(d, a, b), dc = same(d, e, c), bd = same(d, b, e);
    put(x * 2, y * 2, ca && !dc && !ab ? a : p);
    put(x * 2 + 1, y * 2, ab && !ca && !bd ? b : p);
    put(x * 2, y * 2 + 1, dc && !bd && !ca ? c : p);
    put(x * 2 + 1, y * 2 + 1, bd && !ab && !dc ? e : p);
  }
  return out;
}

const EPS = 1e-9;
const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** The multiple of 90° `deg` is (0–3), or -1. */
const quarter = (deg: number): number => { const q = norm(deg) / 90, r = Math.round(q); return Math.abs(q - r) < EPS ? r % 4 : -1; };

/**
 * The inverse mapping for a rotation of `deg` about `pivot` (pixel indices, default the frame centre): output pixel
 * (ox, oy) → the continuous source position of its centre, in source pixels (pixel i covers [i, i + 1)). `shift` moves
 * the output frame relative to the source (a larger output).
 */
function inverse(w: number, h: number, deg: number, pivot?: [number, number], shift: [number, number] = [0, 0]) {
  const [px, py] = pivot ?? [(w - 1) / 2, (h - 1) / 2], q = quarter(deg), r = (norm(deg) * Math.PI) / 180;
  // exact cosines and sines at the right angles, so a quarter turn lands on pixel centres
  const c = q < 0 ? Math.cos(r) : [1, 0, -1, 0][q], s = q < 0 ? Math.sin(r) : [0, 1, 0, -1][q];
  return (ox: number, oy: number): [number, number] => {
    const dx = ox - shift[0] - px, dy = oy - shift[1] - py;
    return [px + c * dx + s * dy + 0.5, py - s * dx + c * dy + 0.5];
  };
}

/**
 * RotSprite: upscale 8× with Scale2x three times, then for every output pixel sample the 8× image at the point its
 * centre maps to under the inverse rotation about `pivot` (nearest). Multiples of 90° are exact grid rotations.
 * The output keeps the input size unless `size` is given (the image then sits centred, rounded down). Output colours
 * are always a subset of the input's. `pivot` is in pixel indices; the default is the frame centre `[(w − 1) / 2, (h − 1) / 2]`.
 */
export function rotsprite(g: Grid, deg: number, o: { pivot?: [number, number]; size?: [number, number] } = {}): Grid {
  const [ow, oh] = o.size ?? [g.w, g.h], out = new Grid(ow, oh);
  const shift: [number, number] = [Math.floor((ow - g.w) / 2), Math.floor((oh - g.h) / 2)];
  const inv = inverse(g.w, g.h, deg, o.pivot, shift);
  // a quarter turn (or none) samples the source itself: the upscale would only let a corner rule change a centre sample
  const exact = quarter(deg) >= 0;
  let src = g, k = 1;
  if (!exact) { src = scale2x(scale2x(scale2x(g))); k = 8; }
  const { w, h, d } = src;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const [u, v] = inv(x, y), sx = Math.floor(u * k + EPS), sy = Math.floor(v * k + EPS);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const i = (sy * w + sx) * 4, j = (y * ow + x) * 4;
    if (d[i + 3]) { out.d[j] = d[i]; out.d[j + 1] = d[i + 1]; out.d[j + 2] = d[i + 2]; out.d[j + 3] = d[i + 3]; }
  }
  return out;
}

/**
 * The same mapping for a normal map: nearest sample of the map itself, and the normal's screen xy turned by the angle
 * (the vector rotates the way the pixels do, so a face that looked right still looks right).
 */
export function rotateNormals(n: Grid, deg: number, o: { pivot?: [number, number]; size?: [number, number] } = {}): Grid {
  const [ow, oh] = o.size ?? [n.w, n.h], out = new Grid(ow, oh);
  const shift: [number, number] = [Math.floor((ow - n.w) / 2), Math.floor((oh - n.h) / 2)];
  const inv = inverse(n.w, n.h, deg, o.pivot, shift), q = quarter(deg), r = (norm(deg) * Math.PI) / 180;
  const c = q < 0 ? Math.cos(r) : [1, 0, -1, 0][q], s = q < 0 ? Math.sin(r) : [0, 1, 0, -1][q];
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const [u, v] = inv(x, y), nv = getNormal(n, Math.floor(u + EPS), Math.floor(v + EPS));
    if (nv) putNormal(out, x, y, [c * nv[0] - s * nv[1], s * nv[0] + c * nv[1], nv[2]]);
  }
  return out;
}

/** A one-byte-per-pixel mask (decal layers) through the same mapping as `rotsprite`: nearest sample, no upscale. */
export function rotateMask(m: Uint8Array, w: number, h: number, deg: number, o: { pivot?: [number, number] } = {}): Uint8Array {
  const out = new Uint8Array(w * h), inv = inverse(w, h, deg, o.pivot);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [u, v] = inv(x, y), sx = Math.floor(u + EPS), sy = Math.floor(v + EPS);
    if (sx >= 0 && sy >= 0 && sx < w && sy < h) out[y * w + x] = m[sy * w + sx];
  }
  return out;
}

/** Where a point goes under the rotation (the forward mapping about `pivot`), rounded to whole pixels. */
export function rotatePoint(p: [number, number], deg: number, w: number, h: number, o: { pivot?: [number, number] } = {}): [number, number] {
  const [px, py] = o.pivot ?? [(w - 1) / 2, (h - 1) / 2], q = quarter(deg), r = (norm(deg) * Math.PI) / 180;
  const c = q < 0 ? Math.cos(r) : [1, 0, -1, 0][q], s = q < 0 ? Math.sin(r) : [0, 1, 0, -1][q];
  const dx = p[0] - px, dy = p[1] - py;
  return [Math.round(px + c * dx - s * dy), Math.round(py + s * dx + c * dy)];
}
