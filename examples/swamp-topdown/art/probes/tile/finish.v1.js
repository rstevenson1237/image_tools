// probe-tile finish.v1 (f) on base.v2 — specks and reed tips are intentional single pixels, so no orphan pass; only
// smooth the puddle rims.
export const base = 'base.v2';
export const meta = { notes: 'puddle rim jaggies only' };

export function finish(g, ctx) {
  ctx.lib.px.fix.jaggies(g, { ramps: ['stone'] });
  return g;
}
