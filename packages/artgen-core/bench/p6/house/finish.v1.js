// finish.v1 (f) on base.v3 — window mullions (a cross in the frame colour) so the warm squares read as windows, the
// door darkened one step and edged so it separates from the timber wall, a lit lip on the eave.
export const base = 'base.v3';
export const meta = { notes: 'window mullions, darker edged door, lit eave lip' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  for (const a of ['window', 'window2']) if (ctx.anchors[a]) {
    const [x, y] = ctx.at(a);
    px.line(g, [x, y - 2], [x, y + 1], 'leather.1'); px.line(g, [x - 2, y], [x + 1, y], 'leather.1');
  }
  if (ctx.anchors.door) {
    const [x, y] = ctx.at('door');
    px.light.tone(g, { region: [x - 2, y - 4, 5, 9], ramps: ['leather'], by: 1 });
  }
  px.light.rim(g, { ramps: ['stone'], region: [0, 0, 48, 24] });
  return g;
}
