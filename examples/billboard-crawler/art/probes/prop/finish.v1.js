// probe-prop finish.v1 (f) on base.v2 — moonlight on the rails' lit edges, orphans off the mattress.
export const base = 'base.v2';
export const meta = { notes: 'rail rim light, mattress orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.rim(g, { ramps: ['metal'] });
  px.fix.orphans(g, { ramps: ['stone'] });
  return g;
}
