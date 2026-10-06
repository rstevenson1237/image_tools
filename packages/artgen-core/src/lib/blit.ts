/**
 * artlab T1 char-map writes, kept as engine internals: they become the finishing pass `patch` (P1b).
 * A char map is rows of characters; `.` is transparent, other characters look up a colour in `key`.
 */
import { Grid } from './grid.ts';

export type CharKey = Record<string, string>;

/** Write a char map with its top-left at (ox, oy). */
export function blit(g: Grid, rows: string[], key: CharKey, ox = 0, oy = 0): Grid {
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, key[ch]); }));
  return g;
}

/** Write a left-half char map and its mirror image across the grid's vertical centre. */
export function blitMirrored(g: Grid, half: string[], key: CharKey, oy = 0): Grid {
  half.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '.') { g.set(x, oy + y, key[ch]); g.set(g.w - 1 - x, oy + y, key[ch]); }
  }));
  return g;
}

/**
 * Directional shade for mirrored sprites: on the half facing away from the light, pixels whose
 * neighbour on the far side is `outline` step one ramp darker (`darker` maps colour → darker colour).
 * Breaks mirror symmetry so the light reads.
 */
export function shadeSide(g: Grid, { light, outline, darker }: { light: number[]; outline: string; darker: Record<string, string> }): Grid {
  const src = g.clone(), right = (light[0] ?? -1) <= 0, half = g.w >> 1;
  const [x0, x1, dx] = right ? [half, g.w - 2, 1] : [1, half - 1, -1];
  for (let y = 0; y < g.h; y++) for (let x = x0; x <= x1; x++) {
    const c = src.get(x, y);
    if (c && src.get(x + dx, y) === outline && darker[c]) g.set(x, y, darker[c]);
  }
  return g;
}
