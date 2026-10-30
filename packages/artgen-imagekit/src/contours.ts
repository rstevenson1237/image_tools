/**
 * Contours of a mask: the borders of its blobs and holes as rings of pixel corners, their area, a simplified copy of a ring, and a
 * filled polygon. The border follower is Suzuki and Abe's (1985) with OpenCV's conventions (8-connected blobs, an outer border
 * starts at the first pixel of its blob in reading order and runs down the left side, ring points are kept only where the direction
 * changes), so a ring is the same list of points OpenCV's `findContours` gave the web tools before R5b.
 */
import { newMask, type Mask } from './mask.ts';

/** One border: a closed ring `[x0, y0, x1, y1, …]` in pixels. */
export interface Contour {
  /** Corners of the ring only (OpenCV's CHAIN_APPROX_SIMPLE). */
  points: Int32Array;
  /** A hole in a blob, not a blob's outer edge. */
  hole: boolean;
  /** Index of the border that encloses this one, or -1 for the image edge. */
  parent: number;
  /** Every pixel of the border, in order (the corners are a subset). */
  chain: Int32Array;
}

// E, NE, N, NW, W, SW, S, SE: counter-clockwise with y down
const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, -1, -1, -1, 0, 1, 1, 1];

/** Borders of every blob (and every hole in one) in `mask`, in the order they are met reading left to right, top to bottom. */
export function findContours(mask: Mask): Contour[] {
  const { w, h } = mask, W = w + 2, lab = new Int32Array(W * (h + 2)), out: Contour[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask.d[y * w + x]) lab[(y + 1) * W + x + 1] = 1;
  // step offsets in the padded image, per direction
  const step = DX.map((dx, d) => dx + DY[d] * W);
  // borders[n] is the border labelled n; 1 is the frame, a hole of the whole image
  const hole: boolean[] = [false, true], parent: number[] = [-1, -1], index: number[] = [-1, -1];
  let nbd = 1;
  for (let y = 1; y <= h; y++) {
    let lnbd = 1;
    for (let x = 1; x <= w; x++) {
      const at = y * W + x, f = lab[at];
      if (f === 0) continue;
      let isHole: boolean;
      if (f === 1 && lab[at - 1] === 0) isHole = false;
      else if (f >= 1 && lab[at + 1] === 0) { isHole = true; if (f > 1) lnbd = f; }
      else { if (f !== 1) lnbd = Math.abs(f); continue; }
      nbd++;
      hole[nbd] = isHole;
      // the border that encloses this one (Suzuki and Abe, table 1)
      parent[nbd] = isHole === hole[lnbd] ? parent[lnbd] : lnbd;
      index[nbd] = out.length;
      out.push(follow(lab, W, step, at, isHole, nbd));
      if (lab[at] !== 1) lnbd = Math.abs(lab[at]);
    }
  }
  // parents are border labels; make them indexes into the result (-1 where the frame encloses)
  let n = 2;
  for (const c of out) { c.parent = parent[n] < 2 ? -1 : index[parent[n]]; n++; }
  return out;
}

