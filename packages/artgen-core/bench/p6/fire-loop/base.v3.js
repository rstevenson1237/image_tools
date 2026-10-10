// fire-loop base.v3 (r3) — from v1 (5.5, best; v2 5 fused into a dark mass): the body is now `fx.flame`, a teardrop
// licked by periodic noise that scrolls one period per loop (seamless by construction): hot core low, cooler rim,
// tongues that lick up and pinch off at the tip. Ember particles stream above it; one outer line over both.
export const meta = { brief: 'fire-loop', pass: 'r3', notes: 'noise-licked flame body + ember stream' };

export function render(ctx) {
  const [w, h] = ctx.size, D = ctx.duration, { fx } = ctx.lib, R = Math.min(w, h) * 0.4;
  const g = fx.flame({ w, h, t: ctx.t, base: [w / 2, h - 6], width: w * 0.32, height: h * 0.8, cells: 4, lick: 2.2 });
  const embers = [{ origin: [w / 2, h * 0.45], mode: 'stream', count: 5, area: R * 0.35, angle: 180, spread: 40, speed: [R * 2.5, R * 3.5], turbulence: R * 1.2, life: [D * 0.3, D * 0.55], shape: 'pixel', band: [0, 0.5], seed: 4 }];
  fx.draw(g, fx.simulate(embers, { w, h, t: ctx.t, duration: D }));
  return fx.line(g);
}
