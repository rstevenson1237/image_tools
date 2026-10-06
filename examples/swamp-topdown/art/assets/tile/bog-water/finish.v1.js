// finish.v1 (f) on base.v3 — vary the identical ripple dashes: every other one gets a lighter centre pixel.
export const base = 'base.v3';
export const meta = { notes: 'ripple variation' };

export function finish(g, ctx) {
  const { px } = ctx.lib, rip = px.color('stone.1');
  let n = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w - 1; x++)
    if (g.get(x, y) === rip && g.get(x + 1, y) === rip && g.get(x - 1, y) !== rip && n++ % 2 === 0) px.set(g, [x + 1, y], 'stone.0');
  return g;
}
