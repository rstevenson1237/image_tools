// Drawing checks (`dungeon check`) and the grid in the map's own unit.
import { describe, expect, test } from 'vitest';
import * as D from './index.ts';

const base = (over: Partial<D.DungeonSpec> = {}) => D.newDungeon('t', { cols: 30, rows: 20, ...over });
const paths = (s: D.DungeonSpec) => D.lintDungeon(s).map(f => `${f.severity} ${f.path}`);

describe('lintDungeon', () => {
  test('a clean layout has no findings', () => {
    const s = base({ rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4 }, { id: 'b', shape: 'rect', x: 14, y: 2, w: 4, h: 4 }], corridors: [{ from: { room: 'a' }, to: { room: 'b' }, doors: ['door', null] }] });
    expect(D.lintDungeon(s)).toEqual([]);
    for (const seed of [1, 2, 3, 4]) expect(D.lintDungeon(D.generateDungeon(base({ seed }))).filter(f => f.severity === 'error')).toEqual([]);
  });

  test('rooms: an outline that crosses itself or has no area is an error; a repeated corner, off the sheet and overlap are warnings', () => {
    const bow: D.Room = { id: 'bow', shape: 'poly', points: [2, 2, 8, 8, 8, 2, 2, 8], ...D.polyBox([2, 2, 8, 8, 8, 2, 2, 8]) };
    const flat: D.Room = { id: 'flat', shape: 'poly', points: [10, 2, 14, 2, 18, 2], ...D.polyBox([10, 2, 14, 2, 18, 2]) };
    const rep: D.Room = { id: 'rep', shape: 'poly', points: [20, 2, 24, 2, 24, 2, 24, 6, 20, 6], ...D.polyBox([20, 2, 24, 2, 24, 6, 20, 6]) };
    expect(paths(base({ rooms: [bow, flat, rep] }))).toEqual(expect.arrayContaining(['error rooms[0].points', 'error rooms[1]', 'warning rooms[2].points']));
    const off = base({ rooms: [{ id: 'x', shape: 'rect', x: 27, y: 2, w: 6, h: 4 }, { id: 'y', shape: 'rect', x: 40, y: 2, w: 2, h: 2 }] });
    expect(D.lintDungeon(off).map(f => f.message)).toEqual([expect.stringContaining('runs off the sheet'), expect.stringContaining('is off the sheet')]);
    const over = base({ rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4 }, { id: 'b', shape: 'rect', x: 5, y: 3, w: 6, h: 4 }, { id: 'c', shape: 'rect', x: 4, y: 3, w: 2, h: 2, fill: 'cellar' }] });
    expect(D.lintDungeon(over)).toEqual([{ severity: 'warning', path: 'rooms[1]', message: expect.stringMatching(/b lies over a \(9 cells\)/) }]);
  });

  test('corridors: through a third room, crossing another, never leaving a room, ending inside one, a repeated bend', () => {
    const rooms: D.Room[] = [
      { id: 'a', shape: 'rect', x: 1, y: 8, w: 4, h: 4 }, { id: 'b', shape: 'rect', x: 25, y: 8, w: 4, h: 4 },
      { id: 'm', shape: 'rect', x: 12, y: 8, w: 4, h: 4 }, { id: 'n', shape: 'rect', x: 12, y: 1, w: 4, h: 3 }, { id: 's', shape: 'rect', x: 12, y: 16, w: 4, h: 3 },
    ];
    const s = base({ rooms, corridors: [
      { from: { room: 'a' }, to: { room: 'b' } },                                  // through m
      { from: { room: 'n' }, to: { room: 's' }, via: [18, 2.5, 18, 17.5] },          // crosses corridor 0 outside the rooms
      { from: { room: 'a' }, to: { at: [3, 10] }, doors: ['door', null] },          // never leaves a, ends inside it
      { from: { room: 'n' }, to: { at: [20, 2.5] }, via: [17, 2.5, 17, 2.5] },
    ] });
    const f = D.lintDungeon(s);
    expect(f.find(x => x.path === 'corridors[0]')?.message).toMatch(/runs through m/);
    expect(f.find(x => x.path === 'corridors[1]')?.message).toMatch(/crosses corridor 0 at 18\.0,10\.5/);
    expect(f.filter(x => x.path.startsWith('corridors[2]')).map(x => x.message)).toEqual([expect.stringMatching(/never leaves a .*door is not drawn/), expect.stringMatching(/inside a; link to the room/)]);
    expect(f.find(x => x.path === 'corridors[3].via')?.message).toMatch(/bend 1 repeats bend 0/);
  });

  test('marks: off the sheet, a symbol on a room number, labels on labels', () => {
    const s = base({
      rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4 }],
      overlay: {
        labels: [{ text: 'Bone pit', x: 15, y: 10, kind: 'name' }, { text: 'Bone pit too', x: 15.5, y: 10.1, kind: 'name' }, { text: 'Far', x: 35, y: 1, kind: 'note' }],
        symbols: [{ kind: 'pillar', x: 5, y: 4 }, { kind: 'altar', x: -1, y: 4 }],
      },
    });
    expect(paths(s)).toEqual(['warning overlay.symbols[0]', 'warning overlay.symbols[1]', 'warning overlay.labels[1]', 'warning overlay.labels[2]']);
    expect(paths({ ...s, numbers: false })).not.toContain('warning overlay.symbols[0]');
  });
});

describe('grid in the map unit', () => {
  test('size in feet → squares; the sub-grid needs two squares or more', () => {
    const s = base();
    expect(D.gridFromUnits(s, { size: 15, sub: false })).toMatchObject({ show: true, size: 3, sub: false });
    expect(() => D.gridFromUnits(s, { size: 12 })).toThrow(/whole number of squares/);
    expect(() => D.gridFromUnits(s, { size: 0 })).toThrow(/whole number/);
    expect(D.gridFromUnits(s, { show: false })).toMatchObject({ show: false, size: 2 });
    expect(D.gridInUnits(s)).toEqual({ show: true, size: 10, unit: 'ft', sub: true, subSize: 5 });
    expect(D.gridInUnits({ ...s, grid: { ...s.grid, size: 1 } }).sub).toBe(false);
    expect(D.gridInUnits({ ...s, scale: { perCell: 1.5, unit: 'm' } })).toMatchObject({ size: 3, unit: 'm' });
  });
});
