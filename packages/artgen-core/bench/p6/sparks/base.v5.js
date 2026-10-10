// sparks base.v5 (u2) — from v4 (6): frames 2-3 were a clump of crossing streaks, cooling to dark reds that sank into
// the outline. Now 14 sparks in a 120° fan that stay hot for most of their flight (colour curve 2.5 over the light
// half of the run), leave faster and fall in wider arcs, a short tail along the flown path, the plus flash on
// frames 0-1 and three slow embers dripping.
export const meta = { brief: 'sparks', pass: 'u2', notes: '14 hot sparks, wider arcs, embers' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.45, c = [w / 2, h * 0.85];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.34, size: [R * 0.3, R * 0.12], shape: 'plus', band: [0, 0.25] },
    { origin: c, count: 14, area: 0.5, angle: 180, spread: 120, speed: [R * 3.8, R * 5.2], drag: 1, gravity: R * 9, life: [D * 0.75, D * 1.1], shape: 'streak', streak: 0.09, streakPath: true, band: [0, 0.6], curve: 2.5, seed: 11 },
    { origin: c, count: 3, area: 1, angle: 180, spread: 90, speed: [R * 1.5, R * 2.2], gravity: R * 6, life: [D * 0.7, D], shape: 'pixel', band: [0.25, 0.75], seed: 8 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
