/**
 * Autotile bit maths shared by the tile synthesis (`artgen-scene/tex/autotile.ts`) and the map exports
 * (`artgen-mapgen/tilemap`). The runtime keeps its own copy (`artgen-runtime/src/autotile.ts`: it imports nothing);
 * a test keeps the two in step.
 *
 * Neighbour masks are 8-bit, clockwise from north: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128.
 * - `wang16`: edges only; tile index = N | E<<1 | S<<2 | W<<3.
 * - `blob47`: a corner counts only when both of its edges are set; the 47 reduced masks in ascending order are the tile
 *   indices (0 = isolated, 46 = surrounded).
 */
export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;
export type AutotileLayout = 'wang16' | 'blob47';

/** Neighbour offsets with their bits, clockwise from north. */
export const NEIGHBOURS: readonly [number, number, number][] = [[0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW]];

/** Drop corners whose two edges aren't both set. */
export function reduceCorners(m: number): number {
  let r = m & (N | E | S | W);
  if (m & NE && m & N && m & E) r |= NE;
  if (m & SE && m & S && m & E) r |= SE;
  if (m & SW && m & S && m & W) r |= SW;
  if (m & NW && m & N && m & W) r |= NW;
  return r;
}

/** The 47 reduced masks, ascending: tile `i` of a blob47 set is drawn for `BLOB47[i]`. */
export const BLOB47: readonly number[] = [...new Set(Array.from({ length: 256 }, (_, m) => reduceCorners(m)))].sort((a, b) => a - b);
const BLOB_INDEX = new Map(BLOB47.map((m, i) => [m, i]));

export const autotileCount = (layout: AutotileLayout): number => (layout === 'blob47' ? 47 : 16);

/** 8-bit neighbour mask of cell (x, y); `same(x, y)` says whether a cell is the same class (out-of-map cells too). */
export function neighbourMask(x: number, y: number, same: (x: number, y: number) => boolean): number {
  let m = 0;
  for (const [dx, dy, bit] of NEIGHBOURS) if (same(x + dx, y + dy)) m |= bit;
  return m;
}

/** Tile index for an 8-bit neighbour mask (the runtime's `wang16` / `blob47`). */
export function autotileIndexOf(layout: AutotileLayout, mask: number): number {
  if (layout === 'wang16') return (mask & N ? 1 : 0) | (mask & E ? 2 : 0) | (mask & S ? 4 : 0) | (mask & W ? 8 : 0);
  return BLOB_INDEX.get(reduceCorners(mask & 255))!;
}

/** 8-bit neighbour mask a tile of a layout is drawn for. */
export function autotileMask(layout: AutotileLayout, index: number): number {
  if (layout === 'blob47') {
    const m = BLOB47[index];
    if (m === undefined) throw new Error(`blob47 has 47 tiles (index ${index})`);
    return m;
  }
  if (index < 0 || index > 15) throw new Error(`wang16 has 16 tiles (index ${index})`);
  return (index & 1 ? N : 0) | (index & 2 ? E : 0) | (index & 4 ? S : 0) | (index & 8 ? W : 0);
}

/** Deterministic per-cell pick in [0, n), the runtime's `cellHash`: spreads tile variants over a map. */
export function cellHash(x: number, y: number, n: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return n > 0 ? ((h ^ (h >>> 16)) >>> 0) % n : 0;
}
