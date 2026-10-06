// finish.v1 (f) on base.v3 — the hottest pixel at the foot of the core on every frame (glow.0), where the torch head is.
export const base = 'base.v3';
export const meta = { notes: 'hot core foot' };

export function finish(g, ctx) {
  const { px } = ctx.lib, x = g.w >> 1, y = Math.round(g.h * 0.85) - 1;
  px.set(g, [x, y], 'glow.0'); px.set(g, [x - 1, y], 'glow.0');
  return g;
}
