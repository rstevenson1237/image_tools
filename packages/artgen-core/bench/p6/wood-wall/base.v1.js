// wood-wall base.v1 (r1) — from the fp/texture template: the `wood` recipe at 64 px, planks turned vertical for a
// wall (the recipe lays them horizontally, so the tile is rendered transposed).
export const meta = { brief: 'wood-wall', pass: 'r1', notes: 'wood recipe, vertical planks' };

export function render(ctx) {
  const [w, h] = ctx.size, src = ctx.lib.tex.material('wood', { size: [h, w], seed: ctx.seed }), g = new ctx.lib.Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = src.get(y, x); if (c) g.set(x, y, c); }
  return g;
}
