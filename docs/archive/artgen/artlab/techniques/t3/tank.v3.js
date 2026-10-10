// T3 tank v3: v1 SVG minus strokes, plus dark underlay disk/rects so the dome and barrels keep a 1px
// internal outline after downsampling; quantize to an asset-restricted palette.
const { PAL } = require('../../lib/core');
const { svgToGrid } = require('../../lib/svg');
const O = PAL.outline;
const SVG = require('./tank.v1').SVG.replace(/ stroke="#1a1423" stroke-width="1"/g, '')
  .replace('<rect x="27" y="3"', `<rect x="26" y="2" width="5" height="24" fill="${O}"/><rect x="33" y="2" width="5" height="24" fill="${O}"/><rect x="27" y="3"`)
  .replace('<circle cx="32" cy="34" r="11"', `<circle cx="32" cy="34" r="12.2" fill="${O}"/><circle cx="32" cy="34" r="11"`)
  .replace('<path d="M24 8', `<path d="M24 7 H40 L49 16 V55.5 L44.5 60 H19.5 L15 55.5 V16 Z" fill="${O}"/><path d="M24 8`);
const PALETTE = [...PAL.armor, ...PAL.cyan, ...PAL.orange, O];
module.exports = { notes: 'Underlay outlines for dome/barrels/hull, restricted palette, ss=8', SVG,
  render: () => svgToGrid(SVG, 64, 64, { mode: 'ss', ss: 8, outline: true, shadow: [2, 2], pal: PALETTE }) };
