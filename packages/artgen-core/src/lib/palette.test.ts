import { describe, expect, test } from 'vitest';
import { lumaOf, toHsl } from './color.ts';
import { Grid } from './grid.ts';
import { extractPalette, generateRamp, medianCut, parseGpl, parseHexPalette, rampsFromColors, restrict, swapColors } from './palette.ts';

describe('palette import', () => {
  test('Lospec .hex', () => {
    expect(parseHexPalette('1A1423\n#ffe27a\n\nnot a colour\r\n00ff00')).toEqual(['#1a1423', '#ffe27a', '#00ff00']);
  });
  test('GIMP .gpl', () => {
    const gpl = 'GIMP Palette\nName: test\nColumns: 4\n#\n 26  20  35\tOutline\n255 226 122 Gold\n';
    expect(parseGpl(gpl)).toEqual(['#1a1423', '#ffe27a']);
  });
});

describe('generateRamp', () => {
  test('lightest first, monotonic lightness, hue shifts warm/cool at the ends', () => {
    const r = generateRamp('#3f68b8', { steps: 5, hueShift: 20 });
    expect(r).toHaveLength(5);
    for (let i = 1; i < r.length; i++) expect(lumaOf(r[i])).toBeLessThan(lumaOf(r[i - 1]));
    const base = toHsl('#3f68b8').h;
    // blue (~220°): highlights move toward 60° (smaller hue), shadows toward 240°
    expect(toHsl(r[0]).h).toBeLessThan(base);
    expect(toHsl(r[4]).h).toBeGreaterThan(base);
  });
  test('grey stays grey; one step returns the base', () => {
    const r = generateRamp('#808080', { steps: 3 });
    for (const c of r) expect(toHsl(c).s).toBeLessThan(0.05);
    expect(generateRamp('#808080', { steps: 1 })).toEqual(['#808080']);
  });
});

describe('extract from image', () => {
  const img = () => {
    const g = new Grid(8, 8);
    const cols = ['#ff0000', '#aa0000', '#0000ff', '#000088'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.set(x, y, cols[(x >> 1) % 4]);
    return g;
  };
  test('median cut recovers the distinct colours', () => {
    expect(medianCut(img(), 4).sort()).toEqual(['#000088', '#0000ff', '#aa0000', '#ff0000']);
    expect(medianCut(new Grid(2, 2), 4)).toEqual([]);
  });
  test('ramps group by hue and sort light → dark', () => {
    const { ramps } = extractPalette(img(), 4);
    expect(Object.values(ramps)).toEqual(expect.arrayContaining([['#ff0000', '#aa0000'], ['#0000ff', '#000088']]));
    expect(rampsFromColors(['#ffffff', '#808080', '#ff0000'])).toEqual({ r0: ['#ff0000'], r1: ['#ffffff', '#808080'] });
  });
});

describe('restrict + swap', () => {
  test('restrict flattens named ramps plus extras, unique', () => {
    const ramps = { a: ['#111111', '#222222'], b: ['#333333'] };
    expect(restrict(ramps, ['b'], ['#111111'])).toEqual(['#333333', '#111111']);
    expect(restrict(ramps)).toEqual(['#111111', '#222222', '#333333']);
    expect(() => restrict(ramps, ['zzz'])).toThrow('unknown ramp');
  });
  test('swap replaces colours and keeps alpha', () => {
    const g = new Grid(2, 1);
    g.set(0, 0, '#111111'); g.set(1, 0, 'rgba(17,17,17,0.5)');
    const s = swapColors(g, { '#111111': '#abcdef' });
    expect(s.get(0, 0)).toBe('#abcdef');
    expect(s.alpha(1, 0)).toBe(128);
  });
});
