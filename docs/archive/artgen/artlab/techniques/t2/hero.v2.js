// T2 hero v2: uses lib v2 (fixed sphere light, rim, ink inner-outlines). Seed only picks
// from palettes that contrast with the cape; hair uses bevel + fringe poly; blush + 1x2 eyes.
const { PAL, rng } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const INK = PAL.outline;
function hero(seed = 1) {
  const r = rng(seed), tunic = [PAL.blue, PAL.steel.slice(0, 3)][Math.floor(r() * 2)], hair = r() < 0.5 ? PAL.hair : PAL.gold;
  return new Scene(32, 32).addAll([
    { type: 'poly', pts: [[10, 15], [22, 15], [25, 28], [7, 28]], mat: PAL.red, shade: 'bevel' },
    { type: 'rect', x: 12, y: 24, w: 3, h: 4, mat: PAL.leather, mirrorX: 16, ink: INK },
    { type: 'rect', x: 11, y: 27, w: 4, h: 2, mat: [PAL.leather[1], PAL.leather[2]], mirrorX: 16 },
    { type: 'rect', x: 11, y: 15, w: 10, h: 10, r: 2, mat: tunic, shade: 'bevel', ink: INK },
    { type: 'rect', x: 11, y: 22, w: 10, h: 1, color: PAL.gold[1] }, { type: 'rect', x: 15, y: 22, w: 2, h: 1, color: PAL.gold[0] },
    { type: 'rect', x: 9, y: 17, w: 2, h: 5, mat: tunic, mirrorX: 16, ink: INK },
    { type: 'rect', x: 9, y: 21, w: 2, h: 2, mat: PAL.skin, mirrorX: 16 },
    { type: 'ellipse', cx: 10.5, cy: 16.5, rx: 2.6, ry: 2.1, mat: PAL.steel, shade: 'sphere', rim: 0.8, mirrorX: 16, ink: INK },
    { type: 'ellipse', cx: 16, cy: 10.5, rx: 6.8, ry: 6, mat: PAL.skin, shade: 'sphere', ink: INK },
    { type: 'ellipse', cx: 16, cy: 7, rx: 7.3, ry: 4.6, mat: hair, shade: 'bevel' },
    { type: 'poly', pts: [[9, 7], [23, 7], [23, 11], [21, 9], [18, 10], [16, 8.5], [13, 10], [9, 11]], mat: hair, shade: 'bevel' },
    { type: 'rect', x: 12, y: 11, w: 1, h: 2, color: INK, mirrorX: 16 },
    { type: 'rect', x: 10, y: 13, w: 1, h: 1, color: PAL.blush, mirrorX: 16 },
    { type: 'rect', x: 24, y: 3, w: 2, h: 14, mat: PAL.steel, shade: 'bevel' },
    { type: 'rect', x: 22, y: 17, w: 6, h: 1, color: PAL.gold[0] }, { type: 'rect', x: 24, y: 18, w: 2, h: 3, mat: PAL.leather },
    { type: 'poly', pts: [[2, 18], [9, 18], [9, 23], [5.5, 28], [2, 23]], mat: PAL.steel, shade: 'bevel', ink: INK },
    { type: 'rect', x: 5, y: 19, w: 1, h: 6, color: PAL.red[0] }, { type: 'rect', x: 3, y: 21, w: 5, h: 1, color: PAL.red[0] },
  ]).render({ outline: true });
}
module.exports = { notes: 'lib v2 fixes + ink inner lines, seeded hair/tunic, fringe', render: hero };
