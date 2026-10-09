// finish.v1 (f) on base.v3 — ember eyes painted at the model-projected eye anchors (sub-voxel, so the raster vote drops
// them), a glint on the blade tip, the skull's lit edge lifted to the lightest bone step.
export const base = 'base.v3';
export const meta = { notes: 'ember eyes at eye anchors, blade-tip glint, lit skull rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.light.rim(g, { ramps: ['skin'], region: [0, 0, 32, 20] });
  for (const a of ['eye', 'eye2']) if (ctx.anchors[a]) px.set(g, ctx.at(a), 'accent.0');
  if (ctx.anchors.blade) px.fx.glint(g, ctx.at('blade'), 'metal.0');
  return g;
}
