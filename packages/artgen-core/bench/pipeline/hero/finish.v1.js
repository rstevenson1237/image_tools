// hero finish.v1 (f) on base.v3 (7): hair strands and a fringe with tips, face and tunic lifted one step toward the
// light, orphan clean-up (eyes and blush protected), a glint on the sword tip.
export const base = 'base.v3';
export const meta = { notes: 'hair strands + fringe tips, face/tunic tone, orphans, sword glint' };

const FRINGE = [
  'bbbbbbccccccdd',
  'cbbbbcc..cccdd',
  '.c..c......c.d',
];
const STRANDS = [
  '...c.....',
  '....c..b.',
  '.c...c..b',
];

export function finish(g, ctx) {
  const { px } = ctx.lib, key = { b: 'hair.0', c: 'hair.1', d: 'hair.2' };
  px.light.tone(g, { region: [10, 9, 11, 5], ramps: ['skin'] });
  px.light.tone(g, { region: [10, 21, 13, 4], ramps: ['blue'] });
  px.fix.orphans(g, { region: [0, 15, 32, 17] });
  px.patch(g, [9, 7], FRINGE, key, { anchor: 'topleft' });
  px.patch(g, [11, 3], STRANDS, key, { anchor: 'topleft' });
  px.fx.glint(g, [25, 4], 'white.0');
  return g;
}
