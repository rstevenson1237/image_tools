// finish.v1 (f) on base.v2 — clean the single-pixel noise specks on the flags (they flicker across a tiled floor).
export const base = 'base.v2';
export const meta = { notes: 'flag orphans' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { ramps: ['stone'] });
  return g;
}
