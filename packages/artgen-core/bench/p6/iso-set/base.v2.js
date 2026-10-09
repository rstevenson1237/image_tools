// iso-set base.v2 (r2) — from v1 (5, noisy cobble floor, flat faces): flagstone floor (stone recipe, slabs small enough
// to keep 3–4 per diamond), walls from the same stone with bigger slabs so the faces show coursed blocks; faces now one
// step each with a dark corner line (3-step ramp).
export const meta = { brief: 'iso-set', pass: 'r2', notes: 'flagstone floor, coursed stone walls' };

export function render(ctx) {
  const { tex, Grid } = ctx.lib, [w, h] = ctx.size, th = w / 2;
  const floor = tex.material('stone', { size: [w, w], seed: ctx.seed, scale: 0.8 }), wall = tex.material('stone', { size: [w, w], seed: ctx.seed + 3, scale: 1.3 });
  const g = new Grid(w, h);
  if (ctx.frame === 0) return ctx.lib.line(g.blit(tex.isoFloor(floor, w, th), 0, h - th));
  const height = ctx.frame === 1 ? h - th : Math.round((h - th) / 2);
  return ctx.lib.line(g.blit(tex.isoBlock(w, { top: floor, left: wall, right: wall, height }, th), 0, h - th - height));
}
