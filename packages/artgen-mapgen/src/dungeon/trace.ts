/**
 * The measuring half of trace (docs/DUNGEON-DESIGN.md §4.3, R7): from an image of a drawn map, the grid's pitch and phase
 * (from the gridlines), the floor (a light pixel is floor), the floor cells, and the rooms as rectangles of whole cells. The
 * result is a draft dungeon file to finish by hand: doors, symbols, labels and shapes other than rectangles are left to a
 * person (or a model) and to `scripts/dungeon-compare.mjs`, which scores a draft against its source.
 */
import { newDungeon, parseDungeon, type DungeonSpec, type Room } from './spec.ts';

/** An image as RGBA bytes, row by row (what `decodePNG` gives). */
export interface RGBAImage { w: number; h: number; d: Uint8Array | Uint8ClampedArray }
/** The grid: pixels a cell and where cell 0,0's corner lies, on each axis; and how clearly the lines showed (0..1). */
export interface GridFit { pitch: [number, number]; origin: [number, number]; clarity: [number, number] }
export interface TraceOptions {
  /** The channel tested for floor: r, g, b or lum (default lum). */
  channel?: 'r' | 'g' | 'b' | 'lum';
  /** Floor when the channel is above this, 0..255 (default 170). */
  floor?: number;
  /** A cell is floor when this share of its pixels is (default 0.5). */
  share?: number;
  /** The grid, when it is known; else it is measured. */
  grid?: GridFit;
  /** The least a cell's pitch can be, in pixels (default 6). */
  minPitch?: number;
  /** Keep light cells that reach the image's edge (a map cropped through its floor); by default they are taken as blank paper. */
  edge?: boolean;
  /** The fewest cells across a room has (default 2); thinner floor is left as passage. 3 keeps 10 ft passages on a 5 ft grid out of the rooms. */
  minRoom?: number;
  id?: string;
  scale?: { perCell: number; unit: string };
}
export interface TraceReport {
  grid: GridFit; cols: number; rows: number; floorCells: number;
  /** Floor cells inside the rooms found, as a share of all floor cells: the rest are passages or what the trace missed. */
  covered: number;
  rooms: number;
}

export function channelOf(img: RGBAImage, ch: TraceOptions['channel'] = 'lum'): Float32Array {
  const out = new Float32Array(img.w * img.h);
  for (let i = 0; i < out.length; i++) {
    const a = img.d[i * 4 + 3] / 255, c = (k: number) => img.d[i * 4 + k] * a + 255 * (1 - a);
    out[i] = ch === 'r' ? c(0) : ch === 'g' ? c(1) : ch === 'b' ? c(2) : 0.299 * c(0) + 0.587 * c(1) + 0.114 * c(2);
  }
  return out;
}

/**
 * How strongly each column (or row) reads as a gridline: the sum of each pixel's dip below both neighbours, where those are
 * light, it is part of a run of dipping pixels along the line (a gridline runs on), and the pixels round it are mostly light
 * (open floor: hatched rock is strokes on white, so it is light between them but darker on the whole).
 */
export function lineProfile(L: Float32Array, w: number, h: number, vertical: boolean, light: number): Float64Array {
  const n = vertical ? w : h, m = vertical ? h : w, out = new Float64Array(n), r = 4;
  // the mean of the (2r+1)² pixels round each one, from a summed table
  const S = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) S[(y + 1) * (w + 1) + x + 1] = L[y * w + x] + S[y * (w + 1) + x + 1] + S[(y + 1) * (w + 1) + x] - S[y * (w + 1) + x];
  const mean = (x: number, y: number) => {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
    return (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  };
  const open = (255 + light) / 2;
  const at = (a: number, b: number) => (vertical ? L[b * w + a] : L[a * w + b]);
  // a line one pixel wide dips below its neighbours; one two pixels wide (anti-aliased) below the pixels two away
  const dip = (a: number, b: number) => {
    const s1 = Math.min(at(a - 1, b), at(a + 1, b)), s2 = a > 1 && a < n - 2 ? Math.min(at(a - 2, b), at(a + 2, b)) : 0;
    return Math.max(s1 > light ? s1 - at(a, b) : 0, s2 > light && Math.max(at(a - 1, b), at(a + 1, b)) > light ? s2 - at(a, b) : 0);
  };
  // only runs of RUN pixels or more count: a gridline runs the length of a room, a hatch stroke or a letter does not
  const RUN = 8;
  for (let a = 1; a < n - 1; a++) {
    let s = 0, run = 0, sum = 0;
    for (let b = 1; b < m; b++) {
      const d = b < m - 1 ? dip(a, b) : 0;
      if (d > 6 && (vertical ? mean(a, b) : mean(b, a)) > open) { run++; sum += d; continue; }
      if (run >= RUN) s += sum;
      run = 0; sum = 0;
    }
    out[a] = s;
  }
  return out;
}

