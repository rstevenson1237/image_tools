// The measuring half of trace (R7): a drawn map's grid, floor cells and rooms, from its pixels.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

/** A map drawn in pixels: dark rock, light floor in the given cells, grey gridlines over the floor. */
function draw(w: number, h: number, pitch: number, [ox, oy]: [number, number], floor: [number, number, number, number][]): D.RGBAImage {
  const d = new Uint8Array(w * h * 4), set = (x: number, y: number, v: number) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; };
  const isFloor = (x: number, y: number) => floor.some(([cx, cy, cw, ch]) => x >= ox + cx * pitch && x < ox + (cx + cw) * pitch && y >= oy + cy * pitch && y < oy + (cy + ch) * pitch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const onLine = ((x - ox) % pitch + pitch) % pitch < 1 || ((y - oy) % pitch + pitch) % pitch < 1;
    set(x, y, isFloor(x, y) ? (onLine ? 150 : 245) : 50);
  }
  return { w, h, d };
}

/** The same, drawn as artgen renders it: two-pixel lines, a fainter sub-grid with a darker line every second cell, and the rock hatched in short strokes on white. */
function render(w: number, h: number, pitch: number, floor: [number, number, number, number][]): D.RGBAImage {
  const d = new Uint8Array(w * h * 4), set = (x: number, y: number, v: number) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; };
  const isFloor = (x: number, y: number) => floor.some(([cx, cy, cw, ch]) => x >= cx * pitch && x < (cx + cw) * pitch && y >= cy * pitch && y < (cy + ch) * pitch);
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const line = (v: number) => { const m = ((v % pitch) + pitch) % pitch; return m < 2 ? (Math.floor(v / pitch) % 2 ? 1 : 2) : 0; };
    const l = Math.max(line(x), line(y));
    set(x, y, isFloor(x, y) ? (l === 2 ? 200 : l === 1 ? 236 : 255) : 255);
  }
  // hatching: clusters of three short dark strokes on the white rock
  for (let k = 0; k < (w * h) / 60; k++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h), dir = rand() < 0.5;
    for (let s = 0; s < 3; s++) for (let t = 0; t < 7; t++) { const X = dir ? x + t : x + 2 * s, Y = dir ? y + 2 * s : y + t; if (X < w && Y < h && !isFloor(X, Y)) set(X, Y, 20); }
  }
  return { w, h, d };
}

describe('trace: grid, floor and rooms from a drawn map', () => {
  test('a render as artgen draws it: the cell from the fainter sub-grid, through hatching', () => {
    const img = render(600, 480, 20, [[2, 2, 6, 4], [12, 3, 8, 6], [3, 12, 10, 8]]);
    const g = D.measureGrid(img);
    expect(g.pitch[0]).toBeCloseTo(20, 0);
    expect(g.pitch[1]).toBeCloseTo(20, 0);
    const { spec } = D.traceImage(img, { floor: 180 });
    expect(spec.rooms.map(r => [r.x - 1, r.y - 1, r.w, r.h])).toEqual(expect.arrayContaining([[2, 2, 6, 4], [12, 3, 8, 6], [3, 12, 10, 8]]));
  });

  const rooms: [number, number, number, number][] = [[2, 2, 5, 4], [10, 3, 5, 6], [7, 4, 3, 1], [4, 9, 8, 3]];
  const img = draw(420, 300, 20, [7, 3], rooms);
  test('the grid\'s pitch and phase from its lines', () => {
    const g = D.measureGrid(img);
    expect(g.pitch[0]).toBeCloseTo(20, 1);
    expect(g.pitch[1]).toBeCloseTo(20, 1);
    expect(g.origin[0]).toBeCloseTo(7, 0);
    expect(g.origin[1]).toBeCloseTo(3, 0);
  });
  test('the rooms as rectangles of whole cells; a one-cell strip is left as passage', () => {
    const { spec, report } = D.traceImage(img, { id: 'm' });
    expect(report.rooms).toBe(3);
    // the draft's cells count from the image's first whole cell (cell 0 starts at x 7), with a cell of margin
    const boxes = spec.rooms.map(r => [r.x - 1, r.y - 1, r.w, r.h]);
    expect(boxes).toEqual(expect.arrayContaining([[2, 2, 5, 4], [10, 3, 5, 6], [4, 9, 8, 3]]));
    expect(report.covered).toBeCloseTo((20 + 30 + 24) / (20 + 30 + 3 + 24), 2);
    expect(D.lintDungeon(spec).filter(f => f.severity === 'error')).toEqual([]);
  });
  test('a wall between touching rooms splits them; a door in it does not join them into one rectangle', () => {
    const img = draw(420, 300, 20, [7, 3], [[2, 2, 4, 4], [6, 2, 6, 4]]);
    // the shared wall: a dark line 3 px wide on x = 7 + 6 × 20, with a door's opening in its middle cell
    for (let y = 3 + 2 * 20; y < 3 + 6 * 20; y++) for (let x = 126; x <= 128; x++) if (y < 3 + 3 * 20 || y >= 3 + 4 * 20) { const i = (y * 420 + x) * 4; img.d[i] = img.d[i + 1] = img.d[i + 2] = 0; }
    const { spec } = D.traceImage(img, { grid: { pitch: [20, 20], origin: [7, 3], clarity: [1, 1] } });
    expect(spec.rooms.map(r => [r.x - 1, r.y - 1, r.w, r.h]).sort()).toEqual([[2, 2, 4, 4], [6, 2, 6, 4]]);
  });
  test('blank paper round the map is not floor', () => {
    const img = draw(420, 300, 20, [7, 3], [[2, 2, 4, 4]]);
    for (let i = 0; i < img.d.length; i += 4) if (img.d[i] === 50 && (i / 4) % 420 < 20) img.d[i] = img.d[i + 1] = img.d[i + 2] = 255;
    expect(D.traceImage(img).report.rooms).toBe(1);
  });
  test('a coloured map: the channel the rock is low in', () => {
    const blue = draw(300, 220, 16, [0, 0], [[2, 2, 6, 4]]);
    for (let i = 0; i < blue.d.length; i += 4) if (blue.d[i] === 50) { blue.d[i] = 58; blue.d[i + 1] = 156; blue.d[i + 2] = 240; }
    const { report } = D.traceImage(blue, { channel: 'r', floor: 120 });
    expect(report.rooms).toBe(1);
    expect(report.grid.pitch[0]).toBeCloseTo(16, 1);
  });
});
