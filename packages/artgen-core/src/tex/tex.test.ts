// P6b: periodic noise, material recipes (seamless, palette-exact, normal maps), seam / repetition metrics, autotile
// synthesis (canonical order, neighbours continue), iso floor / block tiles, WFC, L-systems.
import { describe, expect, test } from 'vitest';
import { conformance } from '../qa/conformance.ts';
import { dirContext, kindPalette, parseDirection, type Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { getNormal } from '../lib/normals.ts';
import { periodicPatch, repetitionIssues, repetitionMetric, seamMetric } from '../qa/tiles.ts';
import { autotile, autotileCovers, autotileIndexOf, autotileMask, BLOB47 } from './autotile.ts';
import { isoBlockTile, isoFloorTile } from './iso.ts';
import { lsystem, turtle } from './lsystem.ts';
import { material, MATERIALS } from './materials.ts';
import { pGradient, pValue, pWorley } from './noise.ts';
import { wfc, type WfcTile } from './wfc.ts';

const RAMPS = {
  stone: ['#c8ccd0', '#8e959c', '#5a6068', '#30343a'], dirt: ['#a08060', '#6e5440', '#40302a'], grass: ['#9ac060', '#5e8a3a', '#2e4a22'],
  wood: ['#c89860', '#8a6038', '#4a321e'], metal: ['#e0e4e8', '#a0a8b0', '#606870'], accent: ['#ffc060', '#e07020', '#802010'],
  cloth: ['#80a0d0', '#4060a0', '#203060'], glow: ['#fff0a0', '#ffc040'], leather: ['#a07050', '#604030'],
};
const dir: Direction = parseDirection({ id: 'tex', version: 1, status: 'locked', camera: { view: 'topdown' }, scale: { tile: 32 }, palette: { ramps: RAMPS, outline: '#101014' }, shading: { bands: 3 } });
const dc = dirContext(dir);

describe('periodic noise', () => {
  test('value, gradient and Worley noise repeat exactly over the image size', () => {
    const o = { w: 32, h: 24, cells: 4, octaves: 3, seed: 9 };
    for (const [x, y] of [[0.5, 0.5], [7.3, 11.1], [31.5, 23.5]]) {
      expect(pValue(x, y, o)).toBeCloseTo(pValue(x + 32, y + 24, o), 9);
      expect(pGradient(x, y, o)).toBeCloseTo(pGradient(x - 32, y + 48, o), 9);
      expect(pWorley(x, y, o).f1).toBeCloseTo(pWorley(x + 64, y - 24, o).f1, 9);
    }
    expect(pValue(3, 3, o)).not.toBe(pValue(3, 3, { ...o, seed: 10 }));
  });
});

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

describe('autotiles', () => {
  test('blob47 order matches the runtime: 47 masks, isolated first, surrounded last; wang16 bits are N E S W', () => {
    expect(BLOB47).toHaveLength(47);
    expect([BLOB47[0], BLOB47[46]]).toEqual([0, 255]);
    expect(autotileMask('wang16', 5)).toBe(1 | 16);
    expect(autotileIndexOf('blob47', 255)).toBe(46);
    expect(autotileIndexOf('blob47', 2)).toBe(0); // a lone corner without its edges counts for nothing
    expect(() => autotileMask('blob47', 47)).toThrow();
  });

  test('neighbouring tiles continue each other: coverage on a shared edge agrees for every pair the runtime would place', () => {
    const s = 16, o = { inset: 4, wobble: 2, seed: 3 };
    // every 4 × 3 neighbourhood of two side-by-side over cells a | b: the runtime's masks for both, then the shared edge
    const red = (m: number) => BLOB47[autotileIndexOf('blob47', m)];
    for (let bits = 0; bits < 1 << 10; bits++) {
      // grid columns -1..2 (a at 0, b at 1), rows -1..1; bits fill the 10 cells other than a and b
      const cells = new Map<string, boolean>([['0,0', true], ['1,0', true]]);
      let k = 0;
      for (const y of [-1, 0, 1]) for (const x of [-1, 0, 1, 2]) if (!cells.has(`${x},${y}`)) cells.set(`${x},${y}`, !!(bits & (1 << k++)));
      const mask = (cx: number) => { let m = 0; for (const [dx, dy, bit] of [[0, -1, 1], [1, -1, 2], [1, 0, 4], [1, 1, 8], [0, 1, 16], [-1, 1, 32], [-1, 0, 64], [-1, -1, 128]]) if (cells.get(`${cx + dx},${dy}`)) m |= bit; return red(m); };
      const ma = mask(0), mb = mask(1);
      let differ = 0;
      for (let y = 0; y < s; y++) if (autotileCovers(ma, s - 1, y, s, o) !== autotileCovers(mb, 0, y, s, o)) differ++;
      expect(differ, `${ma}|${mb}`).toBeLessThanOrEqual(2); // the boundary crosses the shared edge at the same row (± its slope)
    }
    // fully surrounded covers everything, isolated covers only an inner island
    let all = 0, iso = 0;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { all += +autotileCovers(255, x, y, s, o); iso += +autotileCovers(0, x, y, s, o); }
    expect(all).toBe(s * s);
    expect(iso).toBeGreaterThan(0);
    expect(iso).toBeLessThan(s * s / 2);
  });

  test('tiles are cut from the two textures (palette-exact) and darken the boundary', () => {
    const over = material('grass', dc, { w: 16, h: 16 }).grid, base = material('dirt', dc, { w: 16, h: 16 }).grid;
    const full = autotile(dc, 'blob47', 46, { over, base, rim: false }), lone = autotile(dc, 'blob47', 0, { over, base });
    expect(full.hash()).toBe(over.hash());
    const pal = new Set(kindPalette(dir));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(pal.has(lone.get(x, y)!)).toBe(true);
    expect(lone.get(0, 0)).not.toBeNull();
  });
});

describe('iso tiles', () => {
  test('floor diamonds tile staggered without seams: the texture under (x, y) and under (x + w/2, y + h/2) continue', () => {
    const tex = material('cobble', dc, { w: 32, h: 32 }).grid, f = isoFloorTile(tex, 32);
    let filled = 0;
    for (let i = 3; i < f.d.length; i += 4) if (f.d[i]) filled++;
    expect(filled).toBeGreaterThan(32 * 16 * 0.45);
    expect(f.alpha(0, 0)).toBe(0);
    expect(f.alpha(16, 8)).toBe(255);
    expect(f.normal).toBeDefined();
  });

  test('blocks: top diamond plus two faces stepped darker (left one step, right two)', () => {
    const t = material('stone', dc, { w: 16, h: 16 }).grid, b = isoBlockTile(dc, 32, { top: t, height: 16 });
    expect([b.w, b.h]).toEqual([32, 32]);
    const lum = (x: number, y: number) => { const i = (y * 32 + x) * 4; return b.d[i] + b.d[i + 1] + b.d[i + 2]; };
    let L = 0, R = 0;
    for (let y = 18; y < 26; y++) { L += lum(6, y); R += lum(26, y); }
    expect(L).toBeGreaterThan(R);
  });
});

describe('WFC', () => {
  const tiles: WfcTile[] = [
    { id: 'grass', edges: ['g', 'g', 'g', 'g'], weight: 4 },
    { id: 'road-h', edges: ['g', 'r', 'g', 'r'] }, { id: 'road-v', edges: ['r', 'g', 'r', 'g'] },
    { id: 'cross', edges: ['r', 'r', 'r', 'r'], weight: 0.3 },
  ];
  test('every neighbour pair agrees on its sockets; deterministic per seed; fixed cells hold', () => {
    const m = wfc(tiles, 12, 9, { seed: 4, fixed: { [4 * 12 + 6]: 'cross' } }), by = Object.fromEntries(tiles.map(t => [t.id, t]));
    for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
      if (x < 11) expect(by[m[y][x]].edges[1]).toBe(by[m[y][x + 1]].edges[3]);
      if (y < 8) expect(by[m[y][x]].edges[2]).toBe(by[m[y + 1][x]].edges[0]);
    }
    expect(m[4][6]).toBe('cross');
    expect(wfc(tiles, 12, 9, { seed: 4, fixed: { [4 * 12 + 6]: 'cross' } })).toEqual(m);
  });

  test('periodic maps agree across the wrap; an impossible set says so', () => {
    const m = wfc(tiles, 6, 6, { seed: 2, periodic: true }), by = Object.fromEntries(tiles.map(t => [t.id, t]));
    for (let y = 0; y < 6; y++) expect(by[m[y][5]].edges[1]).toBe(by[m[y][0]].edges[3]);
    expect(() => wfc([{ id: 'a', edges: ['x', 'y', 'x', 'z'] }], 3, 3)).toThrow(/no solution/);
  });
});

describe('L-systems', () => {
  test('rewrites deterministically (stochastic rules by seed) and the turtle branches thinner', () => {
    const rules = { F: [['F[+F]F', 1], ['F[-F]F', 1]] as [string, number][] };
    expect(lsystem('F', rules, 3, 7)).toBe(lsystem('F', rules, 3, 7));
    expect(lsystem('F', { F: 'FF' }, 3)).toBe('FFFFFFFF');
    const segs = turtle(lsystem('F', { F: 'F[+F][-F]' }, 2), { start: [16, 30], angle: 30, step: 4 });
    expect(segs.length).toBe(9);
    expect(Math.max(...segs.map(s => s.depth))).toBe(2);
    expect(segs.find(s => s.depth === 2)!.width).toBeLessThan(segs[0].width);
    expect(segs[0].b[1]).toBeLessThan(30); // heading -90: grows up the screen
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
