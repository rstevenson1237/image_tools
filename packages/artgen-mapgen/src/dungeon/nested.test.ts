// A level laid out from the bottom up (R13): each layout alone, then each block of its pieces, then the level.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

const design = (over: Partial<D.Design> = {}): D.Design => ({
  id: 'L', width: 2, seed: 1, tries: 2, pad: 1,
  uses: [{ id: 'row', layout: 'cell-row', params: { 'per-row': 2 } }, { id: 'ste', layout: 'suite' }, { id: 'byp', layout: 'secret-bypass' }, { id: 'v', layout: 'stair-vestibule' }],
  rooms: [{ id: 'Gate', w: 4, h: 4 }, { id: 'Yard', w: 6, h: 6 }],
  joins: [{ from: 'row.e', to: 'Yard' }, { from: 'Gate', to: 'Yard' }, { from: 'ste.n', to: 'Yard' }, { from: 'byp.near', to: 'row.hall' }, { from: 'byp.far', to: 'ste.in' }, { from: 'v.in', to: 'Gate' }],
  blocks: [{ id: 'west', uses: ['row', 'byp'] }, { id: 'east', uses: ['ste', 'v'], rooms: ['Gate', 'Yard'] }],
  ...over,
});

describe('a level laid out from the bottom up', () => {
  test('the tree: each layout alone, then each block, then the level; every way routed, and each piece keeps its shape', () => {
    const { spec, report } = D.layoutNested(design(), D.LAYOUTS);
    expect(report.steps.map(s => `${s.kind} ${s.id}`)).toEqual(['layout row', 'layout byp', 'block west', 'layout ste', 'layout v', 'block east', 'level L']);
    expect(report.final.left).toEqual([]);
    for (const s of report.steps) expect(s.left, s.id).toEqual([]);
    // the loose rooms of a block join the layout they share most ways with
    const roomsOf = (id: string) => report.steps.find(s => s.id === id)!.rooms;
    expect(roomsOf('ste') + roomsOf('v')).toBe(2 + 1 + 2);
    expect(spec.rooms.length).toBe(13);
    expect(D.lintDungeon(spec).filter(f => f.severity === 'error')).toEqual([]);
    // the cell row keeps its rows on each side of its hall, as its piece laid them out
    const at = (id: string) => spec.rooms.find(r => r.id === id)!, hall = at('row-hall');
    const side = (id: string) => (at(id).y + at(id).h <= hall.y + 0.01 ? 'above' : at(id).y >= hall.y + hall.h - 0.01 ? 'below' : 'beside');
    const north = [1, 2].map(k => side(`row-north-cell-${k}`)), south = [1, 2].map(k => side(`row-south-cell-${k}`));
    expect(new Set(north).size).toBe(1);
    expect(new Set([...north, ...south])).toEqual(new Set(['above', 'below']));
    expect(JSON.stringify(D.layoutNested(design(), D.LAYOUTS).spec)).toBe(JSON.stringify(spec));
  }, 120_000);

  test('with no blocks, each layout and the rooms beside it are a piece of the level', () => {
    const { report } = D.layoutNested(design({ blocks: undefined }), D.LAYOUTS);
    expect(report.steps.filter(s => s.kind === 'block')).toEqual([]);
    expect(report.steps.filter(s => s.kind === 'layout').length).toBe(4);
    expect(report.final.left).toEqual([]);
  }, 120_000);

  test('seeds scored the same way as a flat layout', () => {
    const { ranked } = D.nestedCandidates(design(), D.LAYOUTS, 2);
    expect(ranked.length).toBe(2);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[0].nested.steps.length).toBe(7);
  }, 120_000);
});

describe('the router\'s last resorts', () => {
  test('a crossroads: straight over a passage it shares no room with, only when allowed', async () => {
    const R = await import('./router.ts');
    const box = (x: number, y: number, w: number, h: number) => new R.Footprint(x, y, w, h, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    // a and b left and right; c and d above and below; c to d runs first, straight down between them
    const rooms = new Map([['a', box(0, 40, 20, 20)], ['b', box(100, 40, 20, 20)], ['c', box(50, 0, 20, 20)], ['d', box(50, 90, 20, 20)]]);
    const taken = new Map<string, string[]>();
    for (let j = 2; j <= 8; j++) taken.set(`5,${j}`, ['c', 'd']);
    expect(R.plan(rooms, [['a', 'b']], { seed: 1, clearance: 0, taken, margin: 0 }).left).toEqual(['a to b']);
    const { routes, left } = R.plan(rooms, [['a', 'b']], { seed: 1, clearance: 0, taken, margin: 0, cross: true });
    expect(left).toEqual([]);
    expect(routes[0].cells.some(([i, j]) => i === 5 && j >= 4 && j <= 5)).toBe(true);
  });
  test('ways named first are routed first', async () => {
    const R = await import('./router.ts');
    const box = (x: number, y: number) => new R.Footprint(x, y, 20, 20, [[x, y], [x + 20, y], [x + 20, y + 20], [x, y + 20]], true);
    const rooms = new Map([['a', box(0, 0)], ['b', box(60, 0)], ['c', box(200, 0)]]);
    expect(R.plan(rooms, [['a', 'c'], ['a', 'b']], { seed: 1 }).routes.map(r => r.b)).toEqual(['b', 'c']);
    expect(R.plan(rooms, [['a', 'c'], ['a', 'b']], { seed: 1, first: [['a', 'c']] }).routes.map(r => r.b)).toEqual(['c', 'b']);
  });
});
