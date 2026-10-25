/**
 * Corridor shapes beyond the plain elbow (`layout.ts` lays every corridor out): a corridor that leaves a room through a
 * chosen wall, one that joins another corridor, a route along the grid round the rooms in the way, a smooth curve
 * through the bends, and a natural passage with rough walls.
 */
import { rng } from '../lib/rng.ts';
import { chaikin } from '../lib/trace.ts';
import { edges, nearestOnLine, segmentDistance, type P } from './geom.ts';
import { inPolygon, type RoomGeom } from './layout.ts';
import type { Side } from './spec.ts';

/** One end of a corridor, ready to route: where it starts, the point just outside the wall it leaves by, and the way out. */
export interface Port {
  p: P;
  /** The first point outside the room (a side end): the route runs from here. */
  stub?: P;
  /** The direction the corridor must run at this end (away from it): set by a side or a junction. */
  dir?: P;
  room?: RoomGeom;
}

/** A centre line on the grid: odd widths run down the middle of a row of cells, even widths along a grid line. */
export const snap = (v: number, w: number): number => (Math.round(w) % 2 ? Math.floor(v) + 0.5 : Math.round(v));

const OUT: Record<Side, P> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/** The port of a corridor that leaves room `g` through its `side` wall, `offset` cells along it (default the middle). */
export function sidePort(g: RoomGeom, side: Side, offset: number | undefined, width: number): Port {
  const r = g.room, d = OUT[side], across = side === 'n' || side === 's';
  const along = across ? (offset !== undefined ? r.x + offset : snap(g.cx, width)) : (offset !== undefined ? r.y + offset : snap(g.cy, width));
  const p: P = across ? [along, g.cy] : [g.cx, along];
  const edge = side === 'n' ? r.y : side === 's' ? r.y + r.h : side === 'w' ? r.x : r.x + r.w;
  const stub: P = across ? [along, edge + d[1]] : [edge + d[0], along];
  return { p, stub, dir: d, room: g };
}

/** The port of a corridor that joins the centre line `line` at the point nearest `toward`. */
export function junctionPort(line: number[], toward: P): Port {
  const j = nearestOnLine(line, toward[0], toward[1]), i = j.seg * 2;
  const tx = line[i + 2] - line[i], ty = line[i + 3] - line[i + 1], L = Math.hypot(tx, ty) || 1;
  // the way out of the joined corridor: across it, toward the other end
  let dir: P = [-ty / L, tx / L];
  if ((toward[0] - j.x) * dir[0] + (toward[1] - j.y) * dir[1] < 0) dir = [-dir[0], -dir[1]];
  return { p: [j.x, j.y], dir };
}

const horizontal = (d: P) => Math.abs(d[0]) >= Math.abs(d[1]);

/**
 * The run between two ports that keeps each end square to its wall: across, then down, then across (a Z) when both ends
 * leave sideways; an L when one leaves sideways and the other up or down.
 */
export function portRoute(a: Port, b: Port, width: number): number[] {
  const A = a.stub ?? a.p, B = b.stub ?? b.p;
  if (a.dir && b.dir) {
    const ha = horizontal(a.dir), hb = horizontal(b.dir);
    if (ha && hb) { if (A[1] === B[1]) return [...A, ...B]; const mx = snap((A[0] + B[0]) / 2, width); return [...A, mx, A[1], mx, B[1], ...B]; }
    if (!ha && !hb) { if (A[0] === B[0]) return [...A, ...B]; const my = snap((A[1] + B[1]) / 2, width); return [...A, A[0], my, B[0], my, ...B]; }
    return ha ? [...A, B[0], A[1], ...B] : [...A, A[0], B[1], ...B];
  }
  const d = a.dir ?? b.dir;
  if (!d) return [...A, B[0], A[1], ...B];
  // one end is free: run along the constrained end's way out first (or last)
  const first = a.dir ? horizontal(d) : !horizontal(d);
  return first ? [...A, B[0], A[1], ...B] : [...A, A[0], B[1], ...B];
}

/** A path with repeated points and straight-through middle points taken out. */
export function tidy(pts: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const n = out.length;
    if (n && Math.abs(out[n - 2] - pts[i]) < 1e-9 && Math.abs(out[n - 1] - pts[i + 1]) < 1e-9) continue;
    if (n >= 4) {
      const ax = out[n - 4], ay = out[n - 3], bx = out[n - 2], by = out[n - 1];
      if (Math.abs((bx - ax) * (pts[i + 1] - ay) - (by - ay) * (pts[i] - ax)) < 1e-9 && (bx - ax) * (pts[i] - bx) + (by - ay) * (pts[i + 1] - by) >= 0) { out[n - 2] = pts[i]; out[n - 1] = pts[i + 1]; continue; }
    }
    out.push(pts[i], pts[i + 1]);
  }
  return out;
}

/**
 * A route along the grid from `a` to `b` that keeps clear of the rooms in `avoid` (their floor and walls), with few
 * bends: the cheapest path where each step costs 1 and each turn 4. Null when there is none on the sheet.
 */
