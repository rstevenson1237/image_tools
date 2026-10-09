// finish.v2 (f2) on base.v4 — the lit lip on the walls' top diamond (its edges toward the light one step lighter), so the
// block's top separates from the faces.
export const base = 'base.v4';
export const meta = { notes: 'lit lip on the block tops' };

export function finish(g, ctx) {
  if (ctx.frame > 0) ctx.lib.px.light.rim(g, { ramps: ['stone'], region: [0, 0, g.w, ctx.frame === 1 ? 17 : 25] });
  return g;
}
