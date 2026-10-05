// T3 iso hero v1: starts from the top-down T3 v3 lessons: flat fills, per-shape dark outline via
// paint-order stroke (drawn under the fill), ss=8 + restricted palette, raster ground shadow.
const { PAL, Grid } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const { groundShadow } = require('../../lib/iso');
const O = PAL.outline, st = `stroke="${O}" stroke-width="2" paint-order="stroke" stroke-linejoin="round"`;
const SVG = doc(32, 48, `
 <path d="M9 19 H23 L26 37 H6 Z" fill="${PAL.green[2]}" ${st}/>
 <rect x="12" y="32" width="3" height="7" fill="${PAL.leather[1]}" ${st}/><rect x="17" y="32" width="3" height="7" fill="${PAL.leather[1]}" ${st}/>
 <path d="M11 37.5 H15 V41 H11 Z M17 37.5 H21 V41 H17 Z" fill="${PAL.leather[0]}" ${st}/>
 <rect x="13" y="20" width="6" height="14" fill="${PAL.leather[0]}"/><rect x="13" y="26" width="6" height="1" fill="${PAL.gold[1]}"/>
 <path d="M8 20 Q11 19 14 20 L13 35 H6 Z" fill="${PAL.green[1]}" ${st}/><path d="M24 20 Q21 19 18 20 L19 35 H26 Z" fill="${PAL.green[1]}" ${st}/>
 <path d="M8.5 21 L10 21 L8 34 H7 Z" fill="${PAL.green[0]}"/>
 <path d="M9 14 Q9 4.5 16 4.5 Q23 4.5 23 14 Q23 19.5 16 19.5 Q9 19.5 9 14 Z" fill="${PAL.green[1]}" ${st}/>
 <path d="M10.5 9 Q12 5.5 16 5.5 L13 9 Z" fill="${PAL.green[0]}"/>
 <ellipse cx="16" cy="15.2" rx="4.4" ry="4.4" fill="${PAL.green[2]}"/>
 <ellipse cx="16" cy="16.2" rx="3.4" ry="3.3" fill="${PAL.skin[0]}"/><path d="M17.5 13.5 A3.4 3.3 0 0 1 17.5 19.4 Z" fill="${PAL.skin[1]}"/>
 <rect x="13.9" y="14.8" width="1.3" height="2.2" fill="${O}"/><rect x="16.9" y="14.8" width="1.3" height="2.2" fill="${O}"/>
 <rect x="24" y="27" width="2" height="2" fill="${PAL.skin[0]}" ${st}/><rect x="23" y="29" width="4" height="1" fill="${PAL.gold[0]}"/>
 <path d="M24 30 H26 V34 L25 35.5 L24 34 Z" fill="${PAL.steel[0]}" ${st}/>`);
const PALETTE = [O, ...PAL.green, ...PAL.skin, ...PAL.leather, ...PAL.gold, ...PAL.steel];
module.exports = { notes: 'paint-order strokes, ss=8, restricted palette, raster shadow', SVG,
  render() { const g = new Grid(32, 48); groundShadow(g, 16, 42, 9); return g.stamp(svgToGrid(SVG, 32, 48, { mode: 'ss', ss: 8, outline: true, pal: PALETTE })); } };
