// T2 ship v2: gunwale + inset deck polygons, layered superstructure with ink, capsule turrets
// (rect + rear ellipse) in superfiring order, barrels after turrets, sphere funnels with rim.
const { PAL } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const N = PAL.navy, X0 = 5, L = 150, CY = 20.5;
const at = t => X0 + t * L;
function hullPts(beam) {
  const top = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60;
    const hw = t < 0.06 ? beam * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - ((0.06 - t) / 0.06) ** 2))) : t < 0.55 ? beam : beam * Math.cos(((t - 0.55) / 0.45) * Math.PI / 2) ** 0.9;
    top.push([at(t), CY - hw]); }
  return [...top, ...top.slice().reverse().map(([x, y]) => [x, 2 * CY - y])];
}
function turret(t, dir, big) {
  const cx = Math.round(at(t)), r = big ? 5.5 : 5;
  return [
    { type: 'ellipse', cx: cx + 0.5, cy: CY, rx: r, ry: r, mat: big ? N.slice(0, 3) : N.slice(1, 4), shade: 'sphere' },
    { type: 'rect', x: dir > 0 ? cx : cx - 4, y: Math.round(CY - r), w: 5, h: Math.round(2 * r), mat: big ? N.slice(0, 3) : N.slice(1, 4), shade: 'bevel', ink: N[4] },
    ...[-2, 0, 2].map(o => ({ type: 'line', x0: dir > 0 ? cx + 5 : cx - 4, y0: Math.floor(CY + o), x1: dir > 0 ? cx + 15 : cx - 14, y1: Math.floor(CY + o), color: N[3] })),
  ];
}
module.exports = {
  notes: 'Inset deck, layered superstructure, capsule turrets, ordered barrels',
  render() {
    return new Scene(160, 41).addAll([
      { type: 'poly', pts: hullPts(10), mat: [N[1]], shade: 'flat' },
      { type: 'poly', pts: hullPts(8.6).map(([x, y]) => [Math.min(x, at(0.985)), y]), mat: PAL.teak, shade: 'flat',
        pattern: (x, y) => (Math.abs(y - 20) % 3 === 0 ? PAL.teak[1] : (x * 7 + y * 13) % 29 === 0 ? PAL.teak[1] : PAL.teak[0]) },
      { type: 'rect', x: Math.round(at(0.35)), y: 14, w: Math.round(0.26 * L), h: 13, mat: N.slice(1, 4), shade: 'bevel', ink: N[4] },
      { type: 'rect', x: Math.round(at(0.39)), y: 16, w: Math.round(0.18 * L), h: 9, mat: N.slice(0, 3), shade: 'bevel', ink: N[3] },
      { type: 'rect', x: Math.round(at(0.555)), y: 17, w: 7, h: 7, mat: N.slice(0, 3), shade: 'bevel', ink: N[4] },
      ...[0.445, 0.5].map(t => ({ type: 'ellipse', cx: at(t), cy: CY, rx: 2.8, ry: 3.2, mat: N.slice(2), shade: 'sphere', rim: 0.6 })),
      ...[0.445, 0.5].map(t => ({ type: 'ellipse', cx: at(t), cy: CY, rx: 1.3, ry: 1.6, color: PAL.outline })),
      ...[0, 1, 2, 3].map(i => ({ type: 'rect', x: Math.round(at(0.38 + i * 0.055)), y: 11, w: 3, h: 3, mat: N.slice(0, 3), shade: 'bevel', ink: N[4], mirrorY: CY })),
      ...turret(0.27, -1), ...turret(0.74, 1), ...turret(0.655, 1, true),
    ]).render({ outline: true, outlineColor: N[4], shadow: [2, 2] });
  },
};
