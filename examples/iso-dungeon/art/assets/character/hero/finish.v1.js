// finish.v1 (f) on base.v3 — clean single pixels on tabard and shield, lit rim on the helm (catches torchlight).
export const base = 'base.v3';
export const meta = { notes: 'cloth/metal orphans, helm rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g, { ramps: ['cloth', 'metal'] });
  px.light.rim(g, { ramps: ['metal'], region: [0, 0, g.w, Math.round(g.h * 0.3)] });
  return g;
}
