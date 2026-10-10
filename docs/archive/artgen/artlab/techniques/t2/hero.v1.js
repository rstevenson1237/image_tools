// T2 hero v1: sprite = list of shape specs; Scene rasterises, auto-shades and outlines.
const { PAL, rng } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
function hero(seed = 1) {
  const r = rng(seed), tunic = [PAL.blue, PAL.red, [PAL.gold[0], PAL.gold[1], PAL.gold[2]]][Math.floor(r() * 3)];
  return new Scene(32, 32).addAll([
    { type: 'poly', pts: [[10, 15], [22, 15], [25, 28], [7, 28]], mat: PAL.red, shade: 'bevel' },        // cape
    { type: 'rect', x: 12, y: 24, w: 3, h: 4, mat: PAL.leather, mirrorX: 16 },                            // legs
    { type: 'rect', x: 11, y: 27, w: 4, h: 2, mat: [PAL.leather[1], PAL.leather[2]], mirrorX: 16 },       // boots
    { type: 'rect', x: 11, y: 15, w: 10, h: 10, r: 2, mat: tunic, shade: 'bevel' },                       // body
    { type: 'rect', x: 11, y: 22, w: 10, h: 1, color: PAL.gold[1] },                                       // belt
    { type: 'rect', x: 9, y: 16, w: 2, h: 6, mat: tunic, mirrorX: 16 },                                    // arms
    { type: 'rect', x: 9, y: 22, w: 2, h: 2, mat: PAL.skin, mirrorX: 16 },                                 // hands
    { type: 'ellipse', cx: 10.5, cy: 16.5, rx: 2.5, ry: 2, mat: PAL.steel, shade: 'sphere', mirrorX: 16 }, // pauldrons
    { type: 'ellipse', cx: 16, cy: 10, rx: 7, ry: 6.5, mat: PAL.skin, shade: 'sphere' },                   // head
    { type: 'ellipse', cx: 16, cy: 7.5, rx: 7.2, ry: 5, mat: PAL.hair, shade: 'sphere' },                  // hair
    { type: 'rect', x: 12, y: 10, w: 1, h: 2, color: PAL.outline, mirrorX: 16 },                           // eyes
    { type: 'rect', x: 24, y: 4, w: 2, h: 13, mat: PAL.steel, shade: 'bevel' },                            // blade
    { type: 'rect', x: 22, y: 17, w: 6, h: 1, color: PAL.gold[0] },                                        // guard
    { type: 'rect', x: 24, y: 18, w: 2, h: 3, mat: PAL.leather },                                          // grip
    { type: 'poly', pts: [[3, 15], [10, 15], [10, 21], [6.5, 26], [3, 21]], mat: PAL.steel, shade: 'bevel' }, // shield
    { type: 'rect', x: 6, y: 16, w: 1, h: 7, color: PAL.red[0] }, { type: 'rect', x: 4, y: 18, w: 5, h: 1, color: PAL.red[0] },
  ]).render({ outline: true });
}
module.exports = { notes: 'Shape list + auto bevel/sphere shading + auto outline; seed varies tunic', render: hero };
