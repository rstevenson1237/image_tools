// wood-wall base.v2 (r2) — from v1 (5.5): speckled grain, boards chopped short. Now one board per row across the tile
// (no butt joints), calmer grain, wider boards, and an iron strap across at a third of the height with two rivets per
// board — it reads as a wall of a building, not a floor.
export const meta = { brief: 'wood-wall', pass: 'r2', notes: 'full-length boards, calmer grain, iron strap' };

export function render(ctx) {
  const [w, h] = ctx.size, src = ctx.lib.tex.material('wood', { size: [h, w], scale: 1.3, params: { planks: 1, grain: 0.18 } }), g = new ctx.lib.Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = src.get(y, x); if (c) g.set(x, y, c); }
  const m = ctx.dir.pal.metal, y0 = Math.round(h / 3);
  for (let x = 0; x < w; x++) { g.set(x, y0, m[0]); g.set(x, y0 + 1, m[1]); g.set(x, y0 + 2, m[1]); g.set(x, y0 + 3, m[2]); }
  for (let x = 5; x < w; x += 10) { g.set(x, y0 + 1, m[0]); g.set(x, y0 + 2, m[2]); }
  return g;
}
