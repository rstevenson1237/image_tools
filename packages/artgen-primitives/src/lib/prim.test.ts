import { describe, expect, test } from 'vitest';
import { bandRamp, mirrorSpec, R, Scene } from './prim.ts';
import { Voxels, face } from './voxel.ts';

const O = '#1a1423', M = ['#eeeeee', '#999999', '#444444'];

describe('T2 primitives (artlab prim port)', () => {
  test('rasterisers sample pixel centres', () => {
    expect(R.rect({ type: 'rect', x: 1, y: 1, w: 2, h: 2 })).toEqual([[1, 1], [2, 1], [1, 2], [2, 2]]);
    expect(R.ellipse({ type: 'ellipse', cx: 2, cy: 2, rx: 1, ry: 1 })).toHaveLength(4);
    expect(R.line({ type: 'line', x0: 0, y0: 0, x1: 3, y1: 0 })).toHaveLength(4);
    expect(R.poly({ type: 'poly', pts: [[0, 0], [4, 0], [0, 4]] }).length).toBe(6); // centres with x + y < 3
  });

  test('mirrorX adds the mirrored shape', () => {
    const s = new Scene(10, 4, { outlineColor: O }).add({ type: 'rect', x: 1, y: 1, w: 2, h: 2, mat: M, shade: 'flat', mirrorX: 5 });
    expect(s.shapes).toHaveLength(2);
    expect(s.shapes[1].x).toBe(7);
    expect(mirrorSpec({ type: 'line', x0: 0, y0: 0, x1: 2, y1: 0 }, 5).x0).toBe(9);
    const g = s.render({ outline: false });
    for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) expect(g.get(x, y)).toBe(g.get(9 - x, y));
  });

  test('bevel shading follows the light; outline and shadow need colours', () => {
    const s = new Scene(6, 6, { light: [-1, -1, 1], outlineColor: O, shadowColor: 'rgba(0,0,0,0.35)' }).add({ type: 'rect', x: 1, y: 1, w: 4, h: 4, mat: M, shade: 'bevel' });
    const g = s.render({ shadow: [1, 1] });
    expect(g.get(1, 1)).toBe(M[0]); // upper-left lit
    expect(g.get(4, 4)).toBe(M[2]); // lower-right dark
    expect(g.get(0, 2)).toBe(O);
    expect(() => new Scene(4, 4).add({ type: 'rect', x: 1, y: 1, w: 1, h: 1, color: '#ffffff' }).render()).toThrow('outline colour');
    const flipped = new Scene(6, 6, { light: [1, 1, 1], outlineColor: O }).add({ type: 'rect', x: 1, y: 1, w: 4, h: 4, mat: M, shade: 'bevel' }).render();
    expect(flipped.get(4, 4)).toBe(M[0]);
  });

  test('bands cap the colours a material uses', () => {
    expect(bandRamp(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['a', 'c', 'e']);
    expect(bandRamp(['a', 'b'], 3)).toEqual(['a', 'b']);
    const g = new Scene(16, 16, { bands: 2, outlineColor: O }).add({ type: 'ellipse', cx: 8, cy: 8, rx: 6, ry: 6, mat: ['#ffffff', '#cccccc', '#999999', '#666666', '#333333'], shade: 'sphere' }).render({ outline: false });
    expect(g.toIndexed().palette.sort()).toEqual(['#333333', '#ffffff']);
  });
});

describe('voxel cubes renderer (artlab T4 port)', () => {
  test('a single voxel stamps a 4×4 cube with lit top, mid left, dark right', () => {
    const v = new Voxels({ outlineColor: O, shadowColor: 'rgba(0,0,0,0.35)' }).set(0, 0, 1, face(M));
    const g = v.render(8, 8, { ox: 4, oy: 2, outline: false, edgeLight: false });
    expect(g.get(2, 0)).toBe(M[0]);
    expect(g.get(2, 2)).toBe(M[1]);
    expect(g.get(5, 3)).toBe(M[2]);
  });
  test('k subdivides boxes; paint recolours; colours must be supplied', () => {
    const v = new Voxels({ k: 2 }).box(0, 0, 0, 0, 0, 0, face(M));
    expect(v.m.size).toBe(8);
    const G = face(['#ffff00', '#cccc00', '#888800']);
    v.paint((x, _y, _z, r) => (x === 0 ? G : r));
    expect([...v.m.values()].filter(e => e[3] === G)).toHaveLength(4);
    expect(() => v.render(16, 16, { ox: 8, oy: 4 })).toThrow('missing');
  });
  test('ss path renders at final size with outline', () => {
    const v = new Voxels({ outlineColor: O, shadowColor: 'rgba(0,0,0,0.35)' }).box(0, 0, 0, 2, 2, 2, face(M));
    const g = v.render(24, 24, { ox: 12, oy: 6, ss: 2, shadowAt: [12, 18, 6] });
    expect([g.w, g.h]).toEqual([24, 24]);
    expect(g.toIndexed().palette).toContain(O);
  });
});
