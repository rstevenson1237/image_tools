// stone base.v3 (r3) — from v2 (6.5): slabs a touch larger (0.8) and relief eased (1.2) so the ground reads calmer
// at 1x while keeping several slabs per tile; a different seed sets the slab layout so no bright slab sits mid-tile.
export const meta = { brief: 'stone', pass: 'r3', notes: 'calmer slabs, new layout seed' };

export function render(ctx) {
  return ctx.lib.tex.material('stone', { size: ctx.size, scale: 0.8, relief: 1.2, seed: ctx.seed + 6 + ctx.variant });
}
