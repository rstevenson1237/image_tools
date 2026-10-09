// finish.v1 (f) on base.v3 — eyes at the model-projected anchors (front facing), a light rim on the hood's lit side.
export const base = 'base.v3';
export const meta = { notes: 'eyes, hood rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  for (const a of ['eye', 'eye2']) if (ctx.anchors[a]) px.set(g, ctx.at(a), 'ink.0');
  px.light.rim(g, { ramps: ['green'], region: [0, 0, 32, 20] });
  return g;
}
