// stone base.v2 (r2) — from v1 (6, the lightest slabs made a faint lattice): smaller slabs (scale 0.7) so each tile
// holds twice as many and no single light slab marks the period; more relief so slab edges catch light.
export const meta = { brief: 'stone', pass: 'r2', notes: 'smaller slabs, more relief' };

export function render(ctx) {
  return ctx.lib.tex.material('stone', { size: ctx.size, scale: 0.7, relief: 1.4, seed: ctx.seed + ctx.variant });
}
