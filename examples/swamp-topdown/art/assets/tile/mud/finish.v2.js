// finish.v2 (f2) on base.v4 — an even field needs no pixel work beyond orphans, kept off the wrap edges so the tile
// still repeats exactly.
export const base = 'base.v4';
export const meta = { notes: 'orphan clean-up inside the tile' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { region: [1, 1, g.w - 2, g.h - 2] });
  return g;
}
