/**
 * Wavy edging along a room's walls (`rooms[].edge: "wavy"`): a curtain, drapery or rubble margin. Each wall that faces a listed
 * side (the way its outward normal points: `n e s w`) gets a wavy line just inside it. The geometry is a list of polylines in
 * cells; the renderer strokes them.
 */
import { area2 } from './geom.ts';
import type { Room, Side } from './spec.ts';

/** How far the wave lies inside the wall, its height and its length, in cells. */
export const EDGING = { inset: 0.24, amplitude: 0.1, wavelength: 0.5 } as const;

/** The side a wall faces: the way its outward normal points most. */
export function wallSide(nx: number, ny: number): Side {
  return Math.abs(ny) >= Math.abs(nx) ? (ny < 0 ? 'n' : 's') : nx < 0 ? 'w' : 'e';
}

/**
 * The wavy lines for a room's outline (x,y pairs, cells): one polyline per run of walls that face a listed side. The wave lies
 * on the outline pulled in by `inset` (a mitre at each corner), trimmed by `inset` at each end of a run so waves on two walls
 * do not meet at a corner; a round room's many short walls on one side make one run.
 */
export function wavyEdges(room: Pick<Room, 'edge' | 'edgeSides'>, outline: number[]): number[][] {
  const n = outline.length / 2;
  if (room.edge !== 'wavy' || n < 3) return [];
  const sides = new Set<Side>(room.edgeSides ?? ['n', 'e', 's', 'w']), flip = area2(outline) < 0 ? -1 : 1;
  const v = (i: number): [number, number] => { const k = ((i % n) + n) % n; return [outline[2 * k], outline[2 * k + 1]]; };
  // edge i runs from vertex i-1 to vertex i; clockwise on the page, its outward normal is (dy, -dx)
  const normal = (i: number): [number, number] => {
    const [ax, ay] = v(i - 1), [bx, by] = v(i), len = Math.hypot(bx - ax, by - ay) || 1;
    return [(flip * (by - ay)) / len, (-flip * (bx - ax)) / len];
  };
  const side = (i: number) => wallSide(...normal(i));
  // the outline pulled in at each vertex (mitred), so a run of walls is one smooth line
  const pulled = (i: number): [number, number] => {
    const [n1x, n1y] = normal(i), [n2x, n2y] = normal(i + 1), d = 1 + n1x * n2x + n1y * n2y, [x, y] = v(i);
    const k = EDGING.inset / Math.max(d, 0.25);
    return [x - (n1x + n2x) * k, y - (n1y + n2y) * k];
  };
  let start = 0;
  for (let i = 0; i < n; i++) if (side(i) !== side(i - 1)) { start = i; break; }
  const out: number[][] = [];
  for (let c = 0; c < n;) {
    const first = start + c, s = side(first);
    let m = 1;
    while (c + m < n && side(first + m) === s) m++;
    c += m;
    if (!sides.has(s)) continue;
    // the run: pulled vertices first-1 .. first+m-1, trimmed at both ends
    const pts: [number, number][] = [];
    for (let i = first - 1; i <= first + m - 1; i++) pts.push(pulled(i));
    const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = segLen.reduce((a, b) => a + b, 0);
    const from = EDGING.inset, to = total - EDGING.inset;
    if (to - from < EDGING.wavelength / 2) continue;
    const steps = Math.max(4, Math.ceil(((to - from) / EDGING.wavelength) * 8)), line: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const d = from + ((to - from) * k) / steps;
      let at = 0, j = 0;
      while (j < segLen.length - 1 && at + segLen[j] < d) at += segLen[j++];
      const t = segLen[j] ? (d - at) / segLen[j] : 0, [nx, ny] = normal(first + j), wave = Math.sin(((d - from) / EDGING.wavelength) * Math.PI * 2) * EDGING.amplitude;
      line.push(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t + nx * wave, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t + ny * wave);
    }
    out.push(line);
  }
  return out;
}
