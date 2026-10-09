// finish.v1 (f) on base.v3 — orphan pixels cleaned out of the cooling cloud, a white-hot glint at the heart of the
// flash and of the first fireball frame, and the pale frame-2 mass given a lit rim of the hottest step so it reads
// as a ball rather than a flat blot.
export const base = 'base.v3';
export const meta = { notes: 'orphans, hot glints on frames 0-1, lit rim on the frame-2 ball' };

export function finish(g, ctx) {
  const { px } = ctx.lib, c = [16, 18];
  px.fix.orphans(g);
  if (ctx.key('play', 0)) px.fx.glint(g, c, 'glow.0', { shape: 'x' });
  if (ctx.key('play', 1)) px.fx.glint(g, c, 'glow.0', { shape: 'plus' });
  if (ctx.key('play', 2)) { px.light.rim(g, { ramps: ['glow', 'accent'] }); px.light.shade(g, { ramps: ['glow', 'accent'] }); }
  return g;
}
