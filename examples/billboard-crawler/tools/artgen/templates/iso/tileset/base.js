// {{ID}} base.v1 (r1) — template: iso floor + wall set from seamless material recipes. Frames share one ground
// line (the diamond's bottom corner at the frame's bottom): 0 floor diamond, 1 wall block (a diamond-topped block a
// tile tall), 2 half wall, each with the direction's outer line. Floors stagger without seams because the texture wraps. Brief: size [w, w] for a w px
// diamond, `anims: { idle: { frames: 3 } }`.
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso set: floor, wall, half wall' };

export const params = {
  floor: { type: 'choice', options: ['cobble', 'stone', 'wood', 'dirt'], default: 'cobble' },
  wall: { type: 'choice', options: ['stone', 'cobble', 'wood'], default: 'stone' },
};

export function render(ctx) {
  const P = ctx.params, { tex, Grid } = ctx.lib, [w, h] = ctx.size, th = w / 2, t = w;
  const floor = tex.material(P.floor, { size: [t, t], seed: ctx.seed }), wall = tex.material(P.wall, { size: [t, t], seed: ctx.seed + 3 });
  const g = new Grid(w, h);
  if (ctx.frame === 0) return ctx.lib.line(g.blit(tex.isoFloor(floor, w, th), 0, h - th));
  const height = ctx.frame === 1 ? h - th : Math.round((h - th) / 2);
  return ctx.lib.line(g.blit(tex.isoBlock(w, { top: wall, height }, th), 0, h - th - height));
}
