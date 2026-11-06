// Layouts and designs (docs/DUNGEON-DESIGN.md §10: R1, R2, R4): the format, the expansion to a graph, and its layout.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';
import { SB_LAYOUTS } from './__fixtures__/setting-builder-layouts.ts';

const lib = [...D.LAYOUTS, ...SB_LAYOUTS];
const expand = (d: Partial<D.Design>) => D.expandDesign({ id: 'd', width: 2, tries: 2, uses: [], ...d }, lib);
const place = (r: D.GraphReport, id: string) => r.places.find(p => p.id === id)!;

describe('the layout format', () => {
  test('every bundled layout and every one of setting_builder\'s is valid, and each lays out alone', () => {
    for (const l of lib) expect(D.validateLayout(l)).toEqual([]);
    for (const l of D.LAYOUTS) {
      const { graph } = expand({ uses: [{ id: 'u', layout: l.id }], pad: 1, partial: true });
      const { spec, report } = D.layoutGraph(graph);
      expect(report.left, l.id).toEqual([]);
      expect(D.lintDungeon(spec).filter(f => f.severity === 'error'), l.id).toEqual([]);
    }
  }, 120_000);
  test('what a layout gets wrong is said', () => {
    expect(D.validateLayout({ id: 'x', params: { n: { default: 9, max: 4 } }, parts: [{ role: 'a', w: '$m', h: [4, 2] }, { role: 'a', w: 2, h: 2, at: { part: 'z', side: 'up' as 'n' } }], ties: [{ a: 'a', b: 'q' }], sockets: [{ name: 's', part: 'a', bearing: 400 }, { name: 's', part: 'a', bearing: 'n' }] })).toEqual([
      'layout x: params.n: {default, min?, max?}, the default inside', 'layout x: parts[0].w: no parameter m', 'layout x: parts[0].h: [least, most] cells', 'layout x: parts[1].role: a is used twice',
      'layout x: parts[1].at.part: no part z', 'layout x: parts[1].at.side: a compass point or degrees', 'layout x: ties[0].b: no part "q"', 'layout x: sockets[1].name: s is used twice',
    ]);
  });
});

