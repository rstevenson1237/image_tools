import { describe, expect, test } from 'vitest';
import { dungeon, map, settlement } from './index.ts';
import { SUBJECTS, checkSource, sizeOf } from './workflow.ts';

const ids = (cs: { id: string; status: string }[], status: string) => cs.filter(c => c.status === status).map(c => c.id);

describe('subjects', () => {
  test('the three engines, with their folder and file', () => {
    expect(Object.values(SUBJECTS).map(s => [s.kind, s.dir, s.file])).toEqual([['map', 'maps', 'map.json'], ['dungeon', 'dungeons', 'dungeon.json'], ['settlement', 'settlements', 'settlement.json']]);
  });

  test('a map: format errors fail with their paths; a good one passes; symbols outside the set are flagged', () => {
    const m = map.newMap('keep', 'local', { seed: 3 });
    expect(checkSource('map', JSON.stringify(m))).toEqual([{ id: 'format', status: 'pass', detail: 'ok' }]);
    const bad = checkSource('map', JSON.stringify({ ...m, cols: -1 }));
    expect(ids(bad, 'fail')).toEqual(['format']);
    expect(bad[0].detail).toMatch(/^cols: /);
    const withSymbols = { ...m, overlay: { labels: [], symbols: [{ kind: 'castle', x: 2, y: 2 }, { kind: 'tower', x: 3, y: 3 }] } };
    const c = checkSource('map', JSON.stringify(withSymbols), { symbols: ['castle'] });
    expect(c.filter(x => x.id === 'symbols')).toEqual([{ id: 'symbols', status: 'flag', detail: expect.stringContaining('tower') }]);
    expect(checkSource('map', JSON.stringify(withSymbols), { symbols: ['castle', 'tower'] }).find(x => x.id === 'symbols')).toMatchObject({ status: 'pass' });
    expect(checkSource('map', JSON.stringify(withSymbols)).some(x => x.id === 'symbols')).toBe(false);
  });

  test('a dungeon: a lint error fails, a lint warning flags, a clean one passes lint', () => {
    const d = dungeon.generateDungeon(dungeon.parseDungeon({ id: 'hole', seed: 2, cols: 24, rows: 18 }));
    expect(ids(checkSource('dungeon', JSON.stringify(d)), 'fail')).toEqual([]);
    const crossed = { ...d, rooms: [{ id: 'r1', shape: 'poly', points: [2, 2, 8, 8, 8, 2, 2, 8], x: 2, y: 2, w: 6, h: 6 }], corridors: [] };
    expect(ids(checkSource('dungeon', JSON.stringify(crossed)), 'fail')).toEqual(['lint']);
    const over = { ...d, rooms: [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4 }, { id: 'b', shape: 'rect', x: 5, y: 3, w: 6, h: 4 }], corridors: [] };
    expect(ids(checkSource('dungeon', JSON.stringify(over)), 'flag')).toEqual(['lint']);
  });

  test('a settlement: its checks and its sheet', () => {
    const s = settlement.generateSettlement(settlement.parseSettlement({ id: 'ford', kind: 'hamlet', seed: 3, cols: 30, rows: 22 }));
    const checks = checkSource('settlement', JSON.stringify(s));
    expect(ids(checks, 'fail')).toEqual([]);
    const sheet = SUBJECTS.settlement.sheet(s, checks);
    expect(sheet).toMatchObject({ title: 'ford — hamlet', subject: 'settlement:ford' });
    expect(sheet.rows.map((r: { label: string }) => r.label)).toEqual(expect.arrayContaining(['Kind', 'Size', 'Buildings', 'Checks']));
  });

  test('the sheet of a map lists what must hold, met or not', () => {
    const m = map.newMap('keep', 'local', { seed: 3, require: [{ id: 'C-lake', kind: 'terrain', area: { circle: [6, 4, 3] }, terrain: 'forest', share: 0.2 }] });
    const sheet = SUBJECTS.map.sheet(m, checkSource('map', JSON.stringify(m)));
    expect(sheet.must).toEqual([{ text: expect.stringContaining('C-lake terrain forest'), met: expect.any(Boolean) }]);
    expect(sheet.rows.find((r: { label: string }) => r.label === 'Size')?.value).toBe(`${m.cols}x${m.rows} cells, ${m.scale.perCell} ${m.scale.unit} a cell`);
  });

  test('sizeOf reads the cells of a file\'s text', () => {
    expect(sizeOf('{"cols": 20, "rows": 14}')).toEqual({ cols: 20, rows: 14 });
    expect(sizeOf('nope')).toBeNull();
  });
});
