// finish.v1 (f) on base.v3 — calm the bevel grid: keep the lit top edges (horizontal runs), drop the lit vertical
// runs back to the tile tone (a first try thinning every third bevel pixel read as stitching).
export const base = 'base.v3';
export const meta = { notes: 'lit top edges only' };

export function finish(g, ctx) {
  const { px } = ctx.lib, lit = px.color('stone.0'), sets = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++)
    if (g.get(x, y) === lit && (g.get(x, (y + 1) % g.h) === lit || g.get(x, (y - 1 + g.h) % g.h) === lit) && g.get((x + 1) % g.w, y) !== lit) sets.push([x, y]);
  for (const p of sets) px.set(g, p, 'stone.1');
  return g;
}
