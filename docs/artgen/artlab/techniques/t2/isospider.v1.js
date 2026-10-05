// T2 iso spider v1: sphere-shaded ellipses + mirrored 3-point leg lines + shadow ellipse; auto outline.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const LEGS = [[[12, 15], [7, 8], [3, 12]], [[11, 17], [4, 13], [1, 19]], [[11, 19], [4, 19], [2, 26]], [[12, 21], [8, 23], [7, 29]]];
module.exports = {
  notes: 'Ellipses + mirrored line legs, ink, shadow',
  render() {
    const legs = LEGS.flatMap(([a, b, c]) => [
      { type: 'line', x0: a[0], y0: a[1], x1: b[0], y1: b[1], color: PAL.purple[1], mirrorX: 16 },
      { type: 'line', x0: b[0], y0: b[1], x1: c[0], y1: c[1], color: PAL.purple[2], mirrorX: 16 }]);
    return new Scene(32, 32).addAll([
      { type: 'ellipse', cx: 16, cy: 22, rx: 10, ry: 5, color: PAL.shadow }, ...legs,
      { type: 'ellipse', cx: 16, cy: 10, rx: 8, ry: 6.5, mat: PAL.purple, shade: 'sphere', ink: PAL.outline },
      { type: 'poly', pts: [[14, 7], [18, 7], [16, 10], [18, 13], [14, 13], [16, 10]], color: PAL.red[0] },
      { type: 'ellipse', cx: 16, cy: 19, rx: 5, ry: 3.8, mat: PAL.purple, shade: 'sphere', ink: PAL.outline },
      { type: 'rect', x: 13, y: 18, w: 2, h: 2, color: PAL.red[0], mirrorX: 16 }, { type: 'rect', x: 15, y: 19, w: 1, h: 1, color: PAL.red[1], mirrorX: 16 },
      { type: 'rect', x: 14, y: 23, w: 1, h: 2, color: PAL.steel[0], mirrorX: 16 },
    ]).render({ outline: true });
  },
};
