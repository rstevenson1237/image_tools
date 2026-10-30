import { describe, expect, test } from 'vitest';
import { alphaBounds, applyMask, cropToken, extractSilhouette, hexToRgb, keepLargestFilledBlob, silhouetteMask } from './cut.ts';
import { fillChain, fillPolygon, findContours, ringArea, simplifyRing } from './contours.ts';
import { maskArea, newMask, otsu, type Mask, type Pixels } from './mask.ts';
import { formatGpl, formatHex, paletteOf, parsePaletteText, snapToPalette, swatchImage } from './palette.ts';
import { crop, sliceGrid, sliceSprites } from './slice.ts';
import { ringToD, traceToSvg } from './svg.ts';
import { traceImage, traceMask } from './trace.ts';

/** A mask from rows of text: `#` is set. */
const mask = (rows: string[]): Mask => { const m = newMask(rows[0].length, rows.length); rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') m.d[y * m.w + x] = 255; })); return m; };
/** A picture of dark `#` on a white ground (`.` transparent when `alpha`). */
const pic = (rows: string[], alpha = false): Pixels => {
  const w = rows[0].length, h = rows.length, d = new Uint8ClampedArray(w * h * 4);
  rows.forEach((r, y) => [...r].forEach((c, x) => { const i = (y * w + x) * 4, v = c === '#' ? 20 : 240; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = alpha && c === '.' ? 0 : 255; }));
  return { w, h, d };
};
const disc = (w: number, h: number, cx: number, cy: number, r: number, hole?: [number, number, number]): Pixels => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = (x - cx) ** 2 + (y - cy) ** 2 < r * r && !(hole && (x - hole[0]) ** 2 + (y - hole[1]) ** 2 < hole[2] ** 2), v = inside ? 10 : 245, i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  return { w, h, d };
};

describe('contours', () => {
  test('a rectangle is four corners, going down the left side first (counter-clockwise on screen)', () => {
    const c = findContours(mask(['......', '.####.', '.####.', '.####.', '......']));
    expect(c).toHaveLength(1);
    expect(Array.from(c[0].points)).toEqual([1, 1, 1, 3, 4, 3, 4, 1]);
    expect(c[0].hole).toBe(false);
    // the polygon through the corner pixels, as OpenCV measures it: 3 across, 2 down
    expect(ringArea(c[0].points)).toBe(6);
  });

  test('a blob with a hole has an outer border and a hole border that points back at it; an island in the hole is a blob of its own', () => {
    const c = findContours(mask([
      '#######',
      '#.....#',
      '#.###.#',
      '#.###.#',
      '#.....#',
      '#######',
    ]));
    expect(c.map(x => x.hole)).toEqual([false, true, false]);
    expect(c[1].parent).toBe(0);
    expect(c[2].parent).toBe(1);
    expect(c[0].parent).toBe(-1);
  });

  test('single pixels and one-pixel lines are rings of one and two points', () => {
    expect(Array.from(findContours(mask(['..', '.#']))[0].points)).toEqual([1, 1]);
    expect(Array.from(findContours(mask(['####']))[0].points)).toEqual([0, 0, 3, 0]);
  });

  test('diagonal neighbours are one blob (8-connected)', () => {
    expect(findContours(mask(['#...', '.#..', '..#.', '...#']))).toHaveLength(1);
  });

  test('simplifying drops points near the line between their neighbours, never more than the tolerance away', () => {
    const ring = [0, 0, 5, 0, 10, 0, 10, 5, 10, 10, 5, 10, 0, 10, 0, 5];
    const corners = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(simplifyRing(ring, 1)).toEqual(corners);
    expect(simplifyRing(ring, 0)).toEqual(corners);
    expect(simplifyRing([], 1)).toEqual([]);
    expect(simplifyRing([4, 4, 4, 5], 2)).toEqual([4, 4]);
  });

  test('a polygon fills its inside and its edges; fewer than three points select everything', () => {
    const m = fillPolygon([{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 8 }, { x: 1, y: 8 }], 10, 10);
    expect(maskArea(m)).toBe(64);
    expect(maskArea(fillPolygon([{ x: 1, y: 1 }], 4, 4))).toBe(16);
  });

  test('filling a border covers its holes', () => {
    const m = mask(['.....', '.###.', '.#.#.', '.###.', '.....']);
    expect(maskArea(fillChain(findContours(m)[0].chain, m.w, m.h))).toBe(9);
  });
});