/** A profile's peaks (x, weight): local maxima above a share of a typical peak (the strongest are walls and text, not gridlines). */
function peaksOf(p: Float64Array): [number, number][] {
  const n = p.length, all: number[] = [], out: [number, number][] = [];
  for (let x = 1; x < n - 1; x++) if (p[x] > 0 && p[x] >= p[x - 1] && p[x] > p[x + 1]) all.push(p[x]);
  const typical = all.length ? all.slice().sort((a, b) => a - b)[Math.floor(all.length * 0.5)] : 0;
  for (let x = 1; x < n - 1; x++) if (p[x] > 0 && p[x] >= p[x - 1] && p[x] > p[x + 1] && p[x] >= 0.3 * typical) out.push([x, Math.min(Math.sqrt(p[x]), 2 * Math.sqrt(typical))]);
  return out;
}

const TOL = 1.5;
/**
 * How well a pitch explains a profile's peaks, at its best phase: recall (the share of peak weight on its lines) and precision
 * (the share of its lines, between the first peak and the last, that have a peak), as their harmonic mean. A multiple of the
 * true pitch misses lines and a fraction of it finds empty ones; the true one scores on both.
 */
function fit(peaks: [number, number][], q: number): { f: number; ph: number } {
  if (peaks.length < 3) return { f: 0, ph: 0 };
  const total = peaks.reduce((s, k) => s + k[1], 0), lo = peaks[0][0], hi = peaks[peaks.length - 1][0];
  let best = { f: -1, ph: 0 };
  for (const [x0] of peaks) {
    const ph = x0 % q, seen = new Set<number>();
    let on = 0;
    for (const [x, wt] of peaks) { const k = Math.round((x - ph) / q); if (Math.abs(x - ph - k * q) <= TOL) { on += wt; seen.add(k); } }
    const lines = Math.floor((hi - ph) / q) - Math.ceil((lo - ph) / q) + 1, recall = on / total, precision = seen.size / Math.max(1, lines), f = (2 * recall * precision) / (recall + precision || 1);
    if (f > best.f + 1e-9) best = { f, ph };
  }
  return best;
}

/** The pitch that best explains a profile's peaks, searched in quarter pixels from `minP`. */
function bestPitch(peaks: [number, number][], minP: number): number {
  if (peaks.length < 3) return minP;
  let q = minP, top = -1;
  for (let c = minP; c <= Math.max(minP, (peaks[peaks.length - 1][0] - peaks[0][0]) / 2); c += 0.25) { const f = fit(peaks, c).f; if (f > top + 1e-9) { top = f; q = c; } }
  return q;
}

/** A pitch fitted to the peaks on its lines by least squares: the pitch, the phase, and the score. */
function refine(peaks: [number, number][], q: number): { pitch: number; origin: number; clarity: number } {
  const { f, ph } = fit(peaks, q), xs: number[] = [], ks: number[] = [];
  for (const [x] of peaks) { const k = Math.round((x - ph) / q); if (Math.abs(x - ph - k * q) <= TOL) { xs.push(x); ks.push(k); } }
  if (xs.length < 2) return { pitch: q, origin: ph, clarity: Math.max(0, Math.round(f * 1000) / 1000) };
  const km = ks.reduce((a, b) => a + b, 0) / ks.length, xm = xs.reduce((a, b) => a + b, 0) / xs.length, den = ks.reduce((a, k) => a + (k - km) ** 2, 0);
  const pitch = den ? ks.reduce((a, k, i) => a + (k - km) * (xs[i] - xm), 0) / den : q, origin = (((xm - pitch * km) % pitch) + pitch) % pitch;
  return { pitch: Math.round(pitch * 1000) / 1000, origin: Math.round(origin * 1000) / 1000, clarity: Math.round(f * 1000) / 1000 };
}

