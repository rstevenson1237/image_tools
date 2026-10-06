// finish.v1 (f) on base.v3 — clean the speckle the torso noise leaves on the skin, keep the eye pixels, a glint on
// the cleaver's top corner and a lit edge on the ears.
export const base = 'base.v3';
export const meta = { notes: 'skin orphans, cleaver glint, ear rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib, eye = px.color('accent.0');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === eye) ctx.protect([x, y]);
  px.fix.orphans(g, { ramps: ['cloth'] });
  px.fix.jaggies(g, { ramps: ['cloth'] });
  const [w, h] = [g.w, g.h];
  px.fx.glint(g, [Math.round(w / 2 - (w * 11.5) / 32), Math.round(h * 0.77 - (w * 8) / 32)], 'metal.0');
  return g;
}
