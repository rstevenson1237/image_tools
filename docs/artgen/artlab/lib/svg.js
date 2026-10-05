// svg.js - Technique 3: author vector SVG, rasterise via canvas drawImage, then clean up.
// Modes: 'raw' (browser AA, as-is) | 'crisp' (AA then palette-quantize + alpha cut)
//        'ss' (supersample at N x, palette-quantize, majority-vote downsample)
const { createCanvas, Image } = require('@napi-rs/canvas');
const { Grid, PAL } = require('./core');
const post = require('./post');

function rasterize(svg, w, h) {
  // FIX (iso pass): decoders rasterise SVG at its width/height attributes; drawImage then only stretches that
  // bitmap. Rewrite the root size so the vector is truly rasterised at w x h (real supersampling).
  svg = svg.replace(/<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, `<svg$1 width="${w}" height="${h}"`);
  const img = new Image(); img.src = Buffer.from(svg);
  const c = createCanvas(w, h), ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  return Grid.fromCanvas(c);
}

function svgToGrid(svg, w, h, { mode = 'raw', ss = 8, outline = false, shadow = null, pal } = {}) {
  let g;
  if (mode === 'raw') g = rasterize(svg, w, h);
  else if (mode === 'crisp') g = post.quantize(rasterize(svg, w, h), pal);
  else g = post.modeDownsample(post.quantize(rasterize(svg, w * ss, h * ss), pal), ss);
  if (outline) g = post.outline(g, PAL.outline);
  if (shadow) g = post.dropShadow(g, shadow[0], shadow[1]);
  return g;
}

// tiny helper to build SVG docs from element strings
const doc = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;

module.exports = { svgToGrid, rasterize, doc };
