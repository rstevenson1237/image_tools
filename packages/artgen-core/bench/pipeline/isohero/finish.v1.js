// isohero finish.v1 (f) on base.v3 (6.5): dark cloak lining where the cloak meets the jerkin and legs, lit rim on
// the hood's light side, a bright edge down the dagger blade with a glint at the guard, orphan clean-up.
export const base = 'base.v3';
export const meta = { notes: 'cloak lining, hood rim, dagger edge + glint, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.outline.inner(g, { between: ['green', 'leather'] });
  px.light.rim(g, { region: [5, 4, 11, 16], ramps: ['green'] });
  px.line(g, [21, 29], [21, 32], 'steel.0');
  px.fx.glint(g, [20, 28], 'gold.0');
  return g;
}
