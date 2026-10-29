import { describe, expect, it } from 'vitest';
import * as S from './index.ts';
import { generateMap } from '../map/generate.ts';
import { newMap } from '../map/spec.ts';

const inn = (): S.Building => ({
  id: 'inn', kind: 'inn', shape: 'rect', x: 10, y: 10, w: 8, h: 6, label: 'The Rat',
  floors: [
    {
      level: 0,
      rooms: [{ id: 'tap', shape: 'rect', x: 0, y: 0, w: 5, h: 6, label: 'Taproom' }, { id: 'kit', shape: 'rect', x: 5, y: 0, w: 3, h: 6 }],
      connections: [{ a: 'tap', b: 'kit' }],
      doors: [{ at: [2.5, 6] }], windows: [{ at: [0, 3] }],
      fixtures: [{ kind: 'bar', x: 2.5, y: 1 }, { kind: 'stairs-up', x: 6.5, y: 5, w: 2, h: 0.8 }],
    },
    { level: 1, rooms: [{ id: 'up', shape: 'rect', x: 0, y: 0, w: 8, h: 6 }], fixtures: [{ kind: 'stairs-down', x: 6.5, y: 5, w: 2, h: 0.8 }, { kind: 'bed', x: 1, y: 1.5 }] },
  ],
});

const sample = () => S.newSettlement('sample', 'village', {
  title: 'Sample',
  roads: [{ kind: 'street', points: [0, 20, 40, 20] }, { kind: 'path', points: [20, 20, 20, 40] }],
  water: [{ kind: 'river', points: [30, 0, 30, 40], width: 4 }, { kind: 'pond', points: [2, 30, 8, 30, 8, 36, 2, 36] }],
  walls: [{ kind: 'stone', points: [5, 5, 35, 5, 35, 35, 5, 35], closed: true, towers: { shape: 'round', at: 'corners' }, gates: [{ at: [5, 20], kind: 'gatehouse' }] }],
  buildings: [inn(), { id: 'h1', kind: 'house', shape: 'L', x: 20, y: 24, w: 5, h: 4, angle: 30 }],
  areas: [{ kind: 'wood', points: [36, 0, 40, 0, 40, 10, 36, 10] }],
  trees: [{ kind: 'tree', x: 3, y: 3 }], props: [{ kind: 'well', x: 15, y: 25 }],
});

describe('settlement file', () => {
  it('makes every kind with its own size and settings, and parses back', () => {
    for (const kind of S.SETTLEMENT_KINDS) {
      const s = S.newSettlement(`t-${kind}`, kind);
      expect(s.kind).toBe(kind);
      expect(s.cols).toBe(S.KIND_DEFAULTS[kind].cols);
      expect(S.parseSettlement(JSON.parse(JSON.stringify(s)))).toEqual(s);
    }
    expect(S.newSettlement('c', 'castle').gen.castle).toBe(true);
    expect(S.newSettlement('t', 'town').gen.wall).toBe('stone');
  });

  it('reports each problem at its JSON path', () => {
    const s = sample() as unknown as Record<string, unknown>;
    const bad = structuredClone(s) as { roads: { kind: string }[]; buildings: { id: string; floors: { connections: { b: string }[]; fixtures: { kind: string }[] }[] }[]; walls: { gates: { kind: string }[] }[] };
    bad.roads[0].kind = 'motorway';
    bad.buildings[1].id = 'inn';
    bad.buildings[0].floors[0].connections[0].b = 'nowhere';
    bad.buildings[0].floors[0].fixtures[0].kind = 'jacuzzi';
    bad.walls[0].gates[0].kind = 'drawbridge';
    const paths = S.checkSettlement(bad).errors.map(e => e.path);
    expect(paths).toEqual(expect.arrayContaining(['roads[0].kind', 'buildings[1].id', 'buildings[0].floors[0].connections[0].b', 'buildings[0].floors[0].fixtures[0].kind', 'walls[0].gates[0].kind']));
    expect(() => S.parseSettlement(bad)).toThrow(/invalid settlement sample/);
    expect(S.checkSettlement({ ...s, version: 2 }).errors[0]).toMatchObject({ path: 'version', message: expect.stringMatching(/settlement format 1/) });
  });

  it('has a drawing and a size for every fixture kind', () => {
    for (const [kind, f] of Object.entries(S.FIXTURES)) {
      expect(f.ft[0] * f.ft[1], kind).toBeGreaterThan(0);
      expect(f.draw(40, 20, 1), kind).toMatch(/^</);
    }
    expect(S.fixtureSize({ kind: 'bed' }, 5)).toEqual([0.6, 1.2]);
    expect(S.fixtureSize({ kind: 'bed', w: 2 }, 5)).toEqual([2, 1.2]);
  });
});

