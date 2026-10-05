// T3 iso hero v2: v1 SVG with outline strokes cut from 2 to 1.1 units (raster pass already adds the
// silhouette), so only internal part boundaries keep a ~1px line after downsampling.
const { PAL, Grid } = require('../../lib/core');
const { svgToGrid } = require('../../lib/svg');
const { groundShadow } = require('../../lib/iso');
const SVG = require('./isohero.v1').SVG.replace(/stroke-width="2"/g, 'stroke-width="1.1"');
const PALETTE = [PAL.outline, ...PAL.green, ...PAL.skin, ...PAL.leather, ...PAL.gold, ...PAL.steel];
module.exports = { notes: 'v1 with thinner paint-order strokes', SVG,
  render() { const g = new Grid(32, 48); groundShadow(g, 16, 42, 9); return g.stamp(svgToGrid(SVG, 32, 48, { mode: 'ss', ss: 8, outline: true, pal: PALETTE })); } };
