// sparks base.v1 (r1) — the `sparks` preset thrown upward (angle 180 = up): streaks with gravity and drag.
export const meta = { brief: 'sparks', pass: 'r1', notes: 'sparks preset, upward' };

export function render(ctx) {
  const [w, h] = ctx.size, { fx } = ctx.lib;
  return fx.particles(fx.preset('sparks', { w, h, duration: ctx.duration, angle: 180 }), { w, h, t: ctx.t, duration: ctx.duration });
}
