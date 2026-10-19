/**
 * Sizes against the page (`--fit`, `--page-scale`) and labels kept off one another. Shared by the map and dungeon
 * renderers.
 *
 * A render has a page scale when its output is fitted to a page or one is given: output pixels per millimetre. Label
 * sizes, symbol sizes and stroke widths are then set in points (and millimetres) on that page, whatever the square. The
 * renderers draw furniture and strokes in `u`, one pixel at 96 dpi, so `u` is the page scale over {@link PX_PER_MM}, and
 * a point is 4/3 of it.
 */
import { PX_PER_MM } from './view.ts';

/** Default sizes on the page, in points (symbols in millimetres). A label's `size` is a multiple of its kind's default. */
export const PAGE_PT = {
  map: { region: 12, place: 9, water: 8, note: 7 },
  dungeon: { name: 9, note: 7, area: 12, room: 8, number: 8 },
} as const;
export const PAGE_SYMBOL_MM = 5;

/** `u` (one 96-dpi pixel, in output pixels) on a page of `pageScale` pixels per millimetre. */
export const pageUnit = (pageScale: number): number => pageScale / PX_PER_MM;

/** Output pixels in `pt` points on the page. */
export const pointsToPx = (pt: number, pageScale: number): number => (pt * 4 / 3) * pageUnit(pageScale);

/** A rectangle: x, y of the top-left corner and its width and height (output pixels). */
export interface Box { x: number; y: number; w: number; h: number }

export const overlaps = (a: Box, b: Box, gap = 0): boolean => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** The box a centred label of `size` pixels takes (text width estimated at 0.56 em a character, 0.62 bold; spaced text wider). */
export function textBox(text: string, cx: number, baseline: number, size: number, o: { bold?: boolean; spacing?: number } = {}): Box {
  const w = text.length * (size * (o.bold ? 0.62 : 0.56) + (o.spacing ?? 0)), h = size * 1.15;
  return { x: cx - w / 2, y: baseline - size * 0.82, w, h };
}

export interface PlaceLabel {
  /** Where the label is anchored (the point it names), and its baseline offset from there. */
  x: number; y: number;
  /** The label's box when drawn centred on its anchor. */
  box: Box;
  /** Room the anchor's own mark takes around the anchor on each side (so a label clears the symbol it names). */
  clear: number;
}

export interface Placed { x: number; y: number; moved: boolean; placed: boolean }

/**
 * Place labels in order. A label that overlaps an obstacle (a symbol, a badge) or a label already placed moves to the
 * nearest free spot round its anchor: right, left, above, below, then the four diagonals, then further out. One that has
 * no free spot stays where it was and is reported (`placed: false`). `bounds` keeps a label inside the sheet.
 */
export function placeLabels(labels: PlaceLabel[], obstacles: Box[], bounds?: Box, gap = 0): Placed[] {
  const taken = obstacles.slice(), out: Placed[] = [];
  const inside = (b: Box) => !bounds || (b.x >= bounds.x - 1e-6 && b.y >= bounds.y - 1e-6 && b.x + b.w <= bounds.x + bounds.w + 1e-6 && b.y + b.h <= bounds.y + bounds.h + 1e-6);
  const free = (b: Box) => inside(b) && !taken.some(t => overlaps(b, t, gap));
  for (const l of labels) {
    const at = (dx: number, dy: number): Box => ({ ...l.box, x: l.box.x + dx, y: l.box.y + dy });
    if (free(l.box)) { taken.push(l.box); out.push({ x: l.x, y: l.y, moved: false, placed: true }); continue; }
    const rx = l.clear + l.box.w / 2 + gap, ry = l.clear + l.box.h / 2 + gap;
    let found: [number, number] | null = null;
    for (const f of [1, 1.6, 2.4]) {
      const sides: [number, number][] = [[rx * f, 0], [-rx * f, 0], [0, -ry * f], [0, ry * f], [rx * f, -ry * f], [rx * f, ry * f], [-rx * f, -ry * f], [-rx * f, ry * f]];
      found = sides.find(([dx, dy]) => free(at(dx, dy))) ?? null;
      if (found) break;
    }
    if (found) { taken.push(at(found[0], found[1])); out.push({ x: l.x + found[0], y: l.y + found[1], moved: true, placed: true }); }
    else { taken.push(l.box); out.push({ x: l.x, y: l.y, moved: false, placed: false }); }
  }
  return out;
}
