// sparks base.v4 (u1) — from v3 (5.5; finish could not fix it): the spray was short and the heads blobbed together.
// Now 16 thin streaks (no heads: a 1 px line keeps reading as a spark under the outline) whose tails follow the
// path they flew (`streakPath`), so they draw their arcs as they rise, turn over and fall to the sides as they cool; the plus flash stays on the first two frames.
export const meta = { brief: 'sparks', pass: 'u1', notes: 'ray burst, 16 long thin streaks, wider arcs' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.45, c = [w / 2, h * 0.85];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.34, size: [R * 0.3, R * 0.12], shape: 'plus', band: [0, 0.25] },
    { origin: c, count: 16, area: 0.5, angle: 180, spread: 130, speed: [R * 5, R * 7], drag: 0.8, gravity: R * 14, life: [D * 0.6, D * 1.1], shape: 'streak', streak: 0.12, streakPath: true, band: [0, 0.75], curve: 1.3, seed: 1 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
