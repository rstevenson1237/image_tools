// probe-tile finish.v1 (f) on base.v2 — the checker and scuffs are intentional; smooth the crack only.
export const base = 'base.v2';
export const meta = { notes: 'crack jaggies' };

export function finish(g, ctx) {
  ctx.lib.px.fix.jaggies(g, { ramps: ['stone'] });
  return g;
}
