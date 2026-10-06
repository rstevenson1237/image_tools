// finish.v1 (f) on base.v3 — lit tips on the left-hand blades; the clump's shape problem is a base issue.
export const base = 'base.v3';
export const meta = { notes: 'blade tip light' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.rim(g, { ramps: ['grass'], region: [0, 0, g.w >> 1, g.h >> 1] });
  return g;
}
