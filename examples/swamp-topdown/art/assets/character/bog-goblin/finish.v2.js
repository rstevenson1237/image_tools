// finish.v2 (f2) on base.v3 — user feedback (pixels): the rust was a square patch. Replays finish.v1, then breaks the
// patch into a ragged edge: alternate rust pixels go back to steel, and rust creeps along the blade's lower edge.
import * as prev from './finish.v1.js';
export const base = 'base.v3';
export const meta = { notes: 'finish.v1 + ragged rust (user feedback)' };

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  const { px } = ctx.lib, rust = px.color('accent.2'), steel = [px.color('metal.0'), px.color('metal.1'), px.color('metal.2')];
  const sets = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.get(x, y);
    if (c === rust && (x + y) % 2 === 0) sets.push([x, y, 'metal.1']);
    // steel pixel sitting on the blade's edge (non-steel below): rust it every other pixel
    if (steel.includes(c) && !steel.includes(g.get(x, y + 1)) && g.get(x, y + 1) !== rust && x % 2 === 1) sets.push([x, y, 'accent.2']);
  }
  for (const [x, y, t] of sets) px.set(g, [x, y], t);
  return g;
}
