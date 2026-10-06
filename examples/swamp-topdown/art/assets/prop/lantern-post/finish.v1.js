// finish.v1 (f) on base.v3 — a glint on the lantern cap (lit side), a highlight run along the top of the crossarm.
export const base = 'base.v3';
export const meta = { notes: 'cap glint, crossarm top highlight' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 32), Y = v => Math.round((v * g.h) / 32);
  const tx = X(12) + X(0.8), ty = Y(3);
  px.line(g, [tx + 1, ty + Y(3) - 1], [tx + X(10), ty + Y(4) - 1], 'wood.0');
  px.set(g, [X(21.3) - 2, Y(10)], 'metal.0');
  return g;
}
