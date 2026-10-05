// T3 iso hero v3 (from v2): outline strokes kept only on hood + cloak panels; legs/boots/hand/dagger
// rely on the raster outline (they were merging into one dark mass). Dagger blade widened.
// T3 iso hero v2: v1 SVG with outline strokes cut from 2 to 1.1 units (raster pass already adds the
// silhouette), so only internal part boundaries keep a ~1px line after downsampling.
const { PAL, Grid } = require('../../lib/core');
const { svgToGrid } = require('../../lib/svg');
const { groundShadow } = require('../../lib/iso');
const strip = el => el.replace(/ stroke="#1a1423" stroke-width="2" paint-order="stroke" stroke-linejoin="round"/, '');
const SVG = require('./isohero.v1').SVG.replace(/stroke-width="2"/g, 'stroke-width="1.1"')
  .replace(/<rect x="(12|17)" y="32"[^>]*\/>/g, m => m.replace(/ stroke=[^/]*/, ' '))
  .replace(/<path d="M11 37\.5[^>]*\/>/, m => m.replace(/ stroke=[^/]*/, ' '))
  .replace(/<rect x="24" y="27"[^>]*\/>/, m => m.replace(/ stroke=[^/]*/, ' '))
  .replace(/<path d="M24 30 H26 V34 L25 35\.5 L24 34 Z"[^>]*\/>/, `<path d="M23.5 30 H26.5 V34 L25 36 L23.5 34 Z" fill="${PAL.steel[0]}"/>`);
const PALETTE = [PAL.outline, ...PAL.green, ...PAL.skin, ...PAL.leather, ...PAL.gold, ...PAL.steel];
module.exports = { notes: 'v3: strokes only on hood/cloak, wider dagger', SVG,
  render() { const g = new Grid(32, 48); groundShadow(g, 16, 42, 9); return g.stamp(svgToGrid(SVG, 32, 48, { mode: 'ss', ss: 8, outline: true, pal: PALETTE })); } };
