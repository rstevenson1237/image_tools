/**
 * Where each room's number badge and name are drawn. A room's label stands at its anchor; where it would lie on a symbol or
 * on another room's label, it moves to the first clear spot inside the room by its north, south, west or east wall. A room's
 * `labelAt` puts it by that wall (`n e s w`, or `c` the anchor) or at an offset from the anchor in cells, and it stays there.
 * A label that finds no clear spot stays where it is and is reported (`unplaced`), so `check` and a render's `--json` say so.
 *
 * Positions are in cells; sizes follow the render's pixels per cell `k` (and its page scale when it has one), so the render,
 * the overlay label placer and `check` all read the same placement.
 */
import { overlaps, PAGE_PT, PAGE_SYMBOL_MM, pageUnit, pointsToPx, textBox, type Box } from 'artgen-primitives/lib/page.ts';
import { inPolygon, type DungeonLayout } from './layout.ts';
import type { DungeonSpec } from './spec.ts';

/** The room number and name sizes in pixels. */
export const numberSize = (u: number, pageScale?: number) => (pageScale ? pointsToPx(PAGE_PT.dungeon.number, pageScale) : 19 * u);
export const nameSize = (u: number, pageScale?: number) => (pageScale ? pointsToPx(PAGE_PT.dungeon.room, pageScale) : 15 * u);

/** Where `labelAt` may put a room's label. */
export const LABEL_SIDES = ['c', 'n', 's', 'w', 'e'] as const;
export type LabelSide = (typeof LABEL_SIDES)[number];

/** A room's label as drawn: the badge's centre (cells), the badge and the name's boxes (cells), and whether it is clear. */
export interface RoomLabel { room: number; x: number; y: number; badge: Box | null; name: Box | null; placed: boolean; moved: boolean }

/** Cells kept between a label moved to a wall and the wall. */
const PAD = 0.2;

const union = (a: Box | null, b: Box | null): Box | null => {
  if (!a || !b) return a ?? b;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const shift = (b: Box | null, dx: number, dy: number): Box | null => (b ? { ...b, x: b.x + dx, y: b.y + dy } : null);

/**
 * Each room's label, in file order. `numbers`: whether badges are drawn (the file's `numbers`, or a render's layer); `labels`:
 * whether names are. Symbols and labels already placed are kept clear of.
 */
export function roomLabelLayout(spec: DungeonSpec, l: DungeonLayout, o: { ppu?: number; pageScale?: number; numbers?: boolean; labels?: boolean } = {}): RoomLabel[] {
  const k = o.ppu ?? 40, u = o.pageScale ? pageUnit(o.pageScale) : k / 40, numbers = o.numbers ?? spec.numbers, labels = o.labels ?? true;
  const taken: Box[] = spec.overlay.symbols.map(s => {
    const z = (o.pageScale ? PAGE_SYMBOL_MM * o.pageScale : k * 0.9) * (s.scale ?? 1) / k;
    return { x: s.x - z / 2, y: s.y - z / 2, w: z, h: z };
  });
  const out: RoomLabel[] = [];
  for (const g of l.rooms) {
    const hasBadge = numbers && g.number !== undefined, text = labels ? g.room.label : undefined;
    if (!hasBadge && !text) continue;
    // the label's boxes with its badge's centre at 0, 0
    const fs = numberSize(u, o.pageScale), bh = fs * 1.45, bw = Math.max(bh, String(g.number ?? '').length * fs * 0.62 + fs * 0.7);
    const badge: Box | null = hasBadge ? { x: -bw / 2 / k, y: -bh / 2 / k, w: bw / k, h: bh / k } : null;
    const nb = text ? textBox(text, 0, hasBadge ? fs * 1.6 : fs * 0.3, nameSize(u, o.pageScale), { bold: true }) : null;
    const name: Box | null = nb ? { x: nb.x / k, y: nb.y / k, w: nb.w / k, h: nb.h / k } : null, block = union(badge, name)!;
    const r = g.room, at = (side: LabelSide): [number, number] => {
      if (side === 'n') return [g.cx, r.y + PAD - block.y];
      if (side === 's') return [g.cx, r.y + r.h - PAD - (block.y + block.h)];
      if (side === 'w') return [r.x + PAD - block.x, g.cy];
      if (side === 'e') return [r.x + r.w - PAD - (block.x + block.w), g.cy];
      return [g.cx, g.cy];
    };
    // a moved label's middle stays in its room (in a narrow hall a label overhangs its walls wherever it stands)
    const inside = (x: number, y: number) => inPolygon(g.outline, x + block.x + block.w / 2, y + block.y + block.h / 2);
    const clear = (x: number, y: number) => !taken.some(t => overlaps(shift(block, x, y)!, t));
    const set = r.labelAt;
    let spot: [number, number], placed: boolean, moved = false;
    if (Array.isArray(set)) { spot = [g.cx + set[0], g.cy + set[1]]; placed = clear(...spot); }
    else if (set) { spot = at(set); placed = clear(...spot); }
    else {
      spot = at('c');
      placed = clear(...spot);
      if (!placed) {
        const better = (['n', 's', 'w', 'e'] as const).map(at).find(([x, y]) => inside(x, y) && clear(x, y));
        if (better) { spot = better; placed = true; moved = true; }
      }
    }
    const [x, y] = spot;
    taken.push(shift(block, x, y)!);
    out.push({ room: g.index, x, y, badge: shift(badge, x, y), name: shift(name, x, y), placed, moved });
  }
  return out;
}