describe('settlement layout', () => {
  it('turns buildings, finds bridges, places gates and towers', () => {
    const s = sample(), l = S.layoutSettlement(s);
    const h1 = l.buildings[1];
    expect(h1.outline.length).toBe(12);
    expect(h1.wings.length).toBe(2);
    expect(l.bridges.length).toBe(1);
    expect(l.bridges[0].x0).toBeLessThan(30 - 2);
    expect(l.bridges[0].x1).toBeGreaterThan(30 + 2);
    const w = l.walls[0];
    expect(w.gates[0]).toMatchObject({ kind: 'gatehouse', x: 5, y: 20 });
    // four corners, plus the gatehouse's pair
    expect(w.towers.length).toBe(6);
    expect(l.areaTrees.length).toBeGreaterThan(3);
    expect(S.buildingAt(l, 14, 13)?.building.id).toBe('inn');
  });

  it('lays a floor out as walls, doors, windows and furniture', () => {
    const s = sample(), b = s.buildings[0], fl = S.layoutFloor(s, b, b.floors![0]);
    expect(fl.w).toBe(8);
    expect(fl.rooms.map(r => r.number)).toEqual([1, 2]);
    // the shared wall at x = 5, with the door cut out of it
    expect(fl.partitions.every(p => p[0] === 5 && p[2] === 5)).toBe(true);
    expect(fl.partitions.reduce((n, p) => n + Math.abs(p[3] - p[1]), 0)).toBeCloseTo(5);
    expect(fl.inner).toHaveLength(1);
    expect(fl.doors[0]).toMatchObject({ x: 2.5, y: 6 });
    expect(fl.windows[0]).toMatchObject({ x: 0, y: 3 });
    expect(fl.fixtures[0]).toMatchObject({ kind: 'bar', w: 2, h: 0.5 });
  });

  it('maps plan cells onto the site through the building\'s turn', () => {
    const s = S.newSettlement('p', 'town', { buildings: [{ id: 'b', kind: 'house', shape: 'rect', x: 10, y: 10, w: 4, h: 2, angle: 90 }] });
    const b = s.buildings[0];
    // 10 ft site cells: 2 plan cells each
    expect(S.planOutline(s, b)).toEqual([0, 0, 8, 0, 8, 4, 0, 4]);
    const [x, y] = S.planToSite(s, b, 0, 0);
    expect(x).toBeCloseTo(13);
    expect(y).toBeCloseTo(9);
    const [px, py] = S.siteToPlan(s, b, x, y);
    expect(px).toBeCloseTo(0);
    expect(py).toBeCloseTo(0);
  });
});

