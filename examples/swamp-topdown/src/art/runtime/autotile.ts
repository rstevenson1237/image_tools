// Vendored by `artgen export --runtime` (artgen-runtime 1.0.0). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * Autotile resolver (16 and 47). Neighbour masks are 8-bit, clockwise from north: N=1, NE=2, E=4, SE=8, S=16, SW=32,
 * W=64, NW=128 (a bit is set when that neighbour is the same terrain).
 *
 * - `wang16`: edges only; tile index = N | E<<1 | S<<2 | W<<3 (0–15).
 * - `blob47`: a corner counts only when both of its edges are set; the 47 reduced masks in ascending order are the
 *   tile indices (index 0 = isolated, 46 = fully surrounded).
 */
export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

const OFFSETS: [number, number, number][] = [[0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW]];

/** 8-bit neighbour mask of cell (x, y); `same(x, y)` says whether a cell is the same terrain (out-of-map cells too). */
export function neighbourMask(x: number, y: number, same: (x: number, y: number) => boolean): number {
  let m = 0;
  for (const [dx, dy, bit] of OFFSETS) if (same(x + dx, y + dy)) m |= bit;
  return m;
}

/** Drop corners whose two edges aren't both set. */
export function reduceCorners(m: number): number {
  let r = m & (N | E | S | W);
  if (m & NE && m & N && m & E) r |= NE;
  if (m & SE && m & S && m & E) r |= SE;
  if (m & SW && m & S && m & W) r |= SW;
  if (m & NW && m & N && m & W) r |= NW;
  return r;
}

/** The 47 reduced masks, ascending: `BLOB47[i]` is the mask tile `i` is drawn for. */
export const BLOB47: readonly number[] = [...new Set(Array.from({ length: 256 }, (_, m) => reduceCorners(m)))].sort((a, b) => a - b);
const BLOB_INDEX = new Map(BLOB47.map((m, i) => [m, i]));

export const wang16 = (mask: number): number => (mask & N ? 1 : 0) | (mask & E ? 2 : 0) | (mask & S ? 4 : 0) | (mask & W ? 8 : 0);
export const blob47 = (mask: number): number => BLOB_INDEX.get(reduceCorners(mask & 255))!;

/** Tile index for a neighbour mask under a layout; `map` remaps canonical indices to exported frame order. */
export function resolveAutotile(layout: 'wang16' | 'blob47' | undefined, mask: number, map?: readonly number[]): number {
  if (!layout) return 0;
  const i = layout === 'wang16' ? wang16(mask) : blob47(mask);
  return map ? (map[i] ?? 0) : i;
}

/** Deterministic per-cell pick in [0, n): spreads tile variants over a map without visible repeats. */
export function cellHash(x: number, y: number, n: number, seed = 0): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return n > 0 ? ((h ^ (h >>> 16)) >>> 0) % n : 0;
}
