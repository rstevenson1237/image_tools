// T2 ship v1: hull polygon from a parametric profile + turret/funnel/superstructure primitives.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const X0 = 5, L = 150, CY = 20.5;
const at = t => X0 + t * L;
function hullPts(beam = 10) {
  const top = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40;
    const hw = t < 0.08 ? beam * (0.7 + 0.3 * Math.sqrt(1 - ((0.08 - t) / 0.08) ** 2)) : t < 0.6 ? beam : beam * (1 - ((t - 0.6) / 0.4) ** 1.8);
    top.push([at(t), CY - hw]); }
  return [...top, ...top.slice().reverse().map(([x, y]) => [x, 2 * CY - y])];
}
function turret(t, dir) {
  const cx = at(t);
  return [
    ...[-2, 0, 2].map(o => ({ type: 'line', x0: Math.round(cx), y0: Math.round(CY - .5 + o), x1: Math.round(cx + dir * 13), y1: Math.round(CY - .5 + o), mat: [PAL.navy[3]] })),
    { type: 'ellipse', cx, cy: CY, rx: 4.5, ry: 4.5, mat: PAL.navy, shade: 'sphere' },
  ];
}
module.exports = {
  notes: 'Parametric hull polygon + primitive fittings, auto outline + drop shadow',
  render() {
    return new Scene(160, 41).addAll([
      { type: 'poly', pts: hullPts(), mat: PAL.teak, shade: 'bevel', pattern: (x, y, c) => (y % 3 === 0 ? PAL.teak[2] : null) },
      { type: 'rect', x: Math.round(at(0.36)), y: 15, w: Math.round(0.22 * L), h: 11, mat: PAL.navy, shade: 'bevel' },
      { type: 'rect', x: Math.round(at(0.52)), y: 17, w: 8, h: 7, mat: PAL.navy, shade: 'bevel' },
      { type: 'ellipse', cx: at(0.42), cy: CY, rx: 2.5, ry: 2.5, mat: PAL.navy.slice(2), shade: 'sphere' },
      { type: 'ellipse', cx: at(0.47), cy: CY, rx: 2.5, ry: 2.5, mat: PAL.navy.slice(2), shade: 'sphere' },
      ...turret(0.27, -1), ...turret(0.72, 1), ...turret(0.64, 1),
      ...[0, 1, 2, 3].map(i => ({ type: 'rect', x: Math.round(at(0.37 + i * 0.055)), y: 12, w: 3, h: 2, mat: PAL.navy, mirrorY: 20.5 })),
    ]).render({ outline: true, outlineColor: PAL.navy[4], shadow: [2, 2] });
  },
};
