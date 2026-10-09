// finish.v1 (f) on base.v3 — two bright eyes at the projected anchors with a glint beside them (front facing), the
// abdomen's lit edge lifted.
export const base = 'base.v3';
export const meta = { notes: 'eyes + glint, abdomen rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  for (const a of ['eye', 'eye2']) if (ctx.anchors[a]) px.set(g, ctx.at(a), 'red.0');
  if (ctx.anchors.eye) px.set(g, ctx.at('eye', 0, -1), 'white.0');
  px.light.rim(g, { ramps: ['purple'] });
  return g;
}
