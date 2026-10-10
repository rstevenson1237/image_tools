// finish.v1 (f) on base.v3 — clean-up only (a texture's look is in its recipe): orphan pixels merged, 1 px bands
// between two steps of the same ramp merged into the lighter one.
export const base = 'base.v3';
export const meta = { notes: 'orphans, banding' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.fix.banding(g);
  return g;
}
