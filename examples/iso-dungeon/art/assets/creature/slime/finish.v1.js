// finish.v1 (f) on base.v3 — stair-steps along the shading band edge eased, stray singles on the ooze removed.
export const base = 'base.v3';
export const meta = { notes: 'ooze jaggies + orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.jaggies(g, { ramps: ['grass'] });
  px.fix.orphans(g, { ramps: ['grass'] });
  return g;
}
