// finish.v1 (f) on base.v3 — an eye in the hood's shadow (one lit skin pixel ahead of the head centre, found from the
// `hand`-free head: the topmost skin pixel column of the face), orphan cleanup, lit cape edge on the light side.
export const base = 'base.v3';
export const meta = { notes: 'eye under the hood, orphans, lit cape rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  px.light.rim(g, { ramps: ['accent'] });
  // the face: the rightmost skin pixel in the head rows gets the eye one pixel in from it
  for (let y = 6; y < 16; y++) {
    let x0 = -1;
    for (let x = g.w - 1; x >= 0; x--) { const t = px.tokenAt(g, [x, y]); if (t && t.startsWith('skin')) { x0 = x; break; } }
    if (x0 > 0) { px.set(g, [x0 - 1, y], 'hair.2'); break; }
  }
  return g;
}
