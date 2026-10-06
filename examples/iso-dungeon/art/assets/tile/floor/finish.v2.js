// finish.v2 (f2) on base.v4 — re-finish of the user iteration: as finish.v1, thin the single-pixel specks on the flags
// (the worn flag's scuffs are runs, so they survive).
export const base = 'base.v4';
export const meta = { notes: 'flag orphans' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { ramps: ['stone'] });
  return g;
}
