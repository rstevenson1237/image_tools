/**
 * Map furniture (the title, scale bar, compass, legend and exit notes): over the map in its corners, or in a band beside
 * it so nothing on the map is hidden. `furniture.place` in `dungeon.json` chooses: `over` (the default) keeps every item
 * in its corner; `outside` moves every item into a band below (or right of) the map; `auto` moves only the items whose
 * corner would cover a room, a corridor, a wall or a mark. The band adds to the render's size; the map keeps its scale.
 */
import { overlaps, type Box } from '../lib/page.ts';
import type { Frame } from '../lib/view.ts';
import { edges, nearestOnLine, segmentDistance } from './geom.ts';
import { inPolygon, type DungeonLayout } from './layout.ts';
import type { DungeonSpec } from './spec.ts';
import { layoutWalls } from './walls.ts';

export const FURNITURE_PLACES = ['over', 'outside', 'auto'] as const;
export type FurniturePlace = (typeof FURNITURE_PLACES)[number];
export const FURNITURE_SIDES = ['bottom', 'right'] as const;
export type FurnitureSide = (typeof FURNITURE_SIDES)[number];

/** One piece of furniture: its size and corner position over the map (output pixels), and how to draw it at a top-left corner. */
export interface FurnitureItem {
  id: string;
  w: number; h: number;
  /** Where it sits over the map (top-left corner, pixels). */
  over: { x: number; y: number };
  /** Always in the band, whatever `place` says (an exit note when the band is there). */
  band?: boolean;
  draw: (x: number, y: number) => string;
}

export interface PlacedFurniture { item: FurnitureItem; x: number; y: number; outside: boolean }
export interface FurnitureLayout { placed: PlacedFurniture[]; band: { right: number; bottom: number } }

/**
 * Whether a box (pixels at `k` a cell) covers something drawn: a room's floor or wall, a corridor, an enclosing wall, a
 * label, a symbol or a room's badge. Hatching is not content: a corner over the rock hides nothing.
 */
export function coversContent(spec: DungeonSpec, l: DungeonLayout, k: number, box: Box): boolean {
  const x0 = box.x / k, y0 = box.y / k, x1 = (box.x + box.w) / k, y1 = (box.y + box.h) / k, m = 0.14 * spec.style.wall + 0.3;
  const marks: Box[] = [...spec.overlay.labels, ...spec.overlay.symbols].map(o => ({ x: o.x - 0.6, y: o.y - 0.6, w: 1.2, h: 1.2 }));
  const cells: Box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  if (marks.some(b => overlaps(b, cells))) return true;
  if (l.rooms.some(g => overlaps({ x: g.cx - 0.6, y: g.cy - 0.6, w: 1.2, h: 1.2 }, cells))) return true;
  const walls = layoutWalls(spec, l);
  for (let y = y0; y <= y1 + 1e-9; y += 0.25) for (let x = x0; x <= x1 + 1e-9; x += 0.25) {
    for (const g of l.rooms) {
      if (g.room.x - m > x || g.room.x + g.room.w + m < x || g.room.y - m > y || g.room.y + g.room.h + m < y) continue;
      if (inPolygon(g.outline, x, y) || edges(g.outline).some(([a, b]) => segmentDistance(x, y, a, b) < m)) return true;
    }
    for (const c of l.corridors) if (nearestOnLine(c.pts, x, y).d < c.width / 2 + m) return true;
    for (const w of walls) if (edges(w.ring).some(([a, b]) => segmentDistance(x, y, a, b) < w.thickness / 2 + m)) return true;
  }
  return false;
}

/**
 * Where each item goes. Items left over the map keep their corners; the rest line up in the band, in order: along the
 * bottom from the left, or down the right side from the top, `pad` from the map and from each other, starting a new row
 * (column) where the next item would run past the map's edge.
 */
export function placeFurniture(items: FurnitureItem[], fr: Frame, place: FurniturePlace, side: FurnitureSide, pad: number, covers: (b: Box) => boolean): FurnitureLayout {
  const out = items.map(item => ({ item, outside: item.band || place === 'outside' || (place === 'auto' && covers({ x: item.over.x, y: item.over.y, w: item.w, h: item.h })) }));
  const moved = out.filter(p => p.outside);
  const placed: PlacedFurniture[] = [];
  let right = 0, bottom = 0;
  // rows (or columns) wrap at the map's width (height), so the band stays beside the map rather than past its end
  if (side === 'bottom') {
    let x = fr.x + pad, y = fr.b + pad, row = 0;
    for (const p of moved) {
      if (x > fr.x + pad && x + p.item.w + pad > fr.r) { x = fr.x + pad; y += row + pad; row = 0; }
      placed.push({ item: p.item, x, y, outside: true });
      x += p.item.w + pad; row = Math.max(row, p.item.h);
      bottom = Math.max(bottom, y + row + pad - fr.b); right = Math.max(right, x - fr.r);
    }
  } else {
    let x = fr.r + pad, y = fr.y + pad, col = 0;
    for (const p of moved) {
      if (y > fr.y + pad && y + p.item.h + pad > fr.b) { y = fr.y + pad; x += col + pad; col = 0; }
      placed.push({ item: p.item, x, y, outside: true });
      y += p.item.h + pad; col = Math.max(col, p.item.w);
      right = Math.max(right, x + col + pad - fr.r); bottom = Math.max(bottom, y - fr.b);
    }
  }
  for (const p of out) if (!p.outside) placed.push({ item: p.item, x: p.item.over.x, y: p.item.over.y, outside: false });
  // keep the drawing order of the items as given
  placed.sort((a, b) => items.indexOf(a.item) - items.indexOf(b.item));
  return { placed, band: { right: Math.max(0, right), bottom: Math.max(0, bottom) } };
}
