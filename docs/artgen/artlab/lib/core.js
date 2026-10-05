// core.js - shared pixel grid, palette and canvas helpers (browser-portable logic)
const { createCanvas } = require('@napi-rs/canvas');

// Shared master palette (named ramps). All techniques quantize to / draw from this.
const PAL = {
  outline: '#1a1423', ink: '#2b2233',
  skin: ['#f6d2b0', '#e2a27c', '#b56e55'],
  hair: ['#b07a45', '#7a4a2a', '#4a2a1a'],
  steel: ['#eef2f5', '#b4bfc8', '#77838f', '#4a5460'],
  blue: ['#6b9be0', '#3f68b8', '#283f7a'],
  red: ['#e0574a', '#a8323a', '#6a1e2e'],
  gold: ['#ffe27a', '#d9a832', '#8f6418'],
  leather: ['#a8703c', '#74482a', '#4a2c1c'],
  navy: ['#c4ccd2', '#97a3ad', '#6c7883', '#47515b', '#2c333b'],
  teak: ['#d8b98a', '#b8956a', '#8c6c48'],
  hullred: ['#8a3a34'],
  armor: ['#e4e9ee', '#aab5bf', '#6e7a86', '#3e4650', '#262b32'],
  cyan: ['#c8ffff', '#5ce6ff', '#1aa0c8'],
  orange: ['#ffd27a', '#ff8a3c', '#c04a1e'],
  blush: '#ec9a8f',
  green: ['#8fcf5e', '#4e8f3e', '#2c5a2e'],
  purple: ['#9a72b8', '#62467e', '#3a2a50'],
  wood: ['#c98a4b', '#9a6232', '#6a3e22'],
  shadow: 'rgba(0,0,0,0.35)',
};

// Flattened opaque palette list (used for quantization)
function paletteList() {
  const out = [];
  for (const v of Object.values(PAL)) {
    for (const c of (Array.isArray(v) ? v : [v])) if (c.startsWith('#')) out.push(c);
  }
  return [...new Set(out)];
}

const hexCache = new Map();
function hex(c) {
  if (hexCache.has(c)) return hexCache.get(c);
  let r;
  if (c.startsWith('rgba')) { const m = c.match(/[\d.]+/g).map(Number); r = [m[0], m[1], m[2], Math.round(m[3] * 255)]; }
  else r = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
  hexCache.set(c, r); return r;
}
const toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

// Seeded RNG (mulberry32) so every render is reproducible
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x |= 0; y |= 0; if (!this.inb(x, y) || c == null) return;
    const [r, g, b, a] = hex(c), i = (y * this.w + x) * 4;
    if (a === 255 || this.d[i + 3] === 0) { this.d.set([r, g, b, a], i); return; }
    const t = a / 255; // alpha blend over existing (used for shadows)
    this.d[i] = this.d[i] * (1 - t) + r * t; this.d[i + 1] = this.d[i + 1] * (1 - t) + g * t; this.d[i + 2] = this.d[i + 2] * (1 - t) + b * t;
  }
  alpha(x, y) { return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  get(x, y) { if (!this.inb(x, y)) return null; const i = (y * this.w + x) * 4; if (!this.d[i + 3]) return null; return toHex(this.d[i], this.d[i + 1], this.d[i + 2]); }
  clone() { const g = new Grid(this.w, this.h); g.d.set(this.d); return g; }
  // draw another grid on top (non-transparent pixels)
  stamp(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(x + ox, y + oy, c); }
    return this;
  }
  toCanvas(scale = 1) {
    const c = createCanvas(this.w * scale, this.h * scale), ctx = c.getContext('2d');
    const src = createCanvas(this.w, this.h); const sctx = src.getContext('2d');
    const img = sctx.createImageData(this.w, this.h); img.data.set(this.d); sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, this.w * scale, this.h * scale); return c;
  }
  static fromCanvas(c) {
    const g = new Grid(c.width, c.height); g.d.set(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); return g;
  }
}

module.exports = { PAL, paletteList, hex, toHex, rng, Grid, createCanvas };
