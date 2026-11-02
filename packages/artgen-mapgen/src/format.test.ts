// Format versions: a file without one reads as 1, an older one is migrated, a newer one is refused.
import { describe, expect, test } from 'vitest';
import { dungeon, map, readFormat } from './index.ts';

describe('readFormat', () => {
  test('a file without a version reads as 1', () => {
    expect(readFormat({ id: 'x' }, 'map', 1)).toEqual({ id: 'x' });
    expect(map.parseMap({ ...map.newMap('m'), version: undefined }).version).toBe(1);
    // a dungeon without a version reads as format 1, migrated to the current one
    expect(dungeon.parseDungeon({ ...dungeon.newDungeon('d'), version: undefined }).version).toBe(dungeon.DUNGEON_FORMAT);
  });

  test('a newer file is refused with both versions named', () => {
    expect(() => map.parseMap({ ...map.newMap('m'), version: 2 })).toThrow(/map is format version 2.*reads map format 1/);
    expect(() => dungeon.parseDungeon({ ...dungeon.newDungeon('d'), version: 7 })).toThrow(/dungeon is format version 7.*reads dungeon format 2/);
    expect(() => readFormat({ version: 3 }, 'map', 2)).toThrow(/version 3.*format 2/);
  });

  test('a version that is not a whole number from 1 is refused', () => {
    for (const v of [0, -1, 1.5, '1', null]) expect(() => readFormat({ version: v }, 'map', 1)).toThrow(/whole number/);
  });

  test('an older file is migrated step by step, the version set by the reader', () => {
    const migrations = { 1: (r: Record<string, unknown>) => ({ ...r, steps: [...((r.steps as string[]) ?? []), '1->2'] }), 2: (r: Record<string, unknown>) => ({ ...r, steps: [...((r.steps as string[]) ?? []), '2->3'] }) };
    expect(readFormat({ id: 'x' }, 'map', 3, migrations)).toEqual({ id: 'x', version: 3, steps: ['1->2', '2->3'] });
    expect(readFormat({ id: 'x', version: 2 }, 'map', 3, migrations)).toEqual({ id: 'x', version: 3, steps: ['2->3'] });
    expect(() => readFormat({ version: 1 }, 'map', 2, {})).toThrow(/map format 1 -> 2: no migration/);
  });

  test('parse keeps the version it read and writes the current one', () => {
    expect(map.MAP_FORMAT).toBe(1);
    expect(dungeon.DUNGEON_FORMAT).toBe(2);
    expect(map.newMap('m').version).toBe(map.MAP_FORMAT);
    expect(dungeon.newDungeon('d').version).toBe(dungeon.DUNGEON_FORMAT);
  });

  test('dungeon format 1 -> 2: style.sharedWalls keeps what format 1 drew (true becomes rooms; unset, on with connections or blocks)', () => {
    const v1 = (style: Record<string, unknown>, more: Record<string, unknown> = {}) => dungeon.parseDungeon({ ...dungeon.newDungeon('d'), version: 1, style: { hatch: 'band', band: 0.9, wall: 1, ...style }, ...more }).style.sharedWalls;
    expect(v1({ sharedWalls: true })).toBe('rooms');
    expect(v1({ sharedWalls: false })).toBe(false);
    expect(v1({})).toBe(false);
    const rooms = [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 3, h: 3 }, { id: 'b', shape: 'rect', x: 4, y: 1, w: 3, h: 3 }];
    expect(v1({}, { rooms, connections: [{ a: 'a', b: 'b' }] })).toBe('rooms');
    // a format 2 file leaves it unset: walls between any two units
    expect(dungeon.newDungeon('n').style.sharedWalls).toBeUndefined();
    expect(dungeon.corridorWallsOn(dungeon.newDungeon('n'))).toBe(true);
  });

  test('a format 1 file draws exactly as before the bump, walls and all', () => {
    const rooms = [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 4, h: 4 }, { id: 'm', shape: 'rect', x: 8, y: 2, w: 6, h: 3 }, { id: 'b', shape: 'rect', x: 16, y: 2, w: 4, h: 4 }];
    const raw = { ...dungeon.newDungeon('d', { cols: 24, rows: 10 }), version: 1, style: { hatch: 'band', band: 0.9, wall: 1, sharedWalls: true }, rooms, corridors: [{ from: { room: 'a', side: 'e', offset: 3.5 }, to: { room: 'b', side: 'w', offset: 3.5 } }] };
    const old = dungeon.parseDungeon(raw), now = dungeon.parseDungeon({ ...raw, version: 2 });
    // format 1's walls are between rooms only, so the corridor along m's wall gets none; format 2's true draws it
    expect(dungeon.layoutDungeon(old).partitions).toEqual([]);
    expect(dungeon.layoutDungeon(now).partitions).toEqual([[14, 5, 8, 5]]);
  });

  test('a map may be 200 squares a side, no more', () => {
    expect(map.newMap('gorge', 'local', { cols: 16, rows: 184 }).rows).toBe(184);
    expect(() => map.newMap('big', 'local', { cols: 16, rows: 201 })).toThrow(/rows: an integer from 4 to 200/);
  });
});