/** Trace one border from its first pixel, labelling it as the algorithm says; returns the ring. */
function follow(lab: Int32Array, W: number, step: number[], start: number, isHole: boolean, nbd: number): Contour {
  const chain: number[] = [];
  const xy = (i: number) => { chain.push((i % W) - 1, Math.floor(i / W) - 1); };
  // 3.1: the first nonzero neighbour, clockwise from the zero neighbour the border starts beside
  let first = -1;
  for (let k = 0, d = isHole ? 0 : 4; k < 8; k++, d = (d + 7) & 7) if (lab[start + step[d]] !== 0) { first = d; break; }
  if (first < 0) {
    lab[start] = -nbd;
    xy(start);
    return { points: Int32Array.from(chain), hole: isHole, parent: -1, chain: Int32Array.from(chain) };
  }
  const i1 = start + step[first];
  let i3 = start, toI2 = first;
  for (;;) {
    // 3.3: counter-clockwise from the neighbour after the one we came from; remember whether the east neighbour was seen empty
    let d = toI2, eastEmpty = false;
    for (let k = 0; k < 8; k++) {
      d = (d + 1) & 7;
      if (lab[i3 + step[d]] !== 0) break;
      if (d === 0) eastEmpty = true;
    }
    const i4 = i3 + step[d];
    // 3.4
    if (eastEmpty) lab[i3] = -nbd;
    else if (lab[i3] === 1) lab[i3] = nbd;
    xy(i3);
    // 3.5
    if (i4 === start && i3 === i1) break;
    toI2 = (d + 4) & 7;
    i3 = i4;
  }
  const all = Int32Array.from(chain), n = all.length / 2, pts: number[] = [];
  // keep a pixel where the direction changes (the first pixel's way in is the last pixel's way out)
  const dir = (a: number, b: number) => Math.sign(all[b * 2] - all[a * 2]) * 3 + Math.sign(all[b * 2 + 1] - all[a * 2 + 1]);
  for (let i = 0; i < n; i++) {
    const prev = (i + n - 1) % n, next = (i + 1) % n;
    if (n === 1 || dir(prev, i) !== dir(i, next)) pts.push(all[i * 2], all[i * 2 + 1]);
  }
  return { points: Int32Array.from(pts), hole: isHole, parent: -1, chain: all };
}

/** Area of a ring as a polygon through its points (shoelace), always positive. */
export function ringArea(p: ArrayLike<number>): number {
  const n = p.length / 2;
  let s = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
  return Math.abs(s) / 2;
}

/**
 * Douglas–Peucker simplification of a closed ring, as OpenCV's `approxPolyDP` does it: the ring is cut at two far-apart points and
 * each half keeps splitting at its farthest point while that is more than `epsilon` from the chord; a last pass then drops points
 * that lie almost on the line between their neighbours.
 */
export function simplifyRing(p: ArrayLike<number>, epsilon: number): number[] {
  const count = p.length / 2;
  if (count === 0) return [];
  const px = (i: number) => p[(i % count) * 2], py = (i: number) => p[(i % count) * 2 + 1], eps = epsilon * epsilon;
  let pos = 0, far = 0, closed = true;
  for (let it = 0; it < 3; it++) {
    pos = (pos + far) % count;
    let max = 0;
    for (let j = 1; j < count; j++) {
      const dx = px(j + pos) - px(pos), dy = py(j + pos) - py(pos), dist = dx * dx + dy * dy;
      if (dist > max) { max = dist; far = j; }
    }
    closed = max > eps;
  }
  if (!closed) return [px(pos), py(pos)];
  const stack: [number, number][] = [], dst: number[] = [];
  const mid = pos + far;
  // slices run forward from `a` to `b` around the ring (b may be past the end)
  stack.push([mid, pos + count]);
  stack.push([pos, mid]);
  while (stack.length) {
    const [a, b] = stack.pop()!, ax = px(a), ay = py(a), bx = px(b), by = py(b);
    let split = -1, ok: boolean;
    if (ax !== bx || ay !== by) {
      const dx = bx - ax, dy = by - ay;
      let max = 0;
      for (let i = a + 1; i < b; i++) {
        const dist = Math.abs((py(i) - ay) * dx - (px(i) - ax) * dy);
        if (dist > max) { max = dist; split = i; }
      }
      ok = max * max <= eps * (dx * dx + dy * dy);
    } else {
      ok = true;
      for (let i = a + 1; i < b; i++) {
        const dx = px(i) - ax, dy = py(i) - ay;
        if (dx * dx + dy * dy > eps) { ok = false; split = i; }
      }
    }
    if (ok || split < 0) dst.push(ax, ay);
    else { stack.push([split, b]); stack.push([a, split]); }
  }
  // last pass: remove points that sit almost on the line between their neighbours (in place, as OpenCV does)
  const n = dst.length / 2;
  let newCount = n, at = n - 1;
  const read = () => { const q = [dst[at * 2], dst[at * 2 + 1]]; at = (at + 1) % n; return q; };
  let start = read(), wpos = at, pt = read();
  for (let i = 0; i < n && newCount > 2; i++) {
    const end = read(), dx = end[0] - start[0], dy = end[1] - start[1];
    const dist = Math.abs((pt[0] - start[0]) * dy - (pt[1] - start[1]) * dx);
    const inner = (pt[0] - start[0]) * (end[0] - pt[0]) + (pt[1] - start[1]) * (end[1] - pt[1]);
    if (dist * dist <= 0.5 * eps * (dx * dx + dy * dy) && dx !== 0 && dy !== 0 && inner >= 0) {
      newCount--;
      dst[wpos * 2] = end[0]; dst[wpos * 2 + 1] = end[1];
      start = end;
      wpos = (wpos + 1) % n;
      pt = read();
      i++;
      continue;
    }
    dst[wpos * 2] = pt[0]; dst[wpos * 2 + 1] = pt[1];
    start = pt;
    wpos = (wpos + 1) % n;
    pt = end;
  }
  return dst.slice(0, newCount * 2);
}

