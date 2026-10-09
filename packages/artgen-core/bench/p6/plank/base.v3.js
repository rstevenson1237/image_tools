// plank base.v3 (r3) — from v2 (6.5, short planks leaned toward bricks): rows a little wider (scale 1.25: three rows
// of ~10 px per tile) so the planks are long relative to their width; grain at 0.22.
export const meta = { brief: 'plank', pass: 'r3', notes: 'wider rows, longer-looking planks' };

export function render(ctx) {
  return ctx.lib.tex.material('wood', { size: ctx.size, scale: 1.25, params: { planks: 2, grain: 0.22 }, seed: ctx.seed + ctx.variant });
}
