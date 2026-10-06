// isospider finish.v1 (f) on base.v1 (6.5): heavier leg lines (one extra ink ring around the legs only), a gloss
// crescent on the abdomen, glints in the eyes, orphan clean-up on the body.
export const base = 'base.v1';
export const meta = { notes: 'leg line weight, abdomen gloss, eye glints, orphans' };

const GLOSS = [
  '..bbb',
  '.b...',
  'b....',
  'b....',
];

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g, { region: [8, 2, 16, 21] });
  for (const r of [[0, 6, 9, 13], [23, 6, 9, 13], [0, 19, 11, 12], [21, 19, 11, 12]]) px.outline.weight(g, { region: r });
  px.patch(g, [10, 4], GLOSS, { b: 'purple.0' }, { anchor: 'topleft' });
  px.set(g, [13, 18], 'red.0'); px.set(g, [18, 18], 'red.0');
  px.light.highlight(g, [13, 18], 'white.0');
  px.light.highlight(g, [17, 18], 'white.0');
  return g;
}
