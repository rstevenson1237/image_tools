// T3 ship v1: SVG battleship (bow right) with gradient hull, rasterised directly at 160x41.
const { PAL } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const N = PAL.navy, O = PAL.navy[4];
const turret = (x, dir) => `<g transform="translate(${x} 20.5) scale(${dir} 1)">
  <path d="M3 -2.2 H14 M3 0 H14 M3 2.2 H14" stroke="${N[3]}" stroke-width="1.1"/>
  <path d="M-4 -4 H2 L5 -2 V2 L2 4 H-4 Z" fill="${N[1]}" stroke="${O}" stroke-width="0.8"/></g>`;
const SVG = doc(160, 41, `
 <defs><linearGradient id="deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PAL.teak[0]}"/><stop offset="1" stop-color="${PAL.teak[2]}"/></linearGradient></defs>
 <path d="M7 13 Q4 20.5 7 28 L95 30.5 Q140 26 155 20.5 Q140 15 95 10.5 Z" fill="#000" opacity=".35" transform="translate(2 2)"/>
 <path d="M7 13 Q4 20.5 7 28 L95 30.5 Q140 26 155 20.5 Q140 15 95 10.5 Z" fill="url(#deck)" stroke="${O}" stroke-width="1"/>
 <rect x="59" y="15" width="33" height="11" rx="1" fill="${N[2]}" stroke="${O}" stroke-width=".8"/>
 <rect x="83" y="17" width="8" height="7" fill="${N[1]}" stroke="${O}" stroke-width=".6"/>
 <circle cx="68" cy="20.5" r="2.6" fill="${N[3]}" stroke="${O}" stroke-width=".6"/><circle cx="76" cy="20.5" r="2.6" fill="${N[3]}" stroke="${O}" stroke-width=".6"/>
 ${turret(45.5, -1)}${turret(113, 1)}${turret(101, 1)}
 ${[0, 1, 2, 3].map(i => `<rect x="${60 + i * 8}" y="12" width="3" height="2" fill="${N[1]}"/><rect x="${60 + i * 8}" y="27" width="3" height="2" fill="${N[1]}"/>`).join('')}`);
module.exports = { notes: 'SVG paths + gradient deck, raw AA raster', SVG, render: () => svgToGrid(SVG, 160, 41, { mode: 'raw' }) };
