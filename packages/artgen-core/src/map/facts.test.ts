// Facts read back from a map: the numbers a consumer writes about, their rounding, and that the same file gives the same facts.
import { describe, expect, test } from 'vitest';
import { generateMap, mapFacts, newMap, areaOutline, feetIn, FACTS_RULES, type MapSpec } from './index.ts';

/** Left half rock, right half forest (paint is exact), a river and a road across the middle. 20×10 cells of 10 yd; heights in ft every 5. */
const split = (over: Partial<MapSpec> = {}): MapSpec => newMap('t', 'local', {
  cols: 20, rows: 10, seed: 3, scale: { perCell: 10, unit: 'yd' }, gen: { ...newMap('t', 'local').gen, rivers: 0 },
  edits: [
    { op: 'paint', terrain: 'rock', shape: { poly: [0, 0, 10, 0, 10, 10, 0, 10] } },
    { op: 'paint', terrain: 'forest', shape: { poly: [10, 0, 20, 0, 20, 10, 10, 10] } },
    { op: 'river', points: [2, 1, 2, 9], width: 0.5, delta: false },
    { op: 'road', points: [0, 5, 20, 5] },
  ],
  ...over,
});

describe('map facts', () => {
  test('a point states its terrain, height, slope and the nearest river and road, rounded as the rules say', () => {
    const m = split(), [p, q] = mapFacts(m, { at: [[15, 2], [2.4, 5]] }).points!;
    expect(p).toMatchObject({ at: [15, 2], terrain: 'forest' });
    expect(q).toMatchObject({ at: [2.4, 5], terrain: 'rock' });
    for (const x of [p, q]) {
      expect(x.height % m.topo.interval).toBe(0);
      expect(['flat', 'gentle', 'steep', 'cliff']).toContain(x.slope.band);
      expect(Number.isFinite(x.slope.gradient)).toBe(true);
    }
    expect(q.river).toEqual({ name: 'river-1', source: 'edit', distance: { map: 0.4, scale: 4 }, at: [2, 5], within: false });
    expect(q.road).toEqual({ name: 'road-1', distance: { map: 0, scale: 0 }, at: [2.4, 5] });
    expect(mapFacts(m, { at: [[2.2, 5]] }).points![0].river).toMatchObject({ distance: { map: 0.2, scale: 2 }, within: true });
    expect(p.road).toMatchObject({ distance: { map: 3, scale: 30 } });
  });

  test('a point outside the map, a bad --above or a bad radius is refused', () => {
    const m = split();
    expect(() => mapFacts(m, { at: [[20.5, 1]] })).toThrow(/outside the map/);
    expect(() => mapFacts(m, { at: [[1, 1]], above: 'sky' as 'river' })).toThrow(/--above/);
    expect(() => mapFacts(m, { at: [[1, 1]], above: 'lowest', radius: 0 })).toThrow(/--radius/);
  });

  test('--above river is the height over the river at its nearest point; at the river it is 0', () => {
    const m = split(), pts = mapFacts(m, { at: [[2, 5], [6, 5], [14, 8]], above: 'river' }).points!;
    expect(pts[0].above).toMatchObject({ of: 'river', value: 0 });
    for (const x of pts) {
      expect(x.above!.value).toBe(x.height - x.above!.reference!.height);
      expect(Math.abs(x.above!.value!) % m.topo.interval).toBe(0);
    }
    const none = split({ edits: [] });
    expect(mapFacts(none, { at: [[3, 3]], above: 'river' }).points![0].above).toEqual({ of: 'river', value: null, reference: null });
  });

  test('--above lowest is the height over the lowest ground within the radius, and a wider radius never lowers the reference', () => {
    const m = split(), at: [number, number][] = [[6, 5], [15, 2]];
    const small = mapFacts(m, { at, above: 'lowest', radius: 1 }).points!, wide = mapFacts(m, { at, above: 'lowest', radius: 8 }).points!;
    small.forEach((s, i) => {
      expect(s.above!.reference!.height).toBeGreaterThanOrEqual(wide[i].above!.reference!.height);
      expect(s.above!.value).toBe(s.height - s.above!.reference!.height);
      expect(wide[i].above!.value).toBeGreaterThanOrEqual(s.above!.value!);
    });
    expect(mapFacts(m, { at, above: 'lowest' }).points![0].above!.reference).not.toBeNull();
  });

  test('an area states terrain shares in whole percent adding to 100, the lowest and highest ground, and where rivers and roads cross it', () => {
    const m = split(), [a, whole] = mapFacts(m, { areas: [areaOutline([5, 0, 15, 10]), areaOutline([0, 0, 20, 10])] }).areas!;
    expect(a.terrain).toEqual([{ terrain: 'forest', share: 50 }, { terrain: 'rock', share: 50 }]);   // equal shares go in the order of TERRAINS
    expect(whole.terrain.reduce((n, s) => n + s.share, 0)).toBe(100);
    expect(a.lowest.height).toBeLessThanOrEqual(a.highest.height);
    expect(a.lowest.height % m.topo.interval).toBe(0);
    expect(a.rivers).toEqual([]);
    expect(a.roads).toEqual([{ name: 'road-1', enters: [5, 5], leaves: [15, 5], length: { map: 10, scale: 100 } }]);
    const [left] = mapFacts(m, { areas: [[0, 0, 4, 0, 4, 7, 0, 7]] }).areas!;
    expect(left.rivers).toEqual([{ name: 'river-1', source: 'edit', enters: [2, 1], leaves: [2, 7], length: { map: 6, scale: 60 } }].map(r => ({ ...r, enters: null })));
    expect(left.roads[0]).toMatchObject({ enters: null, leaves: [4, 5], length: { map: 4 } });
    expect(() => mapFacts(m, { areas: [[1, 1, 1.01, 1, 1.01, 1.01]] })).toThrow(/holds no ground/);
    expect(() => areaOutline([1, 2, 3])).toThrow(/--area/);
  });

  test('with neither, the map states its drawn rivers and roads as point lists, the generated rivers apart, hilltops, hollows and terrain shares', () => {
    const m = split(), f = mapFacts(m).features!;
    expect(f.rivers).toHaveLength(1);
    expect(f.rivers[0]).toMatchObject({ name: 'river-1', source: 'edit', mouth: false, length: { map: 8, scale: 80 } });
    expect(f.rivers[0].points[0]).toEqual([2, 1]);
    expect(f.rivers[0].points.at(-1)).toEqual([2, 9]);
    expect(f.roads).toHaveLength(1);
    expect(f.roads[0]).toMatchObject({ name: 'road-1', points: [[0, 5], [20, 5]], length: { map: 20, scale: 200 } });
    expect(f.generatedRivers).toEqual([]);
    expect(f.terrain.reduce((n, s) => n + s.share, 0)).toBe(100);
    expect(f.lowest.height).toBeLessThanOrEqual(f.highest.height);
    for (const s of [...f.hilltops, ...f.hollows]) {
      expect(s.height % m.topo.interval).toBe(0);
      expect(s.prominence).toBeGreaterThanOrEqual(FACTS_RULES.prominence * m.topo.interval);
    }
    expect(f.hilltops.map(s => s.height)).toEqual([...f.hilltops.map(s => s.height)].sort((a, b) => b - a));
    expect(f.hollows.map(s => s.height)).toEqual([...f.hollows.map(s => s.height)].sort((a, b) => a - b));
    expect(f.hollows.every(s => s.height > 0)).toBe(true);
  });

  test('a generated river is listed apart from the drawn one and still counts as the nearest river', () => {
    const base = newMap('g', 'regional', { seed: 2 }), m = newMap('g', 'regional', { seed: 2, edits: [{ op: 'river', points: [1, 1, 5, 6], width: 0.2 }] });
    expect(generateMap(base).rivers.every(r => r.source === 'generated')).toBe(true);
    const f = mapFacts(m).features!;
    expect(f.generatedRivers.length).toBeGreaterThan(0);
    expect(f.generatedRivers.every(r => r.source === 'generated')).toBe(true);
    expect(f.rivers.map(r => r.name)).toEqual([`river-${f.generatedRivers.length + 1}`]);
    expect(f.rivers[0].source).toBe('edit');
    const g = f.generatedRivers[0], [x, y] = g.points[Math.floor(g.points.length / 2)];
    expect(mapFacts(m, { at: [[x, y]] }).points![0].river).toMatchObject({ source: 'generated', name: g.name });
  });

  test('the slope band needs both units to be lengths it knows', () => {
    expect(feetIn('yd')).toBe(3);
    expect(feetIn('Miles')).toBe(5280);
    expect(feetIn('league')).toBeNull();
    const odd = split({ topo: { ...newMap('t', 'local').topo, unit: 'cubits' } });
    expect(mapFacts(odd, { at: [[6, 5]] }).points![0].slope.band).toBeNull();
    expect(mapFacts(split(), { at: [[6, 5]] }).points![0].slope.band).not.toBeNull();
  });

  test('the same map gives the same facts, byte for byte, for every kind of query', () => {
    const m = split(), q = [{}, { at: [[3, 3], [15, 7]] as [number, number][], above: 'river' as const }, { at: [[3, 3]] as [number, number][], above: 'lowest' as const, radius: 4 }, { areas: [areaOutline([2, 2, 12, 8])] }];
    for (const query of q) expect(JSON.stringify(mapFacts(m, query))).toBe(JSON.stringify(mapFacts(structuredClone(m), query, generateMap(m))));
  });
});
