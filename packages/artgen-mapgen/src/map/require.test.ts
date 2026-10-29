// `require` in a map file: validated, shaped to by the generator (never painted), measured by `checkRequirements`, and
// left alone when absent. The consumer cases (frontier, ravine) are in artgen-cli's fixtures.test.ts.
import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { checkMap, checkRequirements, contourLines, generateMap, mapFacts, newMap, parseMap, validateMap, MAP_FORMAT, TERRAINS, type MapField, type MapSpec, type Requirement } from './index.ts';

const T = Object.fromEntries(TERRAINS.map((t, i) => [t, i])) as Record<(typeof TERRAINS)[number], number>;
/** A 60 x 40 local map of 10 ft squares, 80 ft high, with no rivers of its own unless the test asks. */
const local = (over: Partial<MapSpec> = {}, rivers = 0): MapSpec => newMap('t', 'local', {
  cols: 60, rows: 40, seed: 4, scale: { perCell: 10, unit: 'ft' }, topo: { maxElevation: 80, interval: 5, majorEvery: 4, unit: 'ft', labels: false },
  gen: { ...newMap('t', 'local').gen, rivers, relief: 0.2 }, ...over,
});
const sample = (f: MapField, x: number, y: number) => Math.floor(y * f.res) * f.w + Math.floor(x * f.res);
const sha = (f: MapField) => createHash('sha1').update(f.terrain).update(Buffer.from(f.elevation.buffer))
  .update(JSON.stringify([f.rivers.map(r => [r.source, r.mouth, r.pts.map(v => +v.toFixed(3))]), f.roads.map(r => r.pts.map(v => +v.toFixed(3)))])).digest('hex');
const poly = (x0: number, y0: number, x1: number, y1: number) => ({ poly: [x0, y0, x1, y0, x1, y1, x0, y1] });

describe('require: the format', () => {
  test('is an optional list: the version is unchanged and a file without one parses as it did', () => {
    expect(MAP_FORMAT).toBe(1);
    expect(parseMap({ id: 'old', preset: 'local', seed: 3 })).not.toHaveProperty('require');
    const m = local({ require: [{ id: 'f', kind: 'terrain', area: { circle: [10, 10, 4] }, terrain: 'forest', share: 0.8 }] });
    expect(parseMap(JSON.parse(JSON.stringify(m))).require).toEqual(m.require);
    expect(parseMap(m).version).toBe(1);
  });

  test('every kind is validated, each problem named by its JSON path', () => {
    const bad = (r: unknown, over: Partial<MapSpec> = {}) => validateMap({ ...local(over), require: [r] });
    expect(bad({ id: 'ok', kind: 'terrain', area: { circle: [5, 5, 2] }, terrain: 'forest', share: 0.5 })).toEqual([]);
    expect(bad({ id: 'a b', kind: 'terrain', area: { circle: [5, 5, 2] }, terrain: 'lava', share: 2 })).toEqual(expect.arrayContaining([
      expect.stringContaining('require[0].id'), expect.stringContaining('require[0].terrain'), expect.stringContaining('require[0].share'),
    ]));
    expect(bad({ id: 'h', kind: 'height', area: { circle: [5, 5, 2] }, low: 30, high: 20 })).toEqual([expect.stringContaining('require[0]: low and high')]);
    expect(bad({ id: 'h', kind: 'height', area: { circle: [5, 5, 2] }, low: 10, high: 200 })).toEqual([expect.stringContaining('require[0].high: at most topo.maxElevation (80)')]);
    expect(bad({ id: 'p', kind: 'path', path: 'canal', points: [1, 1, 2] })).toEqual(expect.arrayContaining([expect.stringContaining('require[0].path'), expect.stringContaining('require[0].points')]));
    expect(bad({ id: 'c', kind: 'clear', area: { poly: [1, 1, 2, 2] } })).toEqual([expect.stringContaining('require[0].area.poly')]);
    expect(bad({ id: 'x', kind: 'flood' })).toEqual([expect.stringContaining('require[0].kind')]);
    expect(bad({ id: 's', kind: 'terrain', area: { circle: [5, 5, 2] }, terrain: 'snow', share: 0.5 })).toEqual([expect.stringContaining('snow does not appear on a local map')]);
    expect(validateMap({ ...local(), require: [{ id: 'd', kind: 'clear', area: { circle: [5, 5, 2] } }, { id: 'd', kind: 'clear', area: { circle: [9, 9, 2] } }] })).toEqual([expect.stringContaining('require[1].id: d is used twice')]);
    expect(validateMap({ ...local(), require: 'forest' })).toEqual(['require: an array']);
  });

  test('checkMap lists every error with its path, reads the file as written and refuses a newer version', () => {
    const raw = { id: 't', preset: 'local', seed: 1, require: [{ id: 'a', kind: 'terrain', area: { circle: [5, 5, 2] }, terrain: 'forest', share: 3 }, { id: 'b', kind: 'path', path: 'road', points: [1, 1] }] };
    expect(checkMap(raw)).toEqual({ version: 1, errors: [
      { path: 'require[0].share', message: 'above 0 and at most 1' }, { path: 'require[1].points', message: 'at least 2 x,y pairs' },
    ] });
    expect(checkMap({ id: 't', preset: 'local', seed: 1 })).toEqual({ version: 1, errors: [] });
    expect(checkMap({ ...raw, version: 2 }).errors).toEqual([{ path: 'version', message: expect.stringContaining('format version 2') }]);
  });
});