/**
 * The grid of a drawn map, from its gridlines. Cells are square unless `square` is false: each axis proposes its best pitch,
 * and the one both axes explain best (the lower of their two scores) is used for both, so noise on one axis (text, symbols,
 * a hatch) cannot halve or double it.
 */
export function measureGrid(img: RGBAImage, o: Pick<TraceOptions, 'channel' | 'minPitch' | 'floor'> & { square?: boolean } = {}): GridFit {
  const L = channelOf(img, o.channel ?? 'lum'), minP = o.minPitch ?? 6, light = o.floor ?? 170;
  const px = peaksOf(lineProfile(L, img.w, img.h, true, light)), py = peaksOf(lineProfile(L, img.w, img.h, false, light));
  const qx = bestPitch(px, minP), qy = bestPitch(py, minP);
  let [ax, ay] = [qx, qy];
  if (o.square !== false) {
    const both = (q: number) => Math.min(fit(px, q).f, fit(py, q).f), q = both(qx) >= both(qy) ? qx : qy;
    ax = ay = q;
  }
  const x = refine(px, ax), y = refine(py, ay);
  return { pitch: [x.pitch, y.pitch], origin: [x.origin, y.origin], clarity: [x.clarity, y.clarity] };
}

/** Walls between floor cells: `v[j * (cols + 1) + i]` on the line west of cell (i, j), `h[j * cols + i]` on the line north of it. */
export interface Walls { v: Uint8Array; h: Uint8Array }

/** The most of a floor cell that may be marked (a symbol, a letter); hatched rock has more. */
const INK_SHARE = 0.12;

/** Which cells are floor: a cell (whole, inside the image) whose share of light pixels is at least `share` and whose marks are under INK_SHARE, and that is not joined to the image's edge (blank paper) unless `edge`. */
export function floorCells(img: RGBAImage, grid: GridFit, o: Pick<TraceOptions, 'channel' | 'floor' | 'share' | 'edge'> = {}): { cols: number; rows: number; x0: number; y0: number; floor: Uint8Array; walls: Walls } {
  const C = channelOf(img, o.channel), t = o.floor ?? 170, share = o.share ?? 0.5, [px, py] = grid.pitch, [ox, oy] = grid.origin, mark = (255 + t) / 2;
  const inset0 = Math.max(2, Math.min(px, py) * 0.12);
  const x0 = Math.ceil(-ox / px - 1e-9), y0 = Math.ceil(-oy / py - 1e-9);
  const cols = Math.floor((img.w - ox) / px + 1e-9) - x0, rows = Math.floor((img.h - oy) / py + 1e-9) - y0, floor = new Uint8Array(Math.max(0, cols * rows));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    // the cell's inner pixels (in from each edge, off the gridlines)
    const inset = Math.max(2, Math.min(px, py) * 0.12);
    const xa = Math.ceil(ox + (x0 + i) * px + inset), xb = Math.floor(ox + (x0 + i + 1) * px - inset), ya = Math.ceil(oy + (y0 + j) * py + inset), yb = Math.floor(oy + (y0 + j + 1) * py - inset);
    // floor is light and nearly free of marks; hatched rock on white paper is light between its strokes, but marked all over
    let lit = 0, ink = 0, all = 0;
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { all++; const v = C[y * img.w + x]; if (v > t) lit++; if (v < mark) ink++; }
    if (all && lit / all >= share && ink / all < INK_SHARE) floor[j * cols + i] = 1;
  }
  // a wall between two floor cells: most of the line between them dark (a door in it leaves an opening)
  const walls: Walls = { v: new Uint8Array((cols + 1) * rows), h: new Uint8Array(cols * (rows + 1)) };
  const darkLine = (xa: number, ya: number, xb: number, yb: number) => {
    let dark = 0, all = 0;
    const len = Math.max(Math.abs(xb - xa), Math.abs(yb - ya));
    for (let k = 0; k <= len; k++) { const x = Math.round(xa + ((xb - xa) * k) / (len || 1)), y = Math.round(ya + ((yb - ya) * k) / (len || 1)); if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue; all++; if (C[y * img.w + x] < t / 2) dark++; }
    return all > 0 && dark / all >= 0.5;
  };
  for (let j = 0; j < rows; j++) for (let i = 1; i < cols; i++) {
    if (!floor[j * cols + i - 1] || !floor[j * cols + i]) continue;
    const x = ox + (x0 + i) * px, ya = oy + (y0 + j) * py + inset0, yb = oy + (y0 + j + 1) * py - inset0;
    if (darkLine(x, ya, x, yb)) walls.v[j * (cols + 1) + i] = 1;
  }
  for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!floor[(j - 1) * cols + i] || !floor[j * cols + i]) continue;
    const y = oy + (y0 + j) * py, xa = ox + (x0 + i) * px + inset0, xb = ox + (x0 + i + 1) * px - inset0;
    if (darkLine(xa, y, xb, y)) walls.h[j * cols + i] = 1;
  }
  // blank paper is light and unmarked too: the sheet's margin and the band beside the map reach the image's edge, floor does not
  if (o.edge !== true) {
    const stack: number[] = [];
    for (let i = 0; i < cols; i++) stack.push(i, (rows - 1) * cols + i);
    for (let j = 0; j < rows; j++) stack.push(j * cols, j * cols + cols - 1);
    while (stack.length) {
      const k = stack.pop()!;
      if (k < 0 || k >= floor.length || !floor[k]) continue;
      floor[k] = 0;
      const i = k % cols;
      stack.push(k - cols, k + cols);
      if (i > 0) stack.push(k - 1);
      if (i < cols - 1) stack.push(k + 1);
    }
  }
  return { cols, rows, x0, y0, floor, walls };
}

