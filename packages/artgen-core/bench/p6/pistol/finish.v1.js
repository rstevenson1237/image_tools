// finish.v1 (f) on base.v3 — a glint on the front sight (where the eye sits), the lit left edge of the slide lifted,
// orphan cleanup.
export const base = 'base.v3';
export const meta = { notes: 'front-sight glint, lit slide edge, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.light.rim(g, { ramps: ['metal'] });
  const [mx, my] = ctx.at('muzzle');
  if (!(ctx.key('fire', 0) || ctx.key('fire', 1))) px.light.highlight(g, [mx, my - 1], 'metal.0');
  return g;
}
