// Stage tests for the post passes (R8/R9): each stage is checked on its own, before features build on it.
import { describe, expect, test } from 'vitest';
import { Grid } from './grid.ts';
import { despeckle, dropShadow, modeDownsample, outline, quantize, selout } from './post.ts';

const O = '#1a1423';
const filled = (g: Grid, x: number, y: number) => g.alpha(x, y) > 0;

describe('outline', () => {
  test('exact 1 px ring: every outline pixel touches the shape, nothing at distance 2, fill untouched', () => {
    const g = new Grid(12, 12);
    g.fill(3, 3, 6, 5, '#eeeeee'); g.set(5, 2, '#eeeeee');
    const o = outline(g, O);
    let ring = 0;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      if (filled(g, x, y)) { expect(o.get(x, y)).toBe(g.get(x, y)); continue; }
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(g, x + dx, y + dy));
      expect(o.get(x, y)).toBe(touches ? O : null);
      if (touches) ring++;
    }
    expect(ring).toBe(2 * 6 + 2 * 5); // the bump trades its own ring pixel for the one above it
  });
  test('diagonal mode also fills corners', () => {
    const g = new Grid(3, 3);
    g.set(1, 1, '#ffffff');
    expect(outline(g, O).get(0, 0)).toBeNull();
    expect(outline(g, O, true).get(0, 0)).toBe(O);
  });
  test('selout takes the darkest step of the neighbouring ramp', () => {
    const g = new Grid(3, 1);
    g.set(1, 0, '#ffaaaa');
    const s = selout(g, [['#ffaaaa', '#aa0000', '#550000']], O);
    expect([s.get(0, 0), s.get(2, 0)]).toEqual(['#550000', '#550000']);
    const t = new Grid(3, 1); t.set(1, 0, '#123456');
    expect(selout(t, [['#ffaaaa']], O).get(0, 0)).toBe(O);
  });
});

describe('quantize', () => {
  const pal = ['#000000', '#ffffff', '#ff0000'];
  test('0 off-palette pixels after quantize; alpha cut to 0/255', () => {
    const g = new Grid(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, `rgba(${x * 16},${y * 16},${(x * y) % 256},${((x + y) / 31).toFixed(3)})`);
    const q = quantize(g, pal);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = q.alpha(x, y);
      expect([0, 255]).toContain(a);
      if (a) expect(pal).toContain(q.get(x, y));
      expect(a === 255).toBe(g.alpha(x, y) >= 128);
    }
  });
  test('ordered dither mixes the two nearest colours', () => {
    const g = new Grid(4, 4).fill(0, 0, 4, 4, '#808080');
    const plain = quantize(g, ['#000000', '#ffffff']), d = quantize(g, ['#000000', '#ffffff'], { dither: 'bayer2' });
    expect(new Set(plain.toIndexed().palette).size).toBe(1);
    expect(d.toIndexed().palette.sort()).toEqual(['#000000', '#ffffff']);
  });
});

describe('modeDownsample', () => {
  test('1 px line preservation: a line one block wide at ss survives as exactly 1 px', () => {
    const ss = 8, big = new Grid(16 * ss, 16 * ss);
    big.fill(5 * ss, 2 * ss, ss, 12 * ss, '#ffffff'); // 1 px wide at final res
    big.fill(0, 8 * ss, 16 * ss, ss, '#ff0000');      // 1 px tall crossing line
    const g = modeDownsample(big, ss);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const want = y === 8 ? (x === 5 ? '#ffffff' : '#ff0000') : x === 5 && y >= 2 && y < 14 ? '#ffffff' : null;
      if (y === 8 && x === 5) continue; // crossing: either colour is a majority tie-break
      expect(g.get(x, y)).toBe(want);
    }
  });
  test('blocks that are mostly empty stay empty; majority colour wins', () => {
    const big = new Grid(4, 2);
    big.set(0, 0, '#ff0000'); // 1 of 4 in block 0
    big.fill(2, 0, 2, 2, '#00ff00'); big.set(3, 1, '#0000ff');
    const g = modeDownsample(big, 2);
    expect([g.get(0, 0), g.get(1, 0)]).toEqual([null, '#00ff00']);
  });
});

describe('dropShadow + despeckle', () => {
  test('shadow goes under the sprite only', () => {
    const g = new Grid(4, 4); g.set(1, 1, '#ffffff');
    const s = dropShadow(g, 1, 1, 'rgba(0,0,0,0.35)');
    expect(s.get(1, 1)).toBe('#ffffff');
    expect(s.alpha(2, 2)).toBe(89);
  });
  test('despeckle replaces an isolated pixel surrounded by one colour', () => {
    const g = new Grid(3, 3).fill(0, 0, 3, 3, '#000000'); g.set(1, 1, '#ffffff');
    expect(despeckle(g).get(1, 1)).toBe('#000000');
  });
});
