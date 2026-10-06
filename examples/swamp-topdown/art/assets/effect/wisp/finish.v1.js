// finish.v1 (f) on base.v3 — smooth the halo arc's stair-steps; keep the spark twinkles (protected: glow.0 singles).
export const base = 'base.v3';
export const meta = { notes: 'arc jaggies, twinkles protected' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.jaggies(g, { ramps: ['accent'] });
  return g;
}
