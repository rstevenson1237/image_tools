// probe-prop finish.v1 (f) on base.v2 — clean the plank pattern's stray pixels, light the lit edges of the wood,
// and cut the jaggies off the tilted top edge.
export const base = 'base.v2';
export const meta = { notes: 'orphans, wood rim, tilted-edge jaggies' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.fix.jaggies(g);
  px.light.rim(g, { ramps: ['wood'] });
  return g;
}
