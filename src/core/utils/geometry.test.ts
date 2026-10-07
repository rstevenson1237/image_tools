import { describe, expect, it } from 'vitest';
import { integerZoom, stepIntegerZoom } from './geometry';

describe('pixel-mode zoom ladder', () => {
  it('fits to whole multiples or whole fractions', () => {
    expect(integerZoom(3.7)).toBe(3);
    expect(integerZoom(1)).toBe(1);
    expect(integerZoom(0.4)).toBe(1 / 3);
    expect(integerZoom(0)).toBe(1);
  });

  it('steps one rung at a time within the limits', () => {
    expect(stepIntegerZoom(3, 1, 0.05, 16)).toBe(4);
    expect(stepIntegerZoom(3, -1, 0.05, 16)).toBe(2);
    expect(stepIntegerZoom(1, -1, 0.05, 16)).toBe(1 / 2);
    expect(stepIntegerZoom(1 / 2, 1, 0.05, 16)).toBe(1);
    expect(stepIntegerZoom(1 / 3, 1, 0.05, 16)).toBe(1 / 2);
    expect(stepIntegerZoom(1 / 3, -1, 0.05, 16)).toBe(1 / 4);
    expect(stepIntegerZoom(16, 1, 0.05, 16)).toBe(16);
    expect(stepIntegerZoom(1 / 20, -1, 0.05, 16)).toBe(1 / 20);
    expect(stepIntegerZoom(2.6, 1, 0.05, 16)).toBe(3);
  });
});