describe('require: a map without it renders as it did', () => {
  // hashes of the terrain, heights, rivers and roads, recorded from the commit before `require` existed
  const specs: Record<string, [MapSpec, string]> = {
    regional: [newMap('g1', 'regional', { cols: 16, rows: 12, seed: 5 }), '85423730e422e5d7a9a8922e44b6332bf372d8f3'],
    local: [newMap('g2', 'local', { cols: 40, rows: 30, seed: 9, edits: [
      { op: 'paint', terrain: 'forest', shape: { circle: [20, 15, 5] } }, { op: 'elevate', amount: 0.4, shape: { poly: [5, 5, 15, 5, 15, 12, 5, 12] } },
      { op: 'river', points: [2, 2, 12, 18, 30, 25] }, { op: 'road', points: [1, 28, 20, 14, 39, 3] },
    ] }), '9d8ef0e884e1b9d4a046f470e745243c37844286'],
    island: [newMap('g3', 'regional', { cols: 20, rows: 14, seed: 2, gen: { land: 'island', sea: 0.4, moisture: 0.5, roughness: 0.5, relief: 0.5, rivers: 3, simplify: 3, feature: 10 } }), 'f9e8ec5df042953a6b1f6dbc9b583eac861c6bb0'],
  };
  for (const [name, [spec, hash]] of Object.entries(specs)) {
    test(name, () => {
      expect(sha(generateMap(spec))).toBe(hash);
      expect(sha(generateMap({ ...spec, require: [] }))).toBe(hash);
    });
  }
});

