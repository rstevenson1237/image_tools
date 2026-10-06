// finish.v1 (f) on base.v3 — round off the faceted silhouette: clear the outermost corner pixel of each stair step on
// the barrel's top corners, and a lit pixel on each hoop's front.
export const base = 'base.v3';
export const meta = { notes: 'corner rounding, hoop glints' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.outline.corners(g);
  px.light.rim(g, { ramps: ['metal'] });
  return g;
}
