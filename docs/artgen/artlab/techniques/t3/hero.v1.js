// T3 hero v1: vector SVG drawn in a 32-unit viewBox, rasterised directly by canvas (anti-aliased).
const { PAL } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const O = PAL.outline;
const SVG = doc(32, 32, `
 <defs><radialGradient id="face" cx="40%" cy="35%"><stop offset="0" stop-color="${PAL.skin[0]}"/><stop offset="1" stop-color="${PAL.skin[1]}"/></radialGradient></defs>
 <g stroke="${O}" stroke-width="1" stroke-linejoin="round">
  <path d="M10 15 L22 15 L25 28 L7 28 Z" fill="${PAL.red[1]}"/>
  <rect x="12" y="24" width="3" height="5" fill="${PAL.leather[0]}"/><rect x="17" y="24" width="3" height="5" fill="${PAL.leather[0]}"/>
  <rect x="11" y="15" width="10" height="10" rx="2" fill="${PAL.blue[0]}"/>
  <rect x="11" y="22" width="10" height="1.2" fill="${PAL.gold[1]}" stroke="none"/>
  <circle cx="10.5" cy="16.5" r="2.3" fill="${PAL.steel[1]}"/><circle cx="21.5" cy="16.5" r="2.3" fill="${PAL.steel[1]}"/>
  <ellipse cx="16" cy="10" rx="7" ry="6.3" fill="url(#face)"/>
  <path d="M9 10 Q9 2.5 16 2.5 Q23 2.5 23 10 Q20 6 16 7 Q12 6 9 10 Z" fill="${PAL.hair[1]}"/>
  <rect x="24" y="4" width="2" height="13" fill="${PAL.steel[0]}"/><rect x="22" y="17" width="6" height="1.4" fill="${PAL.gold[0]}"/>
  <path d="M3 15 H10 V21 L6.5 26 L3 21 Z" fill="${PAL.steel[1]}"/>
 </g>
 <circle cx="13" cy="11" r="0.8" fill="${O}"/><circle cx="19" cy="11" r="0.8" fill="${O}"/>
 <path d="M6.5 16 V23 M4 18.5 H9" stroke="${PAL.red[0]}" stroke-width="1.2"/>`);
module.exports = { notes: 'Plain SVG, native-size AA raster (baseline)', SVG, render: () => svgToGrid(SVG, 32, 32, { mode: 'raw' }) };
