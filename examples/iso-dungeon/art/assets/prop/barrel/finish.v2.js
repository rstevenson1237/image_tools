// finish.v2 (f2) on base.v3 — user feedback (pixels): hoops catch the torchlight along their whole front edge. Replays
// finish.v1, then lifts every hoop pixel whose upper neighbour is wood (the hoop's top edge) to the lightest metal.
import * as prev from './finish.v1.js';
export const base = 'base.v3';
export const meta = { notes: 'finish.v1 + lit hoop top edges (user feedback)' };

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  const { px } = ctx.lib, metal = [px.color('metal.1'), px.color('metal.2')], wood = [px.color('wood.0'), px.color('wood.1'), px.color('wood.2'), px.color('leather.1'), px.color('leather.2')];
  const sets = [];
  for (let y = 1; y < g.h; y++) for (let x = 0; x < g.w; x++) if (metal.includes(g.get(x, y)) && wood.includes(g.get(x, y - 1))) sets.push([x, y]);
  for (const p of sets) px.set(g, p, 'metal.0');
  return g;
}
