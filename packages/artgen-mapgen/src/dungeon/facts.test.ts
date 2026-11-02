// Facts read back from a dungeon: rooms, corridors, exits, overlaps and unreached rooms, in cells and in the map's scale unit.
import { describe, expect, test } from 'vitest';
import { dungeonFacts, newDungeon, type Room } from './index.ts';

const rooms = (): Room[] => [
  { id: 'a', shape: 'rect', x: 2, y: 2, w: 4, h: 3, label: 'A.1 Hall' },
  { id: 'b', shape: 'rect', x: 4, y: 3, w: 6, h: 4, number: false },
  { id: 'c', shape: 'rect', x: 14, y: 12, w: 3, h: 3 },
  { id: 'd', shape: 'circle', x: 11, y: 2, w: 4, h: 4 },
];
const spec = (over: Partial<Parameters<typeof newDungeon>[1]> = {}) => newDungeon('t', { cols: 20, rows: 16, rooms: rooms(), corridors: [{ from: { room: 'a' }, to: { at: [18, 3.5] }, doors: ['door', 'secret'] }, { from: { room: 'b' }, to: { room: 'd' } }], ...over });

describe('dungeon facts', () => {
  test('a room states its box in cells and in the scale unit, its shape, number and doors', () => {
    const f = dungeonFacts(spec());
    expect(f).toMatchObject({ version: 2, id: 't', size: { cols: 20, rows: 16 }, unit: { map: 'cell', scale: 'ft' } });
    expect(f.rooms.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(f.rooms[0]).toEqual({
      id: 'a', number: 1, label: 'A.1 Hall', shape: 'rect', box: { cells: { x: 2, y: 2, w: 4, h: 3 }, scale: { x: 10, y: 10, w: 20, h: 15 } },
      doors: [{ kind: 'door', at: [6, 3.5], corridor: 0, to: null }],
    });
    expect(f.rooms[1]).toMatchObject({ number: null, label: null, doors: [] });
    expect(f.rooms[3]).toMatchObject({ shape: 'circle', number: 3, box: { cells: { x: 11, y: 2, w: 4, h: 4 } } });
  });

  test('a door whose corridor never leaves the room (rooms laid over each other) is listed without a position', () => {
    const f = dungeonFacts(spec({ rooms: [{ id: 'a', shape: 'rect', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', shape: 'rect', x: 2, y: 2, w: 3, h: 3 }], corridors: [{ from: { room: 'a' }, to: { room: 'b' }, doors: ['door', null] }] }));
    expect(f.rooms[0].doors).toEqual([{ kind: 'door', at: null, corridor: 0, to: 'b' }]);
    expect(f.corridors[0].length.map).toBeLessThan(1.6);   // only the stretch outside b
  });

  test('a corridor states its ends, doors, width and its length between the rooms it joins', () => {
    const [out, between] = dungeonFacts(spec()).corridors;
    expect(out).toEqual({ index: 0, from: { room: 'a' }, to: { at: [18, 3.5] }, width: 1, doors: ['door', 'secret'], length: { map: 12, scale: 60 }, path: [4.5, 3.5, 18, 3.5, 18, 3.5] });
    expect(between).toMatchObject({ index: 1, from: { room: 'b' }, to: { room: 'd' }, doors: [null, null], width: 1 });
    expect(between.length.map).toBeGreaterThanOrEqual(0);
    expect(between.length.scale).toBe(Math.round(between.length.map * 5 * 10) / 10);
  });

  test('a corridor ending at a point is an exit: its point, the room it leaves from, its door and the nearest map edge', () => {
    const f = dungeonFacts(spec());
    expect(f.exits).toEqual([{ corridor: 0, end: 'to', at: [18, 3.5], room: 'a', door: 'secret', edge: 'e', distance: { map: 2, scale: 10 } }]);
    const out = dungeonFacts(spec({ corridors: [{ from: { room: 'c' }, to: { at: [-2, 14] } }, { from: { at: [10, 15] }, to: { room: 'c' } }] })).exits;
    expect(out.map(x => [x.corridor, x.end, x.room, x.edge, x.distance.map])).toEqual([[0, 'to', 'c', 'w', -2], [1, 'from', 'c', 's', 1]]);
  });

  test('overlapping rooms are reported as pairs with the cells they share; touching rooms are not', () => {
    const f = dungeonFacts(spec());
    expect(f.overlaps).toEqual([{ rooms: ['a', 'b'], cells: [[4, 3], [5, 3], [4, 4], [5, 4]], count: 4, box: { cells: { x: 4, y: 3, w: 2, h: 2 }, scale: { x: 20, y: 15, w: 10, h: 10 } } }]);
    const touching = dungeonFacts(spec({ rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 4, h: 3 }, { id: 'b', shape: 'rect', x: 6, y: 2, w: 4, h: 3 }], corridors: [] }));
    expect(touching.overlaps).toEqual([]);
    const round = dungeonFacts(spec({ rooms: [{ id: 'a', shape: 'rect', x: 0, y: 0, w: 6, h: 6 }, { id: 'b', shape: 'circle', x: 3, y: 3, w: 6, h: 6 }], corridors: [] })).overlaps;
    expect(round).toHaveLength(1);
    expect(round[0].count).toBeLessThan(9);   // the circle leaves its corner cell out
    expect(round[0].cells.some(c => c[0] === 3 && c[1] === 3)).toBe(false);
  });

  test('rooms no corridor starts or ends at are unreached', () => {
    expect(dungeonFacts(spec()).unreached).toEqual(['c']);
    expect(dungeonFacts(spec({ corridors: [] })).unreached).toEqual(['a', 'b', 'c', 'd']);
  });

  test('the same dungeon gives the same facts, byte for byte', () => {
    const d = spec();
    expect(JSON.stringify(dungeonFacts(d))).toBe(JSON.stringify(dungeonFacts(structuredClone(d))));
  });

  test('each door says what it stands between: a wall between a room and its corridor, a connection between two rooms', () => {
    const s = newDungeon('w', {
      cols: 20, rows: 10, rooms: [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 4, h: 4 }, { id: 'b', shape: 'rect', x: 5, y: 1, w: 4, h: 4 }, { id: 'c', shape: 'rect', x: 14, y: 1, w: 4, h: 4 }],
      corridors: [{ from: { room: 'b' }, to: { room: 'c' }, doors: ['door', 'locked'] }], connections: [{ a: 'a', b: 'b', kind: 'secret' }],
    });
    const f = dungeonFacts(s);
    expect(f.doors.map(d => [d.kind, d.on, d.wall])).toEqual([
      ['door', 'wall', [['room:b', 'corridor:0'], ['corridor:0']]],
      ['locked', 'wall', [['room:c', 'corridor:0'], ['corridor:0']]],
      ['secret', 'wall', [['room:a'], ['room:b']]],
    ]);
    expect(f.doors[0]).toMatchObject({ at: [9, 3.5], angle: 0, width: 1, corridor: 0, connection: null });
    expect(f.doors[2]).toMatchObject({ at: [5, 3.5], corridor: null, connection: 0 });
  });

  test('a door in open floor or on rock says so: rooms laid over each other', () => {
    // the rooms overlap; the only edge they share is their top wall, so the connection's door stands on the outer wall, on rock
    const s = newDungeon('o', { cols: 12, rows: 8, rooms: [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 6, h: 4 }, { id: 'b', shape: 'rect', x: 4, y: 1, w: 6, h: 4 }], corridors: [], connections: [{ a: 'a', b: 'b', at: [5, 3] }] });
    // a corridor's door on a's wall, but inside big: the floor runs on through it
    const t2 = newDungeon('o2', { cols: 14, rows: 8, rooms: [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 4, h: 4 }, { id: 'big', shape: 'rect', x: 4, y: 0, w: 8, h: 7 }], corridors: [{ from: { room: 'a' }, to: { at: [13, 3] }, doors: ['door', null] }] });
    expect(dungeonFacts(s).doors.map(d => d.on)).toEqual(['rock']);
    expect(dungeonFacts(t2).doors[0].on).toBe('open');
  });

  test('the floor: which unit owns each cell, as runs per row, and which units meet', () => {
    const s = newDungeon('g', { cols: 10, rows: 4, rooms: [{ id: 'a', shape: 'rect', x: 1, y: 0, w: 3, h: 3 }, { id: 'b', shape: 'rect', x: 4, y: 0, w: 2, h: 3 }], corridors: [{ from: { room: 'b' }, to: { at: [9, 1.5] } }] });
    const f = dungeonFacts(s);
    expect(f.floor.owners).toEqual(['room:a', 'room:b', 'corridor:0']);
    expect(f.floor.rows).toEqual([[-1, 1, 0, 3, 1, 2, -1, 4], [-1, 1, 0, 3, 1, 2, 2, 4], [-1, 1, 0, 3, 1, 2, -1, 4], [-1, 10]]);
    expect(f.adjacent).toEqual([{ a: 'room:a', b: 'room:b', along: { map: 3, scale: 15 } }, { a: 'room:b', b: 'corridor:0', along: { map: 1, scale: 5 } }]);
  });
});
