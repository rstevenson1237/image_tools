// finish.v2 — hand edit imported from ../../../refs/skeleton-knight-edited.png (artgen import-edit, SPEC §6.6):
// 3 pixels in 1 cells, as colour tokens so the edit survives a restyle. Replays finish.v1 first.
import * as prev from './finish.v1.js';
export const base = 'base.v2';
export const meta = { notes: 'hand edit (import-edit)' };

const EDITS = {
  'idle/s/0': [[12,3,"outline"],[13,3,"outline"],[5,12,"accent.1"]],
};

export function finish(g, ctx) {
  g = prev.finish(g, ctx) ?? g;
  for (const [x, y, t] of EDITS[`${ctx.state}/${ctx.facing}/${ctx.frame}`] ?? []) {
    if (t === null) g.clear(x, y); else ctx.lib.px.set(g, [x, y], t);
  }
  return g;
}
