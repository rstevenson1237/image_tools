/**
 * Slice: cut an outside sprite sheet into its sprites, to use as references or placeholders. A sheet is either a regular grid
 * (columns and rows, or a cell size) or loose sprites found by their opaque pixels.
 */
import type { Box } from './cut.ts';
import { alphaBounds } from './cut.ts';
import type { Pixels } from './mask.ts';

export interface Cell extends Box { /** Reading order, from 0. */ index: number; col: number; row: number }

export interface GridSlice {
  /** Cells across and down; give these or the cell size. */
  cols?: number; rows?: number;
  /** Cell size in pixels; give this or the counts. */
  cellW?: number; cellH?: number;
  /** Pixels around the whole sheet that belong to no cell. */
  margin?: number;
  /** Pixels between cells. */
  spacing?: number;
  /** Leave out cells with no opaque pixel. */
  skipEmpty?: boolean;
  /** Shrink each cell to its opaque pixels. */
  trim?: boolean;
}

/** The cells of a regular grid, in reading order. Throws when the numbers leave no room for a cell. */
export function sliceGrid(img: Pixels, o: GridSlice): Cell[] {
  const margin = o.margin ?? 0, spacing = o.spacing ?? 0, usableW = img.w - 2 * margin, usableH = img.h - 2 * margin;
  let cols = o.cols, rows = o.rows, cw = o.cellW, ch = o.cellH;
  if (cw && ch) { cols = Math.floor((usableW + spacing) / (cw + spacing)); rows = Math.floor((usableH + spacing) / (ch + spacing)); }
  else if (cols && rows) { cw = Math.floor((usableW - spacing * (cols - 1)) / cols); ch = Math.floor((usableH - spacing * (rows - 1)) / rows); }
  else throw new Error('slice: give the columns and rows (cols, rows) or the cell size (cellW, cellH)');
  if (!cols || !rows || !cw || !ch || cols < 1 || rows < 1 || cw < 1 || ch < 1) throw new Error(`slice: no room for a cell in a ${img.w}x${img.h} picture with those numbers`);
  const out: Cell[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let box: Box = { x: margin + col * (cw + spacing), y: margin + row * (ch + spacing), w: cw, h: ch };
    if (o.skipEmpty || o.trim) {
      const b = alphaBounds(crop(img, box));
      if (!b) { if (o.skipEmpty) continue; } else if (o.trim) box = { x: box.x + b.x, y: box.y + b.y, w: b.w, h: b.h };
    }
    out.push({ ...box, index: out.length, col, row });
  }
  return out;
}

/**
 * Loose sprites: the opaque blobs of the sheet, where pixels at most `gap` empty pixels apart belong together, in reading order (rows of
 * sprites whose tops are within half a sprite height of each other count as one row). Blobs under `minSize` pixels either way are dropped.
 * Each opaque pixel is grown `gap` pixels right and down, and the grown shapes that touch are one sprite: the same sprites as testing every
 * pair of pixels within `gap + 1` of each other, in time that does not depend on `gap`.
 */
export function sliceSprites(img: Pixels, o: { gap?: number; minSize?: number } = {}): Cell[] {
  const gap = Math.max(0, Math.floor(o.gap ?? 1)), minSize = o.minSize ?? 2, { w, h } = img, W = w + 1;
  // an integral image of the opaque pixels, to ask "is any opaque pixel in this square" in one step
  const sum = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sum[(y + 1) * W + x + 1] = (img.d[(y * w + x) * 4 + 3] > 0 ? 1 : 0) + sum[y * W + x + 1] + sum[(y + 1) * W + x] - sum[y * W + x];
  const grown = (x: number, y: number): boolean => {
    const x0 = Math.max(0, x - gap), y0 = Math.max(0, y - gap);
    return sum[(y + 1) * W + x + 1] - sum[y0 * W + x + 1] - sum[(y + 1) * W + x0] + sum[y0 * W + x0] > 0;
  };
  const label = new Int32Array(w * h).fill(-1), boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (label[y * w + x] >= 0 || !grown(x, y)) continue;
    const id = boxes.length, stack = [y * w + x];
    boxes.push({ x0: w, y0: h, x1: -1, y1: -1 });
    label[y * w + x] = id;
    while (stack.length) {
      const i = stack.pop()!, cx = i % w, cy = (i - cx) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || label[ny * w + nx] >= 0 || !grown(nx, ny)) continue;
        label[ny * w + nx] = id;
        stack.push(ny * w + nx);
      }
    }
  }
  // the sprite is the opaque pixels of each grown shape
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (img.d[(y * w + x) * 4 + 3] === 0) continue;
    const b = boxes[label[y * w + x]];
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  const found = boxes.filter(b => b.x1 >= 0).map(b => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })).filter(b => b.w >= minSize && b.h >= minSize);
  const tall = found.length ? found.reduce((n, b) => n + b.h, 0) / found.length : 0;
  // settle rows first (a sprite joins the row whose first sprite starts within half a sprite height of it), then order each row left to right
  const rowsOf: Box[][] = [];
  for (const b of [...found].sort((p, q) => p.y - q.y)) {
    const row = rowsOf.find(r => Math.abs(r[0].y - b.y) < tall / 2);
    if (row) row.push(b); else rowsOf.push([b]);
  }
  const out: Cell[] = [];
  rowsOf.forEach((r, row) => r.sort((p, q) => p.x - q.x).forEach((b, col) => out.push({ ...b, index: out.length, col, row })));
  return out;
}

/** The pixels of a box (clipped to the picture). */
export function crop(img: Pixels, box: Box): { w: number; h: number; d: Uint8ClampedArray } {
  const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y), x1 = Math.min(img.w, box.x + box.w), y1 = Math.min(img.h, box.y + box.h);
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0), d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) d[(y * w + x) * 4 + c] = img.d[((y0 + y) * img.w + x0 + x) * 4 + c];
  return { w, h, d };
}
