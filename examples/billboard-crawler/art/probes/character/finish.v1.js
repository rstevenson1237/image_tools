// probe-character finish.v1 (f) on base.v2 — the eyes catch the lamp: one hot pixel each (protected from the
// orphan pass), the lit rim on the skin, and orphan clean-up on the gown.
export const base = 'base.v2';
export const meta = { notes: 'eye glints, skin rim, gown orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib, [ex, ey] = ctx.at('eyes');
  ctx.protect([ex - 3, ey], [ex + 2, ey]);
  px.fix.orphans(g, { ramps: ['cloth'] });
  px.light.rim(g, { ramps: ['skin'] });
  return g;
}
