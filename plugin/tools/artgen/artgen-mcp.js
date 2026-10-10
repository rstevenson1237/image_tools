#!/usr/bin/env node
import { createRequire as __artgenRequire } from 'node:module'; const require = __artgenRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod4) => function __require2() {
  return mod4 || (0, cb[__getOwnPropNames(cb)[0]])((mod4 = { exports: {} }).exports, mod4), mod4.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod4, isNodeMode, target) => (target = mod4 != null ? __create(__getProtoOf(mod4)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod4 || !mod4.__esModule ? __defProp(target, "default", { value: mod4, enumerable: true }) : target,
  mod4
));

// ../artgen-core/src/lib/color.ts
function parseColor(c) {
  const hit = cache.get(c);
  if (hit) return hit;
  let r;
  if (c.startsWith("rgb")) {
    const m = (c.match(/[\d.]+/g) ?? []).map(Number);
    if (m.length < 3) throw new Error(`bad colour: ${c}`);
    r = [m[0], m[1], m[2], m.length > 3 ? Math.round(m[3] * 255) : 255];
  } else if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c)) {
    const n = (i) => parseInt(c.slice(i, i + 2), 16);
    r = [n(1), n(3), n(5), c.length === 9 ? n(7) : 255];
  } else if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const n = (i) => parseInt(c[i] + c[i], 16);
    r = [n(1), n(2), n(3), 255];
  } else throw new Error(`bad colour: ${c}`);
  cache.set(c, r);
  return r;
}
function normHex(c) {
  const [r, g, b] = parseColor(c);
  return toHex(r, g, b);
}
function toHsl(c) {
  const [R2, G, B] = parseColor(c).map((v) => v / 255);
  const max2 = Math.max(R2, G, B), min = Math.min(R2, G, B), l = (max2 + min) / 2;
  if (max2 === min) return { h: 0, s: 0, l };
  const d = max2 - min, s2 = l > 0.5 ? d / (2 - max2 - min) : d / (max2 + min);
  let h = max2 === R2 ? (G - B) / d + (G < B ? 6 : 0) : max2 === G ? (B - R2) / d + 2 : (R2 - G) / d + 4;
  h *= 60;
  return { h, s: s2, l };
}
function fromHsl({ h, s: s2, l }) {
  h = (h % 360 + 360) % 360;
  s2 = Math.max(0, Math.min(1, s2));
  l = Math.max(0, Math.min(1, l));
  const q = l < 0.5 ? l * (1 + s2) : l + s2 - l * s2, p = 2 * l - q;
  const f = (t) => {
    t = (t % 1 + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  const hh = h / 360;
  return toHex(f(hh + 1 / 3), f(hh), f(hh - 1 / 3));
}
var cache, h2, toHex, luma, lumaOf, dist2;
var init_color = __esm({
  "../artgen-core/src/lib/color.ts"() {
    "use strict";
    cache = /* @__PURE__ */ new Map();
    h2 = (v) => v.toString(16).padStart(2, "0");
    toHex = (r, g, b) => "#" + h2(r) + h2(g) + h2(b);
    luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    lumaOf = (c) => {
      const [r, g, b] = parseColor(c);
      return luma(r, g, b);
    };
    dist2 = (a, r, g, b) => {
      const dr = r - a[0], dg = g - a[1], db = b - a[2];
      return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    };
  }
});

// ../artgen-core/src/lib/grid.ts
var Grid;
var init_grid = __esm({
  "../artgen-core/src/lib/grid.ts"() {
    "use strict";
    init_color();
    Grid = class _Grid {
      w;
      h;
      d;
      /** Normal map of this image (same size; RGB = normal, OpenGL convention), when the renderer produced one. */
      normal;
      constructor(w, h, data) {
        this.w = w;
        this.h = h;
        this.d = new Uint8ClampedArray(w * h * 4);
        if (data) this.d.set(data);
      }
      inb(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
      }
      /** Write a colour. Partial alpha blends over an opaque pixel and keeps its alpha (artlab: used for shadows). */
      set(x, y, c) {
        x |= 0;
        y |= 0;
        if (!this.inb(x, y) || c == null) return;
        const [r, g, b, a] = parseColor(c), i = (y * this.w + x) * 4, d = this.d;
        if (a === 255 || d[i + 3] === 0) {
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
          d[i + 3] = a;
          return;
        }
        const t = a / 255;
        d[i] = d[i] * (1 - t) + r * t;
        d[i + 1] = d[i + 1] * (1 - t) + g * t;
        d[i + 2] = d[i + 2] * (1 - t) + b * t;
      }
      /** Clear a pixel to transparent. */
      clear(x, y) {
        if (this.inb(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
      }
      alpha(x, y) {
        return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0;
      }
      /** `#rrggbb` of a non-transparent pixel, else null. */
      get(x, y) {
        if (!this.inb(x, y)) return null;
        const i = (y * this.w + x) * 4;
        if (!this.d[i + 3]) return null;
        return toHex(this.d[i], this.d[i + 1], this.d[i + 2]);
      }
      clone() {
        return new _Grid(this.w, this.h, this.d);
      }
      /** Draw another grid's non-transparent pixels on top. */
      stamp(src, ox = 0, oy = 0) {
        for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
          const c = src.get(x, y);
          if (c) this.set(x + ox, y + oy, c);
        }
        return this;
      }
      /** Source-over composite of `src` (straight alpha), so partial-alpha shadows blend as in a game. */
      over(src, ox = 0, oy = 0) {
        for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
          const i = (y * src.w + x) * 4, sa = src.d[i + 3] / 255;
          if (!sa || !this.inb(x + ox, y + oy)) continue;
          const j = ((y + oy) * this.w + x + ox) * 4, da = this.d[j + 3] / 255, oa = sa + da * (1 - sa);
          for (let c = 0; c < 3; c++) this.d[j + c] = (src.d[i + c] * sa + this.d[j + c] * da * (1 - sa)) / oa;
          this.d[j + 3] = oa * 255;
        }
        return this;
      }
      /** Copy raw RGBA (including partial alpha) from src, replacing pixels where src is non-transparent. */
      blit(src, ox = 0, oy = 0) {
        for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
          const i = (y * src.w + x) * 4;
          if (!src.d[i + 3] || !this.inb(x + ox, y + oy)) continue;
          this.d.set(src.d.subarray(i, i + 4), ((y + oy) * this.w + x + ox) * 4);
        }
        return this;
      }
      crop(x, y, w, h) {
        const g = new _Grid(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          if (!this.inb(x + i, y + j)) continue;
          const s2 = ((y + j) * this.w + x + i) * 4;
          g.d.set(this.d.subarray(s2, s2 + 4), (j * w + i) * 4);
        }
        return g;
      }
      pad(top, right = top, bottom = top, left = right) {
        return this.crop(-left, -top, this.w + left + right, this.h + top + bottom);
      }
      /** Bounding box of non-transparent pixels, or null when empty. */
      bounds() {
        let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      }
      trim() {
        const b = this.bounds();
        return b ? this.crop(b.x, b.y, b.w, b.h) : new _Grid(0, 0);
      }
      flip(axis = "x") {
        const g = new _Grid(this.w, this.h);
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const sx = axis === "x" ? this.w - 1 - x : x, sy = axis === "y" ? this.h - 1 - y : y, s2 = (sy * this.w + sx) * 4;
          g.d.set(this.d.subarray(s2, s2 + 4), (y * this.w + x) * 4);
        }
        return g;
      }
      /** Nearest-neighbour integer upscale. */
      scale(n) {
        if (n === 1) return this.clone();
        const g = new _Grid(this.w * n, this.h * n);
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          const s2 = ((y / n | 0) * this.w + (x / n | 0)) * 4;
          g.d.set(this.d.subarray(s2, s2 + 4), (y * g.w + x) * 4);
        }
        return g;
      }
      /** Fill a rectangle with a colour (blending like `set`). */
      fill(x, y, w, h, c) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
        return this;
      }
      /** Stable content hash (cyrb53 over size + RGBA bytes), 14 hex chars. */
      hash() {
        let h1 = 3735928559 ^ this.w, h22 = 1103547991 ^ this.h;
        for (let i = 0; i < this.d.length; i++) {
          const c = this.d[i];
          h1 = Math.imul(h1 ^ c, 2654435761);
          h22 = Math.imul(h22 ^ c, 1597334677);
        }
        h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h22 ^ h22 >>> 13, 3266489909);
        h22 = Math.imul(h22 ^ h22 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
        return (4294967296 * (2097151 & h22) + (h1 >>> 0)).toString(16).padStart(14, "0");
      }
      /**
       * Indexed form: `palette` lists distinct RGBA colours in first-seen order, `index` holds palette
       * position + 1 per pixel (0 = transparent).
       */
      toIndexed() {
        const key2 = /* @__PURE__ */ new Map(), palette = [], alphas = [], index = new Uint16Array(this.w * this.h);
        for (let p = 0; p < index.length; p++) {
          const i = p * 4, a = this.d[i + 3];
          if (!a) continue;
          const k = (this.d[i] << 24 | this.d[i + 1] << 16 | this.d[i + 2] << 8 | a) >>> 0;
          let n = key2.get(k);
          if (n === void 0) {
            n = palette.length;
            key2.set(k, n);
            palette.push(toHex(this.d[i], this.d[i + 1], this.d[i + 2]));
            alphas.push(a);
          }
          index[p] = n + 1;
        }
        return { palette, alphas, index };
      }
      /** Number of pixels that differ (any channel) from another grid of the same size. */
      diffCount(o) {
        if (o.w !== this.w || o.h !== this.h) return Math.max(this.w * this.h, o.w * o.h);
        let n = 0;
        for (let p = 0; p < this.w * this.h; p++) {
          const i = p * 4;
          if (this.d[i] !== o.d[i] || this.d[i + 1] !== o.d[i + 1] || this.d[i + 2] !== o.d[i + 2] || this.d[i + 3] !== o.d[i + 3]) n++;
        }
        return n;
      }
    };
  }
});

// ../artgen-core/src/lib/rng.ts
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s2) {
  let h1 = 2166136261, h22 = 16777619 ^ s2.length;
  for (let i = 0; i < s2.length; i++) {
    const c = s2.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h22 = Math.imul(h22 ^ c, 1540483477);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h22 >>> 0).toString(16).padStart(8, "0");
}
var init_rng = __esm({
  "../artgen-core/src/lib/rng.ts"() {
    "use strict";
  }
});

// ../../node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
function zlibSync(data, opts) {
  if (!opts)
    opts = {};
  var a = adler();
  a.p(data);
  var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
  return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var require2, _a, Worker, isMarkedAsUntransferable, u8, u16, i32, fleb, fdeb, clim, freb, _a, fl, revfl, _b, fd, revfd, rev, x, i, hMap, flt, i, i, i, i, fdt, i, flm, flrm, fdm, fdrm, max, bits, bits16, shft, slc, ec, err, inflt, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, deo, et, dflt, adler, dopt, wbytes, zlh, zls, td, tds;
var init_esm = __esm({
  "../../node_modules/fflate/esm/index.mjs"() {
    require2 = createRequire("/");
    try {
      _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
    } catch (e) {
    }
    u8 = Uint8Array;
    u16 = Uint16Array;
    i32 = Int32Array;
    fleb = new u8([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      4,
      5,
      5,
      5,
      5,
      0,
      /* unused */
      0,
      0,
      /* impossible */
      0
    ]);
    fdeb = new u8([
      0,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
      7,
      7,
      8,
      8,
      9,
      9,
      10,
      10,
      11,
      11,
      12,
      12,
      13,
      13,
      /* unused */
      0,
      0
    ]);
    clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    freb = function(eb, start) {
      var b = new u16(31);
      for (var i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
      }
      var r = new i32(b[30]);
      for (var i = 1; i < 30; ++i) {
        for (var j = b[i]; j < b[i + 1]; ++j) {
          r[j] = j - b[i] << 5 | i;
        }
      }
      return { b, r };
    };
    _a = freb(fleb, 2);
    fl = _a.b;
    revfl = _a.r;
    fl[28] = 258, revfl[258] = 28;
    _b = freb(fdeb, 0);
    fd = _b.b;
    revfd = _b.r;
    rev = new u16(32768);
    for (i = 0; i < 32768; ++i) {
      x = (i & 43690) >> 1 | (i & 21845) << 1;
      x = (x & 52428) >> 2 | (x & 13107) << 2;
      x = (x & 61680) >> 4 | (x & 3855) << 4;
      rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
    }
    hMap = (function(cd, mb, r) {
      var s2 = cd.length;
      var i = 0;
      var l = new u16(mb);
      for (; i < s2; ++i) {
        if (cd[i])
          ++l[cd[i] - 1];
      }
      var le = new u16(mb);
      for (i = 1; i < mb; ++i) {
        le[i] = le[i - 1] + l[i - 1] << 1;
      }
      var co;
      if (r) {
        co = new u16(1 << mb);
        var rvb = 15 - mb;
        for (i = 0; i < s2; ++i) {
          if (cd[i]) {
            var sv = i << 4 | cd[i];
            var r_1 = mb - cd[i];
            var v = le[cd[i] - 1]++ << r_1;
            for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
              co[rev[v] >> rvb] = sv;
            }
          }
        }
      } else {
        co = new u16(s2);
        for (i = 0; i < s2; ++i) {
          if (cd[i]) {
            co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
          }
        }
      }
      return co;
    });
    flt = new u8(288);
    for (i = 0; i < 144; ++i)
      flt[i] = 8;
    for (i = 144; i < 256; ++i)
      flt[i] = 9;
    for (i = 256; i < 280; ++i)
      flt[i] = 7;
    for (i = 280; i < 288; ++i)
      flt[i] = 8;
    fdt = new u8(32);
    for (i = 0; i < 32; ++i)
      fdt[i] = 5;
    flm = /* @__PURE__ */ hMap(flt, 9, 0);
    flrm = /* @__PURE__ */ hMap(flt, 9, 1);
    fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
    fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
    max = function(a) {
      var m = a[0];
      for (var i = 1; i < a.length; ++i) {
        if (a[i] > m)
          m = a[i];
      }
      return m;
    };
    bits = function(d, p, m) {
      var o = p / 8 | 0;
      return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
    };
    bits16 = function(d, p) {
      var o = p / 8 | 0;
      return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
    };
    shft = function(p) {
      return (p + 7) / 8 | 0;
    };
    slc = function(v, s2, e) {
      if (s2 == null || s2 < 0)
        s2 = 0;
      if (e == null || e > v.length)
        e = v.length;
      return new u8(v.subarray(s2, e));
    };
    ec = [
      "unexpected EOF",
      "invalid block type",
      "invalid length/literal",
      "invalid distance",
      "stream finished",
      "no stream handler",
      ,
      // determined by compression function
      "no callback",
      "invalid UTF-8 data",
      "extra field too long",
      "date not in range 1980-2099",
      "filename too long",
      "stream finishing",
      "invalid zip data"
      // determined by unknown compression method
    ];
    err = function(ind, msg, nt) {
      var e = new Error(msg || ec[ind]);
      e.code = ind;
      if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
      if (!nt)
        throw e;
      return e;
    };
    inflt = function(dat, st, buf, dict) {
      var sl = dat.length, dl = dict ? dict.length : 0;
      if (!sl || st.f && !st.l)
        return buf || new u8(0);
      var noBuf = !buf;
      var resize = noBuf || st.i != 2;
      var noSt = st.i;
      if (noBuf)
        buf = new u8(sl * 3);
      var cbuf = function(l2) {
        var bl = buf.length;
        if (l2 > bl) {
          var nbuf = new u8(Math.max(bl * 2, l2));
          nbuf.set(buf);
          buf = nbuf;
        }
      };
      var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
      var tbts = sl * 8;
      do {
        if (!lm) {
          final = bits(dat, pos, 1);
          var type = bits(dat, pos + 1, 3);
          pos += 3;
          if (!type) {
            var s2 = shft(pos) + 4, l = dat[s2 - 4] | dat[s2 - 3] << 8, t = s2 + l;
            if (t > sl) {
              if (noSt)
                err(0);
              break;
            }
            if (resize)
              cbuf(bt + l);
            buf.set(dat.subarray(s2, t), bt);
            st.b = bt += l, st.p = pos = t * 8, st.f = final;
            continue;
          } else if (type == 1)
            lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
          else if (type == 2) {
            var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
            var tl = hLit + bits(dat, pos + 5, 31) + 1;
            pos += 14;
            var ldt = new u8(tl);
            var clt = new u8(19);
            for (var i = 0; i < hcLen; ++i) {
              clt[clim[i]] = bits(dat, pos + i * 3, 7);
            }
            pos += hcLen * 3;
            var clb = max(clt), clbmsk = (1 << clb) - 1;
            var clm = hMap(clt, clb, 1);
            for (var i = 0; i < tl; ) {
              var r = clm[bits(dat, pos, clbmsk)];
              pos += r & 15;
              var s2 = r >> 4;
              if (s2 < 16) {
                ldt[i++] = s2;
              } else {
                var c = 0, n = 0;
                if (s2 == 16)
                  n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                else if (s2 == 17)
                  n = 3 + bits(dat, pos, 7), pos += 3;
                else if (s2 == 18)
                  n = 11 + bits(dat, pos, 127), pos += 7;
                while (n--)
                  ldt[i++] = c;
              }
            }
            var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
            lbt = max(lt);
            dbt = max(dt);
            lm = hMap(lt, lbt, 1);
            dm = hMap(dt, dbt, 1);
          } else
            err(1);
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
        }
        if (resize)
          cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for (; ; lpos = pos) {
          var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
          pos += c & 15;
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (!c)
            err(2);
          if (sym < 256)
            buf[bt++] = sym;
          else if (sym == 256) {
            lpos = pos, lm = null;
            break;
          } else {
            var add2 = sym - 254;
            if (sym > 264) {
              var i = sym - 257, b = fleb[i];
              add2 = bits(dat, pos, (1 << b) - 1) + fl[i];
              pos += b;
            }
            var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
            if (!d)
              err(3);
            pos += d & 15;
            var dt = fd[dsym];
            if (dsym > 3) {
              var b = fdeb[dsym];
              dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
            }
            if (pos > tbts) {
              if (noSt)
                err(0);
              break;
            }
            if (resize)
              cbuf(bt + 131072);
            var end = bt + add2;
            if (bt < dt) {
              var shift = dl - dt, dend = Math.min(dt, end);
              if (shift + bt < 0)
                err(3);
              for (; bt < dend; ++bt)
                buf[bt] = dict[shift + bt];
            }
            for (; bt < end; ++bt)
              buf[bt] = buf[bt - dt];
          }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
          final = 1, st.m = lbt, st.d = dm, st.n = dbt;
      } while (!final);
      return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
    };
    wbits = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
    };
    wbits16 = function(d, p, v) {
      v <<= p & 7;
      var o = p / 8 | 0;
      d[o] |= v;
      d[o + 1] |= v >> 8;
      d[o + 2] |= v >> 16;
    };
    hTree = function(d, mb) {
      var t = [];
      for (var i = 0; i < d.length; ++i) {
        if (d[i])
          t.push({ s: i, f: d[i] });
      }
      var s2 = t.length;
      var t2 = t.slice();
      if (!s2)
        return { t: et, l: 0 };
      if (s2 == 1) {
        var v = new u8(t[0].s + 1);
        v[t[0].s] = 1;
        return { t: v, l: 1 };
      }
      t.sort(function(a, b) {
        return a.f - b.f;
      });
      t.push({ s: -1, f: 25001 });
      var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
      t[0] = { s: -1, f: l.f + r.f, l, r };
      while (i1 != s2 - 1) {
        l = t[t[i0].f < t[i2].f ? i0++ : i2++];
        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
        t[i1++] = { s: -1, f: l.f + r.f, l, r };
      }
      var maxSym = t2[0].s;
      for (var i = 1; i < s2; ++i) {
        if (t2[i].s > maxSym)
          maxSym = t2[i].s;
      }
      var tr = new u16(maxSym + 1);
      var mbt = ln(t[i1 - 1], tr, 0);
      if (mbt > mb) {
        var i = 0, dt = 0;
        var lft = mbt - mb, cst = 1 << lft;
        t2.sort(function(a, b) {
          return tr[b.s] - tr[a.s] || a.f - b.f;
        });
        for (; i < s2; ++i) {
          var i2_1 = t2[i].s;
          if (tr[i2_1] > mb) {
            dt += cst - (1 << mbt - tr[i2_1]);
            tr[i2_1] = mb;
          } else
            break;
        }
        dt >>= lft;
        while (dt > 0) {
          var i2_2 = t2[i].s;
          if (tr[i2_2] < mb)
            dt -= 1 << mb - tr[i2_2]++ - 1;
          else
            ++i;
        }
        for (; i >= 0 && dt; --i) {
          var i2_3 = t2[i].s;
          if (tr[i2_3] == mb) {
            --tr[i2_3];
            ++dt;
          }
        }
        mbt = mb;
      }
      return { t: new u8(tr), l: mbt };
    };
    ln = function(n, l, d) {
      return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
    };
    lc = function(c) {
      var s2 = c.length;
      while (s2 && !c[--s2])
        ;
      var cl = new u16(++s2);
      var cli = 0, cln = c[0], cls = 1;
      var w = function(v) {
        cl[cli++] = v;
      };
      for (var i = 1; i <= s2; ++i) {
        if (c[i] == cln && i != s2)
          ++cls;
        else {
          if (!cln && cls > 2) {
            for (; cls > 138; cls -= 138)
              w(32754);
            if (cls > 2) {
              w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
              cls = 0;
            }
          } else if (cls > 3) {
            w(cln), --cls;
            for (; cls > 6; cls -= 6)
              w(8304);
            if (cls > 2)
              w(cls - 3 << 5 | 8208), cls = 0;
          }
          while (cls--)
            w(cln);
          cls = 1;
          cln = c[i];
        }
      }
      return { c: cl.subarray(0, cli), n: s2 };
    };
    clen = function(cf, cl) {
      var l = 0;
      for (var i = 0; i < cl.length; ++i)
        l += cf[i] * cl[i];
      return l;
    };
    wfblk = function(out, pos, dat) {
      var s2 = dat.length;
      var o = shft(pos + 2);
      out[o] = s2 & 255;
      out[o + 1] = s2 >> 8;
      out[o + 2] = out[o] ^ 255;
      out[o + 3] = out[o + 1] ^ 255;
      for (var i = 0; i < s2; ++i)
        out[o + i + 4] = dat[i];
      return (o + 4 + s2) * 8;
    };
    wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
      wbits(out, p++, final);
      ++lf[256];
      var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
      var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
      var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
      var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
      var lcfreq = new u16(19);
      for (var i = 0; i < lclt.length; ++i)
        ++lcfreq[lclt[i] & 31];
      for (var i = 0; i < lcdt.length; ++i)
        ++lcfreq[lcdt[i] & 31];
      var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
      var nlcc = 19;
      for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
        ;
      var flen = bl + 5 << 3;
      var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
      var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
      if (bs >= 0 && flen <= ftlen && flen <= dtlen)
        return wfblk(out, p, dat.subarray(bs, bs + bl));
      var lm, ll, dm, dl;
      wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
      if (dtlen < ftlen) {
        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
        var llm = hMap(lct, mlcb, 0);
        wbits(out, p, nlc - 257);
        wbits(out, p + 5, ndc - 1);
        wbits(out, p + 10, nlcc - 4);
        p += 14;
        for (var i = 0; i < nlcc; ++i)
          wbits(out, p + 3 * i, lct[clim[i]]);
        p += 3 * nlcc;
        var lcts = [lclt, lcdt];
        for (var it = 0; it < 2; ++it) {
          var clct = lcts[it];
          for (var i = 0; i < clct.length; ++i) {
            var len = clct[i] & 31;
            wbits(out, p, llm[len]), p += lct[len];
            if (len > 15)
              wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
          }
        }
      } else {
        lm = flm, ll = flt, dm = fdm, dl = fdt;
      }
      for (var i = 0; i < li; ++i) {
        var sym = syms[i];
        if (sym > 255) {
          var len = sym >> 18 & 31;
          wbits16(out, p, lm[len + 257]), p += ll[len + 257];
          if (len > 7)
            wbits(out, p, sym >> 23 & 31), p += fleb[len];
          var dst = sym & 31;
          wbits16(out, p, dm[dst]), p += dl[dst];
          if (dst > 3)
            wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
        } else {
          wbits16(out, p, lm[sym]), p += ll[sym];
        }
      }
      wbits16(out, p, lm[256]);
      return p + ll[256];
    };
    deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
    et = /* @__PURE__ */ new u8(0);
    dflt = function(dat, lvl, plvl, pre, post, st) {
      var s2 = st.z || dat.length;
      var o = new u8(pre + s2 + 5 * (1 + Math.ceil(s2 / 7e3)) + post);
      var w = o.subarray(pre, o.length - post);
      var lst = st.l;
      var pos = (st.r || 0) & 7;
      if (lvl) {
        if (pos)
          w[0] = st.r >> 3;
        var opt = deo[lvl - 1];
        var n = opt >> 13, c = opt & 8191;
        var msk_1 = (1 << plvl) - 1;
        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
        var hsh = function(i2) {
          return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
        };
        var syms = new i32(25e3);
        var lf = new u16(288), df = new u16(32);
        var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
        for (; i + 2 < s2; ++i) {
          var hv = hsh(i);
          var imod = i & 32767, pimod = head[hv];
          prev[imod] = pimod;
          head[hv] = imod;
          if (wi <= i) {
            var rem = s2 - i;
            if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
              pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
              li = lc_1 = eb = 0, bs = i;
              for (var j = 0; j < 286; ++j)
                lf[j] = 0;
              for (var j = 0; j < 30; ++j)
                df[j] = 0;
            }
            var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
            if (rem > 2 && hv == hsh(i - dif)) {
              var maxn = Math.min(n, rem) - 1;
              var maxd = Math.min(32767, i);
              var ml = Math.min(258, rem);
              while (dif <= maxd && --ch_1 && imod != pimod) {
                if (dat[i + l] == dat[i + l - dif]) {
                  var nl = 0;
                  for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                    ;
                  if (nl > l) {
                    l = nl, d = dif;
                    if (nl > maxn)
                      break;
                    var mmd = Math.min(dif, nl - 2);
                    var md = 0;
                    for (var j = 0; j < mmd; ++j) {
                      var ti = i - dif + j & 32767;
                      var pti = prev[ti];
                      var cd = ti - pti & 32767;
                      if (cd > md)
                        md = cd, pimod = ti;
                    }
                  }
                }
                imod = pimod, pimod = prev[imod];
                dif += imod - pimod & 32767;
              }
            }
            if (d) {
              syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
              var lin = revfl[l] & 31, din = revfd[d] & 31;
              eb += fleb[lin] + fdeb[din];
              ++lf[257 + lin];
              ++df[din];
              wi = i + l;
              ++lc_1;
            } else {
              syms[li++] = dat[i];
              ++lf[dat[i]];
            }
          }
        }
        for (i = Math.max(i, wi); i < s2; ++i) {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
        if (!lst) {
          st.r = pos & 7 | w[pos / 8 | 0] << 3;
          pos -= 7;
          st.h = head, st.p = prev, st.i = i, st.w = wi;
        }
      } else {
        for (var i = st.w || 0; i < s2 + lst; i += 65535) {
          var e = i + 65535;
          if (e >= s2) {
            w[pos / 8 | 0] = lst;
            e = s2;
          }
          pos = wfblk(w, pos + 1, dat.subarray(i, e));
        }
        st.i = s2;
      }
      return slc(o, 0, pre + shft(pos) + post);
    };
    adler = function() {
      var a = 1, b = 0;
      return {
        p: function(d) {
          var n = a, m = b;
          var l = d.length | 0;
          for (var i = 0; i != l; ) {
            var e = Math.min(i + 2655, l);
            for (; i < e; ++i)
              m += n += d[i];
            n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
          }
          a = n, b = m;
        },
        d: function() {
          a %= 65521, b %= 65521;
          return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
        }
      };
    };
    dopt = function(dat, opt, pre, post, st) {
      if (!st) {
        st = { l: 1 };
        if (opt.dictionary) {
          var dict = opt.dictionary.subarray(-32768);
          var newDat = new u8(dict.length + dat.length);
          newDat.set(dict);
          newDat.set(dat, dict.length);
          dat = newDat;
          st.w = dict.length;
        }
      }
      return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
    };
    wbytes = function(d, b, v) {
      for (; v; ++b)
        d[b] = v, v >>>= 8;
    };
    zlh = function(c, o) {
      var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
      c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
      c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
      if (o.dictionary) {
        var h = adler();
        h.p(o.dictionary);
        wbytes(c, 2, h.d());
      }
    };
    zls = function(d, dict) {
      if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
        err(6, "invalid zlib data");
      if ((d[1] >> 5 & 1) == +!dict)
        err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
      return (d[1] >> 3 & 4) + 2;
    };
    td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
    tds = 0;
    try {
      td.decode(et, { stream: true });
      tds = 1;
    } catch (e) {
    }
  }
});

// ../artgen-core/src/lib/png.ts
function crc32(b) {
  let c = 4294967295;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(g) {
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, g.w);
  dv.setUint32(4, g.h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array(g.h * (g.w * 4 + 1));
  for (let y = 0; y < g.h; y++) raw.set(g.d.subarray(y * g.w * 4, (y + 1) * g.w * 4), y * (g.w * 4 + 1) + 1);
  const parts = [new Uint8Array(SIG), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function decodePNG(bytes) {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) throw new Error("not a PNG");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  for (let o = 8; o < bytes.length; ) {
    const len = dv.getUint32(o), t = String.fromCharCode(...bytes.subarray(o + 4, o + 8)), data = bytes.subarray(o + 8, o + 8 + len);
    if (t === "IHDR") {
      w = dv.getUint32(o + 8);
      h = dv.getUint32(o + 12);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (t === "PLTE") plte = data;
    else if (t === "tRNS") trns = data;
    else if (t === "IDAT") idat.push(data);
    else if (t === "IEND") break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG: depth ${depth}, interlace ${interlace}`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch) throw new Error(`unsupported PNG colour type ${type}`);
  const z = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let zo = 0;
  for (const p of idat) {
    z.set(p, zo);
    zo += p.length;
  }
  const raw = unzlibSync(z), stride = w * ch, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += a + b >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = v & 255;
    }
  }
  const g = new Grid(w, h);
  for (let p = 0; p < w * h; p++) {
    const s2 = p * ch, i = p * 4;
    if (type === 6) g.d.set(px.subarray(s2, s2 + 4), i);
    else if (type === 2) g.d.set([px[s2], px[s2 + 1], px[s2 + 2], 255], i);
    else if (type === 0) g.d.set([px[s2], px[s2], px[s2], 255], i);
    else if (type === 4) g.d.set([px[s2], px[s2], px[s2], px[s2 + 1]], i);
    else {
      const k = px[s2];
      if (!plte) throw new Error("palette PNG without PLTE");
      g.d.set([plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], i);
    }
  }
  return g;
}
function encodeAPNG(frames, delays, loops = 0) {
  if (!frames.length) throw new Error("encodeAPNG: no frames");
  const { w, h } = frames[0];
  for (const f of frames) if (f.w !== w || f.h !== h) throw new Error("encodeAPNG: frames differ in size");
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const actl = new Uint8Array(8), av = new DataView(actl.buffer);
  av.setUint32(0, frames.length);
  av.setUint32(4, loops);
  const parts = [new Uint8Array(SIG), chunk("IHDR", ihdr), chunk("acTL", actl)];
  let seq = 0;
  frames.forEach((g, i) => {
    const fc = new Uint8Array(26), fv = new DataView(fc.buffer);
    fv.setUint32(0, seq++);
    fv.setUint32(4, w);
    fv.setUint32(8, h);
    fv.setUint32(12, 0);
    fv.setUint32(16, 0);
    fv.setUint16(20, Math.max(1, Math.round(delays[i] ?? 100)));
    fv.setUint16(22, 1e3);
    fc[24] = 0;
    fc[25] = 0;
    parts.push(chunk("fcTL", fc));
    const raw = new Uint8Array(h * (w * 4 + 1));
    for (let y = 0; y < h; y++) raw.set(g.d.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
    const z = zlibSync(raw, { level: 9 });
    if (i === 0) parts.push(chunk("IDAT", z));
    else {
      const fd2 = new Uint8Array(4 + z.length);
      new DataView(fd2.buffer).setUint32(0, seq++);
      fd2.set(z, 4);
      parts.push(chunk("fdAT", fd2));
    }
  });
  parts.push(chunk("IEND", new Uint8Array()));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
var SIG, CRC;
var init_png = __esm({
  "../artgen-core/src/lib/png.ts"() {
    "use strict";
    init_esm();
    init_grid();
    SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    CRC = new Uint32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      return c >>> 0;
    });
  }
});

// ../artgen-core/src/lib/gif.ts
function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let size = minCode + 1, next = eoi + 1, dict = /* @__PURE__ */ new Map(), bits2 = 0, acc = 0;
  const emit = (code) => {
    acc |= code << bits2;
    bits2 += size;
    while (bits2 >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      bits2 -= 8;
    }
  };
  emit(clear);
  let cur = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key2 = cur + "," + k;
    if (dict.has(key2)) {
      cur = key2;
      continue;
    }
    emit(cur.includes(",") ? dict.get(cur) : +cur);
    if (next < 4096) {
      dict.set(key2, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = /* @__PURE__ */ new Map();
      size = minCode + 1;
      next = eoi + 1;
    }
    cur = String(k);
  }
  emit(cur.includes(",") ? dict.get(cur) : +cur);
  emit(eoi);
  if (bits2 > 0) out.push(acc & 255);
  return new Uint8Array(out);
}
function encodeGIF(frames, delays) {
  if (!frames.length) throw new Error("encodeGIF: no frames");
  const { w, h } = frames[0], colors = /* @__PURE__ */ new Map();
  for (const f of frames) {
    if (f.w !== w || f.h !== h) throw new Error("encodeGIF: frames differ in size");
    for (let i = 0; i < w * h; i++) if (f.d[i * 4 + 3] >= 128) {
      const c = f.d[i * 4] << 16 | f.d[i * 4 + 1] << 8 | f.d[i * 4 + 2];
      if (!colors.has(c)) {
        if (colors.size >= 255) throw new Error("encodeGIF: more than 255 colours");
        colors.set(c, colors.size + 1);
      }
    }
  }
  let bitsPer = 1;
  while (1 << bitsPer < colors.size + 1) bitsPer++;
  const tableSize = 1 << bitsPer, bytes = [];
  const u162 = (v) => bytes.push(v & 255, v >> 8 & 255);
  bytes.push(...[..."GIF89a"].map((c) => c.charCodeAt(0)));
  u162(w);
  u162(h);
  bytes.push(128 | bitsPer - 1, 0, 0);
  const table = new Array(tableSize * 3).fill(0);
  for (const [c, i] of colors) {
    table[i * 3] = c >> 16;
    table[i * 3 + 1] = c >> 8 & 255;
    table[i * 3 + 2] = c & 255;
  }
  bytes.push(...table);
  bytes.push(33, 255, 11, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  frames.forEach((f, k) => {
    bytes.push(33, 249, 4, 2 << 2 | 1);
    u162(Math.max(2, Math.round((delays[k] ?? 100) / 10)));
    bytes.push(0, 0);
    bytes.push(44);
    u162(0);
    u162(0);
    u162(w);
    u162(h);
    bytes.push(0);
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) idx[i] = f.d[i * 4 + 3] >= 128 ? colors.get(f.d[i * 4] << 16 | f.d[i * 4 + 1] << 8 | f.d[i * 4 + 2]) : 0;
    const minCode = Math.max(2, bitsPer), data = lzw(idx, minCode);
    bytes.push(minCode);
    for (let o = 0; o < data.length; o += 255) {
      const n = Math.min(255, data.length - o);
      bytes.push(n, ...data.subarray(o, o + n));
    }
    bytes.push(0);
  });
  bytes.push(59);
  return new Uint8Array(bytes);
}
var init_gif = __esm({
  "../artgen-core/src/lib/gif.ts"() {
    "use strict";
  }
});

// ../artgen-core/src/lib/palette.ts
var palette_exports = {};
__export(palette_exports, {
  extractPalette: () => extractPalette,
  generateRamp: () => generateRamp,
  medianCut: () => medianCut,
  parseGpl: () => parseGpl,
  parseHexPalette: () => parseHexPalette,
  rampsFromColors: () => rampsFromColors,
  restrict: () => restrict,
  swapColors: () => swapColors
});
function parseHexPalette(text2) {
  const out = [];
  for (const line of text2.split(/\r?\n/)) {
    const m = line.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) out.push("#" + m[1].toLowerCase());
  }
  return out;
}
function parseGpl(text2) {
  const out = [];
  for (const line of text2.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s|$)/);
    if (m) out.push(toHex(+m[1], +m[2], +m[3]));
  }
  return out;
}
function hueToward(h, target, amount) {
  const diff2 = (target - h + 540) % 360 - 180;
  return h + Math.sign(diff2) * Math.min(Math.abs(diff2), amount);
}
function generateRamp(base, { steps = 3, hueShift = 12, contrast = 0.45 } = {}) {
  const b = toHsl(base), out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1) * 2 - 1;
    const grey = b.s < 0.05;
    const h = grey ? b.h : hueToward(b.h, t < 0 ? 60 : 240, hueShift * Math.abs(t));
    const s2 = grey ? b.s : b.s * (t < 0 ? 1 - 0.25 * -t : 1 + 0.1 * t);
    const l = Math.max(0.04, Math.min(0.97, b.l - t * contrast / 2));
    out.push(fromHsl({ h, s: s2, l }));
  }
  return out;
}
function medianCut(g, n) {
  const px = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.d[i * 4 + 3] >= 128) px.push([g.d[i * 4], g.d[i * 4 + 1], g.d[i * 4 + 2]]);
  if (!px.length) return [];
  const boxes = [px];
  const range = (b, c) => {
    let lo = 255, hi = 0;
    for (const p of b) {
      if (p[c] < lo) lo = p[c];
      if (p[c] > hi) hi = p[c];
    }
    return hi - lo;
  };
  while (boxes.length < n) {
    let bi = -1, bc = 0, br = 0;
    boxes.forEach((b2, i) => {
      for (let c = 0; c < 3; c++) {
        const r = range(b2, c);
        if (b2.length > 1 && r > br) {
          br = r;
          bi = i;
          bc = c;
        }
      }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[bc] - q[bc]), mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  const out = boxes.map((b) => {
    const s2 = b.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
    return toHex(Math.round(s2[0] / b.length), Math.round(s2[1] / b.length), Math.round(s2[2] / b.length));
  });
  return [...new Set(out)];
}
function rampsFromColors(colors, { hueGap = 30, greySat = 0.12 } = {}) {
  const hs = colors.map((c) => ({ c, ...toHsl(c) }));
  const greys = hs.filter((x) => x.s < greySat), chroma = hs.filter((x) => x.s >= greySat).sort((a, b) => a.h - b.h);
  const groups = [];
  for (const x of chroma) {
    const last = groups[groups.length - 1];
    if (last && x.h - last[last.length - 1].h <= hueGap) last.push(x);
    else groups.push([x]);
  }
  if (groups.length > 1) {
    const first = groups[0], last = groups[groups.length - 1];
    if (first[0].h + 360 - last[last.length - 1].h <= hueGap) {
      first.unshift(...last);
      groups.pop();
    }
  }
  if (greys.length) groups.push(greys);
  const ramps = {};
  groups.forEach((g, i) => {
    ramps[`r${i}`] = g.map((x) => x.c).sort((a, b) => lumaOf(b) - lumaOf(a));
  });
  return ramps;
}
function extractPalette(g, n = 16) {
  const colors = medianCut(g, n);
  return { colors, ramps: rampsFromColors(colors) };
}
function restrict(ramps, names, extra = []) {
  const keys = names ?? Object.keys(ramps), out = [];
  for (const k of keys) {
    const r = ramps[k];
    if (!r) throw new Error(`unknown ramp: ${k}`);
    out.push(...r.map(normHex));
  }
  out.push(...extra.map(normHex));
  return [...new Set(out)];
}
function swapColors(g, map) {
  const m = new Map(Object.entries(map).map(([a, b]) => [normHex(a), parseColor(b)]));
  const out = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.get(x, y), to = c && m.get(c);
    if (to) {
      const i = (y * g.w + x) * 4;
      out.d[i] = to[0];
      out.d[i + 1] = to[1];
      out.d[i + 2] = to[2];
    }
  }
  return out;
}
var init_palette = __esm({
  "../artgen-core/src/lib/palette.ts"() {
    "use strict";
    init_color();
  }
});

// ../artgen-core/src/lib/font.ts
function drawText(g, x, y, text2, color, scale2 = 1) {
  let cx = x;
  for (const ch of text2.toUpperCase()) {
    const rows = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < GLYPH_H; r++) {
      const bits2 = +rows[r];
      for (let c = 0; c < GLYPH_W; c++) if (bits2 & 4 >> c) g.fill(cx + c * scale2, y + r * scale2, scale2, scale2, color);
    }
    cx += (GLYPH_W + 1) * scale2;
  }
}
var GLYPHS, GLYPH_W, GLYPH_H, textWidth;
var init_font = __esm({
  "../artgen-core/src/lib/font.ts"() {
    "use strict";
    GLYPHS = {
      "0": "75557",
      "1": "26227",
      "2": "71747",
      "3": "71317",
      "4": "55711",
      "5": "74717",
      "6": "74757",
      "7": "71122",
      "8": "75757",
      "9": "75717",
      A: "25755",
      B: "65656",
      C: "34443",
      D: "65556",
      E: "74647",
      F: "74644",
      G: "34553",
      H: "55755",
      I: "72227",
      J: "11152",
      K: "55655",
      L: "44447",
      M: "57755",
      N: "65555",
      O: "25552",
      P: "65644",
      Q: "25563",
      R: "65655",
      S: "34216",
      T: "72222",
      U: "55557",
      V: "55552",
      W: "55775",
      X: "55255",
      Y: "55222",
      Z: "71247",
      " ": "00000",
      ".": "00002",
      ",": "00024",
      ":": "02020",
      ";": "02024",
      "-": "00700",
      "+": "02720",
      _: "00007",
      "/": "11244",
      "|": "22222",
      "(": "12221",
      ")": "42224",
      "[": "64446",
      "]": "31113",
      "%": "51245",
      "=": "07070",
      "#": "57575",
      "?": "71302",
      "!": "22202",
      "'": "22000",
      '"': "55000",
      "<": "12421",
      ">": "42124",
      "*": "52725",
      "@": "75747",
      "&": "25257",
      $: "36763",
      "^": "25000",
      "~": "03600"
    };
    GLYPH_W = 3;
    GLYPH_H = 5;
    textWidth = (text2, scale2 = 1) => Math.max(0, text2.length * (GLYPH_W + 1) - 1) * scale2;
  }
});

// ../artgen-core/src/lib/post.ts
var post_exports = {};
__export(post_exports, {
  despeckle: () => despeckle,
  dropShadow: () => dropShadow,
  modeDownsample: () => modeDownsample,
  outline: () => outline,
  quantize: () => quantize,
  selout: () => selout
});
function outline(g, color, diag = false) {
  const out = g.clone(), nb = diag ? N8 : N4;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) > 127) continue;
    if (nb.some(([dx, dy]) => g.alpha(x + dx, y + dy) > 200)) out.set(x, y, color);
  }
  return out;
}
function selout(g, ramps, fallback) {
  const darkest = /* @__PURE__ */ new Map();
  for (const r of ramps) for (const c of r) darkest.set(normHex(c), normHex(r[r.length - 1]));
  const out = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) > 127) continue;
    const n = N4.find(([dx, dy]) => g.alpha(x + dx, y + dy) > 200);
    if (!n) continue;
    const c = g.get(x + n[0], y + n[1]);
    out.set(x, y, darkest.get(c) ?? fallback);
  }
  return out;
}
function quantize(g, pal, { alphaCut = 128, dither = "none" } = {}) {
  const P2 = pal.map(parseColor), out = new Grid(g.w, g.h), m = BAYER[dither];
  for (let i = 0; i < g.w * g.h; i++) {
    const a = g.d[i * 4 + 3];
    if (a < alphaCut) continue;
    const r = g.d[i * 4], gg = g.d[i * 4 + 1], b = g.d[i * 4 + 2];
    let best = 0, bd = 1e9, second = 0, sd = 1e9;
    for (let k2 = 0; k2 < P2.length; k2++) {
      const d = dist2(P2[k2], r, gg, b);
      if (d < bd) {
        second = best;
        sd = bd;
        bd = d;
        best = k2;
      } else if (d < sd) {
        sd = d;
        second = k2;
      }
    }
    let k = best;
    if (m && P2.length > 1) {
      const x = i % g.w, y = i / g.w | 0, t = Math.sqrt(bd) / (Math.sqrt(bd) + Math.sqrt(sd) || 1);
      if (t > m[y % m.length][x % m.length]) k = second;
    }
    out.d.set([P2[k][0], P2[k][1], P2[k][2], 255], i * 4);
  }
  return out;
}
function modeDownsample(g, f) {
  const out = new Grid(Math.floor(g.w / f), Math.floor(g.h / f));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const counts = /* @__PURE__ */ new Map();
    let empty = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const c = g.get(x * f + i, y * f + j);
      if (!c) {
        empty++;
        continue;
      }
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    if (empty > f * f / 2) continue;
    let best = null, bn = 0;
    for (const [c, n] of counts) if (n > bn) {
      bn = n;
      best = c;
    }
    out.set(x, y, best);
  }
  return out;
}
function dropShadow(g, dx, dy, color) {
  const out = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x - dx, y - dy) > 200) out.set(x, y, color);
  return out.stamp(g);
}
function despeckle(g) {
  const out = g.clone();
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const c = g.get(x, y);
    if (!c) continue;
    const n = [g.get(x + 1, y), g.get(x - 1, y), g.get(x, y + 1), g.get(x, y - 1)];
    if (n.every((v) => v && v !== c) && n[0] === n[1] && n[1] === n[2]) out.set(x, y, n[0]);
  }
  return out;
}
var N4, N8, BAYER;
var init_post = __esm({
  "../artgen-core/src/lib/post.ts"() {
    "use strict";
    init_color();
    init_grid();
    N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    N8 = [...N4, [1, 1], [-1, -1], [1, -1], [-1, 1]];
    BAYER = {
      bayer2: [[0, 2], [3, 1]].map((r) => r.map((v) => (v + 0.5) / 4)),
      bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16))
    };
  }
});

// ../artgen-core/src/lib/prim.ts
function mirrorSpec(s2, ax, ay) {
  const m = { ...s2, pts: s2.pts?.map((p) => [...p]), mirrorX: void 0, mirrorY: void 0 };
  const fx = (v) => ax != null ? 2 * ax - v : v, fy = (v) => ay != null ? 2 * ay - v : v;
  if (s2.type === "ellipse") {
    m.cx = fx(s2.cx ?? 0);
    m.cy = fy(s2.cy ?? 0);
  }
  if (s2.type === "rect") {
    if (ax != null) m.x = 2 * ax - (s2.x ?? 0) - (s2.w ?? 1);
    if (ay != null) m.y = 2 * ay - (s2.y ?? 0) - (s2.h ?? 1);
  }
  if (s2.type === "poly") m.pts = (s2.pts ?? []).map(([x, y]) => [fx(x), fy(y)]);
  if (s2.type === "line") {
    m.x0 = Math.round(fx((s2.x0 ?? 0) + 0.5) - 0.5);
    m.x1 = Math.round(fx((s2.x1 ?? 0) + 0.5) - 0.5);
    m.y0 = Math.round(fy((s2.y0 ?? 0) + 0.5) - 0.5);
    m.y1 = Math.round(fy((s2.y1 ?? 0) + 0.5) - 0.5);
  }
  return m;
}
function bandRamp(mat, bands) {
  if (bands >= mat.length || bands < 1) return mat;
  if (bands === 1) return [mat[Math.floor(mat.length / 2)]];
  return Array.from({ length: bands }, (_, i) => mat[Math.round(i * (mat.length - 1) / (bands - 1))]);
}
var N42, R, Scene;
var init_prim = __esm({
  "../artgen-core/src/lib/prim.ts"() {
    "use strict";
    init_grid();
    init_post();
    N42 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    R = {
      ellipse({ cx = 0, cy = 0, rx = 1, ry = 1 }) {
        const out = [];
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) out.push([x, y]);
          }
        return out;
      },
      rect({ x = 0, y = 0, w = 1, h = 1, r = 0 }) {
        const out = [];
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          if (r) {
            const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j);
            if (cx < r && cy < r && r - cx + (r - cy) > r + 1) continue;
          }
          out.push([x + i, y + j]);
        }
        return out;
      },
      poly({ pts = [] }) {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), out = [];
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
          for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
            const px = x + 0.5, py = y + 0.5;
            let ins = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const [xi, yi] = pts[i], [xj, yj] = pts[j];
              if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
            }
            if (ins) out.push([x, y]);
          }
        return out;
      },
      line({ x0 = 0, y0 = 0, x1 = 0, y1 = 0, w = 1 }) {
        const out = [];
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx + dy;
        for (; ; ) {
          for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) out.push([x0 + i, y0 + j]);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * e;
          if (e2 >= dy) {
            e += dy;
            x0 += sx;
          }
          if (e2 <= dx) {
            e += dx;
            y0 += sy;
          }
        }
        return out;
      }
    };
    Scene = class {
      w;
      h;
      shapes = [];
      light;
      bands;
      outlineColor;
      shadowColor;
      applyLine;
      constructor(w, h, opts = {}) {
        this.w = w;
        this.h = h;
        this.light = [Math.sign(opts.light?.[0] ?? -1), Math.sign(opts.light?.[1] ?? -1)];
        this.bands = opts.bands ?? 99;
        this.outlineColor = opts.outlineColor;
        this.shadowColor = opts.shadowColor;
        this.applyLine = opts.applyLine;
      }
      add(spec) {
        this.shapes.push(spec);
        if (spec.mirrorX != null) this.shapes.push(mirrorSpec(spec, spec.mirrorX));
        if (spec.mirrorY != null) this.shapes.push(mirrorSpec(spec, null, spec.mirrorY));
        return this;
      }
      addAll(list) {
        list.forEach((s2) => this.add(s2));
        return this;
      }
      /** Shade modes: 'flat' | 'bevel' (edge light/dark) | 'sphere' (normal bands) | 'cyl' (bands across one axis). */
      shadeColor(s2, x, y, set) {
        const mat = bandRamp(Array.isArray(s2.mat) ? s2.mat : [s2.mat ?? "#ff00ff"], this.bands);
        if (mat.length === 1 || s2.shade === "flat") return mat[Math.min(1, mat.length - 1)] || mat[0];
        const [lx, ly] = this.light, last = mat.length - 1;
        if (s2.shade === "sphere" && s2.type === "ellipse") {
          const nx = (x + 0.5 - (s2.cx ?? 0)) / (s2.rx ?? 1), ny = (y + 0.5 - (s2.cy ?? 0)) / (s2.ry ?? 1);
          const d = (nx * lx + ny * ly) / Math.SQRT2;
          if (s2.rim && nx * nx + ny * ny > s2.rim) return mat[last];
          return mat[Math.max(0, Math.min(last, Math.round((1 - (d + 1) / 2) * last)))];
        }
        if (s2.shade === "cyl") {
          const t = s2.axis === "x" ? (y + 0.5 - (s2.y ?? 0)) / (s2.h ?? 1) : (x + 0.5 - (s2.x ?? 0)) / (s2.w ?? 1);
          return mat[Math.max(0, Math.min(last, Math.floor(t * (last + 1))))];
        }
        const has = (a, b) => set.has(a + "," + b);
        const lit = !has(x + lx, y) || !has(x, y + ly), dark = !has(x - lx, y) || !has(x, y - ly);
        if (lit && !dark) return mat[0];
        if (dark && !lit) return mat[last];
        return mat[Math.min(1, last)];
      }
      render({ outline: outline2 = true, outlineColor = this.outlineColor, shadow = null, shadowColor = this.shadowColor } = {}) {
        let g = new Grid(this.w, this.h);
        for (const s2 of this.shapes) {
          const px = R[s2.type](s2), set = new Set(px.map((p) => p[0] + "," + p[1])), buf = [];
          for (const [x, y] of px) {
            let c = s2.color || this.shadeColor(s2, x, y, set);
            if (s2.pattern) c = s2.pattern(x, y, c) || c;
            if (s2.ink && N42.some(([dx, dy]) => !set.has(x + dx + "," + (y + dy)) && g.alpha(x + dx, y + dy) > 200)) c = s2.ink;
            if (s2.inkAll && N42.some(([dx, dy]) => !set.has(x + dx + "," + (y + dy)))) c = s2.inkAll;
            buf.push([x, y, c]);
          }
          for (const [x, y, c] of buf) g.set(x, y, c);
        }
        if (outline2 && this.applyLine && outlineColor === this.outlineColor) g = this.applyLine(g);
        else if (outline2) {
          if (!outlineColor) throw new Error("Scene.render: outline colour missing (pass it or build the scene from ctx.lib.prim)");
          g = outline(g, outlineColor);
        }
        if (shadow) {
          if (!shadowColor) throw new Error("Scene.render: shadow colour missing");
          g = dropShadow(g, shadow[0], shadow[1], shadowColor);
        }
        return g;
      }
    };
  }
});

// ../artgen-core/src/lib/blit.ts
var blit_exports = {};
__export(blit_exports, {
  blit: () => blit,
  blitMirrored: () => blitMirrored,
  shadeSide: () => shadeSide
});
function blit(g, rows, key2, ox = 0, oy = 0) {
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== ".") g.set(ox + x, oy + y, key2[ch]);
  }));
  return g;
}
function blitMirrored(g, half, key2, oy = 0) {
  half.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== ".") {
      g.set(x, oy + y, key2[ch]);
      g.set(g.w - 1 - x, oy + y, key2[ch]);
    }
  }));
  return g;
}
function shadeSide(g, { light, outline: outline2, darker }) {
  const src = g.clone(), right = (light[0] ?? -1) <= 0, half = g.w >> 1;
  const [x0, x1, dx] = right ? [half, g.w - 2, 1] : [1, half - 1, -1];
  for (let y = 0; y < g.h; y++) for (let x = x0; x <= x1; x++) {
    const c = src.get(x, y);
    if (c && src.get(x + dx, y) === outline2 && darker[c]) g.set(x, y, darker[c]);
  }
  return g;
}
var init_blit = __esm({
  "../artgen-core/src/lib/blit.ts"() {
    "use strict";
  }
});

// ../artgen-core/src/lib/iso.ts
var iso_exports = {};
__export(iso_exports, {
  P: () => P,
  boxFaces: () => boxFaces,
  groundShadow: () => groundShadow,
  isoFloor: () => isoFloor
});
function boxFaces(x, y, z, w, d, h, ox = 0, oy = 0) {
  const p = (a, b, c) => P(a, b, c, ox, oy);
  return {
    top: [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)],
    left: [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)],
    right: [p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)]
  };
}
function groundShadow(g, cx, cy, rx, color) {
  const ry = rx / 2;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g.set(x, y, color);
  return g;
}
function isoFloor(w, h, { a = "#545060", b = "#4a4452", seam = "#23202a" } = {}) {
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.floor((x / 2 + (y + 4)) / 16), v = Math.floor((-x / 2 + (y + 4)) / 16);
    const e = (x / 2 + y + 4) % 16 < 1 || (-x / 2 + y + 4 + 1024) % 16 < 1;
    g.set(x, y, e ? seam : (u + v) % 2 ? b : a);
  }
  return g;
}
var P;
var init_iso = __esm({
  "../artgen-core/src/lib/iso.ts"() {
    "use strict";
    init_grid();
    P = (x, y, z, ox = 0, oy = 0) => [ox + (x - y) * 2, oy + (x + y) - z * 2];
  }
});

// ../artgen-core/src/lib/voxel.ts
function need(v, name) {
  if (!v) throw new Error(`voxel render: ${name} missing (build models from ctx.lib.voxel so direction colours apply)`);
  return v;
}
var face, Voxels;
var init_voxel = __esm({
  "../artgen-core/src/lib/voxel.ts"() {
    "use strict";
    init_grid();
    init_iso();
    init_post();
    face = (m, hi) => [m[0], m[1], m[2] || m[1], hi];
    Voxels = class {
      m = /* @__PURE__ */ new Map();
      k;
      defaults;
      thick = 1;
      /**
       * k = voxels per model unit: author in coarse units, get k-times finer voxels.
       * Outline/shadow colours and the outer-line pass are render defaults (ctx.lib.voxel.model() fills them from
       * the direction); an explicit `outlineColor` option draws a plain outline instead.
       */
      constructor({ k = 1, outlineColor, shadowColor, applyLine } = {}) {
        this.k = k;
        this.defaults = { outlineColor, shadowColor, applyLine };
      }
      outerLine(g, outlineColor) {
        if (this.defaults.applyLine && outlineColor === this.defaults.outlineColor) return this.defaults.applyLine(g);
        return outline(g, need(outlineColor, "outlineColor"));
      }
      set(x, y, z, ramp) {
        x = Math.round(x);
        y = Math.round(y);
        z = Math.round(z);
        if (ramp) this.m.set(`${x},${y},${z}`, [x, y, z, ramp]);
        else this.m.delete(`${x},${y},${z}`);
        return this;
      }
      has(x, y, z) {
        return this.m.has(`${x},${y},${z}`);
      }
      box(x0, y0, z0, x1, y1, z1, ramp) {
        const k = this.k;
        [x0, y0, z0] = [x0, y0, z0].map((v) => Math.round(v * k));
        [x1, y1, z1] = [x1, y1, z1].map((v) => Math.round((v + 1) * k) - 1);
        for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, ramp);
        return this;
      }
      ellipsoid(cx, cy, cz, rx, ry, rz, ramp) {
        const k = this.k;
        [cx, cy, cz, rx, ry, rz] = [cx, cy, cz, rx, ry, rz].map((v) => v * k);
        if (k > 1) {
          cx += (k - 1) / 2;
          cy += (k - 1) / 2;
          cz += (k - 1) / 2;
        }
        for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) this.set(x, y, z, ramp);
        return this;
      }
      line(a, b, ramp) {
        const k = this.k, [x0, y0, z0] = a.map((v) => v * k), [x1, y1, z1] = b.map((v) => v * k);
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)) || 1;
        for (let i = 0; i <= n; i++) {
          const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n, pz = z0 + (z1 - z0) * i / n;
          for (let c = 0; c < Math.max(1, this.thick || 1); c++) this.set(px + (c & 1), py + (c >> 1 & 1), pz, ramp);
        }
        return this;
      }
      /** Recolour voxels: `fn` returns a new face ramp or nothing to keep the voxel as is. */
      paint(fn) {
        for (const v of this.m.values()) {
          const r = fn(v[0], v[1], v[2], v[3]);
          if (r) v[3] = r;
        }
        return this;
      }
      render(w, h, options) {
        const opts = { ...this.defaults, ...options }, ss = opts.ss || 1;
        if (ss === 1) return this.renderCubes(w, h, opts);
        const big = this.renderCubes(w * ss, h * ss, { ...opts, ox: opts.ox * ss, oy: opts.oy * ss, outline: false, shadow: false });
        let g = modeDownsample(big, ss);
        if (opts.shadowAt) {
          const s2 = new Grid(w, h);
          groundShadow(s2, ...opts.shadowAt, need(opts.shadowColor, "shadowColor"));
          g = s2.stamp(g);
        }
        return opts.outline === false ? g : this.outerLine(g, opts.outlineColor);
      }
      /** The artlab 4×4 iso cube stamp renderer. */
      renderCubes(w, h, options) {
        const { ox, oy, outline: outline2 = true, outlineColor, shadow = true, shadowColor, edgeLight = true } = { ...this.defaults, ...options };
        let g = new Grid(w, h);
        const vs = [...this.m.values()].sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
        if (shadow) {
          const xs = vs.filter((v) => v[2] === 0);
          if (xs.length) {
            const sh = new Grid(w, h);
            for (const [x, y] of xs) {
              const sx = ox + (x - y) * 2, sy = oy + (x + y) + 2;
              for (let j = -1; j < 3; j++) for (let i = -3; i < 3; i++) sh.set(sx + i, sy + j, "#000000");
            }
            const sc = need(shadowColor, "shadowColor");
            for (let i = 0; i < w * h; i++) if (sh.d[i * 4 + 3]) g.set(i % w, Math.floor(i / w), sc);
          }
        }
        for (const [x, y, z, r] of vs) {
          const sx = ox + (x - y) * 2 - 2, sy = oy + (x + y) - z * 2, T = r[0], L = r[1], Rt = r[2] || r[1];
          const topLit = edgeLight && !this.has(x, y, z + 1) && (!this.has(x - 1, y, z) || !this.has(x, y - 1, z));
          for (let i = 0; i < 4; i++) {
            g.set(sx + i, sy, T);
            g.set(sx + i, sy + 1, T);
          }
          if (topLit && !this.has(x, y - 1, z + 1)) {
            g.set(sx + 1, sy, r[3] || T);
            g.set(sx + 2, sy, r[3] || T);
          }
          for (let j = 2; j < 4; j++) {
            g.set(sx, sy + j, L);
            g.set(sx + 1, sy + j, L);
            g.set(sx + 2, sy + j, Rt);
            g.set(sx + 3, sy + j, Rt);
          }
        }
        if (outline2) g = this.outerLine(g, outlineColor);
        return g;
      }
    };
  }
});

// ../../node_modules/@resvg/resvg-wasm/index.mjs
function addHeapObject(obj2) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj2;
  return idx;
}
function getObject(idx) {
  return heap[idx];
}
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj2 = getObject(arg1);
    const ret = typeof obj2 === "string" ? obj2 : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
function __wbg_init_memory(imports, maybe_memory) {
}
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}
var wasm, heap, heap_next, WASM_VECTOR_LEN, cachedUint8Memory0, cachedTextEncoder, encodeString, cachedInt32Memory0, cachedTextDecoder, BBoxFinalization, BBox, RenderedImageFinalization, RenderedImage, ResvgFinalization, Resvg, dist_default, initialized, initWasm, Resvg2;
var init_resvg_wasm = __esm({
  "../../node_modules/@resvg/resvg-wasm/index.mjs"() {
    heap = new Array(128).fill(void 0);
    heap.push(void 0, null, true, false);
    heap_next = heap.length;
    WASM_VECTOR_LEN = 0;
    cachedUint8Memory0 = null;
    cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: () => {
      throw Error("TextEncoder not available");
    } };
    encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
      return cachedTextEncoder.encodeInto(arg, view);
    } : function(arg, view) {
      const buf = cachedTextEncoder.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
    cachedInt32Memory0 = null;
    cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: () => {
      throw Error("TextDecoder not available");
    } };
    if (typeof TextDecoder !== "undefined") {
      cachedTextDecoder.decode();
    }
    BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
    BBox = class _BBox {
      static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj2 = Object.create(_BBox.prototype);
        obj2.__wbg_ptr = ptr;
        BBoxFinalization.register(obj2, obj2.__wbg_ptr, obj2);
        return obj2;
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BBoxFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bbox_free(ptr);
      }
      /**
      * @returns {number}
      */
      get x() {
        const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set x(arg0) {
        wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get y() {
        const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set y(arg0) {
        wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get width() {
        const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set width(arg0) {
        wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
      }
      /**
      * @returns {number}
      */
      get height() {
        const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
        return ret;
      }
      /**
      * @param {number} arg0
      */
      set height(arg0) {
        wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
      }
    };
    RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
    RenderedImage = class _RenderedImage {
      static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj2 = Object.create(_RenderedImage.prototype);
        obj2.__wbg_ptr = ptr;
        RenderedImageFinalization.register(obj2, obj2.__wbg_ptr, obj2);
        return obj2;
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RenderedImageFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_renderedimage_free(ptr);
      }
      /**
      * Get the PNG width
      * @returns {number}
      */
      get width() {
        const ret = wasm.renderedimage_width(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
      * Get the PNG height
      * @returns {number}
      */
      get height() {
        const ret = wasm.renderedimage_height(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
      * Write the image data to Uint8Array
      * @returns {Uint8Array}
      */
      asPng() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return takeObject(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Get the RGBA pixels of the image
      * @returns {Uint8Array}
      */
      get pixels() {
        const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
        return takeObject(ret);
      }
    };
    ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
    Resvg = class {
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResvgFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resvg_free(ptr);
      }
      /**
      * @param {Uint8Array | string} svg
      * @param {string | undefined} [options]
      * @param {Array<any> | undefined} [custom_font_buffers]
      */
      constructor(svg, options, custom_font_buffers) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
          var len0 = WASM_VECTOR_LEN;
          wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          this.__wbg_ptr = r0 >>> 0;
          return this;
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Get the SVG width
      * @returns {number}
      */
      get width() {
        const ret = wasm.resvg_width(this.__wbg_ptr);
        return ret;
      }
      /**
      * Get the SVG height
      * @returns {number}
      */
      get height() {
        const ret = wasm.resvg_height(this.__wbg_ptr);
        return ret;
      }
      /**
      * Renders an SVG in Wasm
      * @returns {RenderedImage}
      */
      render() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_render(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return RenderedImage.__wrap(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * Output usvg-simplified SVG string
      * @returns {string}
      */
      toString() {
        let deferred1_0;
        let deferred1_1;
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_toString(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          deferred1_0 = r0;
          deferred1_1 = r1;
          return getStringFromWasm0(r0, r1);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
          wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
      }
      /**
      * Calculate a maximum bounding box of all visible elements in this SVG.
      *
      * Note: path bounding box are approx values.
      * @returns {BBox | undefined}
      */
      innerBBox() {
        const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
        return ret === 0 ? void 0 : BBox.__wrap(ret);
      }
      /**
      * Calculate a maximum bounding box of all visible elements in this SVG.
      * This will first apply transform.
      * Similar to `SVGGraphicsElement.getBBox()` DOM API.
      * @returns {BBox | undefined}
      */
      getBBox() {
        const ret = wasm.resvg_getBBox(this.__wbg_ptr);
        return ret === 0 ? void 0 : BBox.__wrap(ret);
      }
      /**
      * Use a given `BBox` to crop the svg. Currently this method simply changes
      * the viewbox/size of the svg and do not move the elements for simplicity
      * @param {BBox} bbox
      */
      cropByBBox(bbox2) {
        _assertClass(bbox2, BBox);
        wasm.resvg_cropByBBox(this.__wbg_ptr, bbox2.__wbg_ptr);
      }
      /**
      * @returns {Array<any>}
      */
      imagesToResolve() {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          var r2 = getInt32Memory0()[retptr / 4 + 2];
          if (r2) {
            throw takeObject(r1);
          }
          return takeObject(r0);
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
      /**
      * @param {string} href
      * @param {Uint8Array} buffer
      */
      resolveImage(href, buffer) {
        try {
          const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
          const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
          const len0 = WASM_VECTOR_LEN;
          wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
          var r0 = getInt32Memory0()[retptr / 4 + 0];
          var r1 = getInt32Memory0()[retptr / 4 + 1];
          if (r1) {
            throw takeObject(r0);
          }
        } finally {
          wasm.__wbindgen_add_to_stack_pointer(16);
        }
      }
    };
    dist_default = __wbg_init;
    initialized = false;
    initWasm = async (module_or_path) => {
      if (initialized) {
        throw new Error("Already initialized. The `initWasm()` function can be used only once.");
      }
      await dist_default(await module_or_path);
      initialized = true;
    };
    Resvg2 = class extends Resvg {
      /**
       * @param {Uint8Array | string} svg
       * @param {ResvgRenderOptions | undefined} options
       */
      constructor(svg, options) {
        if (!initialized)
          throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
        const font = options?.font;
        if (!!font && isCustomFontsOptions(font)) {
          const serializableOptions = {
            ...options,
            font: {
              ...font,
              fontBuffers: void 0
            }
          };
          super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
        } else {
          super(svg, JSON.stringify(options));
        }
      }
    };
  }
});

// ../artgen-core/src/lib/svg.ts
function initSvg(wasm2) {
  ready ??= initWasm(wasm2).then(() => {
    initialised = true;
  });
  return ready;
}
function rasterizeSvg(svg, w, h) {
  if (!initialised) throw new Error("SVG rasteriser not initialised: call initSvg(wasm) first");
  const r = new Resvg2(svg, { fitTo: { mode: "width", value: w }, font: { loadSystemFonts: false } });
  const img = r.render(), px = img.pixels, iw = img.width, ih = img.height, g = new Grid(w, h);
  for (let y = 0; y < Math.min(h, ih); y++) for (let x = 0; x < Math.min(w, iw); x++) {
    const s2 = (y * iw + x) * 4, a = px[s2 + 3];
    if (!a) continue;
    const i = (y * w + x) * 4;
    g.d[i] = px[s2] * 255 / a;
    g.d[i + 1] = px[s2 + 1] * 255 / a;
    g.d[i + 2] = px[s2 + 2] * 255 / a;
    g.d[i + 3] = a;
  }
  img.free();
  r.free();
  return g;
}
function svgToGrid(svg, w, h, { mode = "raw", ss = 8, pal, outline: outline2, shadow, shadowColor, stage } = {}) {
  let g;
  const need2 = () => {
    if (!pal?.length) throw new Error(`svgToGrid: mode '${mode}' needs a palette`);
    return pal;
  };
  if (mode === "raw") {
    g = rasterizeSvg(svg, w, h);
    stage?.("raster", g);
  } else if (mode === "crisp") {
    const r = rasterizeSvg(svg, w, h);
    stage?.("raster", r);
    g = quantize(r, need2());
    stage?.("quantize", g);
  } else {
    const r = rasterizeSvg(svg, w * ss, h * ss);
    stage?.("raster", r);
    const q = quantize(r, need2());
    stage?.("quantize", q);
    g = modeDownsample(q, ss);
    stage?.("downsample", g);
  }
  if (outline2) {
    g = outline(g, outline2);
    stage?.("outline", g);
  }
  if (shadow) {
    if (!shadowColor) throw new Error("svgToGrid: shadow needs shadowColor");
    g = dropShadow(g, shadow[0], shadow[1], shadowColor);
    stage?.("shadow", g);
  }
  return g;
}
var ready, initialised, doc;
var init_svg = __esm({
  "../artgen-core/src/lib/svg.ts"() {
    "use strict";
    init_resvg_wasm();
    init_grid();
    init_post();
    ready = null;
    initialised = false;
    doc = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
  }
});

// ../artgen-core/src/direction.ts
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === void 0 ? clone(base) : over;
  const out = clone(base);
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}
function validateDirection(input) {
  const errors = [];
  if (!isObj(input)) return { ok: false, errors: ["direction: must be an object"] };
  const d = merge(DEFAULTS, input);
  const err2 = (path, msg) => errors.push(`${path}: ${msg}`);
  const oneOf = (path, v, opts) => {
    if (!opts.includes(v)) err2(path, `must be one of ${opts.join(" | ")} (got ${JSON.stringify(v)})`);
  };
  const num2 = (path, v, min = -Infinity, max2 = Infinity, int = false) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max2 || int && !Number.isInteger(v)) err2(path, `must be ${int ? "an integer" : "a number"} in [${min}, ${max2}]`);
  };
  const strs2 = (path, v) => {
    if (!Array.isArray(v) || v.some((s2) => typeof s2 !== "string")) err2(path, "must be an array of strings");
  };
  const size = (path, v) => {
    if (typeof v === "number") num2(path, v, 1, 4096, true);
    else if (Array.isArray(v) && v.length === 2) v.forEach((n, i) => num2(`${path}[${i}]`, n, 1, 4096, true));
    else err2(path, "must be a positive integer or [w, h]");
  };
  if (typeof d.id !== "string" || !d.id) err2("id", "required string");
  num2("version", d.version, 1, Infinity, true);
  oneOf("status", d.status, ["draft", "candidate", "locked"]);
  const cam = d.camera;
  if (!isObj(cam)) err2("camera", "required object");
  else {
    oneOf("camera.view", d.camera.view, VIEWS);
    if (!Array.isArray(d.camera.light) || d.camera.light.length !== 3) err2("camera.light", "must be [x, y, z]");
    else d.camera.light.forEach((n, i) => num2(`camera.light[${i}]`, n));
    oneOf("camera.directions", d.camera.directions, [1, 4, 8, 16]);
    num2("camera.pixelScale", d.camera.pixelScale, 1, 16, true);
    if (d.camera.iso !== void 0) size("camera.iso.tile", d.camera.iso.tile);
    if (d.camera.oblique !== void 0) num2("camera.oblique.frontRatio", d.camera.oblique.frontRatio, 0, 1);
  }
  if (!isObj(d.scale)) err2("scale", "must be an object");
  else for (const [k, v] of Object.entries(d.scale)) if (k === "metre") num2("scale.metre", v, 0.1, 1e3);
  else if (k !== "proportions") size(`scale.${k}`, v);
  const p = d.palette;
  if (!isObj(d.palette)) err2("palette", "required object");
  else {
    if (!isObj(p.ramps) || !Object.keys(p.ramps).length) err2("palette.ramps", "required, at least one ramp");
    else for (const [k, r] of Object.entries(p.ramps)) {
      if (!RAMP_NAME.test(k) || RESERVED.has(k)) err2(`palette.ramps.${k}`, 'ramp names are identifiers and not "outline"/"shadow"');
      if (!Array.isArray(r) || !r.length) err2(`palette.ramps.${k}`, "must be a non-empty array of #rrggbb");
      else r.forEach((c, i) => {
        if (typeof c !== "string" || !HEX.test(c)) err2(`palette.ramps.${k}[${i}]`, `must be #rrggbb (got ${JSON.stringify(c)})`);
      });
    }
    if (typeof p.outline !== "string" || !HEX.test(p.outline)) err2("palette.outline", "required #rrggbb");
    if (!isObj(p.shadow) || typeof p.shadow.color !== "string" || !HEX.test(p.shadow.color)) err2("palette.shadow.color", "must be #rrggbb");
    else num2("palette.shadow.alpha", p.shadow.alpha, 0, 1);
    const ramps = isObj(p.ramps) ? p.ramps : {};
    const known = (path, name) => {
      if (typeof name !== "string" || !(name in ramps)) err2(path, `unknown ramp ${JSON.stringify(name)}`);
    };
    if (isObj(p.materials)) for (const [k, v] of Object.entries(p.materials)) known(`palette.materials.${k}`, v);
    else err2("palette.materials", "must be an object");
    if (isObj(p.perKind)) for (const [k, v] of Object.entries(p.perKind)) {
      if (!Array.isArray(v)) err2(`palette.perKind.${k}`, "must be an array of ramp names");
      else v.forEach((n, i) => known(`palette.perKind.${k}[${i}]`, n));
    }
    else err2("palette.perKind", "must be an object");
    if (isObj(p.perKindMax)) for (const [k, v] of Object.entries(p.perKindMax)) num2(`palette.perKindMax.${k}`, v, 1, 256, true);
    else err2("palette.perKindMax", "must be an object");
    if (p.maxColors !== void 0) {
      num2("palette.maxColors", p.maxColors, 1, 256, true);
      if (isObj(p.ramps) && !errors.some((e) => e.startsWith("palette.ramps"))) {
        const n = new Set(Object.values(p.ramps).flat().map((c) => c.toLowerCase())).size;
        if (n > p.maxColors) err2("palette.maxColors", `ramps hold ${n} colours, more than ${p.maxColors}`);
      }
    }
    if (isObj(d.effects)) {
      strs2("effects.palette", d.effects.palette);
      if (Array.isArray(d.effects.palette)) d.effects.palette.forEach((n, i) => known(`effects.palette[${i}]`, n));
    }
  }
  oneOf("line.outer", d.line?.outer, ["dark", "selout", "none"]);
  oneOf("line.inner", d.line?.inner, ["none", "selective", "all"]);
  num2("line.weight", d.line?.weight, 1, 4, true);
  num2("shading.bands", d.shading?.bands, 1, 16, true);
  num2("shading.hueShift", d.shading?.hueShift, 0, 180);
  oneOf("shading.dither", d.shading?.dither, ["none", "bayer2", "bayer4", "noise"]);
  oneOf("shading.highlight", d.shading?.highlight, ["none", "sparing", "rich"]);
  if (typeof d.shading?.aa !== "boolean") err2("shading.aa", "must be a boolean");
  oneOf("detail.density", d.detail?.density, ["low", "medium", "high"]);
  num2("detail.minFeaturePx", d.detail?.minFeaturePx, 1, 64, true);
  num2("pipeline.revisionPasses", d.pipeline?.revisionPasses, 1, 10, true);
  if (typeof d.pipeline?.finishPass !== "boolean") err2("pipeline.finishPass", "must be a boolean");
  num2("pipeline.raster.directMaxPx", d.pipeline?.raster?.directMaxPx, 1, 4096, true);
  num2("pipeline.raster.ss", d.pipeline?.raster?.ss, 1, 16, true);
  strs2("pipeline.procedural", d.pipeline?.procedural);
  strs2("pipeline.finish.allow", d.pipeline?.finish?.allow);
  num2("effects.fps", d.effects?.fps, 1, 120, true);
  num2("effects.maxFrames", d.effects?.maxFrames, 1, 256, true);
  if (d.background !== void 0 && (typeof d.background !== "string" || !HEX.test(d.background))) err2("background", "must be #rrggbb");
  strs2("anchors", d.anchors);
  strs2("rules.do", d.rules?.do);
  strs2("rules.dont", d.rules?.dont);
  return errors.length ? { ok: false, errors } : { ok: true, errors, direction: d };
}
function parseDirection(input) {
  const r = validateDirection(input);
  if (!r.ok) throw new Error(`invalid direction:
  ${r.errors.join("\n  ")}`);
  return r.direction;
}
function dirContext(dir) {
  const pal = {};
  for (const [k, r2] of Object.entries(dir.palette.ramps)) pal[k] = r2.map(normHex);
  const [r, g, b] = parseColor(dir.palette.shadow.color);
  return { ...dir, pal, outline: normHex(dir.palette.outline), shadow: `rgba(${r},${g},${b},${dir.palette.shadow.alpha})` };
}
function kindPalette(dir, kind) {
  const names = kind && dir.palette.perKind[kind] || Object.keys(dir.palette.ramps);
  const out = names.flatMap((n) => dir.palette.ramps[n].map(normHex));
  out.push(normHex(dir.palette.outline));
  return [...new Set(out)];
}
function pxPerMetre(dir) {
  const m = dir.scale.metre;
  return typeof m === "number" ? m : resolveSize(dir, "character", "character")[1] / 1.8;
}
function resolveSize(dir, size, kind) {
  if (Array.isArray(size)) return size;
  const key2 = size ?? kind;
  const ALIAS = { creature: "character", tileset: "tile", texture: "tile", viewmodel: "large", "ui-icon": "prop" };
  const v = key2 ? dir.scale[key2] ?? dir.scale[ALIAS[key2]] : void 0;
  if (typeof v === "number") return [v, v];
  if (Array.isArray(v)) return v;
  throw new Error(`no size for ${JSON.stringify(size ?? kind)} in direction.scale`);
}
var VIEWS, DEFAULTS, isObj, HEX, RAMP_NAME, RESERVED, clone;
var init_direction = __esm({
  "../artgen-core/src/direction.ts"() {
    "use strict";
    init_color();
    VIEWS = ["topdown", "oblique", "iso", "stack", "side", "fp"];
    DEFAULTS = {
      theme: {},
      camera: { light: [-1, -1, 1], directions: 8, pixelScale: 3 },
      scale: {},
      palette: { shadow: { color: "#000000", alpha: 0.35 }, materials: {}, perKindMax: {}, perKind: {} },
      line: { outer: "dark", inner: "selective", weight: 1 },
      shading: { bands: 3, hueShift: 12, dither: "none", highlight: "sparing", aa: false },
      detail: { density: "medium", minFeaturePx: 2 },
      pipeline: { revisionPasses: 3, finishPass: true, raster: { directMaxPx: 32, ss: 8 }, procedural: [], finish: { allow: ["patch", "fix", "fx", "light", "outline"] } },
      effects: { fps: 12, maxFrames: 8, palette: [] },
      anchors: [],
      rules: { do: [], dont: [] }
    };
    isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    HEX = /^#[0-9a-fA-F]{6}$/;
    RAMP_NAME = /^[a-z][a-zA-Z0-9_-]*$/;
    RESERVED = /* @__PURE__ */ new Set(["outline", "shadow"]);
    clone = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
  }
});

// ../artgen-core/src/lib/normals.ts
function putNormal(g, x, y, n) {
  const l = Math.hypot(n[0], n[1], n[2]) || 1, i = (y * g.w + x) * 4;
  g.d[i] = Math.round((n[0] / l * 0.5 + 0.5) * 255);
  g.d[i + 1] = Math.round((-n[1] / l * 0.5 + 0.5) * 255);
  g.d[i + 2] = Math.round((n[2] / l * 0.5 + 0.5) * 255);
  g.d[i + 3] = 255;
}
function getNormal(g, x, y) {
  if (!g.inb(x, y)) return null;
  const i = (y * g.w + x) * 4;
  if (!g.d[i + 3]) return null;
  return [g.d[i] / 127.5 - 1, -(g.d[i + 1] / 127.5 - 1), g.d[i + 2] / 127.5 - 1];
}
function flipNormalMap(g) {
  const out = g.flip("x");
  for (let i = 0; i < out.d.length; i += 4) if (out.d[i + 3]) out.d[i] = 255 - out.d[i];
  return out;
}
function fitNormalMap(sprite, normal) {
  const out = new Grid(sprite.w, sprite.h);
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    if (sprite.alpha(x, y) < 255) continue;
    const n = normal && getNormal(normal, x, y);
    putNormal(out, x, y, n ?? FLAT);
  }
  return out;
}
function normalFromHeight(heights, w, h, o = {}) {
  const k = o.strength ?? 2, out = new Grid(w, h);
  const H = (x, y) => {
    if (o.wrap) {
      x = (x % w + w) % w;
      y = (y % h + h) % h;
    } else {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
    }
    return heights[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (o.mask && o.mask.alpha(x, y) < 255) continue;
    const dx = (H(x + 1, y) - H(x - 1, y)) / 2, dy = (H(x, y + 1) - H(x, y - 1)) / 2;
    putNormal(out, x, y, [-dx * k, -dy * k, 1]);
  }
  return out;
}
var FLAT;
var init_normals = __esm({
  "../artgen-core/src/lib/normals.ts"() {
    "use strict";
    init_grid();
    FLAT = [0, 0, 1];
  }
});

// ../artgen-core/src/t2/params.ts
function paramDefault(s2) {
  if (s2.type === "range") return s2.default ?? (s2.step ? s2.min + Math.round((s2.max - s2.min) / 2 / s2.step) * s2.step : (s2.min + s2.max) / 2);
  if (s2.type === "toggle") return s2.default ?? false;
  return s2.default ?? s2.options[0];
}
function sample(s2, r) {
  if (s2.type === "range") {
    const v = s2.min + r() * (s2.max - s2.min);
    return s2.step ? Math.min(s2.max, s2.min + Math.round((v - s2.min) / s2.step) * s2.step) : v;
  }
  if (s2.type === "toggle") return r() < (s2.p ?? 0.5);
  return s2.options[Math.floor(r() * s2.options.length)];
}
function resolveParams(schema = {}, variant = 0, overrides = {}) {
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (!isSpec(v)) {
      out[k] = v;
      continue;
    }
    out[k] = variant > 0 ? sample(v, rng(parseInt(hashString(`${k}:${variant}`).slice(0, 8), 16))) : paramDefault(v);
  }
  return { ...out, ...overrides };
}
var isSpec;
var init_params = __esm({
  "../artgen-core/src/t2/params.ts"() {
    "use strict";
    init_rng();
    isSpec = (v) => typeof v === "object" && v !== null && !Array.isArray(v) && ["range", "toggle", "choice", "swap"].includes(v.type ?? "");
  }
});

// ../artgen-core/src/tex/noise.ts
function pValue(x, y, o) {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum2 = 0, amp = 1, norm2 = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = x / o.w * cx, fy = y / o.h * cy, i = Math.floor(fx), j = Math.floor(fy), u = smooth(fx - i), v = smooth(fy - j);
    const at = (a2, b2) => hash2(mod(a2, cx), mod(b2, cy), seed + k * 1013);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    sum2 += amp * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
    norm2 += amp;
    amp *= g;
    cx *= 2;
    cy *= 2;
  }
  return sum2 / norm2;
}
function pGradient(x, y, o) {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum2 = 0, amp = 1, norm2 = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = x / o.w * cx, fy = y / o.h * cy, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = smooth(tx), v = smooth(ty);
    const grad = (a, b, dx, dy) => {
      const t = hash2(mod(a, cx), mod(b, cy), seed + k * 7919) * Math.PI * 2;
      return Math.cos(t) * dx + Math.sin(t) * dy;
    };
    const n00 = grad(i, j, tx, ty), n10 = grad(i + 1, j, tx - 1, ty), n01 = grad(i, j + 1, tx, ty - 1), n11 = grad(i + 1, j + 1, tx - 1, ty - 1);
    const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
    sum2 += amp * (nx0 + (nx1 - nx0) * v);
    norm2 += amp;
    amp *= g;
    cx *= 2;
    cy *= 2;
  }
  return Math.max(0, Math.min(1, 0.5 + sum2 / norm2 * 0.75));
}
function pWorley(x, y, o) {
  const cx = o.cells ?? 4, cy = o.cellsY ?? cx, seed = o.seed ?? 1, jit = o.jitter ?? 0.9;
  const fx = x / o.w * cx, fy = y / o.h * cy, i = Math.floor(fx), j = Math.floor(fy);
  let f1 = Infinity, f2 = Infinity, id = 0, px = 0, py = 0;
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
    const ci = mod(i + a, cx), cj = mod(j + b, cy);
    const ox = 0.5 + (hash2(ci, cj, seed) - 0.5) * jit, oy = 0.5 + (hash2(ci, cj, seed + 31) - 0.5) * jit;
    const qx = i + a + ox, qy = j + b + oy, d = Math.hypot(qx - fx, (qy - fy) * (cx / cy) * (o.h / o.w));
    if (d < f1) {
      f2 = f1;
      f1 = d;
      id = cj * cx + ci;
      px = mod(qx, cx);
      py = mod(qy, cy);
    } else if (d < f2) f2 = d;
  }
  return { f1, f2, id, cx: px / cx * o.w, cy: py / cy * o.h };
}
function blurWrap(f, w, h, r) {
  const tmp = new Float32Array(f.length), out = new Float32Array(f.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s2 = 0;
    for (let k = -r; k <= r; k++) s2 += f[y * w + mod(x + k, w)];
    tmp[y * w + x] = s2 / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s2 = 0;
    for (let k = -r; k <= r; k++) s2 += tmp[mod(y + k, h) * w + x];
    out[y * w + x] = s2 / n;
  }
  return out;
}
var hash2, mod, smooth;
var init_noise = __esm({
  "../artgen-core/src/tex/noise.ts"() {
    "use strict";
    hash2 = (i, j, seed) => {
      let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
      h = Math.imul(h ^ h >>> 13, 1274126177);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    };
    mod = (a, b) => (a % b + b) % b;
    smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  }
});

// ../artgen-core/src/tex/autotile.ts
function reduceCorners(m) {
  let r = m & (N | E | S | W);
  if (m & NE && m & N && m & E) r |= NE;
  if (m & SE && m & S && m & E) r |= SE;
  if (m & SW && m & S && m & W) r |= SW;
  if (m & NW && m & N && m & W) r |= NW;
  return r;
}
function autotileMask(layout2, index) {
  if (layout2 === "blob47") {
    const m = BLOB47[index];
    if (m === void 0) throw new Error(`blob47 has 47 tiles (index ${index})`);
    return m;
  }
  if (index < 0 || index > 15) throw new Error(`wang16 has 16 tiles (index ${index})`);
  return (index & 1 ? N : 0) | (index & 2 ? E : 0) | (index & 4 ? S : 0) | (index & 8 ? W : 0);
}
function autotileCovers(m, x, y, s2, o) {
  const px = x + 0.5, py = y + 0.5, { inset, wobble, seed } = o;
  const along = (t, k) => wobble * (pGradient(t, 0, { w: s2, h: s2, cells: 2, octaves: 2, seed: seed + k }) - 0.5) * 2;
  const top = m & N ? -1 : inset + along(px, 1), bottom = m & S ? s2 + 1 : s2 - inset - along(px, 2);
  const left = m & W ? -1 : inset + along(py, 3), right = m & E ? s2 + 1 : s2 - inset - along(py, 4);
  if (px < left || px > right || py < top || py > bottom) return false;
  const r = inset * 0.8;
  for (const [sx, sy, a, b] of [[-1, -1, !(m & W), !(m & N)], [1, -1, !(m & E), !(m & N)], [-1, 1, !(m & W), !(m & S)], [1, 1, !(m & E), !(m & S)]]) {
    if (!a || !b) continue;
    const cx = sx < 0 ? left + r : right - r, cy = sy < 0 ? top + r : bottom - r;
    const inX = sx < 0 ? cx - px : px - cx, inY = sy < 0 ? cy - py : py - cy;
    if (inX > 0 && inY > 0 && Math.hypot(inX, inY) > r) return false;
  }
  const notch = inset + along(px + py, 5) * 0.5;
  if (m & N && m & E && !(m & NE) && Math.hypot(s2 - px, py) < notch) return false;
  if (m & S && m & E && !(m & SE) && Math.hypot(s2 - px, s2 - py) < notch) return false;
  if (m & S && m & W && !(m & SW) && Math.hypot(px, s2 - py) < notch) return false;
  if (m & N && m & W && !(m & NW) && Math.hypot(px, py) < notch) return false;
  return true;
}
function autotile(dir, layout2, index, o) {
  const s2 = o.over.w, m = autotileMask(layout2, index), inset = o.inset ?? Math.round(s2 / 4), opts = { inset, wobble: o.wobble ?? inset / 2, seed: o.seed ?? 1 };
  if (o.base.w !== s2 || o.over.h !== s2 || o.base.h !== s2) throw new Error("autotile: over and base must be square textures of the same size");
  const cov = new Uint8Array(s2 * s2);
  for (let y = 0; y < s2; y++) for (let x = 0; x < s2; x++) cov[y * s2 + x] = autotileCovers(m, x, y, s2, opts) ? 1 : 0;
  const at = (x, y) => {
    if (x >= 0 && y >= 0 && x < s2 && y < s2) return cov[y * s2 + x];
    const bx = x < 0 ? W : x >= s2 ? E : 0, by = y < 0 ? N : y >= s2 ? S : 0;
    const bit = bx && by ? bx === W ? by === N ? NW : SW : by === N ? NE : SE : bx || by;
    return m & bit ? 1 : 0;
  };
  const step = stepper(dir), g = new Grid(s2, s2), [lx, ly] = dir.camera.light.map(Math.sign);
  for (let y = 0; y < s2; y++) for (let x = 0; x < s2; x++) {
    if (cov[y * s2 + x]) {
      const c = o.over.get(x, y), lit = o.rim !== false && (lx && !at(x + lx, y) || ly && !at(x, y + ly));
      const far = o.rim !== false && (lx && !at(x - lx, y) || ly && !at(x, y - ly));
      g.set(x, y, lit && !far ? step(c, -1) : far ? step(c, 1) : c);
    } else {
      const c = o.base.get(x, y), shadowed = o.rim !== false && (at(x + lx, y + ly) || at(x + lx, y) || at(x, y + ly));
      g.set(x, y, shadowed ? step(c, 1) : c);
    }
  }
  if (o.over.normal && o.base.normal) {
    const n = new Grid(s2, s2);
    for (let y = 0; y < s2; y++) for (let x = 0; x < s2; x++) {
      const src = cov[y * s2 + x] ? o.over.normal : o.base.normal, i = (y * s2 + x) * 4;
      n.d.set(src.d.subarray(i, i + 4), i);
    }
    g.normal = n;
  }
  return g;
}
function stepper(dir) {
  const at = /* @__PURE__ */ new Map();
  for (const [name, r] of Object.entries(dir.pal)) r.forEach((c, i) => {
    if (!at.has(c)) at.set(c, [name, i]);
  });
  return (c, k) => {
    const hit = at.get(c);
    if (!hit) return c;
    const r = dir.pal[hit[0]];
    return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))];
  };
}
function autotileSheet(tiles, cols = 8) {
  const s2 = tiles[0].w, rows = Math.ceil(tiles.length / cols), g = new Grid(cols * (s2 + 1) - 1, rows * (s2 + 1) - 1);
  tiles.forEach((t, i) => g.blit(t, i % cols * (s2 + 1), Math.floor(i / cols) * (s2 + 1)));
  return g;
}
function autotileMap(tiles, layout2, base, cells = 8, seed = 3) {
  const s2 = tiles[0].w, solid = (x, y) => {
    if (x < 0 || y < 0 || x >= cells || y >= cells) return false;
    const dx = x - (cells - 1) / 2, dy = y - (cells - 1) / 2;
    return Math.hypot(dx * 1.1, dy) < cells * 0.36 + Math.sin(x * 1.7 + y * 2.3 + seed) * 0.9;
  };
  const OFF = [[0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW]];
  const g = new Grid(cells * s2, cells * s2);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    if (!solid(x, y)) {
      if (base) g.blit(base, x * s2, y * s2);
      continue;
    }
    let m = 0;
    for (const [dx, dy, b] of OFF) if (solid(x + dx, y + dy)) m |= b;
    g.blit(tiles[autotileIndexOf(layout2, m)], x * s2, y * s2);
  }
  return g;
}
function autotileIndexOf(layout2, mask) {
  if (layout2 === "wang16") return (mask & N ? 1 : 0) | (mask & E ? 2 : 0) | (mask & S ? 4 : 0) | (mask & W ? 8 : 0);
  return BLOB47.indexOf(reduceCorners(mask & 255));
}
var N, NE, E, SE, S, SW, W, NW, BLOB47, autotileCount;
var init_autotile = __esm({
  "../artgen-core/src/tex/autotile.ts"() {
    "use strict";
    init_grid();
    init_noise();
    N = 1;
    NE = 2;
    E = 4;
    SE = 8;
    S = 16;
    SW = 32;
    W = 64;
    NW = 128;
    BLOB47 = [...new Set(Array.from({ length: 256 }, (_, m) => reduceCorners(m)))].sort((a, b) => a - b);
    autotileCount = (layout2) => layout2 === "blob47" ? 47 : 16;
  }
});

// ../artgen-core/src/tex/iso.ts
function stepper2(dir) {
  const at = /* @__PURE__ */ new Map();
  for (const [name, r] of Object.entries(dir.pal)) r.forEach((c, i) => {
    if (!at.has(c)) at.set(c, [name, i]);
  });
  return (c, k) => {
    const hit = at.get(c);
    if (!hit) return c;
    const r = dir.pal[hit[0]];
    return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))];
  };
}
function rampLen(dir, c) {
  for (const r of Object.values(dir.pal)) if (c && r.includes(c)) return r.length;
  return 0;
}
function diamondUV(tex, tw, th, x, y, top = 0) {
  const sx = x + 0.5 - tw / 2, sy = y + 0.5 - top, S3 = tex.w;
  const u = (sx / tw + sy / th) * S3, v = (sy / th - sx / tw) * S3;
  return u < 0 || v < 0 || u >= S3 || v >= S3 ? null : [Math.floor(u), Math.floor(v)];
}
function isoFloorTile(tex, tw, th = tw / 2) {
  const g = new Grid(tw, th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const uv = diamondUV(tex, tw, th, x, y);
    if (uv) g.set(x, y, tex.get(uv[0], uv[1]));
  }
  if (tex.normal) {
    const n = new Grid(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const uv = diamondUV(tex, tw, th, x, y);
      if (uv) {
        const i = (uv[1] * tex.w + uv[0]) * 4;
        n.d.set(tex.normal.d.subarray(i, i + 4), (y * tw + x) * 4);
      }
    }
    g.normal = n;
  }
  return g;
}
function isoBlockTile(dir, tw, o, th = tw / 2) {
  const h = o.height ?? th, H = th + h, g = new Grid(tw, H), step = stepper2(dir);
  const L = o.left ?? o.top, R2 = o.right ?? o.top, S3 = L.w;
  const short = Math.min(...[o.top, L, R2].map((t) => rampLen(dir, t.get(t.w >> 1, t.h >> 1)))) <= 3, [sl, sr] = o.shade ?? (short ? [1, 1] : [1, 2]);
  for (let y = 0; y < H; y++) for (let x = 0; x < tw; x++) {
    const uv = o.noTop ? null : diamondUV(o.top, tw, th, x, y);
    if (uv) {
      g.set(x, y, o.top.get(uv[0], uv[1]));
      continue;
    }
    const half = tw / 2, cx = x + 0.5;
    if (cx < half) {
      const edgeY = th / 2 + cx / half * (th / 2), dy = y + 0.5 - edgeY;
      if (dy >= 0 && dy < h) {
        const u = mod2(Math.floor(cx / half * S3), S3), v = mod2(Math.floor(dy / h * S3), S3);
        g.set(x, y, step(L.get(u, v), sl));
      }
    } else {
      const edgeY = th - (cx - half) / half * (th / 2), dy = y + 0.5 - edgeY;
      if (dy >= 0 && dy < h) {
        const u = mod2(Math.floor((cx - half) / half * S3), S3), v = mod2(Math.floor(dy / h * S3), S3);
        g.set(x, y, step(R2.get(u, v), x === half && short ? 9 : sr));
      }
    }
  }
  return g;
}
var mod2;
var init_iso2 = __esm({
  "../artgen-core/src/tex/iso.ts"() {
    "use strict";
    init_grid();
    mod2 = (a, b) => (a % b + b) % b;
  }
});

// ../artgen-core/src/tex/lsystem.ts
function lsystem(axiom, rules, iterations, seed = 1) {
  const r = rng(seed);
  let s2 = axiom;
  for (let i = 0; i < iterations; i++) {
    let out = "";
    for (const ch of s2) {
      const rule = rules[ch];
      if (rule === void 0) {
        out += ch;
        continue;
      }
      if (typeof rule === "string") {
        out += rule;
        continue;
      }
      const total = rule.reduce((a, [, w]) => a + w, 0);
      let pick2 = r() * total, chosen = rule[rule.length - 1][0];
      for (const [t, w] of rule) {
        pick2 -= w;
        if (pick2 <= 0) {
          chosen = t;
          break;
        }
      }
      out += chosen;
    }
    s2 = out;
    if (s2.length > 2e5) throw new Error("lsystem: string grew past 200k symbols \u2014 fewer iterations");
  }
  return s2;
}
function turtle(program, o) {
  const r = rng(o.seed ?? 1), out = [], stack = [];
  let x = o.start[0], y = o.start[1], h = o.heading ?? -90, d = 0;
  const step = o.step ?? 2, shrink = o.shrink ?? 0.8, width = o.width ?? 1.5, taper = o.taper ?? 0.7, jit = o.jitter ?? 0;
  for (const ch of program) {
    if (ch === "F" || ch === "G" || ch === "f") {
      const len = step * shrink ** d, nx = x + Math.cos(h * Math.PI / 180) * len, ny = y + Math.sin(h * Math.PI / 180) * len;
      if (ch !== "f") out.push({ a: [x, y], b: [nx, ny], depth: d, width: Math.max(0.6, width * taper ** d) });
      x = nx;
      y = ny;
    } else if (ch === "+") h += o.angle + (r() - 0.5) * 2 * jit;
    else if (ch === "-") h -= o.angle + (r() - 0.5) * 2 * jit;
    else if (ch === "[") {
      stack.push({ x, y, h, d });
      d++;
    } else if (ch === "]") {
      const s2 = stack.pop();
      if (s2) ({ x, y, h, d } = s2);
    }
  }
  return out;
}
function lsystemSpecs(segs2, style) {
  return segs2.map((s2) => ({ type: "tube", pts: [s2.a, s2.b], w: s2.width, w1: Math.max(0.6, s2.width * 0.85), ...style }));
}
var init_lsystem = __esm({
  "../artgen-core/src/tex/lsystem.ts"() {
    "use strict";
    init_rng();
  }
});

// ../artgen-core/src/t2/raster.ts
function bandIndices(len, bands) {
  if (bands >= len || bands < 1) return Array.from({ length: len }, (_, i) => i);
  if (bands === 1) return [len >> 1];
  return Array.from({ length: bands }, (_, i) => Math.round(i * (len - 1) / (bands - 1)));
}
var INK, Raster;
var init_raster = __esm({
  "../artgen-core/src/t2/raster.ts"() {
    "use strict";
    init_color();
    init_grid();
    init_normals();
    INK = 1;
    Raster = class _Raster {
      w;
      h;
      /** Owning item per pixel, -1 = empty. */
      id;
      /** Ramp index per pixel. */
      band;
      /** Per-pixel flags (INK = drawn in the ink colour). */
      flag;
      items;
      ink;
      /** Screen-space normal per pixel (x right, y down, z toward the viewer), when the scene computed them. */
      normal;
      constructor(w, h, items, ink) {
        this.w = w;
        this.h = h;
        this.items = items;
        this.ink = ink;
        this.id = new Int16Array(w * h).fill(-1);
        this.band = new Int16Array(w * h);
        this.flag = new Uint8Array(w * h);
      }
      idx(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1;
      }
      /** Item owning (x, y), or null when empty or outside. */
      item(x, y) {
        const i = this.idx(x, y);
        return i < 0 || this.id[i] < 0 ? null : this.items[this.id[i]];
      }
      filled(x, y) {
        const i = this.idx(x, y);
        return i >= 0 && this.id[i] >= 0;
      }
      /** Move a pixel `steps` levels darker (negative = lighter) within its item's levels. Returns true if it moved. */
      step(i, steps) {
        const id = this.id[i];
        if (id < 0 || this.flag[i] & INK) return false;
        const it = this.items[id];
        if (!it.ramp || it.levels.length < 2) return false;
        const L = it.levels, cur = this.band[i];
        let k = L.indexOf(cur);
        if (k < 0) k = L.reduce((best, v, j) => Math.abs(v - cur) < Math.abs(L[best] - cur) ? j : best, 0);
        const nk = Math.max(0, Math.min(L.length - 1, k + steps));
        if (L[nk] === cur) return false;
        this.band[i] = L[nk];
        return true;
      }
      /** Set a pixel to an item's level `k` (0 = lightest level, -1 = darkest). */
      setLevel(i, k) {
        const it = this.items[this.id[i]];
        if (!it?.ramp) return;
        this.band[i] = it.levels[k < 0 ? it.levels.length + k : Math.min(k, it.levels.length - 1)];
      }
      color(i) {
        const id = this.id[i];
        if (id < 0) return null;
        if (this.flag[i] & INK) return this.ink;
        const it = this.items[id];
        return it.fixed ?? it.ramp[this.band[i]];
      }
      /** Normal map of the filled pixels (ink pixels face the viewer), or undefined without normals. */
      normalMap() {
        if (!this.normal) return void 0;
        const g = new Grid(this.w, this.h);
        for (let i = 0; i < this.id.length; i++) {
          if (this.id[i] < 0) continue;
          const ink = !!(this.flag[i] & INK);
          putNormal(g, i % this.w, i / this.w | 0, ink ? [0, 0, 1] : [this.normal[i * 3], this.normal[i * 3 + 1], this.normal[i * 3 + 2]]);
        }
        return g;
      }
      toGrid() {
        const g = new Grid(this.w, this.h);
        for (let i = 0; i < this.id.length; i++) {
          const c = this.color(i);
          if (c) g.set(i % this.w, i / this.w | 0, c);
        }
        return g;
      }
      /** Build a raster from finished pixels: each colour maps to the first direction ramp holding it. */
      static fromGrid(g, ramps, ink, bands = 99) {
        const byColor = /* @__PURE__ */ new Map();
        for (const [name, r2] of Object.entries(ramps)) r2.forEach((c, i) => {
          const k = normHex(c);
          if (!byColor.has(k)) byColor.set(k, [name, i]);
        });
        const items = [], itemOf = /* @__PURE__ */ new Map(), r = new _Raster(g.w, g.h, items, normHex(ink));
        const inkHex = normHex(ink);
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
          if (g.alpha(x, y) < 255) continue;
          const c = g.get(x, y), i = y * g.w + x, hit = byColor.get(c), key2 = c === inkHex ? "#ink" : hit ? hit[0] : c;
          let id = itemOf.get(key2);
          if (id === void 0) {
            id = items.length;
            itemOf.set(key2, id);
            if (key2 === "#ink") items.push({ name: "ink", fixed: inkHex, levels: [], rank: 0 });
            else if (hit) {
              const ramp = ramps[hit[0]].map(normHex);
              items.push({ name: hit[0], ramp, levels: bandIndices(ramp.length, bands), rank: 0 });
            } else items.push({ fixed: c, levels: [], rank: 0 });
          }
          r.id[i] = id;
          if (key2 === "#ink") r.flag[i] = INK;
          else if (hit) r.band[i] = hit[1];
        }
        for (const it of items) if (it.ramp) it.levels = [.../* @__PURE__ */ new Set([...it.levels, ...r.usedBands(items.indexOf(it))])].sort((a, b) => a - b);
        return r;
      }
      usedBands(id) {
        const s2 = /* @__PURE__ */ new Set();
        for (let i = 0; i < this.id.length; i++) if (this.id[i] === id && !(this.flag[i] & INK)) s2.add(this.band[i]);
        return [...s2];
      }
    };
  }
});

// ../artgen-core/src/tex/materials.ts
function roleRamp(dir, role, override) {
  if (override) {
    const r = dir.pal[override] ? override : dir.palette.materials[override];
    if (r && dir.pal[r]) return r;
    throw new Error(`texture: unknown ramp ${override}`);
  }
  for (const c of ROLES[role] ?? [role]) {
    if (dir.pal[c]) return c;
    const m = dir.palette.materials[c];
    if (m && dir.pal[m]) return m;
  }
  return Object.keys(dir.pal)[0];
}
function material(name, dir, o) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`unknown material ${JSON.stringify(name)} (have: ${MATERIALS.join(", ")})`);
  const { w, h } = o, seed = o.seed ?? 1, ctx = { w, h, seed, s: o.scale ?? 1, rnd: (i, j = 0) => hash(i, j, seed + 101), p: o.params ?? {} };
  const roles = RECIPE_ROLES[name], ramps = {};
  for (const [r, def] of Object.entries(roles)) ramps[r] = roleRamp(dir, def, o.ramps?.[r]);
  const samples = [];
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s2 = recipe(x + 0.5, y + 0.5, ctx);
    samples.push(s2);
    height[y * w + x] = s2.height;
  }
  const relief = o.relief ?? 1, [lx, ly] = dir.camera.light, ll = Math.hypot(lx, ly) || 1, hb = blurWrap(height, w, h, 1);
  const dither = o.dither ?? dir.shading.dither !== "none", grid = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, s2 = samples[i], ramp = dir.pal[ramps[s2.role] ?? ramps.base];
    const gx = (hb[y * w + mod3(x + 1, w)] - hb[y * w + mod3(x - 1, w)]) / 2, gy = (hb[mod3(y + 1, h) * w + x] - hb[mod3(y - 1, h) * w + x]) / 2;
    const lit = -(gx * lx + gy * ly) / ll;
    const tone = clamp01(s2.tone - lit * 1.6 * relief);
    const L0 = bandIndices(ramp.length, dir.shading.bands), [r0, r1] = o.range ?? [0, ramp.length - 1];
    const Lr = L0.filter((i2) => i2 >= r0 && i2 <= r1), L = Lr.length ? Lr : L0, f = tone * L.length;
    let k = Math.min(L.length - 1, Math.floor(f));
    if (dither && k < L.length - 1 && f - k > BAYER4[y % 4][x % 4]) k++;
    grid.set(x, y, ramp[L[k]]);
  }
  const normal = normalFromHeight(height, w, h, { wrap: true, strength: 3 * relief });
  grid.normal = normal;
  return { grid, height, normal, ramps };
}
var ROLES, RECIPE_ROLES, MATERIALS, hash, clamp01, sstep, mod3, across, RECIPES, BAYER4;
var init_materials = __esm({
  "../artgen-core/src/tex/materials.ts"() {
    "use strict";
    init_grid();
    init_normals();
    init_raster();
    init_noise();
    ROLES = {
      stone: ["stone", "metal", "dirt"],
      mortar: ["dirt", "stone"],
      wood: ["wood", "leather", "dirt"],
      metal: ["metal", "steel", "stone"],
      rust: ["accent", "leather", "dirt"],
      grass: ["grass", "foliage", "moss", "green"],
      dirt: ["dirt", "leather", "stone"],
      sand: ["sand", "dirt", "skin"],
      snow: ["snow", "stone", "metal", "cloth"],
      water: ["water", "cloth", "blue", "stone"],
      foam: ["metal", "stone", "cloth"],
      lava: ["lava", "glow", "accent", "orange"],
      brick: ["brick", "accent", "leather", "stone"],
      crust: ["stone", "dirt"],
      tech: ["metal", "steel", "stone"],
      light: ["glow", "accent"],
      carpet: ["cloth", "accent", "leather"],
      trim: ["accent", "leather", "wood"]
    };
    RECIPE_ROLES = {
      stone: { base: "stone" },
      cobble: { base: "stone", mortar: "mortar" },
      wood: { base: "wood" },
      metal: { base: "metal", rust: "rust" },
      grass: { base: "grass", soil: "dirt" },
      dirt: { base: "dirt", pebble: "stone" },
      sand: { base: "sand" },
      snow: { base: "snow" },
      water: { base: "water", foam: "foam" },
      lava: { base: "lava", crust: "crust" },
      tech: { base: "tech", light: "light" },
      carpet: { base: "carpet", trim: "trim" },
      brick: { base: "brick", mortar: "mortar" }
    };
    MATERIALS = Object.keys(RECIPE_ROLES);
    hash = (i, j, seed) => {
      let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
      h = Math.imul(h ^ h >>> 13, 1274126177);
      return ((h ^ h >>> 16) >>> 0) / 4294967296;
    };
    clamp01 = (v) => Math.max(0, Math.min(1, v));
    sstep = (a, b, v) => {
      const t = clamp01((v - a) / (b - a));
      return t * t * (3 - 2 * t);
    };
    mod3 = (a, b) => (a % b + b) % b;
    across = (size, px) => Math.max(1, Math.round(size / px));
    RECIPES = {
      stone(x, y, c) {
        const o = { w: c.w, h: c.h, seed: c.seed }, n = pGradient(x, y, { ...o, cells: across(c.w, 7 * c.s), octaves: 3 });
        const wx = x + 3 * (pGradient(x, y, { ...o, cells: across(c.w, 8), seed: c.seed + 21 }) - 0.5), wy = y + 3 * (pGradient(x, y, { ...o, cells: across(c.w, 8), seed: c.seed + 22 }) - 0.5);
        const cells = across(c.w, 16 * c.s), wv = pWorley(wx, wy, { ...o, cells }), px = (wv.f2 - wv.f1) * (c.w / cells);
        const crack = px < 0.75 ? 1 : 0, lip = px >= 0.75 && px < 1.75 ? 1 : 0, slab = c.rnd(wv.id, 1);
        const fine = pValue(x, y, { ...o, cells: across(c.w, 2), seed: c.seed + 5 });
        const vary = c.p.variety ?? 0.38;
        return { role: "base", tone: crack ? 0.95 : 0.12 + vary * slab + 0.22 * (1 - n) + 0.1 * (fine - 0.5) - lip * 0.08, height: crack ? 0 : 0.5 + 0.3 * n + 0.1 * slab + fine * 0.1 };
      },
      cobble(x, y, c) {
        const wv = pWorley(x, y, { w: c.w, h: c.h, seed: c.seed, cells: across(c.w, 9 * c.s), jitter: 0.75 }), edge = wv.f2 - wv.f1;
        if (edge < 0.13) return { role: "mortar", tone: 0.55 + 0.3 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 9 }), height: 0 };
        const dome = sstep(0.13, 0.5, edge), own = c.rnd(wv.id);
        return { role: "base", tone: 0.15 + 0.35 * own + 0.25 * (1 - dome) + 0.1 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 3 }), height: 0.3 + 0.7 * dome };
      },
      wood(x, y, c) {
        const rows = across(c.h, 8 * c.s), ph = c.h / rows, row = Math.floor(y / ph), v = (y - row * ph) / ph;
        const np = Math.max(1, Math.round(c.p.planks ?? 1)), joint = c.rnd(row, 1) * c.w, len = c.w / np;
        const u = mod3(x - joint, len), plank = row * 31 + Math.floor(mod3(x - joint, c.w) / len);
        const seam = v < 1 / ph || u < 1 ? 1 : 0, own = np > 1 ? c.rnd(plank, 3) : c.rnd(row, 3), ga = c.p.grain ?? 0.3;
        const warp = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), cellsY: rows * 2, seed: c.seed + row });
        const grain = 0.5 + 0.5 * Math.sin((v * 6 + warp * 5 + c.rnd(row, 2) * 6) * Math.PI);
        const kw = pWorley(x, y, { w: c.w, h: c.h, cells: across(c.w, 12 * c.s), cellsY: rows, seed: c.seed + 77 }), knot = c.rnd(kw.id, 9) > 0.7 && kw.f1 < 0.09 ? 0.3 : 0;
        return { role: "base", tone: seam ? 1 : 0.22 + ga * grain + 0.1 * own + knot, height: seam ? 0 : 0.6 + 0.1 * grain - (v < 0.2 ? 0 : 0.05 * v) };
      },
      metal(x, y, c) {
        const P2 = across(c.w, 16 * c.s), pw = c.w / P2, ph = c.h / across(c.h, 16 * c.s), u = mod3(x, pw), v = mod3(y, ph);
        const seam = u < 1 || v < 1, rivet = [[3, 3], [pw - 3, 3], [3, ph - 3], [pw - 3, ph - 3]].some(([a, b]) => Math.hypot(u - a, v - b) < 1.1);
        const brushed = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), cellsY: across(c.h, 1), seed: c.seed });
        const rust = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 5), octaves: 2, seed: c.seed + 4 });
        if (rust > 0.78 && !seam && (u < 4 || v < 4 || u > pw - 4 || v > ph - 4)) return { role: "rust", tone: 0.3 + (rust - 0.78) * 2, height: 0.45 };
        if (seam) return { role: "base", tone: 1, height: 0 };
        if (rivet) return { role: "base", tone: 0.05, height: 1 };
        return { role: "base", tone: 0.3 + 0.3 * brushed + 0.12 * (u / pw + v / ph), height: 0.5 };
      },
      grass(x, y, c) {
        const o = { w: c.w, h: c.h, seed: c.seed }, patch = pGradient(x, y, { ...o, cells: across(c.w, 10 * c.s), octaves: 2 });
        const cx = across(c.w, 4), cy = across(c.h, 4), px = Math.floor(x), py = Math.floor(y);
        let blade = 0;
        for (let dj = 0; dj <= 1; dj++) for (let di = -1; di <= 0; di++) {
          const i = mod3(Math.floor(px / c.w * cx) + di, cx), j = mod3(Math.floor(py / c.h * cy) + dj, cy);
          const bx = Math.floor((i + c.rnd(i, j * 3 + 1)) * (c.w / cx)), by = Math.floor((j + c.rnd(i, j * 3 + 2)) * (c.h / cy)), lean = c.rnd(i, j * 3 + 3) > 0.5 ? 1 : 0;
          const dx = mod3(px - bx + c.w, c.w), dy = mod3(by - py + c.h, c.h);
          if (dx === 0 && dy === 0) blade = 2;
          else if (dx === lean && dy === 1) blade = 1;
        }
        const soil = pValue(x, y, { ...o, cells: across(c.w, 6), seed: c.seed + 11 }) > (c.p.soil ?? 0.86) && !blade;
        if (soil) return { role: "soil", tone: 0.5, height: 0.1 };
        return { role: "base", tone: blade === 1 ? 0.05 : blade === 2 ? 0.85 : 0.35 + 0.3 * (1 - patch), height: 0.4 + (blade === 1 ? 0.4 : 0) + patch * 0.2 };
      },
      dirt(x, y, c) {
        const o = { w: c.w, h: c.h, seed: c.seed }, n = pGradient(x, y, { ...o, cells: across(c.w, 10 * c.s), octaves: 3 });
        const pb = pWorley(x, y, { ...o, cells: across(c.w, 7 * c.s), seed: c.seed + 2 });
        if (c.rnd(pb.id, 5) > 0.7 && pb.f1 < 0.22) return { role: "pebble", tone: 0.2 + pb.f1 * 2, height: 0.9 - pb.f1 };
        const speck = pValue(x, y, { ...o, cells: across(c.w, 1.5), seed: c.seed + 8 });
        return { role: "base", tone: 0.25 + 0.45 * (1 - n) + (speck > 0.85 ? 0.3 : speck < 0.12 ? -0.15 : 0), height: n * 0.6 };
      },
      sand(x, y, c) {
        const warp = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed });
        const k = across(c.h, 6 * c.s), r = 0.5 + 0.5 * Math.sin((y / c.h * k + warp * 1.6) * Math.PI * 2);
        const grain = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 1.5), seed: c.seed + 3 });
        return { role: "base", tone: 0.2 + 0.35 * r + (grain > 0.88 ? 0.25 : 0), height: r * 0.6 };
      },
      snow(x, y, c) {
        const n = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 8 * c.s), octaves: 3, seed: c.seed });
        const spark = hash(Math.floor(x), Math.floor(y), c.seed + 6) > 0.985;
        return { role: "base", tone: spark ? 0 : 0.1 + 0.3 * (1 - n), height: n * 0.35 };
      },
      water(x, y, c) {
        const o = { w: c.w, h: c.h, seed: c.seed }, k = across(c.h, 5 * c.s);
        const warp = pGradient(x, y, { ...o, cells: across(c.w, 12), octaves: 2 });
        const wave = 0.5 + 0.5 * Math.sin((y / c.h * k + warp * 2 + x / c.w * 2) * Math.PI * 2);
        const glint = wave > 0.94 && pValue(x, y, { ...o, cells: across(c.w, 4), seed: c.seed + 2 }) > 0.55;
        if (glint) return { role: "foam", tone: 0, height: 0.6 };
        return { role: "base", tone: 0.25 + 0.5 * (1 - wave) * 0.8 + 0.2 * warp, height: wave * 0.3 };
      },
      lava(x, y, c) {
        const wv = pWorley(x, y, { w: c.w, h: c.h, seed: c.seed, cells: across(c.w, 10 * c.s), jitter: 0.85 }), edge = wv.f2 - wv.f1;
        const heat = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed + 1 });
        if (edge < 0.1 + 0.08 * heat) return { role: "base", tone: edge * 4, height: 0 };
        return { role: "crust", tone: 0.35 + 0.5 * (1 - sstep(0.1, 0.4, edge)) * 0.6 + 0.25 * c.rnd(wv.id), height: 0.4 + 0.6 * sstep(0.1, 0.45, edge) };
      },
      tech(x, y, c) {
        const P2 = across(c.w, 16 * c.s), pw = c.w / P2, ph = c.h / across(c.h, 16 * c.s), u = mod3(x, pw), v = mod3(y, ph);
        const edge = u < 1 || v < 1 ? "seam" : u < 2 || v < 2 ? "lit" : u > pw - 2 || v > ph - 2 ? "dark" : "";
        const cell = Math.floor(x / pw) + Math.floor(y / ph) * 31, strip2 = c.rnd(cell, 3) > 0.6 && Math.abs(v - ph / 2) < 0.6 && u > 3 && u < pw - 3;
        if (strip2) return { role: "light", tone: 0.1, height: 0.6 };
        const vent = c.rnd(cell, 4) > 0.65 && u > 4 && u < pw - 4 && v > 4 && v < ph - 4 && Math.floor(v) % 2 === 0;
        const scuff = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 4), seed: c.seed }) > 0.8 ? 0.15 : 0;
        return { role: "base", tone: edge === "seam" ? 1 : edge === "lit" ? 0.05 : edge === "dark" ? 0.75 : vent ? 0.85 : 0.35 + scuff, height: edge === "seam" ? 0 : vent ? 0.2 : 0.5 };
      },
      carpet(x, y, c) {
        const P2 = c.w / across(c.w, 16 * c.s), u = mod3(x, P2) / P2 - 0.5, v = mod3(y, P2) / P2 - 0.5, d = Math.abs(u) + Math.abs(v);
        const weave = (Math.floor(x) + Math.floor(y)) % 2 === 0 ? 0.08 : 0;
        const wear = pGradient(x, y, { w: c.w, h: c.h, cells: across(c.w, 16), octaves: 2, seed: c.seed });
        if (Math.abs(d - 0.32) < 0.06) return { role: "trim", tone: 0.2 + weave + (wear > 0.7 ? 0.3 : 0), height: 0.6 };
        return { role: "base", tone: (d < 0.2 ? 0.2 : 0.5) + weave + (wear > 0.65 ? 0.25 : 0), height: 0.5 };
      },
      brick(x, y, c) {
        const rows = across(c.h, (c.p.course ?? 8) * c.s), ph = c.h / rows, row = Math.floor(y / ph), v = y - row * ph;
        const per = across(c.w, ph * 2.2), pw = c.w / per, u = mod3(x - (row % 2 ? pw / 2 : 0), pw), id = row * 97 + Math.floor(mod3(x - (row % 2 ? pw / 2 : 0), c.w) / pw);
        if (v < 1 || u < 1) return { role: "mortar", tone: 0.55 + 0.25 * pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 3), seed: c.seed + 9 }), height: 0 };
        const own = c.rnd(id, 5), pit = pValue(x, y, { w: c.w, h: c.h, cells: across(c.w, 2), seed: c.seed + 4 });
        const chip = c.rnd(id, 6) > 0.8 && pWorley(x, y, { w: c.w, h: c.h, cells: across(c.w, 6), seed: c.seed + id }).f1 < 0.12;
        return { role: "base", tone: 0.2 + 0.4 * own + 0.15 * (pit - 0.5) + (v < 2 ? -0.12 : 0) + (chip ? 0.35 : 0), height: chip ? 0.3 : 0.7 + 0.1 * own - (v > ph - 2 ? 0.2 : 0) };
      }
    };
    BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));
  }
});

// ../artgen-core/src/tex/wfc.ts
function wfc(tiles, w, h, o = {}) {
  const n = tiles.length;
  if (!n) throw new Error("wfc: no tiles");
  const compat = [0, 1, 2, 3].map((d) => tiles.map((a) => tiles.map((b, j) => a.edges[d] === b.edges[OPP[d]] ? j : -1).filter((j) => j >= 0)));
  const weights = tiles.map((t) => t.weight ?? 1);
  for (let attempt = 0; attempt <= (o.restarts ?? 20); attempt++) {
    const r = rng((o.seed ?? 1) * 7919 + attempt), cells = Array.from({ length: w * h }, () => new Set(tiles.map((_, i) => i)));
    const nb = (c, d) => {
      let x = c % w + DX[d], y = Math.floor(c / w) + DY[d];
      if (o.periodic) {
        x = (x + w) % w;
        y = (y + h) % h;
      } else if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      return y * w + x;
    };
    const propagate = (start) => {
      const queue = [...start];
      while (queue.length) {
        const c = queue.pop();
        for (let d = 0; d < 4; d++) {
          const m = nb(c, d);
          if (m < 0) continue;
          const allowed2 = /* @__PURE__ */ new Set();
          for (const a of cells[c]) for (const b of compat[d][a]) allowed2.add(b);
          let changed = false;
          for (const b of [...cells[m]]) if (!allowed2.has(b)) {
            cells[m].delete(b);
            changed = true;
          }
          if (!cells[m].size) return false;
          if (changed) queue.push(m);
        }
      }
      return true;
    };
    let ok = propagate(cells.map((_, i) => i));
    if (ok && o.fixed) {
      const touched = [];
      for (const [k, id] of Object.entries(o.fixed)) {
        const i = tiles.findIndex((t) => t.id === id);
        if (i < 0) throw new Error(`wfc: fixed tile ${id} is not in the set`);
        cells[+k] = /* @__PURE__ */ new Set([i]);
        touched.push(+k);
      }
      ok = propagate(touched);
    }
    if (!ok && !o.fixed && attempt === 0) break;
    while (ok) {
      let best = -1, be = Infinity;
      for (let c = 0; c < cells.length; c++) {
        const s2 = cells[c];
        if (s2.size < 2) continue;
        let sw = 0, swl = 0;
        for (const i of s2) {
          sw += weights[i];
          swl += weights[i] * Math.log(weights[i]);
        }
        const e = Math.log(sw) - swl / sw + r() * 1e-6;
        if (e < be) {
          be = e;
          best = c;
        }
      }
      if (best < 0) break;
      const opts = [...cells[best]], total = opts.reduce((a, i) => a + weights[i], 0);
      let pick2 = r() * total, choice = opts[opts.length - 1];
      for (const i of opts) {
        pick2 -= weights[i];
        if (pick2 <= 0) {
          choice = i;
          break;
        }
      }
      cells[best] = /* @__PURE__ */ new Set([choice]);
      ok = propagate([best]);
    }
    if (ok) return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_2, x) => tiles[[...cells[y * w + x]][0]].id));
  }
  throw new Error(`wfc: no solution after ${(o.restarts ?? 20) + 1} attempts (check the sockets: every tile needs partners on all four sides)`);
}
var DX, DY, OPP;
var init_wfc = __esm({
  "../artgen-core/src/tex/wfc.ts"() {
    "use strict";
    init_rng();
    DX = [0, 1, 0, -1];
    DY = [-1, 0, 1, 0];
    OPP = [2, 3, 0, 1];
  }
});

// ../artgen-core/src/t2/proc.ts
function matcher(r, env, t) {
  const parts = t.part === void 0 ? null : [].concat(t.part);
  const mats = t.mat === void 0 ? null : [].concat(t.mat).map((m) => env.dir.pal[m] ?? env.dir.pal[env.dir.palette.materials[m]]);
  const okItem = r.items.map((it) => {
    if (it.underlay || !it.ramp) return false;
    if (parts && !parts.some((p) => p.endsWith("*") ? (it.name ?? "").startsWith(p.slice(0, -1)) : it.name === p)) return false;
    if (mats && !mats.some((m) => m && m.length === it.ramp.length && m.every((c, i) => c === it.ramp[i]))) return false;
    return true;
  });
  return (p) => r.id[p] >= 0 && !(r.flag[p] & INK) && okItem[r.id[p]];
}
function valueNoise(seed, x, y, scale2, octaves = 2) {
  const hash3 = (i, j) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  let sum2 = 0, amp = 1, norm2 = 0, f = 1 / Math.max(0.5, scale2);
  for (let o = 0; o < octaves; o++) {
    const fx = x * f, fy = y * f, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash3(i, j), b = hash3(i + 1, j), c = hash3(i, j + 1), d = hash3(i + 1, j + 1);
    sum2 += amp * (a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv);
    norm2 += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum2 / norm2;
}
function autoGround(r) {
  let x0 = r.w, x1 = -1, y1 = -1;
  for (let p = 0; p < r.id.length; p++) if (r.id[p] >= 0) {
    const x = p % r.w, y = p / r.w | 0;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return [r.w / 2, r.h - 2, 1];
  return [(x0 + x1 + 1) / 2, y1, Math.max(2, (x1 - x0 + 1) / 2 * 0.8)];
}
function shadowsUnder(g, st, env, r) {
  const under = new Grid(g.w, g.h);
  if (st.shadow) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x - st.shadow[0], y - st.shadow[1]) === 255) under.set(x, y, env.dir.shadow);
  }
  if (st.ground) {
    const [cx, cy, rx] = st.ground === "auto" ? autoGround(r) : st.ground, ry = rx / 2;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) under.set(x, y, env.dir.shadow);
  }
  return under.stamp(g);
}
var N43, BAYER2, LAYERS, Proc;
var init_proc = __esm({
  "../artgen-core/src/t2/proc.ts"() {
    "use strict";
    init_grid();
    init_raster();
    N43 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    BAYER2 = {
      bayer2: [[0, 2], [3, 1]].map((r) => r.map((v) => (v + 0.5) / 4)),
      bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16))
    };
    LAYERS = {
      /** Interior pixels step one band darker/lighter where seeded noise is high/low. Options: amount, scale, octaves. */
      materialNoise(r, env, o) {
        const hit = matcher(r, env, o), amount = o.amount ?? 0.2, scale2 = o.scale ?? 3, oct = o.octaves ?? 2;
        const seed = env.seed + (o.seed ?? 0), moves = [];
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x = p % r.w, y = p / r.w | 0;
          if (!N43.every(([dx, dy]) => {
            const q = r.idx(x + dx, y + dy);
            return q >= 0 && r.id[q] === r.id[p] && !(r.flag[q] & INK);
          })) continue;
          const n = valueNoise(seed, x, y, scale2, oct);
          if (n > 1 - amount / 2) moves.push([p, 1]);
          else if (n < amount / 2) moves.push([p, -1]);
        }
        for (const [p, s2] of moves) r.step(p, s2);
      },
      /**
       * Repeating structure. type: stripes | planks | bricks | grid | checker | rivets. Options: period, axis
       * ('x' = lines run along x), width, offset, length (planks/bricks joint spacing), step (+1 darker, -1 lighter).
       */
      pattern(r, env, o) {
        const hit = matcher(r, env, o), type = o.type ?? "stripes", P2 = o.period ?? 4, wd = o.width ?? 1;
        const off = o.offset ?? 0, len = o.length ?? P2 * 3, step = o.step ?? 1, along = o.axis ?? "x";
        const mod4 = (a, b) => (a % b + b) % b;
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x0 = p % r.w, y0 = p / r.w | 0, [u, v] = along === "x" ? [x0, y0] : [y0, x0];
          const row = Math.floor((v - off) / P2), line = mod4(v - off, P2) < wd;
          let on = false;
          if (type === "stripes") on = line;
          else if (type === "planks" || type === "bricks") on = line || mod4(u - (row % 2 ? len / 2 : 0) - (o.joint ?? 0), len) < wd;
          else if (type === "grid") on = mod4(u - off, P2) < wd || line;
          else if (type === "checker") on = (Math.floor((u - off) / P2) + row) % 2 === 0;
          else if (type === "rivets") on = mod4(u - off, P2) === 0 && mod4(v - off, P2) === 0;
          else throw new Error(`pattern: unknown type ${type}`);
          if (on) r.step(p, step);
        }
      },
      /**
       * Mask-template variation (Bollinger-style, P3): a small char mask is filled from the seed and stepped onto the
       * target as markings. Mask cells: `.` never, `#` always body, `1` body or empty, `2` body or border, `-` always
       * border. Body pixels step `step` (default +1, darker), border pixels `step + 1`; with `mirror: 'x'` (default) the
       * mask is the left half and is mirrored. Options: mask (rows), at ([x, y] top-left, default centred on the
       * target's bounding box), tile (repeat over the box), density (chance a random cell is body, 0.5), seed, step.
       * Vary `seed` per variant (`seed: ctx.variant`) for different markings on every variant.
       */
      detail(r, env, o) {
        const hit = matcher(r, env, o), rows = o.mask;
        if (!Array.isArray(rows) || !rows.length) throw new Error("detail: mask (array of rows) is required");
        const mirror = o.mirror ?? "x", density = o.density ?? 0.5, step = o.step ?? 1;
        let seed = env.seed * 2654435761 + (o.seed ?? 0) * 40503 + 7 >>> 0;
        const rand = () => {
          seed = seed + 1831565813 >>> 0;
          let t = seed;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        const half = rows.map((row) => [...row].map((ch) => ch === "#" ? 1 : ch === "-" ? 2 : ch === "1" ? rand() < density ? 1 : 0 : ch === "2" ? rand() < density ? 1 : 2 : 0));
        let cells = half;
        if (mirror === "x") cells = half.map((row) => [...row, ...[...row].reverse()]);
        else if (mirror === "y") cells = [...half, ...[...half].reverse()];
        const mh = cells.length, mw = Math.max(...cells.map((c) => c.length));
        const at0 = (x, y) => y >= 0 && y < mh && x >= 0 && x < cells[y].length ? cells[y][x] : 0;
        const mask = cells.map((row, y) => row.map((c, x) => c === 0 && N43.some(([dx, dy]) => at0(x + dx, y + dy) === 1) ? 2 : c));
        const v = (x, y) => y >= 0 && y < mh && x >= 0 && x < mask[y].length ? mask[y][x] : 0;
        let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
        for (let p = 0; p < r.id.length; p++) if (hit(p)) {
          const x = p % r.w, y = p / r.w | 0;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
        if (x1 < 0) return;
        const at = o.at ?? [Math.round((x0 + x1 + 1 - mw) / 2), Math.round((y0 + y1 + 1 - mh) / 2)];
        const moves = [];
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x = p % r.w, y = p / r.w | 0;
          let mx = x - at[0], my = y - at[1];
          if (o.tile) {
            mx = (mx % mw + mw) % mw;
            my = (my % mh + mh) % mh;
          }
          const c = v(mx, my);
          if (c) moves.push([p, c === 2 ? step + Math.sign(step || 1) : step]);
        }
        for (const [p, k] of moves) r.step(p, k);
      },
      /** Edge light: `side: 'lit'` (default) sets edges facing the light to the lightest level; `away` steps them lighter. */
      rimLight(r, env, o) {
        const hit = matcher(r, env, o), [lx, ly] = env.dir.camera.light.map(Math.sign), away = o.side === "away";
        const sx = away ? -lx : lx, sy = away ? -ly : ly, sets = [];
        const open = (x, y) => {
          const q = r.idx(x, y);
          return q < 0 || r.id[q] < 0 || !!(r.flag[q] & INK);
        };
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x = p % r.w, y = p / r.w | 0;
          if (sx && open(x + sx, y) || sy && open(x, y + sy)) sets.push(p);
        }
        for (const p of sets) away ? r.step(p, -1) : r.setLevel(p, 0);
      },
      /** Overlap ambient occlusion: pixels next to a shape drawn above them step darker. */
      ao(r, env, o) {
        const hit = matcher(r, env, o), moves = [];
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x = p % r.w, y = p / r.w | 0, rank = r.items[r.id[p]].rank;
          if (N43.some(([dx, dy]) => {
            const q = r.idx(x + dx, y + dy);
            return q >= 0 && r.id[q] >= 0 && !r.items[r.id[q]].underlay && r.items[r.id[q]].rank > rank;
          })) moves.push(p);
        }
        for (const p of moves) r.step(p, o.strength ?? 1);
      },
      /** Every targeted shape casts `dist` px away from the light onto shapes beneath it. */
      castShadow(r, env, o) {
        const hit = matcher(r, env, o), dist = o.dist ?? 1, [lx, ly] = env.dir.camera.light.map(Math.sign), done = new Uint8Array(r.id.length);
        const moves = [];
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p) && !(r.id[p] >= 0 && r.flag[p] & INK && o.part === void 0)) continue;
          const x = p % r.w, y = p / r.w | 0, rank = r.items[r.id[p]].rank;
          for (let k = 1; k <= dist; k++) {
            const q = r.idx(x - lx * k, y - ly * k);
            if (q < 0 || done[q] || r.id[q] < 0 || r.items[r.id[q]].rank >= rank || r.items[r.id[q]].underlay) continue;
            done[q] = 1;
            moves.push(q);
          }
        }
        for (const q of moves) r.step(q, 1);
      },
      /** Ordered dither across band boundaries inside a material (only when the direction allows dither). */
      dither(r, env, o) {
        const m = BAYER2[env.dir.shading.dither === "noise" ? "bayer4" : env.dir.shading.dither];
        if (!m) return;
        const hit = matcher(r, env, o), sets = [];
        for (let p = 0; p < r.id.length; p++) {
          if (!hit(p)) continue;
          const x = p % r.w, y = p / r.w | 0;
          for (const [dx, dy] of N43) {
            const q = r.idx(x + dx, y + dy);
            if (q < 0 || r.id[q] !== r.id[p] || r.flag[q] & INK || r.band[q] <= r.band[p]) continue;
            if (m[y % m.length][x % m.length] < 0.5) sets.push([p, r.band[q]]);
            break;
          }
        }
        for (const [p, b] of sets) r.band[p] = b;
      },
      /** 2:1 ground shadow ellipse under the sprite; cx/cy/rx default to the footprint of the opaque pixels. */
      groundShadow(_r, _env, o, st) {
        st.ground = o.cx !== void 0 ? [o.cx, o.cy, o.rx ?? 6] : "auto";
      },
      dropShadow(_r, _env, o, st) {
        st.shadow = [o.dx ?? 1, o.dy ?? 1];
      }
    };
    Proc = class {
      layers = [];
      useDefaults = true;
      source;
      env;
      stage;
      constructor(source, env, stage) {
        this.source = source;
        this.env = env;
        this.stage = stage;
      }
      add(name, opts = {}) {
        if (!LAYERS[name]) throw new Error(`procedural layer ${JSON.stringify(name)} does not exist (have: ${Object.keys(LAYERS).join(", ")})`);
        this.layers.push([name, opts]);
        return this;
      }
      /** Skip the direction's default layers. */
      noDefaults() {
        this.useDefaults = false;
        return this;
      }
      /** Layers in run order: direction defaults not replaced by the asset, then the asset's layers. */
      plan() {
        const mine = new Set(this.layers.map((l) => l[0]));
        const defs = this.useDefaults ? this.env.dir.pipeline.procedural.filter((n) => !mine.has(n)).map((n) => {
          if (!LAYERS[n]) throw new Error(`direction pipeline.procedural: unknown layer ${JSON.stringify(n)}`);
          return [n, {}];
        }) : [];
        return [...defs, ...this.layers];
      }
      render() {
        const isScene = !this.source.d, st = {};
        const r = isScene ? this.source.raster() : Raster.fromGrid(this.source, this.env.dir.pal, this.env.dir.outline, this.env.dir.shading.bands);
        for (const [name, o] of this.plan()) {
          LAYERS[name](r, this.env, o, st);
          this.stage?.(`proc-${name}`, r.toGrid());
        }
        if (isScene) {
          const ground = st.ground === "auto" ? autoGround(r) : st.ground;
          return this.source.finalize(r, { ...st.shadow && { shadow: st.shadow }, ...ground && { groundShadow: ground } });
        }
        let g = r.toGrid();
        const src = this.source;
        for (let i = 0; i < src.w * src.h; i++) if (src.d[i * 4 + 3] && src.d[i * 4 + 3] < 255) g.d.set(src.d.subarray(i * 4, i * 4 + 4), i * 4);
        if (st.shadow || st.ground) g = shadowsUnder(g, st, this.env, r);
        if (src.normal) g.normal = src.normal;
        return g;
      }
    };
  }
});

// ../artgen-core/src/views/fp.ts
function raycast(scene, o) {
  const { w, h } = o, map = scene.map ?? CORRIDOR, out = new Grid(w, h);
  const [px, py] = o.pos ?? [4.5, 6.5], ang = (o.angle ?? -90) * Math.PI / 180, fov = (o.fov ?? 66) * Math.PI / 180;
  const fog = parseColor(o.fog ?? "#000000"), fogDist = o.fogDist ?? 7;
  const dx = Math.cos(ang), dy = Math.sin(ang), plane = Math.tan(fov / 2), qx = -dy * plane, qy = dx * plane;
  const solid = (x, y) => y < 0 || y >= map.length || x < 0 || x >= map[y].length || map[y][x] === "#";
  const put = (x, y, c, dist, dim = 1) => {
    if (c[3] < 128) return false;
    const f = Math.min(1, dist / fogDist) ** 1.2, k = dim * (1 - f);
    const i = (y * w + x) * 4;
    out.d[i] = Math.round(c[0] * k + fog[0] * f);
    out.d[i + 1] = Math.round(c[1] * k + fog[1] * f);
    out.d[i + 2] = Math.round(c[2] * k + fog[2] * f);
    out.d[i + 3] = 255;
    return true;
  };
  const zbuf = new Float32Array(w).fill(Infinity), horizon = h / 2;
  for (let y = 0; y < h; y++) {
    const below = y >= horizon, p = Math.abs(y + 0.5 - horizon);
    const rowDist = h / 2 / Math.max(1e-3, p);
    for (let x = 0; x < w; x++) {
      const cx = 2 * (x + 0.5) / w - 1, rx = dx + qx * cx, ry = dy + qy * cx;
      const fx = px + rx * rowDist, fy = py + ry * rowDist;
      if (below) put(x, y, scene.floor ? texel(scene.floor, fx % 1, fy % 1) : [60, 60, 60, 255], rowDist);
      else if (scene.ceiling) put(x, y, texel(scene.ceiling, fx % 1, fy % 1), rowDist);
      else if (scene.sky) {
        const a = Math.atan2(ry, rx) / (Math.PI * 2);
        put(x, y, texel(scene.sky, a, y / horizon), 0);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    const cx = 2 * (x + 0.5) / w - 1, rx = dx + qx * cx, ry = dy + qy * cx;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9)), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
    let sdx = rx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = ry < 0 ? (py - my) * ddy : (my + 1 - py) * ddy, side = 0;
    for (let n = 0; n < 64; n++) {
      if (sdx < sdy) {
        sdx += ddx;
        mx += sx;
        side = 0;
      } else {
        sdy += ddy;
        my += sy;
        side = 1;
      }
      if (solid(mx, my)) break;
    }
    const dist = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = dist;
    let wx = side === 0 ? py + dist * ry : px + dist * rx;
    wx -= Math.floor(wx);
    if (side === 0 && rx > 0 || side === 1 && ry < 0) wx = 1 - wx;
    const lh = h / dist, top = horizon - lh / 2;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, Math.ceil(top + lh)); y++) put(x, y, texel(scene.wall, wx, (y + 0.5 - top) / lh), dist, side ? 0.72 : 1);
  }
  const sprites = [...scene.sprites ?? []].map((s2) => ({ s: s2, d: (s2.x - px) ** 2 + (s2.y - py) ** 2 })).sort((a, b) => b.d - a.d);
  const inv = 1 / (qx * dy - dx * qy);
  for (const { s: s2 } of sprites) {
    const ox = s2.x - px, oy = s2.y - py, tx = inv * (dy * ox - dx * oy), tz = inv * (-qy * ox + qx * oy);
    if (tz <= 0.1) continue;
    const scx = w / 2 * (1 + tx / tz), sh = h / tz * (s2.height ?? s2.grid.h / 64), sw = sh * (s2.grid.w / s2.grid.h);
    const bottom = horizon + h / tz / 2, top = bottom - sh;
    for (let x = Math.max(0, Math.floor(scx - sw / 2)); x < Math.min(w, Math.ceil(scx + sw / 2)); x++) {
      if (tz >= zbuf[x]) continue;
      const u = (x + 0.5 - (scx - sw / 2)) / sw;
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, Math.ceil(bottom)); y++) put(x, y, texel(s2.grid, u, (y + 0.5 - top) / sh), tz);
    }
  }
  if (scene.viewmodel) {
    const vm = scene.viewmodel, k = Math.max(1, Math.round(w * 0.5 / vm.w)), big = vm.scale(k);
    out.over(big, Math.round((w - big.w) / 2), h - big.h);
  }
  return out;
}
function sky(dir, o) {
  const { w, h } = o, seed = o.seed ?? 1, g = new Grid(w, h);
  const pick2 = (want, fallback) => want && dir.pal[want] ? want : fallback.find((n2) => dir.pal[n2]) ?? Object.keys(dir.pal)[0];
  const band = dir.pal[pick2(o.ramp, ["cloth", "stone"])], cloud = dir.pal[pick2(o.cloudRamp, ["metal", "stone"])], n = band.length;
  const clouds = o.clouds ?? 0.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 1 - y / h;
    const jitter = (pValue(x, y, { w, h, cells: Math.max(1, Math.round(w / 4)), cellsY: Math.max(1, Math.round(h / 4)), seed: seed + 3 }) - 0.5) * 0.18;
    let c = band[Math.max(0, Math.min(n - 1, Math.floor((v + jitter) * n)))];
    if (clouds > 0) {
      const cn = pGradient(x, y * 2.5, { w, h: h * 2.5, cells: Math.max(1, Math.round(w / 24)), cellsY: Math.max(1, Math.round(h / 10)), octaves: 3, seed });
      const lim = 1 - clouds * 0.45 - (v > 0.7 ? -0.2 : 0);
      if (cn > lim) c = cloud[cn > lim + 0.08 ? 0 : Math.min(cloud.length - 1, 1)];
    }
    if (o.stars && v > 0.45) {
      const hsh = ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519)) >>> 0) / 4294967296;
      if (hsh < o.stars) c = cloud[0];
    }
    g.set(x, y, c);
  }
  if (o.ridge && dir.pal[o.ridge]) {
    const r = dir.pal[o.ridge];
    for (let x = 0; x < w; x++) {
      const top = h - Math.round(h * (0.12 + 0.18 * pGradient(x, 0, { w, h: 1, cells: Math.max(1, Math.round(w / 32)), cellsY: 1, octaves: 3, seed: seed + 9 })));
      for (let y = top; y < h; y++) g.set(x, y, r[Math.min(r.length - 1, y === top ? r.length - 2 : r.length - 1)]);
    }
  }
  return g;
}
function fpRole(kind, surface) {
  if (kind === "viewmodel") return "viewmodel";
  if (kind === "layer") return "sky";
  if (kind === "texture" || kind === "tile" || kind === "tileset") return surface ?? (kind === "texture" ? "wall" : "floor");
  return "billboard";
}
function fpShots(dir, kind, frames, o = {}) {
  const dc = dirContext(dir), w = o.w ?? 128, h = o.h ?? 80, role = fpRole(kind, o.surface);
  const base = {
    wall: material("stone", dc, { w: 32, h: 32 }).grid,
    floor: material("dirt", dc, { w: 32, h: 32, seed: 3 }).grid,
    ceiling: material("stone", dc, { w: 32, h: 32, seed: 5, range: [1, 2] }).grid
  };
  const ro = { w, h, fog: dir.background ?? "#000000", fogDist: 8 };
  if (role === "billboard") {
    const spots = [[4.5, 4.4], [3.4, 2.6], [5.6, 2.4]];
    return [raycast({ ...base, sprites: frames.slice(0, 3).map((g, i) => ({ grid: g, x: spots[i][0], y: spots[i][1], height: 0.85 * (g.h / Math.max(g.w, g.h)) })) }, ro)];
  }
  return frames.slice(0, 3).map((g) => {
    if (role === "viewmodel") return raycast({ ...base, viewmodel: g }, ro);
    if (role === "sky") return raycast({ ...base, ceiling: void 0, sky: g }, ro);
    return raycast({ ...base, [role]: g }, ro);
  });
}
var CORRIDOR, texel;
var init_fp = __esm({
  "../artgen-core/src/views/fp.ts"() {
    "use strict";
    init_direction();
    init_materials();
    init_color();
    init_grid();
    init_noise();
    CORRIDOR = [
      "#########",
      "###...###",
      "##.....##",
      "###...###",
      "##.....##",
      "###...###",
      "###...###",
      "#########"
    ];
    texel = (g, u, v) => {
      const x = (Math.floor(u * g.w) % g.w + g.w) % g.w, y = (Math.floor(v * g.h) % g.h + g.h) % g.h, i = (y * g.w + x) * 4;
      return [g.d[i], g.d[i + 1], g.d[i + 2], g.d[i + 3]];
    };
  }
});

// ../artgen-core/src/anim/anim.ts
function ease(name = "linear", u) {
  u = Math.max(0, Math.min(1, u));
  switch (name) {
    case "in":
      return u * u;
    case "out":
      return 1 - (1 - u) * (1 - u);
    case "inOut":
      return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    case "smooth":
      return u * u * (3 - 2 * u);
    case "step":
      return 0;
    default:
      return u;
  }
}
function lerpVal(a, b, u) {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v + ((b[i] ?? v) - v) * u);
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const out = {};
    for (const k of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[k], y = b[k];
      out[k] = x === void 0 ? y : y === void 0 ? x : lerpVal(x, y, u);
    }
    return out;
  }
  return u < 1 ? a : b;
}
function track(keys, t, o = {}) {
  if (!keys.length) throw new Error("track: no keys");
  const ks = [...keys].sort((a, b) => a[0] - b[0]), loop = o.loop ?? true;
  if (ks.length === 1) return ks[0][1];
  const tt = loop ? (t % 1 + 1) % 1 : Math.max(0, Math.min(1, t));
  for (let i = 0; i < ks.length; i++) {
    const [ta, va] = ks[i], next = ks[i + 1] ?? (loop ? [ks[0][0] + 1, ks[0][1]] : void 0);
    if (!next) return va;
    if (tt < ta && i === 0) {
      if (!loop) return va;
      const [tl, vl] = ks[ks.length - 1], span = ta + 1 - tl;
      return lerpVal(vl, va, ease(o.ease, (tt + 1 - tl) / span));
    }
    if (tt >= ta && tt < next[0]) return lerpVal(va, next[1], ease(o.ease, (tt - ta) / (next[0] - ta)));
  }
  return ks[ks.length - 1][1];
}
function solveTwoBone(s2, l1, l2, target, bend = 1) {
  const v = sub(target, s2), d = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min(l1 + l2 - 1e-6, len2(v) || 1e-6));
  const theta = angOf(len2(v) ? v : [0, 1]);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) / RAD;
  const a1 = theta + bend * alpha, joint = add(s2, dirOf(a1), l1);
  const toT = sub(add(s2, dirOf(theta), d), joint);
  return [a1, angOf(toT)];
}
function rig(def) {
  const names = Object.keys(def.bones), order = [], seen = /* @__PURE__ */ new Set();
  const visit = (n, path = []) => {
    if (seen.has(n)) return;
    if (path.includes(n)) throw new Error(`rig: bone cycle ${[...path, n].join(" \u2192 ")}`);
    const p = def.bones[n].parent;
    if (p !== void 0) {
      if (!def.bones[p]) throw new Error(`rig: bone ${n} has unknown parent ${p}`);
      visit(p, [...path, n]);
    }
    seen.add(n);
    order.push(n);
  };
  names.forEach((n) => visit(n));
  const fk = (rel3, root) => {
    const out = {};
    for (const n of order) {
      const b = def.bones[n], par = b.parent ? out[b.parent] : void 0;
      const base = par ? add(par.a, sub(par.b, par.a), b.at ?? 1) : root;
      const a = b.offset ? add(base, b.offset) : base, angle = (par?.angle ?? 0) + rel3[n];
      out[n] = { name: n, a, b: add(a, dirOf(angle), b.len), angle, len: b.len };
    }
    return out;
  };
  return {
    def,
    order,
    pose(angles = {}, o = {}) {
      const rel3 = {};
      for (const n of order) rel3[n] = angles[n] ?? def.bones[n].angle ?? 0;
      const root = o.root ?? def.root;
      let bones = fk(rel3, root);
      for (const [end, { target, bend = 1 }] of Object.entries(o.ik ?? {})) {
        const lo = def.bones[end], up = lo?.parent;
        if (!lo || !up) throw new Error(`rig: IK needs an end bone with a parent (${end})`);
        if ((lo.at ?? 1) !== 1 || lo.offset) throw new Error(`rig: IK bone ${end} must start at its parent's end`);
        const gp = def.bones[up].parent, s2 = bones[up].a, [a1, a2] = solveTwoBone(s2, def.bones[up].len, lo.len, target, bend);
        rel3[up] = a1 - (gp ? bones[gp].angle : 0);
        rel3[end] = a2 - a1;
        bones = fk(rel3, root);
      }
      const get = (n) => {
        const b = bones[n];
        if (!b) throw new Error(`rig: no bone ${n}`);
        return b;
      };
      return {
        bones,
        angles: rel3,
        end: (n) => get(n).b,
        start: (n) => get(n).a,
        bone: get,
        along(n, u, side = 0) {
          const b = get(n), d = sub(b.b, b.a), l = len2(d) || 1;
          return [b.a[0] + d[0] * u + -d[1] / l * side, b.a[1] + d[1] * u + d[0] / l * side];
        }
      };
    }
  };
}
function spring(o) {
  const n = o.n, L = (i) => Array.isArray(o.len) ? o.len[i] ?? o.len[o.len.length - 1] : o.len;
  const R2 = (i) => Array.isArray(o.rest) ? o.rest[i] ?? 0 : i === 0 ? o.rest ?? 0 : 0;
  const k = o.stiffness ?? 0.2, damp = o.damping ?? 0.08, g = o.gravity ?? 400, wind = o.wind ?? 0, gust = o.gust ?? 0.5, step = o.step ?? 1e3 / 60;
  return {
    at(ms, rootAt, opt = {}) {
      const warm = opt.warm ?? 1e3, steps = Math.max(0, Math.round((ms + warm) / step)), t0 = ms - steps * step, dt = step / 1e3;
      const r0 = rootAt(t0), pts = [r0.pos], prev = [r0.pos];
      let a = r0.angle ?? 0;
      for (let i = 0; i < n; i++) {
        a += R2(i);
        const p = add(pts[i], dirOf(a), L(i));
        pts.push(p);
        prev.push(p);
      }
      const r = rng(o.seed ?? 1);
      let w = 0;
      for (let s2 = 1; s2 <= steps; s2++) {
        const t = t0 + s2 * step, root = rootAt(t);
        w += (r() - 0.5) * 0.3;
        w *= 0.97;
        const fx = wind * (1 + gust * w * 2);
        pts[0] = root.pos;
        prev[0] = root.pos;
        let ang = root.angle ?? 0;
        for (let i = 1; i <= n; i++) {
          const p = pts[i], v = sub(p, prev[i]);
          prev[i] = p;
          let q = [p[0] + v[0] * (1 - damp) + fx * dt * dt, p[1] + v[1] * (1 - damp) + g * dt * dt];
          ang += R2(i - 1);
          const want = add(pts[i - 1], dirOf(ang), L(i - 1));
          q = [q[0] + (want[0] - q[0]) * k, q[1] + (want[1] - q[1]) * k];
          const d = sub(q, pts[i - 1]), l = len2(d) || 1;
          q = add(pts[i - 1], d, L(i - 1) / l);
          pts[i] = q;
          ang = angOf(sub(q, pts[i - 1]));
        }
      }
      const base = pts[0];
      return pts.map((p) => [p[0] - base[0], p[1] - base[1]]);
    }
  };
}
function sweep(fn, t, span, n = 6) {
  return Array.from({ length: n }, (_, i) => fn(t - span + span * i / Math.max(1, n - 1)));
}
function cellTiming(d, frames, sub2, durations) {
  const logical = Math.floor(d / sub2), s2 = d % sub2;
  let ms = 0;
  for (let i = 0; i < logical; i++) ms += durations[i];
  ms += durations[logical] * s2 / sub2;
  return { logical, sub: s2, ms, duration: durations.slice(0, frames).reduce((a, b) => a + b, 0) };
}
var blend, pingpong, RAD, dirOf, angOf, add, sub, len2;
var init_anim = __esm({
  "../artgen-core/src/anim/anim.ts"() {
    "use strict";
    init_rng();
    blend = (keys, t, o = {}) => track(Object.entries(keys).map(([k, v]) => [+k, v]), t, o);
    pingpong = (t) => {
      const u = (t % 1 + 1) % 1;
      return u < 0.5 ? u * 2 : 2 - u * 2;
    };
    RAD = Math.PI / 180;
    dirOf = (deg) => [Math.sin(deg * RAD), Math.cos(deg * RAD)];
    angOf = (v) => Math.atan2(v[0], v[1]) / RAD;
    add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
    sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    len2 = (v) => Math.hypot(v[0], v[1]);
  }
});

// ../artgen-core/src/fx/particles.ts
function colorRun(dir, colors) {
  const names = colors?.length ? colors : dir.effects.palette.length ? dir.effects.palette : ["accent"];
  const out = [];
  for (const n of names) {
    const [name, idx] = n.split("."), ramp = dir.pal[name] ?? dir.pal[dir.palette.materials[name]];
    if (!ramp) throw new Error(`particles: unknown colour ${JSON.stringify(n)}`);
    if (idx === void 0) out.push(...ramp);
    else {
      const i = idx === "last" ? ramp.length - 1 : +idx;
      if (!ramp[i]) throw new Error(`particles: colour out of range ${n}`);
      out.push(ramp[i]);
    }
  }
  return out;
}
function simulate(dir, o) {
  const T = o.t * o.duration, step = o.step ?? 1e3 / 60, out = [];
  o.layers.forEach((L, li) => {
    const run = colorRun(dir, L.colors), [b0, b1] = L.band ?? [0, 1];
    const lo = Math.floor(b0 * (run.length - 1) + 1e-9), hi = Math.max(lo, Math.ceil(b1 * (run.length - 1) - 1e-9));
    const cols = run.slice(lo, hi + 1), period = L.period ?? o.duration, origin = L.origin ?? [o.w / 2, o.h / 2];
    for (let i = 0; i < L.count; i++) {
      const r = rng((o.seed ?? 1) * 7919 + (L.seed ?? 0) * 104729 + li * 1543 + i * 31 >>> 0);
      r();
      const life = Math.max(1, pick(r, L.life, o.duration * 0.6));
      const birth0 = L.mode === "stream" ? (i + r() * 0.8) / L.count * period : pick(r, L.delay, 0);
      const ang = (L.angle ?? 180) + (r() - 0.5) * (L.spread ?? 360), sp = pick(r, L.speed, 20);
      let sx, sy;
      if (L.path?.length) {
        const u = (i + 0.5) / L.count, seg = u * (L.path.length - 1), k = Math.min(L.path.length - 2, Math.floor(seg)), f = seg - k;
        const a = L.path[k], b = L.path[k + 1] ?? a;
        sx = a[0] + (b[0] - a[0]) * f;
        sy = a[1] + (b[1] - a[1]) * f;
      } else {
        const ar = L.area ?? 0, [ax, ay] = typeof ar === "number" ? [ar, ar] : ar, th = r() * Math.PI * 2, rr = Math.sqrt(r());
        sx = origin[0] + Math.cos(th) * ax * rr;
        sy = origin[1] + Math.sin(th) * ay * rr;
      }
      const jit = 1 + (r() - 0.5) * 2 * (L.sizeJitter ?? 0.25), turb = (r() - 0.5) * 2 * (L.turbulence ?? 0), phase = r() * Math.PI * 2;
      const ages = [];
      if (L.mode === "stream") {
        for (let k = 0; ; k++) {
          const a = ((T - birth0) % period + period) % period + k * period;
          if (a >= life) break;
          ages.push(a);
        }
      } else if (T - birth0 >= 0 && T - birth0 < life) ages.push(T - birth0);
      for (const age of ages) {
        let x = sx, y = sy, vx = Math.sin(ang * RAD2) * sp, vy = Math.cos(ang * RAD2) * sp;
        const n = Math.round(age / step), dt = step / 1e3, keep = Math.exp(-(L.drag ?? 0) * dt), sw = (L.swirl ?? 0) * RAD2 * dt;
        const back = L.streakPath ? Math.round((L.streak ?? 0.08) * 1e3 / step) : -1;
        let pathTail = [x, y];
        for (let s2 = 0; s2 < n; s2++) {
          if (s2 === n - back) pathTail = [x, y];
          if (sw) {
            const c = Math.cos(sw), sn = Math.sin(sw), nx = vx * c - vy * sn;
            vy = vx * sn + vy * c;
            vx = nx;
          }
          vx *= keep;
          vy = vy * keep + (L.gravity ?? 0) * dt;
          const wob = turb ? turb * Math.sin(phase + s2 * dt * 9) : 0;
          x += (vx + wob) * dt;
          y += vy * dt;
        }
        const u = age / life, [s0, s1] = L.size ?? [1.5, 0.5], rad = Math.max(0, (s0 + (s1 - s0) * u) * jit);
        const ci = Math.min(cols.length - 1, Math.floor(Math.pow(u, L.curve ?? 1) * cols.length));
        const tail = L.shape !== "streak" ? void 0 : L.streakPath ? pathTail : [x - vx * (L.streak ?? 0.08), y - vy * (L.streak ?? 0.08)];
        out.push({
          x,
          y,
          vx,
          vy,
          r: rad,
          color: cols[ci],
          rank: lo + ci,
          shape: L.shape ?? "disc",
          ...tail && { tail },
          ...L.head && { head: true },
          layer: li,
          life: 1 - u,
          ...L.blob && { blob: { run: cols, threshold: typeof L.blob === "number" ? L.blob : 0.5, heat: L.heat ?? 1.6 } }
        });
      }
    }
  });
  return out;
}
function drawBlobs(g, ps) {
  const { run, threshold, heat } = ps[0].blob, n = run.length, D = new Float32Array(g.w * g.h), H = new Float32Array(g.w * g.h);
  for (const p of ps) {
    const R2 = Math.max(0.8, p.r) * 1.35;
    for (let y = Math.max(0, Math.floor(p.y - R2)); y <= Math.min(g.h - 1, p.y + R2); y++) for (let x = Math.max(0, Math.floor(p.x - R2)); x <= Math.min(g.w - 1, p.x + R2); x++) {
      const q = ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2) / (R2 * R2);
      if (q >= 1) continue;
      const k = (1 - q) * (1 - q), i = y * g.w + x;
      D[i] += k;
      H[i] += k * (0.25 + 0.75 * p.life);
    }
  }
  for (let i = 0; i < D.length; i++) {
    if (D[i] < threshold) continue;
    const idx = Math.max(0, Math.min(n - 1, n - 1 - Math.floor(H[i] / heat * n)));
    g.set(i % g.w, i / g.w | 0, run[idx]);
  }
}
function drawParticles(g, ps) {
  const blobs = /* @__PURE__ */ new Map();
  for (const p of ps) if (p.blob) {
    if (!blobs.has(p.layer)) blobs.set(p.layer, []);
    blobs.get(p.layer).push(p);
  }
  for (const k of [...blobs.keys()].sort((a, b) => a - b)) drawBlobs(g, blobs.get(k));
  const order = ps.filter((p) => !p.blob).sort((a, b) => b.rank - a.rank || b.r - a.r);
  for (const p of order) {
    const { x, y, r, color: c } = p;
    if (p.shape === "pixel" || r < 0.6) {
      g.set(Math.floor(x), Math.floor(y), c);
      continue;
    }
    if (p.shape === "streak" && p.tail) {
      const [tx, ty] = p.tail, n = Math.max(1, Math.ceil(Math.hypot(x - tx, y - ty)));
      for (let k = 0; k <= n; k++) g.set(Math.floor(tx + (x - tx) * k / n), Math.floor(ty + (y - ty) * k / n), c);
      if (!p.head || r < 0.6) continue;
    }
    if (p.shape === "plus") {
      const R2 = Math.max(1, Math.round(r)), cx = Math.floor(x), cy = Math.floor(y);
      for (let k = -R2; k <= R2; k++) {
        g.set(cx + k, cy, c);
        g.set(cx, cy + k, c);
      }
      continue;
    }
    for (let py = Math.floor(y - r - 1); py <= y + r + 1; py++) for (let px = Math.floor(x - r - 1); px <= x + r + 1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y;
      const inside = p.shape === "diamond" ? Math.abs(dx) + Math.abs(dy) <= r : dx * dx + dy * dy <= r * r;
      if (!inside) continue;
      if (p.shape === "ring" && dx * dx + dy * dy < (r - 1.2) * (r - 1.2)) continue;
      g.set(px, py, c);
    }
  }
  return g;
}
function particles(dir, o) {
  const g = drawParticles(new Grid(o.w, o.h), simulate(dir, o));
  return o.line ? o.line(g) : g;
}
function preset(name, o, override = {}) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown particle preset ${JSON.stringify(name)} (have: ${PRESET_NAMES.join(", ")})`);
  return p(o).map((l) => ({ ...l, ...override }));
}
function paletteCycle(dir, g, colors, shift) {
  const run = colorRun(dir, colors), n = run.length, at = new Map(run.map((c, i) => [c, i]));
  const out = g.clone(), s2 = (Math.round(shift) % n + n) % n;
  if (!s2) return out;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) !== 255) continue;
    const i = at.get(g.get(x, y));
    if (i !== void 0) out.set(x, y, run[(i + s2) % n]);
  }
  if (g.normal) out.normal = g.normal;
  return out;
}
function flame(dir, o) {
  const { w, h } = o, g = new Grid(w, h), run = colorRun(dir, o.colors), n = run.length, [bx, by] = o.base ?? [w / 2, h - 2];
  const W3 = o.width ?? w * 0.32, H = o.height ?? h * 0.8, cells = o.cells ?? 3, lick = o.lick ?? 0.9, sway = o.sway ?? W3 * 0.25, seed = o.seed ?? 1;
  const tau = o.t * Math.PI * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (by - (y + 0.5)) / H;
    if (v < -0.25 || v > 1.2) continue;
    const hw = v < 0 ? W3 * Math.sqrt(Math.max(0, 1 - (v / 0.25) ** 2)) : W3 * Math.pow(Math.max(0, 1 - v), 0.75);
    const cx = bx + Math.sin(v * 3.2 - tau) * sway * Math.max(0, v);
    const d = hw > 0 ? Math.abs(x + 0.5 - cx) / hw : 9;
    const nz = pValue(x, y + o.t * h, { w, h, cells, cellsY: cells, octaves: 2, seed }) - 0.5;
    const S3 = 1 - d - Math.max(0, v) * 0.45 + nz * lick * (0.35 + Math.max(0, v));
    if (S3 <= 0) continue;
    const B = 1 - d * 1.15 - Math.max(0, v) * 0.75 + nz * lick * 0.25;
    const idx = S3 < 0.14 ? n - 1 : Math.max(0, Math.min(n - 1, n - 1 - Math.floor(Math.max(0, B) * n * 1.05)));
    g.set(x, y, run[idx]);
  }
  return g;
}
var RAD2, pick, PRESETS, PRESET_NAMES;
var init_particles = __esm({
  "../artgen-core/src/fx/particles.ts"() {
    "use strict";
    init_grid();
    init_rng();
    init_noise();
    RAD2 = Math.PI / 180;
    pick = (r, v, d) => v === void 0 ? d : typeof v === "number" ? v : v[0] + r() * (v[1] - v[0]);
    PRESETS = {
      explosion(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], d = o.density ?? 1, D = o.duration;
        return [
          // the flash: one hot core for the first frames
          { origin: c, count: 1, speed: 0, life: D * 0.2, size: [R2 * 0.55, R2 * 0.4], band: [0, 0.25], colors: o.colors },
          // fireballs flung out, cooling from the edge in
          { origin: c, count: Math.round(14 * d), area: R2 * 0.2, speed: [R2 * 3, R2 * 6], drag: 4.5, life: [D * 0.4, D * 0.85], size: [R2 * 0.36, R2 * 0.1], curve: 0.9, blob: true, colors: o.colors, seed: 1 },
          { origin: c, count: Math.round(8 * d), area: R2 * 0.1, speed: [R2 * 5, R2 * 9], drag: 2.5, gravity: R2 * 3, life: [D * 0.3, D * 0.6], shape: "streak", streak: 0.04, band: [0, 0.45], colors: o.colors, seed: 2 },
          // smoke rising late
          { origin: c, count: Math.round(5 * d), area: R2 * 0.45, speed: [R2 * 0.3, R2 * 0.8], drag: 2, gravity: -R2 * 1.2, delay: [D * 0.3, D * 0.45], life: [D * 0.4, D * 0.55], size: [R2 * 0.12, R2 * 0.22], band: [0.75, 1], colors: o.colors, seed: 3 }
        ];
      },
      smoke(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.88], D = o.duration;
        return [{ origin: c, mode: "stream", count: Math.round(9 * (o.density ?? 1)), area: [R2 * 0.2, R2 * 0.06], angle: 180, spread: 26, speed: [R2 * 2.6, R2 * 3.4], turbulence: R2 * 0.8, drag: 0.8, life: [D * 0.7, D * 0.95], size: [R2 * 0.14, R2 * 0.34], band: [0.6, 1], blob: true, heat: 2.2, colors: o.colors }];
      },
      fire(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.9], D = o.duration;
        return [
          // tongues: born wide at the base, rising fast and thinning to dark tips
          { origin: c, mode: "stream", count: Math.round(26 * (o.density ?? 1)), area: [R2 * 0.5, R2 * 0.05], angle: 180, spread: 12, speed: [R2 * 2.6, R2 * 3.8], gravity: -R2, turbulence: R2 * 0.9, drag: 0.3, life: [D * 0.45, D * 0.95], size: [R2 * 0.42, R2 * 0.16], blob: 0.4, heat: 3, colors: o.colors },
          // embers
          { origin: [c[0], c[1] - R2 * 0.5], mode: "stream", count: Math.round(3 * (o.density ?? 1)), area: R2 * 0.3, angle: 180, spread: 40, speed: [R2 * 3.5, R2 * 5], turbulence: R2 * 1.5, life: [D * 0.4, D * 0.6], shape: "pixel", band: [0, 0.5], colors: o.colors, seed: 4 }
        ];
      },
      sparks(o) {
        const R2 = Math.min(o.w, o.h) * 0.45 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
        return [{ origin: c, count: Math.round(12 * (o.density ?? 1)), area: 0.5, angle: o.angle ?? 180, spread: o.angle === void 0 ? 360 : 110, speed: [R2 * 2.5, R2 * 5], drag: 2.2, gravity: R2 * 4, life: [D * 0.35, D * 0.9], shape: "streak", streak: 0.045, band: [0, 0.6], curve: 1.6, colors: o.colors }];
      },
      magic(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
        return [
          { origin: c, mode: "stream", count: Math.round(12 * (o.density ?? 1)), area: R2 * 0.9, angle: 90, spread: 360, speed: [R2 * 0.8, R2 * 1.2], swirl: 300, gravity: -R2 * 0.6, life: [D * 0.5, D * 0.9], shape: "diamond", size: [R2 * 0.14, R2 * 0.04], colors: o.colors },
          { origin: c, mode: "stream", count: Math.round(5 * (o.density ?? 1)), area: R2 * 0.3, speed: [0, R2 * 0.2], life: [D * 0.3, D * 0.6], size: [R2 * 0.2, R2 * 0.05], band: [0, 0.4], colors: o.colors, seed: 5 }
        ];
      },
      heal(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.8], D = o.duration;
        return [
          { origin: c, mode: "stream", count: Math.round(7 * (o.density ?? 1)), area: [R2 * 0.8, R2 * 0.15], angle: 180, spread: 8, speed: [R2 * 1.2, R2 * 1.8], life: [D * 0.6, D * 0.9], shape: "plus", size: [R2 * 0.14, R2 * 0.08], curve: 0.7, colors: o.colors },
          { origin: c, mode: "stream", count: Math.round(8 * (o.density ?? 1)), area: [R2 * 0.9, R2 * 0.2], angle: 180, spread: 10, speed: [R2 * 1.5, R2 * 2.4], life: [D * 0.3, D * 0.6], shape: "pixel", band: [0, 0.5], colors: o.colors, seed: 7 }
        ];
      },
      muzzle(o) {
        const R2 = Math.min(o.w, o.h) * 0.45 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], a = o.angle ?? 180, D = o.duration;
        return [
          { origin: c, count: 1, speed: 0, life: D * 0.34, size: [R2 * 0.42, R2 * 0.3], band: [0, 0.3], colors: o.colors },
          { origin: c, count: Math.round(7 * (o.density ?? 1)), angle: a, spread: 50, speed: [R2 * 5, R2 * 9], drag: 6, life: [D * 0.25, D * 0.5], size: [R2 * 0.24, R2 * 0.06], curve: 0.8, colors: o.colors, seed: 9 },
          { origin: c, count: Math.round(5 * (o.density ?? 1)), angle: a, spread: 110, speed: [R2 * 6, R2 * 10], drag: 5, life: [D * 0.2, D * 0.4], shape: "streak", streak: 0.03, band: [0, 0.5], colors: o.colors, seed: 10 }
        ];
      },
      impact(o) {
        const R2 = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
        return [
          { origin: c, count: 1, speed: 0, life: D * 0.75, shape: "ring", size: [R2 * 0.3, R2 * 1.05], curve: 0.9, colors: o.colors },
          { origin: c, count: 1, speed: 0, life: D * 0.3, size: [R2 * 0.38, R2 * 0.12], band: [0, 0.3], colors: o.colors, seed: 11 },
          { origin: c, count: Math.round(8 * (o.density ?? 1)), speed: [R2 * 3, R2 * 5], drag: 4, life: [D * 0.3, D * 0.6], shape: "streak", streak: 0.04, band: [0, 0.6], colors: o.colors, seed: 12 }
        ];
      },
      splash(o) {
        const R2 = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.8], D = o.duration;
        return [
          { origin: c, count: Math.round(12 * (o.density ?? 1)), area: [R2 * 0.3, 0.5], angle: o.angle ?? 180, spread: 100, speed: [R2 * 2.5, R2 * 4.2], gravity: R2 * 9, life: [D * 0.6, D * 0.95], size: [R2 * 0.16, R2 * 0.07], curve: 1.3, colors: o.colors },
          { origin: c, count: 1, speed: 0, life: D * 0.6, shape: "ring", size: [R2 * 0.3, R2 * 0.9], colors: o.colors, seed: 13 }
        ];
      },
      dust(o) {
        const R2 = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.85], D = o.duration;
        return [
          { origin: c, count: Math.round(8 * (o.density ?? 1)), area: [R2 * 0.4, R2 * 0.08], angle: 90, spread: 360, speed: [R2 * 1.2, R2 * 2], drag: 3, gravity: -R2 * 0.4, life: [D * 0.6, D], size: [R2 * 0.14, R2 * 0.3], band: [0.5, 1], colors: o.colors }
        ];
      },
      trail(o) {
        const R2 = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), D = o.duration, path = o.path ?? [[o.w * 0.1, o.h / 2], [o.w * 0.9, o.h / 2]];
        return [{ path, mode: "stream", count: Math.round(14 * (o.density ?? 1)), speed: [0, R2 * 0.25], life: [D * 0.5, D], size: [R2 * 0.16, 0.2], curve: 0.9, colors: o.colors }];
      }
    };
    PRESET_NAMES = Object.keys(PRESETS);
  }
});

// ../artgen-core/src/t2/geom.ts
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function rotate(deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s2 = Math.sin(r);
  return [c, s2, -s2, c, 0, 0];
}
function specMatrix(t) {
  let m = IDENTITY;
  const [ox, oy] = t.origin ?? [0, 0];
  if (t.scale !== void 0 || t.flip) {
    const [sx, sy] = typeof t.scale === "number" ? [t.scale, t.scale] : t.scale ?? [1, 1];
    m = mul(about(scale(t.flip === "x" ? -sx : sx, t.flip === "y" ? -sy : sy), ox, oy), m);
  }
  if (t.rotate) m = mul(about(rotate(t.rotate), ox, oy), m);
  if (t.translate) m = mul(translate(t.translate[0], t.translate[1]), m);
  return m;
}
function parsePath(d, tol = 0.5) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out = [];
  let i = 0, cmd = "", cur = [0, 0], start = [0, 0], sub2 = null, lastCtrl = null, lastCmd = "";
  const num2 = () => {
    const t = toks[i++];
    if (t === void 0 || /^[a-zA-Z]$/.test(t)) throw new Error(`path: expected a number near token ${i} in "${d.slice(0, 40)}"`);
    return +t;
  };
  const pt = (rel3) => {
    const x = num2(), y = num2();
    return rel3 ? [cur[0] + x, cur[1] + y] : [x, y];
  };
  const lineTo = (p) => {
    if (!sub2) {
      sub2 = [cur];
      out.push(sub2);
    }
    sub2.push(p);
    cur = p;
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) throw new Error(`path: data must start with a command: "${d.slice(0, 40)}"`);
    const rel3 = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "M") {
      cur = pt(rel3);
      start = cur;
      sub2 = [cur];
      out.push(sub2);
      cmd = rel3 ? "l" : "L";
      lastCtrl = null;
      lastCmd = "M";
      continue;
    }
    if (C === "Z") {
      if (sub2) {
        sub2.push(start);
      }
      cur = start;
      sub2 = null;
      lastCtrl = null;
      lastCmd = "Z";
      continue;
    }
    if (C === "L") lineTo(pt(rel3));
    else if (C === "H") {
      const x = num2();
      lineTo([rel3 ? cur[0] + x : x, cur[1]]);
    } else if (C === "V") {
      const y = num2();
      lineTo([cur[0], rel3 ? cur[1] + y : y]);
    } else if (C === "C" || C === "S") {
      const p0 = cur;
      let c1;
      if (C === "C") c1 = pt(rel3);
      else c1 = lastCtrl && (lastCmd === "C" || lastCmd === "S") ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
      const c2 = pt(rel3), p3 = pt(rel3);
      const n = segs(Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]), tol);
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        lineTo([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
      }
      lastCtrl = c2;
    } else if (C === "Q" || C === "T") {
      const p0 = cur;
      const c = C === "Q" ? pt(rel3) : lastCtrl && (lastCmd === "Q" || lastCmd === "T") ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
      const p2 = pt(rel3);
      const n = segs(Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p2[0] - c[0], p2[1] - c[1]), tol);
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        lineTo([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
      }
      lastCtrl = c;
    } else if (C === "A") {
      const rx0 = num2(), ry0 = num2(), rotDeg = num2(), large = num2(), sweep2 = num2(), p = pt(rel3);
      arcTo(cur, p, rx0, ry0, rotDeg, !!large, !!sweep2, tol).forEach(lineTo);
      lastCtrl = null;
    } else throw new Error(`path: unsupported command ${cmd}`);
    lastCmd = C;
  }
  return out.filter((s2) => s2.length > 1);
}
function arcTo(p0, p1, rx, ry, rotDeg, large, sweep2, tol) {
  if (!rx || !ry) return [p1];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = rotDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2, x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
  const lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = (large === sweep2 ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
  const cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
  const cx = cp * cx1 - sp * cy1 + (p0[0] + p1[0]) / 2, cy = sp * cx1 + cp * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep2 && dt > 0) dt -= 2 * Math.PI;
  else if (sweep2 && dt < 0) dt += 2 * Math.PI;
  const n = segs(Math.abs(dt) * Math.max(rx, ry), tol), out = [];
  for (let k = 1; k <= n; k++) {
    const t = t1 + dt * k / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push(k === n ? p1 : [cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
  return out;
}
function ellipsePts(cx, cy, rx, ry, tol = 0.25, a0 = 0, a1 = 360) {
  const sweep2 = (a1 - a0) * Math.PI / 180, n = segs(Math.abs(sweep2) * Math.max(rx, ry), tol), out = [];
  for (let k = 0; k <= n; k++) {
    const t = a0 * Math.PI / 180 + sweep2 * k / n;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  if (Math.abs(a1 - a0) >= 360) out.pop();
  return out;
}
function rectPts(x, y, w, h, r = 0, tol = 0.25) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return [
    ...ellipsePts(x + w - r, y + r, r, r, tol, -90, 0),
    ...ellipsePts(x + w - r, y + h - r, r, r, tol, 0, 90),
    ...ellipsePts(x + r, y + h - r, r, r, tol, 90, 180),
    ...ellipsePts(x + r, y + r, r, r, tol, 180, 270)
  ];
}
function capsulePts(a, b, r0, r1 = r0, tol = 0.25) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 1e-6) return ellipsePts(a[0], a[1], Math.max(r0, r1), Math.max(r0, r1), tol);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const off = Math.asin(Math.max(-1, Math.min(1, (r0 - r1) / len))) * 180 / Math.PI;
  return [...ellipsePts(b[0], b[1], r1, r1, tol, ang - 90 + off, ang + 90 - off), ...ellipsePts(a[0], a[1], r0, r0, tol, ang + 90 - off, ang + 270 + off)];
}
function starPts(cx, cy, r, r2, n, rotDeg = -90) {
  const out = [];
  for (let k = 0; k < n * 2; k++) {
    const t = (rotDeg + k * 180 / n) * Math.PI / 180, rr = k % 2 ? r2 : r;
    out.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
  }
  return out;
}
function fillPolygons(m, rings, rule = "nonzero") {
  const s2 = m.s, edges = [];
  let ymin = Infinity, ymax = -Infinity;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] === b[1]) continue;
    const dir = b[1] > a[1] ? 1 : -1, [p, q] = dir > 0 ? [a, b] : [b, a];
    edges.push([p[0] * s2, p[1] * s2, q[0] * s2, q[1] * s2, dir]);
    ymin = Math.min(ymin, p[1] * s2);
    ymax = Math.max(ymax, q[1] * s2);
  }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(m.h - 1, Math.ceil(ymax));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const [ax, ay, bx, by, dir] of edges) if (sy >= ay && sy < by) xs.push([ax + (sy - ay) * (bx - ax) / (by - ay), dir]);
    if (!xs.length) continue;
    xs.sort((u, v) => u[0] - v[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += rule === "evenodd" ? 1 : xs[k][1];
      const inside = rule === "evenodd" ? wind % 2 === 1 : wind !== 0;
      if (!inside) continue;
      const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(m.w - 1, Math.ceil(xs[k + 1][0] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) m.d[y * m.w + x] = 1;
    }
  }
  return m;
}
function edt(f, w, h, sqrt) {
  const n = Math.max(w, h), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n);
  const pass = (len, get, set) => {
    for (let i = 0; i < len; i++) g[i] = get(i);
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s2 = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s2 <= z[k]) {
        k--;
        s2 = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s2;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + g[v[k]];
    }
    for (let i = 0; i < len; i++) set(i, d[i]);
  };
  const out = Float32Array.from(f);
  for (let x = 0; x < w; x++) pass(h, (i) => out[i * w + x], (i, val) => {
    out[i * w + x] = val;
  });
  for (let y = 0; y < h; y++) pass(w, (i) => out[y * w + i], (i, val) => {
    out[y * w + i] = val;
  });
  if (sqrt) for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i]);
  return out;
}
var IDENTITY, translate, scale, about, mirrorX, mirrorY, apply, matScale, segs, Mask;
var init_geom = __esm({
  "../artgen-core/src/t2/geom.ts"() {
    "use strict";
    IDENTITY = [1, 0, 0, 1, 0, 0];
    translate = (x, y) => [1, 0, 0, 1, x, y];
    scale = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
    about = (m, ox, oy) => mul(translate(ox, oy), mul(m, translate(-ox, -oy)));
    mirrorX = (ax) => [-1, 0, 0, 1, 2 * ax, 0];
    mirrorY = (ay) => [1, 0, 0, -1, 0, 2 * ay];
    apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    matScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    segs = (len, tol) => Math.max(4, Math.min(96, Math.ceil(len / tol)));
    Mask = class _Mask {
      w;
      h;
      s;
      d;
      inner;
      constructor(w, h, s2, d) {
        this.w = w;
        this.h = h;
        this.s = s2;
        this.d = d ?? new Uint8Array(w * h);
      }
      has(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1;
      }
      /** Inside test at a point in sprite pixels. */
      at(px, py) {
        return this.has(Math.floor(px * this.s), Math.floor(py * this.s));
      }
      count() {
        let n = 0;
        for (let i = 0; i < this.d.length; i++) n += this.d[i];
        return n;
      }
      any() {
        return this.d.includes(1);
      }
      clone() {
        return new _Mask(this.w, this.h, this.s, this.d.slice());
      }
      or(o) {
        for (let i = 0; i < this.d.length; i++) this.d[i] |= o.d[i];
        this.inner = void 0;
        return this;
      }
      and(o) {
        for (let i = 0; i < this.d.length; i++) this.d[i] &= o.d[i];
        this.inner = void 0;
        return this;
      }
      andNot(o) {
        for (let i = 0; i < this.d.length; i++) this.d[i] &= o.d[i] ^ 1;
        this.inner = void 0;
        return this;
      }
      /** Bounding box in samples, or null when empty. */
      bounds() {
        let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        return x1 < 0 ? null : { x0, y0, x1, y1 };
      }
      /**
       * Run an EDT over the bounding box grown by `m` samples (clamped to the mask): the nearest inside/outside
       * sample of anything that matters always lies in that window, so the result equals a full-canvas transform.
       */
      windowEdt(m, sources, sqrt) {
        const b = this.bounds();
        if (!b) return null;
        const x0 = Math.max(0, b.x0 - m), y0 = Math.max(0, b.y0 - m), x1 = Math.min(this.w - 1, b.x1 + m), y1 = Math.min(this.h - 1, b.y1 + m);
        const ww = x1 - x0 + 1, wh = y1 - y0 + 1, f = new Float32Array(ww * wh);
        for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) f[y * ww + x] = this.d[(y + y0) * this.w + x + x0] === sources ? 0 : 1e20;
        return { dist: edt(f, ww, wh, sqrt), x0, y0, ww, wh };
      }
      /** Distance (in samples) from each inside sample to the nearest outside sample; 0 outside. */
      insideDistance() {
        if (!this.inner) {
          this.inner = new Float32Array(this.w * this.h);
          const e = this.windowEdt(1, 0, true);
          if (e) for (let y = 0; y < e.wh; y++) for (let x = 0; x < e.ww; x++) this.inner[(y + e.y0) * this.w + x + e.x0] = e.dist[y * e.ww + x];
        }
        return this.inner;
      }
      /** Grow by `r` samples (Euclidean). */
      dilate(r) {
        const out = new _Mask(this.w, this.h, this.s), e = this.windowEdt(Math.ceil(r), 1, false), r2 = r * r + 1e-6;
        if (e) {
          for (let y = 0; y < e.wh; y++) for (let x = 0; x < e.ww; x++) if (e.dist[y * e.ww + x] <= r2) out.d[(y + e.y0) * this.w + x + e.x0] = 1;
        }
        return out;
      }
      /** Move by (dx, dy) samples. */
      shift(dx, dy) {
        const out = new _Mask(this.w, this.h, this.s);
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) out.d[ny * this.w + nx] = 1;
        }
        return out;
      }
    };
  }
});

// ../artgen-core/src/t2/scene.ts
var N44, GEOM_TYPES, Scene2D;
var init_scene = __esm({
  "../artgen-core/src/t2/scene.ts"() {
    "use strict";
    init_color();
    init_grid();
    init_iso();
    init_post();
    init_geom();
    init_raster();
    N44 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    GEOM_TYPES = /* @__PURE__ */ new Set(["rect", "ellipse", "circle", "poly", "path", "line", "capsule", "tube", "ring", "arc", "star", "union", "subtract", "intersect"]);
    Scene2D = class {
      w;
      h;
      specs = [];
      opts;
      env;
      warnings = [];
      constructor(w, h, env, opts = {}) {
        this.w = w;
        this.h = h;
        this.env = env;
        this.opts = opts;
      }
      add(...specs) {
        this.specs.push(...specs);
        return this;
      }
      /** Convenience: a group node. */
      group(props, children) {
        return { ...props, type: "group", children };
      }
      get mode() {
        const m = this.opts.mode ?? "auto";
        return m === "auto" ? Math.max(this.w, this.h) <= this.env.dir.pipeline.raster.directMaxPx ? "direct" : "ss" : m;
      }
      /** Samples per pixel at the working resolution. */
      get samples() {
        return this.mode === "ss" ? this.opts.ss ?? this.env.dir.pipeline.raster.ss : 4;
      }
      /** Source lint (R4 no strokes, R11 colours from the direction, unknown types). */
      lint() {
        const out = [], pal = new Set(this.env.palette.map(normHex));
        const walk = (s2, path) => {
          const at = s2.name ? `${path}(${s2.name})` : path;
          if (!GEOM_TYPES.has(s2.type) && s2.type !== "group") out.push(`${at}: unknown type ${JSON.stringify(s2.type)}`);
          for (const k of ["stroke", "strokeWidth", "stroke-width"]) if (k in s2) out.push(`${at}: strokes are not allowed (R4); use a tube/capsule shape, ink or an underlay`);
          const colours = [...Array.isArray(s2.mat) ? s2.mat : [], ...typeof s2.color === "string" && s2.color.startsWith("#") ? [s2.color] : []];
          for (const c of colours) if (!pal.has(normHex(c))) out.push(`${at}: colour ${c} is not in the direction palette for this asset (R11)`);
          s2.children?.forEach((c, i) => walk(c, `${at}.children[${i}]`));
          s2.shapes?.forEach((c, i) => walk(c, `${at}.shapes[${i}]`));
        };
        this.specs.forEach((s2, i) => walk(s2, `[${i}]`));
        return [...out, ...this.warnings];
      }
      resolveMat(m) {
        if (m === void 0) return void 0;
        if (Array.isArray(m)) return m.map(normHex);
        const { pal, palette } = this.env.dir;
        const r = pal[m] ?? pal[palette.materials[m]];
        if (!r) throw new Error(`unknown material ${JSON.stringify(m)} (not a ramp or direction material)`);
        return r;
      }
      resolveColor(c) {
        if (c.startsWith("#") || c.startsWith("rgb")) return normHex(c);
        const { pal, outline: outline2, palette } = this.env.dir;
        if (c === "outline") return outline2;
        const [name, idx] = c.split("."), ramp = pal[name] ?? pal[palette.materials[name]];
        if (!ramp) throw new Error(`unknown colour token ${JSON.stringify(c)}`);
        const i = idx === void 0 ? ramp.length >> 1 : +idx;
        if (!(i >= 0 && i < ramp.length)) throw new Error(`colour token out of range: ${c}`);
        return ramp[i];
      }
      /** Geometry of one shape spec as a mask at the working resolution. */
      shapeMask(s2, M, S3) {
        const W3 = this.w * S3, H = this.h * S3, m = new Mask(W3, H, S3), tol = 0.5 / (S3 * matScale(M));
        const poly = (pts) => pts.map((p) => apply(M, p));
        const fill2 = (rings, rule = "nonzero") => fillPolygons(m, rings.map(poly), rule);
        const num2 = (v, name) => {
          if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${s2.type}${s2.name ? ` ${s2.name}` : ""}: ${name} must be a number`);
          return v;
        };
        switch (s2.type) {
          case "rect":
            return fill2([rectPts(num2(s2.x ?? 0, "x"), num2(s2.y ?? 0, "y"), num2(s2.w, "w"), num2(s2.h, "h"), s2.r ?? 0, tol)]);
          case "ellipse":
            return fill2([ellipsePts(num2(s2.cx, "cx"), num2(s2.cy, "cy"), num2(s2.rx, "rx"), num2(s2.ry ?? s2.rx, "ry"), tol)]);
          case "circle":
            return fill2([ellipsePts(num2(s2.cx, "cx"), num2(s2.cy, "cy"), num2(s2.r, "r"), s2.r, tol)]);
          case "poly":
            return fill2([s2.pts ?? []], s2.fillRule);
          case "path":
            return fill2(parsePath(s2.d ?? "", tol), s2.fillRule);
          case "star":
            return fill2([starPts(num2(s2.cx, "cx"), num2(s2.cy, "cy"), num2(s2.r, "r"), num2(s2.r2, "r2"), num2(s2.n, "n"), s2.rot ?? -90)]);
          case "ring": {
            const cx = num2(s2.cx, "cx"), cy = num2(s2.cy, "cy"), r = num2(s2.r, "r"), w = num2(s2.w, "w");
            return fill2([ellipsePts(cx, cy, r, r, tol), ellipsePts(cx, cy, r - w, r - w, tol).reverse()], "evenodd");
          }
          case "arc": {
            const cx = num2(s2.cx, "cx"), cy = num2(s2.cy, "cy"), r = num2(s2.r, "r"), w = num2(s2.w, "w"), a0 = num2(s2.a0, "a0"), a1 = num2(s2.a1, "a1");
            return fill2([[...ellipsePts(cx, cy, r, r, tol, a0, a1), ...ellipsePts(cx, cy, r - w, r - w, tol, a0, a1).reverse()]]);
          }
          case "line": {
            const a = [num2(s2.x0, "x0") + 0.5, num2(s2.y0, "y0") + 0.5], b = [num2(s2.x1, "x1") + 0.5, num2(s2.y1, "y1") + 0.5], hw = (s2.w ?? 1) / 2;
            const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
            return fill2([[
              [a[0] - ux * hw - uy * hw, a[1] - uy * hw + ux * hw],
              [b[0] + ux * hw - uy * hw, b[1] + uy * hw + ux * hw],
              [b[0] + ux * hw + uy * hw, b[1] + uy * hw - ux * hw],
              [a[0] - ux * hw + uy * hw, a[1] - uy * hw - ux * hw]
            ]]);
          }
          case "capsule": {
            const a = s2.a ?? [num2(s2.x0, "x0"), num2(s2.y0, "y0")], b = s2.b ?? [num2(s2.x1, "x1"), num2(s2.y1, "y1")];
            return fill2([capsulePts(a, b, num2(s2.r, "r"), s2.r1 ?? s2.r, tol)]);
          }
          case "tube": {
            const pts = s2.d ? parsePath(s2.d, tol)[0] ?? [] : s2.pts ?? [];
            const w0 = num2(s2.w, "w"), w1 = s2.w1 ?? w0;
            const lens = pts.map((p, i) => i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0);
            const total = lens.reduce((a, b) => a + b, 0) || 1;
            let acc = 0;
            for (let i = 1; i < pts.length; i++) {
              const ra = (w0 + (w1 - w0) * acc / total) / 2;
              acc += lens[i];
              const rb = (w0 + (w1 - w0) * acc / total) / 2;
              fillPolygons(m, [poly(capsulePts(pts[i - 1], pts[i], ra, rb, tol))]);
            }
            return m;
          }
          case "union":
          case "subtract":
          case "intersect": {
            const parts = (s2.shapes ?? []).map((c) => this.shapeMask(c, mul(M, specMatrix(c)), S3));
            if (!parts.length) return m;
            const out = parts[0].clone();
            for (const p of parts.slice(1)) s2.type === "union" ? out.or(p) : s2.type === "subtract" ? out.andNot(p) : out.and(p);
            return out;
          }
          default:
            throw new Error(`unknown shape type ${JSON.stringify(s2.type)}`);
        }
      }
      /** Flatten the node tree into draw items (masks at the working resolution), in draw order. */
      compile(S3) {
        const items = [], bands = this.env.dir.shading.bands, inner = this.env.dir.line.inner !== "none";
        this.warnings = [];
        const walk = (s2, M, key2, inh) => {
          const copies = [mul(M, specMatrix(s2))];
          if (s2.mirrorX != null) copies.push(mul(M, mul(mirrorX(s2.mirrorX), specMatrix(s2))));
          if (s2.mirrorY != null) copies.push(mul(M, mul(mirrorY(s2.mirrorY), specMatrix(s2))));
          const out = [];
          copies.forEach((Mc, ci) => {
            const k = [...key2, ci];
            const mat = this.resolveMat(s2.mat) ?? inh.mat, shade = s2.shade ?? inh.shade;
            if (s2.type === "group") {
              let clip = inh.clip;
              if (s2.clip) {
                const c = this.shapeMask(s2.clip, mul(Mc, specMatrix(s2.clip)), S3);
                clip = clip ? c.and(clip) : c;
              }
              const reps = s2.repeat?.n ?? 1, sub2 = [];
              for (let r = 0; r < reps; r++) {
                let Mr = Mc;
                if (s2.repeat) {
                  const o = s2.repeat.origin ?? [0, 0];
                  Mr = mul(Mc, mul(translate((s2.repeat.dx ?? 0) * r, (s2.repeat.dy ?? 0) * r), mul(translate(o[0], o[1]), mul(rotate((s2.repeat.rotate ?? 0) * r), translate(-o[0], -o[1])))));
                }
                const kids = (s2.children ?? []).map((c, i) => ({ c, i })).sort((p, q) => (p.c.z ?? 0) - (q.c.z ?? 0) || p.i - q.i);
                kids.forEach(({ c, i }) => sub2.push(...walk(c, Mr, [...k, r, c.z ?? 0, i], { mat, shade, clip })));
              }
              if (s2.underlay && inner && sub2.length) out.push(this.underlayItem(sub2, s2.underlay, S3, [...k, -1], s2.name));
              out.push(...sub2);
              return;
            }
            let mask = this.shapeMask(s2, Mc, S3);
            if (inh.clip) mask = mask.and(inh.clip);
            if (!mask.any()) this.warnings.push(`${s2.type}${s2.name ? ` ${s2.name}` : ""}: covers no pixels`);
            const fixed = s2.color ? this.resolveColor(s2.color) : void 0;
            if (!fixed && !mat) throw new Error(`${s2.type}${s2.name ? ` ${s2.name}` : ""}: needs mat or color`);
            const ramp = fixed ? void 0 : mat;
            const it = {
              spec: s2,
              mask,
              key: [...k, 1],
              name: s2.name,
              ramp,
              fixed,
              levels: ramp ? bandIndices(ramp.length, bands) : [],
              rank: 0,
              shade: shade ?? "flat",
              ink: inner ? s2.ink : void 0,
              cast: s2.cast,
              ao: s2.ao,
              pattern: s2.pattern,
              band: s2.band,
              round: s2.round,
              gain: s2.gain ?? ((shade ?? "flat") === "linear" ? 1 : 1.4),
              axis: s2.axis
            };
            if (s2.underlay && inner) out.push(this.underlayItem([it], s2.underlay, S3, [...k, 0], s2.name));
            out.push(it);
          });
          return out;
        };
        const top = this.specs.map((s2, i) => ({ s: s2, i })).sort((p, q) => (p.s.z ?? 0) - (q.s.z ?? 0) || p.i - q.i);
        for (const { s: s2, i } of top) items.push(...walk(s2, IDENTITY, [s2.z ?? 0, i], {}));
        items.forEach((it, r) => {
          it.rank = r;
        });
        return items;
      }
      underlayItem(of, width, S3, key2, name) {
        const w = width === true ? 1 : +width, u = new Mask(this.w * S3, this.h * S3, S3);
        for (const it of of) u.or(it.mask);
        return {
          spec: { type: "group" },
          mask: u.dilate(w * S3),
          key: key2,
          name: name ? `${name}:underlay` : "underlay",
          fixed: this.env.dir.outline,
          levels: [],
          rank: 0,
          underlay: true,
          shade: "flat",
          gain: 1,
          under: { width: w, of }
        };
      }
      /** Ramp index for item `it` at working-resolution sample (sx, sy). */
      shadeAt(it, sx, sy, S3, cache2) {
        const L = it.levels, n = L.length, mid = n - 1 >> 1;
        if (it.fixed || !n) return 0;
        if (it.shade === "flat" || n === 1) return it.band ?? L[mid];
        const light = this.env.dir.camera.light, lx = Math.sign(light[0]), ly = Math.sign(light[1]), m = it.mask;
        if (it.shade === "bevel") {
          const lit = !!lx && !m.has(sx + lx * S3, sy) || !!ly && !m.has(sx, sy + ly * S3);
          const dark = !!lx && !m.has(sx - lx * S3, sy) || !!ly && !m.has(sx, sy - ly * S3);
          return lit && !dark ? L[0] : dark && !lit ? L[n - 1] : L[mid];
        }
        let geo = cache2.get(it);
        if (!geo) {
          const bb2 = m.bounds();
          let R2 = 0;
          if (it.shade === "normal") {
            const dist = m.insideDistance();
            for (let i = 0; i < dist.length; i++) if (dist[i] > R2) R2 = dist[i];
          }
          geo = { bb: bb2, R: R2 };
          cache2.set(it, geo);
        }
        const ln2 = Math.hypot(light[0], light[1], light[2]) || 1, Lx = light[0] / ln2, Ly = light[1] / ln2, Lz = light[2] / ln2;
        const bb = geo.bb;
        if (it.shade === "linear") {
          const ll = Math.hypot(light[0], light[1]) || 1, ux = -light[0] / ll, uy = -light[1] / ll;
          const corners = [[bb.x0, bb.y0], [bb.x1 + 1, bb.y0], [bb.x0, bb.y1 + 1], [bb.x1 + 1, bb.y1 + 1]].map(([x, y]) => x * ux + y * uy);
          const lo = Math.min(...corners), hi = Math.max(...corners), t = ((sx + 0.5) * ux + (sy + 0.5) * uy - lo) / (hi - lo || 1);
          return L[Math.max(0, Math.min(n - 1, Math.floor(t * it.gain * n)))];
        }
        const [nx, ny, nz] = this.curvedNormal(it, sx, sy, S3, geo);
        const dot = nx * Lx + ny * Ly + nz * Lz;
        const pos = Math.round(mid - (dot - Lz) * it.gain * (n - 1));
        return L[Math.max(0, Math.min(n - 1, pos))];
      }
      /** Surface normal of a `sphere` / `cyl` / `normal` shaded item at a working-resolution sample (screen terms, y down). */
      curvedNormal(it, sx, sy, S3, geo) {
        const m = it.mask, bb = geo.bb;
        let nx = 0, ny = 0, nz = 1;
        if (it.shade === "sphere" || it.shade === "cyl") {
          const cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2, rx = (bb.x1 - bb.x0 + 1) / 2, ry = (bb.y1 - bb.y0 + 1) / 2;
          const ux = (sx + 0.5 - cx) / rx, uy = (sy + 0.5 - cy) / ry;
          if (it.shade === "sphere") {
            nx = ux;
            ny = uy;
          } else if (it.axis === "x") ny = uy;
          else nx = ux;
          const q = nx * nx + ny * ny;
          if (q > 1) {
            const k = 1 / Math.sqrt(q);
            nx *= k;
            ny *= k;
          }
          nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        } else {
          const dist = m.insideDistance(), W3 = m.w, at = (x, y) => x < 0 || y < 0 || x >= W3 || y >= m.h ? 0 : dist[y * W3 + x];
          const R2 = Math.max(1e-3, it.round !== void 0 ? it.round * S3 : geo.R), d = at(sx, sy), u = Math.min(1, d / R2);
          const gx = (at(sx + 1, sy) - at(sx - 1, sy)) / 2, gy = (at(sx, sy + 1) - at(sx, sy - 1)) / 2, gl = Math.hypot(gx, gy);
          if (gl > 1e-6 && u < 1) {
            const slope = Math.min(4, (1 - u) / Math.sqrt(Math.max(1e-4, 1 - (1 - u) * (1 - u))));
            const tx = -gx / gl, ty = -gy / gl, k = 1 / Math.sqrt(1 + slope * slope);
            nx = tx * slope * k;
            ny = ty * slope * k;
            nz = k;
          }
        }
        return [nx, ny, nz];
      }
      /** Normal-map normal of an item at a working-resolution sample (P6a): curved shades exact, the rest approximated. */
      normalAt(it, sx, sy, S3, cache2) {
        if (it.fixed || it.underlay || !it.levels.length) return [0, 0, 1];
        const light = this.env.dir.camera.light, lx = Math.sign(light[0]), ly = Math.sign(light[1]), m = it.mask;
        if (it.shade === "sphere" || it.shade === "cyl" || it.shade === "normal") {
          this.shadeAt(it, sx, sy, S3, cache2);
          return this.curvedNormal(it, sx, sy, S3, cache2.get(it));
        }
        if (it.shade === "bevel") {
          const lit = !!lx && !m.has(sx + lx * S3, sy) || !!ly && !m.has(sx, sy + ly * S3);
          const dark = !!lx && !m.has(sx - lx * S3, sy) || !!ly && !m.has(sx, sy - ly * S3);
          if (lit && !dark) return [lx * 0.6, ly * 0.6, 1];
          if (dark && !lit) return [-lx * 0.6, -ly * 0.6, 1];
        }
        if (it.shade === "linear") return [-lx * 0.3, -ly * 0.3, 1];
        return [0, 0, 1];
      }
      /** Render to a Raster (before the outer line and shadows): S1 output, the input of the procedural pass. */
      raster() {
        const S3 = this.samples, mode = this.mode, items = this.compile(S3), W3 = this.w * S3, H = this.h * S3;
        const label = new Int16Array(W3 * H).fill(-1);
        for (const it of items) for (let i = 0; i < label.length; i++) if (it.mask.d[i] && (!it.underlay || label[i] >= 0)) label[i] = it.rank;
        const r = new Raster(this.w, this.h, items, this.env.dir.outline), cache2 = /* @__PURE__ */ new Map();
        const stage = this.opts.stage;
        if (stage) {
          const g = new Grid(W3, H);
          for (let i = 0; i < label.length; i++) if (label[i] >= 0) {
            const it = items[label[i]], c = it.fixed ?? it.ramp[this.shadeAt(it, i % W3, i / W3 | 0, S3, cache2)];
            g.set(i % W3, i / W3 | 0, c);
          }
          stage(mode === "ss" ? "raster-ss" : "coverage", g);
        }
        const half = S3 * S3 / 2;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const counts = /* @__PURE__ */ new Map();
          let empty = 0;
          for (let j = 0; j < S3; j++) for (let i = 0; i < S3; i++) {
            const sx2 = x * S3 + i, sy2 = y * S3 + j, l = label[sy2 * W3 + sx2];
            if (l < 0) {
              empty++;
              continue;
            }
            const key2 = mode === "ss" ? l * 4096 + this.shadeAt(items[l], sx2, sy2, S3, cache2) : l;
            counts.set(key2, (counts.get(key2) ?? 0) + 1);
          }
          if (empty > half) continue;
          let best = -1, bn = 0;
          for (const [k, c] of counts) if (c > bn || c === bn && k > best) {
            bn = c;
            best = k;
          }
          const p = y * this.w + x;
          if (mode === "ss") {
            r.id[p] = Math.floor(best / 4096);
            r.band[p] = best % 4096;
          } else {
            r.id[p] = best;
            r.band[p] = this.shadeAt(items[best], x * S3 + (S3 >> 1), y * S3 + (S3 >> 1), S3, cache2);
          }
        }
        r.normal = new Float32Array(this.w * this.h * 3);
        for (let p = 0; p < r.id.length; p++) {
          if (r.id[p] < 0) continue;
          const it = items[r.id[p]], x = p % this.w, y = p / this.w | 0;
          r.normal.set(this.normalAt(it, x * S3 + (S3 >> 1), y * S3 + (S3 >> 1), S3, cache2), p * 3);
        }
        for (let p = 0; p < r.id.length; p++) {
          const it = items[r.id[p]];
          if (it?.pattern) {
            const b = it.pattern(p % this.w, p / this.w | 0, r.band[p]);
            if (b != null && it.ramp && b >= 0 && b < it.ramp.length) r.band[p] = b;
          }
        }
        const inkFlags = [];
        for (let p = 0; p < r.id.length; p++) {
          const id = r.id[p];
          if (id < 0) continue;
          const it = items[id], x = p % this.w, y = p / this.w | 0;
          if (it.underlay) {
            r.flag[p] |= INK;
            continue;
          }
          if (!it.ink) continue;
          const hit = N44.some(([dx, dy]) => {
            const q = r.idx(x + dx, y + dy);
            if (it.ink === "all") return q < 0 || r.id[q] !== id;
            return q >= 0 && r.id[q] >= 0 && r.id[q] !== id && items[r.id[q]].rank < it.rank;
          });
          if (hit) inkFlags.push(p);
        }
        for (const p of inkFlags) r.flag[p] |= INK;
        const light = this.env.dir.camera.light, sx = -Math.sign(light[0]), sy = -Math.sign(light[1]), darkened = new Uint8Array(r.id.length);
        for (const it of items) {
          if (!it.cast && !it.ao) continue;
          for (let p = 0; p < r.id.length; p++) {
            if (r.id[p] !== it.rank) continue;
            const x = p % this.w, y = p / this.w | 0;
            const targets = [];
            if (it.cast) for (let k = 1; k <= it.cast; k++) targets.push(r.idx(x + sx * k, y + sy * k));
            if (it.ao) for (const [dx, dy] of N44) targets.push(r.idx(x + dx, y + dy));
            for (const q of targets) {
              if (q < 0 || r.id[q] < 0 || darkened[q] || items[r.id[q]].rank >= it.rank || items[r.id[q]].underlay) continue;
              if (r.step(q, 1)) darkened[q] = 1;
            }
          }
        }
        stage?.("downsample", r.toGrid());
        return r;
      }
      /** Colours → outer line → shadows (shared with the procedural pass). */
      finalize(r, extra = {}) {
        let g = r.toGrid();
        const normal = r.normalMap();
        const stage = this.opts.stage, { dir } = this.env, o = { ...this.opts, ...extra };
        if (o.outline !== false) {
          g = this.env.line(g);
          stage?.("outline", g);
        }
        if (o.shadow) {
          g = dropShadow(g, o.shadow[0], o.shadow[1], dir.shadow);
          stage?.("shadow", g);
        }
        if (o.groundShadow) {
          const s2 = new Grid(g.w, g.h);
          groundShadow(s2, ...o.groundShadow, dir.shadow);
          g = s2.stamp(g);
          stage?.("ground-shadow", g);
        }
        if (normal) g.normal = normal;
        return g;
      }
      render() {
        return this.finalize(this.raster());
      }
    };
  }
});

// ../artgen-core/src/views/camera.ts
function camera(view, o = {}) {
  const s2 = o.scale ?? 1;
  const sc = (m) => [m[0].map((v) => v * s2), m[1].map((v) => v * s2)];
  switch (view) {
    case "iso":
      return { view, M: sc([[2, -2, 0], [1, 1, -2]]), dv: [1, 1, 1], R: norm([1, -1, 0]), D: norm([1, 1, -2]), V: norm([1, 1, 1]) };
    case "topdown":
    case "stack":
      return { view, M: sc([[2, 0, 0], [0, 2, 0]]), dv: [0, 0, 1], R: [1, 0, 0], D: [0, 1, 0], V: [0, 0, 1] };
    case "side":
      return { view, M: sc([[2, 0, 0], [0, 0, -2]]), dv: [0, 1, 0], R: [1, 0, 0], D: [0, 0, -1], V: [0, 1, 0] };
    case "oblique":
    case "billboard":
    case "fp": {
      const g = view === "oblique" ? 1 / Math.min(0.95, Math.max(0.05, o.frontRatio ?? 0.5)) - 1 : Math.tan((o.elevation ?? 15) * Math.PI / 180);
      return { view, M: sc([[2, 0, 0], [0, 2 * g, -2]]), dv: [0, 1, g], R: [1, 0, 0], D: norm([0, g, -1]), V: norm([0, 1, g]), ref: [0, 1, 0] };
    }
    default:
      throw new Error(`no camera for view ${JSON.stringify(view)} (have: ${CAMERA_VIEWS.join(", ")})`);
  }
}
function facingYaw(facing) {
  const ring16 = ["s", "ssw", "sw", "wsw", "w", "wnw", "nw", "nnw", "n", "nne", "ne", "ene", "e", "ese", "se", "sse"];
  const i = ring16.indexOf(facing);
  if (i < 0) throw new Error(`unknown facing ${JSON.stringify(facing)}`);
  return i * 22.5;
}
function lightIn(cam, light) {
  const [lx, ly, lz] = light, l = [0, 0, 0];
  for (let i = 0; i < 3; i++) l[i] = lx * cam.R[i] + ly * cam.D[i] + lz * cam.V[i];
  return norm(l);
}
var norm, dot3, cross3, CAMERA_VIEWS, toScreen;
var init_camera = __esm({
  "../artgen-core/src/views/camera.ts"() {
    "use strict";
    norm = (v) => {
      const l = Math.hypot(...v) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    CAMERA_VIEWS = ["iso", "topdown", "oblique", "side", "billboard"];
    toScreen = (cam, n) => [dot3(n, cam.R), dot3(n, cam.D), dot3(n, cam.V)];
  }
});

// ../artgen-core/src/voxel/raster.ts
function inv3(m) {
  const [a, b, c] = m, det = dot3(a, cross3(b, c));
  if (Math.abs(det) < 1e-12) throw new Error("voxel raster: degenerate camera");
  const r0 = cross3(b, c), r1 = cross3(c, a), r2 = cross3(a, b);
  return [[r0[0] / det, r1[0] / det, r2[0] / det], [r0[1] / det, r1[1] / det, r2[1] / det], [r0[2] / det, r1[2] / det, r2[2] / det]];
}
function smoothNormal(g, v, r) {
  let x = 0, y = 0, z = 0;
  for (let k = -r; k <= r; k++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d2 = i * i + j * j + k * k;
    if (!d2 || d2 > r * r + r) continue;
    if (g.at(v[0] + i, v[1] + j, v[2] + k) < 0) {
      const w = 1 / Math.sqrt(d2);
      x += i * w;
      y += j * w;
      z += k * w;
    }
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-6 ? null : [x / l, y / l, z / l];
}
function project(cam, yaw, pivot, at, p) {
  const q = rotZ([p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], yaw);
  return [at[0] + dot3(cam.M[0], q), at[1] + dot3(cam.M[1], q)];
}
function bandFor(ns, Ls, lv, gain = 1.4, ref = Ls[2]) {
  const nl = lv.length, mid = nl - 1 >> 1, pos = Math.round(mid - (dot3(ns, Ls) - ref) * gain * (nl - 1));
  return lv[Math.max(0, Math.min(nl - 1, pos))];
}
function rasterVoxels(set, o) {
  const { w, h, camera: cam } = o, ss = o.ss ?? 4, yaw = o.yaw ?? 0, g = new VoxelGrid(set);
  const pivot = o.pivot ?? g.pivot(), at = o.at ?? [w / 2, Math.round(h * 0.8)];
  const caster = new VoxelCaster(g, cam, yaw, pivot), L = lightIn(cam, o.light), Ls = toScreen(cam, L), ref = cam.ref ? dot3(toScreen(cam, cam.ref), Ls) : Ls[2];
  const gain = o.gain ?? 1.4, smoothR = o.smooth ?? 2, levels = set.mats.map((m) => bandIndices(m.length, o.bands));
  const normals = /* @__PURE__ */ new Map();
  const W3 = w * ss, H = h * ss, N3 = W3 * H;
  const sKey = new Int32Array(N3).fill(-1), sDepth = new Float32Array(N3), sNorm = new Float32Array(N3 * 3);
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W3; sx++) {
    const hit = caster.cast((sx + 0.5) / ss - at[0], (sy + 0.5) / ss - at[1]);
    if (!hit) continue;
    const c = set.cells[hit.cell];
    let n = hit.face;
    if (c.toon) {
      let sn = normals.get(hit.cell);
      if (!sn) {
        sn = smoothNormal(g, c.v, smoothR) ?? hit.face;
        normals.set(hit.cell, sn);
      }
      n = sn;
    }
    const ns = toScreen(cam, rotZ(n, yaw)), band = bandFor(ns, Ls, levels[c.mat], gain, ref);
    const p = sy * W3 + sx;
    sKey[p] = (c.part * 256 + c.mat) * 256 + band;
    sDepth[p] = hit.depth;
    sNorm.set(ns, p * 3);
  }
  const grid = new Grid(w, h), depth = new Float32Array(w * h).fill(NaN), part = new Int16Array(w * h).fill(-1), nrm = new Float32Array(w * h * 3);
  const half = ss * ss / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const counts = /* @__PURE__ */ new Map();
    let empty = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const k = sKey[(y * ss + j) * W3 + x * ss + i];
      if (k < 0) empty++;
      else counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (empty > half) continue;
    let best = -1, bn = 0;
    for (const [k, n] of counts) if (n > bn || n === bn && k > best) {
      best = k;
      bn = n;
    }
    let dsum = 0, nx = 0, ny = 0, nz = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const p = (y * ss + j) * W3 + x * ss + i;
      if (sKey[p] !== best) continue;
      dsum += sDepth[p];
      nx += sNorm[p * 3];
      ny += sNorm[p * 3 + 1];
      nz += sNorm[p * 3 + 2];
    }
    const q = y * w + x, band = best & 255, mat = best >> 8 & 255, pt = best >> 16, nl = Math.hypot(nx, ny, nz) || 1;
    grid.set(x, y, set.mats[mat][band]);
    depth[q] = dsum / bn;
    part[q] = pt;
    nrm[q * 3] = nx / nl;
    nrm[q * 3 + 1] = ny / nl;
    nrm[q * 3 + 2] = nz / nl;
  }
  let out = grid;
  if ((o.inner ?? "depth") !== "none") {
    const thr = o.innerDepth ?? 3, inked = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const q = y * w + x;
      if (part[q] < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const r = Y * w + X;
        if (part[r] < 0) continue;
        const step = depth[r] - depth[q];
        if (step >= thr || o.inner === "parts" && part[r] !== part[q] && step > 0.5) {
          inked.push(q);
          break;
        }
      }
    }
    out = grid.clone();
    for (const q of inked) out.set(q % w, q / w | 0, o.ink);
  }
  const filled = (g2, x, y) => g2.alpha(x, y) > 0;
  if (o.line) out = o.line(out);
  const normal = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!filled(out, x, y)) continue;
    const q = y * w + x, i = q * 4;
    const [nx, ny, nz] = part[q] >= 0 ? [nrm[q * 3], nrm[q * 3 + 1], nrm[q * 3 + 2]] : [0, 0, 1];
    normal.d[i] = Math.round((nx * 0.5 + 0.5) * 255);
    normal.d[i + 1] = Math.round((-ny * 0.5 + 0.5) * 255);
    normal.d[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    normal.d[i + 3] = 255;
  }
  if (o.shadow) {
    const sh = new Grid(w, h);
    if (o.shadowShape === "footprint") {
      const cols = /* @__PURE__ */ new Set();
      for (const c of set.cells) cols.add(c.v[0] * 65536 + c.v[1]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (caster.groundHit(x + 0.5 - at[0], y + 0.5 - at[1], cols)) sh.set(x, y, o.shadow);
    } else {
      const zTop = g.z0 + Math.max(1, Math.ceil(g.nz / 4)), pts = [];
      for (const c of set.cells) if (c.v[2] < zTop) pts.push(project(cam, yaw, pivot, at, [c.v[0] + 0.5, c.v[1] + 0.5, 0]));
      const sees = Math.abs(cam.M[1][0]) + Math.abs(cam.M[1][1]) > 1e-6;
      if (pts.length && sees) {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const rx = Math.max(2, (Math.max(...xs) - Math.min(...xs)) / 2 + 1), flat = Math.abs(cam.M[1][1]) / Math.max(1e-6, Math.abs(cam.M[0][0]) + Math.abs(cam.M[0][1]));
        const ry = Math.max(1, Math.max((Math.max(...ys) - Math.min(...ys)) / 2 + 0.5, rx * Math.min(0.5, flat || 0.5)));
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) sh.set(x, y, o.shadow);
      }
    }
    out = sh.stamp(out);
  }
  return { grid: out, depth, part, normal };
}
var EMPTY, VoxelGrid, rotZ, VoxelCaster;
var init_raster2 = __esm({
  "../artgen-core/src/voxel/raster.ts"() {
    "use strict";
    init_grid();
    init_raster();
    init_camera();
    EMPTY = -1;
    VoxelGrid = class {
      x0;
      y0;
      z0;
      nx;
      ny;
      nz;
      /** Cell index + 1 per voxel (0 = empty). */
      occ;
      set;
      constructor(set) {
        this.set = set;
        const xs = set.cells.map((c) => c.v[0]), ys = set.cells.map((c) => c.v[1]), zs = set.cells.map((c) => c.v[2]);
        const lo = (a) => a.length ? Math.min(...a) : 0, hi = (a) => a.length ? Math.max(...a) : 0;
        this.x0 = lo(xs);
        this.y0 = lo(ys);
        this.z0 = lo(zs);
        this.nx = hi(xs) - this.x0 + 1;
        this.ny = hi(ys) - this.y0 + 1;
        this.nz = hi(zs) - this.z0 + 1;
        this.occ = new Int32Array(this.nx * this.ny * this.nz);
        set.cells.forEach((c, i) => {
          this.occ[this.index(c.v[0], c.v[1], c.v[2])] = i + 1;
        });
      }
      index(x, y, z) {
        return ((z - this.z0) * this.ny + (y - this.y0)) * this.nx + (x - this.x0);
      }
      /** Cell index at a voxel, or -1. */
      at(x, y, z) {
        if (x < this.x0 || y < this.y0 || z < this.z0 || x >= this.x0 + this.nx || y >= this.y0 + this.ny || z >= this.z0 + this.nz) return EMPTY;
        return this.occ[this.index(x, y, z)] - 1;
      }
      get empty() {
        return !this.set.cells.length;
      }
      /** Footprint centre at z = 0. */
      pivot() {
        if (this.empty) return [0, 0, 0];
        return [this.x0 + this.nx / 2, this.y0 + this.ny / 2, 0];
      }
    };
    rotZ = (v, deg) => {
      const a = deg * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a);
      return [v[0] * c - v[1] * s2, v[0] * s2 + v[1] * c, v[2]];
    };
    VoxelCaster = class {
      A;
      /** Ray direction into the scene and toward the viewer, model frame. */
      into;
      toward;
      far;
      g;
      cam;
      yaw;
      pivot;
      constructor(g, cam, yaw, pivot) {
        this.g = g;
        this.cam = cam;
        this.yaw = yaw;
        this.pivot = pivot;
        this.A = inv3([cam.M[0], cam.M[1], cam.dv]);
        let n = cross3(cam.M[0], cam.M[1]);
        const l = Math.hypot(...n);
        n = [n[0] / l, n[1] / l, n[2] / l];
        if (dot3(n, cam.dv) < 0) n = [-n[0], -n[1], -n[2]];
        this.toward = rotZ(n, -yaw);
        this.into = [-this.toward[0], -this.toward[1], -this.toward[2]];
        this.far = Math.hypot(g.nx, g.ny, g.nz) + Math.hypot(g.x0 - pivot[0], g.y0 - pivot[1], g.z0 - pivot[2]) + Math.hypot(g.nx, g.ny, g.nz) + 4;
      }
      /** Model-frame point on the screen point's ray (on the depth-0 plane). */
      origin(wx, wy) {
        const A = this.A, q = [A[0][0] * wx + A[0][1] * wy, A[1][0] * wx + A[1][1] * wy, A[2][0] * wx + A[2][1] * wy];
        const p = rotZ(q, -this.yaw);
        return [p[0] + this.pivot[0], p[1] + this.pivot[1], p[2] + this.pivot[2]];
      }
      cast(wx, wy) {
        const g = this.g;
        if (g.empty) return null;
        const P2 = this.origin(wx, wy), d = this.into, T = this.far;
        const O = [P2[0] + this.toward[0] * T, P2[1] + this.toward[1] * T, P2[2] + this.toward[2] * T];
        const lo = [g.x0, g.y0, g.z0], hi = [g.x0 + g.nx, g.y0 + g.ny, g.z0 + g.nz];
        let t0 = -Infinity, t1 = Infinity, axis = 0;
        for (let a = 0; a < 3; a++) {
          if (Math.abs(d[a]) < 1e-12) {
            if (O[a] < lo[a] || O[a] >= hi[a]) return null;
            continue;
          }
          let ta = (lo[a] - O[a]) / d[a], tb = (hi[a] - O[a]) / d[a];
          if (ta > tb) [ta, tb] = [tb, ta];
          if (ta > t0) {
            t0 = ta;
            axis = a;
          }
          if (tb < t1) t1 = tb;
        }
        if (t0 > t1 || t1 < 0) return null;
        let s2 = Math.max(0, t0) + 1e-7;
        const i = [0, 1, 2].map((a) => Math.min(hi[a] - 1, Math.max(lo[a], Math.floor(O[a] + d[a] * s2))));
        const step = d.map((v) => v > 0 ? 1 : v < 0 ? -1 : 0);
        const tMax = [0, 1, 2].map((a) => step[a] === 0 ? Infinity : (i[a] + (step[a] > 0 ? 1 : 0) - O[a]) / d[a]);
        const tDelta = d.map((v) => v === 0 ? Infinity : Math.abs(1 / v));
        for (let guard = 0; guard < 4096; guard++) {
          const c = g.at(i[0], i[1], i[2]);
          if (c >= 0) {
            const face2 = [0, 0, 0];
            face2[axis] = -step[axis];
            return { cell: c, face: face2, depth: T - s2 };
          }
          const a = tMax[0] < tMax[1] ? tMax[0] < tMax[2] ? 0 : 2 : tMax[1] < tMax[2] ? 1 : 2;
          s2 = tMax[a];
          i[a] += step[a];
          tMax[a] += tDelta[a];
          axis = a;
          if (i[a] < lo[a] || i[a] >= hi[a]) return null;
        }
        return null;
      }
      /** Does the ray through a screen point hit the ground (z = 0) under an occupied column? */
      groundHit(wx, wy, columns) {
        const P2 = this.origin(wx, wy), d = this.into;
        if (Math.abs(d[2]) < 1e-9) return false;
        const s2 = -P2[2] / d[2], x = Math.floor(P2[0] + d[0] * s2), y = Math.floor(P2[1] + d[1] * s2);
        return columns.has(x * 65536 + y);
      }
    };
  }
});

// ../artgen-core/src/voxel/vox.ts
function voxCells(m) {
  const by = /* @__PURE__ */ new Map();
  for (const [x, y, z, c] of m.voxels) {
    let l = by.get(c);
    if (!l) by.set(c, l = []);
    l.push([x, y, z]);
  }
  return [...by].sort((a, b) => a[0] - b[0]).map(([index, cells]) => ({ index, color: m.palette[index - 1], cells }));
}
var init_vox = __esm({
  "../artgen-core/src/voxel/vox.ts"() {
    "use strict";
    init_color();
  }
});

// ../artgen-core/src/t2/scene3d.ts
function nearestRamp(pal, hex) {
  const [r, g, b] = parseColor(hex);
  let best = "", bd = Infinity;
  for (const [name, ramp] of Object.entries(pal)) for (const c of ramp) {
    const d = dist2(parseColor(c), r, g, b);
    if (d < bd) {
      bd = d;
      best = name;
    }
  }
  return best;
}
var key, FACING_ROT, Scene3D;
var init_scene3d = __esm({
  "../artgen-core/src/t2/scene3d.ts"() {
    "use strict";
    init_color();
    init_grid();
    init_voxel();
    init_camera();
    init_raster2();
    init_vox();
    init_color();
    init_raster();
    key = (v) => `${v[0]},${v[1]},${v[2]}`;
    FACING_ROT = { s: 0, w: 90, n: 180, e: 270 };
    Scene3D = class {
      specs = [];
      k;
      dir;
      warnings = [];
      constructor(dir, opts = {}) {
        this.dir = dir;
        this.k = opts.k ?? 1;
      }
      add(...s2) {
        this.specs.push(...s2);
        return this;
      }
      ramp(m) {
        if (m === void 0) return void 0;
        if (Array.isArray(m)) return m.map(normHex);
        const r = this.dir.pal[m] ?? this.dir.pal[this.dir.palette.materials[m]];
        if (!r) throw new Error(`3D: unknown material ${JSON.stringify(m)}`);
        return r;
      }
      face(r, hi) {
        const L = bandIndices(r.length, Math.max(3, this.dir.shading.bands)), n = L.length;
        const top = r[L[0]], left = r[L[Math.min(1, n - 1)]], right = r[L[Math.min(2, n - 1)]] ?? left;
        let h;
        if (hi) {
          const [name, idx] = hi.split(".");
          h = this.dir.pal[name]?.[idx === void 0 ? 0 : +idx];
          if (!h) throw new Error(`3D: unknown colour token ${hi}`);
        }
        return [top, left, right, h];
      }
      /** Fine-voxel cells of one primitive (local coordinates). */
      cells(s2) {
        const k = this.k, out = [];
        const scan = (x0, y0, z0, x1, y1, z1, inside) => {
          for (let z = Math.floor(z0 * k); z < Math.ceil(z1 * k); z++) for (let y = Math.floor(y0 * k); y < Math.ceil(y1 * k); y++)
            for (let x = Math.floor(x0 * k); x < Math.ceil(x1 * k); x++) if (inside((x + 0.5) / k, (y + 0.5) / k, (z + 0.5) / k)) out.push([x, y, z]);
        };
        const n = (v, name) => {
          if (typeof v !== "number") throw new Error(`3D ${s2.type}${s2.name ? ` ${s2.name}` : ""}: ${name} required`);
          return v;
        };
        switch (s2.type) {
          case "box":
          case "slab": {
            const x = s2.x ?? 0, y = s2.y ?? 0, z = s2.z ?? 0;
            scan(x, y, z, x + n(s2.w, "w"), y + n(s2.d, "d"), z + n(s2.h, "h"), () => true);
            break;
          }
          case "ellipsoid": {
            const cx = n(s2.cx, "cx"), cy = n(s2.cy, "cy"), cz = n(s2.cz, "cz"), rx = n(s2.rx, "rx"), ry = s2.ry ?? rx, rz = s2.rz ?? rx;
            scan(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1);
            break;
          }
          case "capsule": {
            const a = s2.a, b = s2.b, r = n(s2.r, "r"), ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
            scan(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r, (x, y, z) => {
              const t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2));
              return (x - a[0] - ab[0] * t) ** 2 + (y - a[1] - ab[1] * t) ** 2 + (z - a[2] - ab[2] * t) ** 2 <= r * r;
            });
            break;
          }
          case "sdf": {
            const [x0, y0, z0, x1, y1, z1] = s2.bbox ?? (() => {
              throw new Error("3D sdf: bbox required");
            })();
            scan(x0, y0, z0, x1, y1, z1, (x, y, z) => s2.fn(x, y, z) <= 0);
            break;
          }
          case "cells":
            for (const c of s2.cells ?? []) out.push([Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
            break;
          default:
            throw new Error(`3D: ${s2.type} is not a primitive`);
        }
        return out;
      }
      /** Transform fine cells by a node's translate / rotate / mirror. */
      xform(cells, s2) {
        const k = this.k, [ox, oy] = (s2.origin ?? [0, 0, 0]).map((v) => v * k);
        let out = cells;
        if (s2.mirror) out = out.map(([x, y, z]) => s2.mirror === "x" ? [2 * ox - 1 - x, y, z] : [x, 2 * oy - 1 - y, z]);
        const rot = ((s2.rotate ?? 0) % 360 + 360) % 360;
        if (rot % 90) throw new Error("3D: rotate must be a multiple of 90 (cubes renderer)");
        for (let r = 0; r < rot; r += 90) out = out.map(([x, y, z]) => [Math.round(ox - (y + 0.5 - oy) - 0.5), Math.round(oy + (x + 0.5 - ox) - 0.5), z]);
        if (s2.translate) {
          const [tx, ty, tz] = s2.translate.map((v) => Math.round(v * k));
          out = out.map(([x, y, z]) => [x + tx, y + ty, z + tz]);
        }
        return out;
      }
      /** Cells occupied by a spec (any type), in the parent's coordinates. */
      occupancy(s2) {
        if (s2.type === "group" || s2.type === "union") return this.xform((s2.children ?? s2.shapes ?? []).flatMap((c) => this.occupancy(c)), s2);
        if (s2.type === "subtract" || s2.type === "intersect") {
          const [first, ...rest] = (s2.shapes ?? []).map((c) => new Map(this.occupancy(c).map((v) => [key(v), v])));
          if (!first) return [];
          for (const m of rest) for (const kk of [...first.keys()]) if (s2.type === "subtract" ? m.has(kk) : !m.has(kk)) first.delete(kk);
          return this.xform([...first.values()], s2);
        }
        return this.xform(this.cells(s2), s2);
      }
      /** Voxelise the scene (later specs paint over earlier ones; slabs only recolour or add). */
      voxels() {
        const vox = /* @__PURE__ */ new Map();
        this.warnings = [];
        const walk = (s2, parents, inh) => {
          const ramp = this.ramp(s2.mat) ?? inh.ramp, hi = s2.hi ?? inh.hi, label = s2.name ?? s2.type, shade = s2.shade ?? inh.shade;
          const part = s2.name ?? inh.part ?? s2.type;
          if (s2.type === "group") {
            (s2.children ?? []).forEach((c) => walk(c, [s2, ...parents], { ramp, hi, shade, part: s2.name ?? inh.part }));
            return;
          }
          if (!ramp) throw new Error(`3D ${label}: needs mat`);
          let cells = this.occupancy(s2);
          for (const p of parents) cells = this.xform(cells, { ...p, type: "group" });
          const fr = this.face(ramp, hi);
          let clash = 0;
          for (const v of cells) {
            const kk = key(v), prev = vox.get(kk);
            if (s2.type === "slab" && !prev && !s2.add) continue;
            if (prev && s2.type !== "slab" && prev.solid !== label && prev.ramp[0] !== fr[0]) clash++;
            vox.set(kk, { v, ramp: fr, solid: s2.type === "slab" && prev ? prev.solid : label, mat: ramp, part, shade });
          }
          if (clash) this.warnings.push(`${label} interpenetrates other solids (${clash} voxels): model surface decoration as a slab (R5)`);
        };
        for (const s2 of this.specs) walk(s2, [], {});
        return vox;
      }
      lint() {
        this.voxels();
        return [...this.warnings];
      }
      /** Voxel model in the engine's `Voxels` form, rotated for a facing. */
      model(facing = "s") {
        const vox = this.voxels(), m = new Voxels({ outlineColor: this.dir.outline, shadowColor: this.dir.shadow });
        const rot = FACING_ROT[facing];
        if (rot === void 0) throw new Error(`3D: facing ${facing} not supported by the cubes renderer (s, w, n, e)`);
        const cs = [...vox.values()];
        if (!cs.length) return m;
        const xs = cs.map((c) => c.v[0]), ys = cs.map((c) => c.v[1]);
        const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
        for (const { v: [x, y, z], ramp } of cs) {
          let [px, py] = [x + 0.5 - cx, y + 0.5 - cy];
          for (let r = 0; r < rot; r += 90) [px, py] = [-py, px];
          m.set(Math.round(px + cx - 0.5), Math.round(py + cy - 0.5), z, ramp);
        }
        return m;
      }
      /**
       * Add an imported `.vox` model: one `cells` spec per palette colour, each with the material `mats` maps its colour
       * index (or hex) to, else the direction ramp nearest that colour. `at` offsets it in fine voxels.
       */
      addVox(model, o = {}) {
        const at = o.at ?? [0, 0, 0];
        for (const g of voxCells(model)) {
          const mat = o.mats?.[g.index] ?? o.mats?.[g.color] ?? nearestRamp(this.dir.pal, g.color);
          this.add({ type: "cells", name: o.name ?? `vox${g.index}`, mat, shade: o.shade, cells: g.cells.map((c) => [c[0] + at[0], c[1] + at[1], c[2] + at[2]]) });
        }
        return this;
      }
      /** The voxels as a render-ready set: material ramps, part names, per-cell shading (`fallback` for unshaded parts). */
      voxelSet(fallback = "flat") {
        const mats = [], parts = [], mi = /* @__PURE__ */ new Map(), pi = /* @__PURE__ */ new Map();
        const cells = [...this.voxels().values()].map((c) => {
          const mk = c.mat.join(",");
          if (!mi.has(mk)) {
            mi.set(mk, mats.length);
            mats.push(c.mat);
          }
          if (!pi.has(c.part)) {
            pi.set(c.part, parts.length);
            parts.push(c.part);
          }
          return { v: c.v, mat: mi.get(mk), part: pi.get(c.part), toon: (c.shade ?? fallback) === "toon" };
        });
        if (mats.length > 255 || parts.length > 32e3) throw new Error("3D: too many materials or parts");
        return { cells, mats, parts };
      }
      /** Raster render with its buffers (depth, part ids, normal map). */
      raster(w, h, o = {}, line) {
        const view = o.view ?? this.dir.camera.view, k = this.k;
        const cam = camera(view === "fp" ? "billboard" : view, { scale: (o.scale ?? 1) / k, frontRatio: this.dir.camera.oblique?.frontRatio, elevation: o.elevation });
        const inner = o.inner ?? (this.dir.line.inner === "none" ? "none" : this.dir.line.inner === "all" ? "parts" : "depth");
        return rasterVoxels(this.voxelSet(o.shade), {
          // facings are screen directions: in iso the model's front (+y) turns to screen-down for `s` (grid-aligned at the diagonals)
          camera: cam,
          yaw: facingYaw(o.facing ?? "s") + (view === "iso" ? -45 : 0) + (o.yaw ?? 0),
          w,
          h,
          at: o.at ?? (o.ox !== void 0 && o.oy !== void 0 ? [o.ox, o.oy] : void 0),
          pivot: o.pivot && [o.pivot[0] * k, o.pivot[1] * k, o.pivot[2] * k],
          ss: o.ss ?? 4,
          bands: this.dir.shading.bands,
          light: this.dir.camera.light,
          gain: o.gain,
          smooth: o.smooth,
          inner,
          innerDepth: o.innerDepth,
          ink: this.dir.outline,
          line: o.outline === false ? void 0 : line,
          shadow: o.shadow === false ? null : this.dir.shadow,
          shadowShape: o.shadowShape
        });
      }
      /**
       * Screen pixel of a model point (model units) under the same raster options — anchors for 3D assets (`hand`, `eye`)
       * that follow every facing and frame. Rounded to the pixel; `undefined` when the point is outside the frame.
       */
      screen(w, h, o, p) {
        const view = o.view ?? this.dir.camera.view, k = this.k;
        const cam = camera(view === "fp" ? "billboard" : view, { scale: (o.scale ?? 1) / k, frontRatio: this.dir.camera.oblique?.frontRatio, elevation: o.elevation });
        const pivot = o.pivot ? [o.pivot[0] * k, o.pivot[1] * k, o.pivot[2] * k] : new VoxelGrid(this.voxelSet()).pivot();
        const at = o.at ?? (o.ox !== void 0 && o.oy !== void 0 ? [o.ox, o.oy] : [w / 2, Math.round(h * 0.8)]);
        const [x, y] = project(cam, facingYaw(o.facing ?? "s") + (view === "iso" ? -45 : 0) + (o.yaw ?? 0), pivot, at, [p[0] * k, p[1] * k, p[2] * k]);
        const px = [Math.floor(x), Math.floor(y)];
        return px[0] >= 0 && px[1] >= 0 && px[0] < w && px[1] < h ? px : void 0;
      }
      render(w, h, o = {}, line) {
        if (o.renderer === "raster") {
          const r = this.raster(w, h, o, line);
          r.grid.normal = r.normal;
          return r.grid;
        }
        const m = this.model(o.facing ?? "s");
        if (line) Object.assign(m.defaults, { applyLine: line });
        return m.render(w, h, { ox: o.ox ?? 0, oy: o.oy ?? 0, ss: o.ss, outline: o.outline, shadow: o.shadow, edgeLight: o.edgeLight });
      }
      /**
       * Sprite-stack slices (view `stack`): one top-down image per voxel layer, bottom first, `scale` px per voxel, lit
       * from above with the same normals the raster renderer uses (toon parts round off), each outlined with the
       * direction's line (`outline: false` to skip). Frame `i` of a stack asset is
       * slice `i`; the runtime draws them rotated and stepped up (`StackSprite`).
       */
      slices(w, h, o = {}) {
        const set = this.voxelSet(o.shade), s2 = o.scale ?? 1;
        if (!set.cells.length) return [];
        const g = new VoxelGrid(set), cam = camera("topdown"), Ls = toScreen(cam, lightIn(cam, this.dir.camera.light));
        const levels = set.mats.map((m) => bandIndices(m.length, this.dir.shading.bands)), [cx, cy] = g.pivot();
        const out = [];
        for (let z = g.z0; z < g.z0 + g.nz; z++) {
          const img = new Grid(w, h);
          for (const c of set.cells) {
            if (c.v[2] !== z) continue;
            const n = c.toon ? smoothNormal(g, c.v, o.smooth ?? 2) ?? [0, 0, 1] : [0, 0, 1];
            const col = set.mats[c.mat][bandFor(toScreen(cam, n), Ls, levels[c.mat], o.gain ?? 1.4)];
            img.fill(Math.round(w / 2 + (c.v[0] - cx) * s2), Math.round(h / 2 + (c.v[1] - cy) * s2), Math.max(1, Math.round(s2)), Math.max(1, Math.round(s2)), col);
          }
          out.push(o.outline !== false && o.line ? o.line(img) : img);
        }
        return out;
      }
    };
  }
});

// ../artgen-core/src/render.ts
function makeLib(dir, kind, stage, seed = 1, onScene) {
  const rampList = Object.values(dir.pal);
  const line = (g) => dir.line.outer === "none" ? g : dir.line.outer === "selout" ? selout(g, rampList, dir.outline) : outline(g, dir.outline);
  const sceneOpts = { light: dir.camera.light, bands: dir.shading.bands, outlineColor: dir.outline, shadowColor: dir.shadow, applyLine: line };
  return {
    Grid,
    line,
    post: {
      ...post_exports,
      outline: (g, color = dir.outline, diag = false) => outline(g, color, diag),
      dropShadow: (g, dx, dy, color = dir.shadow) => dropShadow(g, dx, dy, color),
      quantize: (g, pal = kindPalette(dir, kind), opts = { dither: dir.shading.dither }) => quantize(g, pal, opts),
      selout: (g) => selout(g, rampList, dir.outline)
    },
    prim: {
      Scene,
      R,
      mirrorSpec,
      scene: (w, h, opts = {}) => new Scene(w, h, { ...sceneOpts, ...opts })
    },
    blit: {
      ...blit_exports,
      shadeSide: (g, darker) => shadeSide(g, { light: dir.camera.light, outline: dir.outline, darker })
    },
    svg: {
      doc,
      rasterize: rasterizeSvg,
      /** T3 path; `outline: true` applies the direction's line style, `pal` defaults to the kind palette. */
      toGrid(svg, w, h, opts = {}) {
        const { outline: outline2, ...rest } = opts;
        let g = svgToGrid(svg, w, h, {
          ss: dir.pipeline.raster.ss,
          pal: kindPalette(dir, kind),
          shadowColor: dir.shadow,
          stage,
          ...rest,
          outline: typeof outline2 === "string" ? outline2 : false,
          shadow: null
        });
        if (outline2 === true) {
          g = line(g);
          stage?.("outline", g);
        }
        if (rest.shadow) {
          g = dropShadow(g, rest.shadow[0], rest.shadow[1], dir.shadow);
          stage?.("shadow", g);
        }
        return g;
      }
    },
    iso: { ...iso_exports, groundShadow: (g, cx, cy, rx) => groundShadow(g, cx, cy, rx, dir.shadow) },
    voxel: { Voxels, face, model: (opts = {}) => new Voxels({ ...opts, outlineColor: dir.outline, shadowColor: dir.shadow, applyLine: line }) },
    /** T2+ (S1): 2D scenes and 3D mode, bound to the direction. */
    t2: {
      scene: (w, h, opts = {}) => {
        const s2 = new Scene2D(w, h, { dir, palette: kindPalette(dir, kind), line }, { stage, ...opts });
        onScene?.(s2);
        return s2;
      },
      scene3d: (opts = {}) => {
        const s2 = new Scene3D(dir, opts), render = s2.render.bind(s2), slices = s2.slices.bind(s2);
        s2.render = (w, h, o, l = line) => render(w, h, o, l);
        s2.slices = (w, h, o = {}) => slices(w, h, { line, ...o });
        onScene?.(s2);
        return s2;
      }
    },
    /**
     * Textures and tiles (P6b): material recipes on the direction's ramps (seamless, with normal maps), autotile
     * transitions, iso floor / block tiles, WFC layouts, L-system growth.
     */
    tex: {
      material: (name, o) => material(name, dir, { ...o, w: o.size[0], h: o.size[1], seed: o.seed ?? seed }).grid,
      materialResult: (name, o) => material(name, dir, { seed, ...o }),
      autotile: (layout2, index, o) => autotile(dir, layout2, index, o),
      autotileMask,
      autotileCount,
      isoFloor: isoFloorTile,
      isoBlock: (tw, o, th) => isoBlockTile(dir, tw, o, th),
      wfc,
      lsystem,
      turtle,
      lsystemSpecs,
      /** Sky panorama (P6d): ramp bands, clouds, stars, a distant ridge; seamless across x. */
      sky: (o) => sky(dir, { seed, ...o }),
      noise: { value: pValue, gradient: pGradient, worley: pWorley }
    },
    /** Animation (P6c): keyframe tracks over t, the pose rig with 2-bone IK, spring chains, swept paths for trails. */
    anim: { ease, track, blend, pingpong, rig, solveTwoBone, spring, sweep },
    /**
     * Effects (P6c): particle emitters and presets drawn on the direction's effect colours (outer line from the
     * direction), palette cycling. `particles(layers, { w, h, t, duration })`; `preset(name, { w, h, duration })`.
     */
    fx: {
      presets: PRESET_NAMES,
      preset: (name, o, override) => preset(name, o, override),
      particles: (layers, o) => particles(dir, { ...o, layers, seed: o.seed ?? seed, line: o.line === false ? false : line }),
      simulate: (layers, o) => simulate(dir, { ...o, layers, seed: o.seed ?? seed }),
      draw: drawParticles,
      colors: (names) => colorRun(dir, names),
      cycle: (g, colors, shift) => paletteCycle(dir, g, colors, shift),
      /** Flame body: a noise-licked teardrop banded hot core → cool rim, seamless over t (no outline: add particles, then `line`). */
      flame: (o) => flame(dir, { seed, ...o }),
      /** The direction's outer line (after compositing flame + particles). */
      line
    },
    /** Procedural pass (S2) over a T2+ scene or a finished grid. */
    proc: (source) => new Proc(source, { dir, seed, line }, stage),
    palette: palette_exports,
    rng
  };
}
function renderAsset(mod4, { dir, brief, seed = 1, variant = 0, params = {}, stages, onScene }) {
  const dc = dirContext(dir), size = resolveSize(dir, brief.size, brief.kind);
  const states2 = brief.states?.length ? brief.states : ["idle"];
  const facings = FACINGS[brief.directions ?? 1];
  if (!facings) throw new Error(`brief ${brief.id}: directions must be 1, 4, 8 or 16`);
  const frames = {}, timing = {};
  for (const s2 of states2) {
    const a = brief.anims?.[s2], n = a?.frames ?? 1, sub2 = Math.max(1, Math.floor(a?.sub ?? 1));
    const fps = a?.fps ?? (brief.kind === "effect" ? dir.effects.fps : 8);
    timing[s2] = { n, sub: sub2, durations: a?.durations?.length === n ? a.durations : Array.from({ length: n }, () => Math.round(1e3 / fps)) };
    frames[s2] = n * sub2;
  }
  const mirror = mod4.meta?.mirror !== false, cells = [], cache2 = /* @__PURE__ */ new Map(), lint = /* @__PURE__ */ new Set();
  const allParams = resolveParams(mod4.params, variant, params);
  const renderCell = (state, facing, frame) => {
    const key2 = `${state}/${facing}/${frame}`;
    let n = 0;
    const stage = stages ? (name, g) => {
      stages.set(`${key2}/${n++}-${name}`, g.clone());
    } : void 0;
    const scenes = [];
    const tm = timing[state], ct = cellTiming(frame, tm.n, tm.sub, tm.durations);
    const ctx = {
      dir: dc,
      brief,
      size,
      seed,
      variant,
      params: allParams,
      state,
      facing,
      frame,
      t: frame / frames[state],
      rng: rng(seed),
      logical: ct.logical,
      sub: ct.sub,
      ms: ct.ms,
      duration: ct.duration,
      lib: makeLib(dc, brief.kind, stage, seed, (sc) => scenes.push(sc)),
      palette: (names) => names ? restrict(dc.pal, names, [dc.outline]) : kindPalette(dir, brief.kind),
      stage: stage ?? (() => {
      })
    };
    const grid = mod4.render(ctx);
    for (const sc of scenes) {
      for (const m of sc.lint()) lint.add(m);
      onScene?.(key2, sc);
    }
    if (grid.w !== size[0] || grid.h !== size[1]) throw new Error(`${brief.id} ${key2}: rendered ${grid.w}x${grid.h}, brief size is ${size.join("x")}`);
    return {
      state,
      facing,
      frame,
      grid,
      mirrored: false,
      anchors: mod4.anchors?.(ctx),
      ...grid.normal && { normal: fitNormalMap(grid, grid.normal) },
      ...tm.sub > 1 && { logical: ct.logical, sub: ct.sub }
    };
  };
  for (const state of states2) for (const facing of facings) for (let frame = 0; frame < frames[state]; frame++) {
    const src = mirrorFacing(facing);
    if (mirror && facing.includes("w") && facings.includes(src)) {
      const key2 = `${state}/${src}/${frame}`;
      let e = cache2.get(key2);
      if (!e) {
        e = renderCell(state, src, frame);
        cache2.set(key2, e);
      }
      const anchors = e.anchors && Object.fromEntries(Object.entries(e.anchors).map(([k, [x, y]]) => [k, [size[0] - 1 - x, y]]));
      cells.push({ state, facing, frame, grid: e.grid.flip("x"), mirrored: true, anchors, ...e.normal && { normal: flipNormalMap(e.normal) }, ...e.logical !== void 0 && { logical: e.logical, sub: e.sub } });
    } else {
      const key2 = `${state}/${facing}/${frame}`;
      let c = cache2.get(key2);
      if (!c) {
        c = renderCell(state, facing, frame);
        cache2.set(key2, c);
      }
      cells.push(c);
    }
  }
  return { brief, size, states: states2, facings, frames, cells, lint: [...lint] };
}
function assembleSheet(r, gap = 0) {
  const [w, h] = r.size, cols = Math.max(...Object.values(r.frames)), rows = r.states.length * r.facings.length;
  const grid = new Grid(cols * w + (cols - 1) * gap, rows * h + (rows - 1) * gap), rects = [];
  for (const c of r.cells) {
    const row = r.states.indexOf(c.state) * r.facings.length + r.facings.indexOf(c.facing);
    const x = c.frame * (w + gap), y = row * (h + gap);
    grid.blit(c.grid, x, y);
    rects.push({ state: c.state, facing: c.facing, frame: c.frame, x, y, w, h, mirrored: c.mirrored });
  }
  return { grid, rects };
}
var FACINGS, mirrorFacing;
var init_render = __esm({
  "../artgen-core/src/render.ts"() {
    "use strict";
    init_direction();
    init_blit();
    init_grid();
    init_normals();
    init_iso();
    init_palette();
    init_post();
    init_prim();
    init_rng();
    init_svg();
    init_voxel();
    init_params();
    init_autotile();
    init_iso2();
    init_lsystem();
    init_materials();
    init_noise();
    init_wfc();
    init_proc();
    init_fp();
    init_anim();
    init_particles();
    init_scene();
    init_scene3d();
    FACINGS = {
      1: ["s"],
      4: ["s", "w", "n", "e"],
      8: ["s", "sw", "w", "nw", "n", "ne", "e", "se"],
      16: ["s", "ssw", "sw", "wsw", "w", "wnw", "nw", "nnw", "n", "nne", "ne", "ene", "e", "ese", "se", "sse"]
    };
    mirrorFacing = (f) => f.replace(/[we]/g, (c) => c === "w" ? "e" : "w");
  }
});

// ../artgen-core/src/qa/metrics.ts
function isShadowPixel(d, i, shadow) {
  return d[i + 3] === shadow[3] && d[i] === shadow[0] && d[i + 1] === shadow[1] && d[i + 2] === shadow[2];
}
function measure(g, { symAxis = "x", palette, shadow = "rgba(0,0,0,0.35)" }) {
  const { w, h, d } = g, pal = new Set(palette), sh = parseColor(shadow);
  let filled = 0, partial = 0, offPal = 0, orphans = 0, edge = 0, edgeDark = 0, symHit = 0, symTot = 0;
  const colors = /* @__PURE__ */ new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = d[i + 3];
    if (!a) continue;
    if (isShadowPixel(d, i, sh)) continue;
    filled++;
    if (a < 255) partial++;
    const c = g.get(x, y);
    colors.add(c);
    if (!pal.has(c)) offPal++;
    const n = [g.get(x + 1, y), g.get(x - 1, y), g.get(x, y + 1), g.get(x, y - 1)];
    if (n.every((v) => v !== c)) orphans++;
    if (n.some((v) => !v)) {
      edge++;
      if (luma(d[i], d[i + 1], d[i + 2]) < 70) edgeDark++;
    }
    const mx = symAxis === "x" ? w - 1 - x : x, my = symAxis === "x" ? y : h - 1 - y;
    if (symAxis !== "none") {
      symTot++;
      if (g.get(mx, my) === c) symHit++;
    }
  }
  const pct = (v) => filled ? +(100 * v / filled).toFixed(1) : 0;
  const m = {
    fillPct: +(100 * filled / (w * h)).toFixed(1),
    colors: colors.size,
    aaPartialPct: pct(partial),
    offPalettePct: pct(offPal),
    orphanPct: pct(orphans),
    outlinePct: edge ? +(100 * edgeDark / edge).toFixed(1) : 0,
    symmetryPct: symTot ? +(100 * symHit / symTot).toFixed(1) : 0,
    hygiene: 0
  };
  let s2 = 10;
  s2 -= Math.min(3, m.aaPartialPct / 5);
  s2 -= Math.min(2, m.offPalettePct / 10);
  s2 -= Math.min(2, Math.max(0, m.orphanPct - 4) / 4);
  s2 -= m.outlinePct < 60 ? (60 - m.outlinePct) / 30 : 0;
  s2 -= m.colors > 24 ? Math.min(2, (m.colors - 24) / 10) : 0;
  m.hygiene = +Math.max(0, s2).toFixed(1);
  return m;
}
var init_metrics = __esm({
  "../artgen-core/src/qa/metrics.ts"() {
    "use strict";
    init_color();
  }
});

// ../artgen-core/src/qa/anim.ts
function animInput(r) {
  const f = r.facings[0];
  return {
    states: r.states.map((s2) => {
      const a = r.brief.anims?.[s2], sub2 = Math.max(1, Math.floor(a?.sub ?? 1)), n = r.frames[s2];
      const frames = r.cells.filter((c) => c.state === s2 && c.facing === f).sort((x, y) => x.frame - y.frame).map((c) => c.grid);
      return { name: s2, loop: a?.loop ?? (r.brief.kind !== "effect" && (n === 1 || LOOPING.test(s2))), logical: n / sub2, ...a?.durations && { durations: a.durations }, frames };
    })
  };
}
function bbox(g) {
  let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (opaqueAt(g, y * g.w + x)) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
function frameDiff(a, b) {
  let u = 0, d = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    const oa = opaqueAt(a, i), ob = opaqueAt(b, i);
    if (!oa && !ob) continue;
    u++;
    if (oa !== ob || a.d[i * 4] !== b.d[i * 4] || a.d[i * 4 + 1] !== b.d[i * 4 + 1] || a.d[i * 4 + 2] !== b.d[i * 4 + 2]) d++;
  }
  return u ? d / u : 0;
}
function histogram(g) {
  const m = /* @__PURE__ */ new Map();
  let n = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) {
    const c = g.get(x, y);
    m.set(c, (m.get(c) ?? 0) + 1);
    n++;
  }
  for (const [k, v] of m) m.set(k, v / (n || 1));
  return m;
}
function frameQA(st) {
  const fs = st.frames, boxes = fs.map(bbox), hist = fs.map(histogram);
  let feetJump = 0, centreJump = 0, drift = 0;
  const diffs = [];
  for (let i = 1; i < fs.length; i++) {
    const a = boxes[i - 1], b = boxes[i];
    if (a && b) {
      feetJump = Math.max(feetJump, Math.abs(a.y1 - b.y1));
      centreJump = Math.max(centreJump, Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2));
    }
    drift = Math.max(drift, histDist(hist[i - 1], hist[i]));
    diffs.push(frameDiff(fs[i - 1], fs[i]));
  }
  let seam;
  if (st.loop && fs.length > 2) {
    const s2 = [...diffs].sort((x, y) => x - y), med = s2[s2.length >> 1] || 1e-6;
    seam = Math.round(frameDiff(fs[fs.length - 1], fs[0]) / med * 100) / 100;
  }
  return { state: st.name, feetJump, centreJump: Math.round(centreJump * 10) / 10, drift: Math.round(drift * 100) / 100, ...seam !== void 0 && { seam } };
}
function fillQA(frames, dir) {
  const lightest = new Set(Object.values(dir.palette.ramps).map((r) => normHex(r[0])));
  const interior = [], brightest = [];
  for (const g of frames) {
    let n = 0, inner = 0, hot = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.alpha(x, y) !== 255) continue;
      n++;
      if (g.alpha(x + 1, y) === 255 && g.alpha(x - 1, y) === 255 && g.alpha(x, y + 1) === 255 && g.alpha(x, y - 1) === 255) inner++;
      if (lightest.has(g.get(x, y))) hot++;
    }
    interior.push(n ? Math.round(inner / n * 100) / 100 : 0);
    brightest.push(n ? Math.round(hot / n * 100) / 100 : 0);
  }
  return { interior, brightest };
}
function animChecks(input, dir, kind, th = ANIM_THRESHOLDS) {
  const checks = [], moving = input.states.filter((s2) => s2.frames.length > 1), effect = kind === "effect";
  if (!moving.length) checks.push({ id: "frames", status: "skip", detail: "no animated states" });
  else {
    const why = [], seen = [];
    for (const st of moving) {
      const q = frameQA(st), w = st.frames[0].w;
      if (!effect && q.feetJump > th.feetMax) why.push(`${st.name}: feet jump ${q.feetJump} px between frames`);
      if (!effect && q.centreJump > Math.max(2, w * th.centreMax)) why.push(`${st.name}: body shifts ${q.centreJump} px sideways between frames`);
      if (!effect && q.drift > th.driftMax) why.push(`${st.name}: colour mix drifts ${q.drift} between frames`);
      if (q.seam !== void 0 && q.seam > th.seamMax && frameDiff(st.frames[st.frames.length - 1], st.frames[0]) >= th.seamMinDiff) why.push(`${st.name}: loop seam ${q.seam}\xD7 the other steps (last \u2192 first frame)`);
      seen.push(`${st.name} ${st.frames.length}f${q.seam !== void 0 ? ` seam ${q.seam}` : ""}`);
    }
    checks.push({ id: "frames", status: why.length ? "flag" : "pass", detail: why.length ? why.join("; ") : seen.join(", ") });
  }
  const attacks = input.states.filter((s2) => ATTACK_STATE.test(s2.name));
  if (!attacks.length) checks.push({ id: "attack", status: "skip", detail: "no attack states" });
  else {
    const why = [], ok = [];
    for (const st of attacks) {
      if (st.logical < th.attackFrames) {
        why.push(`${st.name}: ${st.logical} frames (an attack needs \u2265 ${th.attackFrames}: anticipation, swing, contact, recovery)`);
        continue;
      }
      const d = st.durations;
      if (!d) {
        why.push(`${st.name}: no held contact frame (give anims.${st.name}.durations with one frame held longer)`);
        continue;
      }
      const med = [...d].sort((a, b) => a - b)[d.length >> 1], max2 = Math.max(...d), at = d.indexOf(max2);
      if (max2 < med * th.holdRatio || d.filter((x) => x === max2).length > 1) why.push(`${st.name}: no single held contact frame (durations ${d.join("/")} ms)`);
      else ok.push(`${st.name}: ${st.logical} frames, contact frame ${at} held ${max2} ms`);
    }
    checks.push({ id: "attack", status: why.length ? "flag" : "pass", detail: why.length ? why.join("; ") : ok.join("; ") });
  }
  if (!effect) checks.push({ id: "fill", status: "skip", detail: `${kind ?? "asset"}: not an effect` });
  else {
    const all = input.states.flatMap((s2) => s2.frames), q = fillQA(all, dir);
    const solid = q.interior.filter((v, i) => v > th.fillInterior && q.brightest[i] > th.fillBright).length;
    const mean2 = (a) => Math.round(a.reduce((x, y) => x + y, 0) / (a.length || 1) * 100) / 100;
    const detail = `interior ${mean2(q.interior)} (max ${Math.max(...q.interior)}), brightest ${mean2(q.brightest)} (max ${Math.max(...q.brightest)}); ${solid}/${all.length} solid frames`;
    checks.push({ id: "fill", status: solid > all.length * th.fillFrames ? "flag" : "pass", detail: solid > all.length * th.fillFrames ? `solid blobs: ${detail} \u2014 break the shape up (particles, gaps, a darker body under a small hot core)` : detail });
  }
  return checks;
}
function onionSkin(frames, ghost = "#7fa7d9") {
  if (!frames.length) return new Grid(1, 1);
  const w = frames[0].w, h = frames[0].h, out = new Grid(frames.length * (w + 1) - 1, h);
  const [gr, gg, gb] = [1, 3, 5].map((i) => parseInt(ghost.slice(i, i + 2), 16));
  frames.forEach((f, i) => {
    const ox = i * (w + 1);
    for (const [k, a] of [[2, 0.15], [1, 0.35]]) {
      const p = frames[(i - k + frames.length) % frames.length];
      if (frames.length <= k) continue;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (p.alpha(x, y) !== 255) continue;
        const j = (y * out.w + ox + x) * 4, o = out.d[j + 3] / 255, na = a + o * (1 - a);
        out.d[j] = Math.round((gr * a + out.d[j] * o * (1 - a)) / na);
        out.d[j + 1] = Math.round((gg * a + out.d[j + 1] * o * (1 - a)) / na);
        out.d[j + 2] = Math.round((gb * a + out.d[j + 2] * o * (1 - a)) / na);
        out.d[j + 3] = Math.round(na * 255);
      }
    }
    out.over(f, ox, 0);
  });
  return out;
}
var LOOPING, ATTACK_STATE, opaqueAt, histDist, ANIM_THRESHOLDS;
var init_anim2 = __esm({
  "../artgen-core/src/qa/anim.ts"() {
    "use strict";
    init_color();
    init_grid();
    LOOPING = /^(idle|walk|run|fly|swim|loop|burn|glow|flicker)/;
    ATTACK_STATE = /^(attack|strike|slash|swing|stab|thrust|punch|kick|shoot|fire|cast|bite|claw|smash)/;
    opaqueAt = (g, i) => g.d[i * 4 + 3] === 255;
    histDist = (a, b) => {
      let d = 0;
      for (const k of /* @__PURE__ */ new Set([...a.keys(), ...b.keys()])) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
      return d / 2;
    };
    ANIM_THRESHOLDS = {
      feetMax: 2,
      centreMax: 0.2,
      driftMax: 0.45,
      seamMax: 2.5,
      seamMinDiff: 0.2,
      attackFrames: 4,
      holdRatio: 1.5,
      fillInterior: 0.62,
      fillBright: 0.3,
      fillFrames: 0.5
    };
  }
});

// ../artgen-core/src/qa/tiles.ts
function seamMetric(g) {
  const { w, h } = g;
  const rowStep = (j) => {
    let s2 = 0;
    for (let x = 0; x < w; x++) s2 += diff(g, j * w + x, (j + 1) % h * w + x);
    return s2 / w;
  };
  const colStep = (i) => {
    let s2 = 0;
    for (let y = 0; y < h; y++) s2 += diff(g, y * w + i, y * w + (i + 1) % w);
    return s2 / h;
  };
  const p90 = (a) => {
    const s2 = [...a].sort((x, y) => x - y);
    return s2[Math.min(s2.length - 1, Math.floor(s2.length * 0.9))] ?? 0;
  };
  const rows = Array.from({ length: h - 1 }, (_, j) => rowStep(j)), cols = Array.from({ length: w - 1 }, (_, i) => colStep(i));
  const rw = rowStep(h - 1), cw = colStep(w - 1), ri = p90(rows), ci = p90(cols);
  const ratio = Math.max(rw / Math.max(1, ri), cw / Math.max(1, ci));
  return { ratio: +ratio.toFixed(2), edge: +Math.max(rw, cw).toFixed(1), interior: +Math.max(ri, ci).toFixed(1) };
}
function repetitionMetric(g) {
  const { w, h } = g, L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = g.alpha(x, y) ? lumaAt(g, x, y) : 0;
  const r = Math.max(2, Math.round(Math.min(w, h) / 6)), B = blurWrap(blurWrap(L, w, h, r), w, h, r);
  let mean2 = 0, lmean = 0;
  for (const v of B) mean2 += v;
  mean2 /= B.length;
  for (const v of L) lmean += v;
  lmean /= L.length;
  let s2 = 0, m = 0;
  for (const v of B) {
    s2 += (v - mean2) ** 2;
    m = Math.max(m, Math.abs(v - mean2));
  }
  const counts = /* @__PURE__ */ new Map(), key2 = (i) => g.d[i * 4] << 16 | g.d[i * 4 + 1] << 8 | g.d[i * 4 + 2];
  for (let i = 0; i < w * h; i++) counts.set(key2(i), (counts.get(key2(i)) ?? 0) + 1);
  const mark = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (counts.get(key2(i)) / (w * h) < 0.12) {
    const d = Math.abs(L[i] - lmean);
    if (d > 25) mark[i] = d;
  }
  const seen = new Uint8Array(w * h);
  let mk = 0, mc = 0, blobs = 0;
  const blobContrast = [], blobRare = [];
  for (let i = 0; i < w * h; i++) {
    if (!mark[i] || seen[i]) continue;
    const blob = [], st = [i];
    seen[i] = 1;
    while (st.length) {
      const p = st.pop(), x = p % w, y = p / w | 0;
      blob.push(p);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = ((y + dy) % h + h) % h * w + ((x + dx) % w + w) % w;
        if (mark[q] && !seen[q]) {
          seen[q] = 1;
          st.push(q);
        }
      }
    }
    if (blob.length >= 2) {
      blobs++;
      mk += blob.length;
      let c = 0;
      for (const p of blob) {
        mc += mark[p];
        c += mark[p];
      }
      blobContrast.push(c / blob.length);
      blobRare.push(blob.length >= 3 && blob.every((p) => counts.get(key2(p)) / (w * h) < 0.015));
    }
  }
  const sorted = [...blobContrast].sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
  const standouts = blobContrast.filter((c, i) => blobRare[i] && c > Math.max(60, 2.2 * median)).length;
  const markShare = mk / (w * h), markContrast = mk ? mc / mk : 0;
  return {
    lowStd: +Math.sqrt(s2 / B.length).toFixed(1),
    landmark: +m.toFixed(1),
    markShare: +markShare.toFixed(3),
    markContrast: +markContrast.toFixed(1),
    marks: +(markShare * markContrast).toFixed(2),
    markBlobs: blobs,
    standouts,
    radius: r
  };
}
function repetitionIssues(m, th = REPETITION_FLAG) {
  const out = [];
  if (m.lowStd > th.lowStd) out.push(`tile-sized blotches (low-frequency spread ${m.lowStd} > ${th.lowStd})`);
  if (m.markBlobs >= 1 && m.markBlobs <= th.maxBlobs && m.marks >= th.marks) out.push(`${m.markBlobs} contrasting mark${m.markBlobs > 1 ? "s" : ""} land on the same spots every tile (weight ${m.marks})`);
  else if (m.standouts >= 1 && m.standouts <= 6) out.push(`${m.standouts} mark${m.standouts > 1 ? "s" : ""} far stronger than the rest stand out every tile`);
  return out;
}
function periodicPatch(g) {
  let holes = 0;
  for (let i = 3; i < g.d.length; i += 4) if (g.d[i] < 255) holes++;
  if (!holes) return g;
  const out = g.clone(), hw = g.w >> 1, hh = g.h >> 1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) === 255) continue;
    const sx = (x + hw) % g.w, sy = (y + hh) % g.h;
    if (g.alpha(sx, sy) !== 255) return void 0;
    out.d.set(g.d.subarray((sy * g.w + sx) * 4, (sy * g.w + sx) * 4 + 4), (y * g.w + x) * 4);
  }
  return out;
}
function borderContrast(g) {
  let holes = false;
  for (let i = 3; i < g.d.length; i += 4) if (g.d[i] < 255) {
    holes = true;
    break;
  }
  let bs = 0, bn = 0, is = 0, inn = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) < 255) continue;
    const ring = holes ? [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.alpha(x + dx, y + dy) < 255) : x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
    const l = lumaAt(g, x, y);
    if (ring) {
      bs += l;
      bn++;
    } else {
      is += l;
      inn++;
    }
  }
  return bn && inn ? +Math.abs(bs / bn - is / inn).toFixed(1) : 0;
}
var lumaAt, diff, REPETITION_FLAG;
var init_tiles = __esm({
  "../artgen-core/src/qa/tiles.ts"() {
    "use strict";
    init_noise();
    lumaAt = (g, x, y) => {
      const i = (y * g.w + x) * 4;
      return 0.299 * g.d[i] + 0.587 * g.d[i + 1] + 0.114 * g.d[i + 2];
    };
    diff = (g, a, b) => {
      const i = a * 4, j = b * 4;
      return Math.abs(g.d[i] - g.d[j]) + Math.abs(g.d[i + 1] - g.d[j + 1]) + Math.abs(g.d[i + 2] - g.d[j + 2]) + Math.abs(g.d[i + 3] - g.d[j + 3]);
    };
    REPETITION_FLAG = { lowStd: 5, marks: 0.3, maxBlobs: 12 };
  }
});

// ../artgen-core/src/qa/conformance.ts
function bodyHeight(g) {
  let top = -1, bottom = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) {
    if (top < 0) top = y;
    bottom = y;
    break;
  }
  return top < 0 ? 0 : bottom - top + 1;
}
function lintSource(src) {
  const out = [], re = /(#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|\brgba?\s*\(/;
  src.split("\n").forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, "");
    if (re.test(code)) out.push(`${i + 1}: ${l.trim().slice(0, 80)}`);
  });
  return out;
}
function checkerWindows(g) {
  let n = 0;
  for (let y = 0; y + 2 < g.h; y++) for (let x = 0; x + 2 < g.w; x++) {
    const a = g.get(x, y), b = g.get(x + 1, y);
    if (!a || !b || a === b) continue;
    let ok = true;
    for (let j = 0; j < 3 && ok; j++) for (let i = 0; i < 3 && ok; i++) if (g.get(x + i, y + j) !== ((i + j) % 2 ? b : a)) ok = false;
    if (ok) n++;
  }
  return n;
}
function histogramDistance(a, b) {
  const hist = (g) => {
    const m = /* @__PURE__ */ new Map();
    let n = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      if (c && g.alpha(x, y) === 255) {
        m.set(c, (m.get(c) ?? 0) + 1);
        n++;
      }
    }
    for (const [k, v] of m) m.set(k, v / (n || 1));
    return m;
  };
  const ha = hist(a), hb = hist(b);
  let d = 0;
  for (const k of /* @__PURE__ */ new Set([...ha.keys(), ...hb.keys()])) d += Math.abs((ha.get(k) ?? 0) - (hb.get(k) ?? 0));
  return d / 2;
}
function conformance(input) {
  const { frames, dir, kind, size, source, anchors = [], symAxis = "x" } = input;
  const th = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const checks = [], add2 = (id, status, detail) => checks.push({ id, status, detail });
  const shadowRGBA = [...parseColor(dir.palette.shadow.color).slice(0, 3), Math.round(dir.palette.shadow.alpha * 255)];
  const shadowStr = `rgba(${shadowRGBA.slice(0, 3).join(",")},${dir.palette.shadow.alpha})`;
  const allowed2 = new Set(kindPalette(dir, kind)), outline2 = normHex(dir.palette.outline);
  const wraps = !!kind && TILE_KINDS.has(kind), wrapsX = wraps || !!kind && LAYER_KINDS.has(kind);
  const offBottom = kind === "viewmodel";
  const opaque = (g, x, y) => {
    if (offBottom && y >= g.h) y = g.h - 1;
    if (wrapsX) x = (x % g.w + g.w) % g.w;
    if (wraps) y = (y % g.h + g.h) % g.h;
    else if (wrapsX) y = Math.max(0, Math.min(g.h - 1, y));
    if (!g.inb(x, y)) return false;
    const i = (y * g.w + x) * 4;
    return g.d[i + 3] > 0 && !isShadowPixel(g.d, i, shadowRGBA);
  };
  const colors = /* @__PURE__ */ new Set();
  let off = 0, partial = 0;
  for (const g of frames) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y)) continue;
    const c = g.get(x, y);
    colors.add(c);
    if (!allowed2.has(c)) off++;
    if (g.alpha(x, y) < 255) partial++;
  }
  const max2 = kind ? dir.palette.perKindMax[kind] : void 0;
  if (off) add2("palette", "fail", `${off} off-palette pixels`);
  else if (max2 && colors.size > max2) add2("palette", "fail", `${colors.size} colours > perKindMax.${kind} ${max2}`);
  else add2("palette", "pass", `${colors.size} colours, all in ${kind && dir.palette.perKind[kind] ? `${kind} ramps` : "direction ramps"}`);
  if (!size) add2("scale", "skip", "no expected size");
  else {
    const bad = frames.filter((g) => g.w !== size[0] || g.h !== size[1]);
    add2("scale", bad.length ? "fail" : "pass", bad.length ? `${bad.length} frames not ${size.join("x")}` : `${size.join("x")}`);
  }
  add2("aa", partial ? "fail" : "pass", partial ? `${partial} partial-alpha pixels` : "no partial alpha");
  const darkest = new Set(Object.values(dir.palette.ramps).map((r) => normHex(r[r.length - 1])));
  let edge = 0, inked = 0;
  const laid = wraps ? frames.map((g) => periodicPatch(g) ?? g) : frames;
  for (const g of laid) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y) || !N45.some(([dx, dy]) => !opaque(g, x + dx, y + dy))) continue;
    edge++;
    const c = g.get(x, y);
    if (c === outline2 || dir.line.outer === "selout" && darkest.has(c)) inked++;
  }
  const share = edge ? inked / edge : 0, pctS = `${(100 * share).toFixed(1)}% of ${edge} edge px`;
  if (!edge) add2("line", "skip", wraps ? `${kind}: no silhouette once laid` : "empty frames");
  else if (dir.line.outer === "none") add2("line", share <= th.lineNoneMax ? "pass" : "fail", `outline-coloured edge ${pctS} (want none)`);
  else add2("line", share >= th.lineMin ? "pass" : "fail", `${dir.line.outer} edge ${pctS} (min ${100 * th.lineMin}%)`);
  const lx = Math.sign(dir.camera.light[0]), ly = Math.sign(dir.camera.light[1]);
  const isLine = (g, x, y) => {
    const c = g.get(x, y);
    if (c === outline2) return true;
    return dir.line.outer === "selout" && !!c && darkest.has(c) && N45.some(([dx, dy]) => !opaque(g, x + dx, y + dy));
  };
  let litSum = 0, litN = 0, shSum = 0, shN = 0;
  for (const g of frames) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!opaque(g, x, y)) continue;
    if (isLine(g, x, y)) continue;
    const exposed = (dx, dy) => !opaque(g, x + dx, y + dy) || isLine(g, x + dx, y + dy);
    const lit = !!lx && exposed(lx, 0) || !!ly && exposed(0, ly), away = !!lx && exposed(-lx, 0) || !!ly && exposed(0, -ly);
    if (lit === away) continue;
    const i = (y * g.w + x) * 4, L = luma(g.d[i], g.d[i + 1], g.d[i + 2]);
    if (lit) {
      litSum += L;
      litN++;
    } else {
      shSum += L;
      shN++;
    }
  }
  if (kind && EMISSIVE_KINDS.has(kind)) add2("light", "skip", `${kind}: emissive, no light direction`);
  else if (wraps) add2("light", "skip", `${kind}: ground plane, no silhouette lighting`);
  else if (wrapsX) add2("light", "skip", `${kind}: scenery layer, lit by its own depth`);
  else if (litN < 4 || shN < 4) add2("light", "skip", "too few lit/shaded edge pixels");
  else {
    const dl = litSum / litN - shSum / shN;
    add2("light", dl >= -th.lightTolerance ? "pass" : "fail", `lit \u2212 shaded edge luma ${dl.toFixed(1)}`);
  }
  const checker2 = frames.reduce((n, g) => n + checkerWindows(g), 0);
  if (dir.shading.dither === "none") add2("dither", checker2 <= th.ditherMax ? "pass" : "fail", `${checker2} checkerboard windows`);
  else add2("dither", "pass", `dither ${dir.shading.dither} allowed (${checker2} windows)`);
  if (source === void 0) add2("source", "skip", "no source");
  else {
    const hits = lintSource(source);
    add2("source", hits.length ? "fail" : "pass", hits.length ? `colour literals: ${hits.slice(0, 3).join(" | ")}` : "no colour literals");
  }
  if (input.lint === void 0) add2("lint", "skip", "no scene lint");
  else {
    const hard = input.lint.filter((m) => /\((R4|R11)\)/.test(m));
    add2("lint", hard.length ? "fail" : input.lint.length ? "flag" : "pass", input.lint.length ? input.lint.slice(0, 3).join(" | ") : "clean");
  }
  if (!input.height) add2("height", "skip", "no real-world height in the brief");
  else if (kind && (TILE_KINDS.has(kind) || LAYER_KINDS.has(kind))) add2("height", "skip", `${kind}: ground plane or scenery`);
  else {
    const want = input.height.metres * input.height.pxPerMetre, got = bodyHeight(frames[0]), dev = (got - want) / want;
    const fits = !size || want <= size[1];
    add2(
      "height",
      Math.abs(dev) <= th.heightTolerance ? "pass" : "flag",
      `${got} px drawn, ${want.toFixed(1)} px expected for ${input.height.metres} m (${dev >= 0 ? "+" : ""}${Math.round(dev * 100)} %)${fits ? "" : `; the ${size[1]} px frame is too short for it`}`
    );
  }
  if (kind && TILE_KINDS.has(kind)) {
    const patch = periodicPatch(input.autotile ? frames[(input.autotile === "blob47" ? 47 : 16) - 1] ?? frames[0] : frames[0]);
    if (!patch) {
      add2("seam", "skip", "not a full-bleed or staggered iso tile");
      add2("repetition", "skip", "not a full-bleed or staggered iso tile");
    } else if (input.periodic) {
      add2("seam", "skip", "periodic design");
      add2("repetition", "skip", "periodic design");
    } else {
      const tile = input.autotile ? frames[(input.autotile === "blob47" ? 47 : 16) - 1] ?? frames[0] : frames[0], rim = borderContrast(tile);
      const sm = seamMetric(patch), rm = repetitionMetric(patch), why = repetitionIssues(rm);
      if (rim > th.borderMax) why.push(`the tile's border draws the grid (its rim ${rim} luma off the inside)`);
      add2("seam", sm.ratio <= th.seamMax ? "pass" : "flag", `wrap-edge step ${sm.ratio}\xD7 the interior's`);
      add2("repetition", why.length ? "flag" : "pass", why.length ? why.join("; ") : `lowStd ${rm.lowStd}, ${rm.markBlobs} marks (weight ${rm.marks})`);
    }
  }
  if (input.anim) checks.push(...animChecks(input.anim, dir, kind));
  if (!anchors.length) add2("anchors", "skip", "no anchors for this kind");
  else {
    const dmin = Math.min(...frames.flatMap((f) => anchors.map((a) => histogramDistance(f, a))));
    add2("anchors", dmin <= th.anchorMax ? "pass" : "flag", `nearest anchor histogram distance ${dmin.toFixed(2)}`);
  }
  const metrics = measure(frames[0], { symAxis, palette: [...allowed2], shadow: shadowStr });
  return { pass: checks.every((c) => c.status !== "fail"), checks, metrics };
}
var DEFAULT_THRESHOLDS, N45, TILE_KINDS, LAYER_KINDS, EMISSIVE_KINDS;
var init_conformance = __esm({
  "../artgen-core/src/qa/conformance.ts"() {
    "use strict";
    init_direction();
    init_color();
    init_metrics();
    init_anim2();
    init_tiles();
    DEFAULT_THRESHOLDS = { lineMin: 0.85, lineNoneMax: 0.15, lightTolerance: 4, ditherMax: 2, anchorMax: 0.6, heightTolerance: 0.2, seamMax: 1.8, borderMax: 25 };
    N45 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    TILE_KINDS = /* @__PURE__ */ new Set(["tile", "tileset", "texture"]);
    LAYER_KINDS = /* @__PURE__ */ new Set(["layer"]);
    EMISSIVE_KINDS = /* @__PURE__ */ new Set(["effect"]);
  }
});

// ../artgen-core/src/qa/sheet.ts
function silhouette(g) {
  const out = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) out.set(x, y, SIL_INK);
  return out;
}
function checker(g, x, y, w, h, s2 = 8) {
  for (let j = 0; j < h; j += s2) for (let i = 0; i < w; i += s2)
    g.fill(x + i, y + j, Math.min(s2, w - i), Math.min(s2, h - j), (i + j) / s2 % 2 ? "#2a2a33" : "#33333d");
}
function layout(o, k) {
  let W3 = PAD * 2 + textWidth(o.title, TXT), H = PAD + LAB + PAD / 2;
  const rows = o.rows.map((r) => {
    const s2 = Math.max(1, Math.round(r.scale * k)), sw = r.grid.w * s2, sh = r.grid.h * s2;
    const sil = r.silhouette === false ? 0 : PAD + r.grid.w * silScale(s2);
    W3 = Math.max(W3, PAD * 4 + r.grid.w + sw * 2 + sil, PAD * 2 + textWidth(r.label, TXT));
    const y = H;
    H += LAB + sh + PAD;
    return { r, s: s2, sw, sh, y };
  });
  const as = Math.max(1, Math.round((o.anchorScale ?? 3) * k)), anchors = o.anchors ?? [];
  let ay = 0;
  if (anchors.length) {
    ay = H;
    const aw = anchors.reduce((n, a) => n + a.grid.w * as + PAD, PAD);
    W3 = Math.max(W3, aw);
    H += LAB + Math.max(...anchors.map((a) => a.grid.h * as)) + LAB + PAD;
  }
  return { W: W3, H, rows, as, ay };
}
function reviewSheet(o) {
  const maxEdge = o.maxEdge ?? 1568;
  let k = 1, L = layout(o, k);
  while (Math.max(L.W, L.H) > maxEdge && k > 0.05) {
    k *= 0.85;
    L = layout(o, k);
  }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, o.title, TITLE, TXT);
  for (const { r, s: s2, sw, sh, y } of L.rows) {
    drawText(g, PAD, y, r.label, FG, TXT);
    const top = y + LAB, big = r.grid.scale(s2);
    checker(g, PAD, top, r.grid.w, r.grid.h, 4);
    g.over(r.grid, PAD, top);
    const x2 = PAD * 2 + r.grid.w;
    checker(g, x2, top, sw, sh);
    g.over(big, x2, top);
    const x3 = x2 + sw + PAD;
    g.fill(x3, top, sw, sh, r.bg ?? "#000000");
    if (r.context) g.over(r.context.scale(s2), x3, top);
    g.over(big, x3, top);
    if (r.silhouette !== false) {
      const ss = silScale(s2), x4 = x3 + sw + PAD;
      g.fill(x4, top, r.grid.w * ss, r.grid.h * ss, SIL_BG);
      g.over(silhouette(r.grid).scale(ss), x4, top);
    }
  }
  if (o.anchors?.length) {
    drawText(g, PAD, L.ay, "ANCHORS", FG, TXT);
    let x = PAD;
    for (const a of o.anchors) {
      const top = L.ay + LAB, big = a.grid.scale(L.as);
      checker(g, x, top, big.w, big.h);
      g.over(big, x, top);
      drawText(g, x, top + big.h + 4, a.label, FG, TXT);
      x += big.w + PAD;
    }
  }
  return g;
}
function contactSheet(title, items, scale2, cols, maxEdge = 1568) {
  const size = (sc) => {
    const cw = Array.from({ length: cols }, (_, c) => Math.max(0, ...items.filter((_2, n) => n % cols === c).map((i) => Math.max(i.grid.w * sc, textWidth(i.label, TXT)))) + PAD);
    const rh = Array.from({ length: Math.ceil(items.length / cols) }, (_, r) => Math.max(...items.slice(r * cols, r * cols + cols).map((i) => i.grid.h * sc)) + LAB + PAD);
    const W3 = Math.max(PAD + cw.reduce((a, b) => a + b, 0), PAD * 2 + textWidth(title, TXT)), H = PAD + LAB + rh.reduce((a, b) => a + b, 0) + PAD;
    return { cw, rh, W: W3, H };
  };
  let s2 = scale2, L = size(s2);
  while (Math.max(L.W, L.H) > maxEdge && s2 > 1) {
    s2--;
    L = size(s2);
  }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, title, TITLE, TXT);
  items.forEach((it, n) => {
    const c = n % cols, r = Math.floor(n / cols), big = it.grid.scale(s2);
    const x = PAD + L.cw.slice(0, c).reduce((a, b) => a + b, 0), y = PAD + LAB + L.rh.slice(0, r).reduce((a, b) => a + b, 0);
    if (it.bg) g.fill(x, y, big.w, big.h, it.bg);
    else checker(g, x, y, big.w, big.h);
    if (it.context) g.over(it.context.scale(s2), x, y);
    g.over(big, x, y);
    drawText(g, x, y + big.h + 4, it.label, FG, TXT);
  });
  return g;
}
var SIL_BG, SIL_INK, silScale, PAD, TXT, LAB, BG, FG, TITLE;
var init_sheet = __esm({
  "../artgen-core/src/qa/sheet.ts"() {
    "use strict";
    init_font();
    init_grid();
    SIL_BG = "#c8c8c8";
    SIL_INK = "#000000";
    silScale = (s2) => Math.max(1, Math.round(s2 / 2));
    PAD = 12;
    TXT = 2;
    LAB = GLYPH_H * TXT + 6;
    BG = "#16161c";
    FG = "#dddddd";
    TITLE = "#ffffff";
  }
});

// ../artgen-core/src/qa/ledger.ts
function imageTokens(w, h) {
  const s2 = Math.min(1, 1568 / Math.max(w, h));
  return Math.ceil(w * s2 * (h * s2) / 750);
}
function formatLedgerLine(e) {
  if (!e.ts || !e.type || !e.asset) throw new Error("ledger entry needs ts, type and asset");
  return JSON.stringify(e);
}
function parseLedger(text2) {
  const out = [];
  text2.split("\n").forEach((l, i) => {
    if (!l.trim()) return;
    try {
      out.push(JSON.parse(l));
    } catch {
      throw new Error(`ledger line ${i + 1}: invalid JSON`);
    }
  });
  return out;
}
var sourceHash;
var init_ledger = __esm({
  "../artgen-core/src/qa/ledger.ts"() {
    "use strict";
    init_rng();
    sourceHash = (src) => hashString(src.replace(/\r\n/g, "\n"));
  }
});

// ../artgen-core/src/pipeline.ts
function parseVersion(s2) {
  const m = s2.match(/^(base|finish)\.v(\d+)(?:\.js)?$/);
  return m ? { name: `${m[1]}.v${m[2]}`, kind: m[1], n: +m[2] } : null;
}
function passId(version, revisionPasses2, user) {
  const v = parseVersion(version);
  if (!v) throw new Error(`not a pipeline version: ${version}`);
  if (v.kind === "finish") return v.n === 1 ? "f" : `f${v.n}`;
  if (v.n <= revisionPasses2) return `r${v.n}`;
  if (!user) return `u${v.n - revisionPasses2}`;
  const ub = user.map(parseVersion).filter((u) => !!u && u.kind === "base").map((u) => u.n).sort((a, b) => a - b);
  const k = ub.indexOf(v.n);
  return k >= 0 ? `u${k + 1}` : `x${v.n - revisionPasses2 - ub.filter((n) => n < v.n).length}`;
}
function blindScores(ledger) {
  const m = /* @__PURE__ */ new Map();
  for (const e of ledger) if (e.type === "score" && e.blind && e.version && typeof e.score === "number")
    m.set(e.version, { score: e.score, ...typeof e.note === "string" && e.note && { note: e.note }, ...typeof e.reviewer === "string" && { reviewer: e.reviewer } });
  return m;
}
function blindIssues(own, blind, o) {
  if (!blind) return [];
  const out = [], note = blind.note ? `: ${blind.note}` : "";
  if (own - blind.score > o.maxGap) out.push(`blind re-score ${blind.score} vs ${own} (gap ${+(own - blind.score).toFixed(2)})${note}`);
  else if (blind.score < o.minScore) out.push(`blind re-score ${blind.score} is under ${o.minScore}${note}`);
  return out;
}
function latestScores(ledger) {
  const m = /* @__PURE__ */ new Map();
  for (const e of ledger) if (e.type === "score" && !e.blind && e.version && typeof e.score === "number")
    m.set(e.version, { score: e.score, gate: e.conformance?.pass, failing: e.conformance?.checks?.filter((c) => c.status === "fail").map((c) => `${c.id}: ${c.detail}`) });
  return m;
}
function planPasses(input) {
  const { asset: asset2, revisionPasses: N3, finishPass } = input;
  const vs = input.versions.map(parseVersion).filter((v) => !!v);
  const bases = vs.filter((v) => v.kind === "base").sort((a, b) => a.n - b.n), finishes = vs.filter((v) => v.kind === "finish").sort((a, b) => a.n - b.n);
  const scores = latestScores(input.ledger), fb = input.feedback, userOpened = fb?.map((f) => f.opens);
  const pid = (v) => passId(v, N3, userOpened);
  const isUserBase = (b) => b.n > N3 && (!fb || fb.some((f) => f.opens === b.name));
  const rows = [...bases, ...finishes].map((v) => ({
    version: v.name,
    pass: pid(v.name),
    score: scores.get(v.name)?.score,
    gate: scores.get(v.name)?.gate,
    ...v.kind === "finish" && input.finishBase?.[v.name] && { base: input.finishBase[v.name] }
  }));
  const bestOf = (upTo) => {
    let best2;
    for (const b of bases) {
      if (b.n > upTo) break;
      const s2 = scores.get(b.name)?.score;
      if (s2 !== void 0 && (!best2 || s2 >= best2.score)) best2 = { version: b.name, score: s2 };
    }
    return best2;
  };
  const state = (next) => ({ asset: asset2, rows, best: bestOf(Infinity), next });
  const unscored = [...bases, ...finishes].find((v) => !scores.has(v.name));
  if (unscored) return state({ action: "review", version: unscored.name, pass: pid(unscored.name), why: "render it, build the review sheet (v(n\u22121) beside v(n)), score it" });
  for (let i = 1; i <= N3; i++) {
    if (bases.some((b) => b.n === i)) continue;
    const from = bestOf(i - 1);
    return state({
      action: "write-base",
      version: `base.v${i}`,
      pass: `r${i}`,
      from: from?.version,
      why: from ? `revise from the best-scoring version so far, ${from.version} (${from.score}) \u2014 R12` : "first build: T2+ base + procedural pass from the brief and direction"
    });
  }
  const best = bestOf(Infinity);
  const lastFinish = finishes[finishes.length - 1], bound = lastFinish && input.finishBase?.[lastFinish.name];
  const nextBase = `base.v${(bases[bases.length - 1]?.n ?? 0) + 1}`, nextFinish = `finish.v${(lastFinish?.n ?? 0) + 1}`;
  const open = fb?.filter((f) => !vs.some((v) => v.name === f.opens)).pop();
  if (open) {
    const shown = bound ?? best.version;
    if (open.route === "base") return state({ action: "write-base", version: open.opens, pass: pid(open.opens), from: shown, why: `user feedback (form, proportion, colour): new base from ${shown}, the version the user saw${userWords(open)}` });
    return state({ action: "write-finish", version: open.opens, pass: pid(open.opens), base: shown, why: `user feedback (pixels): finish revision on ${shown}${userWords(open)}` });
  }
  const userBases = bases.filter(isUserBase), target = userBases.length ? { version: userBases[userBases.length - 1].name, score: scores.get(userBases[userBases.length - 1].name).score } : best;
  if (!finishPass) return state({ action: "ready", final: target.version, best: best.version, issues: scores.get(target.version)?.failing ?? [], why: "finishing pass disabled by the direction" });
  if (!lastFinish) return state({ action: "write-finish", version: "finish.v1", pass: "f", base: target.version, why: `one direct-pixel pass on the best base, ${target.version} (${target.score}) \u2014 R2, R12` });
  if (bound && bound !== target.version && (parseVersion(bound)?.n ?? 0) < parseVersion(target.version).n) {
    const why = userBases.some((b) => b.name === target.version) ? `a user iteration produced ${target.version}; re-finish it` : `${target.version} (${target.score}) now beats ${bound}, which ${lastFinish.name} finishes; re-finish the best \u2014 R12`;
    return state({ action: "write-finish", version: nextFinish, pass: pid(nextFinish), base: target.version, why });
  }
  const fin = scores.get(lastFinish.name), extrasUsed = bases.filter((b) => b.n > N3 && !isUserBase(b)).length;
  const canExtra = !userBases.length && extrasUsed < (input.extraRevisions ?? 0);
  if (fin.gate === false && canExtra)
    return state({ action: "write-base", version: nextBase, pass: pid(nextBase), from: best.version, why: `the final still fails the gate (${(fin.failing ?? []).join("; ") || "see conformance"}): one extra autonomous revision from ${best.version} (budget)` });
  let blindOpen = [];
  if (input.blind && !input.ledger.some((e) => e.type === "approve" && e.by === "user" && e.version === lastFinish.name)) {
    const bl = blindScores(input.ledger).get(lastFinish.name);
    if (!bl) return state({ action: "blind-review", version: lastFinish.name, pass: "b", why: "a fresh reviewer scores the final from the blind sheet (`review --blind`, then `score --blind --reviewer <name>`): self-scores drift upward" });
    blindOpen = blindIssues(fin.score, bl, input.blind);
    if (blindOpen.length && canExtra)
      return state({ action: "write-base", version: nextBase, pass: pid(nextBase), from: best.version, why: `${blindOpen.join("; ")}: one extra autonomous revision from ${best.version} that fixes what the blind reviewer named (budget)` });
  }
  const issues = [...fin.gate === false ? fin.failing ?? ["gate failed"] : [], ...blindOpen];
  return state({
    action: "ready",
    final: lastFinish.name,
    best: best.version,
    issues,
    why: issues.length ? "pipeline complete with open issues: mark it final and list them for the user" : "pipeline complete: show the finished asset to the user (approve or give feedback)"
  });
}
var userWords;
var init_pipeline = __esm({
  "../artgen-core/src/pipeline.ts"() {
    "use strict";
    userWords = (f) => {
      if (!f.note) return "";
      const where = f.region ? ` (region x,y,w,h ${f.region.join(",")}${f.cell ? ` of ${f.cell}` : ""})` : f.cell ? ` (${f.cell})` : "";
      return ` \u2014 user: "${f.note}"${where}`;
    };
  }
});

// ../artgen-core/src/views/views.ts
function tones(dir, ramp) {
  const r = dir.palette.ramps[ramp] ?? Object.values(dir.palette.ramps)[0];
  return { lo: r[r.length - 1], mid: r[Math.max(0, r.length - 2)], hi: r[r.length >> 1] };
}
function obliqueRoom(w, h, dir, frontRatio = dir.camera.oblique?.frontRatio ?? 0.5) {
  const g = new Grid(w, h), floor = tones(dir, "stone"), wall = tones(dir, "wood"), tile = Math.max(6, Math.round(w / 4)), row = Math.max(3, Math.round(tile * (1 / frontRatio - 1)));
  const wallH = Math.round(h / 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y < wallH) g.set(x, y, y === wallH - 1 || x % (tile * 2) === 0 ? wall.mid : wall.lo);
    else g.set(x, y, (y - wallH) % row === 0 || x % tile === 0 ? floor.lo : floor.mid);
  }
  return g;
}
function sideStrip(w, h, dir) {
  const g = new Grid(w, h), sky2 = dir.background ?? tones(dir, "stone").lo, ground = tones(dir, "grass"), dirt = tones(dir, "dirt");
  const gy = h - Math.max(2, Math.round(h / 10));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, y < gy ? sky2 : y === gy ? ground.hi : (x + y) % 5 ? dirt.mid : dirt.lo);
  return g;
}
function rotateGrid(g, rad, out = new Grid(g.w, g.h)) {
  const c = Math.cos(rad), s2 = Math.sin(rad), cx = g.w / 2, cy = g.h / 2, ox = out.w / 2, oy = out.h / 2;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy, sx = Math.floor(c * dx + s2 * dy + cx), sy = Math.floor(-s2 * dx + c * dy + cy);
    const i = (sy * g.w + sx) * 4;
    if (g.inb(sx, sy) && g.d[i + 3]) out.d.set(g.d.subarray(i, i + 4), (y * out.w + x) * 4);
  }
  return out;
}
function stackComposite(slices, rad, spacing = 1) {
  if (!slices.length) return new Grid(1, 1);
  const w = slices[0].w, h = slices[0].h, lift = Math.ceil((slices.length - 1) * spacing), out = new Grid(w, h + lift);
  slices.forEach((s2, i) => {
    const r = rotateGrid(s2, rad);
    out.stamp(r, 0, lift - Math.round(i * spacing));
  });
  return out;
}
function stackStrip(slices, n = 8, spacing = 1) {
  const frames = Array.from({ length: n }, (_, i) => stackComposite(slices, i / n * Math.PI * 2, spacing));
  const out = new Grid(frames.reduce((a, f) => a + f.w + 1, -1), frames[0].h);
  let x = 0;
  for (const f of frames) {
    out.blit(f, x, 0);
    x += f.w + 1;
  }
  return out;
}
function parallaxStrip(layers, viewW, offsets = [0, 24, 48]) {
  const h = Math.max(...layers.map((l) => l.grid.h)), out = new Grid((viewW + 1) * offsets.length - 1, h);
  offsets.forEach((cam, k) => {
    for (const l of layers) {
      const lw = l.grid.w, off = -cam * l.depth, start = off - Math.ceil(off / lw) * lw;
      for (let x = start; x < viewW; x += lw) for (let y = 0; y < l.grid.h; y++) for (let i = 0; i < lw; i++) {
        const sx = Math.round(x) + i;
        if (sx < 0 || sx >= viewW) continue;
        const c = l.grid.get(i, y);
        if (c && l.grid.alpha(i, y) === 255) out.set(k * (viewW + 1) + sx, h - l.grid.h + y, c);
      }
    }
  });
  return out;
}
function viewContext(view, w, h, dir) {
  return VIEW_MODULES[view]?.context?.(w, h, dir);
}
var VIEW_MODULES;
var init_views = __esm({
  "../artgen-core/src/views/views.ts"() {
    "use strict";
    init_grid();
    init_iso();
    VIEW_MODULES = {
      topdown: { id: "topdown", projection: "orthographic, straight down", anchor: "center", sort: "none (or y)", runtime: ["ArtSprite.face"], render3d: { renderer: "raster", view: "topdown" } },
      oblique: { id: "oblique", projection: "top + front face; a cube shows top : front = (1/frontRatio \u2212 1) : 1, heights at full size", anchor: "feet", sort: "by ground row (y), then z", runtime: ["obliqueToScreen", "obliqueDepth"], context: obliqueRoom, render3d: { renderer: "raster", view: "oblique" } },
      iso: { id: "iso", projection: "2:1 dimetric: x \u2192 (2, 1), y \u2192 (\u22122, 1), z \u2192 (0, \u22122) px", anchor: "feet", sort: "x + y, then z", runtime: ["isoToScreen", "screenToIso", "depthKey"], context: (w, h) => isoFloor(w, h), render3d: { renderer: "cubes", view: "iso" } },
      stack: { id: "stack", projection: "voxel z-slices, top-down; drawn rotated and stepped up", anchor: "center", sort: "y of the base", runtime: ["pack.stack", "StackSprite"], render3d: { renderer: "raster", view: "topdown" } },
      side: { id: "side", projection: "orthographic side view; parallax layers scroll by depth", anchor: "feet", sort: "layer, then x", runtime: ["parallaxTiles"], context: sideStrip, render3d: { renderer: "raster", view: "side" } },
      fp: { id: "fp", projection: "raycaster: assets are wall / floor textures, 8-direction billboards and view-models", anchor: "feet", sort: "distance (raycaster)", runtime: ["three billboards", "tileTexture"], render3d: { renderer: "raster", view: "billboard" } }
    };
  }
});

// ../artgen-core/src/voxel/gltf.ts
var init_gltf = __esm({
  "../artgen-core/src/voxel/gltf.ts"() {
    "use strict";
    init_color();
    init_raster2();
  }
});

// ../artgen-core/src/t2/finish.ts
function makePx(dc, record = () => {
}, guard = /* @__PURE__ */ new Set()) {
  const outline2 = dc.outline, rampOf = /* @__PURE__ */ new Map();
  for (const [name, r] of Object.entries(dc.pal)) r.forEach((c, i) => {
    if (!rampOf.has(c)) rampOf.set(c, [name, i]);
  });
  const [lx, ly] = dc.camera.light.map(Math.sign);
  const color = (t) => {
    if (t.startsWith("#") || t.startsWith("rgb")) return normHex(t);
    if (t === "outline") return outline2;
    const [name, idx] = t.split("."), ramp = dc.pal[name] ?? dc.pal[dc.palette.materials[name]];
    if (!ramp) throw new Error(`finish: unknown colour token ${JSON.stringify(t)}`);
    const i = idx === void 0 ? 0 : idx === "last" ? ramp.length - 1 : +idx;
    if (!(i >= 0 && i < ramp.length)) throw new Error(`finish: colour token out of range: ${t}`);
    return ramp[i];
  };
  const step = (c, k) => {
    const hit = rampOf.get(c);
    if (!hit) return c;
    const r = dc.pal[hit[0]];
    return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))];
  };
  const tokenOf = (c) => {
    if (!c) return null;
    if (c === outline2) return "outline";
    const hit = rampOf.get(c);
    return hit ? `${hit[0]}.${hit[1]}` : c;
  };
  const opaque = (g, x, y) => g.alpha(x, y) === 255;
  const selout2 = dc.line.outer === "selout";
  const isLine = (g, x, y) => g.get(x, y) === outline2 || selout2 && opaque(g, x, y) && N46.some(([dx, dy]) => !opaque(g, x + dx, y + dy));
  const fill2 = (g, x, y) => opaque(g, x, y) && !isLine(g, x, y);
  const open = (g, x, y) => !opaque(g, x, y) || isLine(g, x, y);
  const inScope = (o, g, x, y) => {
    if (guard.has(`${x},${y}`)) return false;
    if (o?.region) {
      const [rx, ry, rw, rh] = o.region;
      if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) return false;
    }
    if (o?.ramps) {
      const c = g.get(x, y), hit = c && rampOf.get(c);
      if (!hit || !o.ramps.includes(hit[0])) return false;
    }
    return true;
  };
  const each = (g, o, fn) => {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (inScope(o, g, x, y)) fn(x, y);
  };
  const batch = (g, writes) => {
    for (const [x, y, c] of writes) if (c === null) g.clear(x, y);
    else g.set(x, y, c);
    return g;
  };
  const plot = (g, x, y, c) => {
    if (!guard.has(`${x},${y}`)) g.set(x, y, c);
  };
  const px = {
    color,
    step,
    /** Direction token of a pixel (`skin.2`, `outline`), or null when empty — to repaint with the colour already there. */
    tokenAt: (g, at) => opaque(g, at[0], at[1]) ? tokenOf(g.get(at[0], at[1])) : null,
    set(g, at, token) {
      plot(g, at[0], at[1], color(token));
      return g;
    },
    fill(g, [x, y, w, h], token) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) plot(g, i, j, color(token));
      return g;
    },
    /** 1 px Bresenham line. */
    line(g, a, b, token) {
      let [x0, y0] = a;
      const [x1, y1] = b, c = color(token);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (; ; ) {
        plot(g, x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) {
          e += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          e += dx;
          y0 += sy;
        }
      }
      return g;
    },
    /**
     * Char-map patch (T1 `blit`): `rows` of characters, `.` transparent, `_` clears the pixel, others look up a
     * token in `key`. `anchor: 'center'` (default) centres the map on `at`; `'topleft'` puts its corner there.
     */
    patch(g, at, rows, key2, o = {}) {
      const h = rows.length, w = Math.max(...rows.map((r) => r.length));
      const x0 = o.anchor === "topleft" ? at[0] : at[0] - (w >> 1), y0 = o.anchor === "topleft" ? at[1] : at[1] - (h >> 1);
      const under = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) under.push(tokenOf(g.get(x0 + x, y0 + y)));
      const cols = {};
      for (const [ch, t] of Object.entries(key2)) cols[ch] = color(t);
      rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === ".") return;
        if (ch === "_") g.clear(x0 + x, y0 + y);
        else if (cols[ch]) g.set(x0 + x, y0 + y, cols[ch]);
        else throw new Error(`patch: no key for ${JSON.stringify(ch)}`);
        guard.add(`${x0 + x},${y0 + y}`);
      }));
      record({ anchor: at.anchor, x: x0, y: y0, w, h, under, rows, key: key2, mode: o.anchor ?? "center" });
      return g;
    },
    fix: {
      /** Single pixels whose four neighbours all differ from them take the neighbours' majority colour (≥ 3 agree). */
      orphans(g, o) {
        const w = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y);
          if (!c || !opaque(g, x, y) || c === outline2) return;
          const n = N46.map(([dx, dy]) => opaque(g, x + dx, y + dy) ? g.get(x + dx, y + dy) : null);
          if (n.some((v) => v === c || v === null)) return;
          const counts = /* @__PURE__ */ new Map();
          for (const v of n) counts.set(v, (counts.get(v) ?? 0) + 1);
          const [best, cnt] = [...counts].sort((a, b) => b[1] - a[1])[0];
          if (cnt >= 3 && best !== outline2) w.push([x, y, best]);
        });
        return batch(g, w);
      },
      /** Thin 4-connected outline stairs to 8-connected: drop elbow pixels that only touch outline and empty space. */
      jaggies(g, o) {
        const isO = (x, y) => opaque(g, x, y) && g.get(x, y) === outline2;
        each(g, o, (x, y) => {
          if (!isO(x, y)) return;
          const n = N46.map(([dx, dy]) => isO(x + dx, y + dy));
          if (N46.some(([dx, dy], i) => !n[i] && opaque(g, x + dx, y + dy))) return;
          const h = n[0] || n[1], v = n[2] || n[3];
          if (n.filter(Boolean).length === 2 && h && v) g.clear(x, y);
        });
        return g;
      },
      /** Pillow shading: edge pixels on the lit side darker than the pixel inside them take the inner colour. */
      pillow(g, o) {
        const w = [];
        each(g, o, (x, y) => {
          if (!fill2(g, x, y)) return;
          const c = g.get(x, y), rc = rampOf.get(c);
          if (!rc) return;
          for (const [dx, dy] of [[lx, 0], [0, ly]]) {
            if (!dx && !dy) continue;
            if (!open(g, x + dx, y + dy) || !fill2(g, x - dx, y - dy)) continue;
            const inner = g.get(x - dx, y - dy), ri = rampOf.get(inner);
            if (ri && ri[0] === rc[0] && ri[1] < rc[1]) {
              w.push([x, y, inner]);
              break;
            }
          }
        });
        return batch(g, w);
      },
      /** 1 px bands squeezed between a lighter and a darker step of the same ramp merge into the lighter step. */
      banding(g, o) {
        const w = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y), rc = c && rampOf.get(c);
          if (!rc || !fill2(g, x, y)) return;
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const a = g.get(x - dx, y - dy), b = g.get(x + dx, y + dy), ra = a && rampOf.get(a), rb = b && rampOf.get(b);
            if (!ra || !rb || ra[0] !== rc[0] || rb[0] !== rc[0]) continue;
            const lo = Math.min(ra[1], rb[1]), hi = Math.max(ra[1], rb[1]);
            if (!(lo < rc[1] && rc[1] < hi)) continue;
            if (g.get(x + dy, y + dx) === c && g.get(x - dy, y - dx) === c) {
              w.push([x, y, dc.pal[rc[0]][lo]]);
              break;
            }
          }
        });
        return batch(g, w);
      },
      /** Close outline gaps: fill pixels exposed to empty space get the direction's outer line again. */
      lines(g) {
        const out = dc.line.outer === "none" ? g : dc.line.outer === "selout" ? selout(g, Object.values(dc.pal), outline2) : outline(g, outline2);
        g.d.set(out.d);
        return g;
      }
    },
    fx: {
      /** Bright pixel (`dot`), plus or x shape; default colour is the lightest step of the pixel's ramp. */
      glint(g, at, token, o = {}) {
        const base = g.get(at[0], at[1]), c = token ? color(token) : base ? step(base, -99) : null;
        if (!c) return g;
        plot(g, at[0], at[1], c);
        const arms = o.shape === "plus" ? N46 : o.shape === "x" ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [];
        for (const [dx, dy] of arms) if (opaque(g, at[0] + dx, at[1] + dy) && g.get(at[0] + dx, at[1] + dy) !== outline2) plot(g, at[0] + dx, at[1] + dy, step(g.get(at[0] + dx, at[1] + dy), -1));
        return g;
      },
      /** Four-armed spark of radius r in `token` (arms may extend over empty pixels). */
      spark(g, at, token, r = 2) {
        const c = color(token);
        plot(g, at[0], at[1], c);
        for (let k = 1; k <= r; k++) for (const [dx, dy] of N46) plot(g, at[0] + dx * k, at[1] + dy * k, c);
        return g;
      },
      /** Lighten fill pixels within radius r by one step. */
      glow(g, at, r = 2) {
        const w = [];
        for (let y = at[1] - r; y <= at[1] + r; y++) for (let x = at[0] - r; x <= at[0] + r; x++)
          if ((x - at[0]) ** 2 + (y - at[1]) ** 2 <= r * r && fill2(g, x, y) && !guard.has(`${x},${y}`)) w.push([x, y, step(g.get(x, y), -1)]);
        return batch(g, w);
      }
    },
    light: {
      /** Edges facing the light → lightest step (`side: 'away'`: edges facing away step one lighter). */
      rim(g, o = {}) {
        const w = [], s2 = o.side === "away" ? -1 : 1;
        each(g, o, (x, y) => {
          if (!fill2(g, x, y)) return;
          const c = g.get(x, y);
          if (lx && open(g, x + lx * s2, y) || ly && open(g, x, y + ly * s2)) w.push([x, y, s2 > 0 ? step(c, -99) : step(c, -1)]);
        });
        return batch(g, w);
      },
      /** Set one pixel to the lightest step of its ramp (or a token). */
      highlight(g, at, token) {
        const c = g.get(at[0], at[1]);
        if (c && c !== outline2) plot(g, at[0], at[1], token ? color(token) : step(c, -99));
        return g;
      },
      /** Move every fill pixel in scope `by` steps along its ramp (default -1 = one lighter): light-side shade fixes. */
      tone(g, o = {}) {
        const w = [];
        each(g, o, (x, y) => {
          if (fill2(g, x, y)) w.push([x, y, step(g.get(x, y), o.by ?? -1)]);
        });
        return batch(g, w);
      },
      /** Edges facing away from the light step one darker. */
      shade(g, o) {
        const w = [];
        each(g, o, (x, y) => {
          if (!fill2(g, x, y)) return;
          if (lx && open(g, x - lx, y) || ly && open(g, x, y - ly)) w.push([x, y, step(g.get(x, y), 1)]);
        });
        return batch(g, w);
      }
    },
    outline: {
      /** Selective outline: outline pixels on the lit side take the darkest step of the fill they border. */
      selout(g, o = {}) {
        const w = [];
        each(g, { region: o.region }, (x, y) => {
          if (!opaque(g, x, y) || g.get(x, y) !== outline2) return;
          const dirs = o.side === "all" ? N46 : [[-lx, 0], [0, -ly]].filter(([a, b]) => a || b);
          for (const [dx, dy] of dirs) {
            if (!fill2(g, x + dx, y + dy)) continue;
            const hit = rampOf.get(g.get(x + dx, y + dy));
            if (!hit || o.ramps && !o.ramps.includes(hit[0])) continue;
            const r = dc.pal[hit[0]];
            if (r.length > 1 && hit[1] < r.length - 1) {
              w.push([x, y, r[r.length - 1]]);
              break;
            }
          }
        });
        return batch(g, w);
      },
      /** Inner line where ramp `between[0]` meets `between[1]`: the first ramp's pixels there take `color` (default its darkest step). */
      inner(g, o) {
        const [a, b] = o.between, w = [];
        each(g, o, (x, y) => {
          const c = g.get(x, y), hit = c && rampOf.get(c);
          if (!hit || hit[0] !== a || !fill2(g, x, y)) return;
          if (N46.some(([dx, dy]) => {
            const n = g.get(x + dx, y + dy), hn = n && rampOf.get(n);
            return !!hn && hn[0] === b;
          }))
            w.push([x, y, o.color ? color(o.color) : dc.pal[a][dc.pal[a].length - 1]]);
        });
        return batch(g, w);
      },
      corners(g, o) {
        return px.fix.jaggies(g, o);
      },
      /** Heavier line: empty pixels 4-adjacent to the outline get the outline colour (`times` rings). */
      weight(g, o = {}) {
        for (let k = 0; k < (o.times ?? 1); k++) {
          const w = [];
          each(g, { region: o.region }, (x, y) => {
            if (opaque(g, x, y)) return;
            if (N46.some(([dx, dy]) => opaque(g, x + dx, y + dy) && g.get(x + dx, y + dy) === outline2)) w.push([x, y, outline2]);
          });
          batch(g, w);
        }
        return g;
      }
    }
  };
  return px;
}
function applyFinish(r, mod4, dir) {
  const dc = dirContext(dir), patches = [], done = /* @__PURE__ */ new Map();
  const keyOf = (c) => `${c.state}/${c.facing}/${c.frame}`;
  const sources = r.cells.filter((c) => !c.mirrored);
  for (const c of sources) {
    const guard = /* @__PURE__ */ new Set(), cellKey = keyOf(c);
    const px = makePx(dc, (p) => patches.push({ cell: cellKey, ...p }), guard);
    const anchors = c.anchors ?? {};
    const ctx = {
      dir: dc,
      lib: { px, Grid },
      state: c.state,
      facing: c.facing,
      frame: c.frame,
      anchors,
      at(name, dx = 0, dy = 0) {
        const a = anchors[name];
        if (!a) throw new Error(`finish: cell ${cellKey} has no anchor ${JSON.stringify(name)}`);
        return Object.assign([a[0] + dx, a[1] + dy], { anchor: dx || dy ? `${name}${dx >= 0 ? "+" : ""}${dx},${dy >= 0 ? "+" : ""}${dy}` : name });
      },
      key: (state, frame = 0, facing) => c.state === state && c.frame === frame && (facing === void 0 || c.facing === facing),
      protect: (...pts) => pts.forEach(([x, y]) => guard.add(`${x},${y}`))
    };
    const g = c.grid.clone();
    done.set(cellKey, mod4.finish(g, ctx) ?? g);
  }
  const anchored = patches.filter((p) => p.anchor && !p.replay);
  for (const c of sources) {
    const k = keyOf(c), own = new Set(patches.filter((p) => p.cell === k).map((p) => p.anchor));
    for (const p of anchored) {
      if (p.cell === k || own.has(p.anchor) || p.cell.split("/")[1] !== c.facing) continue;
      const [name, off] = splitAnchor(p.anchor), a = c.anchors?.[name];
      if (!a) continue;
      const g = done.get(k), px = makePx(dc, (rec) => patches.push({ cell: k, ...rec, replay: true }));
      const src = p;
      px.patch(g, Object.assign([a[0] + off[0], a[1] + off[1]], { anchor: p.anchor }), src.rows, src.key, { anchor: src.mode });
      own.add(p.anchor);
    }
  }
  const cells = r.cells.map((c) => {
    if (!c.mirrored) {
      const g2 = done.get(keyOf(c));
      return { ...c, grid: g2, ...c.normal && { normal: fitNormalMap(g2, c.normal) } };
    }
    const src = done.get(`${c.state}/${c.facing.replace(/[we]/g, (ch) => ch === "w" ? "e" : "w")}/${c.frame}`);
    const g = src ? src.flip("x") : c.grid;
    return { ...c, grid: g, ...c.normal && { normal: fitNormalMap(g, c.normal) } };
  });
  return { render: { ...r, cells }, patches };
}
function splitAnchor(a) {
  const m = a.match(/^(.*?)([+-]\d+),([+-]\d+)$/);
  return m ? [m[1], [+m[2], +m[3]]] : [a, [0, 0]];
}
function finishStale(snapshot, current, tolerance = 0.25) {
  const ids2 = (list) => {
    const seen = /* @__PURE__ */ new Map();
    return list.map((p) => {
      const n = seen.get(p.cell) ?? 0;
      seen.set(p.cell, n + 1);
      return `${p.cell}#${p.anchor ?? `patch${n}`}`;
    });
  };
  const out = [], curIds = ids2(current), now = new Map(current.map((p, i) => [curIds[i], p]));
  ids2(snapshot).forEach((id, i) => {
    const p = snapshot[i], c = now.get(id);
    if (!c) {
      out.push(`${id}: patch no longer applied`);
      return;
    }
    if (c.under.length !== p.under.length) {
      out.push(`${id}: footprint changed`);
      return;
    }
    const diff2 = p.under.filter((v, k) => v !== c.under[k]).length / Math.max(1, p.under.length);
    if (diff2 > tolerance) out.push(`${id}: ${(100 * diff2).toFixed(0)}% of the pixels under the patch changed`);
  });
  return out;
}
var N46, finishSnapshot;
var init_finish = __esm({
  "../artgen-core/src/t2/finish.ts"() {
    "use strict";
    init_direction();
    init_color();
    init_grid();
    init_normals();
    init_post();
    N46 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    finishSnapshot = (patches) => patches.map(({ cell, anchor, x, y, w, h, under, replay }) => ({ cell, anchor, x, y, w, h, under, ...replay && { replay } }));
  }
});

// ../artgen-core/src/w1/candidates.ts
function describeDirection(d) {
  const ramps = Object.keys(d.palette.ramps).length, colors = new Set(Object.values(d.palette.ramps).flat()).size;
  const lum = Object.values(d.palette.ramps).flat().map(lumaOf), avg = lum.reduce((a, b) => a + b, 0) / (lum.length || 1);
  return [
    `${colors} colours, ${ramps} ramps, mean luma ${Math.round(avg)}`,
    `line ${d.line.outer}/${d.line.inner}, bands ${d.shading.bands}, dither ${d.shading.dither}`,
    `hue shift ${d.shading.hueShift}, head ${d.scale.proportions?.headRatio ?? "-"}`
  ];
}
var PROBE_KINDS;
var init_candidates = __esm({
  "../artgen-core/src/w1/candidates.ts"() {
    "use strict";
    init_color();
    init_palette();
    init_rng();
    init_direction();
    PROBE_KINDS = ["character", "prop", "tile", "effect"];
  }
});

// ../artgen-core/src/w1/sheets.ts
function swatches(g, x, y, dir, sw, names) {
  const rows = [...Object.entries(dir.palette.ramps), ["outline", [dir.palette.outline]]];
  const nameW = names ? Math.max(...rows.map(([n]) => textWidth(n, TXT2))) + 8 : 0;
  let w = 0;
  rows.forEach(([name, ramp], i) => {
    const yy = y + i * (sw + 2);
    if (g && names) drawText(g, x, yy + (sw - GLYPH_H * TXT2 >> 1), name, DIM, TXT2);
    ramp.forEach((c, k) => g?.fill(x + nameW + k * (sw + 2), yy, sw, sw, c));
    w = Math.max(w, nameW + ramp.length * (sw + 2));
  });
  return { w, h: rows.length * (sw + 2) };
}
function tiled(tile, n) {
  const g = new Grid(tile.w * n, tile.h * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.over(tile, i * tile.w, j * tile.h);
  return g;
}
function tileField(tile, n) {
  if (tile.h * 2 !== tile.w) return tiled(tile, n);
  const W3 = tile.w * n, H = tile.h * (n + 1) / 1, g = new Grid(W3, H);
  for (let j = -1; j <= n * 2; j++) for (let i = -1; i <= n; i++) g.over(tile, i * tile.w + (j % 2 ? tile.w / 2 : 0), j * tile.h / 2);
  return g;
}
function styleTile(title, columns, { scale: scale2 = 4, maxEdge = 1568 } = {}) {
  const layout2 = (sc2) => {
    const cols = columns.map((c) => {
      const p = c.probes, sw = Math.max(6, sc2 * 3);
      const pal = swatches(null, 0, 0, c.dir, sw, false);
      const field = tileField(p.tile, 3);
      const fx = p.effect.reduce((n, f) => n + f.w * sc2 + 4, 0);
      const w = Math.max(
        textWidth(c.label, TXT2),
        ...c.notes.map((n) => textWidth(n, TXT2)),
        pal.w,
        p.character.w + 6 + p.character.w * sc2,
        p.prop.w + 6 + p.prop.w * sc2,
        field.w * sc2,
        fx
      );
      const h = LINE + c.notes.length * LINE + 6 + pal.h + 8 + LINE + Math.max(p.character.h * sc2, p.character.h) + 8 + LINE + p.prop.h * sc2 + 8 + LINE + field.h * sc2 + 8 + LINE + Math.max(0, ...p.effect.map((f) => f.h * sc2)) + 8;
      return { c, w, h, sw, field };
    });
    const W3 = PAD2 + cols.reduce((n, c) => n + c.w + PAD2 * 2, 0), H = PAD2 + LINE + PAD2 + Math.max(...cols.map((c) => c.h)) + PAD2;
    return { cols, W: Math.max(W3, PAD2 * 2 + textWidth(title, TXT2)), H };
  };
  let sc = scale2, L = layout2(sc);
  while (Math.max(L.W, L.H) > maxEdge && sc > 1) {
    sc--;
    L = layout2(sc);
  }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG2);
  drawText(g, PAD2, PAD2, title, TITLE2, TXT2);
  let x = PAD2;
  for (const { c, w, sw, field } of L.cols) {
    const bg = c.background ?? c.dir.background ?? "#202028", p = c.probes;
    let y = PAD2 + LINE + PAD2;
    drawText(g, x, y, c.label, TITLE2, TXT2);
    y += LINE;
    for (const n of c.notes) {
      drawText(g, x, y, n, DIM, TXT2);
      y += LINE;
    }
    y += 6;
    y += swatches(g, x, y, c.dir, sw, false).h + 8;
    const gate = (k) => c.gates?.[k] === void 0 ? "" : c.gates[k] ? "  gate ok" : "  gate FAIL";
    const sprite = (k, s2) => {
      drawText(g, x, y, k + gate(k), FG2, TXT2);
      y += LINE;
      g.fill(x, y, s2.w, s2.h, bg);
      g.over(s2, x, y);
      const bx = x + s2.w + 6, big = s2.scale(sc);
      g.fill(bx, y, big.w, big.h, bg);
      g.over(big, bx, y);
      y += Math.max(big.h, s2.h) + 8;
    };
    sprite("character", p.character);
    sprite("prop", p.prop);
    drawText(g, x, y, `tile 3x3${gate("tile")}`, FG2, TXT2);
    y += LINE;
    const fb = field.scale(sc);
    g.fill(x, y, fb.w, fb.h, bg);
    g.over(fb, x, y);
    y += fb.h + 8;
    drawText(g, x, y, `effect ${p.effect.length} frames${gate("effect")}`, FG2, TXT2);
    y += LINE;
    let fxX = x;
    for (const f of p.effect) {
      const b = f.scale(sc);
      g.fill(fxX, y, b.w, b.h, bg);
      g.over(b, fxX, y);
      fxX += b.w + 4;
    }
    x += w + PAD2 * 2;
    if (x - PAD2 < g.w) g.fill(x - PAD2 - 1, PAD2 + LINE, 1, g.h - PAD2 * 2 - LINE, "#2c2c36");
  }
  return g;
}
var PAD2, TXT2, LINE, BG2, FG2, DIM, TITLE2, paletteLuma;
var init_sheets = __esm({
  "../artgen-core/src/w1/sheets.ts"() {
    "use strict";
    init_direction();
    init_color();
    init_font();
    init_grid();
    init_sheet();
    PAD2 = 12;
    TXT2 = 2;
    LINE = GLYPH_H * TXT2 + 6;
    BG2 = "#16161c";
    FG2 = "#dddddd";
    DIM = "#8a8a96";
    TITLE2 = "#ffffff";
    paletteLuma = (d) => {
      const l = Object.values(d.palette.ramps).flat().map(lumaOf);
      return l.reduce((a, b) => a + b, 0) / (l.length || 1);
    };
  }
});

// ../../node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "../../node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq2;
  }
});

// ../../node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "../../node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key2, node, visitor, path) {
      const ctrl = callVisitor(key2, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key2, path, ctrl);
        return visit_(key2, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key2, node, visitor, path) {
      const ctrl = await callVisitor(key2, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key2, path, ctrl);
        return visitAsync_(key2, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key2, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key2, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key2, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key2, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key2, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key2, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key2, node, path);
      return void 0;
    }
    function replaceNode(key2, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key2] = node;
      } else if (identity.isPair(parent)) {
        if (key2 === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// ../../node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "../../node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle2, prefix] = parts;
            this.tags[handle2] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle2, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle2];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle2 === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle2, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle2 + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc2) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc2 && tagEntries.length > 0 && identity.isNode(doc2.contents)) {
          const tags = {};
          visit.visit(doc2.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle2, prefix] of tagEntries) {
          if (handle2 === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc2 || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle2} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// ../../node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "../../node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc2, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc2));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// ../../node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "../../node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj2, key2, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj2, key2, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// ../../node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "../../node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// ../../node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "../../node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc2, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc2))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: doc2,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// ../../node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "../../node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc2, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc2, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc3, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc3, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc2, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc2);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc2, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc2, node.key, anchors2);
        const vc = getAliasCount(doc2, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// ../../node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "../../node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// ../../node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "../../node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// ../../node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "../../node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key2, ...rest] = path;
          const node = this.get(key2, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key2, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key2, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key2);
        const node = this.get(key2, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key2, ...rest] = path;
        const node = this.get(key2, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key2, ...rest] = path;
        if (rest.length === 0)
          return this.has(key2);
        const node = this.get(key2, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key2, ...rest] = path;
        if (rest.length === 0) {
          this.set(key2, value);
        } else {
          const node = this.get(key2, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key2, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key2}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str2) => str2.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str2, indent, comment) => str2.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str2.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// ../../node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "../../node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text2;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text2.length <= endStep)
        return text2;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text2, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text2[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text2[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text2, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text2[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text2[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text2;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text2;
      if (onFold)
        onFold();
      let res = text2.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text2.length;
        if (fold === 0)
          res = `
${indent}${text2.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text2[fold]}\\`;
          res += `
${indent}${text2.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text2, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text2[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text2[++i];
        } else {
          do {
            ch = text2[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text2[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str2) => /^(%|---|\.\.\.)/m.test(str2);
    function lineLengthOverLimit(str2, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str2.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str2[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str2 = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str2 += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str2 += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str2 += "\\0";
                    break;
                  case "0007":
                    str2 += "\\a";
                    break;
                  case "000b":
                    str2 += "\\v";
                    break;
                  case "001b":
                    str2 += "\\e";
                    break;
                  case "0085":
                    str2 += "\\N";
                    break;
                  case "00a0":
                    str2 += "\\_";
                    break;
                  case "2028":
                    str2 += "\\L";
                    break;
                  case "2029":
                    str2 += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str2 += "\\x" + code.substr(2);
                    else
                      str2 += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str2 += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str2 += "\n";
                  i += 2;
                }
                str2 += indent;
                if (json[i + 2] === " ")
                  str2 += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str2 = start ? str2 + json.slice(start) : json;
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str2 = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str2);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str2 : foldFlowLines.foldFlowLines(str2, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// ../../node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc2, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc2.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc: doc2,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj2;
      if (identity.isScalar(item)) {
        obj2 = item.value;
        let match = tags.filter((t) => t.identify?.(obj2));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj2 = item;
        tagObj = tags.find((t) => t.nodeClass && obj2 instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj2?.constructor?.name ?? (obj2 === null ? "null" : typeof obj2);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc: doc2 }) {
      if (!doc2.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc2.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str2 = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str2;
      return identity.isScalar(node) || str2[0] === "{" || str2[0] === "[" ? `${props} ${str2}` : `${props}
${ctx.indent}${str2}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify2;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key: key2, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc: doc2, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key2) && key2.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key2) || !identity.isNode(key2) && typeof key2 === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key2 || keyComment && value == null && !ctx.inFlow || identity.isCollection(key2) || (identity.isScalar(key2) ? key2.type === Scalar.Scalar.BLOCK_FOLDED || key2.type === Scalar.Scalar.BLOCK_LITERAL : typeof key2 === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str2 = stringify2.stringify(key2, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str2.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str2 === "" ? "?" : explicitKey ? `? ${str2}` : str2;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str2 = `? ${str2}`;
        if (keyComment && !keyCommentDone) {
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str2;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
        str2 = `? ${str2}
${indent}:`;
      } else {
        str2 = `${str2}:`;
        if (keyComment)
          str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc2.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str2.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str2 += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str2 += stringifyComment.lineComment(str2, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str2;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// ../../node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "../../node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge2 = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key2) => (merge2.identify(key2) || identity.isScalar(key2) && (!key2.type || key2.type === Scalar.Scalar.PLAIN) && merge2.identify(key2.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge2.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key2, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key2))
            map.set(key2, value2);
        } else if (map instanceof Set) {
          map.add(key2);
        } else if (!Object.prototype.hasOwnProperty.call(map, key2)) {
          Object.defineProperty(map, key2, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge2;
  }
});

// ../../node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "../../node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge2 = require_merge();
    var stringify2 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key: key2, value }) {
      if (identity.isNode(key2) && key2.addToJSMap)
        key2.addToJSMap(ctx, map, value);
      else if (merge2.isMergeKey(ctx, key2))
        merge2.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key2, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key2, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key2, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key2) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key2.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// ../../node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "../../node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key2, value, ctx) {
      const k = createNode.createNode(key2, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key2, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key2;
        this.value = value;
      }
      clone(schema) {
        let { key: key2, value } = this;
        if (identity.isNode(key2))
          key2 = key2.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key2, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str3 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str3 += stringifyComment.lineComment(str3, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str3);
      }
      let str2;
      if (lines.length === 0) {
        str2 = flowChars.start + flowChars.end;
      } else {
        str2 = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str2 += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str2 += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str2;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str2 = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str2.includes("\n"));
        if (i < items.length - 1) {
          str2 += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum2, line) => sum2 + line.length + 2, 2) + (str2.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str2 += ",";
          }
        }
        if (comment)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment));
        lines.push(str2);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum2, line) => sum2 + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str2 = start;
          for (const line of lines)
            str2 += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str2}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// ../../node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "../../node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key2) {
      const k = identity.isScalar(key2) ? key2.value : key2;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key2 || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj2, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add2 = (key2, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj2, key2, value);
          else if (Array.isArray(replacer) && !replacer.includes(key2))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key2, value, ctx));
        };
        if (obj2 instanceof Map) {
          for (const [key2, value] of obj2)
            add2(key2, value);
        } else if (obj2 && typeof obj2 === "object") {
          for (const key2 of Object.keys(obj2))
            add2(key2, obj2[key2]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key2) {
        const it = findPair(this.items, key2);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key2, keepScalar) {
        const it = findPair(this.items, key2);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key2) {
        return !!findPair(this.items, key2);
      }
      set(key2, value) {
        this.add(new Pair.Pair(key2, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// ../../node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "../../node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj2, ctx) => YAMLMap.YAMLMap.from(schema, obj2, ctx)
    };
    exports.map = map;
  }
});

// ../../node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "../../node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq2 = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key2) {
        const idx = asItemIndex(key2);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key2, keepScalar) {
        const idx = asItemIndex(key2);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key2) {
        const idx = asItemIndex(key2);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key2, value) {
        const idx = asItemIndex(key2);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key2}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj2, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj2 && Symbol.iterator in Object(obj2)) {
          let i = 0;
          for (let it of obj2) {
            if (typeof replacer === "function") {
              const key2 = obj2 instanceof Set ? it : String(i++);
              it = replacer.call(obj2, key2, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key2) {
      let idx = identity.isScalar(key2) ? key2.value : key2;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq2;
  }
});

// ../../node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "../../node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq2 = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq2.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj2, ctx) => YAMLSeq2.YAMLSeq.from(schema, obj2, ctx)
    };
    exports.seq = seq;
  }
});

// ../../node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "../../node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str2) => str2,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// ../../node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "../../node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// ../../node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "../../node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str2) => new Scalar.Scalar(str2[0] === "t" || str2[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num2 = typeof value === "number" ? value : Number(value);
      if (!isFinite(num2))
        return isNaN(num2) ? ".nan" : num2 < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// ../../node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "../../node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2),
      stringify(node) {
        const num2 = Number(node.value);
        return isFinite(num2) ? num2.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2));
        const dot = str2.indexOf(".");
        if (dot !== -1 && str2[str2.length - 1] === "0")
          node.minFractionDigits = str2.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "../../node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str2, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "../../node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool2 = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool2.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "../../node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str2) => str2,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str2) => str2 === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str2, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str2) : parseInt(str2, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str2) => parseFloat(str2),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str2, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str2)}`);
        return str2;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str2 = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str2.length);
          for (let i = 0; i < str2.length; ++i)
            buffer[i] = str2.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str2;
        if (typeof node_buffer.Buffer === "function") {
          str2 = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s2 = "";
          for (let i = 0; i < buf.length; ++i)
            s2 += String.fromCharCode(buf[i]);
          str2 = btoa(s2);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str2.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str2.substr(o, lineWidth);
          }
          str2 = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str2 }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq2 = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq2.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key2, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key2 = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key2 = keys[0];
              value = it[key2];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key2 = it;
          }
          pairs2.items.push(Pair.createPair(key2, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq2.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key2, value;
          if (identity.isPair(pair)) {
            key2 = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key2, ctx);
          } else {
            key2 = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key2))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key2, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key: key2 } of pairs$1.items) {
          if (identity.isScalar(key2)) {
            if (seenKeys.includes(key2.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key2.value}`);
            } else {
              seenKeys.push(key2.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str2) => str2.slice(-3).toLowerCase() === "nan" ? NaN : str2[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str2) => parseFloat(str2.replace(/_/g, "")),
      stringify(node) {
        const num2 = Number(node.value);
        return isFinite(num2) ? num2.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str2) {
        const node = new Scalar.Scalar(parseFloat(str2.replace(/_/g, "")));
        const dot = str2.indexOf(".");
        if (dot !== -1) {
          const f = str2.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str2, offset, radix, { intAsBigInt }) {
      const sign = str2[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str2 = str2.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str2 = `0b${str2}`;
            break;
          case 8:
            str2 = `0o${str2}`;
            break;
          case 16:
            str2 = `0x${str2}`;
            break;
        }
        const n2 = BigInt(str2);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str2, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str2 = value.toString(radix);
        return value < 0 ? "-" + prefix + str2.substr(1) : prefix + str2;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str2, _onError, opt) => intResolve(str2, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key2) {
        let pair;
        if (identity.isPair(key2))
          pair = key2;
        else if (key2 && typeof key2 === "object" && "key" in key2 && "value" in key2 && key2.value === null)
          pair = new Pair.Pair(key2.key, null);
        else
          pair = new Pair.Pair(key2, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key2, keepPair) {
        const pair = YAMLMap.findPair(this.items, key2);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key2, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key2);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key2));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str2, asBigInt) {
      const sign = str2[0];
      const parts = sign === "-" || sign === "+" ? str2.substring(1) : str2;
      const num2 = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num2(60) + num2(p), num2(0));
      return sign === "-" ? num2(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num2 = (n) => n;
      if (typeof value === "bigint")
        num2 = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num2(-1);
      }
      const _60 = num2(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str2, _onError, { intAsBigInt }) => parseSexagesimal(str2, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str2) => parseSexagesimal(str2, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str2) {
        const match = str2.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// ../../node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "../../node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool2 = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool2.trueTag,
      bool2.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge2.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// ../../node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "../../node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool2 = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool2.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge2.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge2.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge2.merge) ? schemaTags.concat(merge2.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key2) => key2 !== "yaml11").map((key2) => JSON.stringify(key2)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge2.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key2) => JSON.stringify(key2)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// ../../node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "../../node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge2);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// ../../node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "../../node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc2, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc2.directives) {
        const dir = doc2.directives.toString(doc2);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc2.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc2, options);
      const { commentString } = ctx.options;
      if (doc2.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc2.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc2.contents) {
        if (identity.isNode(doc2.contents)) {
          if (doc2.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc2.contents.commentBefore) {
            const cs = commentString(doc2.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc2.comment;
          contentComment = doc2.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc2.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc2.contents, ctx));
      }
      if (doc2.directives?.docEnd) {
        if (doc2.comment) {
          const cs = commentString(doc2.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc2.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// ../../node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "../../node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key2, value, options = {}) {
        const k = this.createNode(key2, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key2) {
        return assertCollection(this.contents) ? this.contents.delete(key2) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key2, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key2, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key2) {
        return identity.isCollection(this.contents) ? this.contents.has(key2) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key2, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key2], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key2, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s2 = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s2}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// ../../node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "../../node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc2) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc2.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc2.lineStarts[line - 1], lc2.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc2.lineStarts[line - 2], lc2.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// ../../node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "../../node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key2) {
      if (!key2)
        return null;
      switch (key2.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key2.source.includes("\n"))
            return true;
          if (key2.end) {
            for (const st of key2.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key2.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// ../../node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "../../node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// ../../node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "../../node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key: key2, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key2 ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key2) {
            if (key2.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key2 && key2.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key2)) {
            onError(key2 ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key2 ? composeNode(ctx, key2, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key2, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key2 || key2.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq2 = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq2.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === "{";
      const fcName = isMap2 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq2.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key: key2, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key2 ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key2))
            onError(
              key2,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key2 ? composeNode(ctx, key2, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key2))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// ../../node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq2.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// ../../node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel3, code, msg) => onError(offset + rel3, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// ../../node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// ../../node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "../../node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// ../../node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// ../../node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "../../node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc2 = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc2.directives,
        options: doc2.options,
        schema: doc2.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc2.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc2.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc2.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc2.comment = re.comment;
      doc2.range = [offset, contentEnd, re.offset];
      return doc2;
    }
    exports.composeDoc = composeDoc;
  }
});

// ../../node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "../../node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc2, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc2.contents;
          if (afterDoc) {
            doc2.comment = doc2.comment ? `${doc2.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc2.directives.docStart || !dc) {
            doc2.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc2.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc2.warnings.push(this.warnings[i]);
        } else {
          doc2.errors = this.errors;
          doc2.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc2 = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc2.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc2, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc2;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc2 = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc2.range = [0, endOffset, endOffset];
          this.decorate(doc2, false);
          yield doc2;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// ../../node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key2 of Object.keys(token))
          if (key2 !== "type" && key2 !== "offset")
            delete token[key2];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key2 of Object.keys(token))
            if (key2 !== "type" && key2 !== "offset")
              delete token[key2];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// ../../node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key: key2, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key2)
        res += stringifyToken(key2);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify2;
  }
});

// ../../node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "../../node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// ../../node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "../../node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// ../../node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "../../node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s2 = this.peek(3);
          if ((s2 === "---" || s2 === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s2 === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s2 = this.buffer.slice(this.pos, i);
        if (s2) {
          yield s2;
          this.pos += s2.length;
          return s2.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// ../../node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "../../node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// ../../node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "../../node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc2 = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc2.start.push(this.sourceToken);
            this.stack.push(doc2);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc2) {
        if (doc2.value)
          return yield* this.lineEnd(doc2);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc2.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc2.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc2.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc2);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key2 = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: key2, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// ../../node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "../../node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc2 of docs) {
          doc2.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc2.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument2(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc2 = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc2)
          doc2 = _doc;
        else if (doc2.options.logLevel !== "silent") {
          doc2.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc2.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc2.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc2;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc2 = parseDocument2(src, options);
      if (!doc2)
        return null;
      doc2.warnings.forEach((warning) => log.warn(doc2.options.logLevel, warning));
      if (doc2.errors.length > 0) {
        if (doc2.options.logLevel !== "silent")
          throw doc2.errors[0];
        else
          doc2.errors = [];
      }
      return doc2.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument2;
    exports.stringify = stringify2;
  }
});

// ../../node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "../../node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq2 = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq2.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// ../artgen-core/src/w2/briefs.ts
function effectObjectIssues(b) {
  if (b.kind !== "effect") return [];
  if (b.object === void 0) return ['effect brief has no object: name the drawable thing it is (brief add --object "ice lance")'];
  const words = String(b.object).toLowerCase().match(/[a-z]+/g) ?? [], out = [];
  if (!words.some((w) => w.length >= 3)) out.push("object must name a thing (a noun a draftsman could draw)");
  if (words.some((w) => w === "effect" || w === "effects" || w === "fx" || w === "vfx")) out.push('object must not say "effect": name the thing itself');
  const colours = words.filter((w) => COLOUR_WORDS.has(w));
  if (colours.length) out.push(`object must not lean on colour words (${[...new Set(colours)].join(", ")}): colour comes from the direction`);
  return out;
}
function validateBrief(b, where = "brief") {
  const e = [];
  if (!isObj2(b)) return [`${where}: must be a mapping`];
  const at = `${where} ${typeof b.id === "string" ? b.id : "?"}`;
  if (typeof b.id !== "string" || !ID.test(b.id)) e.push(`${at}: id must be lowercase letters, digits, - or _ (starting with a letter)`);
  if (typeof b.kind !== "string" || !BRIEF_KINDS.includes(b.kind)) e.push(`${at}: kind must be one of ${BRIEF_KINDS.join(", ")}`);
  if (b.view !== void 0 && !VIEWS.includes(b.view)) e.push(`${at}: view must be one of ${VIEWS.join(", ")}`);
  if (b.size !== void 0 && typeof b.size !== "string" && !(Array.isArray(b.size) && b.size.length === 2 && b.size.every((n) => Number.isInteger(n) && n > 0))) e.push(`${at}: size must be a direction scale key or [w, h]`);
  if (b.states !== void 0 && !(Array.isArray(b.states) && b.states.length && b.states.every((s2) => typeof s2 === "string" && ID.test(s2)))) e.push(`${at}: states must be a non-empty list of names`);
  if (b.directions !== void 0 && ![1, 4, 8, 16].includes(b.directions)) e.push(`${at}: directions must be 1, 4, 8 or 16`);
  if (b.anims !== void 0) {
    if (!isObj2(b.anims)) e.push(`${at}: anims must map state \u2192 { frames, fps, loop, durations }`);
    else for (const [s2, a] of Object.entries(b.anims)) {
      if (!isObj2(a) || !Number.isInteger(a.frames) || a.frames < 1) e.push(`${at}: anims.${s2}.frames must be a positive integer`);
      else if (Array.isArray(b.states) && !b.states.includes(s2)) e.push(`${at}: anims.${s2} is not in states`);
      else if (a.durations !== void 0 && !(Array.isArray(a.durations) && a.durations.length === a.frames && a.durations.every((d) => Number.isInteger(d) && d > 0)))
        e.push(`${at}: anims.${s2}.durations must list one positive whole number of ms per frame (${a.frames})`);
      else if (a.sub !== void 0 && !(Number.isInteger(a.sub) && a.sub >= 1 && a.sub <= 8)) e.push(`${at}: anims.${s2}.sub must be a whole number of sub-frames per logical frame (1\u20138)`);
    }
  }
  if (b.variants !== void 0 && !(Number.isInteger(b.variants) && b.variants >= 1)) e.push(`${at}: variants must be a positive integer`);
  if (b.importance !== void 0 && !IMPORTANCE.includes(b.importance)) e.push(`${at}: importance must be one of ${IMPORTANCE.join(", ")}`);
  if (b.priority !== void 0 && typeof b.priority !== "number") e.push(`${at}: priority must be a number`);
  if (b.height !== void 0 && !(typeof b.height === "number" && b.height > 0 && b.height <= 1e3)) e.push(`${at}: height must be the real-world height in metres (> 0)`);
  if (b.object !== void 0) {
    if (typeof b.object !== "string" || !b.object.trim()) e.push(`${at}: object must be text`);
    else for (const m of effectObjectIssues({ kind: String(b.kind), object: b.object })) e.push(`${at}: ${m}`);
  }
  if (b.autotile !== void 0 && !["wang16", "blob47"].includes(b.autotile)) e.push(`${at}: autotile must be wang16 or blob47`);
  if (b.surface !== void 0 && !["wall", "floor", "ceiling", "sky"].includes(b.surface)) e.push(`${at}: surface must be wall, floor, ceiling or sky`);
  if (b.blend !== void 0 && !["normal", "add"].includes(b.blend)) e.push(`${at}: blend must be normal or add`);
  if (b.anchor !== void 0 && !(Array.isArray(b.anchor) && b.anchor.length === 2 && b.anchor.every((n) => typeof n === "number"))) e.push(`${at}: anchor must be [x, y]`);
  if (b.swaps !== void 0) {
    if (!isObj2(b.swaps)) e.push(`${at}: swaps must map variant name \u2192 { ramp: ramp }`);
    else for (const [n, m] of Object.entries(b.swaps)) if (!isObj2(m) || !Object.values(m).every((v) => typeof v === "string" && !v.startsWith("#"))) e.push(`${at}: swaps.${n} must map ramp names to ramp names (no hex, R11)`);
  }
  return e;
}
function parseBriefs(text2) {
  const doc2 = (0, import_yaml.parseDocument)(text2);
  if (doc2.errors.length) return { ok: false, errors: doc2.errors.map((e) => `briefs.yaml: ${e.message}`), briefs: [] };
  const data = doc2.toJS() ?? [];
  if (!Array.isArray(data)) return { ok: false, errors: ["briefs.yaml: must be a list of briefs"], briefs: [] };
  const errors = [], seen = /* @__PURE__ */ new Set();
  data.forEach((b, i) => {
    errors.push(...validateBrief(b, `brief #${i + 1}`));
    if (isObj2(b) && typeof b.id === "string") {
      if (seen.has(b.id)) errors.push(`brief ${b.id}: duplicate id`);
      seen.add(b.id);
    }
  });
  return { ok: !errors.length, errors, briefs: data };
}
function briefOrder(briefs) {
  return briefs.map((b, i) => ({ b, i })).sort((x, y) => (x.b.priority ?? Infinity) - (y.b.priority ?? Infinity) || x.i - y.i).map((x) => x.b);
}
var import_yaml, BRIEF_KINDS, IMPORTANCE, ID, COLOUR_WORDS, isObj2, briefDir;
var init_briefs = __esm({
  "../artgen-core/src/w2/briefs.ts"() {
    "use strict";
    import_yaml = __toESM(require_dist(), 1);
    init_direction();
    BRIEF_KINDS = ["character", "creature", "prop", "tile", "tileset", "texture", "effect", "viewmodel", "ui-icon", "layer"];
    IMPORTANCE = ["hero", "standard", "filler"];
    ID = /^[a-z][a-z0-9_-]*$/;
    COLOUR_WORDS = new Set("red orange yellow green blue purple violet pink white black grey gray brown gold golden silver amber crimson scarlet cyan teal magenta azure emerald jade turquoise indigo lilac lavender maroon ochre rust copper bronze ivory pale dark bright glowing glowy colorful colourful rainbow neon".split(" "));
    isObj2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    briefDir = (b) => `assets/${b.kind}/${b.id}`;
  }
});

// ../artgen-core/src/w2/status.ts
function assetStatus({ ledger, next, direction, finalHash: finalHash2 }) {
  if (!next) return { status: "brief", issues: [], why: "no versions yet" };
  const iFeedback = lastIndex(ledger, (e) => e.type === "feedback" && e.by === "user");
  const iApprove = lastIndex(ledger, (e) => e.type === "approve" && e.by === "user");
  if (next.action !== "ready") {
    const revising = iFeedback >= 0 && iFeedback > iApprove;
    return { status: revising ? "revision" : "in-pipeline", issues: [], why: `${next.action} ${"version" in next ? next.version : ""}`.trim() };
  }
  const final = next.final, issues = next.issues;
  const approval = iApprove >= 0 ? ledger[iApprove] : void 0;
  if (!approval || iFeedback > iApprove || approval.version !== final || finalHash2 && approval.sourceHash !== finalHash2) {
    return { status: "final", final, issues, why: approval && iFeedback < iApprove ? `approved ${approval.version} changed since (re-review)` : "finished; waiting for the user to approve or give feedback" };
  }
  const iExport = lastIndex(ledger, (e) => e.type === "export" && e.version === final);
  const exp = iExport > iApprove ? ledger[iExport] : void 0;
  if (approval.direction?.version !== direction.version || approval.direction?.id !== direction.id) {
    const iRestyle = lastIndex(ledger, (e) => e.type === "restyle" && e.direction?.version === direction.version);
    const restyled = iRestyle > iApprove;
    if (restyled && ledger[iRestyle].changedPct === 0) {
      const iExp2 = lastIndex(ledger, (e) => e.type === "export" && e.version === final && e.direction?.version === direction.version);
      if (iExp2 > iRestyle) return { status: "exported", final, issues, approval, export: ledger[iExp2], why: `in pack ${String(ledger[iExp2].pack ?? "")} (approval carried over a no-change restyle)` };
      return { status: "approved", final, issues, approval, why: `restyled to direction v${direction.version} with no pixel change; approval carried over` };
    }
    return restyled ? { status: "final", final, issues, approval, why: `restyled to direction v${direction.version}; re-approve` } : { status: "stale", final, issues, approval, export: exp, why: `approved under direction v${approval.direction?.version}, now v${direction.version}: run restyle` };
  }
  if (exp) {
    if (exp.sourceHash && finalHash2 && exp.sourceHash !== finalHash2) return { status: "stale", final, issues, approval, export: exp, why: "sources changed since export" };
    return { status: "exported", final, issues, approval, export: exp, why: `in pack ${String(exp.pack ?? "")}`.trim() };
  }
  return { status: "approved", final, issues, approval, why: "approved; ready to export" };
}
var lastIndex;
var init_status = __esm({
  "../artgen-core/src/w2/status.ts"() {
    "use strict";
    lastIndex = (xs, f) => {
      for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i;
      return -1;
    };
  }
});

// ../artgen-core/src/w2/pack.ts
function packRects(sizes, opts = {}) {
  const max2 = opts.maxSize ?? 2048, pad = opts.padding ?? 1;
  const order = sizes.map((s2, id) => ({ ...s2, id })).sort((a, b) => b.h - a.h || b.w - a.w || a.id - b.id);
  for (const s2 of order) if (s2.w > max2 || s2.h > max2) throw new Error(`frame ${s2.w}x${s2.h} is larger than the max atlas size ${max2}`);
  const tryPack = (items, W3, H) => {
    let free = [{ x: 0, y: 0, w: W3 + pad, h: H + pad }];
    const out = [], rest = [];
    for (const it of items) {
      const w = it.w + pad, h = it.h + pad;
      let best = null, bs = Infinity, bl = Infinity;
      for (const f of free) if (f.w >= w && f.h >= h) {
        const s2 = Math.min(f.w - w, f.h - h), l = Math.max(f.w - w, f.h - h);
        if (s2 < bs || s2 === bs && l < bl) {
          best = f;
          bs = s2;
          bl = l;
        }
      }
      if (!best) {
        rest.push(it);
        continue;
      }
      const r = { x: best.x, y: best.y, w, h };
      out.push({ id: it.id, bin: 0, x: r.x, y: r.y, w: it.w, h: it.h });
      const next = [];
      for (const f of free) {
        if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) {
          next.push(f);
          continue;
        }
        if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
        if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
        if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
        if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
      }
      free = next.filter((a, i) => !next.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
    }
    return { out, rest };
  };
  const placed = [], bins = [];
  let todo = order;
  while (todo.length) {
    const area = todo.reduce((n, s2) => n + (s2.w + pad) * (s2.h + pad), 0);
    let done = false;
    for (let side = 16; side <= max2 && !done; side *= 2) for (const [W3, H] of [[side, side / 2], [side, side]]) {
      if (W3 * H < area || H < 1) continue;
      const r2 = tryPack(todo, W3, H);
      if (!r2.rest.length) {
        const b2 = bins.length;
        placed.push(...r2.out.map((p) => ({ ...p, bin: b2 })));
        bins.push(fitBin(r2.out, W3, H));
        todo = [];
        done = true;
        break;
      }
    }
    if (done) break;
    const r = tryPack(todo, max2, max2), b = bins.length;
    if (!r.out.length) throw new Error("packRects: nothing fits");
    placed.push(...r.out.map((p) => ({ ...p, bin: b })));
    bins.push([max2, max2]);
    todo = r.rest;
  }
  return { placed: placed.sort((a, b) => a.id - b.id), bins };
}
function fitBin(out, W3, H) {
  const uw = Math.max(1, ...out.map((p) => p.x + p.w)), uh = Math.max(1, ...out.map((p) => p.y + p.h));
  let w = W3, h = H;
  while (w / 2 >= uw && w > 16) w /= 2;
  while (h / 2 >= uh && h > 16) h /= 2;
  return [w, h];
}
function defaultAnchor(b, view, size) {
  if (b.anchor) return b.anchor;
  return view === "topdown" || TILE_KINDS2.has(b.kind) || b.kind === "effect" ? [size[0] >> 1, size[1] >> 1] : [size[0] >> 1, size[1] - 1];
}
function stateDefs(b, dir, frames) {
  const out = {};
  for (const [s2, n] of Object.entries(frames)) {
    const a = b.anims?.[s2], sub2 = Math.max(1, Math.floor(a?.sub ?? 1));
    out[s2] = {
      frames: n,
      fps: a?.fps ?? (b.kind === "effect" ? dir.effects.fps : 8),
      loop: a?.loop ?? (b.kind !== "effect" && (n === 1 || LOOPING2.test(s2))),
      ...a?.durations?.length === n && { durations: [...a.durations] },
      ...sub2 > 1 && { sub: sub2 }
    };
  }
  return out;
}
function displayDurations(st) {
  const k = st.sub ?? 1;
  return frameDurations(st).flatMap((d) => Array.from({ length: k }, (_, i) => Math.round((i + 1) * d / k) - Math.round(i * d / k)));
}
function swapMaps(dir, swaps = {}) {
  const R2 = dir.palette.ramps, M = dir.palette.materials, ramp = (n) => R2[n] ?? R2[M[n]];
  const out = {};
  for (const [name, m] of Object.entries(swaps)) {
    const map = {};
    for (const [from, to] of Object.entries(m)) {
      const a = ramp(from), b = ramp(to);
      if (!a || !b) throw new Error(`swap ${name}: unknown ramp ${!a ? from : to}`);
      a.forEach((c, i) => {
        map[c] = b[Math.min(i, b.length - 1)];
      });
    }
    out[name] = map;
  }
  return out;
}
function buildPack(pack, dir, inputs, opts = {}) {
  const uniq = [], uniqN = [], byHash = /* @__PURE__ */ new Map();
  const refs = [];
  const withNormals = inputs.some((i) => i.renders.some((r) => r.cells.some((c) => c.normal)));
  for (const inp of inputs) inp.renders.forEach((r, variant) => {
    for (const cell of r.cells) {
      const h = cell.grid.hash() + (withNormals && cell.normal ? cell.normal.hash() : "");
      let img = byHash.get(h);
      if (img === void 0) {
        img = uniq.length;
        uniq.push(cell.grid);
        uniqN.push(cell.normal);
        byHash.set(h, img);
      }
      refs.push({ asset: inp.brief.id, cell, variant, img, fi: r.facings.indexOf(cell.facing), si: cell.state });
    }
  });
  const { placed, bins } = packRects(uniq.map((g) => ({ w: g.w, h: g.h })), opts);
  const atlases = bins.map(([w, h]) => new Grid(w, h));
  placed.forEach((p) => atlases[p.bin].blit(uniq[p.id], p.x, p.y));
  const names = atlases.map((_, i) => `${pack}-${i}.png`);
  let normals;
  if (withNormals) {
    normals = bins.map(([w, h]) => new Grid(w, h));
    placed.forEach((p) => normals[p.bin].blit(fitNormalMap(uniq[p.id], uniqN[p.id]), p.x, p.y));
  }
  const assets = {};
  for (const inp of inputs) {
    const b = inp.brief, r = inp.renders[0], mine = refs.filter((x) => x.asset === b.id);
    const states2 = stateDefs(b, dir, Object.fromEntries(r.states.map((s2) => [s2, r.frames[s2] / Math.max(1, Math.floor(b.anims?.[s2]?.sub ?? 1))])));
    const names2 = [...new Set(mine.flatMap((x) => Object.keys(x.cell.anchors ?? {})))].sort();
    const anchors = names2.length ? Object.fromEntries(names2.map((n) => [n, mine.map((x) => {
      const a = x.cell.anchors?.[n];
      return a ? [Math.round(a[0]), Math.round(a[1])] : null;
    })])) : void 0;
    const swaps = b.swaps && Object.keys(b.swaps).length ? swapMaps(dir, b.swaps) : void 0;
    assets[b.id] = {
      kind: b.kind,
      view: inp.view,
      size: r.size,
      anchor: defaultAnchor(b, inp.view, r.size),
      directions: r.facings.length,
      facings: r.facings,
      states: states2,
      frames: mine.map((x) => {
        const p = placed[x.img];
        return [p.bin, p.x, p.y, p.w, p.h, x.fi, x.si, x.cell.frame, x.variant];
      }),
      ...anchors && { anchors },
      variants: ["base", ...inp.renders.slice(1).map((_, i) => `v${i + 1}`), ...Object.keys(swaps ?? {})],
      ...swaps && { swaps },
      version: inp.version,
      sourceHash: inp.sourceHash,
      ...(TILE_KINDS2.has(b.kind) || LAYER_KINDS2.has(b.kind)) && { tile: r.size[0] },
      ...b.autotile && { autotile: b.autotile },
      ...inp.renders.some((x) => x.cells.some((c) => c.normal)) && { normals: true },
      ...b.blend === "add" && { blend: "add" },
      ...inp.draft && { draft: true }
    };
  }
  const drafts = inputs.filter((i) => i.draft).map((i) => i.brief.id);
  const manifest = {
    format: 1,
    pack,
    generator: opts.generator ?? "artgen",
    direction: { id: dir.id, version: dir.version },
    runtime: opts.runtime ?? null,
    atlases: names,
    ...normals && { normals: names.map((n) => n.replace(/\.png$/, ".n.png")) },
    assets,
    ...drafts.length && { drafts }
  };
  const aseprite = atlases.map((g, bin) => asepriteJson(manifest, bin, g, names[bin]));
  return { manifest, atlases, aseprite, ...normals && { normals } };
}
function asepriteJson(m, bin, g, image2) {
  const frames = [], tags = [];
  for (const [id, a] of Object.entries(m.assets)) {
    let tag;
    for (const [at, x, y, w, h, fi, state, frame, variant] of a.frames) {
      if (at !== bin) continue;
      const strip2 = `${id}/${state}/${a.facings[fi]}${variant ? `#${a.variants[variant]}` : ""}`;
      if (!tag || tag.name !== strip2) {
        tag = { name: strip2, from: frames.length, to: frames.length, direction: "forward" };
        tags.push(tag);
      } else tag.to = frames.length;
      frames.push({
        filename: `${id}/${state}/${a.facings[fi]}/${frame}${variant ? `#${a.variants[variant]}` : ""}`,
        frame: { x, y, w, h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h },
        sourceSize: { w, h },
        duration: displayDurations(a.states[state])[frame] ?? Math.round(1e3 / a.states[state].fps)
      });
    }
  }
  return { frames, meta: { app: "artgen", version: m.generator, image: image2, format: "RGBA8888", size: { w: g.w, h: g.h }, scale: "1", frameTags: tags } };
}
function assetsTs(packs) {
  let out = "// Generated by `artgen export` \u2014 do not edit. Typed ids for the exported art packs.\n\n";
  const rooted = packs.some((p) => p.url.startsWith("/"));
  if (rooted) out += "// The site base: Vite's BASE_URL when the game is served from a sub-path (e.g. GitHub Pages), else '/'.\nconst base: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';\n\n";
  const url = (u) => u.startsWith("/") ? `\`\${base}${u.slice(1).replace(/[`\\$]/g, "\\$&")}\`` : JSON.stringify(u);
  out += `export const Packs = {
${packs.map((p) => `  ${ident(p.manifest.pack)}: ${url(p.url)},`).join("\n")}
} as const;

`;
  out += "export const Assets = {\n";
  for (const { manifest: m } of packs) for (const [id, a] of Object.entries(m.assets))
    out += `  ${ident(id)}: { id: ${JSON.stringify(id)}, pack: ${JSON.stringify(m.pack)}, kind: ${JSON.stringify(a.kind)}, states: ${JSON.stringify(Object.keys(a.states))}, facings: ${JSON.stringify(a.facings)}, variants: ${JSON.stringify(a.variants)}, anchors: ${JSON.stringify(Object.keys(a.anchors ?? {}))} },
`;
  out += "} as const;\n\nexport type AssetId = keyof typeof Assets;\nexport type StateOf<K extends AssetId> = (typeof Assets)[K]['states'][number];\nexport type VariantOf<K extends AssetId> = (typeof Assets)[K]['variants'][number];\nexport type AnchorOf<K extends AssetId> = (typeof Assets)[K]['anchors'][number];\n";
  return out;
}
var TILE_KINDS2, LAYER_KINDS2, LOOPING2, frameDurations, ident;
var init_pack = __esm({
  "../artgen-core/src/w2/pack.ts"() {
    "use strict";
    init_grid();
    init_normals();
    TILE_KINDS2 = /* @__PURE__ */ new Set(["tile", "tileset", "texture"]);
    LAYER_KINDS2 = /* @__PURE__ */ new Set(["layer"]);
    LOOPING2 = /^(idle|walk|run|fly|swim|loop|burn|glow|flicker)/;
    frameDurations = (st) => st.durations ?? Array.from({ length: st.frames }, () => Math.round(1e3 / st.fps));
    ident = (s2) => /^[A-Za-z_$][\w$]*$/.test(s2) ? s2 : JSON.stringify(s2);
  }
});

// ../artgen-core/src/w2/contract.ts
function contractOf(id, a) {
  return { format: 1, asset: id, facings: [...a.facings], states: states(a.states), anchors: Object.keys(a.anchors ?? {}).sort() };
}
function diffContract(old, next) {
  const breaking = [], added = [];
  for (const [s2, o] of Object.entries(old.states)) {
    const n = next.states[s2];
    if (!n) {
      breaking.push(`state "${s2}" removed`);
      continue;
    }
    if (n.frames !== o.frames) breaking.push(`state "${s2}": ${o.frames} \u2192 ${n.frames} logical frames`);
    else if (n.durations.some((d, i) => d !== o.durations[i])) breaking.push(`state "${s2}": frame durations ${o.durations.join(",")} \u2192 ${n.durations.join(",")} ms`);
    if (n.loop !== o.loop) breaking.push(`state "${s2}": loop ${o.loop} \u2192 ${n.loop}`);
  }
  for (const s2 of Object.keys(next.states)) if (!old.states[s2]) added.push(`state "${s2}"`);
  for (const f of old.facings) if (!next.facings.includes(f)) breaking.push(`facing "${f}" removed`);
  for (const f of next.facings) if (!old.facings.includes(f)) added.push(`facing "${f}"`);
  for (const a of old.anchors) if (!next.anchors.includes(a)) breaking.push(`anchor "${a}" removed`);
  for (const a of next.anchors) if (!old.anchors.includes(a)) added.push(`anchor "${a}"`);
  return { breaking, added };
}
var states;
var init_contract = __esm({
  "../artgen-core/src/w2/contract.ts"() {
    "use strict";
    init_render();
    init_pack();
    states = (defs) => Object.fromEntries(Object.entries(defs).map(([s2, d]) => [s2, { frames: d.frames, durations: frameDurations(d), loop: d.loop }]));
  }
});

// ../artgen-core/src/w2/roster.ts
var init_roster = __esm({
  "../artgen-core/src/w2/roster.ts"() {
    "use strict";
    init_font();
    init_grid();
    init_rng();
  }
});

// ../artgen-core/src/w2/analytics.ts
function passRecords(ledger) {
  const latest = /* @__PURE__ */ new Map();
  for (const e of ledger) if (e.type === "score" && !e.blind && e.version && typeof e.score === "number" && e.asset !== "direction") latest.set(`${e.asset}\0${e.version}`, e);
  const out = [], lastBase = /* @__PURE__ */ new Map(), baseScore = /* @__PURE__ */ new Map();
  for (const e of latest.values()) {
    const tk = e.tokens ?? {};
    const pass = e.pass ?? (e.version.startsWith("finish") ? "f" : "r?"), stage = stageOf(pass), key2 = (v) => `${e.asset}\0${v}`;
    let delta;
    if (e.version.startsWith("base")) {
      const prev = lastBase.get(e.asset);
      if (prev !== void 0) delta = round(e.score - prev);
      lastBase.set(e.asset, e.score);
      baseScore.set(key2(e.version), e.score);
    } else if (typeof e.base === "string" && baseScore.has(key2(e.base))) delta = round(e.score - baseScore.get(key2(e.base)));
    out.push({
      asset: e.asset,
      version: e.version,
      pass,
      stage,
      score: e.score,
      delta,
      gate: e.conformance?.pass,
      outTokens: tk.out ?? tk.edit ?? 0,
      inTokens: tk.in ?? 0,
      imageTokens: e.imageTokens ?? 0,
      wallMs: typeof e.wallMs === "number" ? e.wallMs : void 0,
      model: e.model,
      effort: e.effort
    });
  }
  return out;
}
function analytics(ledger, metas) {
  const recs = passRecords(ledger), ids2 = [...new Set(recs.map((r) => r.asset))], meta = new Map(metas.map((m) => [m.id, m]));
  const passKey = (p) => /^f\d*$/.test(p) ? p === "f" ? "f" : "f2+" : /^[xu]\d+$/.test(p) ? p[0] : p;
  const ORDER = ["r1", "r2", "r3", "r4", "r5", "x", "f", "u", "f2+"];
  const passes = [...new Set(recs.map((r) => passKey(r.pass)))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99)).map((pass) => {
    const rs = recs.filter((r) => passKey(r.pass) === pass), walls = rs.map((r) => r.wallMs).filter((w) => w !== void 0);
    return {
      pass,
      n: rs.length,
      meanScore: mean(rs.map((r) => r.score)),
      meanDelta: mean(rs.map((r) => r.delta).filter((d) => d !== void 0)),
      regressed: rs.filter((r) => (r.delta ?? 0) < 0).length,
      gatePass: rs.filter((r) => r.gate).length,
      outTokens: sum(rs.map((r) => r.outTokens)),
      imageTokens: sum(rs.map((r) => r.imageTokens)),
      meanWallS: walls.length ? round(mean(walls) / 1e3, 0) : void 0
    };
  });
  const perAsset = ids2.map((id) => {
    const rs = recs.filter((r) => r.asset === id), bases = rs.filter((r) => r.version.startsWith("base")), fins = rs.filter((r) => r.stage === "finish");
    const r1 = rs.find((r) => r.pass === "r1")?.score, best = bases.length ? Math.max(...bases.filter((b) => b.stage !== "user").map((b) => b.score)) : void 0;
    const fin = fins[fins.length - 1], finBase = fin && rs.find((r) => r.version === ledger.find((e) => e.type === "score" && e.asset === id && e.version === fin.version)?.base);
    const out = sum(rs.map((r) => r.outTokens + r.inTokens)), img = sum(rs.map((r) => r.imageTokens));
    return {
      id,
      kind: meta.get(id)?.kind ?? "?",
      r1,
      best: Number.isFinite(best) ? best : void 0,
      final: fin?.score ?? best,
      fromRevisions: r1 !== void 0 && best !== void 0 && Number.isFinite(best) ? round(best - r1) : void 0,
      fromFinish: fin && finBase ? round(fin.score - finBase.score) : void 0,
      passes: rs.length,
      outTokens: out,
      imageTokens: img,
      cost: round(tokenCost(sum(rs.map((r) => r.outTokens)), img + sum(rs.map((r) => r.inTokens))), 4)
    };
  });
  const group = (f) => {
    const g = /* @__PURE__ */ new Map();
    for (const a of perAsset) {
      const k = f(meta.get(a.id)) ?? "-";
      g.set(k, [...g.get(k) ?? [], a]);
    }
    return [...g].map(([key2, as]) => ({ key: key2, n: as.length, meanFinal: mean(as.map((a) => a.final).filter((x) => x !== void 0)), meanCost: as.length ? round(mean(as.map((a) => a.cost)) ?? 0, 4) : void 0, meanPasses: mean(as.map((a) => a.passes)) }));
  };
  const tmpl = /* @__PURE__ */ new Map();
  for (const a of perAsset) if (a.r1 !== void 0) {
    const t = meta.get(a.id)?.template ?? "-";
    tmpl.set(t, [...tmpl.get(t) ?? [], a.r1]);
  }
  const fb = ledger.filter((e) => e.type === "feedback" && e.by === "user" && e.asset !== "direction");
  const finals = new Set(ledger.filter((e) => e.type === "status" && e.status === "final").map((e) => e.asset)).size || perAsset.filter((a) => a.final !== void 0).length;
  const byRoute = {};
  for (const e of fb) byRoute[String(e.route ?? "?")] = (byRoute[String(e.route ?? "?")] ?? 0) + 1;
  const mg = /* @__PURE__ */ new Map();
  for (const r of recs) {
    const k = `${r.model ?? "unrecorded"}\0${r.effort ?? "-"}`;
    mg.set(k, [...mg.get(k) ?? [], r]);
  }
  const models = [...mg].map(([k, rs]) => {
    const [model, effort] = k.split("\0"), ds = rs.map((r) => r.delta).filter((d) => d !== void 0), tok = sum(rs.map((r) => r.outTokens + r.inTokens + r.imageTokens));
    return { model, effort, n: rs.length, meanDelta: mean(ds), deltaPerKTok: tok ? round(sum(ds) / tok * 1e3, 3) : void 0 };
  });
  const suggestions = [];
  for (const kind of [...new Set(perAsset.map((a) => a.kind))]) {
    const ofKind = (p) => recs.filter((r) => r.pass === p && meta.get(r.asset)?.kind === kind && r.delta !== void 0).map((r) => r.delta);
    const d3 = ofKind("r3"), d2 = ofKind("r2");
    if (d3.length >= 3 && mean(d3) <= 0.1) suggestions.push(`${kind}: v3 adds ${mean(d3)} on average over ${d3.length} assets \u2014 try budget.perKind.${kind}.revisionPasses = 2`);
    else if (d3.length >= 3 && mean(d3) >= 0.75) suggestions.push(`${kind}: v3 still adds ${mean(d3)} on average \u2014 a fourth revision may pay off (budget.perKind.${kind}.revisionPasses = 4)`);
    if (d2.length >= 3 && mean(d2) <= 0) suggestions.push(`${kind}: v2 does not improve on v1 (${mean(d2)}) \u2014 look at the template or the review notes`);
  }
  const ff = perAsset.map((a) => a.fromFinish).filter((x) => x !== void 0);
  if (ff.length >= 3 && mean(ff) <= 0) suggestions.push(`the finishing pass adds ${mean(ff)} on average \u2014 check it is fixing what the review sheets show`);
  const regRate = recs.filter((r) => r.stage === "revision" && (r.delta ?? 0) < 0).length / Math.max(1, recs.filter((r) => r.stage === "revision" && r.delta !== void 0).length);
  if (recs.length >= 10 && regRate > 0.3) suggestions.push(`${Math.round(regRate * 100)}% of revisions regressed \u2014 change one thing per revision (R12 keeps the best, but each regression costs a pass)`);
  const byReviewer = {}, own = /* @__PURE__ */ new Map();
  for (const e of ledger) if (e.type === "score" && !e.blind && e.asset !== "direction" && typeof e.score === "number") {
    const k = typeof e.reviewer === "string" ? e.reviewer : "unrecorded";
    byReviewer[k] = (byReviewer[k] ?? 0) + 1;
    own.set(`${e.asset}\0${e.version}`, e.score);
  }
  const blindLatest = /* @__PURE__ */ new Map();
  for (const e of ledger) if (e.type === "score" && e.blind && typeof e.score === "number") blindLatest.set(`${e.asset}\0${e.version}`, e);
  const blindRows = [...blindLatest].filter(([k]) => own.has(k)).map(([k, e]) => ({ asset: e.asset, version: e.version, own: own.get(k), blind: e.score, gap: round(own.get(k) - e.score) }));
  const meanGap = mean(blindRows.map((b) => b.gap));
  if (blindRows.length >= 3 && meanGap >= 0.5) suggestions.push(`blind re-scores average ${meanGap} below the pipeline's own scores over ${blindRows.length} finals \u2014 run every review through the art-reviewer subagent, not the authoring agent`);
  const totOut = sum(recs.map((r) => r.outTokens)), totIn = sum(recs.map((r) => r.inTokens)), totImg = sum(recs.map((r) => r.imageTokens));
  return {
    assets: ids2.length,
    passes,
    perAsset,
    byGroup: { kind: group((m) => m?.kind), size: group((m) => m?.size), view: group((m) => m?.view), importance: group((m) => m?.importance) },
    firstPassByTemplate: [...tmpl].map(([template, xs]) => ({ template, n: xs.length, meanR1: mean(xs) })),
    regressions: recs.filter((r) => r.delta !== void 0 && r.delta < 0).map((r) => ({ asset: r.asset, version: r.version, pass: r.pass, delta: r.delta })),
    userRevisionRate: { feedback: fb.length, finals, rate: finals ? round(new Set(fb.map((e) => e.asset)).size / finals) : void 0, byRoute },
    models,
    review: { byReviewer, blind: { n: blindRows.length, meanGap, over1: blindRows.filter((b) => b.gap > 1).length, assets: blindRows } },
    suggestions,
    totals: { outTokens: totOut, inTokens: totIn, imageTokens: totImg, cost: round(tokenCost(totOut, totIn + totImg), 4), meanFromRevisions: mean(perAsset.map((a) => a.fromRevisions).filter((x) => x !== void 0)), meanFromFinish: mean(ff) }
  };
}
function analyticsMarkdown(r, title = "artgen pipeline analytics") {
  let md = `# ${title}

${r.assets} assets. Price basis: $${PRICE.inPerM}/M input (review images, measured input), $${PRICE.outPerM}/M output (code; estimated at 3.5 chars/token unless measured).

`;
  md += `Totals: ${r.totals.outTokens} output tok, ${r.totals.imageTokens} review-image tok${r.totals.inTokens ? `, ${r.totals.inTokens} measured input tok` : ""}, est. $${r.totals.cost.toFixed(3)}. Average gain from revisions ${s(r.totals.meanFromRevisions, true)}, from the finishing pass ${s(r.totals.meanFromFinish, true)}.

`;
  md += "## Per pass\n\n| Pass | n | Mean score | Mean \u0394 | Regressed | Gate pass | Output tok | Review tok | Mean wall s |\n|---|---|---|---|---|---|---|---|---|\n";
  for (const p of r.passes) md += `| ${p.pass} | ${p.n} | ${s(p.meanScore)} | ${s(p.meanDelta, true)} | ${p.regressed} | ${p.gatePass}/${p.n} | ${p.outTokens} | ${p.imageTokens} | ${s(p.meanWallS)} |
`;
  md += "\n## Per asset\n\n| Asset | Kind | r1 | Best revision | Final | From revisions | From finish | Passes | Output tok | Review tok | Est. cost |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
  for (const a of r.perAsset) md += `| ${a.id} | ${a.kind} | ${s(a.r1)} | ${s(a.best)} | ${s(a.final)} | ${s(a.fromRevisions, true)} | ${s(a.fromFinish, true)} | ${a.passes} | ${a.outTokens} | ${a.imageTokens} | $${a.cost.toFixed(4)} |
`;
  for (const [k, rows] of Object.entries(r.byGroup)) {
    if (rows.length < 2 && rows[0]?.key === "-") continue;
    md += `
## Cost by ${k}

| ${k} | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
`;
    for (const g of rows) md += `| ${g.key} | ${g.n} | ${s(g.meanFinal)} | ${g.meanCost === void 0 ? "-" : `$${g.meanCost.toFixed(4)}`} | ${s(g.meanPasses)} |
`;
  }
  md += "\n## First-pass quality by template\n\n| Template | n | Mean r1 |\n|---|---|---|\n";
  for (const t of r.firstPassByTemplate) md += `| ${t.template} | ${t.n} | ${s(t.meanR1)} |
`;
  md += `
## Regressions

${r.regressions.length ? r.regressions.map((x) => `- ${x.asset} ${x.version} (${x.pass}) ${x.delta}`).join("\n") : "none"}
`;
  const u = r.userRevisionRate;
  md += `
## User revisions

${u.feedback} feedback rounds over ${u.finals} finished assets (rate ${s(u.rate)})${Object.keys(u.byRoute).length ? `; by route: ${Object.entries(u.byRoute).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}.
`;
  md += "\n## Model / effort per stage\n\n| Model | Effort | Passes | Mean \u0394 | \u0394 per 1k tok |\n|---|---|---|---|---|\n";
  for (const m of r.models) md += `| ${m.model} | ${m.effort} | ${m.n} | ${s(m.meanDelta, true)} | ${s(m.deltaPerKTok)} |
`;
  const rv = r.review;
  md += `
## Review independence

Scores by reviewer: ${Object.entries(rv.byReviewer).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}. Blind re-scores: ${rv.blind.n}${rv.blind.n ? `, mean gap ${s(rv.blind.meanGap, true)} (own \u2212 blind), ${rv.blind.over1} more than 1 point apart` : ""}.
`;
  if (rv.blind.n) {
    md += "\n| Asset | Final | Own | Blind | Gap |\n|---|---|---|---|---|\n";
    for (const b of rv.blind.assets) md += `| ${b.asset} | ${b.version} | ${b.own} | ${b.blind} | ${s(b.gap, true)} |
`;
  }
  md += `
## Budget suggestions

${r.suggestions.length ? r.suggestions.map((x) => `- ${x}`).join("\n") : "- none: no kind crosses a threshold (v3 adding \u2264 0.1 or \u2265 0.75 over \u2265 3 assets, v2 not improving, finish \u2264 0, > 30% regressions)"}
`;
  return md;
}
var PRICE, tokenCost, stageOf, round, mean, sum, s;
var init_analytics = __esm({
  "../artgen-core/src/w2/analytics.ts"() {
    "use strict";
    PRICE = { inPerM: 4, outPerM: 20 };
    tokenCost = (out, inp) => (out * PRICE.outPerM + inp * PRICE.inPerM) / 1e6;
    stageOf = (pass) => pass.startsWith("f") ? "finish" : pass.startsWith("x") ? "extra" : pass.startsWith("u") ? "user" : "revision";
    round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
    mean = (xs) => xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : void 0;
    sum = (xs) => xs.reduce((a, b) => a + b, 0);
    s = (v, sign = false) => v === void 0 ? "-" : `${sign && v >= 0 ? "+" : ""}${v}`;
  }
});

// ../artgen-core/src/w2/recommend.ts
var init_recommend = __esm({
  "../artgen-core/src/w2/recommend.ts"() {
    "use strict";
    init_analytics();
  }
});

// ../artgen-core/src/w2/edit.ts
function tokenizer(dir) {
  const dc = dirContext(dir), map = /* @__PURE__ */ new Map([[dc.outline, "outline"]]);
  for (const [name, r] of Object.entries(dc.pal)) r.forEach((c, i) => {
    if (!map.has(c)) map.set(c, `${name}.${i}`);
  });
  return (g, x, y) => {
    const a = g.alpha(x, y);
    if (!a) return null;
    if (a < 255) return "shadow";
    return map.get(g.get(x, y)) ?? null;
  };
}
function restyleDiff(before, after, from, to) {
  if (before.w !== after.w || before.h !== after.h) throw new Error(`restyle diff: size changed ${before.w}x${before.h} \u2192 ${after.w}x${after.h}`);
  const ta = tokenizer(from), tb = tokenizer(to), map = /* @__PURE__ */ new Map();
  let changed = 0, opaque = 0, same = 0;
  for (let y = 0; y < before.h; y++) for (let x = 0; x < before.w; x++) {
    const a = before.get(x, y), b = after.get(x, y);
    if (a !== b || before.alpha(x, y) !== after.alpha(x, y)) changed++;
    if (before.alpha(x, y) === 255 || after.alpha(x, y) === 255) {
      opaque++;
      if (ta(before, x, y) === tb(after, x, y)) same++;
      const k = a ?? "none";
      map.set(k, (map.get(k) ?? /* @__PURE__ */ new Set()).add(b ?? "none"));
    }
  }
  const mapping = Object.fromEntries([...map].map(([k, v]) => [k, [...v]]));
  return { changedPct: Math.round(1e3 * changed / (before.w * before.h)) / 10, tokenSame: opaque ? Math.round(1e3 * same / opaque) / 1e3 : 1, consistent: [...map.values()].every((s2) => s2.size === 1), mapping };
}
function tokenDiffMask(before, after, from, to) {
  const ta = tokenizer(from), tb = tokenizer(to), g = new Grid(after.w, after.h);
  for (let y = 0; y < after.h; y++) for (let x = 0; x < after.w; x++) {
    if (ta(before, x, y) !== tb(after, x, y)) g.set(x, y, "#ff3040");
    else if (after.alpha(x, y)) g.set(x, y, "#3a3a44");
  }
  return g;
}
function restyleSheet(title, rows, scale2 = 3, maxEdge = 1568) {
  const size = (s3) => {
    const cw = Math.max(...rows.map((r) => r.after.w * s3), textWidth("token diff", TXT3)) + PAD3;
    const W3 = Math.max(PAD3 + cw * 3, PAD3 * 2 + textWidth(title, TXT3), ...rows.map((r) => PAD3 * 2 + textWidth(r.label, TXT3)));
    const H = PAD3 + LAB2 * 2 + rows.reduce((n, r) => n + LAB2 + r.after.h * s3 + PAD3, 0);
    return { cw, W: W3, H };
  };
  let s2 = scale2, L = size(s2);
  while (Math.max(L.W, L.H) > maxEdge && s2 > 1) {
    s2--;
    L = size(s2);
  }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG3);
  drawText(g, PAD3, PAD3, title, "#ffffff", TXT3);
  ["before", "after", "token diff"].forEach((h, i) => drawText(g, PAD3 + i * L.cw, PAD3 + LAB2, h, FG3, TXT3));
  let y = PAD3 + LAB2 * 2;
  for (const r of rows) {
    drawText(g, PAD3, y, r.label, FG3, TXT3);
    const top = y + LAB2;
    [r.before, r.after, r.mask].forEach((im, i) => {
      const big = im.scale(s2), x = PAD3 + i * L.cw;
      if (r.bg && i < 2) g.fill(x, top, big.w, big.h, r.bg);
      else checker(g, x, top, big.w, big.h);
      g.over(big, x, top);
    });
    y = top + r.after.h * s2 + PAD3;
  }
  return g;
}
var PAD3, TXT3, LAB2, BG3, FG3;
var init_edit = __esm({
  "../artgen-core/src/w2/edit.ts"() {
    "use strict";
    init_direction();
    init_color();
    init_font();
    init_grid();
    init_sheet();
    PAD3 = 10;
    TXT3 = 2;
    LAB2 = GLYPH_H * TXT3 + 6;
    BG3 = "#16161c";
    FG3 = "#dddddd";
  }
});

// ../artgen-core/src/w2/config.ts
function mergeConfig(raw = {}) {
  const out = { ...DEFAULT_CONFIG };
  for (const [k, v] of Object.entries(raw)) {
    const d = DEFAULT_CONFIG[k];
    out[k] = d && typeof d === "object" && !Array.isArray(d) && v && typeof v === "object" && !Array.isArray(v) && k !== "packs" ? { ...d, ...v } : v;
  }
  return out;
}
function budgetFor(cfg, brief, dir) {
  const b = cfg?.budget ?? {}, kind = b.perKind?.[brief.kind] ?? {}, tier = brief.importance && b.tiers?.[brief.importance] || {};
  return {
    revisionPasses: kind.revisionPasses ?? tier.revisionPasses ?? b.revisionPasses ?? dir.pipeline.revisionPasses,
    extraRevisions: kind.extraAutonomousRevisions ?? tier.extraAutonomousRevisions ?? b.extraAutonomousRevisions ?? 0,
    maxImageTokens: kind.maxImageTokensPerAsset ?? tier.maxImageTokensPerAsset ?? b.maxImageTokensPerAsset,
    maxUserIterations: b.maxUserIterations ?? 3
  };
}
var DEFAULT_CONFIG, INIT_CONFIG, isPlaceholderDirection, finishBaseOf;
var init_config = __esm({
  "../artgen-core/src/w2/config.ts"() {
    "use strict";
    DEFAULT_CONFIG = {
      version: 1,
      export: { packDir: "public/assets", runtimeDir: "src/art/runtime", assetsTs: "src/art/assets.ts" },
      runtime: { adapters: ["canvas2d"] },
      packs: { main: { include: ["*"] } },
      budget: { revisionPasses: 3, maxSheetEdge: 1568, maxUserIterations: 3, extraAutonomousRevisions: 1, tiers: { hero: { revisionPasses: 4 }, filler: { revisionPasses: 2 } } },
      models: { base: "default", revise: "default", finish: "default", review: "default" },
      review: { blind: true, approveMin: 6.5, blindMaxGap: 1 },
      gate: {}
    };
    INIT_CONFIG = {
      ...DEFAULT_CONFIG,
      budget: { ...DEFAULT_CONFIG.budget, perKind: { texture: { revisionPasses: 2 }, prop: { revisionPasses: 4 } } }
    };
    isPlaceholderDirection = (d) => typeof d === "object" && d !== null && d.status === "draft" && !d.palette;
    finishBaseOf = (src) => src.match(/export\s+const\s+base\s*=\s*['"]([^'"]+)['"]/)?.[1];
  }
});

// ../artgen-core/src/index.ts
var init_src = __esm({
  "../artgen-core/src/index.ts"() {
    "use strict";
    init_color();
    init_grid();
    init_rng();
    init_png();
    init_gif();
    init_palette();
    init_font();
    init_post();
    init_prim();
    init_blit();
    init_iso();
    init_voxel();
    init_svg();
    init_direction();
    init_render();
    init_metrics();
    init_conformance();
    init_sheet();
    init_tiles();
    init_anim2();
    init_ledger();
    init_pipeline();
    init_normals();
    init_camera();
    init_views();
    init_fp();
    init_noise();
    init_materials();
    init_iso2();
    init_wfc();
    init_lsystem();
    init_autotile();
    init_raster2();
    init_vox();
    init_gltf();
    init_geom();
    init_scene();
    init_scene3d();
    init_raster();
    init_proc();
    init_finish();
    init_params();
    init_anim();
    init_particles();
    init_candidates();
    init_sheets();
    init_briefs();
    init_status();
    init_pack();
    init_contract();
    init_roster();
    init_analytics();
    init_recommend();
    init_edit();
    init_config();
  }
});

// ../artgen-core/bench/directions/benchmark.json
var benchmark_default;
var init_benchmark = __esm({
  "../artgen-core/bench/directions/benchmark.json"() {
    benchmark_default = {
      id: "artlab-benchmark",
      version: 1,
      status: "locked",
      theme: {
        pitch: "artlab parity benchmark",
        notes: "Reproduces artlab's shared master palette (lib/core.js PAL) so the six artlab finals render as they were scored. Reference only, not an authoring style."
      },
      camera: { view: "topdown", iso: { tile: [32, 16] }, light: [-1, -1, 1], directions: 1, pixelScale: 6 },
      scale: { character: [32, 32], tall: [32, 48], creature: [32, 32], prop: [32, 32], vehicle: [64, 64], ship: [160, 41] },
      palette: {
        source: "custom",
        ramps: {
          skin: ["#f6d2b0", "#e2a27c", "#b56e55"],
          hair: ["#b07a45", "#7a4a2a", "#4a2a1a"],
          steel: ["#eef2f5", "#b4bfc8", "#77838f", "#4a5460"],
          blue: ["#6b9be0", "#3f68b8", "#283f7a"],
          red: ["#e0574a", "#a8323a", "#6a1e2e"],
          gold: ["#ffe27a", "#d9a832", "#8f6418"],
          leather: ["#a8703c", "#74482a", "#4a2c1c"],
          navy: ["#c4ccd2", "#97a3ad", "#6c7883", "#47515b", "#2c333b"],
          teak: ["#d8b98a", "#b8956a", "#8c6c48"],
          hullred: ["#8a3a34"],
          armor: ["#e4e9ee", "#aab5bf", "#6e7a86", "#3e4650", "#262b32"],
          cyan: ["#c8ffff", "#5ce6ff", "#1aa0c8"],
          orange: ["#ffd27a", "#ff8a3c", "#c04a1e"],
          blush: ["#ec9a8f"],
          green: ["#8fcf5e", "#4e8f3e", "#2c5a2e"],
          purple: ["#9a72b8", "#62467e", "#3a2a50"],
          wood: ["#c98a4b", "#9a6232", "#6a3e22"],
          ink: ["#2b2233"],
          white: ["#ffffff"]
        },
        outline: "#1a1423",
        shadow: { color: "#000000", alpha: 0.35 },
        materials: { metal: "steel", cloth: "blue", foliage: "green", accent: "gold" }
      },
      line: { outer: "dark", inner: "selective", weight: 1 },
      shading: { bands: 5, hueShift: 0, dither: "none", highlight: "sparing", aa: false },
      pipeline: { revisionPasses: 3, finishPass: true, raster: { directMaxPx: 32, ss: 8 } }
    };
  }
});

// ../artgen-core/bench/directions/alt.json
var alt_default;
var init_alt = __esm({
  "../artgen-core/bench/directions/alt.json"() {
    alt_default = {
      id: "ember-dusk",
      version: 1,
      status: "locked",
      theme: {
        pitch: "alternate benchmark direction",
        mood: [
          "warm",
          "muted",
          "dusk"
        ],
        notes: "Generated from the benchmark ramps with generateRamp (hue +18\xB0, saturation \xD70.8, hue shift 14\xB0). Proves the six benchmark assets restyle from direction tokens alone."
      },
      camera: {
        view: "topdown",
        iso: {
          tile: [
            32,
            16
          ]
        },
        light: [
          -1,
          -1,
          1
        ],
        directions: 1,
        pixelScale: 6
      },
      scale: {
        character: [
          32,
          32
        ],
        tall: [
          32,
          48
        ],
        creature: [
          32,
          32
        ],
        prop: [
          32,
          32
        ],
        vehicle: [
          64,
          64
        ],
        ship: [
          160,
          41
        ]
      },
      palette: {
        source: "generated",
        ramps: {
          skin: [
            "#e8e5cc",
            "#d3b476",
            "#ae6730"
          ],
          hair: [
            "#a7a25e",
            "#6b592f",
            "#22170d"
          ],
          steel: [
            "#c7c4bb",
            "#9f9486",
            "#706257",
            "#3c322e"
          ],
          blue: [
            "#919ec3",
            "#474aa2",
            "#24245a"
          ],
          red: [
            "#bc9a7c",
            "#934f3a",
            "#481a1a"
          ],
          gold: [
            "#d2d293",
            "#c2c238",
            "#735f1c"
          ],
          leather: [
            "#a4a05b",
            "#66562e",
            "#1d140c"
          ],
          navy: [
            "#bdb9b0",
            "#9f9688",
            "#7e7063",
            "#574b44",
            "#302825"
          ],
          teak: [
            "#ccccb0",
            "#aaa067",
            "#6d5939"
          ],
          hullred: [
            "#7a5139"
          ],
          armor: [
            "#bfbcb2",
            "#a0998b",
            "#807365",
            "#594e46",
            "#322a27"
          ],
          cyan: [
            "#c2e6f0",
            "#5aaaed",
            "#0d49cf"
          ],
          orange: [
            "#eae5a9",
            "#eab63e",
            "#b2580b"
          ],
          blush: [
            "#deab86"
          ],
          green: [
            "#84af7d",
            "#427f48",
            "#1c3a26"
          ],
          purple: [
            "#a47fa3",
            "#694771",
            "#281d30"
          ],
          wood: [
            "#b6b575",
            "#877439",
            "#3d2b17"
          ],
          ink: [
            "#2c222e"
          ],
          white: [
            "#fff4dc"
          ]
        },
        outline: "#2a160e",
        shadow: {
          color: "#140a1e",
          alpha: 0.4
        },
        materials: {
          metal: "steel",
          cloth: "blue",
          foliage: "green",
          accent: "gold"
        }
      },
      line: {
        outer: "dark",
        inner: "selective",
        weight: 1
      },
      shading: {
        bands: 5,
        hueShift: 14,
        dither: "none",
        highlight: "sparing",
        aa: false
      },
      pipeline: {
        revisionPasses: 3,
        finishPass: true,
        raster: {
          directMaxPx: 32,
          ss: 8
        }
      }
    };
  }
});

// ../artgen-core/bench/assets/hero.js
var SWORD;
var init_hero = __esm({
  "../artgen-core/bench/assets/hero.js"() {
    "use strict";
    SWORD = ["..OO..", ".OWAO.", ...Array(10).fill(".OWaO."), "OOOOOO", "OGGGgO", ".OSSO.", ".OlLO.", ".OGgO.", "..OO.."];
  }
});

// ../artgen-core/bench/assets/ship.js
var init_ship = __esm({
  "../artgen-core/bench/assets/ship.js"() {
    "use strict";
  }
});

// ../artgen-core/bench/assets/tank.js
var init_tank = __esm({
  "../artgen-core/bench/assets/tank.js"() {
    "use strict";
  }
});

// ../artgen-core/bench/assets/isohero.js
var init_isohero = __esm({
  "../artgen-core/bench/assets/isohero.js"() {
    "use strict";
  }
});

// ../artgen-core/bench/assets/isospider.js
var init_isospider = __esm({
  "../artgen-core/bench/assets/isospider.js"() {
    "use strict";
  }
});

// ../artgen-core/bench/assets/isochest.js
var init_isochest = __esm({
  "../artgen-core/bench/assets/isochest.js"() {
    "use strict";
  }
});

// ../artgen-core/bench/index.ts
var BENCH_DIRECTIONS;
var init_bench = __esm({
  "../artgen-core/bench/index.ts"() {
    "use strict";
    init_benchmark();
    init_alt();
    init_hero();
    init_ship();
    init_tank();
    init_isohero();
    init_isospider();
    init_isochest();
    BENCH_DIRECTIONS = {
      benchmark: benchmark_default,
      alt: alt_default
    };
  }
});

// ../artgen-cli/src/node.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire as createRequire2 } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
function initNodeSvg() {
  const local = fileURLToPath(new URL("./resvg.wasm", import.meta.url));
  return initSvg(readFileSync(existsSync(local) ? local : require3.resolve("@resvg/resvg-wasm/index_bg.wasm")));
}
function writeGrid(path, g) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(g));
}
function appendLedger(path, entry) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, formatLedgerLine({ ts: (/* @__PURE__ */ new Date()).toISOString(), ...entry }) + "\n");
}
var require3, readGrid;
var init_node = __esm({
  "../artgen-cli/src/node.ts"() {
    "use strict";
    init_src();
    require3 = createRequire2(import.meta.url);
    readGrid = (path) => decodePNG(new Uint8Array(readFileSync(path)));
  }
});

// ../artgen-cli/src/bench.ts
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { join } from "node:path";
function strip(r) {
  const g = new Grid(r.size[0] * r.cells.length, r.size[1]);
  r.cells.forEach((c, i) => g.blit(c.grid, i * r.size[0], 0));
  return g;
}
var BENCH_ROOT, GOLDEN_PATH;
var init_bench2 = __esm({
  "../artgen-cli/src/bench.ts"() {
    "use strict";
    init_src();
    init_bench();
    init_node();
    BENCH_ROOT = fileURLToPath2(new URL("../../artgen-core/bench/", import.meta.url));
    GOLDEN_PATH = join(BENCH_ROOT, "golden.json");
  }
});

// ../artgen-cli/src/project.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2, join as join2, resolve } from "node:path";
function findProject(start = process.cwd()) {
  for (let d = resolve(start); ; d = dirname2(d)) {
    if (existsSync2(join2(d, "art", CONFIG_FILE))) return { root: d, art: join2(d, "art") };
    if (dirname2(d) === d) return null;
  }
}
function projectConfig(p) {
  const f = join2(p.art, CONFIG_FILE);
  return mergeConfig(existsSync2(f) ? readJson(f) : {});
}
var CONFIG_FILE, readJson, writeJson;
var init_project = __esm({
  "../artgen-cli/src/project.ts"() {
    "use strict";
    init_src();
    init_src();
    CONFIG_FILE = "artgen.config.json";
    readJson = (p) => JSON.parse(readFileSync2(p, "utf8"));
    writeJson = (p, v) => {
      mkdirSync2(dirname2(p), { recursive: true });
      writeFileSync2(p, JSON.stringify(v, null, 2) + "\n");
    };
  }
});

// ../artgen-cli/src/asset.ts
import { existsSync as existsSync3, readdirSync, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { basename, dirname as dirname3, join as join3, relative, resolve as resolve2 } from "node:path";
import { pathToFileURL } from "node:url";
function projectBrief(p, id) {
  const f = join3(p.art, "briefs.yaml");
  if (!existsSync3(f)) return void 0;
  const r = parseBriefs(readFileSync3(f, "utf8"));
  if (!r.ok) throw new Error(`art/briefs.yaml:
  ${r.errors.join("\n  ")}`);
  return r.briefs.find((b) => b.id === id);
}
function editTokens(prev, src) {
  if (prev === void 0) return codeTokens(src);
  const pool = /* @__PURE__ */ new Map();
  for (const l of prev.split("\n")) pool.set(l, (pool.get(l) ?? 0) + 1);
  let added = "";
  for (const l of src.split("\n")) {
    const n = pool.get(l);
    if (n) pool.set(l, n - 1);
    else added += l + "\n";
  }
  return codeTokens(added);
}
function findUp(start, name) {
  for (let d = resolve2(start); ; d = dirname3(d)) {
    if (existsSync3(join3(d, name))) return join3(d, name);
    if (dirname3(d) === d) return null;
  }
}
function openAsset(path, opts = {}) {
  const briefPath = join3(path, "brief.json"), project2 = findProject(path) ?? void 0;
  const local = existsSync3(briefPath) ? JSON.parse(readFileSync3(briefPath, "utf8")) : void 0;
  const id = local?.id ?? basename(resolve2(path)), fromYaml = project2 ? projectBrief(project2, id) : void 0;
  if (!local && !fromYaml) throw new Error(`${path}: no brief.json and no brief "${id}" in art/briefs.yaml`);
  const brief = { ...local, ...fromYaml, id };
  const dname = opts.direction ?? brief.direction;
  let dir;
  if (dname && BENCH_DIRECTIONS[dname]) dir = parseDirection(BENCH_DIRECTIONS[dname]);
  else {
    const file = opts.direction ? resolve2(opts.direction) : dname ? resolve2(path, dname) : findUp(path, "direction.json");
    if (!file) throw new Error(`${path}: no direction (brief.direction, --direction or a direction.json up the tree)`);
    const raw = JSON.parse(readFileSync3(file, "utf8"));
    if (isPlaceholderDirection(raw)) throw new Error(`${file} is not locked yet \u2014 lock one with \`artgen direction lock <candidate>\`, or pass --direction art/candidates/<name>.json`);
    dir = parseDirection(raw);
  }
  const ledgerPath2 = opts.ledger ?? findUp(path, "ledger.jsonl") ?? join3(dirname3(resolve2(path)), "ledger.jsonl");
  const cfg = project2 ? projectConfig(project2) : void 0;
  return { path, brief, dir, ledgerPath: ledgerPath2, ...project2 && { project: project2 }, budget: budgetFor(cfg, brief, dir) };
}
function ledgerFor(a) {
  return existsSync3(a.ledgerPath) ? parseLedger(readFileSync3(a.ledgerPath, "utf8")).filter((e) => e.asset === a.brief.id) : [];
}
async function load(file) {
  return await import(`${pathToFileURL(resolve2(file)).href}?h=${sourceHash(readFileSync3(file, "utf8"))}`);
}
async function renderVersion(a, version, opts = {}) {
  await initNodeSvg();
  const v = parseVersion(version);
  if (!v) throw new Error(`bad version ${version}`);
  const file = join3(a.path, `${v.name}.js`);
  if (!existsSync3(file)) throw new Error(`${file} does not exist`);
  const source = readFileSync3(file, "utf8");
  let render, base, patches, stale, src = source;
  if (v.kind === "base") render = renderAsset(await load(file), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages, onScene: opts.onScene });
  else {
    const fin = await load(file);
    base = fin.base;
    if (!parseVersion(base ?? "")) throw new Error(`${file}: export const base = 'base.vN' is required`);
    const baseRender = renderAsset(await load(join3(a.path, `${base}.js`)), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages, onScene: opts.onScene });
    const f = applyFinish(baseRender, fin, a.dir);
    render = f.render;
    patches = f.patches;
    const snap = join3(a.path, `${v.name}.snapshot.json`);
    if (existsSync3(snap) && !opts.variant) stale = finishStale(JSON.parse(readFileSync3(snap, "utf8")), patches);
    src = sourceOf(a, base) + "\n" + source;
  }
  const s2 = strip(render), grid = reviewGrid(render, a.dir);
  const report2 = conformance({
    frames: render.cells.map((c) => c.grid),
    dir: a.dir,
    kind: a.brief.kind,
    size: resolveSize(a.dir, a.brief.size, a.brief.kind),
    source: src,
    symAxis: a.brief.review?.sym ?? "x",
    lint: render.lint,
    periodic: a.brief.review?.periodic,
    autotile: a.brief.autotile,
    ...a.brief.height && { height: { metres: a.brief.height, pxPerMetre: pxPerMetre(a.dir) } },
    anim: animInput(render)
  });
  return { version: v.name, render, strip: s2, grid, report: report2, source, base, patches, stale };
}
function contextFor(a, g) {
  if (a.brief.review?.iso) return iso_exports.isoFloor(g.w, g.h);
  const view = a.brief.view ?? a.dir.camera.view;
  if (a.brief.kind === "layer") return void 0;
  return view === "oblique" || view === "side" ? viewContext(view, g.w, g.h, a.dir) : void 0;
}
function firstFacing(r) {
  const f = r.facings[0];
  return strip({ ...r, cells: r.cells.filter((c) => c.facing === f) });
}
function reviewGrid(r, dir) {
  const g = withFp(layoutGrid(r), r, dir);
  const special = r.brief.kind === "layer" || r.brief.view === "stack" || !!r.brief.autotile || TILE_KINDS.has(r.brief.kind);
  const f = r.facings[0], moving = special ? [] : r.states.filter((s2) => r.frames[s2] > 1);
  if (!moving.length) return g;
  const rows = moving.map((s2) => onionSkin(r.cells.filter((c) => c.state === s2 && c.facing === f).sort((a, b) => a.frame - b.frame).map((c) => c.grid)));
  const out = new Grid(Math.max(g.w, ...rows.map((x) => x.w)), g.h + rows.reduce((n, x) => n + x.h + 2, 0));
  out.blit(g, 0, 0);
  let y = g.h + 2;
  for (const row of rows) {
    out.blit(row, 0, y);
    y += row.h + 2;
  }
  return out;
}
function withFp(g, r, dir) {
  if (!dir || (r.brief.view ?? dir.camera.view) !== "fp") return g;
  const f0 = r.facings[0], first = (s2) => r.cells.find((c) => c.state === s2 && c.facing === f0).grid;
  const role = fpRole(r.brief.kind, r.brief.surface);
  const frames = role === "billboard" ? r.facings.filter((f) => ["s", "se", "e", "sw", "n"].includes(f)).slice(0, 3).map((f) => r.cells.find((c) => c.state === r.states[0] && c.facing === f).grid) : role === "viewmodel" ? r.states.map((s2) => {
    const cs = r.cells.filter((c) => c.state === s2 && c.facing === f0);
    return cs[Math.min(1, cs.length - 1)].grid;
  }) : [first(r.states[0])];
  const shots = fpShots(dir, r.brief.kind, frames, { surface: r.brief.surface });
  const row = new Grid(shots.reduce((n, x2) => n + x2.w + 2, -2), shots[0].h);
  let x = 0;
  for (const s2 of shots) {
    row.blit(s2, x, 0);
    x += s2.w + 2;
  }
  const out = new Grid(Math.max(g.w, row.w), g.h + 2 + row.h);
  out.blit(g, 0, 0);
  out.blit(row, 0, g.h + 2);
  return out;
}
function layoutGrid(r) {
  if (r.brief.kind === "layer" && r.states.length > 1) {
    const cells = r.states.map((s2) => r.cells.find((c) => c.state === s2)), row = strip({ ...r, cells });
    const layers = cells.map((c, i) => ({ grid: c.grid, depth: (i + 1) / cells.length }));
    const scroll = parallaxStrip(layers, r.size[0], [0, Math.round(r.size[0] / 3), Math.round(2 * r.size[0] / 3)]);
    const g = new Grid(Math.max(row.w, scroll.w), row.h + 2 + scroll.h);
    g.blit(row, 0, 0);
    g.blit(scroll, 0, row.h + 2);
    return g;
  }
  if (r.brief.view === "stack") {
    const slices = r.cells.filter((c) => c.state === r.states[0] && c.facing === r.facings[0]).map((c) => c.grid);
    const row = strip({ ...r, cells: r.cells.filter((c) => c.state === r.states[0] && c.facing === r.facings[0]) }), turn = stackStrip(slices, 8, 1);
    const g = new Grid(Math.max(row.w, turn.w), row.h + 2 + turn.h);
    g.blit(row, 0, 0);
    g.blit(turn, 0, row.h + 2);
    return g;
  }
  if (r.brief.autotile && r.cells.length >= autotileCount(r.brief.autotile)) {
    const tiles = r.cells.filter((c) => c.state === r.states[0] && c.facing === r.facings[0]).map((c) => c.grid);
    const sheet = autotileSheet(tiles, 8), map = autotileMap(tiles, r.brief.autotile, void 0, 8);
    const g = new Grid(sheet.w + 4 + map.w, Math.max(sheet.h, map.h));
    g.blit(sheet, 0, 0);
    g.blit(map, sheet.w + 4, 0);
    return g;
  }
  if (["tile", "tileset", "texture"].includes(r.brief.kind) && r.cells.length <= 4) {
    const [w, h] = r.size, isoTile = r.brief.view === "iso" || r.brief.review?.iso;
    if (isoTile) {
      const W3 = w * 3 + (w >> 1), H = (h >> 1) * 6 + (h >> 1), g2 = new Grid((W3 + 1) * r.cells.length - 1, H);
      r.cells.forEach((c, k) => {
        for (let j = 0; j < 7; j++) for (let i = -1; i < 4; i++) g2.over(c.grid, k * (W3 + 1) + i * w + j % 2 * (w >> 1), j * (h >> 1) - (h >> 1));
      });
      return g2;
    }
    const g = new Grid((w * 3 + 1) * r.cells.length - 1, h * 3);
    r.cells.forEach((c, k) => {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.blit(c.grid, k * (w * 3 + 1) + i * w, j * h);
    });
    return g;
  }
  if (r.cells.length <= 8) return strip(r);
  const facings = r.facings.filter((f) => r.cells.some((c) => c.facing === f && !c.mirrored));
  return assembleSheet({ ...r, facings, cells: r.cells.filter((c) => facings.includes(c.facing)) }, 1).grid;
}
function outDir(a) {
  return join3(a.path, "out");
}
function writeRender(a, r, out = outDir(a)) {
  const sc = a.brief.review?.scale ?? 4, files = [join3(out, `${r.version}.png`), join3(out, `${r.version}@${sc}x.png`)];
  writeGrid(files[0], r.strip);
  writeGrid(files[1], r.strip.scale(sc));
  return files;
}
async function reviewVersion(a, version, o = {}) {
  const vs = versionsIn(a), cur = await renderVersion(a, version), R2 = a.brief.review ?? {}, sc = R2.scale ?? 4;
  const sil = !TILE_KINDS.has(a.brief.kind);
  if (o.blind) {
    const sheet2 = reviewSheet({
      title: R2.label ?? a.brief.id,
      anchors: anchorsFor(a),
      maxEdge: a.project ? projectConfig(a.project).budget?.maxSheetEdge : void 0,
      rows: [{ label: a.brief.id, grid: cur.grid, scale: sc, bg: R2.bg ?? a.dir.background, context: contextFor(a, cur.grid), silhouette: sil }]
    });
    const path2 = join3(outDir(a), `review-${version}-blind.png`), tokens2 = imageTokens(sheet2.w, sheet2.h);
    writeGrid(path2, sheet2);
    appendLedger(a.ledgerPath, { type: "review", asset: a.brief.id, version, pass: "b", blind: true, sheet: relPath(a, path2), imageTokens: tokens2, by: "agent" });
    return { path: path2, tokens: tokens2, render: cur };
  }
  const scores = new Map(ledgerFor(a).filter((e) => e.type === "score" && !e.blind && e.version).map((e) => [e.version, e.score]));
  const ctx = (g) => contextFor(a, g);
  const rows = [];
  if (a.brief.reference) {
    const ref = readGrid(resolve2(a.path, a.brief.reference));
    rows.push({ label: `reference${a.brief.target !== void 0 ? ` (target ${a.brief.target})` : ""}`, grid: ref, scale: sc, bg: R2.bg, context: ctx(ref) });
  }
  const v = parseVersion(version), prev = v.kind === "finish" ? cur.base : vs.filter((x) => parseVersion(x).kind === "base" && parseVersion(x).n < v.n).pop();
  const best = [...scores].filter(([k]) => parseVersion(k)?.kind === "base" && k !== prev && k !== version).sort((x, y) => y[1] - x[1])[0]?.[0];
  const big = cur.render.cells.length > 8;
  for (const other of [best, prev]) if (other) {
    const r = await renderVersion(a, other), grid = big ? firstFacing(r.render) : r.grid;
    rows.push({ label: rowLabel(r, scores.get(other)) + (big ? " | first facing" : ""), grid, scale: sc, bg: R2.bg ?? a.dir.background, context: ctx(grid), silhouette: sil });
  }
  rows.push({ label: `>> ${rowLabel(cur)}`, grid: cur.grid, scale: sc, bg: R2.bg ?? a.dir.background, context: ctx(cur.grid), silhouette: sil });
  const sheet = reviewSheet({ title: `${R2.label ?? a.brief.id} - ${version} (${passOf(a, version)})`, rows, anchors: anchorsFor(a), maxEdge: a.project ? projectConfig(a.project).budget?.maxSheetEdge : void 0 });
  const path = join3(outDir(a), `review-${version}.png`);
  writeGrid(path, sheet);
  writeRender(a, cur);
  const tokens = imageTokens(sheet.w, sheet.h);
  appendLedger(a.ledgerPath, { type: "review", asset: a.brief.id, version, pass: passOf(a, version), sheet: relPath(a, path), imageTokens: tokens, by: "agent" });
  return { path, tokens, render: cur };
}
async function scoreVersion(a, version, score, note = "", extra = {}) {
  const r = await renderVersion(a, version), v = parseVersion(version), pass = extra.blind === true ? "b" : passOf(a, version);
  const vs = versionsIn(a).filter((x) => parseVersion(x).kind === v.kind && parseVersion(x).n < v.n);
  const prevSrc = v.kind === "finish" ? void 0 : vs.length ? sourceOf(a, vs[vs.length - 1]) : void 0;
  const blind = extra.blind === true, reviews = ledgerFor(a).filter((e) => e.type === "review" && e.version === version && !!e.blind === blind);
  if (blind && !reviews.length) throw new Error(`${a.brief.id} ${version}: no blind sheet yet \u2014 artgen review ${a.brief.id} --version ${version} --blind, and give only that sheet to the reviewer`);
  if (v.kind === "finish" && r.patches) {
    const snap = join3(a.path, `${version}.snapshot.json`);
    if (!existsSync3(snap)) writeFileSync3(snap, JSON.stringify(finishSnapshot(r.patches)) + "\n");
  }
  const ledger = ledgerFor(a), prevTs = ledger.length ? Date.parse(ledger[ledger.length - 1].ts) : NaN;
  const scores = new Map(ledger.filter((e) => e.type === "score" && !e.blind && e.version).map((e) => [e.version, e.score]));
  const prevBase = versionsIn(a).filter((x) => parseVersion(x).kind === "base" && parseVersion(x).n < v.n && scores.has(x)).pop();
  const ref = blind ? void 0 : v.kind === "finish" ? r.base : prevBase, delta = ref && scores.has(ref) ? Math.round((score - scores.get(ref)) * 100) / 100 : void 0;
  const entry = {
    type: "score",
    asset: a.brief.id,
    version,
    pass,
    score,
    note,
    sourceHash: sourceHash(r.source),
    outputHash: r.strip.hash(),
    direction: { id: a.dir.id, version: a.dir.version },
    metrics: r.report.metrics,
    conformance: { pass: r.report.pass, checks: r.report.checks },
    ...r.base && { base: r.base },
    tokens: { code: codeTokens(r.source), edit: editTokens(prevSrc, r.source), ...extra.measured },
    imageTokens: reviews.length ? reviews[reviews.length - 1].imageTokens : void 0,
    by: "agent",
    ...stageModel(a, pass),
    ...Number.isFinite(prevTs) && { wallMs: Date.now() - prevTs },
    ...delta !== void 0 && { delta },
    ...blind && scores.has(version) && { gap: Math.round((scores.get(version) - score) * 100) / 100 },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "measured"))
  };
  appendLedger(a.ledgerPath, entry);
  return { ts: (/* @__PURE__ */ new Date()).toISOString(), ...entry };
}
async function passState(a) {
  const versions = versionsIn(a), finishBase = {};
  for (const v of versions) if (v.startsWith("finish.")) {
    const b = finishBaseOf(sourceOf(a, v));
    if (b) finishBase[v] = b;
  }
  const st = planPasses({
    asset: a.brief.id,
    versions,
    ledger: ledgerFor(a),
    revisionPasses: revisionPasses(a),
    finishPass: a.dir.pipeline.finishPass,
    finishBase,
    ...a.project && { feedback: feedbackOf(a), extraRevisions: a.budget?.extraRevisions ?? 0, ...blindConfig(a.project) }
  });
  const lastFinish = versions.filter((v) => v.startsWith("finish.")).pop();
  if (lastFinish && existsSync3(join3(a.path, `${lastFinish}.snapshot.json`))) {
    const stale = (await renderVersion(a, lastFinish)).stale;
    if (stale?.length) return { ...st, stale };
  }
  return st;
}
function blindConfig(p) {
  const r = projectConfig(p).review;
  return r.blind === false ? {} : { blind: { minScore: r.approveMin, maxGap: r.blindMaxGap } };
}
function stageModel(a, pass) {
  const m = (a.project ? projectConfig(a.project).models : void 0) ?? {};
  const pick2 = (k) => {
    const v = m[k];
    return typeof v === "string" ? { model: v, effort: "default" } : { model: String(v?.model ?? "default"), effort: String(v?.effort ?? "default") };
  };
  const st = pick2(stageKey(pass));
  return { model: st.model, effort: st.effort, reviewModel: pick2("review").model };
}
function anchorsFor(a) {
  if (!a.project || !a.dir.anchors?.length) return [];
  const all = a.dir.anchors.map((f) => ({ label: basename(f, ".png"), file: resolve2(a.project.art, f) })).filter((x) => existsSync3(x.file));
  const same = all.filter((x) => x.label === a.brief.kind || a.brief.kind === "creature" && x.label === "character" || ["tileset", "texture"].includes(a.brief.kind) && x.label === "tile");
  return (same.length ? same : all).map((x) => ({ label: `anchor ${x.label}`, grid: readGrid(x.file) }));
}
function finalHash(a, version) {
  const v = parseVersion(version);
  if (v.kind === "base") return sourceHash(sourceOf(a, version));
  const src = sourceOf(a, version), base = finishBaseOf(src);
  return sourceHash((base ? sourceOf(a, base) + "\n" : "") + src);
}
var CHARS_PER_TOKEN, codeTokens, revisionPasses, feedbackOf, passOf, versionsIn, sourceOf, rowLabel, relPath, stageKey;
var init_asset = __esm({
  "../artgen-cli/src/asset.ts"() {
    "use strict";
    init_src();
    init_bench();
    init_bench2();
    init_node();
    init_project();
    CHARS_PER_TOKEN = 3.5;
    codeTokens = (src) => Math.ceil(src.length / CHARS_PER_TOKEN);
    revisionPasses = (a) => a.budget?.revisionPasses ?? a.dir.pipeline.revisionPasses;
    feedbackOf = (a) => ledgerFor(a).filter((e) => e.type === "feedback" && e.by === "user" && typeof e.opens === "string").map((e) => ({
      route: e.route === "finish" ? "finish" : "base",
      opens: e.opens,
      ...typeof e.note === "string" && { note: e.note },
      ...Array.isArray(e.region) && { region: e.region },
      ...typeof e.cell === "string" && { cell: e.cell }
    }));
    passOf = (a, version) => passId(version, revisionPasses(a), a.project ? feedbackOf(a).map((f) => f.opens) : void 0);
    versionsIn = (a) => readdirSync(a.path).map((f) => parseVersion(f)?.name).filter((v) => !!v).sort((x, y) => {
      const a1 = parseVersion(x), b1 = parseVersion(y);
      return a1.kind === b1.kind ? a1.n - b1.n : a1.kind === "base" ? -1 : 1;
    });
    sourceOf = (a, version) => readFileSync3(join3(a.path, `${version}.js`), "utf8");
    rowLabel = (r, score) => `${r.version}${score !== void 0 ? ` (${score})` : ""} | hyg ${r.report.metrics.hygiene} col ${r.report.metrics.colors} orph ${r.report.metrics.orphanPct}% | gate ${r.report.pass ? "pass" : "FAIL"}${r.stale?.length ? " | FINISH-STALE" : ""}`;
    relPath = (a, p) => relative(dirname3(resolve2(a.ledgerPath)), resolve2(p)).split("\\").join("/");
    stageKey = (pass) => pass === "r1" ? "base" : pass.startsWith("f") ? "finish" : "revise";
  }
});

// ../artgen-cli/src/report.ts
var init_report = __esm({
  "../artgen-cli/src/report.ts"() {
    "use strict";
    init_src();
    init_asset();
    init_node();
  }
});

// ../artgen-cli/src/p6.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join4, relative as relative2 } from "node:path";
function textureRun(dir, name, o) {
  if (!MATERIALS.includes(name)) throw new Error(`unknown material ${name} (have: ${MATERIALS.join(", ")})`);
  const [w, h] = o.size, t = material(name, dirContext(dir), { w, h, seed: o.seed, ramps: o.ramps, scale: o.scale });
  const pre = new Grid(w * 3, h * 3);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) pre.blit(t.grid, i * w, j * h);
  const files = [join4(o.out, `${name}.png`), join4(o.out, `${name}.n.png`), join4(o.out, `${name}-3x3@4x.png`)];
  writeGrid(files[0], t.grid);
  writeGrid(files[1], t.normal);
  writeGrid(files[2], pre.scale(4));
  const repetition = repetitionMetric(t.grid);
  return { files: files.map((f) => relative2(process.cwd(), f)), seam: seamMetric(t.grid), repetition, issues: repetitionIssues(repetition), ramps: t.ramps };
}
function fxRun(dir, name, o) {
  const dc = dirContext(dir), [w, h] = o.size, fps = o.fps ?? dir.effects.fps, duration = o.frames * 1e3 / fps, sc = o.scale ?? 4;
  const line = dir.line.outer === "none" ? false : (g) => dir.line.outer === "selout" ? post_exports.selout(g, Object.values(dc.pal), dc.outline) : post_exports.outline(g, dc.outline);
  const layers = preset(name, { w, h, duration });
  const frames = Array.from({ length: o.frames }, (_, i) => particles(dc, { w, h, t: i / o.frames, duration, layers, seed: o.seed ?? 1, line }));
  mkdirSync3(o.out, { recursive: true });
  const strip2 = new Grid(o.frames * (w + 1) - 1, h);
  frames.forEach((f, i) => strip2.blit(f, i * (w + 1), 0));
  const files = [join4(o.out, `${name}.png`), join4(o.out, `${name}-onion@${sc}x.png`), join4(o.out, `${name}.gif`), join4(o.out, `${name}.apng`)];
  writeGrid(files[0], strip2);
  writeGrid(files[1], onionSkin(frames).scale(sc));
  const big = frames.map((f) => f.scale(sc)), d = frames.map(() => Math.round(1e3 / fps));
  writeFileSync4(files[2], encodeGIF(big, d));
  writeFileSync4(files[3], encodeAPNG(big, d));
  return { files: files.map((f) => relative2(process.cwd(), f)), fill: fillQA(frames, dir), frames: o.frames };
}
var init_p6 = __esm({
  "../artgen-cli/src/p6.ts"() {
    "use strict";
    init_src();
    init_node();
    init_asset();
  }
});

// ../artgen-cli/src/templates.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync5 } from "node:fs";
import { dirname as dirname4, join as join5, resolve as resolve3 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
function templatesRoot() {
  const here = dirname4(fileURLToPath3(import.meta.url));
  for (const p of [join5(here, "templates"), join5(here, "..", "templates")]) if (existsSync4(join5(p, "finish.js"))) return p;
  throw new Error(`artgen templates not found next to ${here}`);
}
function findTemplate(view, kind) {
  const root = templatesRoot(), alias = KIND_ALIAS[kind] ?? kind;
  for (const [v, k] of [[view, kind], ["topdown", kind], [view, alias], ["topdown", alias], [view, "prop"], ["topdown", "prop"]]) {
    const dir = join5(root, v, k);
    if (existsSync4(join5(dir, "base.js"))) return { view: v, kind: k, dir, fallback: v !== view || k !== kind };
  }
  throw new Error(`no template for ${view}/${kind}`);
}
function newFinish(path, n, base, kind) {
  const file = join5(path, `finish.v${n}.js`);
  if (existsSync4(file)) throw new Error(`${file} exists`);
  if (kind === void 0 && existsSync4(join5(path, "brief.json"))) kind = JSON.parse(readFileSync4(join5(path, "brief.json"), "utf8")).kind;
  writeFileSync5(file, fill(readFileSync4(finishTemplate(kind), "utf8"), { BASE: base, N: String(n) }));
  return resolve3(file);
}
var KIND_ALIAS, fill, FACE_KINDS, finishTemplate;
var init_templates = __esm({
  "../artgen-cli/src/templates.ts"() {
    "use strict";
    KIND_ALIAS = { creature: "character", tileset: "tile", texture: "tile", viewmodel: "prop", "ui-icon": "prop" };
    fill = (text2, vars) => text2.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
    FACE_KINDS = /* @__PURE__ */ new Set(["character", "creature"]);
    finishTemplate = (kind) => join5(templatesRoot(), kind && FACE_KINDS.has(kind) ? "finish-character.js" : "finish.js");
  }
});

// ../artgen-runtime/src/autotile.ts
function reduceCorners2(m) {
  let r = m & (N2 | E2 | S2 | W2);
  if (m & NE2 && m & N2 && m & E2) r |= NE2;
  if (m & SE2 && m & S2 && m & E2) r |= SE2;
  if (m & SW2 && m & S2 && m & W2) r |= SW2;
  if (m & NW2 && m & N2 && m & W2) r |= NW2;
  return r;
}
var N2, NE2, E2, SE2, S2, SW2, W2, NW2, BLOB472, BLOB_INDEX;
var init_autotile2 = __esm({
  "../artgen-runtime/src/autotile.ts"() {
    "use strict";
    N2 = 1;
    NE2 = 2;
    E2 = 4;
    SE2 = 8;
    S2 = 16;
    SW2 = 32;
    W2 = 64;
    NW2 = 128;
    BLOB472 = [...new Set(Array.from({ length: 256 }, (_, m) => reduceCorners2(m)))].sort((a, b) => a - b);
    BLOB_INDEX = new Map(BLOB472.map((m, i) => [m, i]));
  }
});

// ../artgen-runtime/src/facing.ts
var TAU;
var init_facing = __esm({
  "../artgen-runtime/src/facing.ts"() {
    "use strict";
    TAU = Math.PI * 2;
  }
});

// ../artgen-runtime/src/stack.ts
var init_stack = __esm({
  "../artgen-runtime/src/stack.ts"() {
    "use strict";
  }
});

// ../artgen-runtime/src/pack.ts
var RUNTIME_VERSION;
var init_pack2 = __esm({
  "../artgen-runtime/src/pack.ts"() {
    "use strict";
    init_autotile2();
    init_facing();
    init_stack();
    RUNTIME_VERSION = "1.2.1";
  }
});

// ../artgen-runtime/src/coords.ts
var init_coords = __esm({
  "../artgen-runtime/src/coords.ts"() {
    "use strict";
  }
});

// ../artgen-runtime/src/index.ts
var init_src2 = __esm({
  "../artgen-runtime/src/index.ts"() {
    "use strict";
    init_pack2();
    init_facing();
    init_autotile2();
    init_stack();
    init_coords();
  }
});

// ../artgen-cli/src/runtime.ts
import { createHash } from "node:crypto";
import { existsSync as existsSync5, mkdirSync as mkdirSync5, readdirSync as readdirSync2, readFileSync as readFileSync5, rmSync, writeFileSync as writeFileSync6 } from "node:fs";
import { dirname as dirname5, join as join6, relative as relative3 } from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
function runtimeRoot() {
  const here = dirname5(fileURLToPath4(import.meta.url));
  for (const p of [join6(here, "runtime"), join6(here, "..", "..", "artgen-runtime", "src")]) if (existsSync5(join6(p, "pack.ts"))) return p;
  throw new Error(`artgen runtime sources not found next to ${here}`);
}
function runtimeFiles(adapters, root = runtimeRoot()) {
  const ts = (d) => existsSync5(d) ? readdirSync2(d).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "testkit.ts" && f !== "contract.ts") : [];
  const available = ts(join6(root, "adapters")).map((f) => f.replace(/\.ts$/, ""));
  for (const a of adapters) if (!available.includes(a)) throw new Error(`unknown runtime adapter "${a}" in artgen.config.json (available: ${available.join(", ")})`);
  return [...ts(root).sort(), ...[...new Set(adapters)].map((a) => `adapters/${a}.ts`)];
}
function vendorRuntime(p, o = {}) {
  const cfg = projectConfig(p), root = runtimeRoot(), adapters = cfg.runtime.adapters, files = runtimeFiles(adapters, root);
  const dir = join6(p.root, cfg.export.runtimeDir), stampFile = join6(dir, STAMP);
  const old = existsSync5(stampFile) ? readJson(stampFile) : null;
  const generator = o.generator ?? "artgen";
  const r = { dir: relative3(p.root, dir).split("\\").join("/"), version: RUNTIME_VERSION, from: old?.runtime ?? null, adapters, written: [], unchanged: [], kept: [], removed: [] };
  const hashes = {};
  const edited = (f) => {
    const dest = join6(dir, f);
    return existsSync5(dest) && old?.files[f] !== void 0 && sha(readFileSync5(dest, "utf8")) !== old.files[f];
  };
  for (const f of files) {
    const text2 = vendoredSource(f, root), h = sha(text2), dest = join6(dir, f);
    if (existsSync5(dest)) {
      const cur = sha(readFileSync5(dest, "utf8"));
      if (cur === h) {
        r.unchanged.push(f);
        hashes[f] = h;
        continue;
      }
      if (!o.force && (old?.files[f] === void 0 || edited(f))) {
        r.kept.push(f);
        hashes[f] = old?.files[f] ?? cur;
        continue;
      }
    }
    mkdirSync5(dirname5(dest), { recursive: true });
    writeFileSync6(dest, text2);
    r.written.push(f);
    hashes[f] = h;
  }
  for (const f of Object.keys(old?.files ?? {})) {
    if (files.includes(f) || !existsSync5(join6(dir, f))) continue;
    if (!o.force && edited(f)) {
      r.kept.push(f);
      hashes[f] = old.files[f];
      continue;
    }
    rmSync(join6(dir, f));
    r.removed.push(f);
  }
  writeJson(stampFile, { runtime: RUNTIME_VERSION, generator, adapters, files: hashes });
  return r;
}
var STAMP, sha, HEADER, vendoredSource;
var init_runtime = __esm({
  "../artgen-cli/src/runtime.ts"() {
    "use strict";
    init_src2();
    init_project();
    STAMP = "runtime.json";
    sha = (s2) => createHash("sha256").update(s2).digest("hex").slice(0, 16);
    HEADER = `// Vendored by \`artgen export --runtime\` (artgen-runtime ${RUNTIME_VERSION}). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
`;
    vendoredSource = (file, root = runtimeRoot()) => HEADER + readFileSync5(join6(root, file), "utf8");
  }
});

// ../artgen-cli/src/w1.ts
import { existsSync as existsSync6, readdirSync as readdirSync3, readFileSync as readFileSync6 } from "node:fs";
import { basename as basename2, join as join7, relative as relative4 } from "node:path";
function directionVersion(p, version) {
  const f = directionFile(p, version);
  if (existsSync6(f)) return parseDirection(readJson(f));
  const cur = lockedDirection(p);
  if (cur?.version === version) return cur;
  throw new Error(`direction v${version} is not archived (art/directions/v${version}.json) \u2014 directions locked by older artgen versions are archived on the next lock`);
}
function candidateNames(p) {
  if (!existsSync6(cdir(p))) return [];
  return readdirSync3(cdir(p)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort((x, y) => (x.length === 1 ? 0 : 1) - (y.length === 1 ? 0 : 1) || x.localeCompare(y, "en", { numeric: true }));
}
function loadCandidate(p, name) {
  const file = existsSync6(join7(cdir(p), `${name}.json`)) ? join7(cdir(p), `${name}.json`) : name;
  if (!existsSync6(file)) throw new Error(`no candidate ${name} (have: ${candidateNames(p).join(", ") || "none \u2014 run direction candidates"})`);
  return parseDirection(readJson(file));
}
function lockedDirection(p) {
  const f = join7(p.art, "direction.json");
  if (!existsSync6(f)) return null;
  const raw = readJson(f);
  return isPlaceholderDirection(raw) ? null : parseDirection(raw);
}
function probeVersion(a) {
  const vs = versionsIn(a);
  if (!vs.length) throw new Error(`${a.path}: no base.vN.js`);
  return [...vs].reverse().find((v) => v.startsWith("finish.")) ?? vs.filter((v) => v.startsWith("base.")).pop();
}
function probeAsset(p, kind, dir) {
  const path = probeDir(p, kind), brief = readJson(join7(path, "brief.json"));
  return { path, brief: { ...brief, id: brief.id ?? `probe-${kind}` }, dir, ledgerPath: ledgerPath(p) };
}
async function renderProbes(p, dir, opts = {}) {
  const renders = {};
  for (const kind of PROBE_KINDS) {
    const a = probeAsset(p, kind, dir);
    renders[kind] = await renderVersion(a, opts.versions?.[kind] ?? probeVersion(a));
  }
  const cell = (k) => renders[k].render.cells[0].grid;
  const images = { character: cell("character"), prop: cell("prop"), tile: cell("tile"), effect: renders.effect.render.cells.map((c) => c.grid) };
  return { renders, images };
}
async function writeTile(p, names) {
  const list = names?.length ? names : candidateNames(p);
  if (!list.length) throw new Error("no candidates \u2014 run `artgen direction candidates` first");
  const columns = [], info = [], hashes = [];
  for (const name of list) {
    const dir = loadCandidate(p, name), { renders, images } = await renderProbes(p, dir);
    const gates = Object.fromEntries(Object.entries(renders).map(([k, r]) => [k, r.report.pass]));
    const failing = Object.entries(renders).flatMap(([k, r]) => r.report.checks.filter((c) => c.status === "fail").map((c) => `${k}.${c.id}: ${c.detail}`));
    columns.push({ label: `${name.length === 1 ? name.toUpperCase() : name} - ${dir.id}`, notes: describeDirection(dir), dir, probes: images, gates });
    info.push({ name, id: dir.id, gates, failing });
    hashes.push(images.character.hash() + images.prop.hash());
  }
  const versions = PROBE_KINDS.map((k) => `${k} ${probeVersion(probeAsset(p, k, loadCandidate(p, list[0])))}`).join(", ");
  const round2 = (existsSync6(cdir(p)) ? readdirSync3(cdir(p)).filter((f) => /^style-tile-r\d+\.png$/.test(f)).length : 0) + 1;
  const sheet = styleTile(`style tile round ${round2}: ${versions}`, columns);
  const path = join7(cdir(p), `style-tile-r${round2}.png`);
  writeGrid(path, sheet);
  const tokens = imageTokens(sheet.w, sheet.h);
  appendLedger(ledgerPath(p), { type: "review", asset: "direction", version: `tile-r${round2}`, sheet: relative4(p.art, path).split("\\").join("/"), imageTokens: tokens, candidates: list, by: "agent" });
  const dirs = list.map((n) => loadCandidate(p, n)), lumas = dirs.map(paletteLuma);
  let minGap = Infinity;
  for (let i = 0; i < lumas.length; i++) for (let j = i + 1; j < lumas.length; j++) minGap = Math.min(minGap, Math.abs(lumas[i] - lumas[j]));
  return { path: rel(p, path), round: round2, tokens, columns: info, distinct: { pairs: new Set(hashes).size, minLumaGap: Number.isFinite(minGap) ? Math.round(minGap * 10) / 10 : 0 } };
}
var cdir, probeDir, ledgerPath, rel, directionFile;
var init_w1 = __esm({
  "../artgen-cli/src/w1.ts"() {
    "use strict";
    init_src();
    init_asset();
    init_node();
    init_project();
    init_templates();
    cdir = (p) => join7(p.art, "candidates");
    probeDir = (p, kind) => join7(p.art, "probes", kind);
    ledgerPath = (p) => join7(p.art, "ledger.jsonl");
    rel = (p, f) => relative4(p.root, f).split("\\").join("/");
    directionFile = (p, version) => join7(p.art, "directions", `v${version}.json`);
  }
});

// ../artgen-cli/src/w2.ts
import { copyFileSync, existsSync as existsSync7, mkdirSync as mkdirSync6, readdirSync as readdirSync4, readFileSync as readFileSync7, writeFileSync as writeFileSync7 } from "node:fs";
import { dirname as dirname6, join as join8, relative as relative5, resolve as resolve4 } from "node:path";
function readBriefs(p) {
  if (!existsSync7(briefsFile(p))) return [];
  const r = parseBriefs(readFileSync7(briefsFile(p), "utf8"));
  if (!r.ok) throw new Error(`art/briefs.yaml:
  ${r.errors.join("\n  ")}`);
  return r.briefs;
}
function readContract(p, id) {
  return existsSync7(contractFile(p, id)) ? readJson(contractFile(p, id)) : void 0;
}
function scaffoldAsset(p, b, dir) {
  const path = assetPathOf(p, b), view = b.view ?? dir.camera.view;
  const walker = ["character", "creature"].includes(b.kind) && ((b.directions ?? 1) > 1 || !!b.anims?.walk);
  const t = walker ? findTemplate(view, "character-walk") : findTemplate(view, b.kind), template = `${t.view}/${t.kind}`;
  if (existsSync7(join8(path, "base.v1.js"))) return { path, created: false, template };
  mkdirSync6(path, { recursive: true });
  const tb = readJson(join8(t.dir, "brief.json"));
  if (!existsSync7(join8(path, "brief.json"))) writeJson(join8(path, "brief.json"), { id: b.id, template, review: tb.review ?? {} });
  writeFileSync7(join8(path, "base.v1.js"), readFileSync7(join8(t.dir, "base.js"), "utf8").replace(/\{\{ID\}\}/g, b.id));
  return { path, created: true, template };
}
async function assetRow(p, b) {
  const path = assetPathOf(p, b);
  const base = { id: b.id, kind: b.kind, path: rel2(p, path), issues: effectObjectIssues(b).map((x) => `brief: ${x}`), imageTokens: 0 };
  if (!existsSync7(join8(path, "base.v1.js")) && !versionsInPath(path).length) return { ...base, status: "brief", why: "not started" };
  const a = openAsset(path), st = await passState(a), ledger = ledgerFor(a);
  const imageTokens2 = ledger.filter((e) => e.type === "review").reduce((n, e) => n + (e.imageTokens ?? 0), 0);
  if (!ledger.length && st.next.action === "review" && st.next.version === "base.v1") return { ...base, status: "in-pipeline", next: st.next, why: "base.v1 from the template: adapt it to the brief, then review", imageTokens: imageTokens2 };
  const fh = st.next.action === "ready" ? finalHash(a, st.next.final) : void 0;
  const s2 = assetStatus({ ledger, next: st.next, direction: { id: a.dir.id, version: a.dir.version }, finalHash: fh });
  const sc = s2.final ? [...ledger].reverse().find((e) => e.type === "score" && !e.blind && e.version === s2.final) : void 0;
  const ro = s2.final ? [...ledger].reverse().find((e) => e.type === "roster" && e.version === s2.final && Array.isArray(e.issues)) : void 0;
  const issues = [...effectObjectIssues(b).map((x) => `brief: ${x}`), ...s2.issues, ...(st.stale ?? []).map((x) => `finish-stale ${x}`), ...ro?.issues ?? []];
  return { ...base, status: s2.status, final: s2.final, score: sc?.score, gate: sc?.conformance?.pass, issues, next: st.next, why: s2.why, imageTokens: imageTokens2, stale: st.stale };
}
async function projectStatus(p, ids2) {
  requireLocked(p);
  const rows = [];
  for (const b of briefOrder(readBriefs(p))) if (!ids2?.length || ids2.includes(b.id)) rows.push(await assetRow(p, b));
  return rows;
}
function requireLocked(p) {
  const d = lockedDirection(p);
  if (!d) throw new Error("no locked direction yet \u2014 run the art direction workflow first (`artgen direction lock <candidate>`)");
  return d;
}
function workPacket(row) {
  const st = row.next;
  if (!st || st.action === "ready") return void 0;
  const owns = row.path, base = { id: row.id, kind: row.kind, owns, step: st };
  if (st.action === "write-base" || st.action === "write-finish") return { ...base, writes: [`${owns}/${st.version}.js`], role: "maker" };
  if (st.action === "review" && st.version === "base.v1" && /^base\.v1 from the template/.test(row.why)) return { ...base, writes: [`${owns}/base.v1.js`], role: "maker" };
  return { ...base, writes: [], role: "main" };
}
async function make(p, ids2, o = {}) {
  const dir = requireLocked(p), briefs = briefOrder(readBriefs(p)).filter((b) => !ids2?.length || ids2.includes(b.id) || ids2.includes("all"));
  if (ids2?.length && !ids2.includes("all")) {
    for (const id of ids2) if (!briefs.some((b) => b.id === id)) throw new Error(`no brief ${id} in art/briefs.yaml`);
  }
  const scaffolded = [], finals = [], overBudget = [], rows = [];
  let next;
  for (const b of briefs) {
    const sc = scaffoldAsset(p, b, dir);
    if (sc.created) scaffolded.push(rel2(p, join8(sc.path, "base.v1.js")));
    let row = await assetRow(p, b);
    const a = openAsset(sc.path), ledger = ledgerFor(a);
    if (row.next?.action === "ready") {
      const fin = row.next.final;
      if (!ledger.some((e) => e.type === "status" && e.status === "final" && e.version === fin && e.sourceHash === finalHash(a, fin))) {
        appendLedger(ledgerFile(p), { type: "status", asset: b.id, status: "final", version: fin, sourceHash: finalHash(a, fin), issues: row.issues, direction: { id: dir.id, version: dir.version }, by: "agent" });
        finals.push(b.id);
      }
    } else if (row.next && a.budget?.maxImageTokens && row.imageTokens >= a.budget.maxImageTokens) {
      const st = await passState(a), best = st.rows.filter((r) => r.score !== void 0).sort((x, y) => y.score - x.score)[0];
      if (best && !ledger.some((e) => e.type === "status" && e.status === "final" && e.version === best.version)) {
        appendLedger(ledgerFile(p), { type: "status", asset: b.id, status: "final", version: best.version, sourceHash: finalHash(a, best.version), issues: [`budget: ${row.imageTokens} review-image tokens \u2265 ${a.budget.maxImageTokens}`], direction: { id: dir.id, version: dir.version }, by: "agent" });
        overBudget.push(b.id);
      }
      row = { ...row, why: `over budget (${row.imageTokens} image tokens); left at ${best?.version ?? "nothing scored"}` };
      rows.push(row);
      continue;
    }
    rows.push(row);
    if (!next && row.next && row.next.action !== "ready") next = { id: b.id, path: row.path, step: row.next };
  }
  if (!o.parallel) return { rows, next, scaffolded, finals, overBudget };
  const packets = rows.filter((r) => !r.why.startsWith("over budget")).map(workPacket).filter((x) => !!x), makers = packets.filter((x) => x.role === "maker");
  return { rows, next, scaffolded, finals, overBudget, work: { makers: makers.slice(0, o.parallel), queued: makers.slice(o.parallel), main: packets.filter((x) => x.role === "main") } };
}
function thumb(r) {
  const f = r.facings[0], cells = r.cells.filter((c) => c.facing === f);
  return cells.length > 1 ? strip({ ...r, cells }) : cells[0].grid;
}
function reviewOf(a, final) {
  const ledger = ledgerFor(a), own = [...ledger].reverse().find((e) => e.type === "score" && !e.blind && e.version === final);
  return { reviewer: typeof own?.reviewer === "string" ? own.reviewer : void 0, blind: blindScores(ledger).get(final)?.score };
}
async function gallery(p, opts = {}) {
  const dir = requireLocked(p), want = opts.statuses ?? ["final"], rows = (await projectStatus(p, opts.ids)).filter((r) => r.final && (opts.ids?.length || want.includes(r.status)));
  const items = [], assets = [];
  for (const r of rows) {
    const a = openAsset(join8(p.root, r.path)), v = await renderVersion(a, r.final);
    const rv = reviewOf(a, r.final);
    const tag = `${r.id} ${r.final} ${r.score ?? "-"}${rv.blind !== void 0 ? ` b${rv.blind}` : rv.reviewer === "self" ? " SELF" : ""}${r.gate === false ? " GATE" : ""}${r.issues.length ? ` !${r.issues.length}` : ""}`;
    items.push({ label: tag, grid: thumb(v.render), bg: a.brief.review?.bg ?? dir.background });
    assets.push({ id: r.id, final: r.final, score: r.score, ...rv.blind !== void 0 && { blind: rv.blind }, ...rv.reviewer && { reviewer: rv.reviewer }, issues: r.issues });
  }
  if (!items.length) return { sheets: [], tokens: 0, assets };
  const sheets = [];
  let tokens = 0;
  const n0 = (existsSync7(join8(p.art, "sheets")) ? readdirCount(join8(p.art, "sheets"), /^gallery-\d+\.png$/) : 0) + 1;
  for (let i = 0; i < items.length; i += 12) {
    const page = items.slice(i, i + 12), sheet = contactSheet(`${dir.id} v${dir.version}: finished assets ${i + 1}-${i + page.length} of ${items.length} (score, b blind score, !issues)`, page, 4, Math.min(4, page.length));
    const f = join8(p.art, "sheets", `gallery-${n0 + i / 12}.png`);
    writeGrid(f, sheet);
    sheets.push(rel2(p, f));
    tokens += imageTokens(sheet.w, sheet.h);
  }
  appendLedger(ledgerFile(p), { type: "review", asset: "gallery", sheet: sheets.join(","), imageTokens: tokens, assets: assets.map((x) => x.id), by: "agent" });
  return { sheets, tokens, assets };
}
async function feedback(p, id, o) {
  const b = readBriefs(p).find((x) => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  requireLocked(p);
  const row = await assetRow(p, b);
  if (!["final", "approved", "exported", "stale"].includes(row.status)) throw new Error(`${id} is ${row.status}: feedback applies to finished assets (wait for final)`);
  const a = openAsset(assetPathOf(p, b)), iterations = feedbackOf(a).length + 1, max2 = a.budget?.maxUserIterations ?? 3;
  if (iterations > max2 && !o.force) throw new Error(`${id}: ${iterations - 1} user iterations already (budget.maxUserIterations ${max2}) \u2014 escalate: talk it through with the user, or pass --force`);
  const vs = versionsIn(a), kind = o.route === "base" ? "base" : "finish";
  const opens = `${kind}.v${Math.max(0, ...vs.map(parseVersion).filter((v) => v.kind === kind).map((v) => v.n)) + 1}`;
  appendLedger(ledgerFile(p), { type: "feedback", asset: id, route: o.route, opens, on: row.final, note: o.note, ...o.region && { region: o.region }, ...o.cell && { cell: o.cell }, by: "user" });
  return { opens, next: (await passState(openAsset(assetPathOf(p, b)))).next, iterations };
}
async function approve(p, id, note = "") {
  const b = readBriefs(p).find((x) => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  const dir = requireLocked(p), row = await assetRow(p, b);
  if (row.status !== "final") throw new Error(`${id} is ${row.status}: only a final asset can be approved${row.status === "stale" ? " (run restyle first)" : ""}`);
  const a = openAsset(assetPathOf(p, b)), r = await renderVersion(a, row.final);
  if (!r.report.pass) throw new Error(`${id} ${row.final}: the gate fails (${r.report.checks.filter((c) => c.status === "fail").map((c) => c.id).join(", ")}) \u2014 give feedback instead (R6)`);
  const sheet = [...ledgerFor(a)].reverse().find((e2) => e2.type === "review" && e2.version === row.final)?.sheet;
  if (!sheet) throw new Error(`${id} ${row.final}: no review sheet yet \u2014 artgen review first (R6)`);
  const kept = join8(p.art, "sheets", "approved", `${id}-${row.final}.png`), src = resolve4(dirname6(ledgerFile(p)), String(sheet));
  if (existsSync7(src)) {
    mkdirSync6(dirname6(kept), { recursive: true });
    copyFileSync(src, kept);
  }
  const rv = reviewOf(a, row.final), cfg = projectConfig(p).review, warnings = [];
  if (rv.blind === void 0) warnings.push(rv.reviewer === "self" || !rv.reviewer ? "scored only by the agent that made it, with no blind re-score" : "no blind re-score of the final");
  warnings.push(...row.issues.filter((x) => x.startsWith("blind re-score")));
  if (rv.blind !== void 0 && rv.blind < cfg.approveMin && !warnings.some((x) => x.startsWith("blind re-score"))) warnings.push(`blind re-score ${rv.blind} is under ${cfg.approveMin}`);
  const e = { type: "approve", asset: id, version: row.final, sourceHash: finalHash(a, row.final), outputHash: r.strip.hash(), sheet: existsSync7(kept) ? relative5(p.art, kept).split("\\").join("/") : sheet, direction: { id: dir.id, version: dir.version }, note, ...warnings.length && { warnings }, by: "user" };
  appendLedger(ledgerFile(p), e);
  return { ts: (/* @__PURE__ */ new Date()).toISOString(), ...e };
}
async function writeNextFinish(path, o = {}) {
  const vs = versionsIn({ path }), n = vs.filter((v) => v.startsWith("finish.")).length + 1;
  let base = o.base;
  if (!base) {
    const st = await (async () => {
      try {
        return await passState(openAsset(path, o));
      } catch {
        return void 0;
      }
    })();
    base = st?.next.action === "write-finish" ? st.next.base : st?.best?.version ?? vs.filter((v) => v.startsWith("base.")).pop();
  }
  if (!base) throw new Error(`${path}: no base version to finish`);
  const kind = (() => {
    try {
      return openAsset(path, o).brief.kind;
    } catch {
      return void 0;
    }
  })();
  return { file: newFinish(path, n, base, kind), base };
}
function inPack(b, pack, include) {
  if (b.pack) return b.pack === pack;
  return include.some((pat) => pat.startsWith("kind:") ? b.kind === pat.slice(5) : new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(b.id));
}
async function exportPacks(p, o = {}) {
  const dir = requireLocked(p), cfg = projectConfig(p), rows = await projectStatus(p), briefs = readBriefs(p);
  const ok = (s2) => s2 === "approved" || s2 === "exported" || o.includeDrafts && s2 === "final";
  const skipped = rows.filter((r) => !ok(r.status)).map((r) => ({ id: r.id, status: r.status }));
  const out = [], forTs = [];
  const builds = [];
  for (const [pack, def] of Object.entries(cfg.packs)) {
    if (o.packs?.length && !o.packs.includes(pack)) continue;
    const inputs = [];
    for (const r of rows) {
      const b = briefs.find((x) => x.id === r.id);
      if (!ok(r.status) || !inPack(b, pack, def.include)) continue;
      const a = openAsset(join8(p.root, r.path)), n = Math.max(1, b.variants ?? 1), renders = [];
      for (let k = 0; k < n; k++) renders.push((await renderVersion(a, r.final, { variant: k })).render);
      inputs.push({ brief: a.brief, view: a.brief.view ?? dir.camera.view, renders, version: r.final, sourceHash: finalHash(a, r.final), draft: r.status === "final" });
    }
    if (!inputs.length) continue;
    builds.push({ pack, inputs, built: buildPack(pack, dir, inputs, { generator: o.generator, runtime: RUNTIME_VERSION, maxSize: cfg.export.maxAtlas, padding: cfg.export.padding }) });
  }
  const contracts = [], refused = [], seen = /* @__PURE__ */ new Set();
  for (const { built } of builds) for (const [id, a] of Object.entries(built.manifest.assets)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const next = contractOf(id, a), old = readContract(p, id);
    if (!old) {
      contracts.push({ next, change: { id, change: "created", notes: [] } });
      continue;
    }
    const d = diffContract(old, next);
    if (d.breaking.length && !allowed(o.breakContract, id)) refused.push(`${id}: ${d.breaking.join("; ")}`);
    else if (d.breaking.length || d.added.length) contracts.push({ next, change: { id, change: d.breaking.length ? "broken" : "extended", notes: [...d.breaking, ...d.added.map((x) => `added ${x}`)] } });
  }
  if (refused.length) throw new Error(`export refused: the animation contract changed for
  ${refused.join("\n  ")}
game code indexes these states and frames (art/contracts/<id>.json). Restore the brief's anims/states/directions and the base's anchors, or re-run with --break-contract <id> once the game code is updated`);
  for (const { pack, built, inputs } of builds) {
    const pdir = join8(p.root, cfg.export.packDir, pack);
    built.atlases.forEach((g, i) => {
      writeGrid(join8(pdir, built.manifest.atlases[i]), g);
      writeJson(join8(pdir, built.manifest.atlases[i].replace(/\.png$/, ".aseprite.json")), built.aseprite[i]);
    });
    built.normals?.forEach((g, i) => writeGrid(join8(pdir, built.manifest.normals[i]), g));
    writeJson(join8(pdir, "pack.json"), built.manifest);
    for (const inp of inputs) appendLedger(ledgerFile(p), { type: "export", asset: inp.brief.id, version: inp.version, sourceHash: inp.sourceHash, pack, direction: { id: dir.id, version: dir.version }, ...inp.draft && { draft: true }, by: "agent" });
    out.push({ pack, dir: rel2(p, pdir), atlases: built.manifest.atlases.map((f) => rel2(p, join8(pdir, f))), assets: inputs.map((i) => i.brief.id), drafts: built.manifest.drafts ?? [] });
    const pub = cfg.export.packDir.replace(/\\/g, "/").replace(/^\.?\/?/, "");
    forTs.push({ manifest: built.manifest, url: pub.startsWith("public/") || pub === "public" ? `/${pub.slice(7)}${pub.length > 7 ? "/" : ""}${pack}/pack.json`.replace(/\/+/g, "/") : `${pub}/${pack}/pack.json` });
  }
  for (const { next, change } of contracts) {
    writeJson(contractFile(p, next.asset), next);
    appendLedger(ledgerFile(p), { type: "contract", asset: next.asset, change: change.change, ...change.notes.length && { notes: change.notes }, by: "agent" });
  }
  const tsFile = join8(p.root, cfg.export.assetsTs);
  if (forTs.length) {
    mkdirSync6(dirname6(tsFile), { recursive: true });
    writeFileSync7(tsFile, assetsTs(forTs));
  }
  const runtime = o.runtime ? vendorRuntime(p, { force: o.force, generator: o.generator }) : void 0;
  return { packs: out, assetsTs: forTs.length ? rel2(p, tsFile) : "", skipped, contracts: contracts.map((c) => c.change), ...runtime && { runtime } };
}
async function restyle(p, o = {}) {
  const to = requireLocked(p), from = directionVersion(p, o.from ?? to.version - 1);
  if (from.version === to.version) throw new Error(`nothing to restyle: direction is v${to.version}`);
  const rows = (await projectStatus(p)).filter((r) => r.final), sheetRows = [], assets = [];
  const fromFile = join8(p.art, "directions", `v${from.version}.json`);
  for (const r of rows) {
    const path = join8(p.root, r.path), a = openAsset(path), old = openAsset(path, { direction: existsSync7(fromFile) ? fromFile : void 0 });
    if (!existsSync7(fromFile)) old.dir = from;
    const [before, after] = [await renderVersion(old, r.final), await renderVersion(a, r.final)];
    const d = restyleDiff(before.strip, after.strip, from, to);
    sheetRows.push({ label: `${r.id} ${r.final}: ${d.changedPct}% px changed, tokens kept ${Math.round(d.tokenSame * 100)}%${after.report.pass ? "" : " GATE FAIL"}${after.stale?.length ? " FINISH-STALE" : ""}`, before: thumb(before.render), after: thumb(after.render), mask: tokenDiffMask(thumb(before.render), thumb(after.render), from, to), bg: to.background });
    assets.push({ id: r.id, final: r.final, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, stale: after.stale ?? [] });
    appendLedger(ledgerFile(p), { type: "restyle", asset: r.id, version: r.final, from: { id: from.id, version: from.version }, direction: { id: to.id, version: to.version }, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, outputHash: after.strip.hash(), ...after.stale?.length && { stale: after.stale }, by: "agent" });
  }
  const sheet = restyleSheet(`restyle ${from.id} v${from.version} -> ${to.id} v${to.version}`, sheetRows);
  const f = join8(p.art, "sheets", `restyle-v${from.version}-v${to.version}.png`);
  writeGrid(f, sheet);
  return { from: from.version, to: to.version, sheet: rel2(p, f), tokens: imageTokens(sheet.w, sheet.h), assets };
}
function projectAnalytics(p, title) {
  const dir = requireLocked(p), all = parseAll(ledgerFile(p)), metas = projectMetas(p, dir);
  const ids2 = new Set(metas.map((m) => m.id)), report2 = analytics(all.filter((e) => ids2.has(e.asset) || e.asset === "gallery"), metas);
  return { report: report2, markdown: analyticsMarkdown(report2, title ?? `${dir.id}: pipeline analytics`) };
}
function projectMetas(p, dir) {
  return readBriefs(p).map((b) => {
    const bj = join8(assetPathOf(p, b), "brief.json"), local = existsSync7(bj) ? readJson(bj) : {};
    const size = Array.isArray(b.size) ? b.size.join("x") : b.size ?? b.kind;
    return { id: b.id, kind: b.kind, view: b.view ?? dir?.camera.view, size, template: local.template, importance: b.importance ?? "standard" };
  });
}
var briefsFile, ledgerFile, rel2, contractFile, allowed, assetPathOf, versionsInPath, readdirCount, parseAll;
var init_w2 = __esm({
  "../artgen-cli/src/w2.ts"() {
    "use strict";
    init_src();
    init_asset();
    init_bench2();
    init_src2();
    init_node();
    init_runtime();
    init_project();
    init_templates();
    init_w1();
    briefsFile = (p) => join8(p.art, "briefs.yaml");
    ledgerFile = (p) => join8(p.art, "ledger.jsonl");
    rel2 = (p, f) => relative5(p.root, f).split("\\").join("/");
    contractFile = (p, id) => join8(p.art, "contracts", `${id}.json`);
    allowed = (list, id) => !!list && (list.includes("*") || list.includes(id));
    assetPathOf = (p, b) => join8(p.art, briefDir(b));
    versionsInPath = (path) => existsSync7(path) ? versionsIn({ path }) : [];
    readdirCount = (d, re) => readdirSync4(d).filter((f) => re.test(f)).length;
    parseAll = (f) => existsSync7(f) ? parseLedger(readFileSync7(f, "utf8")) : [];
  }
});

// ../artgen-cli/src/cli.ts
var VERSION;
var init_cli = __esm({
  "../artgen-cli/src/cli.ts"() {
    "use strict";
    init_src();
    init_asset();
    init_bench2();
    init_node();
    init_project();
    init_p6();
    init_report();
    init_templates();
    init_w2();
    init_src();
    init_w1();
    VERSION = true ? "0.9.0" : "dev";
  }
});

// ../artgen-cli/src/index.ts
var init_src3 = __esm({
  "../artgen-cli/src/index.ts"() {
    "use strict";
    init_node();
    init_bench2();
    init_asset();
    init_report();
    init_cli();
    init_p6();
    init_project();
    init_templates();
    init_w1();
    init_w2();
    init_runtime();
  }
});

// ../artgen-mcp/src/server.ts
var server_exports = {};
__export(server_exports, {
  SERVER: () => SERVER,
  TOOLS: () => TOOLS,
  assetPath: () => assetPath,
  handle: () => handle,
  serve: () => serve
});
import { existsSync as existsSync8, readdirSync as readdirSync5, readFileSync as readFileSync8 } from "node:fs";
import { isAbsolute, join as join9, relative as relative6, resolve as resolve5 } from "node:path";
function assetPath(p, arg) {
  if (typeof arg !== "string" || !arg) throw new Error('asset: required (e.g. "art/probes/character", "assets/character/goblin" or a brief id)');
  const bare = /^[\w-]+$/.test(arg), brief = bare ? (() => {
    try {
      return readBriefs(p).find((b) => b.id === arg);
    } catch {
      return void 0;
    }
  })() : void 0;
  const kinds = bare && existsSync8(join9(p.art, "assets")) ? readdirSync5(join9(p.art, "assets"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join9(p.art, "assets", d.name, arg)) : [];
  const cands = [...brief ? [resolve5(p.art, "assets", brief.kind, brief.id)] : [], ...isAbsolute(arg) ? [arg] : [resolve5(p.root, arg), resolve5(p.art, arg)], ...bare ? [join9(p.art, "assets", arg)] : [], ...kinds];
  const inside = cands.filter((c) => {
    const r = relative6(p.art, c);
    return r && !r.startsWith("..") && !isAbsolute(r);
  });
  if (!inside.length) throw new Error(`asset path ${arg} is outside art/ (sandbox)`);
  return inside.find((c) => existsSync8(c)) ?? inside[0];
}
function openDirection(p, a) {
  const name = dirOpt(p, a);
  return parseDirection(BENCH_DIRECTIONS[name] ?? JSON.parse(readFileSync8(name, "utf8")));
}
async function handle(msg, cwd = process.cwd()) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg.id === void 0 || msg.id === null) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return reply({
        protocolVersion: asked && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: "artgen pixel-art pipeline for this game repo. Art lives in art/; read the artgen and art-direction skills for the workflow."
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(-32602, `unknown tool ${String(msg.params?.name)}`);
      const p = findProject(cwd);
      if (!p) return reply({ content: [text("no artgen project here (art/artgen.config.json not found) \u2014 run `node tools/artgen/artgen.js init`")], isError: true });
      try {
        return reply({ content: await tool.run(msg.params?.arguments ?? {}, p) });
      } catch (e) {
        return reply({ content: [text(e instanceof Error ? e.message : String(e))], isError: true });
      }
    }
    default:
      return fail(-32601, `method not found: ${msg.method}`);
  }
}
function serve(input = process.stdin, output = process.stdout, cwd = process.cwd()) {
  let buf = "", chain = Promise.resolve();
  const write = (m) => output.write(JSON.stringify(m) + "\n");
  input.setEncoding?.("utf8");
  input.on("data", (chunk2) => {
    buf += chunk2;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      chain = chain.then(async () => {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
          return;
        }
        const r = await handle(msg, cwd);
        if (r) write(r);
      });
    }
  });
  return new Promise((res) => input.on("end", () => {
    void chain.then(res);
  }));
}
var SERVER, PROTOCOLS, text, image, pngFile, str, num, bool, strs, projRel, sizeArg, obj, dirOpt, asset, ids, TOOLS;
var init_server = __esm({
  "../artgen-mcp/src/server.ts"() {
    "use strict";
    init_src();
    init_bench();
    init_src3();
    SERVER = { name: "artgen", version: VERSION === "dev" ? "0.0.0-dev" : VERSION };
    PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
    text = (v) => ({ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) });
    image = (g) => ({ type: "image", data: Buffer.from(encodePNG(g)).toString("base64"), mimeType: "image/png" });
    pngFile = (f) => ({ type: "image", data: readFileSync8(f).toString("base64"), mimeType: "image/png" });
    str = { type: "string" };
    num = { type: "number" };
    bool = { type: "boolean" };
    strs = { type: "array", items: str };
    projRel = (p, f) => relative6(p.root, resolve5(f)).split("\\").join("/");
    sizeArg = (v, d = 32) => Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : [Number(v ?? d), Number(v ?? d)];
    obj = (properties, required = []) => ({ type: "object", properties, required });
    dirOpt = (p, args) => typeof args.direction !== "string" ? void 0 : BENCH_DIRECTIONS[args.direction] ? args.direction : join9(p.root, args.direction);
    asset = (p, args) => openAsset(assetPath(p, args.asset), { direction: dirOpt(p, args) });
    ids = (a) => Array.isArray(a.ids) ? a.ids : void 0;
    TOOLS = [
      {
        name: "direction_get",
        description: "The locked art direction (direction.json) and the candidate names; call before writing any asset so colours, sizes, line and shading come from tokens.",
        inputSchema: obj({ candidate: { ...str, description: "return this candidate instead of the locked direction" } }),
        async run(a, p) {
          if (typeof a.candidate === "string") return [text(loadCandidate(p, a.candidate))];
          return [text({ locked: lockedDirection(p), candidates: candidateNames(p) })];
        }
      },
      {
        name: "direction_tile",
        description: "Render the probe set (character, prop, tile, effect) under each candidate into one style tile sheet (art/candidates/style-tile-rN.png) and return it.",
        inputSchema: obj({ candidates: { type: "array", items: str, description: "candidate names; default all" } }),
        async run(a, p) {
          const r = await writeTile(p, Array.isArray(a.candidates) ? a.candidates : void 0);
          return [text({ sheet: r.path, round: r.round, imageTokens: r.tokens, columns: r.columns, distinct: r.distinct }), pngFile(join9(p.root, r.path))];
        }
      },
      {
        name: "pass_status",
        description: "Pipeline state of an asset directory: versions, scores, gate, best base, and the next step (write-base, review, write-finish, blind-review, ready).",
        inputSchema: obj({ asset: { ...str, description: "asset directory, e.g. art/probes/character" }, direction: str }, ["asset"]),
        async run(a, p) {
          return [text(await passState(asset(p, a)))];
        }
      },
      {
        name: "render",
        description: "Render one version of an asset (all states \xD7 facings \xD7 frames side by side) and run the conformance gate.",
        inputSchema: obj({ asset: str, version: { ...str, description: "base.vN or finish.vM; default the latest" }, variant: num, scale: num, direction: str }, ["asset"]),
        async run(a, p) {
          const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === "string" ? a.version : vs[vs.length - 1];
          if (!version) throw new Error(`${a.asset}: no versions yet`);
          const r = await renderVersion(ad, version, { variant: typeof a.variant === "number" ? a.variant : 0 });
          return [text({ version, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics, stale: r.stale }), image(r.strip.scale(typeof a.scale === "number" ? a.scale : 4))];
        }
      },
      {
        name: "review",
        description: "Build the review sheet for a version (best so far, v(n-1), v(n), checker + scaled + in context + silhouette), log it to the ledger and return it. blind: the version alone (no earlier versions, scores or notes) for a fresh reviewer's blind re-score of a final.",
        inputSchema: obj({ asset: str, version: str, blind: { type: "boolean" }, direction: str }, ["asset"]),
        async run(a, p) {
          const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === "string" ? a.version : vs[vs.length - 1];
          const r = await reviewVersion(ad, version, { blind: a.blind === true });
          return [text({ sheet: relative6(p.root, r.path), imageTokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks }), pngFile(r.path)];
        }
      },
      {
        name: "conformance",
        description: "Conformance gate (palette, scale, aa, line, light, dither, source lint, scene lint, anchors) for a version.",
        inputSchema: obj({ asset: str, version: str, direction: str }, ["asset"]),
        async run(a, p) {
          const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === "string" ? a.version : vs[vs.length - 1];
          return [text((await renderVersion(ad, version)).report)];
        }
      },
      {
        name: "score",
        description: "Record a 0-10 visual score for a reviewed version (the art-reviewer verdict) with gate results and token estimates. reviewer: who scored (the subagent name; omitted = self). blind: a blind re-score from the blind sheet (needs a reviewer).",
        inputSchema: obj({ asset: str, version: str, score: num, note: str, reviewer: str, blind: { type: "boolean" }, direction: str }, ["asset", "version", "score"]),
        async run(a, p) {
          const s2 = a.score, reviewer = typeof a.reviewer === "string" && a.reviewer ? a.reviewer : "self";
          if (!(s2 >= 0 && s2 <= 10)) throw new Error("score must be 0-10");
          if (a.blind === true && reviewer === "self") throw new Error("a blind re-score needs reviewer: it comes from a fresh reviewer that saw only the blind sheet");
          return [text(await scoreVersion(asset(p, a), a.version, s2, typeof a.note === "string" ? a.note : "", { reviewer, ...a.blind === true && { blind: true } }))];
        }
      },
      {
        name: "finish",
        description: "Write the next finish.vM.js for an asset from the finish template, bound to the best scored base (or `base`). Edit it with the finishing ops, then review it.",
        inputSchema: obj({ asset: str, base: { ...str, description: "base.vN to bind; default the pass machine's choice" }, direction: str }, ["asset"]),
        async run(a, p) {
          const r = await writeNextFinish(assetPath(p, a.asset), { base: typeof a.base === "string" ? a.base : void 0, direction: dirOpt(p, a) });
          return [text({ file: projRel(p, r.file), base: r.base })];
        }
      },
      {
        name: "make",
        description: "One tick of the autonomous production run: scaffold missing assets from templates, mark finished pipelines final, and name the next step. parallel: n also returns a round of up to n maker packets (one subagent per asset; each writes only its own files, then runs render + review) and the main agent's review steps.",
        inputSchema: obj({ ids: { ...strs, description: "brief ids; default all" }, parallel: { ...num, description: "maker subagents per round" } }),
        async run(a, p) {
          return [text(await make(p, ids(a), { parallel: typeof a.parallel === "number" && a.parallel >= 1 ? a.parallel : void 0 }))];
        }
      },
      {
        name: "status",
        description: "Production status of every brief in art/briefs.yaml (brief, in-pipeline, final, approved, exported, revision, stale), with the final version, score, open issues and the next pipeline step.",
        inputSchema: obj({ ids: { type: "array", items: str, description: "brief ids; default all" } }),
        async run(a, p) {
          return [text(await projectStatus(p, ids(a)))];
        }
      },
      {
        name: "gallery",
        description: "Sheet(s) of finished assets for the user (final render, score, blind score, open issues), logged to the ledger and returned.",
        inputSchema: obj({ ids: strs }),
        async run(a, p) {
          const r = await gallery(p, { ids: ids(a) });
          return [text(r.sheets.length ? r : "no finished assets waiting for review"), ...r.sheets.map((f) => pngFile(join9(p.root, f)))];
        }
      },
      {
        name: "feedback",
        description: "Record the user's feedback on a finished asset (by: user) and open a U-stage iteration. route base = form, proportion, colour (new base); finish = pixel fixes (finish revision). Pass the user's own words as note; region x,y,w,h in sprite pixels of cell state/facing/frame.",
        inputSchema: obj({ id: str, route: { type: "string", enum: ["base", "finish"] }, note: str, region: { type: "array", items: num }, cell: str, force: bool }, ["id", "route", "note"]),
        async run(a, p) {
          if (a.route !== "base" && a.route !== "finish") throw new Error("route: base | finish");
          if (typeof a.note !== "string" || !a.note) throw new Error("note: the user's words are required");
          return [text(await feedback(p, a.id, { route: a.route, note: a.note, region: Array.isArray(a.region) ? a.region : void 0, cell: typeof a.cell === "string" ? a.cell : void 0, force: a.force === true }))];
        }
      },
      {
        name: "approve",
        description: "Record the USER's approval of a final asset (approval is the user's call, never the agent's). Call only after the user said so in this conversation; user_approved must be true and note should quote them. Needs a passing gate and a review sheet of the final (R6).",
        inputSchema: obj({ id: str, note: str, user_approved: { ...bool, description: "true only when the user explicitly approved this asset" } }, ["id", "user_approved"]),
        async run(a, p) {
          if (a.user_approved !== true) throw new Error("approve: only the user approves assets \u2014 show them the gallery and ask; pass user_approved: true once they say so");
          return [text(await approve(p, a.id, typeof a.note === "string" ? a.note : ""))];
        }
      },
      {
        name: "texture",
        description: "Render a material recipe under the locked direction (or `direction`) into art/sheets/textures: the tile, its normal map and a 3\xD73 repeat preview, with the seam and repetition metrics. list: the material names.",
        inputSchema: obj({ material: str, size: { description: "px, or [w, h]; default 32" }, seed: num, ramps: { type: "object", description: 'layer \u2192 ramp, e.g. { "base": "stone" }' }, scale: num, list: bool, direction: str }),
        async run(a, p) {
          if (a.list === true || !a.material) return [text(MATERIALS)];
          const dir = typeof a.direction === "string" ? openDirection(p, a) : requireLocked(p), out = join9(p.art, "sheets", "textures");
          const r = textureRun(dir, a.material, { size: sizeArg(a.size), seed: typeof a.seed === "number" ? a.seed : void 0, ramps: a.ramps, scale: typeof a.scale === "number" ? a.scale : void 0, out });
          const files = r.files.map((f) => projRel(p, f));
          return [text({ ...r, files }), pngFile(join9(p.root, files[2])), pngFile(join9(p.root, files[1]))];
        }
      },
      {
        name: "fx",
        description: "Quick look at a particle preset under the locked direction (or `direction`) in art/sheets/fx: the frame strip and an onion-skin sheet (plus GIF/APNG files), with the solid-fill numbers. list: the preset names.",
        inputSchema: obj({ preset: str, size: { description: "px, or [w, h]; default 32" }, frames: num, seed: num, scale: num, list: bool, direction: str }),
        async run(a, p) {
          if (a.list === true || !a.preset) return [text(PRESET_NAMES)];
          const dir = typeof a.direction === "string" ? openDirection(p, a) : requireLocked(p), out = join9(p.art, "sheets", "fx");
          const r = fxRun(dir, a.preset, { size: sizeArg(a.size), frames: typeof a.frames === "number" ? a.frames : 8, seed: typeof a.seed === "number" ? a.seed : void 0, scale: typeof a.scale === "number" ? a.scale : void 0, out });
          const files = r.files.map((f) => projRel(p, f));
          return [text({ ...r, files }), pngFile(join9(p.root, files[0])), pngFile(join9(p.root, files[1]))];
        }
      },
      {
        name: "export",
        description: "Export approved assets into the configured packs (atlases, pack.json, Aseprite JSON, typed assets.ts); include_drafts adds finals; runtime vendors the artgen runtime + adapters. Animation contracts are enforced unless break_contract names the asset (or *).",
        inputSchema: obj({ packs: strs, include_drafts: bool, runtime: bool, force: bool, break_contract: strs }),
        async run(a, p) {
          return [text(await exportPacks(p, { packs: a.packs, includeDrafts: a.include_drafts === true, generator: `artgen ${VERSION} (mcp)`, runtime: a.runtime === true, force: a.force === true, breakContract: a.break_contract }))];
        }
      },
      {
        name: "restyle",
        description: "Re-render every finished asset under the newly locked direction: before | after | token-diff sheet (returned), per-asset change numbers; changed assets go back to final for re-approval.",
        inputSchema: obj({ from: { ...num, description: "direction version to compare from; default the previous one" } }),
        async run(a, p) {
          const r = await restyle(p, { from: typeof a.from === "number" ? a.from : void 0 });
          return [text(r), pngFile(join9(p.root, r.sheet))];
        }
      },
      {
        name: "analytics",
        description: "Pipeline analytics for this project (per-pass gains, cost per asset, regressions, user revision rate, review independence, budget suggestions) as markdown.",
        inputSchema: obj({}),
        async run(_a2, p) {
          return [text(projectAnalytics(p).markdown)];
        }
      }
    ];
  }
});

// ../artgen-mcp/src/bin.ts
import { register } from "node:module";
var hook = `export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && s.endsWith('.js')) return next(s.slice(0, -3) + '.ts', c); throw e; }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);
var { serve: serve2 } = await Promise.resolve().then(() => (init_server(), server_exports));
void serve2().then(() => process.exit(0));
