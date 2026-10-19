// Format versions: a file without one reads as 1, an older one is migrated, a newer one is refused.
import { describe, expect, test } from 'vitest';
import { dungeon, map, readFormat } from './index.ts';

describe('readFormat', () => {
  test('a file without a version reads as 1', () => {
    expect(readFormat({ id: 'x' }, 'map', 1)).toEqual({ id: 'x' });
    expect(map.parseMap({ ...map.newMap('m'), version: undefined }).version).toBe(1);
    expect(dungeon.parseDungeon({ ...dungeon.newDungeon('d'), version: undefined }).version).toBe(1);
  });

  test('a newer file is refused with both versions named', () => {
    expect(() => map.parseMap({ ...map.newMap('m'), version: 2 })).toThrow(/map is format version 2.*reads map format 1/);
    expect(() => dungeon.parseDungeon({ ...dungeon.newDungeon('d'), version: 7 })).toThrow(/dungeon is format version 7.*reads dungeon format 1/);
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
    expect(dungeon.DUNGEON_FORMAT).toBe(1);
    expect(map.newMap('m').version).toBe(map.MAP_FORMAT);
    expect(dungeon.newDungeon('d').version).toBe(dungeon.DUNGEON_FORMAT);
  });

  test('a map may be 200 squares a side, no more', () => {
    expect(map.newMap('gorge', 'local', { cols: 16, rows: 184 }).rows).toBe(184);
    expect(() => map.newMap('big', 'local', { cols: 16, rows: 201 })).toThrow(/rows: an integer from 4 to 200/);
  });
});
