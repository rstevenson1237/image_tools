// fire-loop base.v2 (r2) — from v1 (5.5): a squat bulb with one tongue. Now three tongues born at different points of a
// wider base (each its own stream, phase-offset so they lick in turn), a narrower hot core low down (heat 3.4), a dark
// smoke wisp above and embers. Streams wrap at the loop period, so it stays seamless.
export const meta = { brief: 'fire-loop', pass: 'r2', notes: 'three phase-offset tongues, smaller core, embers' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, R = Math.min(w, h) * 0.4, base = h * 0.92;
  const tongue = (x, seed, tall) => ({
    origin: [x, base], mode: 'stream', count: 12, area: [R * 0.22, R * 0.04], angle: 180, spread: 10, speed: [R * 2.6 * tall, R * 3.6 * tall],
    gravity: -R, turbulence: R * 0.8, drag: 0.4, life: [D * 0.4, D * 0.85], size: [R * 0.38, R * 0.12], blob: 0.45, heat: 3.4, seed,
  });
  const layers = [
    { ...tongue(w / 2, 1, 1.15), count: 16, area: [R * 0.45, R * 0.05] },
    tongue(w / 2 - R * 0.4, 2, 0.8),
    tongue(w / 2 + R * 0.45, 3, 0.9),
    { origin: [w / 2, base - R * 0.6], mode: 'stream', count: 4, area: R * 0.4, angle: 180, spread: 50, speed: [R * 3.5, R * 5], turbulence: R * 1.5, life: [D * 0.35, D * 0.6], shape: 'pixel', band: [0, 0.5], seed: 4 },
  ];
  return ctx.lib.fx.particles(layers, { w, h, t: ctx.t, duration: D });
}
