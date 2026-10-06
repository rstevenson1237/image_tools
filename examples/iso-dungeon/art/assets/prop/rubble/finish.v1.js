// finish.v1 (f) on base.v3 — lit top edges on the blocks so they separate inside the heap.
export const base = 'base.v3';
export const meta = { notes: 'block rims' };

export function finish(g, ctx) {
  ctx.lib.px.light.rim(g, { ramps: ['stone'] });
  return g;
}
