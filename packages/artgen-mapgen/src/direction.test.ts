import { describe, expect, test } from 'vitest';
import { checkMapDirection, editMapDirection, lockMapDirection, lockedMapDirection, newMapDirection, parseMapDirection, parseSymbolsFlag, parseThemeFlag, symbolsFor, themeFor } from './direction.ts';

describe('map direction', () => {
  const file = { id: 'maps', version: 1, status: 'locked', themes: { map: 'bw', dungeon: 'bw', settlement: 'color' }, symbols: { dungeon: ['altar', 'statue', 'stairs'] }, note: 'printed handouts' };

  test('a good file parses; a bad one lists every problem with its path', () => {
    expect(parseMapDirection(file)).toEqual(file);
    expect(checkMapDirection({ ...file, themes: { map: 'sepia', dungeon: 'color', moon: 'bw' }, symbols: { dungeon: ['altar', 'unicorn'] }, version: -1 })).toEqual([
      'version: a whole number, 0 or more', 'version: 1 or more when locked', 'themes.map: one of color, bw', 'themes.dungeon: one of bw', 'themes.moon: not a kind (map, dungeon, settlement)', 'symbols.dungeon: a list of dungeon symbol kinds (not unicorn)',
    ]);
    expect(checkMapDirection({ ...file, version: 0 })).toEqual(['version: 1 or more when locked']);
    expect(() => parseMapDirection([])).toThrow(/a JSON object/);
  });

  test('only a locked direction applies: its theme and symbol set; otherwise the defaults', () => {
    expect(themeFor(parseMapDirection(file), 'map')).toBe('bw');
    expect(themeFor(parseMapDirection(file), 'settlement')).toBe('color');
    expect(symbolsFor(parseMapDirection(file), 'dungeon')).toEqual(['altar', 'statue', 'stairs']);
    expect(symbolsFor(parseMapDirection(file), 'map')).toBeUndefined();
    const draft = { ...parseMapDirection(file), status: 'draft' as const };
    expect(lockedMapDirection(draft)).toBeNull();
    expect([themeFor(draft, 'map'), themeFor(null, 'dungeon'), themeFor(undefined, 'settlement'), symbolsFor(draft, 'dungeon')]).toEqual(['color', 'bw', 'color', undefined]);
  });

  test('flags: kind=theme pairs and kind=symbols, merged over the draft, locked by moving the version up', () => {
    expect(parseThemeFlag('map=bw, settlement=color')).toEqual({ map: 'bw', settlement: 'color' });
    expect(() => parseThemeFlag('map')).toThrow(/kind=theme pairs/);
    expect(() => parseThemeFlag('dungeon=color')).toThrow(/--theme dungeon: one of bw/);
    expect(parseSymbolsFlag('dungeon=altar,statue;map=castle')).toEqual({ dungeon: ['altar', 'statue'], map: ['castle'] });
    expect(() => parseSymbolsFlag('dungeon=castle')).toThrow(/no such symbol castle/);
    let d = editMapDirection(newMapDirection(), { themes: { map: 'bw' }, symbols: parseSymbolsFlag('dungeon=altar') });
    expect(d).toEqual({ id: 'maps', version: 0, status: 'draft', themes: { map: 'bw' }, symbols: { dungeon: ['altar'] } });
    d = lockMapDirection(d);
    expect(d).toMatchObject({ version: 1, status: 'locked' });
    d = editMapDirection(d, { themes: { settlement: 'bw' }, symbols: { dungeon: [] } });
    expect(d).toEqual({ id: 'maps', version: 1, status: 'draft', themes: { map: 'bw', settlement: 'bw' }, symbols: {} });
    expect(lockMapDirection(d).version).toBe(2);
  });
});
