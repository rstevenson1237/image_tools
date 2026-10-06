// finish.v1 (f) on base.v3 — calm the fur speckle on the body, a lit line along the back (moonlight from upper left).
export const base = 'base.v3';
export const meta = { notes: 'fur orphans, back rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g, { ramps: ['hair'] });
  px.light.rim(g, { ramps: ['hair'] });
  return g;
}
