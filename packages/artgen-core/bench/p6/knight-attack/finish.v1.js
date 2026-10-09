// finish.v1 (f) on base.v3 — a glint on the blade tip at the `tip` anchor on the swing and the held contact frame
// (the hit should flash), the lit edge of helm and pauldron lifted to the lightest metal step, orphan cleanup.
export const base = 'base.v3';
export const meta = { notes: 'tip glint on swing/contact, lit metal rim, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.light.rim(g, { ramps: ['metal'], region: [0, 0, 48, 22] });
  if (ctx.key('attack', 2) || ctx.key('attack', 3)) px.fx.glint(g, ctx.at('tip'), 'metal.0', { shape: 'plus' });
  return g;
}
