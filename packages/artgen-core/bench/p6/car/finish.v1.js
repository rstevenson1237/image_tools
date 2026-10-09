// finish.v1 (f) on base.v3 — slices are drawn rotated in the game, so pixel fixes on a slice don't survive the turn;
// the finish only clears orphan pixels per slice (a slice speck becomes a flicker when the stack rotates).
export const base = 'base.v3';
export const meta = { notes: 'orphan clean-up per slice' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g);
  return g;
}