export function routeAround(a: P, b: P, width: number, avoid: RoomGeom[], cols: number, rows: number): number[] | null {
  const o = Math.round(width) % 2 ? 0.5 : 0, x0 = -1, y0 = -1, W = cols + 3, H = rows + 3;
  const node = (x: number, y: number) => [Math.round(x - o) - x0, Math.round(y - o) - y0] as const;
  const [sx, sy] = node(a[0], a[1]), [gx, gy] = node(b[0], b[1]);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H || gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
  const clear = width / 2 + 0.35;
  const blocked = new Uint8Array(W * H);
  for (const g of avoid) {
    const r = g.room, i0 = Math.max(0, Math.floor(r.x - clear - o) - x0), i1 = Math.min(W - 1, Math.ceil(r.x + r.w + clear - o) - x0);
    const j0 = Math.max(0, Math.floor(r.y - clear - o) - y0), j1 = Math.min(H - 1, Math.ceil(r.y + r.h + clear - o) - y0);
    const es = edges(g.outline);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i + x0 + o, y = j + y0 + o;
      if (inPolygon(g.outline, x, y) || es.some(([p, q]) => segmentDistance(x, y, p, q) < clear)) blocked[j * W + i] = 1;
    }
  }
  blocked[sy * W + sx] = 0; blocked[gy * W + gx] = 0;
  // Dijkstra over (cell, heading); a small binary heap
  const DIRS: P[] = [[1, 0], [0, 1], [-1, 0], [0, -1]], N = W * H * 4, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap: [number, number][] = [];
  const push = (d: number, s: number) => { heap.push([d, s]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let d = 0; d < 4; d++) { const s = (sy * W + sx) * 4 + d; dist[s] = 0; push(0, s); }
  let end = -1;
  while (heap.length) {
    const [d, s] = pop();
    if (d > dist[s]) continue;
    const c = s >> 2, h = s & 3, cx = c % W, cy = (c - cx) / W;
    if (cx === gx && cy === gy) { end = s; break; }
    for (let nh = 0; nh < 4; nh++) {
      if (nh === ((h + 2) & 3)) continue;
      const nx = cx + DIRS[nh][0], ny = cy + DIRS[nh][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx]) continue;
      const ns = (ny * W + nx) * 4 + nh, nd = d + 1 + (nh === h ? 0 : 4);
      if (nd < dist[ns]) { dist[ns] = nd; prev[ns] = s; push(nd, ns); }
    }
  }
  if (end < 0) return null;
  const pts: number[] = [];
  for (let s = end; s >= 0; s = prev[s]) { const c = s >> 2, cx = c % W; pts.unshift(cx + x0 + o, (c - cx) / W + y0 + o); }
  // join the true ends to the grid with square jogs, so the route stays along the grid
  const n = pts.length;
  return tidy([...a, pts[0], a[1], ...pts, b[0], pts[n - 1], ...b]);
}

/** A smooth curve through the points (centripetal Catmull-Rom), `perCell` points to a cell of length; the ends stay put. */
export function smoothLine(pts: number[], perCell = 3): number[] {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const P = (i: number): P => { const k = Math.max(0, Math.min(n - 1, i)); return [pts[2 * k], pts[2 * k + 1]]; };
  const out: number[] = [...P(0)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? [2 * P(0)[0] - P(1)[0], 2 * P(0)[1] - P(1)[1]] as P : P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = i === n - 2 ? [2 * P(n - 1)[0] - P(n - 2)[0], 2 * P(n - 1)[1] - P(n - 2)[1]] as P : P(i + 2);
    const t = (a: P, b: P) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3);
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * perCell));
    for (let k = 1; k <= steps; k++) {
      const tt = t1 + ((t2 - t1) * k) / steps;
      const lerp = (a: P, b: P, ta: number, tb: number): P => [((tb - tt) * a[0] + (tt - ta) * b[0]) / (tb - ta), ((tb - tt) * a[1] + (tt - ta) * b[1]) / (tb - ta)];
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3), C = lerp(B1, B2, t1, t2);
      out.push(C[0], C[1]);
    }
  }
  out.splice(out.length - 2, 2, ...P(n - 1));
  return out;
}

/**
 * The floor of a natural passage: a band round the centre line whose two walls wander in and out on their own (seeded),
 * between about 0.6 and 1.4 times the width, rounded off.
 */
export function naturalOutline(pts: number[], width: number, seed: number): number[] {
  const rand = rng(seed), ph = Array.from({ length: 6 }, () => rand() * Math.PI * 2);
  // even samples along the line, every half cell
  const s: { x: number; y: number; at: number }[] = [];
  let at = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]), n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = i ? 1 : 0; k <= n; k++) s.push({ x: pts[i] + ((pts[i + 2] - pts[i]) * k) / n, y: pts[i + 1] + ((pts[i + 3] - pts[i + 1]) * k) / n, at: at + (len * k) / n });
    at += len;
  }
  if (s.length < 2) return [];
  const wall = (a: number, p: number, q: number, r: number) => Math.max(0.3, 0.5 + 0.16 * Math.sin(a * 0.9 + p) + 0.11 * Math.sin(a * 2.1 + q) + 0.06 * Math.sin(a * 4.3 + r));
  const left: number[] = [], right: number[] = [];
  s.forEach((c, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty) || 1, nx = -ty / L, ny = tx / L;
    // the walls stay true at the two ends, where the passage meets a room or a door
    const ease = Math.min(1, c.at / 1.5, (at - c.at) / 1.5), l = width * (0.5 + (wall(c.at, ph[0], ph[1], ph[2]) - 0.5) * ease), r = width * (0.5 + (wall(c.at, ph[3], ph[4], ph[5]) - 0.5) * ease);
    left.push(c.x + nx * l, c.y + ny * l);
    right.unshift(c.x - nx * r, c.y - ny * r);
  });
  return chaikin({ pts: [...left, ...right], closed: true }, 2).pts;
}
