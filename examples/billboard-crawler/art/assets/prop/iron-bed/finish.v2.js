// finish.v2 (f2) on base.v4 — re-finish of the user iteration: moonlit rims on the iron rails, clean mattress singles (ramps updated: the mattress is wood now).
export const base = 'base.v4';
export const meta = { notes: 'rail rims, mattress orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.rim(g, { ramps: ['metal'] });
  px.fix.orphans(g, { ramps: ['wood'] });
  return g;
}
