// finish.v1 (f) on base.v3 — brighter twinkles: each halo pixel (an accent.1 single inside its selout cross) gets the
// hot glow.0 centre.
export const base = 'base.v3';
export const meta = { notes: 'twinkle centres' };

export function finish(g, ctx) {
  const { px } = ctx.lib, a1 = px.color('accent.1'), sets = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++)
    if (g.get(x, y) === a1 && !g.alpha(x - 1, y - 1) && !g.alpha(x + 1, y - 1) && !g.alpha(x - 1, y + 1) && !g.alpha(x + 1, y + 1)) sets.push([x, y]);
  for (const p of sets) px.set(g, p, 'glow.0');
  return g;
}
