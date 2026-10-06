// finish.v1 (f) on base.v3 — moonlit rims on the iron rails (light side), clean mattress singles.
export const base = 'base.v3';
export const meta = { notes: 'rail rims, mattress orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.rim(g, { ramps: ['metal'] });
  px.fix.orphans(g, { ramps: ['stone'] });
  return g;
}
