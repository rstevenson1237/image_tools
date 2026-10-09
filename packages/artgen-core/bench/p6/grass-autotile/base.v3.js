// grass-autotile base.v3 (r3) — from v2 (6.5): no bare patches inside the grass (they repeated every tile); the path
// beneath keeps its pebbles.
export const meta = { brief: 'grass-autotile', pass: 'r3', notes: 'no bare patches in the grass' };

export function render(ctx) {
  const { tex } = ctx.lib, size = ctx.size;
  const over = tex.material('grass', { size, seed: ctx.seed, params: { soil: 1 } }), base = tex.material('dirt', { size, seed: ctx.seed + 1, scale: 1.5, ramps: { base: 'stone', pebble: 'stone' } });
  return tex.autotile(ctx.brief.autotile, ctx.frame, { over, base, seed: ctx.seed, inset: 9 });
}