describe('require: terrain and height shape the ground, they do not paint it', () => {
  const forest = poly(15, 10, 40, 30);
  const base = local();

  test('the area is the terrain asked for; far from it the map is as it was', () => {
    const req: Requirement[] = [{ id: 'wood', kind: 'terrain', area: forest, terrain: 'forest', share: 0.8, blend: 5 }];
    const spec = local({ require: req }), f = generateMap(spec), plain = generateMap(base);
    expect(checkRequirements(spec, f)).toMatchObject([{ id: 'wood', kind: 'terrain', what: 'forest', met: true }]);
    // nothing outside the area plus its blend is changed (a few squares more, for the readability pass)
    let moved = 0;
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const x = (i + 0.5) / f.res, y = (j + 0.5) / f.res;
      if (x < 15 - 5 - 3 || x > 40 + 5 + 3 || y < 10 - 5 - 3 || y > 30 + 5 + 3) if (f.terrain[j * f.w + i] !== plain.terrain[j * f.w + i]) moved++;
    }
    expect(moved).toBe(0);
  });

  test('the edge is blended and ragged, not the outline: forest runs past the polygon in places and falls short of it in others', () => {
    const spec = local({ require: [{ id: 'wood', kind: 'terrain', area: forest, terrain: 'forest', share: 0.7 }] }), f = generateMap(spec);
    const inside = (x: number, y: number) => x >= 15 && x <= 40 && y >= 10 && y <= 30;
    let out = 0, short = 0;
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const forestHere = f.terrain[j * f.w + i] === T.forest, here = inside((i + 0.5) / f.res, (j + 0.5) / f.res);
      if (forestHere && !here) out++;
      if (!forestHere && here) short++;
    }
    expect(out).toBeGreaterThan(0);
    expect(short).toBeGreaterThan(0);
  });

  test('rock is high and varied ground, not a flat painted plateau; marsh lies low', () => {
    const spec = local({ require: [
      { id: 'crags', kind: 'terrain', area: poly(5, 5, 25, 20), terrain: 'rock', share: 0.8 },
      { id: 'fen', kind: 'terrain', area: poly(35, 22, 55, 36), terrain: 'marsh', share: 0.7 },
    ] }), f = generateMap(spec);
    expect(checkRequirements(spec, f).map(r => r.met)).toEqual([true, true]);
    const heights = (x0: number, y0: number, x1: number, y1: number) => {
      const h: number[] = [];
      for (let y = y0; y < y1; y += 0.5) for (let x = x0; x < x1; x += 0.5) h.push(f.elevation[sample(f, x, y)]);
      return h;
    };
    const rock = heights(8, 8, 22, 17), fen = heights(38, 25, 52, 33), mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(Math.min(...rock)).toBeGreaterThan(0.7);
    expect(Math.max(...rock) - Math.min(...rock)).toBeGreaterThan(0.05);   // not flat
    expect(mean(fen)).toBeLessThan(0.2);
    expect(mean(rock)).toBeGreaterThan(mean(fen) + 0.5);
  });

  test('a height band is held over its area and the contours follow it', () => {
    const spec = local({ require: [{ id: 'rise', kind: 'height', area: { circle: [30, 20, 8] }, low: 40, high: 70, share: 0.9 }] }), f = generateMap(spec);
    const [r] = checkRequirements(spec, f);
    expect(r).toMatchObject({ id: 'rise', kind: 'height', what: '40-70 ft', met: true });
    expect(r.measured).toBeGreaterThanOrEqual(0.9);
    // a rise has a crown: the centre stands above the foot of it
    expect(f.elevation[sample(f, 30, 20)]).toBeGreaterThan(f.elevation[sample(f, 30 + 7.5, 20)]);
    // and the contours ring it: levels in the band exist inside and none of them is a straight line across the map
    const rings = contourLines(spec, f).filter(l => l.level >= 8 && l.level <= 14).flatMap(l => l.lines);
    expect(rings.some(l => l.pts.some((v, i) => i % 2 === 0 && Math.hypot(v - 30, l.pts[i + 1] - 20) < 12))).toBe(true);
  });

  test('a terrain and a stated height over the same ground are both met where they can be, and the stated height wins where they cannot', () => {
    const area = poly(10, 8, 40, 30);
    const ok = local({ require: [{ id: 'crags', kind: 'terrain', area, terrain: 'rock', share: 0.6 }, { id: 'crags-high', kind: 'height', area, low: 40, high: 75 }] });
    expect(checkRequirements(ok).map(r => r.met)).toEqual([true, true]);
    const clash = local({ require: [{ id: 'crags', kind: 'terrain', area, terrain: 'rock', share: 0.6 }, { id: 'crags-low', kind: 'height', area, low: 0, high: 20 }] });
    expect(checkRequirements(clash).map(r => [r.id, r.met])).toEqual([['crags', false], ['crags-low', true]]);
  });

  test('the same file gives the same field, twice, and a different seed another', () => {
    const spec = local({ require: [{ id: 'wood', kind: 'terrain', area: forest, terrain: 'forest', share: 0.7 }, { id: 'rise', kind: 'height', area: { circle: [50, 8, 5] }, low: 40, high: 60 }] });
    expect(sha(generateMap(spec))).toBe(sha(generateMap(spec)));
    expect(sha(generateMap({ ...spec, seed: 5 }))).not.toBe(sha(generateMap(spec)));
  });
});

