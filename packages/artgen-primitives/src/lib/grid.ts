/** RGBA pixel buffer (artlab `Grid`) plus crop/pad/trim/flip/hash/toIndexed. */
import { parseColor, toHex } from './color.ts';

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8ClampedArray;
  /** Normal map of this image (same size; RGB = normal, OpenGL convention), when the renderer produced one. */
  normal?: Grid;

  constructor(w: number, h: number, data?: Uint8ClampedArray | Uint8Array) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    if (data) this.d.set(data);
  }

  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Write a colour. Partial alpha blends over an opaque pixel and keeps its alpha (artlab: used for shadows). */
  set(x: number, y: number, c: string | null | undefined): void {
    x |= 0; y |= 0;
    if (!this.inb(x, y) || c == null) return;
    const [r, g, b, a] = parseColor(c), i = (y * this.w + x) * 4, d = this.d;
    if (a === 255 || d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; return; }
    const t = a / 255;
    d[i] = d[i] * (1 - t) + r * t; d[i + 1] = d[i + 1] * (1 - t) + g * t; d[i + 2] = d[i + 2] * (1 - t) + b * t;
  }

  /** Clear a pixel to transparent. */
  clear(x: number, y: number): void {
    if (this.inb(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4);
  }

  alpha(x: number, y: number): number { return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }

  /** `#rrggbb` of a non-transparent pixel, else null. */
  get(x: number, y: number): string | null {
    if (!this.inb(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (!this.d[i + 3]) return null;
    return toHex(this.d[i], this.d[i + 1], this.d[i + 2]);
  }

  clone(): Grid { return new Grid(this.w, this.h, this.d); }

  /** Draw another grid's non-transparent pixels on top. */
  stamp(src: Grid, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) this.set(x + ox, y + oy, c);
    }
    return this;
  }

  /** Source-over composite of `src` (straight alpha), so partial-alpha shadows blend as in a game. */
  over(src: Grid, ox = 0, oy = 0): this {
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
  blit(src: Grid, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (!src.d[i + 3] || !this.inb(x + ox, y + oy)) continue;
      this.d.set(src.d.subarray(i, i + 4), ((y + oy) * this.w + x + ox) * 4);
    }
    return this;
  }

  crop(x: number, y: number, w: number, h: number): Grid {
    const g = new Grid(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!this.inb(x + i, y + j)) continue;
      const s = ((y + j) * this.w + x + i) * 4;
      g.d.set(this.d.subarray(s, s + 4), (j * w + i) * 4);
    }
    return g;
  }

  pad(top: number, right = top, bottom = top, left = right): Grid {
    return this.crop(-left, -top, this.w + left + right, this.h + top + bottom);
  }

  /** Bounding box of non-transparent pixels, or null when empty. */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  trim(): Grid {
    const b = this.bounds();
    return b ? this.crop(b.x, b.y, b.w, b.h) : new Grid(0, 0);
  }

  flip(axis: 'x' | 'y' = 'x'): Grid {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const sx = axis === 'x' ? this.w - 1 - x : x, sy = axis === 'y' ? this.h - 1 - y : y, s = (sy * this.w + sx) * 4;
      g.d.set(this.d.subarray(s, s + 4), (y * this.w + x) * 4);
    }
    return g;
  }

  /** Nearest-neighbour integer upscale. */
  scale(n: number): Grid {
    if (n === 1) return this.clone();
    const g = new Grid(this.w * n, this.h * n);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const s = (((y / n) | 0) * this.w + ((x / n) | 0)) * 4;
      g.d.set(this.d.subarray(s, s + 4), (y * g.w + x) * 4);
    }
    return g;
  }

  /** Fill a rectangle with a colour (blending like `set`). */
  fill(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  /** Stable content hash (cyrb53 over size + RGBA bytes), 14 hex chars. */
  hash(): string {
    let h1 = 0xdeadbeef ^ this.w, h2 = 0x41c6ce57 ^ this.h;
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }

  /**
   * Indexed form: `palette` lists distinct RGBA colours in first-seen order, `index` holds palette
   * position + 1 per pixel (0 = transparent).
   */
  toIndexed(): { palette: string[]; alphas: number[]; index: Uint16Array } {
    const key = new Map<number, number>(), palette: string[] = [], alphas: number[] = [], index = new Uint16Array(this.w * this.h);
    for (let p = 0; p < index.length; p++) {
      const i = p * 4, a = this.d[i + 3];
      if (!a) continue;
      const k = ((this.d[i] << 24) | (this.d[i + 1] << 16) | (this.d[i + 2] << 8) | a) >>> 0;
      let n = key.get(k);
      if (n === undefined) {
        n = palette.length; key.set(k, n);
        palette.push(toHex(this.d[i], this.d[i + 1], this.d[i + 2])); alphas.push(a);
      }
      index[p] = n + 1;
    }
    return { palette, alphas, index };
  }

  /** Number of pixels that differ (any channel) from another grid of the same size. */
  diffCount(o: Grid): number {
    if (o.w !== this.w || o.h !== this.h) return Math.max(this.w * this.h, o.w * o.h);
    let n = 0;
    for (let p = 0; p < this.w * this.h; p++) {
      const i = p * 4;
      if (this.d[i] !== o.d[i] || this.d[i + 1] !== o.d[i + 1] || this.d[i + 2] !== o.d[i + 2] || this.d[i + 3] !== o.d[i + 3]) n++;
    }
    return n;
  }
}
