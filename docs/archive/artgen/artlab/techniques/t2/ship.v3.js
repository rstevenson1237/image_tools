// T2 ship v3 (from v2): polygon turret footprints, ink only on deckhouse base.
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
function turret(t, dir, big) { // v3: single polygon footprint (flat chamfered face, rounded rear), no ink
  const cx = at(t), r = big ? 6.5 : 6, pts = [];
  for (let a = 90; a <= 270; a += 15) { const q = a * Math.PI / 180; pts.push([cx + dir * Math.cos(q) * r, CY + Math.sin(q) * r]); }
  pts.push([cx + dir * 3, CY + r], [cx + dir * 5, CY + r - 2], [cx + dir * 5, CY - r + 2], [cx + dir * 3, CY - r]);
  return [
    { type: 'poly', pts, mat: big ? N.slice(0, 3) : N.slice(1, 4), shade: 'bevel' },
    ...[-2, 0, 2].map(o => ({ type: 'line', x0: Math.round(cx + dir * 5), y0: Math.floor(CY + o), x1: Math.round(cx + dir * 17), y1: Math.floor(CY + o), color: N[3] })),
    { type: 'rect', x: Math.round(cx - 1), y: Math.floor(CY - 1), w: 2, h: 2, color: N[big ? 1 : 2] },
  ];
}
module.exports = {
  notes: 'v3: poly turrets, less ink; Inset deck, layered superstructure, capsule turrets, ordered barrels',
  render() {
    return new Scene(160, 41).addAll([
      { type: 'poly', pts: hullPts(10), mat: [N[1]], shade: 'flat' },
      { type: 'poly', pts: hullPts(8.6).map(([x, y]) => [Math.min(x, at(0.985)), y]), mat: PAL.teak, shade: 'flat',
        pattern: (x, y) => (Math.abs(y - 20) % 3 === 0 ? PAL.teak[1] : (x * 7 + y * 13) % 29 === 0 ? PAL.teak[1] : PAL.teak[0]) },
      { type: 'rect', x: Math.round(at(0.35)), y: 14, w: Math.round(0.26 * L), h: 13, mat: N.slice(1, 4), shade: 'bevel', ink: N[4] },
      { type: 'rect', x: Math.round(at(0.39)), y: 16, w: Math.round(0.18 * L), h: 9, mat: N.slice(0, 3), shade: 'bevel' },
      { type: 'rect', x: Math.round(at(0.555)), y: 17, w: 7, h: 7, mat: N.slice(0, 3), shade: 'bevel', ink: N[4] },
      ...[0.445, 0.5].map(t => ({ type: 'ellipse', cx: at(t), cy: CY, rx: 2.8, ry: 3.2, mat: N.slice(2), shade: 'sphere', rim: 0.6 })),
      ...[0.445, 0.5].map(t => ({ type: 'ellipse', cx: at(t), cy: CY, rx: 1.3, ry: 1.6, color: PAL.outline })),
      ...[0, 1, 2, 3].map(i => ({ type: 'rect', x: Math.round(at(0.38 + i * 0.055)), y: 11, w: 3, h: 3, mat: N.slice(0, 3), shade: 'bevel', mirrorY: CY })),
      ...turret(0.25, -1), ...turret(0.76, 1), ...turret(0.665, 1, true),
    ]).render({ outline: true, outlineColor: N[4], shadow: [2, 2] });
  },
};
