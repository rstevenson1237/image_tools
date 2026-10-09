// explosion base.v1 (r1) — the `explosion` particle preset as it ships: flash, fireballs (blob layer), debris
// streaks, late smoke; 8 frames at the direction's fps, additive.
export const meta = { brief: 'explosion', pass: 'r1', notes: 'explosion preset' };

export function render(ctx) {
  const [w, h] = ctx.size, { fx } = ctx.lib;
  return fx.particles(fx.preset('explosion', { w, h, duration: ctx.duration }), { w, h, t: ctx.t, duration: ctx.duration });
}
