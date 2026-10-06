// finish.v1 (f) on base.v3 — highlight on the skull dome (lit upper-left), orphan clean-up on the bones.
export const base = 'base.v3';
export const meta = { notes: 'dome highlight, bone orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 32);
  px.fix.orphans(g, { ramps: ['stone'] });
  px.light.highlight(g, [X(13), X(12)], 'stone.0');
  px.set(g, [X(14), X(11)], 'stone.0');
  return g;
}
