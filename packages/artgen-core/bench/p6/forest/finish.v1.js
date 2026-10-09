// finish.v1 (f) on base.v3 — canopy tops catch the light (rim on the grass ramp, near layer only), the ridge line of the
// far hills gets a lit edge so the silhouette reads against the sky.
export const base = 'base.v3';
export const meta = { notes: 'lit canopy tops and ridge edge' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  if (ctx.state === 'near') px.light.rim(g, { ramps: ['grass'], region: [0, 0, 96, 14] });
  if (ctx.state === 'far') px.light.rim(g, { ramps: ['stone'] });
  return g;
}
