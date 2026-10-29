/**
 * Plane geometry on flat x,y lists (cells), shared by the layout, the checks and the block splitter: polygon area and
 * self-crossings, segment crossings, distances, and points along a polyline.
 */

export type P = [number, number];

/** Twice the signed area of a polygon (positive when clockwise in screen space, y down). */
export function area2(p: number[]): number {
  let s = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) s += p[j] * p[i + 1] - p[i] * p[j + 1];
  return s;
}

export const polygonArea = (p: number[]): number => Math.abs(area2(p)) / 2;

const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

/** Where two segments cross (strictly inside both, not at an end); null when they do not. */
export function segmentCross(a: P, b: P, c: P, d: P, eps = 1e-9): P | null {
  const d1 = cross(c[0], c[1], d[0], d[1], a[0], a[1]), d2 = cross(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = cross(a[0], a[1], b[0], b[1], c[0], c[1]), d4 = cross(a[0], a[1], b[0], b[1], d[0], d[1]);
  if (!(((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps)))) return null;
  const t = d1 / (d1 - d2);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The first pair of non-adjacent edges of a polygon that cross, as edge indices; null when it is simple. */
export function selfCrossing(p: number[]): [number, number] | null {
  const n = p.length / 2, pt = (i: number): P => [p[2 * (i % n)], p[2 * (i % n) + 1]];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segmentCross(pt(i), pt(i + 1), pt(j), pt(j + 1))) return [i, j];
  }
  return null;
}

/** Distance from a point to a segment. */
export function segmentDistance(x: number, y: number, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** The nearest point on a polyline (x,y list), its distance, and how far along the line it is. */
export function nearestOnLine(pts: number[], x: number, y: number): { x: number; y: number; d: number; along: number; seg: number } {
  let best = { x: pts[0], y: pts[1], d: Infinity, along: 0, seg: 0 }, at = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, len = Math.sqrt(L);
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0, px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { x: px, y: py, d, along: at + t * len, seg: i / 2 };
    at += len;
  }
  return best;
}

/** A polyline's length. */
export function lineLength(pts: number[]): number {
  let s = 0;
  for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return s;
}

/** Points every `step` along a polyline, both ends included. */
export function samples(pts: number[], step: number): P[] {
  const out: P[] = [[pts[0], pts[1]]];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]), n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) out.push([pts[i] + ((pts[i + 2] - pts[i]) * k) / n, pts[i + 1] + ((pts[i + 3] - pts[i + 1]) * k) / n]);
  }
  return out;
}

/** The polygon's edges as point pairs. */
export function edges(p: number[]): [P, P][] {
  const out: [P, P][] = [];
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) out.push([[p[j], p[j + 1]], [p[i], p[i + 1]]]);
  return out;
}

/** The edges two room outlines share (collinear and overlapping), as segments; used by the shared-wall checks. */
export function sharedEdges(a: number[], b: number[], eps = 1e-6): [P, P][] {
  const out: [P, P][] = [];
  for (const [p0, p1] of edges(a)) for (const [q0, q1] of edges(b)) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy);
    if (L < eps) continue;
    // both ends of q on p's line
    const off = (q: P) => Math.abs((q[0] - p0[0]) * dy - (q[1] - p0[1]) * dx) / L;
    if (off(q0) > eps || off(q1) > eps) continue;
    const t = (q: P) => ((q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy) / (L * L);
    const lo = Math.max(0, Math.min(t(q0), t(q1))), hi = Math.min(1, Math.max(t(q0), t(q1)));
    if (hi - lo < eps / L) continue;
    out.push([[p0[0] + dx * lo, p0[1] + dy * lo], [p0[0] + dx * hi, p0[1] + dy * hi]]);
  }
  return out;
}