const FOUR_DX = [1, -1, 0, 0], FOUR_DY = [0, 0, 1, -1];

/** Everything the outside cannot reach by 4-connected steps without crossing `wall` (a padded `(w+2) × (h+2)` plane), as a mask of the inside. */
function enclosed(wall: Uint8Array, w: number, h: number): Mask {
  const out = newMask(w, h), W = w + 2, seen = new Uint8Array(W * (h + 2)), stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const i = stack.pop()!, x = i % W, y = (i - x) / W;
    for (let k = 0; k < 4; k++) {
      const nx = x + FOUR_DX[k], ny = y + FOUR_DY[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= h + 2) continue;
      const j = ny * W + nx;
      if (seen[j] || wall[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!seen[(y + 1) * W + x + 1]) out.d[y * w + x] = 255;
  return out;
}

/** The pixels inside a closed border and on it (holes and anything in them included), as a mask. */
export function fillChain(chain: ArrayLike<number>, w: number, h: number): Mask {
  const wall = new Uint8Array((w + 2) * (h + 2));
  for (let i = 0; i < chain.length / 2; i++) wall[(chain[i * 2 + 1] + 1) * (w + 2) + chain[i * 2] + 1] = 1;
  return enclosed(wall, w, h);
}

/** A mask with the holes in its blobs filled (background the picture's edge cannot reach). */
export function fillHoles(m: Mask): Mask {
  const wall = new Uint8Array((m.w + 2) * (m.h + 2));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) wall[(y + 1) * (m.w + 2) + x + 1] = 1;
  return enclosed(wall, m.w, m.h);
}

/** A polygon (x, y pairs) filled: pixels whose centre is inside, plus its edges. Fewer than three points select the whole image. */
export function fillPolygon(poly: ReadonlyArray<{ x: number; y: number }>, w: number, h: number): Mask {
  const out = newMask(w, h);
  if (poly.length < 3) { out.d.fill(255); return out; }
  const pts = poly.map(q => ({ x: Math.round(q.x), y: Math.round(q.y) })), n = pts.length;
  const put = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) out.d[y * w + x] = 255; };
  // the edges, Bresenham
  for (let i = 0; i < n; i++) {
    let { x: x0, y: y0 } = pts[i];
    const { x: x1, y: y1 } = pts[(i + 1) % n], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // the inside, even-odd per row
  let top = Infinity, bottom = -Infinity;
  for (const q of pts) { top = Math.min(top, q.y); bottom = Math.max(bottom, q.y); }
  for (let y = Math.max(0, top); y <= Math.min(h - 1, bottom); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if (a.y === b.y || y < Math.min(a.y, b.y) || y >= Math.max(a.y, b.y)) continue;
      xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.ceil(xs[i])); x <= Math.min(w - 1, Math.floor(xs[i + 1])); x++) put(x, y);
  }
  return out;
}
