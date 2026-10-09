// iso-set base.v4 — after the finish (6; target 6.5): the floor was the weak frame. Flagstones at full scale with low
// relief read as a few calm flags per diamond instead of noise; walls keep v3's cobble faces.
export const meta = { brief: 'iso-set', pass: 'x1', notes: 'calm full-size floor flags; v3 walls' };

export function render(ctx) {
  const { tex, Grid } = ctx.lib, [w, h] = ctx.size, th = w / 2;
  const floor = tex.material('stone', { size: [w, w], seed: ctx.seed + 9, scale: 1.1, relief: 0.7 }), wall = tex.material('cobble', { size: [w, w], seed: ctx.seed + 3, scale: 1.4 });
  const g = new Grid(w, h);
  if (ctx.frame === 0) return ctx.lib.line(g.blit(tex.isoFloor(floor, w, th), 0, h - th));
  const height = ctx.frame === 1 ? h - th : Math.round((h - th) / 2);
  return ctx.lib.line(g.blit(tex.isoBlock(w, { top: floor, left: wall, right: wall, height }, th), 0, h - th - height));
}
