// probe-character finish.v1 (f) on base.v2 — a glint on the blade tip, the lit rim on the mail, orphan clean-up
// below the head (the sockets are protected by staying outside the region).
export const base = 'base.v2';
export const meta = { notes: 'blade glint, mail rim, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g, { region: [0, Math.round(g.h * 0.4), g.w, g.h] });
  px.light.rim(g, { ramps: ['metal'] });
  px.fx.glint(g, ctx.at('blade'), 'metal.0');
  return g;
}
