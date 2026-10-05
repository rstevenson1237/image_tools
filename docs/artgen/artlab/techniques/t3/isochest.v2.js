// T3 iso chest v2 (from v1): broken arched-lid path replaced by lid box + bevel highlight; interior dark rim.
// T3 iso chest v1: SVG polygons generated from lib/iso boxFaces (same world geometry as T2) plus
// a vector-only extra: rounded barrel lid (arc path). ss=8, wood/gold/steel palette, two states.
const { PAL, Grid } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const { boxFaces, P } = require('../../lib/iso');
const W = PAL.wood, G = PAL.gold, O = PAL.outline, OX = 12, OY = 16.5;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
const box = (b, t, l, r, ex) => { const f = boxFaces(...b, OX, OY); return poly(f.left, l, ex) + poly(f.right, r, ex) + poly(f.top, t, ex); };
const st = `stroke="${O}" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round"`;
function svg(open) {
  let s = box([0, 0, 0, 8, 4.5, 2.5], W[1], W[1], W[2], st);
  if (!open) s += box([0, 0, 2.5, 8, 4.5, 1.5], W[0], W[1], W[2], st) + box([0, 3.6, 3.7, 8, 0.9, 0.3], '#ffe2b0', W[0], W[1]); // lid + front bevel highlight (v2: arch path removed)
  else s += box([0, 0, 2.49, 8, 4.5, 0.01], W[2], W[2], W[2]) + box([1, 1, 2.5, 6, 2.5, 0.01], G[0], G[1], G[1]) + box([0, -0.6, 2.5, 8, 0.6, 4.5], W[1], W[2], W[2], st);
  for (const x of [1.5, 6]) s += box([x, -0.05, 0, 0.6, 4.6, 2.5], G[0], G[1], G[2]);
  s += box([3.6, 4.5, 1.2, 0.8, 0.2, 1.6], PAL.steel[0], PAL.steel[1], PAL.steel[2], st);
  return doc(32, 32, s);
}
const PALETTE = [O, ...W, ...G, ...PAL.steel, '#ffe2b0'];
module.exports = { notes: 'v2: lid box + bevel, dark interior rim', SVG: svg(false),
  render: () => new Grid(64, 32).stamp(svgToGrid(svg(false), 32, 32, { mode: 'ss', ss: 8, outline: true, pal: PALETTE })).stamp(svgToGrid(svg(true), 32, 32, { mode: 'ss', ss: 8, outline: true, pal: PALETTE }), 32, 0) };
