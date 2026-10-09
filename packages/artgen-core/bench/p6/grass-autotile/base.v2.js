// grass-autotile base.v2 (r2) — from v1 (5.5, grass and dirt too close in this palette): the ground beneath is a stone
// path (dirt recipe on the stone ramp, larger pebbles), so the grass's edge reads against a lighter, cooler ground; the
// boundary inset a little deeper for rounder islands.
export const meta = { brief: 'grass-autotile', pass: 'r2', notes: 'grass on a lighter stone path, deeper inset' };

export function render(ctx) {
  const { tex } = ctx.lib, size = ctx.size;
  const over = tex.material('grass', { size, seed: ctx.seed }), base = tex.material('dirt', { size, seed: ctx.seed + 1, scale: 1.5, ramps: { base: 'stone', pebble: 'stone' } });
  return tex.autotile(ctx.brief.autotile, ctx.frame, { over, base, seed: ctx.seed, inset: 9 });
}