describe('a design expanded to a graph', () => {
  test('rooms named by the binding, else after the use and role; ties as ways; parameters set the count', () => {
    const { graph, report } = expand({ uses: [{ id: 'row', layout: 'cell-row', params: { 'per-row': 2 } }], bind: [{ use: 'row', role: 'hall', rooms: ['I.3'] }, { use: 'row', role: 'north-cell', rooms: ['I.4', { id: 'I.5', label: 'Store' }] }] });
    expect(graph.rooms.map(r => r.id)).toEqual(['I.3', 'I.4', 'I.5', 'row.south-cell.1', 'row.south-cell.2']);
    expect(graph.rooms.find(r => r.id === 'I.5')!.label).toBe('Store');
    expect(graph.rooms[0]).toMatchObject({ w: 8, h: 2, hall: true });
    // a row keeps to its side by its line and the mirror, not by a bearing from the hall's centre
    expect(graph.ways).toEqual([{ a: 'I.3', b: 'I.4', run: 'wall' }, { a: 'I.3', b: 'I.5', run: 'wall' }, { a: 'I.3', b: 'row.south-cell.1', run: 'wall' }, { a: 'I.3', b: 'row.south-cell.2', run: 'wall' }]);
    expect(graph.rooms.find(r => r.id === 'row.south-cell.1')!.label).toBe('');
    expect(graph.rooms.find(r => r.id === 'I.4')!.label).toBeUndefined();
    expect(graph.mirrors).toEqual([{ a: 'I.4', b: 'row.south-cell.1', about: 'I.3', along: 'ew' }, { a: 'I.5', b: 'row.south-cell.2', about: 'I.3', along: 'ew' }]);
    expect(graph.lines).toEqual([{ rooms: ['I.4', 'I.5'], along: 'ew' }, { rooms: ['row.south-cell.1', 'row.south-cell.2'], along: 'ew' }]);
    expect(report.sockets.map(s => [s.name, s.room, s.bearing, s.joined])).toEqual([['w', 'I.3', 270, false], ['e', 'I.3', 90, false]]);
    expect(() => expand({ uses: [{ id: 'row', layout: 'cell-row', params: { 'per-row': 9, nope: 1 } }], bind: [{ use: 'row', role: 'north-cell', rooms: ['a', 'b'] }, { use: 'x', role: 'y', rooms: [] }] })).toThrow(
      /per-row 9 is outside 1\.\.6[\s\S]*has no parameter nope[\s\S]*bind row\.north-cell: 2 rooms for a part of 9[\s\S]*bind: no use x/);
  });

  test('joins: socket to socket keeps both walls and the bearing as a rule; sockets that do not face, or differ in width, are refused', () => {
    const { graph, report } = expand({ uses: [{ id: 'fig', layout: 'figure-eight' }, { id: 'vest', layout: 'stair-end' }], joins: [{ from: 'fig.right-end', to: 'vest.in' }, { from: 'fig.left-end', to: 'X.13' }], rooms: [{ id: 'X.13', w: 4, h: 4 }] });
    expect(graph.ways.filter(w => w.b === 'vest.vestibule' || w.b === 'X.13')).toEqual([
      { a: 'fig.b.3', b: 'vest.vestibule', bearing: 90, hold: true, wall: 90, wallB: 270 }, { a: 'fig.a.3', b: 'X.13', bearing: 270, hold: true, wall: 270 },
    ]);
    expect(report.sockets.filter(s => s.joined).map(s => `${s.use}.${s.name}`)).toEqual(['fig.left-end', 'fig.right-end', 'vest.in']);
    expect(() => expand({ uses: [{ id: 'a', layout: 'stair-end' }, { id: 'b', layout: 'stair-end' }], joins: [{ from: 'a.in', to: 'b.in' }] })).toThrow(/a\.in faces 270° and b\.in 270°; joined sockets face one another/);
    const wide = { ...SB_LAYOUTS.find(l => l.id === 'stair-end')!, id: 'wide-end', sockets: [{ name: 'in', part: 'vestibule', bearing: 'e' as const, width: 4 }] };
    expect(() => expand({ layouts: [wide], uses: [{ id: 'a', layout: 'stair-end' }, { id: 'b', layout: 'wide-end' }], joins: [{ from: 'b.in', to: 'a.in' }] })).toThrow(/b\.in is 4 cells wide and a\.in 2/);
    expect(() => expand({ uses: [{ id: 'a', layout: 'nope' }], joins: [{ from: 'a.x', to: 'zz' }] })).toThrow(/no layout "nope"[\s\S]*joins\[0\]\.from: no socket or room "a\.x"/);
  });

  test('a room grows when its walls are short for its ways (a ring hub with eight passages), unless told not to', () => {
    const spokes = [0, 1, 2, 3, 4, 5].map(k => ({ id: `S.${k}`, w: 4, h: 4 }));
    const joins = ['hub-e', 'hub-w', 'hub-ne', 'hub-se', 'hub-sw', 'hub-nw'].map((s, k) => ({ from: `ring.${s}`, to: `S.${k}` }));
    const { graph, report } = expand({ uses: [{ id: 'ring', layout: 'spine-ring-hub', params: { ring: 6 } }], rooms: spokes, joins });
    expect(report.grown).toEqual([{ room: 'ring.hub', from: [6, 6], to: [12, 12], ways: 8 }]);
    expect(graph.rooms.find(r => r.id === 'ring.hub')).toMatchObject({ w: 12, h: 12, shape: 'round' });
    const fixed = { ...D.LAYOUTS.find(l => l.id === 'spine-ring-hub')!, id: 'small-hub', parts: D.LAYOUTS.find(l => l.id === 'spine-ring-hub')!.parts.map(p => (p.role === 'hub' ? { ...p, grow: false } : p)) };
    const r2 = expand({ layouts: [fixed], uses: [{ id: 'ring', layout: 'small-hub', params: { ring: 6 } }], rooms: spokes, joins }).report;
    expect(r2.grown).toEqual([]);
    expect(r2.warnings).toEqual(['ring.hub: 8 ways leave a 6×6 room, more than its walls hold well']);
  });
});

