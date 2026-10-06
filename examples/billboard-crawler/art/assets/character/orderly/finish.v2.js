// finish.v2 (f2) on base.v3 — user feedback (pixels): the black wedges under the hands read as holes. Replays finish.v1,
// then turns interior outline pixels (ink with opaque pixels on all four sides, i.e. not the silhouette) into the
// coat's darkest grey, so the cuffs stay separated without punching holes in the coat.
import * as prev from './finish.v1.js';
export const base = 'base.v3';
export const meta = { notes: 'finish.v1 + interior ink softened (user feedback)' };

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  const { px } = ctx.lib, ink = px.color('outline'), sets = [];
  const top = Math.round(g.h * 0.4); // below the face: eyes and mouth keep their ink
  for (let y = top; y < g.h; y++) for (let x = 0; x < g.w; x++)
    if (g.get(x, y) === ink && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => g.alpha(x + dx, y + dy) === 255)) sets.push([x, y]);
  for (const p of sets) px.set(g, p, 'metal.2');
  return g;
}
