// probe-effect finish.v1 (f) on base.v1 — lamp-flicker core on frame 0 (template effect until P6c).
export const base = 'base.v1';
export const meta = { notes: 'hot core on frame 0' };

export function finish(g, ctx) {
  if (ctx.key('play', 0)) ctx.lib.px.fx.glint(g, [g.w >> 1, g.h >> 1], 'glow.0', { shape: 'plus' });
  return g;
}
