// finish.v1 (f) on base.v3 — the eye points painted at the projected `eye` / `eye2` anchors in the lightest skin step
// (sub-voxel, so the raster vote drops them), lit horn tips, orphan cleanup.
export const base = 'base.v3';
export const meta = { notes: 'eye points at the eye anchors, orphans, lit horns' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  for (const a of ['eye', 'eye2']) if (ctx.anchors[a]) px.set(g, ctx.at(a), 'skin.0');
  px.light.rim(g, { ramps: ['hair'], region: [0, 0, 32, 14] });
  return g;
}