describe('require: paths', () => {
  test('a stream is a river through its points that carves its valley and never climbs; with gen.rivers at 0 it is the only river', () => {
    const points = [8, 6, 20, 14, 34, 18, 52, 30];
    const spec = local({ require: [{ id: 'brook', kind: 'path', path: 'stream', points, tolerance: 0.5 }] }), f = generateMap(spec), plain = generateMap(local());
    expect(f.rivers.map(r => [r.source, r.for])).toEqual([['required', 'brook']]);
    expect(plain.rivers).toEqual([]);
    expect(checkRequirements(spec, f)).toMatchObject([{ id: 'brook', kind: 'path', what: 'stream', met: true }]);
    const [r] = f.rivers, h = (x: number, y: number) => f.elevation[sample(f, x, y)];
    // a valley: the ground at the stream is lower than the ground 3 squares either side of it, along most of its length
    let lower = 0, n = 0;
    for (let i = 8; i < r.pts.length - 8; i += 8) {
      const x = r.pts[i], y = r.pts[i + 1], dx = r.pts[i + 2] - r.pts[i - 2], dy = r.pts[i + 3] - r.pts[i - 1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      if (h(x, y) < h(x + nx * 3, y + ny * 3) - 1e-4 && h(x, y) < h(x - nx * 3, y - ny * 3) - 1e-4) lower++;
      n++;
    }
    expect(lower / n).toBeGreaterThan(0.7);
    // downhill: the bed never rises by more than one contour interval from its start to its end
    const bed = Array.from({ length: r.pts.length / 2 }, (_, i) => h(r.pts[i * 2], r.pts[i * 2 + 1]));
    for (let i = 1; i < bed.length; i++) expect(bed[i]).toBeLessThanOrEqual(Math.min(...bed.slice(0, i)) + 5 / 80);
  });

  test('a stream the file asks for is carried through a lake on its course, never cut short at it', () => {
    const lake = { op: 'paint' as const, terrain: 'water' as const, shape: { circle: [30, 20, 3] as [number, number, number] } };
    const spec = local({ edits: [lake], require: [{ id: 'brook', kind: 'path', path: 'stream', points: [6, 20, 30, 20, 54, 20], tolerance: 0.5 }] });
    expect(checkRequirements(spec)).toMatchObject([{ id: 'brook', met: true }]);
  });

  test('a road passes through its points and takes the gentler way between them', () => {
    const ridge = { op: 'elevate' as const, amount: 0.9, shape: { circle: [30, 20, 9] as [number, number, number] } };
    const points = [4, 20, 56, 20], spec = local({ edits: [ridge], require: [{ id: 'way', kind: 'path', path: 'road', points, tolerance: 0.5 }] }), f = generateMap(spec);
    expect(checkRequirements(spec, f)).toMatchObject([{ id: 'way', kind: 'path', what: 'road', met: true }]);
    const [road] = f.roads, high = (pts: number[]) => Math.max(...Array.from({ length: pts.length / 2 }, (_, i) => f.elevation[sample(f, pts[i * 2], pts[i * 2 + 1])]));
    const straight: number[] = [];
    for (let x = 4; x <= 56; x += 0.25) straight.push(x, 20);
    expect(road.pts.slice(0, 2)).toEqual([4, 20]);
    expect(road.pts.slice(-2)).toEqual([56, 20]);
    expect(high(road.pts)).toBeLessThan(high(straight) - 0.1);   // it goes round the ridge
  });

  test('a road keeps to its middle points, not only its ends', () => {
    const points = [4, 5, 30, 35, 56, 5], spec = local({ require: [{ id: 'way', kind: 'path', path: 'road', points }] }), f = generateMap(spec);
    expect(checkRequirements(spec, f)[0]).toMatchObject({ met: true });
    expect(Math.min(...Array.from({ length: f.roads[0].pts.length / 2 }, (_, i) => Math.hypot(f.roads[0].pts[i * 2] - 30, f.roads[0].pts[i * 2 + 1] - 35)))).toBeLessThan(0.6);
  });
});

describe('require: clear keeps generated rivers out', () => {
  /** A strip across the map; some seeds have a generated river through it, found here by looking, and without `clear` they do. */
  const strip = { stroke: [0, 20, 60, 20], width: 10 };
  const rivers = (r: Requirement[], seed: number) => generateMap(local({ seed, require: r }, 4));
  const crossing = (f: MapField) => f.rivers.filter(v => v.source === 'generated' && [v.pts, v.outline].some(p => { for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i + 1] - 20) < 5) return true; return false; })).length;
  const open: number[] = [];
  for (let seed = 1; open.length < 3 && seed <= 60; seed++) if (crossing(rivers([], seed)) > 0) open.push(seed);

  test('with it no generated river enters the area, and without it these seeds have one there', () => {
    expect(open.length).toBeGreaterThan(0);
    for (const seed of open) {
      const f = rivers([{ id: 'keep', kind: 'clear', area: strip }], seed);
      expect(crossing(f), `seed ${seed}`).toBe(0);
      expect(f.rivers.some(v => v.source === 'generated'), `seed ${seed}: the other rivers are still there`).toBe(true);
      expect(checkRequirements(local({ seed, require: [{ id: 'keep', kind: 'clear', area: strip }] }, 4), f)).toMatchObject([{ id: 'keep', kind: 'clear', met: true, measured: 0 }]);
    }
  }, 60_000);

  test('check names a clear area a river does cross (a field made without the requirement)', () => {
    const seed = open[0], withClear = local({ seed, require: [{ id: 'keep', kind: 'clear', area: strip }] }, 4);
    const [r] = checkRequirements(withClear, rivers([], seed));
    expect(r).toMatchObject({ id: 'keep', met: false, op: '<=', needed: 0 });
    expect(r.measured).toBeGreaterThan(0);
    expect(r.text).toMatch(/^keep clear rivers [1-9]\.\d\d > 0\.00 unmet$/);
  }, 60_000);

  test('the streams and roads a file asks for are its own and may cross a clear area', () => {
    const spec = local({ require: [{ id: 'keep', kind: 'clear', area: strip }, { id: 'brook', kind: 'path', path: 'stream', points: [30, 2, 30, 38] }, { id: 'way', kind: 'path', path: 'road', points: [2, 20, 58, 20] }] });
    expect(checkRequirements(spec).map(r => r.met)).toEqual([true, true, true]);
  });
});

