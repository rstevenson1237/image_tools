/**
 * The marks a file states outside its overlay: each room's `exits` (a stair or an arrow by a wall, and its note) and each
 * area's label. They are drawn, placed and checked as overlay symbols and labels, after the file's own; `source` names the
 * entry each came from, so a finding points at it.
 */
import { polygonArea } from './geom.ts';
import type { DungeonLayout } from './layout.ts';
import type { DungeonLabel, DungeonSpec, DungeonSymbol, Side } from './spec.ts';

/** Cells between a room exit's mark and the wall it stands by (at most a third of the room's depth). */
export const EXIT_INSET = 0.9;
const TOWARD: Record<Side, number> = { n: -90, e: 0, s: 90, w: 180 };

export interface Marks { symbols: { mark: DungeonSymbol; source: string }[]; labels: { mark: DungeonLabel; source: string }[] }

/** The centre of a polygon's area. */
function centroid(p: number[]): [number, number] {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const c = p[j] * p[i + 1] - p[i] * p[j + 1]; a += c; x += (p[j] + p[i]) * c; y += (p[j + 1] + p[i + 1]) * c; }
  if (Math.abs(a) < 1e-9) return [p[0], p[1]];
  return [x / (3 * a), y / (3 * a)];
}

export function fileMarks(spec: DungeonSpec, l: DungeonLayout): Marks {
  const out: Marks = { symbols: [], labels: [] };
  l.rooms.forEach(g => (g.room.exits ?? []).forEach((x, j) => {
    const r = g.room, source = `rooms[${g.index}].exits[${j}]`;
    const ix = Math.min(EXIT_INSET, r.w / 3), iy = Math.min(EXIT_INSET, r.h / 3);
    const [sx, sy] = x.at ?? (x.side === 'n' ? [g.cx, r.y + iy] : x.side === 's' ? [g.cx, r.y + r.h - iy] : x.side === 'w' ? [r.x + ix, g.cy] : [r.x + r.w - ix, g.cy]);
    out.symbols.push({ mark: { kind: x.kind, x: sx, y: sy, angle: x.angle ?? (x.side ? TOWARD[x.side] : -90) }, source });
    // the note on the room's side of the mark: under it, or over it by a south wall
    if (x.text) out.labels.push({ mark: { text: x.text, x: sx, y: sy + (x.side === 's' ? -1.1 : 1.1), kind: 'note' }, source });
  }));
  (spec.areas ?? []).forEach((a, i) => {
    if (!a.label || polygonArea(a.points) < 1e-9) return;
    const [x, y] = centroid(a.points);
    out.labels.push({ mark: { text: a.label, x, y, kind: 'note' }, source: `areas[${i}]` });
  });
  return out;
}

/** The file with its marks added to the overlay, after its own, and the JSON path of every overlay entry. */
export function withMarks(spec: DungeonSpec, l: DungeonLayout): { spec: DungeonSpec; symbolPath: string[]; labelPath: string[] } {
  const m = fileMarks(spec, l);
  return {
    spec: m.symbols.length || m.labels.length ? { ...spec, overlay: { symbols: [...spec.overlay.symbols, ...m.symbols.map(s => s.mark)], labels: [...spec.overlay.labels, ...m.labels.map(s => s.mark)] } } : spec,
    symbolPath: [...spec.overlay.symbols.map((_, i) => `overlay.symbols[${i}]`), ...m.symbols.map(s => s.source)],
    labelPath: [...spec.overlay.labels.map((_, i) => `overlay.labels[${i}]`), ...m.labels.map(s => s.source)],
  };
}
