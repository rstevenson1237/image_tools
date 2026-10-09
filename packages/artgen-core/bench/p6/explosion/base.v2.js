// explosion base.v2 (r2) — from v1 (4.5): the fireballs scattered into unrelated bits. Now a ball: 24 fireballs at
// near-equal speeds from a small core, merged as one blob layer, so it swells as one shape and cools from the rim in;
// a small hot flash instead of a flat disc on frame 0; debris streaks; smoke merges into a dark cloud rising late.
export const meta = { brief: 'explosion', pass: 'r2', notes: 'one expanding fireball blob, small flash, late smoke cloud' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.4, c = [w / 2, h / 2 + 1];
  const layers = [
    { origin: c, count: 1, speed: 0, life: D * 0.13, size: [R * 0.32, R * 0.42], band: [0, 0.25] },
    { origin: c, count: 24, area: R * 0.15, speed: [R * 2.4, R * 3.2], drag: 3, life: [D * 0.45, D * 0.7], size: [R * 0.34, R * 0.2], blob: true, heat: 2.4, seed: 1 },
    { origin: c, count: 8, area: R * 0.1, speed: [R * 5, R * 7], drag: 2, gravity: R * 4, life: [D * 0.25, D * 0.5], shape: 'streak', streak: 0.035, band: [0, 0.5], seed: 2 },
    { origin: [c[0], c[1] - R * 0.2], count: 8, area: R * 0.5, speed: [R * 0.2, R * 0.6], gravity: -R * 1.5, delay: [D * 0.35, D * 0.5], life: [D * 0.4, D * 0.6], size: [R * 0.24, R * 0.3], band: [0.75, 1], blob: true, heat: 4, seed: 3 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
