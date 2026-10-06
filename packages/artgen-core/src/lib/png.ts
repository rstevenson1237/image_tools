/** Pure-JS PNG codec (8-bit, non-interlaced) over fflate's zlib. */
import { unzlibSync, zlibSync } from 'fflate';
import { Grid } from './grid.ts';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Encode a grid as RGBA PNG. Rows are unfiltered: sprites are small and the output must be deterministic. */
export function encodePNG(g: Grid): Uint8Array {
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, g.w); dv.setUint32(4, g.h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array(g.h * (g.w * 4 + 1));
  for (let y = 0; y < g.h; y++) raw.set(g.d.subarray(y * g.w * 4, (y + 1) * g.w * 4), y * (g.w * 4 + 1) + 1);
  const parts = [new Uint8Array(SIG), chunk('IHDR', ihdr), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Decode an 8-bit, non-interlaced PNG (grey, grey+alpha, RGB, RGBA, palette + tRNS). */
export function decodePNG(bytes: Uint8Array): Grid {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) throw new Error('not a PNG');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte: Uint8Array | null = null, trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let o = 8; o < bytes.length;) {
    const len = dv.getUint32(o), t = String.fromCharCode(...bytes.subarray(o + 4, o + 8)), data = bytes.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (t === 'PLTE') plte = data;
    else if (t === 'tRNS') trns = data;
    else if (t === 'IDAT') idat.push(data);
    else if (t === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG: depth ${depth}, interlace ${interlace}`);
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!ch) throw new Error(`unsupported PNG colour type ${type}`);
  const z = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let zo = 0;
  for (const p of idat) { z.set(p, zo); zo += p.length; }
  const raw = unzlibSync(z), stride = w * ch, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 0xff;
    }
  }
  const g = new Grid(w, h);
  for (let p = 0; p < w * h; p++) {
    const s = p * ch, i = p * 4;
    if (type === 6) g.d.set(px.subarray(s, s + 4), i);
    else if (type === 2) g.d.set([px[s], px[s + 1], px[s + 2], 255], i);
    else if (type === 0) g.d.set([px[s], px[s], px[s], 255], i);
    else if (type === 4) g.d.set([px[s], px[s], px[s], px[s + 1]], i);
    else {
      const k = px[s];
      if (!plte) throw new Error('palette PNG without PLTE');
      g.d.set([plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], i);
    }
  }
  return g;
}
