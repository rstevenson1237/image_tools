// finish.v1 (f) on base.v3 — lift the near-black ticks (dirt.2 / outline left by the tuft shapes) to the ground tone;
// a tile has no outline, so nothing intentional is that dark.
export const base = 'base.v3';
export const meta = { notes: 'near-black ticks → ground' };

export function finish(g, ctx) {
  const { px } = ctx.lib, dark = [px.color('dirt.2'), px.color('outline'), px.color('grass.2')];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (dark.includes(g.get(x, y))) px.set(g, [x, y], 'dirt.1');
  return g;
}
