// T3 ship v2: reuse v1 SVG, strip AA outline strokes (outline becomes a 1px raster pass),
// render 8x -> palette quantize -> majority downsample -> outline -> drop shadow.
const { PAL } = require('../../lib/core');
const { svgToGrid } = require('../../lib/svg');
const SVG = require('./ship.v1').SVG
  .replace(/ stroke="#2c333b" stroke-width="[\d.]+"/g, '')
  .replace(/<path[^>]*opacity="\.35"[^>]*\/>/, '');                // shadow now done in raster
module.exports = { notes: 'v1 SVG minus strokes/shadow; ss=8 quantize+mode downsample, raster outline+shadow', SVG,
  render: () => svgToGrid(SVG, 160, 41, { mode: 'ss', ss: 8, outline: true, shadow: [2, 2] }) };
