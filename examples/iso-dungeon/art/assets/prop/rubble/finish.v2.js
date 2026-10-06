// finish.v2 (f2) on base.v4 — re-finish of the user iteration: lit rims on the block tops so each block separates.
export const base = 'base.v4';
export const meta = { notes: 'block rims' };

export function finish(g, ctx) {
  ctx.lib.px.light.rim(g, { ramps: ['stone'] });
  return g;
}
