// T2 tank v1: mirrored primitives for pods/hull, sphere-shaded turret, twin barrels, glow accents.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const A = PAL.armor;
module.exports = {
  notes: 'Mirrored shape list; bevel hull, sphere turret, pattern treads',
  render() {
    return new Scene(64, 64).addAll([
      { type: 'rect', x: 7, y: 10, w: 10, h: 48, r: 2, mat: A.slice(2), shade: 'bevel', mirrorX: 32,
        pattern: (x, y) => ((y >> 1) % 2 ? A[3] : null) },                                                 // treads
      { type: 'poly', pts: [[24, 8], [40, 8], [48, 16], [48, 55], [44, 59], [20, 59], [16, 55], [16, 16]], mat: A, shade: 'bevel' }, // hull
      { type: 'poly', pts: [[22, 14], [42, 14], [44, 18], [44, 50], [20, 50], [20, 18]], mat: A.slice(1), shade: 'bevel' },          // deck plate
      { type: 'rect', x: 18, y: 20, w: 1, h: 28, color: PAL.cyan[1], mirrorX: 32 },                          // glow strips
      { type: 'rect', x: 24, y: 53, w: 4, h: 3, mat: PAL.orange, shade: 'bevel' },
      { type: 'rect', x: 30, y: 53, w: 4, h: 3, mat: PAL.orange, shade: 'bevel' },
      { type: 'rect', x: 36, y: 53, w: 4, h: 3, mat: PAL.orange, shade: 'bevel' },                          // vents
      { type: 'rect', x: 27, y: 3, w: 3, h: 22, mat: A.slice(1), shade: 'cyl', mirrorX: 32 },              // barrels
      { type: 'rect', x: 27, y: 2, w: 3, h: 2, mat: PAL.cyan, shade: 'flat', mirrorX: 32 },                 // muzzles
      { type: 'ellipse', cx: 32, cy: 34, rx: 11, ry: 11, mat: A, shade: 'sphere' },                         // turret
      { type: 'ellipse', cx: 32, cy: 31, rx: 2, ry: 2, mat: PAL.cyan, shade: 'sphere' },                    // sensor
    ]).render({ outline: true, shadow: [2, 2] });
  },
};
