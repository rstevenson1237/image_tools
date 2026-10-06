// finish.v1 (f) on base.v2 — keep the eye glints, light the helm's lit edge, a glint on the sword tip (anchor).
export const base = 'base.v2';
export const meta = { notes: 'protect eyes, helm rim, blade glint' };

export function finish(g, ctx) {
  const { px } = ctx.lib, red = px.color('accent.0');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === red) ctx.protect([x, y]);
  px.fix.orphans(g, { ramps: ['metal'] });
  px.light.rim(g, { ramps: ['metal'], region: [0, 0, g.w, Math.round(g.h * 0.3)] });
  px.fx.glint(g, ctx.at('blade'), 'metal.0');
  return g;
}