describe('settlement render', () => {
  it('draws the site in layers, the same every time, in colour and in black and white', () => {
    const s = sample(), svg = S.renderSettlementSvg(s);
    expect(S.renderSettlementSvg(s)).toBe(svg);
    for (const id of ['ground', 'areas', 'water', 'roads', 'bridges', 'walls', 'buildings', 'trees', 'props', 'grid', 'numbers', 'title', 'scale', 'compass']) expect(svg, id).toContain(`id="${id}"`);
    const bw = S.renderSettlementSvg(s, { theme: 'bw' });
    expect(bw).not.toBe(svg);
    expect(bw).not.toMatch(/#9cc5df/);
    expect(S.renderSettlementSvg(s, { layers: { grid: false, trees: false } })).not.toContain('id="grid"');
  });

  it('shows buildings as roofs, outlines or cut away to the ground floor', () => {
    const s = sample();
    const roofs = S.renderSettlementSvg(s), outline = S.renderSettlementSvg(s, { buildings: 'outline' }), inside = S.renderSettlementSvg(s, { buildings: 'interior' });
    expect(new Set([roofs, outline, inside]).size).toBe(3);
    // the inn's taproom bar shows only when cut away
    expect(inside.length).toBeGreaterThan(outline.length);
  });

  it('draws a building\'s floor plan with its title, legend and furniture', () => {
    const s = { ...sample(), legend: true }, svg = S.renderSettlementSvg(s, { view: 'plan', building: 'inn' });
    for (const id of ['floor', 'grid', 'fixtures', 'walls', 'doors', 'windows', 'numbers', 'labels', 'legend', 'title']) expect(svg, id).toContain(`id="${id}"`);
    expect(svg).toContain('The Rat — Ground floor');
    expect(S.renderSettlementSvg(s, { view: 'plan', building: 'inn', floor: 1 })).toContain('The Rat — Upper floor');
    expect(() => S.renderSettlementSvg(s, { view: 'plan', building: 'nope' })).toThrow(/no building nope/);
    expect(() => S.renderSettlementSvg(s, { view: 'plan', building: 'inn', floor: 3 })).toThrow(/no floor at level 3/);
    expect(S.planSheet(s, s.buildings[0])).toEqual({ cols: 12, rows: 10, margin: 2 });
  });
});

describe('settlement generator', () => {
  it('makes each kind, valid and the same from the same seed', () => {
    for (const kind of S.SETTLEMENT_KINDS) {
      const base = S.newSettlement(kind, kind, { seed: 5 }), a = S.generateSettlement(base), b = S.generateSettlement(base);
      expect(a).toEqual(b);
      expect(S.validateSettlement(a)).toEqual([]);
      expect(a.buildings.length, kind).toBeGreaterThan(kind === 'castle' ? 3 : 5);
      expect(a.buildings.every(x => x.origin === 'gen')).toBe(true);
      const lint = S.lintSettlement(a);
      expect(lint.filter(f => /stands in water|overlaps|off the sheet/.test(f.message)), kind).toEqual([]);
    }
  });

  it('walls a town with gates where the roads cross it, and puts a keep in a castle', () => {
    const town = S.generateSettlement(S.newSettlement('t', 'town', { seed: 2 }));
    const wall = town.walls.find(w => w.kind === 'stone')!;
    expect(wall.closed).toBe(true);
    expect(wall.gates!.length).toBeGreaterThanOrEqual(2);
    const castle = S.generateSettlement(S.newSettlement('c', 'castle', { seed: 2 }));
    expect(castle.buildings.some(b => b.kind === 'keep')).toBe(true);
    expect(castle.walls.some(w => w.kind === 'curtain' && w.gates?.[0].kind === 'gatehouse')).toBe(true);
    expect(castle.water.some(w => w.kind === 'moat')).toBe(true);
  });

  it('keeps entries drawn by hand', () => {
    const base = S.newSettlement('h', 'village', { seed: 4, buildings: [{ id: 'mine', kind: 'tower', shape: 'circle', x: 2, y: 2, w: 4, h: 4 }], trees: [{ kind: 'boulder', x: 70, y: 50 }] });
    const s = S.generateSettlement(base);
    expect(s.buildings.find(b => b.id === 'mine')).toEqual(base.buildings[0]);
    expect(s.trees).toContainEqual(base.trees[0]);
    // generated again, the generated entries are replaced, not added to
    expect(S.generateSettlement(s).buildings.length).toBe(s.buildings.length);
  });

  it('lays out interiors: rooms that fill the footprint, a door, stairs that meet', () => {
    const s = S.generateSettlement(S.newSettlement('i', 'village', { seed: 6, gen: { ...S.DEFAULTS.gen, interiors: true } }));
    expect(s.buildings.every(b => b.floors?.length)).toBe(true);
    for (const b of s.buildings) {
      const ground = b.floors!.find(f => f.level === 0)!, outline = S.planOutline(s, b);
      const area = ground.rooms.reduce((n, r) => n + r.w * r.h, 0);
      expect(area, b.id).toBeGreaterThan(0);
      expect(ground.doors?.length, b.id).toBeGreaterThan(0);
      expect(outline.length).toBeGreaterThan(5);
    }
    const lint = S.lintSettlement(s).filter(f => /meets no stairs|reaches outside|outside the building/.test(f.message));
    expect(lint).toEqual([]);
    const inn = s.buildings.find(b => b.kind === 'inn');
    if (inn) {
      expect(inn.floors!.map(f => f.level)).toEqual(expect.arrayContaining([0, 1]));
      expect(inn.floors!.find(f => f.level === 0)!.fixtures!.some(f => f.kind === 'bar')).toBe(true);
    }
  });

  it('fits a settlement to the terrain map under it', () => {
    const m = newMap('coast', 'local', { cols: 40, rows: 30, seed: 11, gen: { land: 'mixed', sea: 0.35, moisture: 0.5, roughness: 0.4, relief: 0.4, rivers: 1, simplify: 0.5, feature: 8 } });
    const field = generateMap(m);
    const s = S.settlementFromMap(S.newSettlement('fit', 'village', { seed: 3, gen: { ...S.DEFAULTS.gen, water: 'none' } }), '../../maps/coast/map.json', m, field, [10, 8]);
    expect(s.underlay).toMatchObject({ map: '../../maps/coast/map.json', origin: [10, 8] });
    // 5 ft cells on a map of 10 yd squares
    expect(s.underlay!.scale).toBeCloseTo(5 / (m.scale.perCell * S.feetIn(m.scale.unit)), 4);
    const ground = S.groundFromMap(s, field), l = S.layoutSettlement(s);
    // no building stands where the map has water
    for (const g of l.buildings) expect(ground.water(g.cx, g.cy), g.building.id).toBe(false);
  });
});

describe('settlement facts', () => {
  it('counts and measures', () => {
    const f = S.settlementFacts(sample());
    expect(f.counts.buildings).toEqual({ inn: 1, house: 1 });
    expect(f.buildings[0]).toMatchObject({ id: 'inn', number: 1, size: '40 × 30 ft', stories: 2 });
    expect(f.buildings[0].floors[0]).toMatchObject({ level: 0, rooms: 2, doors: 2, windows: 1, fixtures: { bar: 1, 'stairs-up': 1 } });
    expect(f.walls[0]).toMatchObject({ kind: 'stone', length: 600, closed: true, towers: 6 });
    expect(f.roads[0]).toMatchObject({ kind: 'street', length: 200 });
    expect(f.bridges).toBe(1);
  });
});
