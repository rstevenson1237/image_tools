import { describe, expect, test } from 'vitest';
import { BENCH_DIRECTIONS } from '../bench/index.ts';
import { dirContext, kindPalette, parseDirection, resolveSize, resolveToken, validateDirection } from './direction.ts';

const minimal = () => ({
  id: 'swamp', version: 1, status: 'draft',
  camera: { view: 'topdown' },
  palette: { ramps: { moss: ['#8FCF5E', '#4e8f3e', '#2c5a2e'], bone: ['#eeeeee', '#bbbbbb'] }, outline: '#1a1423' },
});

describe('validateDirection', () => {
  test('bench directions are valid', () => {
    for (const d of Object.values(BENCH_DIRECTIONS)) expect(validateDirection(d).errors).toEqual([]);
  });

  test('fills defaults for optional sections', () => {
    const d = parseDirection(minimal());
    expect(d.camera.light).toEqual([-1, -1, 1]);
    expect(d.line.outer).toBe('dark');
    expect(d.shading).toMatchObject({ bands: 3, dither: 'none' });
    expect(d.pipeline.revisionPasses).toBe(3);
    expect(d.palette.shadow).toEqual({ color: '#000000', alpha: 0.35 });
  });

  test('reports every error with its path', () => {
    const bad = minimal() as any;
    bad.status = 'final'; bad.camera.view = 'diagonal'; bad.palette.ramps.moss[1] = 'green'; bad.palette.ramps.outline = ['#000000'];
    bad.palette.materials = { metal: 'iron' }; bad.shading = { dither: 'fancy' }; bad.scale = { character: [24, 0] };
    const r = validateDirection(bad);
    expect(r.ok).toBe(false);
    const paths = r.errors.map(e => e.split(':')[0]);
    expect(paths).toEqual(expect.arrayContaining(['status', 'camera.view', 'palette.ramps.moss[1]', 'palette.ramps.outline',
      'palette.materials.metal', 'shading.dither', 'scale.character[1]']));
    expect(() => parseDirection(bad)).toThrow('invalid direction');
    expect(validateDirection('nope').ok).toBe(false);
  });

  test('maxColors is enforced against the ramps', () => {
    const d = minimal() as any;
    d.palette.maxColors = 4;
    expect(validateDirection(d).errors[0]).toMatch(/^palette.maxColors: ramps hold 5 colours/);
  });
});

describe('tokens', () => {
  const d = parseDirection({ ...minimal(), palette: { ...minimal().palette, materials: { foliage: 'moss' }, perKind: { effect: ['bone'] } }, scale: { character: [24, 24], tile: 16 } });
  test('dirContext lower-cases ramps and builds the shadow rgba', () => {
    const c = dirContext(d);
    expect(c.pal.moss[0]).toBe('#8fcf5e');
    expect(c.shadow).toBe('rgba(0,0,0,0.35)');
    expect(c.outline).toBe('#1a1423');
  });
  test('resolveToken: ramp index, ramp middle, material, outline', () => {
    expect(resolveToken(d, 'moss.2')).toBe('#2c5a2e');
    expect(resolveToken(d, 'moss')).toBe('#4e8f3e');
    expect(resolveToken(d, 'foliage.0')).toBe('#8fcf5e');
    expect(resolveToken(d, 'outline')).toBe('#1a1423');
    expect(() => resolveToken(d, 'moss.9')).toThrow('out of range');
    expect(() => resolveToken(d, 'lava')).toThrow('unknown');
  });
  test('kindPalette honours perKind restrictions', () => {
    expect(kindPalette(d, 'effect')).toEqual(['#eeeeee', '#bbbbbb', '#1a1423']);
    expect(kindPalette(d, 'character')).toHaveLength(6);
  });
  test('resolveSize from scale keys or explicit sizes', () => {
    expect(resolveSize(d, 'character')).toEqual([24, 24]);
    expect(resolveSize(d, undefined, 'tile')).toEqual([16, 16]);
    expect(resolveSize(d, [8, 4])).toEqual([8, 4]);
    expect(() => resolveSize(d, 'huge')).toThrow('no size');
  });
});