describe('trace', () => {
  test('a disc with a hole is one shape with one hole, near the right area', () => {
    const t = traceImage(disc(60, 60, 30, 30, 22, [34, 28, 6]), { smoothing: 0, simplifyTolerance: 0.5 });
    expect(t.shapes).toHaveLength(1);
    expect(t.shapes[0].holes).toHaveLength(1);
    expect(t.shapes[0].outer.area).toBeGreaterThan(Math.PI * 21 ** 2 * 0.95);
    expect(t.shapes[0].outer.area).toBeLessThan(Math.PI * 22 ** 2);
    expect(t.thresholdUsed).toBeGreaterThan(10);
    expect(t.thresholdUsed).toBeLessThan(245);
  });

  test('keepHoles off traces outlines only; minArea and maxPaths drop what is under them and say so', () => {
    const img = disc(60, 60, 30, 30, 22, [34, 28, 6]);
    expect(traceImage(img, { keepHoles: false, smoothing: 0 }).shapes[0].holes).toEqual([]);
    const speck = traceMask(mask(['#..........#', '............', '...####.....', '...####.....']), { minArea: 3, simplifyTolerance: 0 });
    expect(speck.shapes).toHaveLength(1);
    expect(speck.droppedCount).toBe(2);
    expect(traceMask(mask(['###.###', '###.###', '###.###']), { maxPaths: 1, simplifyTolerance: 0, minArea: 0 }).droppedCount).toBe(1);
  });

  test('transparent pixels are not the subject when the alpha is respected', () => {
    const img = pic(['....', '.##.', '.##.', '....'], true);
    const on = traceImage(img, { smoothing: 0, blur: 0, minArea: 0 }), off = traceImage(img, { smoothing: 0, blur: 0, minArea: 0, respectAlpha: false });
    expect(on.shapes).toHaveLength(1);
    expect(off.shapes[0].outer.area).toBeGreaterThan(0);
  });

  test('the SVG has one even-odd path per shape and only checked colours', () => {
    const t = traceImage(disc(40, 40, 20, 20, 15, [24, 20, 4]), { smoothing: 0 });
    const svg = traceToSvg(t, { fill: '#AA3300', background: 'javascript:alert(1)' });
    expect(svg).toContain('viewBox="0 0 40 40"');
    expect(svg).toContain('fill="#aa3300" fill-rule="evenodd"');
    expect(svg).not.toContain('javascript');
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(traceToSvg(t, { fill: 'red' })).toContain('fill="#000000"');
    expect(ringToD({ points: Float32Array.from([1, 2, 3.456, 4]), area: 0 }, 1, { sx: 2, sy: 2, ox: 0.5, oy: 0 })).toBe('M2.5 4 L7.4 8 Z');
  });
});

