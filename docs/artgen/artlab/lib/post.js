// post.js - pixel-art post-processing passes, usable by any technique
const { Grid, hex, toHex, paletteList, PAL } = require('./core');

// Outer 1px outline: any empty pixel 4-adjacent to a filled pixel gets the outline colour
function outline(g, color = PAL.outline, diag = false) {
  const out = g.clone();
  const nb = diag ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]] : [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) > 127) continue;
    if (nb.some(([dx, dy]) => g.alpha(x + dx, y + dy) > 200)) out.set(x, y, color);
  }
  return out;
}

// Snap all pixels to nearest palette colour; alpha becomes 0 or 255
function quantize(g, pal = paletteList(), alphaCut = 128) {
  const P = pal.map(hex), out = new Grid(g.w, g.h);
  for (let i = 0; i < g.w * g.h; i++) {
    const a = g.d[i * 4 + 3]; if (a < alphaCut) continue;
    // un-premultiply edge pixels toward their true colour
    let r = g.d[i * 4], gg = g.d[i * 4 + 1], b = g.d[i * 4 + 2], best = 0, bd = 1e9;
    for (let k = 0; k < P.length; k++) {
      const dr = r - P[k][0], dg = gg - P[k][1], db = b - P[k][2];
      const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db; if (d < bd) { bd = d; best = k; }
    }
    out.d.set([P[best][0], P[best][1], P[best][2], 255], i * 4);
  }
  return out;
}

// Majority (mode) downsample: picks most common opaque colour per block - keeps lines crisp
function modeDownsample(g, f) {
  const out = new Grid(Math.floor(g.w / f), Math.floor(g.h / f));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const counts = new Map(); let empty = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const c = g.get(x * f + i, y * f + j); if (!c) { empty++; continue; }
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    if (empty > f * f / 2) continue;
    let best = null, bn = 0; for (const [c, n] of counts) if (n > bn) { bn = n; best = c; }
    out.set(x, y, best);
  }
  return out;
}

// Drop shadow offset down-right, drawn under the sprite
function dropShadow(g, dx = 1, dy = 1, color = PAL.shadow) {
  const out = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x - dx, y - dy) > 200) out.set(x, y, color);
  return out.stamp(g);
}

// Remove isolated single pixels that differ from all 4 neighbours (noise cleanup)
function despeckle(g) {
  const out = g.clone();
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const c = g.get(x, y); if (!c) continue;
    const n = [g.get(x+1,y), g.get(x-1,y), g.get(x,y+1), g.get(x,y-1)];
    if (n.every(v => v && v !== c) && n[0] === n[1] && n[1] === n[2]) out.set(x, y, n[0]);
  }
  return out;
}

module.exports = { outline, quantize, modeDownsample, dropShadow, despeckle };
