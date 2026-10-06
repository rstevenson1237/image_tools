// finish.v1 (f) on base.v3 — thin the brightest wear specks on the dark squares (they twinkle across a tiled floor).
export const base = 'base.v3';
export const meta = { notes: 'wear speck orphans' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { ramps: ['stone'] });
  return g;
}
