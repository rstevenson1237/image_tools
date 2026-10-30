// The lighting model of lit sprites (docs/STAGES.md §7.2): decodeNormal and the reference shadeTexel.
import { describe, expect, test } from 'vitest';
import { decodeNormal, MAX_LIGHTS, shadeTexel, type LightRig, type PointLight } from './index.js';

const lamp = (o: Partial<PointLight> = {}): PointLight => ({ x: 0, y: 0, z: 8, color: [1, 1, 1], intensity: 1, radius: 20, ...o });
const rig = (o: Partial<LightRig> = {}): LightRig => ({ ambient: [0, 0, 0], lights: [], bands: 0, ...o });
const W: [number, number, number, number] = [200, 100, 50, 255];
const FLAT: [number, number, number] = [0, 0, 1];

describe('decodeNormal', () => {
  test('atlas RGB is OpenGL (y up); the result is a unit vector in screen space (y down)', () => {
    const flat = decodeNormal(128, 128, 255);
    expect(flat[0]).toBeCloseTo(0, 1); expect(flat[1]).toBeCloseTo(0, 1); expect(flat[2]).toBeCloseTo(1, 2);
    const up = decodeNormal(128, 255, 128);          // green high = up on the screen = negative y
    expect(up[1]).toBeLessThan(-0.9); expect(Math.hypot(...up)).toBeCloseTo(1);
    const right = decodeNormal(255, 128, 128);
    expect(right[0]).toBeGreaterThan(0.9);
    expect(decodeNormal(0, 128, 128)[0]).toBeLessThan(-0.9);
  });
  test('zero-length and transparent pixels face the viewer', () => {
    expect(decodeNormal(127.5, 127.5, 127.5)).toEqual([0, 0, 1]);
    expect(decodeNormal(255, 0, 0, 0)).toEqual([0, 0, 1]);
  });
  test('round trip with the encoder of the primitives: (x, y down, z) → pixel → back', () => {
    const enc = (n: [number, number, number]) => { const l = Math.hypot(...n); return [Math.round((n[0] / l * 0.5 + 0.5) * 255), Math.round((-n[1] / l * 0.5 + 0.5) * 255), Math.round((n[2] / l * 0.5 + 0.5) * 255)] as const; };
    for (const n of [[0.6, -0.48, 0.64], [-0.3, 0.5, 0.81], [0, 0, 1]] as [number, number, number][]) {
      const d = decodeNormal(...enc(n));
      for (let i = 0; i < 3; i++) expect(d[i]).toBeCloseTo(n[i], 1);
    }
  });
});

describe('shadeTexel', () => {
  test('ambient 1 and no lights draws the sprite unchanged; ambient scales the albedo; alpha is kept', () => {
    expect(shadeTexel(W, FLAT, 3, 4, rig({ ambient: [1, 1, 1] }))).toEqual(W);
    expect(shadeTexel([200, 100, 50, 90], FLAT, 0, 0, rig({ ambient: [0.5, 1, 0] }))).toEqual([100, 100, 0, 90]);
  });
  test('Lambert: a light straight above a flat texel lights it fully; one in the sprite plane or behind it does not', () => {
    const at = (l: Partial<PointLight>) => shadeTexel(W, FLAT, 0, 0, rig({ lights: [lamp({ radius: 1e6, ...l })] }));
    expect(at({ z: 1 })).toEqual([200, 100, 50, 255]);                                  // directly above: n · l = 1
    expect(at({ x: 1000, z: 0 }).slice(0, 3)).toEqual([0, 0, 0]);                        // in the plane: n · l = 0
    expect(at({ z: -5 }).slice(0, 3)).toEqual([0, 0, 0]);                                // behind the sprite
    const half = at({ x: 3, z: 3 });                                                    // 45 degrees: cos = 0.7071
    expect(half[0]).toBe(Math.round(200 * Math.SQRT1_2 * (1 - Math.hypot(3, 3) / 1e6) ** 2));
  });
  test('falloff is (1 − d / radius)² and zero at and beyond the radius', () => {
    const lum = (z: number) => shadeTexel([255, 255, 255, 255], FLAT, 0, 0, rig({ lights: [lamp({ z, radius: 10 })] }))[0];
    expect(lum(5)).toBe(Math.round(255 * 0.25)); expect(lum(10)).toBe(0); expect(lum(15)).toBe(0); expect(lum(0.001)).toBe(255);
  });
  test('a tilted normal is lit from the side it faces: normals toward the light brighten, away darken', () => {
    const toward: [number, number, number] = [0.6, 0, 0.8], away: [number, number, number] = [-0.6, 0, 0.8];
    const l = rig({ ambient: [0.1, 0.1, 0.1], lights: [lamp({ x: 10, y: 0, z: 4, radius: 40, color: [1, 1, 1] })] });
    expect(shadeTexel([255, 255, 255, 255], toward, 0, 0, l)[0]).toBeGreaterThan(shadeTexel([255, 255, 255, 255], away, 0, 0, l)[0]);
    // the texel's own position matters: moving it toward the light changes the angle and the distance
    expect(shadeTexel([255, 255, 255, 255], FLAT, 10, 0, l)[0]).toBeGreaterThan(shadeTexel([255, 255, 255, 255], FLAT, -10, 0, l)[0]);
  });
  test('lights add: colour × intensity per channel on top of the ambient, clamped at 255', () => {
    const one = shadeTexel([100, 100, 100, 255], FLAT, 0, 0, rig({ lights: [lamp({ z: 1, radius: 1000, color: [1, 0.5, 0], intensity: 2 })] }));
    expect(one[0]).toBeGreaterThan(one[1]); expect(one[2]).toBe(0);
    const two = shadeTexel([100, 100, 100, 255], FLAT, 0, 0, rig({ ambient: [0.5, 0.5, 0.5], lights: [lamp({ radius: 1000 }), lamp({ radius: 1000 })] }));
    expect(two[0]).toBe(Math.round(100 * (0.5 + 2 * (1 - 8 / 1000) ** 2)));
    expect(shadeTexel([255, 255, 255, 255], FLAT, 0, 0, rig({ ambient: [1, 1, 1], lights: [lamp({ radius: 1000, intensity: 5 })] }))[0]).toBe(255);
  });
  test('bands round the Lambert term to n steps; 0 is smooth', () => {
    const lum = (bands: number, x: number) => shadeTexel([255, 255, 255, 255], FLAT, x, 0, rig({ bands, lights: [lamp({ x: 0, y: 0, z: 6, radius: 1e9 })] }))[0];
    const seen = new Set<number>();
    for (let x = 0; x < 40; x++) seen.add(lum(3, x));
    expect(seen.size).toBeLessThanOrEqual(4);
    expect(new Set(Array.from({ length: 40 }, (_, x) => lum(0, x))).size).toBeGreaterThan(10);
    expect(lum(3, 0)).toBe(255);
  });
  test('a light with no radius adds nothing and only the first MAX_LIGHTS count', () => {
    expect(shadeTexel(W, FLAT, 0, 0, rig({ lights: [lamp({ radius: 0 })] })).slice(0, 3)).toEqual([0, 0, 0]);
    const many = Array.from({ length: MAX_LIGHTS + 4 }, () => lamp({ radius: 1000, intensity: 0.01 }));
    const capped = shadeTexel([255, 255, 255, 255], FLAT, 0, 0, rig({ lights: many }))[0], exact = shadeTexel([255, 255, 255, 255], FLAT, 0, 0, rig({ lights: many.slice(0, MAX_LIGHTS) }))[0];
    expect(capped).toBe(exact);
  });
});
