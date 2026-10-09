// plank base.v2 (r2) — from v1 (6): two planks per row per tile, each with its own tone, so rows stop repeating one
// plank; grain contrast down (0.3 → 0.18) so the highlights read as grain, not blobs.
export const meta = { brief: 'plank', pass: 'r2', notes: 'two planks per row with own tones, softer grain' };

export function render(ctx) {
  return ctx.lib.tex.material('wood', { size: ctx.size, params: { planks: 2, grain: 0.18 }, seed: ctx.seed + ctx.variant });
}
