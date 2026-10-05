// T3 iso spider v1: SVG with curved (quadratic) legs as thick strokes, flat-filled body parts with
// paint-order outlines, highlight crescents; ss=8 + purple/red palette; raster shadow.
const { PAL, Grid } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const { groundShadow } = require('../../lib/iso');
const O = PAL.outline, st = `stroke="${O}" stroke-width="2" paint-order="stroke"`;
const LEGS = [[[12, 15], [6, 6], [3, 12]], [[11, 17], [3, 12], [1, 19]], [[11, 19], [3, 18], [2, 26]], [[12, 21], [7, 22], [7, 29]]];
const leg = ([a, b, c], m) => { const f = p => m ? `${32 - p[0]} ${p[1]}` : `${p[0]} ${p[1]}`;
  return `<path d="M${f(a)} Q${f(b)} ${f(c)}" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M${f(a)} Q${f(b)} ${f(c)}" fill="none" stroke="${PAL.purple[1]}" stroke-width="1.3" stroke-linecap="round"/>`; };
const SVG = doc(32, 32, `${LEGS.map(l => leg(l, false) + leg(l, true)).join('')}
 <ellipse cx="16" cy="10" rx="8" ry="6.5" fill="${PAL.purple[1]}" ${st}/>
 <path d="M10 8 Q12 4.5 17 4.2 Q12 6 11 10 Z" fill="${PAL.purple[0]}"/><path d="M18 15.5 Q23 15 23.5 10 Q24 15 18 16.5 Z" fill="${PAL.purple[2]}"/>
 <path d="M14 7 H18 L16 10 L18 13 H14 L16 10 Z" fill="${PAL.red[0]}"/>
 <ellipse cx="16" cy="19" rx="5" ry="3.8" fill="${PAL.purple[1]}" ${st}/><path d="M12 18 Q13 15.8 16 15.6 Q13 17 13 19 Z" fill="${PAL.purple[0]}"/>
 <rect x="13" y="18" width="2" height="2" fill="${PAL.red[0]}"/><rect x="17" y="18" width="2" height="2" fill="${PAL.red[0]}"/>
 <path d="M14.5 22.5 V24.5 M17.5 22.5 V24.5" stroke="${PAL.steel[0]}" stroke-width="1"/>`);
const PALETTE = [O, ...PAL.purple, ...PAL.red, PAL.steel[0]];
module.exports = { notes: 'Quadratic stroked legs, paint-order body outlines, ss=8', SVG,
  render() { const g = new Grid(32, 32); groundShadow(g, 16, 22, 10); return g.stamp(svgToGrid(SVG, 32, 32, { mode: 'ss', ss: 8, outline: true, pal: PALETTE })); } };
