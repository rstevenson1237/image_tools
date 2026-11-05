/**
 * The marks a file states outside its overlay: each room's `exits` (a stair or an arrow by a wall, and its note) and each
 * area's label. They are drawn, placed and checked as overlay symbols and labels, after the file's own; `source` names the
 * entry each came from, so a finding points at it.
 */
import { textBox } from 'artgen-primitives/lib/page.ts';
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

/** A room exit's note: its size in cells (the renderer's note size at the default 40 px a cell), the gap between its lines, and the mark's size. */
const NOTE = 12 / 40, LINE_GAP = NOTE * 1.25, MARK = 0.9;
/** Cells kept between a note and the wall beside it. */
const NOTE_PAD = 0.1;

/** The span of a polygon at height `y` that holds `x`: the room's free width there (zero when `x` is not inside it). */
export function spanAt(outline: number[], x: number, y: number): [number, number] {
  const xs: number[] = [];
  for (let i = 0, j = outline.length - 2; i < outline.length; j = i, i += 2) {
    const yi = outline[i + 1], yj = outline[j + 1];
    if ((yi > y) !== (yj > y)) xs.push(outline[i] + ((y - yi) / (yj - yi)) * (outline[j] - outline[i]));
  }
  xs.sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i += 2) if (x >= xs[i] - 1e-9 && x <= xs[i + 1] + 1e-9) return [xs[i], xs[i + 1]];
  return [x, x];
}

const noteWidth = (text: string) => textBox(text, 0, 0, NOTE, { bold: false }).w;

/** A note broken into lines no wider than `max` cells, at spaces (a word wider than that keeps a line of its own). */
export function wrapNote(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && noteWidth(`${last} ${word}`) <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.length ? lines : [text];
}

/**
 * Where each of a room's exits stands: the mark and the lines of its note. Exits on one wall share it: they are spread along
 * it, each in its own stretch (for an east or west wall the mark and its note sit together in the stretch). A note is kept on
 * the room's floor: centred on its mark but moved off the walls, and broken into lines when the room is narrower than it.
 */
function placeExits(g: DungeonLayout['rooms'][number]): { x: number; y: number; angle: number; lines: { text: string; x: number; y: number }[] }[] {
  const r = g.room, exits = r.exits ?? [];
  const onSide = (s: Side) => exits.filter(x => x.at === undefined && x.side === s);
  return exits.map(x => {
    const group = x.at === undefined && x.side ? onSide(x.side) : [], n = group.length, rank = group.indexOf(x);
    const horizontal = x.side === 'n' || x.side === 's';
    const ix = Math.min(EXIT_INSET, r.w / 3), iy = Math.min(EXIT_INSET, r.h / 3);
    let [sx, sy] = x.at ?? (x.side === 'n' ? [g.cx, r.y + iy] : x.side === 's' ? [g.cx, r.y + r.h - iy] : x.side === 'w' ? [r.x + ix, g.cy] : [r.x + r.w - ix, g.cy]);
    // the stretch of the wall this exit has, when several share it
    let span = horizontal ? r.w : r.h;
    if (n > 1) {
      span = (horizontal ? r.w : r.h) / n;
      const mid = (horizontal ? r.x : r.y) + span * (rank + 0.5);
      if (horizontal) sx = mid; else sy = mid;
    }
    const lines: { text: string; x: number; y: number }[] = [];
    if (x.text) {
      // the room's free width where the note stands: at most the stretch, never past the wall
      const dir = x.side === 's' ? -1 : 1;
      let ny = sy + dir * 1.1;
      // (a note that starts off the floor altogether is left as one line where the file put it: `check` reports it)
      const free = (y: number) => { const [a, b] = spanAt(g.outline, sx, y); return b - a <= 0 ? Infinity : Math.max(0.5, b - a - 2 * NOTE_PAD); };
      const cap = horizontal && n > 1 ? span - 2 * NOTE_PAD : Infinity;
      let text: string[];
      if (n > 1 && !horizontal) {
        // several exits on a side wall: the mark and its note are centred together in the stretch
        const lay = (lines: number) => { const total = MARK + 0.1 + LINE_GAP * lines, top = r.y + span * rank + Math.max(0, (span - total) / 2); return { sy: top + MARK / 2, ny: top + MARK + 0.1 + NOTE / 2 }; };
        text = wrapNote(x.text, free(lay(1).ny));
        ({ sy, ny } = lay(text.length));
        text = wrapNote(x.text, free(ny));
      } else text = wrapNote(x.text, Math.min(free(ny), cap));
      text.forEach((t, j) => {
        const w = noteWidth(t), [a, b] = spanAt(g.outline, sx, ny + (dir > 0 ? j : j - text.length + 1) * LINE_GAP);
        const lo = a + NOTE_PAD + w / 2, hi = b - NOTE_PAD - w / 2;
        // centred on the mark; moved off the wall when it would cross one (a note wider than the room is centred in it)
        const cx = b - a <= 0 ? sx : lo > hi ? (a + b) / 2 : Math.min(hi, Math.max(lo, sx));
        lines.push({ text: t, x: cx, y: ny + (dir > 0 ? j : j - text.length + 1) * LINE_GAP });
      });
    }
    // the mark and its note move together to stay inside the room's height (a note of several lines by a short east or west wall)
    // (an exit the file puts at a point stays there)
    if (lines.length && x.at === undefined && !(n > 1 && !horizontal)) {
      const lo = r.y + NOTE_PAD, hi = r.y + r.h - NOTE_PAD, half = NOTE * 0.65;
      const top = Math.min(sy - MARK / 2, ...lines.map(q => q.y - half)), bottom = Math.max(sy + MARK / 2, ...lines.map(q => q.y + half));
      const dy = bottom > hi ? Math.max(hi - bottom, lo - top) : top < lo ? Math.min(lo - top, hi - bottom) : 0;
      if (dy) { sy += dy; for (const q of lines) q.y += dy; }
    }
    return { x: sx, y: sy, angle: x.angle ?? (x.side ? TOWARD[x.side] : -90), lines };
  });
}

export function fileMarks(spec: DungeonSpec, l: DungeonLayout): Marks {
  const out: Marks = { symbols: [], labels: [] };
  l.rooms.forEach(g => {
    const placed = placeExits(g);
    (g.room.exits ?? []).forEach((x, j) => {
      const source = `rooms[${g.index}].exits[${j}]`, p = placed[j];
      out.symbols.push({ mark: { kind: x.kind, x: p.x, y: p.y, angle: p.angle }, source });
      // the note on the room's side of the mark: under it, or over it by a south wall
      for (const line of p.lines) out.labels.push({ mark: { text: line.text, x: line.x, y: line.y, kind: 'note' }, source });
    });
  });
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
