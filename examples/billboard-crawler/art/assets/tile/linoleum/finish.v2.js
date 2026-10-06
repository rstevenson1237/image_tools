// finish.v2 (f2) on base.v3 — user feedback (pixels): finish.v1's clean-up removed all the wear. Replays finish.v1, then
// puts back a few scuffs: short 2-3 px runs one step lighter, at fixed spots inside the tile (no wrap needed), and two
// darker heel marks.
import * as prev from './finish.v1.js';
export const base = 'base.v3';
export const meta = { notes: 'finish.v1 + scuffs back (user feedback)' };

const SCUFFS = [[3, 5, 3, -1], [19, 9, 2, -1], [11, 21, 3, -1], [26, 27, 2, -1], [7, 14, 2, 1], [23, 18, 2, 1]];

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  const { px } = ctx.lib, k = g.w / 32;
  for (const [x, y, len, dir] of SCUFFS) for (let i = 0; i < len; i++) {
    const p = [Math.round(x * k) + i, Math.round(y * k)];
    px.set(g, p, tokenOf(px, g.get(p[0], p[1]), dir));
  }
  return g;
}

// the stone token one step lighter (-1) or darker (+1) than a pixel's colour
function tokenOf(px, c, dir) {
  for (let i = 0; i < 3; i++) if (px.color(`stone.${i}`) === c) return `stone.${Math.max(0, Math.min(2, i + dir))}`;
  return 'stone.1';
}
