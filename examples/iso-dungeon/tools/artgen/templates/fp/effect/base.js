// {{ID}} base.v1 (r1) — template: a first-person effect (P6d/P6c): an impact burst billboarded in the corridor, from
// the `impact` particle preset (ring, flash, debris streaks), drawn additively (`blend: add`). Other presets:
// explosion smoke fire sparks magic heal muzzle splash dust trail (`artgen fx --list`). Effects name a drawable object.
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template impact (particles)' };

export function render(ctx) {
  const [w, h] = ctx.size, { fx } = ctx.lib;
  return fx.particles(fx.preset('impact', { w, h, duration: ctx.duration }), { w, h, t: ctx.t, duration: ctx.duration });
}
