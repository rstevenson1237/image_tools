// T2 iso hero v1: hooded rogue as a shape list (lib prim v2: ink, sphere, mirror) + 2:1 ground shadow shape.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const INK = PAL.outline;
module.exports = {
  notes: 'Shape-list rogue, ink inner lines, shadow ellipse',
  render() {
    return new Scene(32, 48).addAll([
      { type: 'ellipse', cx: 16, cy: 42, rx: 9, ry: 4.5, color: PAL.shadow },
      { type: 'poly', pts: [[9, 19], [23, 19], [26, 37], [6, 37]], mat: PAL.green.slice(1), shade: 'bevel' },
      { type: 'rect', x: 12, y: 33, w: 3, h: 6, mat: PAL.leather.slice(1), mirrorX: 16, ink: INK },
      { type: 'rect', x: 11, y: 38, w: 4, h: 3, mat: PAL.leather, mirrorX: 16 },
      { type: 'rect', x: 13, y: 20, w: 6, h: 14, mat: PAL.leather, shade: 'bevel' },
      { type: 'rect', x: 13, y: 26, w: 6, h: 1, color: PAL.gold[1] },
      { type: 'poly', pts: [[8, 20], [14, 20], [13, 35], [6, 35]], mat: PAL.green, shade: 'bevel', ink: INK, mirrorX: 16 },
      { type: 'ellipse', cx: 16, cy: 12, rx: 7, ry: 7.5, mat: PAL.green, shade: 'sphere', ink: INK },
      { type: 'ellipse', cx: 16, cy: 15, rx: 4.6, ry: 4.6, color: PAL.green[2] },
      { type: 'ellipse', cx: 16, cy: 16, rx: 3.6, ry: 3.5, mat: PAL.skin, shade: 'sphere' },
      { type: 'rect', x: 14, y: 15, w: 1, h: 2, color: INK, mirrorX: 16 },
      { type: 'rect', x: 24, y: 27, w: 2, h: 2, mat: PAL.skin }, { type: 'rect', x: 23, y: 29, w: 4, h: 1, color: PAL.gold[0] },
      { type: 'rect', x: 24, y: 30, w: 2, h: 5, mat: PAL.steel, shade: 'bevel' },
    ]).render({ outline: true });
  },
};