describe('require: check names each unmet requirement', () => {
  test('a terrain that loses to another over the same ground is named with what was measured, as `id kind what measured < needed unmet`', () => {
    // rock follows height and forest follows moisture: over one place the generator raises it to rock, and the wood is the one that is unmet
    const area = poly(15, 10, 40, 30), spec = local({ require: [{ id: 'wood', kind: 'terrain', area, terrain: 'forest', share: 0.8 }, { id: 'crags', kind: 'terrain', area, terrain: 'rock', share: 0.9 }] });
    const [wood, crags] = checkRequirements(spec);
    expect(crags).toMatchObject({ id: 'crags', met: true });
    expect(wood).toMatchObject({ id: 'wood', kind: 'terrain', what: 'forest', met: false, needed: 0.8 });
    expect(wood.text).toBe(`wood terrain forest ${wood.measured!.toFixed(2)} < 0.80 unmet`);
    expect(wood.measured).toBeLessThan(0.1);
    expect(crags.text).toMatch(/^crags terrain rock \d\.\d\d >= 0\.90 met$/);
  });

  test('two stated heights over one place cannot both be held: the earlier is named', () => {
    const area = poly(10, 10, 40, 30), spec = local({ require: [{ id: 'low', kind: 'height', area, low: 0, high: 15 }, { id: 'high', kind: 'height', area, low: 50, high: 75 }] });
    expect(checkRequirements(spec).map(r => [r.id, r.met])).toEqual([['low', false], ['high', true]]);
  });

  test('a path with no line to measure, or a point it misses, is unmet', () => {
    const spec = local({ require: [{ id: 'way', kind: 'path', path: 'road', points: [4, 5, 56, 35], tolerance: 0.3 }] }), f = generateMap(spec);
    expect(checkRequirements({ ...spec, require: [{ id: 'way', kind: 'path', path: 'road', points: [4, 5, 56, 35, 30, 38], tolerance: 0.3 }] }, f)[0]).toMatchObject({ met: false });
    const none = checkRequirements(spec, generateMap(local()))[0];
    expect(none).toMatchObject({ id: 'way', met: false, measured: null });
    expect(none.text).toBe('way path road no path > 0.30 unmet');
  });

  test('measures are read as `map facts` reads them: whole-percent shares of the samples of the area', () => {
    const area = poly(15, 10, 40, 30), spec = local({ require: [{ id: 'wood', kind: 'terrain', area, terrain: 'forest', share: 0.5 }] }), f = generateMap(spec);
    const share = mapFacts(spec, { areas: [area.poly] }, f).areas![0].terrain.find(s => s.terrain === 'forest')!.share;
    expect(checkRequirements(spec, f)[0].measured).toBe(share / 100);
  });
});
