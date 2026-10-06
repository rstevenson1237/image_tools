// finish.v1 (f) on base.v2 (the best: v3 regressed) — calm the per-segment speckle (orphans, banding on the hide)
// only (banding lifted the whole hide and a sucker highlight at the static anchor missed the moving head: both dropped).
export const base = 'base.v2';
export const meta = { notes: 'hide orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g, { ramps: ['grass', 'leather'] });
  return g;
}
