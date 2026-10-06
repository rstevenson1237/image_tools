// finish.v1 (f) on base.v3 — a lit edge where the lid meets the front face (they merged), clean plank orphans.
export const base = 'base.v3';
export const meta = { notes: 'lid front edge, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 32), y = Math.round((13 * g.h) / 32) - 1;
  px.fix.orphans(g, { ramps: ['wood', 'leather'] });
  px.line(g, [X(6) + 1, y], [X(26) - 2, y], 'wood.0');
  return g;
}
