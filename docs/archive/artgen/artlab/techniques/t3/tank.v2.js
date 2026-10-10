// T3 tank v2: reuse v1 SVG, strip AA outline strokes; ss=8 quantize + majority downsample;
// raster outline + shadow. Gradients now become hard palette bands.
const { svgToGrid } = require('../../lib/svg');
const SVG = require('./tank.v1').SVG.replace(/ stroke="#1a1423" stroke-width="1"/g, '');
module.exports = { notes: 'v1 SVG minus strokes; ss=8 quantize+mode downsample, raster outline+shadow', SVG,
  render: () => svgToGrid(SVG, 64, 64, { mode: 'ss', ss: 8, outline: true, shadow: [2, 2] }) };
