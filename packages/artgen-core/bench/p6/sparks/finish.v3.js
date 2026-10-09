// finish.v3 (f3) on base.v5 — the leading tip of every streak is lit: a streak end (one fill neighbour) in the upper
// half of the run steps to the hottest colour, so each spark has a bright head and a cooling tail; a glint on the flash.
export const base = 'base.v5';
export const meta = { notes: 'hot streak tips, flash glint' };

export function finish(g, ctx) {
  const { px } = ctx.lib, N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const fill = (x, y) => g.alpha(x, y) === 255 && px.tokenAt(g, [x, y]) !== 'outline';
  const tips = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!fill(x, y)) continue;
    const n = N8.filter(([dx, dy]) => fill(x + dx, y + dy)).length;
    // a streak end: one fill neighbour, and above its neighbour (sparks lead upward and outward)
    if (n === 1) tips.push([x, y]);
  }
  for (const p of tips) px.set(g, p, 'glow.0');
  if (ctx.key('play', 0) || ctx.key('play', 1)) px.fx.glint(g, [16, 27], 'glow.0', { shape: 'plus' });
  return g;
}
