/**
 * Exits off the map: a corridor end `{at, exit: {text}}` fades to white over its last few cells and gets a boxed note
 * saying where it leads. This is the geometry: where the corridor leaves the sheet (or stops, if its point is on the
 * sheet), where the fade starts, and the way out. The renderer draws the fade and the note from it.
 */
import type { P } from './geom.ts';
import type { DungeonLayout } from './layout.ts';
import type { DungeonSpec, Exit } from './spec.ts';

export const EXIT_FADE = 3;

export interface ExitGeom {
  corridor: number;
  end: 0 | 1;
  exit: Exit;
  /** Where the corridor stops being drawn: the sheet's edge, or the point when it lies on the sheet. */
  edge: P;
  /** Where the fade starts, `fade` cells back along the corridor from `edge`. */
  from: P;
  /** The unit direction out of the map, from `from` toward `edge`. */
  dir: P;
  /** Whether the point lies past the sheet's edge (the corridor runs off the map). */
  off: boolean;
  width: number;
}

/** A path's point `d` along it (clamped to its ends). */
function pointAt(path: number[], d: number): P {
  let at = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (at + len >= d && len > 0) { const t = (d - at) / len; return [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t]; }
    at += len;
  }
  return [path[path.length - 2], path[path.length - 1]];
}

/** How far along a path (from its start) it first comes onto the sheet: 0 when it starts on it, null when it never does. */
function onSheet(path: number[], cols: number, rows: number): number | null {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= cols && y <= rows;
  if (inside(path[0], path[1])) return 0;
  let at = 0;
  for (let i = 0; i + 3 < path.length; i += 2) {
    const x0 = path[i], y0 = path[i + 1], x1 = path[i + 2], y1 = path[i + 3], len = Math.hypot(x1 - x0, y1 - y0);
    if (inside(x1, y1)) {
      // where the segment enters the sheet (Liang-Barsky): the latest of its entries across the four edges
      const dx = x1 - x0, dy = y1 - y0;
      let t = 0;
      for (const [p, q] of [[-dx, x0], [dx, cols - x0], [-dy, y0], [dy, rows - y0]] as const) if (p < 0) t = Math.max(t, q / p);
      return at + len * t;
    }
    at += len;
  }
  return null;
}

export function layoutExits(spec: DungeonSpec, l: DungeonLayout): ExitGeom[] {
  const out: ExitGeom[] = [];
  spec.corridors.forEach((c, index) => {
    const g = l.corridors[index];
    ([c.from, c.to] as const).forEach((e, end) => {
      if (!('at' in e) || !e.exit) return;
      // the path from this end inward
      const path: number[] = [];
      if (end === 0) path.push(...g.pts); else for (let i = g.pts.length - 2; i >= 0; i -= 2) path.push(g.pts[i], g.pts[i + 1]);
      const s0 = onSheet(path, spec.cols, spec.rows);
      if (s0 === null) return;
      const fade = e.exit.fade ?? EXIT_FADE, edge = pointAt(path, s0), from = pointAt(path, s0 + fade), back = pointAt(path, s0 + Math.max(0.5, fade));
      const dx = edge[0] - back[0], dy = edge[1] - back[1], L = Math.hypot(dx, dy) || 1;
      out.push({ corridor: index, end: end as 0 | 1, exit: e.exit, edge, from, dir: [dx / L, dy / L], off: s0 > 0, width: g.width });
    });
  });
  return out;
}
