// finish.v2 (f2) on base.v4 — re-finish of the user iteration: pods read beige, so their lightest step goes one darker
// (brown cattails); lit tips on the left blades as in finish.v1.
export const base = 'base.v4';
export const meta = { notes: 'pods one step darker, left blade tips lit' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.tone(g, { ramps: ['wood'], by: 1 });
  px.light.rim(g, { ramps: ['grass'], region: [0, 0, g.w >> 1, g.h] });
  return g;
}
