// finish.v1 (f) on base.v2 — a seamless texture has little a pixel pass can add without risking the wrap: orphan pixels
// only (inside the tile; the edges are left to the recipe so the tiling stays exact).
export const base = 'base.v2';
export const meta = { notes: 'orphan clean-up away from the wrap edges' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { region: [1, 1, g.w - 2, g.h - 2] });
  return g;
}
