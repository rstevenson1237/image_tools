// finish.v1 (f) on base.v3 — clean coat singles; knuckle line on each hand (one darker pixel row) so they read as hands.
export const base = 'base.v3';
export const meta = { notes: 'coat orphans, knuckles' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 32), neck = Math.round(g.h * 0.08 + X(9) + 1);
  px.fix.orphans(g, { ramps: ['metal'] });
  for (const k of [-1, 1]) px.line(g, [Math.round(g.w / 2 + k * X(4) - X(1.2)), neck + X(2)], [Math.round(g.w / 2 + k * X(4) + X(1.2)), neck + X(2)], 'skin.1');
  return g;
}
