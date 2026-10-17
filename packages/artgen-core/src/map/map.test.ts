// Terrain maps: the file format, the generator (edits, simplify), contours, grids and the two themes.
import { describe, expect, test } from 'vitest';
import * as map from './index.ts';
import { contourLines, generateMap, gridGeometry, parseMap, renderMapSvg, terrainsUsed, validateMap } from './index.ts';
import { newMap, TERRAINS } from './spec.ts';
import * as M from '../index.ts';

const small = (over: Partial<map.MapSpec> = {}) => newMap('t', 'regional', { cols: 16, rows: 12, seed: 5, ...over });
const at = (f: ReturnType<typeof generateMap>, x: number, y: number) => TERRAINS[f.terrain[Math.floor(y * f.res) * f.w + Math.floor(x * f.res)]];

describe('terrain maps', () => {
  test('presets fill every field; validation names the problems', () => {
    const m = newMap('vale', 'local');
    expect(m).toMatchObject({ preset: 'local', cols: 30, rows: 20, grid: { type: 'square' }, scale: { unit: 'ft' } });
    expect(validateMap(m)).toEqual([]);
    expect(validateMap({ ...m, id: '../x', cols: 2, edits: [{ op: 'paint', terrain: 'lava', shape: { circle: [1, 1] } }] })).toEqual(expect.arrayContaining([
      expect.stringContaining('id'), expect.stringContaining('cols'), expect.stringContaining('edits[0].terrain'), expect.stringContaining('edits[0].shape.circle'),
    ]));
    expect(parseMap({ id: 'old', preset: 'regional', seed: 3 })).toMatchObject({ cols: 30, gen: { sea: 0.3 }, overlay: { labels: [] } });
    expect(M.map.newMap).toBe(newMap);
  });

  test('hex and cell references resolve to cell centres', () => {
    const m = small();
    expect(map.parsePoint(m, '3.5, 2')).toEqual([3.5, 2]);
    const [x, y] = map.parsePoint(m, 'hex:0101'), [x2, y2] = map.parsePoint(m, '0201');
    expect(x).toBeCloseTo(1 / Math.sqrt(3)); expect(y).toBeCloseTo(0.5);
    expect(x2 - x).toBeCloseTo(1.5 / Math.sqrt(3)); expect(y2).toBeCloseTo(1); // odd columns sit half a hex lower
    expect(map.parsePoint({ grid: { type: 'square', size: 1, coords: false } }, 'C4')).toEqual([2.5, 3.5]);
    expect(() => map.parsePoint(m, 'nowhere')).toThrow(/hex coordinates/);
  });

  test('generation is deterministic and the seed changes it', () => {
    expect(renderMapSvg(small())).toBe(renderMapSvg(small()));
    expect(renderMapSvg(small({ seed: 6 }))).not.toBe(renderMapSvg(small()));
  });

  test('sea sets the water share; island keeps the edges wet', () => {
    const water = (f: ReturnType<typeof generateMap>) => [...f.terrain].filter(t => t <= 1).length / f.terrain.length;
    expect(water(generateMap(small({ gen: { ...small().gen, sea: 0.5, simplify: 0 } })))).toBeCloseTo(0.5, 1);
    expect(water(generateMap(small({ gen: { ...small().gen, sea: 0, simplify: 0, rivers: 0 } })))).toBe(0);
    const isl = generateMap(small({ gen: { ...small().gen, land: 'island', sea: 0.4 } }));
    expect(at(isl, 0.1, 0.1)).toMatch(/deep|water/);
  });

  test('paint and elevate edits change the right place; later edits win', () => {
    const base = small();
    const painted = generateMap({ ...base, edits: [{ op: 'paint', terrain: 'desert', shape: { circle: [8, 6, 2] } }, { op: 'paint', terrain: 'snow', shape: { poly: [7, 5, 9, 5, 9, 7, 7, 7] } }] });
    expect(at(painted, 8, 6)).toBe('snow');
    expect(at(painted, 6.4, 6)).toBe('desert');
    const flat = generateMap(base), raised = generateMap({ ...base, edits: [{ op: 'elevate', amount: 0.5, shape: { circle: [4, 4, 2] } }] });
    const e = (f: typeof flat) => f.elevation[Math.floor(4 * f.res) * f.w + Math.floor(4 * f.res)];
    expect(e(raised)).toBeGreaterThan(e(flat));
    const road = generateMap({ ...base, edits: [{ op: 'road', points: [1, 1, 8, 8, 15, 2] }, { op: 'river', points: [2, 10, 14, 10] }] });
    expect(road.roads).toHaveLength(1);
    expect(road.rivers.length).toBe(flat.rivers.length + 1);
  });

  test('simplify merges small patches into their neighbours', () => {
    const patches = (s: number) => {
      const f = generateMap(small({ gen: { ...small().gen, simplify: s } })), seen = new Uint8Array(f.terrain.length);
      let n = 0;
      for (let k = 0; k < f.terrain.length; k++) {
        if (seen[k]) continue;
        n++; const st = [k]; seen[k] = 1;
        while (st.length) { const c = st.pop()!, i = c % f.w, j = (c - i) / f.w; for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { const m = y * f.w + x; if (x >= 0 && y >= 0 && x < f.w && y < f.h && !seen[m] && f.terrain[m] === f.terrain[c]) { seen[m] = 1; st.push(m); } } }
      }
      return n;
    };
    expect(patches(4)).toBeLessThan(patches(0) / 2);
  });

  test('contours stay on the map, one set per interval', () => {
    const m = small(), f = generateMap(m), levels = contourLines(m, f);
    expect(levels.length).toBeGreaterThan(2);
    expect(levels.every(l => l.level >= 1 && l.level * m.topo.interval < m.topo.maxElevation)).toBe(true);
    for (const { lines } of levels) for (const l of lines) for (let i = 0; i < l.pts.length; i += 2) {
      expect(l.pts[i]).toBeGreaterThanOrEqual(-0.01); expect(l.pts[i]).toBeLessThanOrEqual(m.cols + 0.01);
    }
  });

  test('grids: square cells A1…, hex columns numbered 0101…', () => {
    const sq = gridGeometry({ cols: 4, rows: 3, grid: { type: 'square', size: 1, coords: true } });
    expect(sq.cells.map(c => c.name)).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3']);
    const hex = gridGeometry({ cols: 6, rows: 4, grid: { type: 'hex', size: 1, coords: true } });
    expect(hex.cells[0].name).toBe('0101');
    expect(hex.cells.every(c => c.x > 0 && c.x < 6 && c.y > 0 && c.y < 4)).toBe(true);
    expect(gridGeometry({ cols: 4, rows: 3, grid: { type: 'none', size: 1, coords: true } }).d).toBe('');
  });

  test('layers: grid, labels and symbols render when on and leave nothing when off', () => {
    const m = small({ title: 'Fen & <Moor>', overlay: { labels: [{ text: 'Bog', x: 3, y: 3, kind: 'water' }], symbols: [{ kind: 'castle', x: 5, y: 5 }] } });
    const full = renderMapSvg(m);
    for (const id of ['terrain', 'contours', 'grid', 'symbols', 'labels', 'legend', 'scale', 'compass', 'title']) expect(full).toContain(`<g id="${id}"`);
    expect(full).toContain('Fen &amp; &lt;Moor&gt;');
    const bare = renderMapSvg(m, { layers: { grid: false, labels: false, symbols: false, legend: false, scale: false, compass: false, title: false } });
    for (const id of ['grid', 'symbols', 'labels', 'legend', 'title']) expect(bare).not.toContain(`<g id="${id}"`);
  });

  test('black & white: only greys, and every terrain but grassland has its own pattern', () => {
    const svg = renderMapSvg(small({ overlay: { labels: [{ text: 'X', x: 2, y: 2, kind: 'region' }], symbols: [{ kind: 'town', x: 3, y: 3 }] } }), { theme: 'bw' });
    for (const [, hex] of svg.matchAll(/#([0-9a-f]{6})\b/gi)) expect(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6), `#${hex}`).toBe(true);
    const pats = TERRAINS.filter(t => t !== 'grass').map(t => map.THEME.bw.terrain[t].pattern);
    expect(new Set(pats).size).toBe(pats.length);
    expect(pats.every(Boolean)).toBe(true);
  });

  test('the legend lists only the terrains on the map', () => {
    const m = small(), f = generateMap(m), svg = renderMapSvg(m, { field: f }), legend = svg.slice(svg.indexOf('<g id="legend"'));
    for (const t of TERRAINS) expect(legend.includes(`>${map.TERRAIN_NAMES[t]}<`)).toBe(terrainsUsed(f).includes(t));
  });
});
