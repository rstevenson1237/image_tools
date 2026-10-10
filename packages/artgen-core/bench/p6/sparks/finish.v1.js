// finish.v1 (f) on base.v3 — the strike flash gets a white-hot centre glint on its two frames; orphan cleanup.
export const base = 'base.v3';
export const meta = { notes: 'flash glint, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  if (ctx.key('play', 0) || ctx.key('play', 1)) px.fx.glint(g, [16, 22], 'glow.0', { shape: 'plus' });
  return g;
}
