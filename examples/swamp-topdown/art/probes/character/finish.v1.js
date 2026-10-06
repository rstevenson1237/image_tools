// probe-character finish.v1 (f) on base.v2 — lantern light: a glow around the glass and a glint on the frame; the
// cloak's lit edge; orphan clean-up away from the eyes and the lantern (both protected).
export const base = 'base.v2';
export const meta = { notes: 'lantern glow + glint, cloak rim, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib, { w, h } = g, at = ctx.at('lantern');
  ctx.protect(at, [at[0], at[1] + 1]);
  px.fix.orphans(g, { region: [Math.round(w * 0.35), 0, w, h] });
  px.light.rim(g, { ramps: ['cloth'] });
  px.fx.glow(g, at, 2);
  px.fx.glint(g, [at[0], at[1] - 2], 'glow.0');
  return g;
}