/** Floor cells as rectangles: the largest first, each at least `min` cells on its shorter side and crossing no wall; what is left is thinner (passages). */
export function cellRects(floor: Uint8Array, cols: number, rows: number, min = 2, walls?: Walls): [number, number, number, number][] {
  const left = floor.slice(), out: [number, number, number, number][] = [];
  const wallW = (i: number, j: number) => !!walls && walls.v[j * (cols + 1) + i] === 1, wallN = (i: number, j: number) => !!walls && walls.h[j * cols + i] === 1;
  for (;;) {
    let best: [number, number, number, number] | null = null, area = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!left[y * cols + x]) continue;
      // grow down row by row, keeping the widest run each row allows (no floor gap, no wall inside it, none between rows)
      let width = Infinity;
      for (let h = 0; y + h < rows; h++) {
        const r = y + h;
        if (!left[r * cols + x] || (h && wallN(x, r))) break;
        let w = 1;
        while (x + w < cols && w < width && left[r * cols + x + w] && !wallW(x + w, r) && !(h && wallN(x + w, r))) w++;
        width = Math.min(width, w);
        if (Math.min(width, h + 1) >= min && width * (h + 1) > area) { area = width * (h + 1); best = [x, y, width, h + 1]; }
      }
    }
    if (!best) return out;
    out.push(best);
    for (let y = best[1]; y < best[1] + best[3]; y++) for (let x = best[0]; x < best[0] + best[2]; x++) left[y * cols + x] = 0;
  }
}

/** A draft dungeon from an image: the grid measured (or given), the floor cells read, and rooms for the rectangles of floor. */
export function traceImage(img: RGBAImage, o: TraceOptions = {}): { spec: DungeonSpec; report: TraceReport } {
  const grid = o.grid ?? measureGrid(img, o), cells = floorCells(img, grid, o), rects = cellRects(cells.floor, cells.cols, cells.rows, o.minRoom ?? 2, cells.walls);
  const floorN = cells.floor.reduce((s, v) => s + v, 0), inRooms = rects.reduce((s, r) => s + r[2] * r[3], 0);
  // cells in the file count from the image's first whole cell, with a cell of margin
  const rooms: Room[] = rects.sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((r, k) => ({ id: `t${k + 1}`, shape: 'rect', x: r[0] + 1, y: r[1] + 1, w: r[2], h: r[3], origin: 'trace' }));
  const spec = parseDungeon({ ...newDungeon(o.id ?? 'trace', { cols: cells.cols + 2, rows: cells.rows + 2, ...(o.scale && { scale: o.scale }) }), rooms, corridors: [], numbers: false });
  return { spec, report: { grid, cols: cells.cols, rows: cells.rows, floorCells: floorN, covered: floorN ? Math.round((inRooms / floorN) * 1000) / 1000 : 0, rooms: rooms.length } };
}
