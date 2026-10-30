// Raster decals (docs/STAGES.md §7.1): shape coverage, colouring in toGrid(), masks and stats.
import { describe, expect, test } from 'vitest';
import { decalCoverage, flipMaskX, INK, Raster } from './raster.ts';

const RAMP = ['#ffffff', '#aaaaaa', '#555555'], DECAL = ['#ff0000', '#aa0000', '#550000'];
function flat(w = 6, h = 4): Raster {
  const r = new Raster(w, h, [{ name: 'body', ramp: RAMP, levels: [0, 1, 2], rank: 0 }], '#000000');
  r.id.fill(0); r.band.fill(1);
  return r;
}

describe('decalCoverage', () => {
  test('rect, ellipse, circle, poly and path cover pixels by majority of their 4 x 4 samples', () => {
    const n = (s: Parameters<typeof decalCoverage>[0], w = 8, h = 8) => decalCoverage(s, w, h).reduce((a, v) => a + v, 0);
    expect(n({ type: 'rect', x: 1, y: 1, w: 3, h: 2 })).toBe(6);
    expect(n({ type: 'rect', x: 0.5, y: 0, w: 2, h: 1 })).toBe(1);   // a half-covered pixel at each end: only exact majority counts
    expect(n({ type: 'circle', cx: 4, cy: 4, r: 2 })).toBeGreaterThanOrEqual(12);
    expect(n({ type: 'ellipse', cx: 4, cy: 4, rx: 3, ry: 1 })).toBeGreaterThan(n({ type: 'ellipse', cx: 4, cy: 4, rx: 1, ry: 1 }));
    expect(n({ type: 'poly', pts: [[0, 0], [4, 0], [0, 4]] })).toBeGreaterThanOrEqual(6);
    expect(n({ type: 'path', d: 'M1 1 H5 V3 H1 Z' })).toBe(8);
    expect(n([{ type: 'rect', x: 0, y: 0, w: 1, h: 1 }, { type: 'rect', x: 7, y: 7, w: 5, h: 5 }])).toBe(2);
  });
  test('bad shapes throw with the field name', () => {
    expect(() => decalCoverage({ type: 'rect', w: 2 }, 4, 4)).toThrow(/h must be a number/);
    expect(() => decalCoverage({ type: 'line' }, 4, 4)).toThrow(/not one of rect/);
  });
  test('flipMaskX mirrors rows', () => expect(Array.from(flipMaskX(Uint8Array.from([1, 1, 0, 0, 0, 1]), 3))).toEqual([0, 1, 1, 1, 0, 0]));
});

describe('Raster decals', () => {
  test('toGrid colours decal pixels with the decal ramp at the band under them, or a fixed band; ink stays ink', () => {
    const r = flat();
    r.flag[1] = INK;
    r.band[2] = 0; r.band[3] = 2;
    const keep = r.addDecal({ name: 'a', ramp: DECAL }), fixed = r.addDecal({ name: 'b', ramp: DECAL, band: 2 });
    r.decal![1] = 0; r.decal![2] = 0; r.decal![3] = 0; r.decal![4] = 1; r.decal![5] = 1;
    keep.total = 3; keep.inside = 2;
    const g = r.toGrid();
    expect(g.get(1, 0)).toBe('#000000');          // ink is never covered
    expect(g.get(2, 0)).toBe(DECAL[0]); expect(g.get(3, 0)).toBe(DECAL[2]);
    expect(g.get(4, 0)).toBe(DECAL[2]); expect(g.get(5, 0)).toBe(DECAL[2]);
    expect(g.get(0, 0)).toBe(RAMP[1]);
    expect(fixed.band).toBe(2);
  });
  test('the band is clamped to a shorter decal ramp', () => {
    const r = flat();
    r.addDecal({ name: 'a', ramp: ['#ff0000', '#00ff00'] }); r.decal![0] = 0; r.band[0] = 2;
    expect(r.color(0)).toBe('#00ff00');
  });
  test('masks and stats by name; none without a decal', () => {
    const r = flat();
    expect(r.decalMasks()).toBeUndefined(); expect(r.decalStats()).toBeUndefined();
    const a = r.addDecal({ name: 'a', ramp: DECAL }); r.addDecal({ name: 'b', ramp: DECAL });
    r.decal![0] = 0; r.decal![1] = 0; r.decal![1] = 1; r.flag[2] = INK; r.decal![2] = 0;
    a.total = 5; a.inside = 3;
    expect(Array.from(r.decalMasks()!.a.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(r.decalMasks()!.b.slice(0, 3))).toEqual([0, 1, 0]);
    expect(r.decalStats()).toEqual({ a: { inside: 3, total: 5 }, b: { inside: 0, total: 0 } });
  });
});
