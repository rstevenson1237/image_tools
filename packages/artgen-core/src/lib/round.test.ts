import { describe, expect, test } from 'vitest';
import { percentShares, roundTo } from './round.ts';

describe('rounding', () => {
  test('roundTo gives whole multiples of the step, without float noise or -0', () => {
    expect(roundTo(137, 5)).toBe(135);
    expect(roundTo(137.5, 5)).toBe(140);
    expect(roundTo(0.30000000000000004, 0.1)).toBe(0.3);
    expect(roundTo(-1, 5)).toBe(0);
    expect(Object.is(roundTo(-1, 5), 0)).toBe(true);
    expect(roundTo(2.26, 0.1)).toBe(2.3);
  });

  test('percentShares are whole percent that add up to 100, ties to the earlier entry; empty shares are dropped', () => {
    expect(percentShares([['a', 1], ['b', 1], ['c', 1]])).toEqual([['a', 34], ['b', 33], ['c', 33]]);
    expect(percentShares([['forest', 92], ['marsh', 8]])).toEqual([['forest', 92], ['marsh', 8]]);
    expect(percentShares([['a', 1000], ['b', 1]])).toEqual([['a', 100]]);
    expect(percentShares([['a', 0], ['b', 3]])).toEqual([['b', 100]]);
    expect(percentShares([])).toEqual([]);
    const s = percentShares([['a', 333], ['b', 333], ['c', 334], ['d', 7]]);
    expect(s.reduce((n, [, v]) => n + v, 0)).toBe(100);
  });
});
