// finish.v1 (f) on base.v3 — keep the eye pixels, clean the gown's single pixels, lit rim on the shoulders.
export const base = 'base.v3';
export const meta = { notes: 'protect eyes, gown orphans, shoulder rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib, eye = px.color('accent.1');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === eye) ctx.protect([x, y]);
  px.fix.orphans(g, { ramps: ['cloth', 'skin'] });
  px.light.rim(g, { ramps: ['cloth'], region: [0, Math.round(g.h * 0.25), g.w, Math.round(g.h * 0.2)] });
  return g;
}
