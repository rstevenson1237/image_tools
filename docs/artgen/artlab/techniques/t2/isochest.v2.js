// T2 iso chest v2 (from v1): no ink on lid (removed pixel-gap artefacts), dark interior + inset coins.
// T2 iso chest v1: lib/iso boxFaces() -> polygon shape specs (top/left/right), straps as thin boxes,
// lock box, open state = vertical lid box on back hinge + gold interior. Same geometry as T1, no hand math.
const { PAL, Grid } = require('../../lib/core');
const { Scene } = require('../../lib/prim');
const { boxFaces } = require('../../lib/iso');
const W = PAL.wood, G = PAL.gold;
const box = (b, top, left, right, extra = {}) => { const f = boxFaces(...b, 12, 16.5);
  return [{ type: 'poly', pts: f.left, color: left, ...extra }, { type: 'poly', pts: f.right, color: right, ...extra }, { type: 'poly', pts: f.top, color: top, ...extra }]; };
function chest(open) {
  const s = [...box([0, 0, 0, 8, 4.5, 2.5], W[2], W[1], W[2])];
  if (open) s.push(...box([1, 1, 2.5, 6, 2.5, 0.01], G[0], G[1], G[1]), ...box([0, -0.6, 2.5, 8, 0.6, 4.5], W[1], W[2], W[2], { ink: PAL.outline }),
    { type: 'poly', pts: boxFaces(0.6, 0, 3.2, 6.8, 0, 3.2, 12, 16.5).left, color: W[2] });
  else s.push(...box([0, 0, 2.5, 8, 4.5, 1.5], W[0], W[1], W[2]), ...box([0, 3.6, 3.7, 8, 0.9, 0.3], '#ffe2b0', W[0], W[1]));
  for (const x of [1.5, 6]) s.push(...box([x, -0.05, -0.01, 0.6, 4.6, open ? 2.52 : 4.02], G[0], G[1], G[2]));
  s.push(...box([3.6, 4.5, 1.2, 0.8, 0.2, 1.6], PAL.steel[0], PAL.steel[1], PAL.steel[2]));
  return new Scene(32, 32).addAll(s).render({ outline: true });
}
module.exports = { notes: 'v2: no lid ink, dark interior, bevel; boxFaces polygons, thin-box straps, two states', render: () => new Grid(64, 32).stamp(chest(false)).stamp(chest(true), 32, 0) };
