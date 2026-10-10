// T2 tank v2: lib v2 fixes; cleat pattern on treads; ink separates turret/deck; rim-lit dome;
// muzzle-brake rects; panel seam lines; glow strips with highlight pattern.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const A = PAL.armor, INK = PAL.outline;
module.exports = {
  notes: 'Cleat pattern, ink separation, rim dome, muzzle brakes, seams',
  render() {
    return new Scene(64, 64).addAll([
      { type: 'rect', x: 6, y: 9, w: 10, h: 50, r: 2, mat: [A[2], A[3], A[4]], shade: 'bevel', mirrorX: 32,
        pattern: (x, y, c) => ((y + 1) % 3 === 0 ? A[4] : null) },
      { type: 'poly', pts: [[24, 7], [40, 7], [48, 15], [48, 54], [44, 59], [20, 59], [16, 54], [16, 15]], mat: A.slice(1, 4), shade: 'bevel', ink: INK },
      { type: 'poly', pts: [[23, 12], [41, 12], [44, 17], [44, 50], [20, 50], [20, 17]], mat: A.slice(0, 3), shade: 'bevel', ink: A[3] },
      { type: 'line', x0: 21, y0: 46, x1: 42, y1: 46, color: A[2] }, { type: 'line', x0: 22, y0: 20, x1: 41, y1: 20, color: A[2] },
      { type: 'rect', x: 18, y: 20, w: 1, h: 28, color: PAL.cyan[1], mirrorX: 32, pattern: (x, y) => (y % 6 === 0 ? PAL.cyan[0] : null) },
      ...[24, 30, 36].map(x => ({ type: 'rect', x, y: 53, w: 4, h: 3, mat: PAL.orange, shade: 'bevel' })),
      { type: 'rect', x: 27, y: 4, w: 3, h: 22, mat: A.slice(1, 4), shade: 'cyl', mirrorX: 32, ink: INK },
      { type: 'rect', x: 26, y: 2, w: 5, h: 4, mat: A.slice(2), shade: 'bevel', mirrorX: 32, inkAll: INK },
      { type: 'rect', x: 27, y: 1, w: 3, h: 1, color: PAL.cyan[1], mirrorX: 32 },
      { type: 'ellipse', cx: 32, cy: 34, rx: 11.5, ry: 11.5, mat: A.slice(0, 4), shade: 'sphere', rim: 0.85, ink: INK },
      { type: 'ellipse', cx: 32, cy: 31, rx: 2.2, ry: 2.2, mat: PAL.cyan, shade: 'sphere' },
    ]).render({ outline: true, shadow: [2, 2] });
  },
};
