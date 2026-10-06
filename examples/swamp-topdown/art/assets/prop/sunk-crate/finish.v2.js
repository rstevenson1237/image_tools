// finish.v2 — hand edit imported from ../../../refs/sunk-crate-edited.png (artgen import-edit, SPEC §6.6):
// 6 pixels in 1 cells, as colour tokens so the edit survives a restyle. Replays finish.v1 first.
import * as prev from './finish.v1.js';
export const base = 'base.v3';
export const meta = { notes: 'hand edit (import-edit)' };

const EDITS = {
  'idle/s/0': [[16,10,"metal.0"],[16,12,"metal.0"],[16,14,"metal.0"],[6,16,"grass.0"],[5,17,"grass.0"],[6,17,"grass.0"]],
};

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  for (const [x, y, t] of EDITS[`${ctx.state}/${ctx.facing}/${ctx.frame}`] ?? []) {
    if (t === null) g.clear(x, y); else ctx.lib.px.set(g, [x, y], t);
  }
  return g;
}