describe('cut', () => {
  test('the silhouette is the dark subject in the chosen colour, holes filled and specks gone', () => {
    const rows = ['..............', '.##########...', '.#........#.#.', '.#..####..#...', '.#........#...', '.##########...', '..............'];
    const out = extractSilhouette(pic(rows), [], '#00ff00', { smoothing: 0 });
    const at = (x: number, y: number) => Array.from(out.d.slice((y * out.w + x) * 4, (y * out.w + x) * 4 + 4));
    expect(at(1, 1)).toEqual([0, 255, 0, 255]);
    expect(at(4, 3)).toEqual([0, 255, 0, 255]);
    expect(at(5, 2)).toEqual([0, 255, 0, 255]);
    expect(at(12, 2)).toEqual([0, 0, 0, 0]);
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('nothing leaves the lasso', () => {
    const img = pic(['########', '########', '########', '########']);
    const m = silhouetteMask(img, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 }], { smoothing: 0, keepLargestBlob: false, threshold: 128 });
    expect(maskArea(m)).toBe(16);
    expect(m.d[7]).toBe(0);
  });

  test('keepLargestFilledBlob leaves a mask with no blob as it is', () => {
    const empty = newMask(4, 4);
    expect(keepLargestFilledBlob(empty)).toBe(empty);
  });

  test('a token is cropped to the subject with its margin, optionally square and enlarged', () => {
    const img = pic(['....', '.##.', '.##.', '....'], true);
    expect(alphaBounds(img)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(alphaBounds(img, 1)).toEqual({ x: 0, y: 0, w: 4, h: 4 });
    expect(alphaBounds({ w: 2, h: 2, d: new Uint8ClampedArray(16) })).toBeNull();
    const wide = pic(['.....', '.###.', '.....'], true);
    const t = cropToken(wide, { padding: 0, square: true });
    expect([t.w, t.h]).toEqual([3, 3]);
    expect(t.d[(1 * 3 + 0) * 4 + 3]).toBe(255);
    expect(t.d[3]).toBe(0);
    const big = cropToken(img, { padding: 0, scale: 3 });
    expect([big.w, big.h]).toEqual([6, 6]);
    expect(() => cropToken({ w: 2, h: 2, d: new Uint8ClampedArray(16) })).toThrow('nothing to cut');
  });

  test('applyMask keeps the art where the mask is set; hex colours are checked', () => {
    const img = pic(['##', '##']);
    const m = newMask(2, 2);
    m.d[0] = 255;
    const out = applyMask(img, m);
    expect(Array.from(out.d.slice(0, 4))).toEqual([20, 20, 20, 255]);
    expect(Array.from(out.d.slice(4, 8))).toEqual([0, 0, 0, 0]);
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(() => hexToRgb('blue')).toThrow('not a valid hex colour');
  });

  test('Otsu puts the level between two clusters', () => {
    const g = new Uint8Array(100).fill(20);
    g.fill(200, 50);
    const level = otsu(g);
    expect(level).toBeGreaterThanOrEqual(20);
    expect(level).toBeLessThan(200);
  });
});

describe('slice', () => {
  const sheet = (w: number, h: number, boxes: [number, number, number, number][]): Pixels => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (const [x0, y0, bw, bh] of boxes) for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) d.set([200, 50, 50, 255], (y * w + x) * 4);
    return { w, h, d };
  };

  test('a grid by counts or by cell size, with margin and spacing, in reading order', () => {
    const img = sheet(34, 18, []);
    const byCount = sliceGrid(img, { cols: 4, rows: 2, margin: 1, spacing: 0 });
    expect(byCount).toHaveLength(8);
    expect(byCount[1]).toMatchObject({ index: 1, col: 1, row: 0, x: 9, y: 1, w: 8, h: 8 });
    const bySize = sliceGrid(img, { cellW: 8, cellH: 8, margin: 1, spacing: 0 });
    expect(bySize).toHaveLength(8);
    expect(sliceGrid(sheet(10, 10, []), { cols: 2, rows: 2, spacing: 2 }).map(c => c.w)).toEqual([4, 4, 4, 4]);
    expect(() => sliceGrid(img, {})).toThrow('give the columns and rows');
    expect(() => sliceGrid(img, { cellW: 100, cellH: 100 })).toThrow('no room for a cell');
  });

  test('empty cells can be skipped and cells trimmed to their sprite', () => {
    const img = sheet(16, 8, [[2, 2, 3, 3]]);
    expect(sliceGrid(img, { cols: 2, rows: 1, skipEmpty: true })).toHaveLength(1);
    expect(sliceGrid(img, { cols: 2, rows: 1, skipEmpty: true, trim: true })[0]).toMatchObject({ x: 2, y: 2, w: 3, h: 3, col: 0 });
  });

  test('loose sprites are found by their pixels and ordered by row, then left to right', () => {
    const img = sheet(40, 30, [[20, 2, 6, 8], [2, 3, 5, 7], [3, 20, 8, 8], [30, 21, 4, 6]]);
    const cells = sliceSprites(img, { gap: 1 });
    expect(cells.map(c => [c.x, c.y, c.row, c.col])).toEqual([[2, 3, 0, 0], [20, 2, 0, 1], [3, 20, 1, 0], [30, 21, 1, 1]]);
    expect(sliceSprites(sheet(20, 8, [[1, 1, 3, 3], [5, 1, 3, 3]]), { gap: 1 })).toHaveLength(1);
    expect(sliceSprites(sheet(20, 8, [[1, 1, 3, 3], [5, 1, 3, 3]]), { gap: 0 })).toHaveLength(2);
    expect(sliceSprites(sheet(8, 8, [[1, 1, 1, 1]]), { minSize: 2 })).toHaveLength(0);
  });

  test('loose sprites join exactly the pixels within gap + 1 of each other, at any gap', () => {
    const n = 26, rng = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed), d = new Uint8ClampedArray(n * n * 4), px: [number, number][] = [];
      for (let k = 0; k < 14; k++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); d[(y * n + x) * 4 + 3] = 255; px.push([x, y]); }
      for (const gap of [0, 1, 2, 3, 5]) {
        // brute force: union-find over every pair of opaque pixels within gap + 1 (Chebyshev)
        const set = [...new Set(px.map(([x, y]) => y * n + x))].map(i => [i % n, Math.floor(i / n)]), root = set.map((_, i) => i);
        const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
        for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) if (Math.max(Math.abs(set[i][0] - set[j][0]), Math.abs(set[i][1] - set[j][1])) <= gap + 1) root[find(i)] = find(j);
        const groups = new Set(set.map((_, i) => find(i))).size;
        expect(sliceSprites({ w: n, h: n, d }, { gap, minSize: 1 }), `seed ${seed} gap ${gap}`).toHaveLength(groups);
      }
    }
  });

  test('a large gap on a big sheet does not take longer for being large', () => {
    const w = 900, h = 900, d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 7) d[(y * w + x) * 4 + 3] = 255;
    const t = performance.now();
    expect(sliceSprites({ w, h, d }, { gap: 32, minSize: 1 })).toHaveLength(1);
    expect(performance.now() - t).toBeLessThan(3000);
  });

  test('crop clips to the picture', () => {
    const c = crop(sheet(4, 4, [[0, 0, 4, 4]]), { x: 2, y: 2, w: 10, h: 10 });
    expect([c.w, c.h]).toEqual([2, 2]);
  });
});

