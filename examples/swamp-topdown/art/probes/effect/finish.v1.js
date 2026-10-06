// probe-effect finish.v1 (f) on base.v1 — a hot centre pixel on the first frame (the template spark stands in for
// the will-o'-wisp until the effects track, P6c).
export const base = 'base.v1';
export const meta = { notes: 'hot core on frame 0' };

export function finish(g, ctx) {
  const { w, h } = g;
  if (ctx.key('play', 0)) ctx.lib.px.fx.glint(g, [w >> 1, h >> 1], 'glow.0', { shape: 'plus' });
  return g;
}
