// iso-set base.v3 (r3) — from v2 (5.5): wall faces from the cobble recipe at a large scale (rounded coursed stones read
// on a face better than flat slabs), floor flagstones smaller (scale 0.55) with a seed that keeps the light slabs off
// the diamond's centre.
export const meta = { brief: 'iso-set', pass: 'r3', notes: 'cobble wall faces, smaller floor flags' };

export function render(ctx) {
  const { tex, Grid } = ctx.lib, [w, h] = ctx.size, th = w / 2;
  const floor = tex.material('stone', { size: [w, w], seed: ctx.seed + 4, scale: 0.55 }), wall = tex.material('cobble', { size: [w, w], seed: ctx.seed + 3, scale: 1.4 });
  const g = new Grid(w, h);
  if (ctx.frame === 0) return ctx.lib.line(g.blit(tex.isoFloor(floor, w, th), 0, h - th));
  const height = ctx.frame === 1 ? h - th : Math.round((h - th) / 2);
  return ctx.lib.line(g.blit(tex.isoBlock(w, { top: floor, left: wall, right: wall, height }, th), 0, h - th - height));
}