describe('the shape a layout keeps once laid out (R2, R4)', () => {
  test('a row of cells mirrored about its hall', () => {
    const { graph } = expand({ uses: [{ id: 'row', layout: 'cell-row', params: { 'per-row': 2 } }], seed: 1, tries: 3, passages: 0 });
    const { report } = D.layoutGraph(graph);
    expect(report.left).toEqual([]);
    const h = place(report, 'row.hall');
    for (const k of [1, 2]) {
      const n = place(report, `row.north-cell.${k}`), s = place(report, `row.south-cell.${k}`);
      expect(n.cy).toBeLessThan(h.cy);
      expect(s.cy).toBeGreaterThan(h.cy);
      expect(Math.abs(n.cx - s.cx)).toBeLessThanOrEqual(2);
    }
    // every cell opens on the hall through the wall they share
    expect(report.walls).toBe(4);
  }, 60_000);

  test('a spiral held step by step turns as its sides say', () => {
    const { graph } = expand({ uses: [{ id: 'z', layout: 'spiral-14' }], pad: 1, seed: 1, tries: 2 });
    const { report } = D.layoutGraph(graph);
    expect(report.left).toEqual([]);
    expect(report.held).toEqual([]);
    const sides = ['e', 'e', 'e', 'n', 'n', 'n', 'w', 'w', 'w', 's', 's', 'e'];
    sides.forEach((side, k) => {
      const a = place(report, `z.p.${k + 1}`), b = place(report, `z.p.${k + 2}`), dx = b.cx - a.cx, dy = b.cy - a.cy;
      const main = { e: dx, w: -dx, n: -dy, s: dy }[side as 'e']!;
      expect(main, `step ${k + 1} ${side}`).toBeGreaterThan(Math.abs(side === 'e' || side === 'w' ? dy : dx));
    });
  }, 120_000);

  test('a rigid layout keeps its parts\' places as one block', () => {
    const { graph } = expand({ uses: [{ id: 'g', layout: 'gatehouse' }], rooms: [{ id: 'yard', w: 8, h: 6 }], joins: [{ from: 'g.in', to: 'yard' }], tries: 2 });
    expect(graph.rooms.find(r => r.id === 'g.east-tower')!.against).toEqual({ room: 'g.gate', dx: 3, dy: 0 });
    const { spec, report } = D.layoutGraph(graph);
    expect(report.left).toEqual([]);
    const gate = place(report, 'g.gate'), w = place(report, 'g.west-tower'), e = place(report, 'g.east-tower');
    expect([w.x - gate.x, w.y - gate.y, e.x - gate.x, e.y - gate.y]).toEqual([-4, 1, 2, 1]);
    expect(spec.connections!.map(c => [c.a, c.b].sort().join(' '))).toEqual(expect.arrayContaining(['g-east-tower g-gate', 'g-gate g-west-tower']));
  }, 60_000);

  test('setting_builder\'s X: a figure of eight with a stair end and spurs, designed in this format, lays out', () => {
    const fill = (id: string, w = 4, h = 4) => ({ id, w, h });
    const d: Partial<D.Design> = {
      id: 'X', pad: 1, seed: 7, tries: 3, passages: 1,
      uses: [{ id: 'fig', layout: 'figure-eight' }, { id: 'vest', layout: 'stair-end' }],
      bind: [{ use: 'fig', role: 'm', rooms: ['X.1'] }, { use: 'fig', role: 'a', rooms: ['X.2', 'X.3', 'X.4', 'X.5', 'X.6'] }, { use: 'fig', role: 'b', rooms: ['X.7', 'X.8', 'X.9', 'X.10', 'X.11'] }, { use: 'vest', role: 'vestibule', rooms: ['X.12'] }],
      rooms: [fill('X.13'), fill('X.14'), fill('X.15', 4, 2), fill('X.21', 2, 2)],
      joins: [{ from: 'fig.right-end', to: 'vest.in' }, { from: 'fig.left-end', to: 'X.13' }, { from: 'X.1', to: 'X.14' }, { from: 'X.3', to: 'X.15' }, { from: 'X.4', to: 'X.21' }],
    };
    const { graph } = expand(d), { spec, report } = D.layoutGraph(graph);
    expect(graph.rooms.length).toBe(16);
    expect(report.left).toEqual([]);
    expect(D.lintDungeon(spec).filter(f => f.severity === 'error')).toEqual([]);
  }, 120_000);
});
