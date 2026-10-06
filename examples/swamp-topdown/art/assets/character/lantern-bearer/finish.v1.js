// finish.v1 (f) on base.v3 — the one direct-pixel pass (R2). Keeps the glow pixels (eyes, lantern light) out of
// the clean-up, removes coat orphans and stair-steps, (a rim on the coat was tried and dropped: it laddered the belt).
export const base = 'base.v3';
export const meta = { notes: 'protect glow pixels, orphans + jaggies on coat and boots' };

export function finish(g, ctx) {
  const { px } = ctx.lib, glow = [px.color('glow.0'), px.color('glow.1')];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (glow.includes(g.get(x, y))) ctx.protect([x, y]);
  px.fix.orphans(g, { ramps: ['cloth', 'leather'] });
  px.fix.jaggies(g, { ramps: ['cloth'] });
  return g;
}
