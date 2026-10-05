// T3 hero v2: pixel-aligned SVG (integer coords, no strokes, flat fills, no gradients),
// rendered at 8x, palette-quantized, majority-downsampled to 32x32, then 1px outline pass.
const { PAL } = require('../../lib/core');
const { svgToGrid, doc } = require('../../lib/svg');
const O = PAL.outline, k = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const SVG = doc(32, 32, `
  <path d="M10 15 L22 15 L25 28 L7 28 Z" fill="${PAL.red[1]}"/><path d="M10 15 L16 15 L14 28 L7 28 Z" fill="${PAL.red[0]}"/>
  ${k(12, 24, 3, 4, PAL.leather[0])}${k(17, 24, 3, 4, PAL.leather[1])}${k(11, 27, 4, 2, PAL.leather[2])}${k(17, 27, 4, 2, PAL.leather[2])}
  <rect x="11" y="15" width="10" height="10" rx="2" fill="${PAL.blue[0]}"/>${k(17, 15, 4, 10, PAL.blue[1])}
  ${k(11, 22, 10, 1, PAL.gold[1])}${k(15, 22, 2, 1, PAL.gold[0])}
  <ellipse cx="10.5" cy="16.5" rx="2.6" ry="2.1" fill="${PAL.steel[1]}"/><ellipse cx="21.5" cy="16.5" rx="2.6" ry="2.1" fill="${PAL.steel[2]}"/>
  ${k(9, 21, 2, 2, PAL.skin[0])}${k(21, 21, 2, 2, PAL.skin[1])}
  <ellipse cx="16" cy="10.5" rx="6.8" ry="6" fill="${PAL.skin[0]}"/><path d="M19 6 A6.8 6 0 0 1 19 16 Z" fill="${PAL.skin[1]}"/>
  <path d="M9 11 Q8.5 2.5 16 2.5 Q23.5 2.5 23 11 L21 8.5 L18 10 L16 8 L13 10 L11 8.5 Z" fill="${PAL.hair[1]}"/>
  <path d="M10 7 Q12 3.5 16 3.5 L14 6 Z" fill="${PAL.hair[0]}"/>
  ${k(12, 11, 1, 2, O)}${k(19, 11, 1, 2, O)}${k(10, 13, 1, 1, PAL.blush)}${k(21, 13, 1, 1, PAL.blush)}
  ${k(24, 3, 1, 14, PAL.steel[0])}${k(25, 3, 1, 14, PAL.steel[1])}${k(22, 17, 6, 1, PAL.gold[0])}${k(24, 18, 2, 3, PAL.leather[0])}
  <path d="M2 18 H9 V23 L5.5 28 L2 23 Z" fill="${PAL.steel[1]}"/>${k(5, 19, 1, 6, PAL.red[0])}${k(3, 21, 5, 1, PAL.red[0])}`);
module.exports = { notes: 'Pixel-aligned flat SVG, 8x supersample -> quantize -> mode downsample -> outline', SVG,
  render: () => svgToGrid(SVG, 32, 32, { mode: 'ss', ss: 8, outline: true }) };
