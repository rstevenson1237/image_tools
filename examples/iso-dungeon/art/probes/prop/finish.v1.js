// probe-prop finish.v1 (f) on base.v2 — glints on the gold lock and on the heaped gold when open.
export const base = 'base.v2';
export const meta = { notes: 'gold glints' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.light.rim(g, { ramps: ['accent'] });
  return g;
}
