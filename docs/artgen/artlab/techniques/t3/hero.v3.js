// T3 hero v3: v2 SVG, quantized to a hero-only palette (stops stray ramp colours), 2px-tall eyes kept
// by drawing them 1.2 units wide so they win the majority vote.
const { PAL } = require('../../lib/core');
const { svgToGrid } = require('../../lib/svg');
const SVG = require('./hero.v2').SVG.replace(/<rect x="(12|19)" y="11" width="1" height="2"/g, '<rect x="$1" y="10.8" width="1.2" height="2.4"');
const PALETTE = [PAL.outline, ...PAL.skin, PAL.blush, ...PAL.hair, ...PAL.steel, ...PAL.blue, ...PAL.red, ...PAL.gold, ...PAL.leather];
module.exports = { notes: 'v2 + hero-restricted palette, eyes sized to survive downsample', SVG,
  render: () => svgToGrid(SVG, 32, 32, { mode: 'ss', ss: 8, outline: true, pal: PALETTE }) };
