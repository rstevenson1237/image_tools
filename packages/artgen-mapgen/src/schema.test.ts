// The schemas declare every key the validators read: a recording proxy runs each validator over a full file and every key
// path it touches must be declared (R9 D5). A key added to a validator without its schema line fails here.
import { describe, expect, test } from 'vitest';
import * as D from './dungeon/index.ts';
import * as M from './map/spec.ts';
import * as S from './settlement/index.ts';
import { declares, schemaKeys, SCHEMAS } from './schema.ts';
import { validateGraph } from './dungeon/graph.ts';

/** The key paths a function reads from `value` (array indexes as `[]`). */
function readPaths(value: unknown, run: (v: unknown) => unknown): Set<string> {
  const seen = new Set<string>();
  const wrap = (v: unknown, path: string): unknown => {
    if (!v || typeof v !== 'object') return v;
    return new Proxy(v as object, {
      get(t, k, r) {
        const x = Reflect.get(t, k, r);
        // methods run on the proxy (so forEach, map and every hand out wrapped elements); length and symbols pass through
        if (typeof k !== 'string' || typeof x === 'function' || (Array.isArray(t) && k === 'length')) return x;
        const p = Array.isArray(t) ? (/^\d+$/.test(k) ? `${path}[]` : path) : path ? `${path}.${k}` : k;
        if (!Array.isArray(t)) seen.add(p);
        return wrap(x, p);
      },
      has(t, k) { if (typeof k === 'string' && !Array.isArray(t)) seen.add(path ? `${path}.${k}` : k); return Reflect.has(t, k); },
    });
  };
  run(wrap(value, ''));
  return seen;
}
const undeclared = (kind: keyof typeof SCHEMAS, paths: Set<string>) => [...paths].filter(p => !declares(SCHEMAS[kind], p)).sort();

