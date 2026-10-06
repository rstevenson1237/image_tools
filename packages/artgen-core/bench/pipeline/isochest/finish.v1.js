// isochest finish.v1 (f) on base.v2 (7): keyhole in the lock, glints on the coins, a lit edge along the open
// lid's top, orphan clean-up. Coordinates are per cell (32×32); the lock sits two rows lower when open.
export const base = 'base.v2';
export const meta = { notes: 'keyhole, coin glints, open-lid top edge, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib, open = ctx.state === 'open', lock = open ? [11, 23] : [11, 21];
  px.fix.orphans(g);
  px.set(g, [lock[0], lock[1] + 1], 'ink.0');
  px.light.highlight(g, [lock[0] + 1, lock[1]], 'white.0');
  if (open) {
    for (const p of [[14, 15], [18, 16], [16, 17]]) px.fx.glint(g, p, 'white.0');
    px.line(g, [13, 4], [16, 4], 'wood.0');
  }
  return g;
}
