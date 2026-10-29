// P6b: periodic noise, material recipes (seamless, palette-exact, normal maps), seam / repetition metrics, autotile
// synthesis (canonical order, neighbours continue), iso floor / block tiles, WFC, L-systems.
import { describe, expect, test } from 'vitest';
import { conformance } from '../qa/conformance.ts';
import { dirContext, kindPalette, parseDirection, type Direction } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { getNormal } from 'artgen-primitives/lib/normals.ts';
import { periodicPatch, repetitionIssues, repetitionMetric, seamMetric } from '../qa/tiles.ts';
import { isoFloorTile } from 'artgen-scene/tex/iso.ts';
import { material, MATERIALS } from 'artgen-scene/tex/materials.ts';

const RAMPS = {
  stone: ['#c8ccd0', '#8e959c', '#5a6068', '#30343a'], dirt: ['#a08060', '#6e5440', '#40302a'], grass: ['#9ac060', '#5e8a3a', '#2e4a22'],
  wood: ['#c89860', '#8a6038', '#4a321e'], metal: ['#e0e4e8', '#a0a8b0', '#606870'], accent: ['#ffc060', '#e07020', '#802010'],
  cloth: ['#80a0d0', '#4060a0', '#203060'], glow: ['#fff0a0', '#ffc040'], leather: ['#a07050', '#604030'],
};
const dir: Direction = parseDirection({ id: 'tex', version: 1, status: 'locked', camera: { view: 'topdown' }, scale: { tile: 32 }, palette: { ramps: RAMPS, outline: '#101014' }, shading: { bands: 3 } });
const dc = dirContext(dir);

describe('materials', () => {
  test('every recipe: palette-exact on the direction ramps, seamless (the wrap step is like the interior), with a wrapping normal map', () => {
    const pal = new Set(kindPalette(dir));
    for (const m of MATERIALS) for (const n of [32, 64]) {
      const t = material(m, dc, { w: n, h: n, seed: 2 });
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) expect(pal.has(t.grid.get(x, y)!), `${m} ${x},${y}`).toBe(true);
      expect(seamMetric(t.grid).ratio, `${m} ${n}`).toBeLessThan(2.6); // designed grout on the border (planks, plates) sits above 1
      expect(t.normal.w).toBe(n);
      expect(getNormal(t.normal, 0, 0)).not.toBeNull();
    }
  });

  test('deterministic per seed; role overrides pick other ramps; unknown recipes are named', () => {
    expect(material('cobble', dc, { w: 32, h: 32, seed: 4 }).grid.hash()).toBe(material('cobble', dc, { w: 32, h: 32, seed: 4 }).grid.hash());
    expect(material('cobble', dc, { w: 32, h: 32, seed: 4 }).grid.hash()).not.toBe(material('cobble', dc, { w: 32, h: 32, seed: 5 }).grid.hash());
    expect(material('stone', dc, { w: 16, h: 16, ramps: { base: 'cloth' } }).ramps.base).toBe('cloth');
    expect(() => material('marble', dc, { w: 16, h: 16 })).toThrow(/unknown material.*cobble/);
  });
});

describe('tile metrics', () => {
  test('seam: a tile cut from a gradient shows its seam, a periodic one does not', () => {
    const grad = new Grid(16, 16), per = material('dirt', dc, { w: 16, h: 16 }).grid;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) grad.set(x, y, RAMPS.stone[Math.min(3, x >> 2)]);
    expect(seamMetric(grad).ratio).toBeGreaterThan(2);
    expect(seamMetric(per).ratio).toBeLessThan(1.8);
  });

  test('repetition: one big blotch or a few strong marks read as a grid; an even field of grit does not', () => {
    const plain = material('dirt', dc, { w: 64, h: 64, seed: 3 }).grid, blotch = plain.clone(), marks = plain.clone();
    blotch.fill(4, 4, 24, 24, RAMPS.stone[0]);
    for (const [x, y] of [[10, 10], [40, 22], [20, 50]]) marks.fill(x, y, 3, 2, RAMPS.glow[0]);
    expect(repetitionIssues(repetitionMetric(plain))).toEqual([]);
    expect(repetitionIssues(repetitionMetric(blotch)).join()).toMatch(/blotches/);
    expect(repetitionIssues(repetitionMetric(marks)).join()).toMatch(/marks? far stronger/);
  });

  test('conformance flags (never fails) seams and repetition on tiles; a periodic design skips them', () => {
    const t = material('dirt', dc, { w: 32, h: 32 }).grid.clone();
    t.fill(2, 2, 14, 14, RAMPS.stone[0]);
    const r = conformance({ frames: [t], dir, kind: 'tile', size: [32, 32] });
    expect(r.checks.find(c => c.id === 'repetition')!.status).toBe('flag');
    expect(r.pass).toBe(true);
    expect(conformance({ frames: [t], dir, kind: 'tile', size: [32, 32], periodic: true }).checks.find(c => c.id === 'repetition')!.status).toBe('skip');
    expect(conformance({ frames: [t], dir, kind: 'prop', size: [32, 32] }).checks.find(c => c.id === 'repetition')).toBeUndefined();
  });

  test('iso diamonds are measured as one period of their staggered repeat', () => {
    const floor = isoFloorTile(material('cobble', dc, { w: 32, h: 32 }).grid, 32);
    const patch = periodicPatch(floor)!;
    expect(patch).toBeDefined();
    for (let i = 3; i < patch.d.length; i += 4) expect(patch.d[i]).toBe(255);
    const holey = new Grid(8, 8).fill(0, 0, 3, 3, RAMPS.stone[0]);
    expect(periodicPatch(holey)).toBeUndefined();
  });
});

describe('briefs (P6)', () => {
  test('autotile layouts and the layer kind validate; a bad layout is named', async () => {
    const { validateBrief } = await import('../w2/briefs.ts');
    expect(validateBrief({ id: 'grass', kind: 'tileset', autotile: 'blob47' })).toEqual([]);
    expect(validateBrief({ id: 'forest', kind: 'layer', size: [96, 48] })).toEqual([]);
    expect(validateBrief({ id: 'grass', kind: 'tileset', autotile: 'wang8' }).join()).toMatch(/autotile must be wang16 or blob47/);
  });
});