describe('palette', () => {
  const img = (): Pixels => { const d = new Uint8ClampedArray(16 * 4); for (let i = 0; i < 16; i++) d.set(i < 8 ? [200, 30, 30, 255] : [30, 30, 200, 255], i * 4); return { w: 4, h: 4, d }; };

  test('the dominant colours, then the picture snapped to a palette', () => {
    const p = paletteOf(img(), 2);
    expect(p.colors.sort()).toEqual(['#1e1ec8', '#c81e1e']);
    const snapped = snapToPalette(img(), ['#ff0000', '#0000ff']);
    expect(Array.from(snapped.d.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(snapped.d.slice(60, 64))).toEqual([0, 0, 255, 255]);
    expect(() => snapToPalette(img(), [])).toThrow('no colours');
  });

  test('palette files round-trip', () => {
    const colors = ['#ff0000', '#00aa11', '#0000ff'];
    expect(parsePaletteText(formatHex(colors))).toEqual(colors);
    expect(parsePaletteText(formatGpl(colors, 'test'))).toEqual(colors);
    expect(formatGpl(colors)).toContain('GIMP Palette');
    const s = swatchImage(colors, 4);
    expect([s.w, s.h]).toEqual([12, 4]);
    expect(Array.from(s.d.slice(0, 4))).toEqual([255, 0, 0, 255]);
  });
});