describe('schemas', () => {
  test('dungeon: every key the validator reads is declared', () => {
    const room = (id: string, x: number): D.Room => ({ id, shape: 'rect', x, y: 2, w: 4, h: 4, label: 'A', number: 3, fill: 'floor', href: '#a', origin: 'tables', hand: ['x'], anchor: [x + 1, 3], labelAt: 'n', cut: 0.3, orient: 'flat', exits: [{ kind: 'arrow', side: 'n', at: [x, 3], angle: 0, text: 'up' }] });
    const full = {
      ...D.newDungeon('d', { cols: 30, rows: 20 }), style: { hatch: 'band', band: 1, wall: 1, sharedWalls: 'rooms', rock: 'solid', rockColor: '#aaaaaa', partition: 2 }, legend: true, furniture: { place: 'outside', side: 'right' }, title: 'T',
      rooms: [room('a', 2), room('b', 6), { id: 'p', shape: 'poly', points: [10, 10, 14, 10, 14, 14], x: 10, y: 10, w: 4, h: 4, seed: 3 }],
      corridors: [{ id: 'c', from: { room: 'a', side: 'n', offset: 1 }, to: { room: 'b', port: [7, 2] }, width: 1, route: 'maze', maze: { clearance: 0, bend: 1, seed: 2 }, via: [3, 1, 7, 1], curve: 'none', style: 'built', seed: 1, doors: ['door', null], origin: 'x' },
        { from: { corridor: 'c', near: [4, 1] }, to: { at: [29, 1], exit: { text: 'out', href: '#o', fade: 2 } }, span: 5 }],
      connections: [{ a: 'a', b: 'b', at: [6, 3], kind: 'open', width: 1, origin: 'x' }],
      blocks: [{ id: 'k', shape: 'rect', x: 16, y: 10, w: 6, h: 6, points: [16, 10, 22, 10, 22, 16], split: { mode: 'cuts', min: 3, cuts: { x: [19], y: [13] }, seed: 1 }, doors: 0.2, origin: 'x' }],
      overlay: { labels: [{ text: 'L', x: 1, y: 1, kind: 'note', size: 1, angle: 0, href: '#l', origin: 'x' }], symbols: [{ kind: 'trap', x: 2, y: 2, scale: 1, angle: 0, origin: 'x' }] },
      underlay: { map: 'm.json', origin: [0, 0], scale: 1, theme: 'bw' },
      walls: [{ id: 'w', rooms: ['a'], poly: [1, 1, 5, 1, 5, 5], thickness: 1, inset: 1, towers: { shape: 'round', size: 2, at: 'corners' }, gates: [{ at: [3, 1], kind: 'gate', room: 'a', width: 2 }], origin: 'x' }],
      bounds: [0, 0, 30, 0, 30, 20], areas: [{ points: [24, 14, 28, 14, 28, 18], kind: 'void', label: 'pit', origin: 'x' }],
    };
    const read = readPaths(full, v => D.validateDungeon(v));
    // the recorder sees the validator's reads, deep ones included
    expect([...read]).toEqual(expect.arrayContaining(['rooms[].exits[].kind', 'corridors[].maze', 'corridors[].from.port', 'walls[].gates[].room', 'areas[].kind', 'style.partition', 'blocks[].split.cuts']));
    expect(undeclared('dungeon', read)).toEqual([]);
    // and an undeclared key is caught
    expect(undeclared('dungeon', new Set(['rooms[].colour']))).toEqual(['rooms[].colour']);
  });

  test('graph: every key the validator and the layout read is declared', () => {
    const g = { id: 'g', title: 't', rooms: [{ id: 'A.1', w: 4, h: 4, shape: 'poly', points: [-2, -2, 2, -2, 2, 2], label: 'x', turns: true, hall: true, against: { room: 'A.2', dx: 4, dy: 0 }, over: { x: 0, y: 0, w: 2, h: 2 } }, { id: 'A.2', w: 4, h: 4 }],
      ways: [{ a: 'A.1', b: 'A.2', bearing: 90, wall: 90, doors: ['door', null], style: 'natural', label: 'l' }], width: 2, scale: { perCell: 5, unit: 'ft' }, footprint: 20, keepOut: [[0, 0, 2, 0, 2, 2]], fill: [0.3, 0.5], passages: 0.3, detour: 4, seed: 1, tries: 1, margin: 2, clearance: 0 };
    expect(undeclared('graph', readPaths(g, v => validateGraph(v as never)))).toEqual([]);
  });

  test('settlement graph: every key the validator and the layout read is declared', () => {
    const g = {
      id: 't', title: 't', kind: 'village', ground: 'grass', scale: { perCell: 5, unit: 'ft' }, bend: 30, margin: 4, seed: 1, tries: 1, steps: 200, footprint: 80,
      buildings: [{ id: 'a', w: 4, h: 4, kind: 'inn', shape: 'rect', label: 'A', turns: true, gap: 2, draw: { roof: 'hip' } }, { id: 'b', w: 4, h: 4, at: { x: 10, y: 0 }, angle: 0, outside: true }, { id: 'c', w: 6, h: 6, kind: 'market' }],
      streets: [{ id: 's', kind: 'lane', width: 2, label: 'L', past: ['a', { id: 'c', side: 'left' }], from: { gate: 'n' }, to: { building: 'b' } }, { id: 't', past: [], from: { street: 's' }, to: { gate: 'e' } }],
      gates: [{ id: 'n', kind: 'gate', bearing: 0, label: 'N', road: { kind: 'path', label: 'to X' } }, { id: 'e', bearing: 90, road: false }],
      ties: [{ a: 'a', b: 'b', distance: 10, bearing: 90, hold: true }],
      wall: { kind: 'stone', gap: 2, towers: { shape: 'round' }, shape: 'hull' }, spacing: { gap: 2, least: 1, setback: 1 },
    };
    expect(undeclared('settlement-graph', readPaths(g, v => S.validateSettlementGraph(v as never)))).toEqual([]);
    expect(undeclared('settlement-graph', readPaths(g, v => S.layoutSettlementGraph(v as never)))).toEqual([]);
  });

  test('layout and design: every key the validator and the expansion read is declared', () => {
    const paths = new Set<string>();
    for (const l of D.LAYOUTS) for (const p of readPaths(l, v => D.validateLayout(v as never))) paths.add(p);
    expect(undeclared('layout', paths)).toEqual([]);
    const d = { id: 'd', width: 2, seed: 1, rooms: [{ id: 'X', w: 4, h: 4 }], ways: [], uses: [{ id: 'row', layout: 'cell-row', params: { 'per-row': 2 } }, { id: 'v', layout: 'stair-vestibule' }],
      bind: [{ use: 'row', role: 'hall', rooms: ['H'] }], joins: [{ from: 'row.e', to: 'v.in', kind: 'passage', doors: ['door', null], style: 'built', hold: true }, { from: 'row.w', to: 'X' }], layouts: [] };
    const read = readPaths(d, v => D.expandDesign(v as never, D.LAYOUTS));
    expect(undeclared('design', new Set([...read].filter(p => !p.startsWith('layouts'))))).toEqual([]);
  });

  test('map: every key the validator reads is declared', () => {
    const area = { circle: [3, 3, 2] }, full = {
      ...M.newMap('m', 'local'), title: 't',
      edits: [{ op: 'paint', terrain: 'forest', shape: { poly: [1, 1, 4, 1, 4, 4] }, origin: 'x' }, { op: 'elevate', amount: 0.2, shape: { stroke: [1, 1, 5, 5], width: 2 } }, { op: 'river', points: [1, 1, 6, 6], width: 1, delta: false }, { op: 'road', points: [1, 1, 6, 6] }],
      require: [{ id: 'a', kind: 'terrain', area, terrain: 'grass', share: 0.5, blend: 1, origin: 'x' }, { id: 'b', kind: 'height', area, low: 0, high: 10, share: 0.5 }, { id: 'c', kind: 'path', path: 'stream', points: [1, 1, 5, 5], tolerance: 1, width: 1, delta: true }, { id: 'd', kind: 'clear', area }],
      overlay: { labels: [{ text: 'x', x: 1, y: 1, kind: 'place', size: 1, angle: 0, origin: 'x' }], symbols: [{ kind: 'tower', x: 1, y: 1, scale: 1, angle: 0, origin: 'x' }] },
    };
    expect(undeclared('map', readPaths(full, v => M.validateMap(v)))).toEqual([]);
  });

  test('settlement: every key the validator reads is declared', () => {
    const s = S.generateSettlement(S.newSettlement('s', 'town', { seed: 4, gen: { ...S.newSettlement('s', 'town').gen, interiors: true, castle: true, water: 'river', wall: 'stone' } }));
    const full = { ...s, title: 't', legend: true, furniture: { place: 'outside' }, underlay: { map: 'm.json', origin: [0, 0], scale: 1, theme: 'bw' },
      overlay: { labels: [{ text: 'x', x: 1, y: 1, kind: 'water', size: 1, angle: 0, href: '#x', origin: 'x' }], symbols: [{ kind: 'well', x: 1, y: 1, scale: 1, angle: 0, origin: 'x' }] } };
    const read = readPaths(full, v => S.validateSettlement(v));
    expect([...read]).toEqual(expect.arrayContaining(['buildings[].floors[].rooms[].shape', 'walls[].gates[].kind', 'props[].kind']));
    expect(undeclared('settlement', read)).toEqual([]);
  });

  test('--keys lists every declared key with its line; the dungeon names every check id', () => {
    const keys = schemaKeys(SCHEMAS.dungeon).map(([k]) => k);
    expect(keys).toEqual(expect.arrayContaining(['style.sharedWalls', 'style.wall', 'style.hatch', 'corridors[].via', 'corridors[].from', 'rooms[].exits[].kind', 'bounds', 'areas[].kind']));
    expect(schemaKeys(SCHEMAS.dungeon).every(([, line]) => line.length > 0)).toBe(true);
    expect(Object.keys(D.CHECK_IDS).length).toBeGreaterThan(20);
  });
});
