// sparks base.v3 (r3) — from v2 (5.5): 1 px streaks too thin to read and too few by the end. Now 26 streaks with
// bright 2 px heads (`head`) that cool and shrink as they fly, a wider 140° fan, a slower fall so the arcs show over
// all six frames, and a plus-shaped strike flash on the first two frames.
export const meta = { brief: 'sparks', pass: 'r3', notes: 'headed streaks, wider fan, slower arcs, plus flash' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.45, c = [w / 2, h * 0.7];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.34, size: [R * 0.3, R * 0.12], shape: 'plus', band: [0, 0.25] },
    { origin: c, count: 26, area: 0.5, angle: 180, spread: 140, speed: [R * 2.6, R * 4.6], drag: 1.4, gravity: R * 5, life: [D * 0.55, D * 1.1], shape: 'streak', streak: 0.06, head: true, size: [1.1, 0.4], band: [0, 0.75], curve: 1.4, seed: 1 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
