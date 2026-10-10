// finish.v1 (f) on base.v3 — orphan pixels in the noisy core column merged into their band, and the flat base
// rounded: the bottom row's corner pixels cleared so the flame sits on a curve, not a shelf.
export const base = 'base.v3';
export const meta = { notes: 'core orphans merged, rounded base' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.fix.banding(g);
  // round the base: on the lowest flame row, the outermost two fill pixels each side drop to the line
  let low = -1;
  for (let y = g.h - 1; y >= 0 && low < 0; y--) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255 && px.tokenAt(g, [x, y]) !== 'outline') { low = y; break; }
  if (low > 0) {
    const xs = []; for (let x = 0; x < g.w; x++) if (g.alpha(x, low) === 255 && px.tokenAt(g, [x, low]) !== 'outline') xs.push(x);
    for (const x of [xs[0], xs[xs.length - 1]]) if (x !== undefined) { px.set(g, [x, low], 'outline'); px.set(g, [x, low + 1], 'outline'); }
  }
  return g;
}
