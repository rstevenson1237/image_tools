// sparks base.v2 (r2) — from v1 (4.5): too few and too small. Now a strike point low in the frame throwing a 120° fan
// of 22 streaks up and out; long hot streaks early, they arc over under gravity and shorten to dots as they cool; a
// small flash at the strike for the first two frames.
export const meta = { brief: 'sparks', pass: 'r2', notes: 'fan of 22 streaks from a strike point, arcs, flash' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.45, c = [w / 2, h * 0.72];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.3, size: [R * 0.22, R * 0.1], shape: 'diamond', band: [0, 0.25] },
    { origin: c, count: 22, area: 0.5, angle: 180, spread: 120, speed: [R * 3, R * 5.5], drag: 1.6, gravity: R * 7, life: [D * 0.5, D * 1.05], shape: 'streak', streak: 0.06, band: [0, 0.75], curve: 1.4, seed: 1 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
