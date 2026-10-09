// explosion base.v3 (r3) — from v2 (6): frame 0 was a plain disc, the ball stopped at ~14 px and the debris barely
// showed. Now a four-point star flash, the fireball flung faster (reaches ~24 px) and banded hotter for longer, debris
// streaks with bright heads that arc down, and a darker smoke cloud that rises off the top as the ball cools.
export const meta = { brief: 'explosion', pass: 'r3', notes: 'star flash, bigger hotter ball, headed debris, rising smoke' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.4, c = [w / 2, h / 2 + 2];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.13, size: [R * 0.5, R * 0.6], shape: 'plus', band: [0, 0.25] },
    { origin: c, count: 1, speed: 0, life: D * 0.13, size: [R * 0.26, R * 0.3], band: [0, 0.25], seed: 5 },
    { origin: c, count: 28, area: R * 0.15, speed: [R * 3.2, R * 4.2], drag: 3, delay: [D * 0.05, D * 0.1], life: [D * 0.4, D * 0.7], size: [R * 0.36, R * 0.2], blob: true, heat: 2, seed: 1 },
    { origin: c, count: 9, area: R * 0.1, speed: [R * 5, R * 7.5], drag: 1.8, gravity: R * 5, life: [D * 0.3, D * 0.6], shape: 'streak', streak: 0.04, head: true, size: [1, 0.4], band: [0, 0.5], seed: 2 },
    { origin: [c[0], c[1] - R * 0.4], count: 9, area: R * 0.55, speed: [R * 0.4, R * 0.8], gravity: -R * 2.2, delay: [D * 0.38, D * 0.5], life: [D * 0.4, D * 0.6], size: [R * 0.26, R * 0.32], band: [0.75, 1], blob: true, heat: 4, seed: 3 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
