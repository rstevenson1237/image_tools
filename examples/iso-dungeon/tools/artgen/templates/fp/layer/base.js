// {{ID}} base.v1 (r1) — template: a first-person sky (P6d), a panorama that wraps 360° (seamless across x): bands of
// one ramp from the horizon (lightest) to the zenith, clouds, stars, a distant ridge. The raycaster draws it behind
// open ceilings; as a `layer` it also scrolls as a parallax backdrop.
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template sky panorama' };

export const params = {
  clouds: { type: 'range', min: 0, max: 1, step: 0.25, default: 0.5 },
  stars: { type: 'choice', options: [0, 0.006, 0.015], default: 0 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params;
  return ctx.lib.tex.sky({ w, h, ramp: 'cloth', cloudRamp: 'metal', clouds: P.clouds, stars: P.stars, ridge: 'stone', seed: ctx.seed + ctx.variant });
}
