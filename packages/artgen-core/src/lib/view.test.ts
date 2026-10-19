import { expect, test } from 'vitest';
import { clampCrop, fitPpu, frameOf, parseCrop, parseFit, PX_PER_MM, sizeAttrs } from './view.ts';

test('parseCrop reads units, or grid cells with "cells"', () => {
  expect(parseCrop('0,127,16,46')).toEqual([0, 127, 16, 46]);
  expect(parseCrop(' 1, 2, 3, 4 cells', 2)).toEqual([2, 4, 6, 8]);
  expect(parseCrop('1,2,3,4cells')).toEqual([1, 2, 3, 4]);
  for (const bad of ['1,2,3', '1,2,3,x', '1,2,0,4', '1,2,,4', '']) expect(() => parseCrop(bad), bad).toThrow(/--crop/);
});

test('parseFit reads WxH with mm or px', () => {
  expect(parseFit('180x260mm')).toEqual({ w: 180, h: 260, unit: 'mm' });
  expect(parseFit('800x600')).toEqual({ w: 800, h: 600, unit: 'px' });
  expect(parseFit('80.5X60px')).toEqual({ w: 80.5, h: 60, unit: 'px' });
  for (const bad of ['180', '0x5mm', '180x260in', 'x']) expect(() => parseFit(bad), bad).toThrow(/--fit/);
});

test('fitPpu fits the long side and keeps the aspect', () => {
  expect(fitPpu(16, 184, { w: 180, h: 260, unit: 'mm' })).toBeCloseTo((260 * PX_PER_MM) / 184, 9);
  expect(fitPpu(39, 15, { w: 780, h: 600, unit: 'px' })).toBe(20);
});

test('clampCrop cuts the window to the sheet and refuses one outside it', () => {
  expect(clampCrop([-2, 10, 8, 100], 16, 50)).toEqual([0, 10, 6, 40]);
  expect(() => clampCrop([20, 0, 5, 5], 16, 50)).toThrow(/outside the sheet/);
});

test('frameOf and sizeAttrs: the whole sheet by default; mm sizes are millimetres', () => {
  const whole = frameOf(undefined, 16, 184, 40);
  expect(sizeAttrs(whole)).toBe('width="640" height="7360" viewBox="0 0 640 7360"');
  const f = frameOf([0, 10, 16, 20], 16, 184, 5);
  expect(f).toMatchObject({ x: 0, y: 50, w: 80, h: 100, r: 80, b: 150 });
  expect(sizeAttrs(f, 'mm')).toContain('viewBox="0 50 80 100"');
  expect(sizeAttrs(f, 'mm')).toMatch(/^width="21\.17mm" height="26\.46mm"/);
});
