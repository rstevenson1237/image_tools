// finish.v3 (f3) on base.v5 — flagstones need no pixel work beyond orphans, kept off the diamond's edge so the floor
// still repeats exactly.
export const base = 'base.v5';
export const meta = { notes: 'orphan clean-up inside the tile' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { region: [1, 1, g.w - 2, g.h - 2] });
  return g;
}
