/**
 * GIF89a encoder (P6c animation previews). Pixel art has few colours, so frames share one global palette (≤ 255
 * colours + transparency); pixels with alpha < 128 are transparent. Pure TS, deterministic.
 */
import type { Grid } from './grid.ts';

function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode, eoi = clear + 1, out: number[] = [];
  let size = minCode + 1, next = eoi + 1, dict = new Map<string, number>(), bits = 0, acc = 0;
  const emit = (code: number) => {
    acc |= code << bits; bits += size;
    while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; }
  };
  emit(clear);
  let cur = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = cur + ',' + k;
    if (dict.has(key)) { cur = key; continue; }
    emit(cur.includes(',') ? dict.get(cur)! : +cur);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
    cur = String(k);
  }
  emit(cur.includes(',') ? dict.get(cur)! : +cur);
  emit(eoi);
  if (bits > 0) out.push(acc & 255);
  return new Uint8Array(out);
}

/** Encode frames (same size) with per-frame delays in ms; loops forever. */
export function encodeGIF(frames: Grid[], delays: number[]): Uint8Array {
  if (!frames.length) throw new Error('encodeGIF: no frames');
  const { w, h } = frames[0], colors = new Map<number, number>();
  for (const f of frames) {
    if (f.w !== w || f.h !== h) throw new Error('encodeGIF: frames differ in size');
    for (let i = 0; i < w * h; i++) if (f.d[i * 4 + 3] >= 128) {
      const c = (f.d[i * 4] << 16) | (f.d[i * 4 + 1] << 8) | f.d[i * 4 + 2];
      if (!colors.has(c)) { if (colors.size >= 255) throw new Error('encodeGIF: more than 255 colours'); colors.set(c, colors.size + 1); }
    }
  }
  let bitsPer = 1;
  while (1 << bitsPer < colors.size + 1) bitsPer++;
  const tableSize = 1 << bitsPer, bytes: number[] = [];
  const u16 = (v: number) => bytes.push(v & 255, (v >> 8) & 255);
  bytes.push(...[...'GIF89a'].map(c => c.charCodeAt(0)));
  u16(w); u16(h); bytes.push(0x80 | (bitsPer - 1), 0, 0);
  const table = new Array(tableSize * 3).fill(0);
  for (const [c, i] of colors) { table[i * 3] = c >> 16; table[i * 3 + 1] = (c >> 8) & 255; table[i * 3 + 2] = c & 255; }
  bytes.push(...table);
  bytes.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  frames.forEach((f, k) => {
    // graphic control: restore to background between frames (transparent pixels stay transparent), index 0 transparent
    bytes.push(0x21, 0xf9, 4, (2 << 2) | 1); u16(Math.max(2, Math.round((delays[k] ?? 100) / 10))); bytes.push(0, 0);
    bytes.push(0x2c); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) idx[i] = f.d[i * 4 + 3] >= 128 ? colors.get((f.d[i * 4] << 16) | (f.d[i * 4 + 1] << 8) | f.d[i * 4 + 2])! : 0;
    const minCode = Math.max(2, bitsPer), data = lzw(idx, minCode);
    bytes.push(minCode);
    for (let o = 0; o < data.length; o += 255) { const n = Math.min(255, data.length - o); bytes.push(n, ...data.subarray(o, o + n)); }
    bytes.push(0);
  });
  bytes.push(0x3b);
  return new Uint8Array(bytes);
}
