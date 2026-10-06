// Stage tests for the SVG raster path (R3, R8): raster → quantize → mode-downsample → outline.
import { beforeAll, describe, expect, test } from 'vitest';
import { doc, Grid, post, svgToGrid } from 'artgen-core';
import { initNodeSvg } from './node.ts';

const O = '#1a1423', PAL = ['#eef2f5', '#77838f', '#4a5460', '#ff8a3c', O];
beforeAll(() => initNodeSvg());

const partial = (g: Grid) => { let n = 0; for (let i = 3; i < g.d.length; i += 4) if (g.d[i] > 0 && g.d[i] < 255) n++; return n; };
const offPalette = (g: Grid, pal: string[]) => { let n = 0; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c && !pal.includes(c)) n++; } return n; };

describe('svg ss raster path', () => {
  test('ss detail: a sub-pixel-edged circle comes out crisp — no partial alpha, unlike raw AA', () => {
    const svg = doc(16, 16, `<circle cx="8.3" cy="7.6" r="4.4" fill="${PAL[1]}"/><rect x="2" y="2" width="2" height="2" fill="${PAL[3]}"/>`);
    const raw = svgToGrid(svg, 16, 16, { mode: 'raw' }), ss = svgToGrid(svg, 16, 16, { mode: 'ss', ss: 8, pal: PAL });
    expect(partial(raw)).toBeGreaterThan(0);
    expect(partial(ss)).toBe(0);
    expect(ss.get(8, 7)).toBe(PAL[1]);
    expect([ss.get(2, 2), ss.get(3, 3), ss.get(4, 4)]).toEqual([PAL[3], PAL[3], null]); // small detail kept exactly
  });

  test('1 px line preservation: a 1-unit rect stays exactly one pixel wide over its whole length', () => {
    const g = svgToGrid(doc(16, 16, `<rect x="7" y="2" width="1" height="12" fill="${PAL[0]}"/><rect x="2" y="9" width="5" height="1" fill="${PAL[2]}"/>`), 16, 16, { mode: 'ss', ss: 8, pal: PAL });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const want = x === 7 && y >= 2 && y < 14 ? PAL[0] : y === 9 && x >= 2 && x < 7 ? PAL[2] : null;
      expect(g.get(x, y)).toBe(want);
    }
  });

  test('0 off-palette pixels after quantize, even from gradients', () => {
    const svg = doc(24, 24, `<defs><radialGradient id="g"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#000000"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#g)"/>`);
    for (const mode of ['crisp', 'ss'] as const) {
      const g = svgToGrid(svg, 24, 24, { mode, pal: PAL });
      expect(offPalette(g, PAL)).toBe(0);
      expect(partial(g)).toBe(0);
    }
  });

  test('exact 1 px outline at final resolution', () => {
    const svg = doc(16, 16, `<rect x="4" y="4" width="8" height="6" fill="${PAL[0]}"/>`);
    const plain = svgToGrid(svg, 16, 16, { mode: 'ss', pal: PAL }), out = svgToGrid(svg, 16, 16, { mode: 'ss', pal: PAL, outline: O });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (plain.get(x, y)) { expect(out.get(x, y)).toBe(plain.get(x, y)); continue; }
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => plain.get(x + dx, y + dy));
      expect(out.get(x, y)).toBe(touches ? O : null);
    }
    expect(post.outline(plain, O).diffCount(out)).toBe(0);
  });

  test('every stage is inspectable, in pipeline order and size', () => {
    const seen: [string, number][] = [];
    svgToGrid(doc(8, 8, `<rect x="2" y="2" width="4" height="4" fill="${PAL[1]}"/>`), 8, 8,
      { mode: 'ss', ss: 4, pal: PAL, outline: O, shadow: [1, 1], shadowColor: 'rgba(0,0,0,0.35)', stage: (n, g) => seen.push([n, g.w]) });
    expect(seen).toEqual([['raster', 32], ['quantize', 32], ['downsample', 8], ['outline', 8], ['shadow', 8]]);
  });

  test('ss mode without a palette is an error', () => {
    expect(() => svgToGrid(doc(4, 4, ''), 4, 4, { mode: 'ss' })).toThrow('needs a palette');
  });
});
