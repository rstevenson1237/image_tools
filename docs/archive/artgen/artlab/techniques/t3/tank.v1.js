// T3 tank v1: SVG sci-fi tank (facing up) with gradients and glow, rasterised directly at 64x64.
const { PAL } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const A = PAL.armor, O = PAL.outline;
const SVG = doc(64, 64, `
 <defs>
  <linearGradient id="hull" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${A[0]}"/><stop offset="1" stop-color="${A[2]}"/></linearGradient>
  <radialGradient id="dome" cx="35%" cy="35%"><stop offset="0" stop-color="${A[0]}"/><stop offset=".7" stop-color="${A[1]}"/><stop offset="1" stop-color="${A[3]}"/></radialGradient>
 </defs>
 <g stroke="${O}" stroke-width="1">
  <rect x="7" y="10" width="10" height="48" rx="2" fill="${A[3]}"/><rect x="47" y="10" width="10" height="48" rx="2" fill="${A[3]}"/>
  <path d="M24 8 H40 L48 16 V55 L44 59 H20 L16 55 V16 Z" fill="url(#hull)"/>
  <rect x="27" y="3" width="3" height="22" fill="${A[2]}"/><rect x="34" y="3" width="3" height="22" fill="${A[2]}"/>
  <circle cx="32" cy="34" r="11" fill="url(#dome)"/>
 </g>
 ${Array.from({ length: 12 }, (_, i) => `<path d="M8 ${13 + i * 4} H16 M48 ${13 + i * 4} H56" stroke="${A[4]}" stroke-width="1.2"/>`).join('')}
 <path d="M18.5 20 V48 M45.5 20 V48" stroke="${PAL.cyan[1]}" stroke-width="1"/>
 <rect x="24" y="53" width="16" height="3" fill="${PAL.orange[1]}"/>
 <circle cx="32" cy="31" r="2" fill="${PAL.cyan[1]}"/>`);
module.exports = { notes: 'SVG with gradients, raw AA raster', SVG, render: () => svgToGrid(SVG, 64, 64, { mode: 'raw' }) };
