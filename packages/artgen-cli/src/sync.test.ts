// `origin` and `sync` (artgen A8): a sync replaces the entries of one origin and keeps every other entry in order, hand edits
// last; conflicts are reported, never resolved silently. Held to the `ravine`, `warren` and `shrine-crypts` fixtures.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/setting-builder/', import.meta.url));
const F = (name: string, file: string) => join(FIXTURES, name, file);

async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
}
const tmp = () => mkdtempSync(join(tmpdir(), 'artgen-sync-'));
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f: string, v: unknown) => writeFileSync(f, JSON.stringify(v, null, 2));
const copy = (name: string, file: string) => { const to = join(tmp(), file); cpSync(F(name, file), to); return to; };
/** The target's own entries of an origin, as a file a consumer would write. */
const tablesOf = <T extends { origin?: string }>(list: T[], origin = 'tables') => structuredClone(list.filter(e => e.origin === origin));

describe('ravine: map sync', () => {
  test('the hand edits are kept, in order, after the generated ones; E.2 moves; the river stays where it was', async () => {
    const target = copy('ravine', 'map.json'), before = read(target), from = join(tmp(), 'new.json');
    const next = structuredClone(before);
    next.edits = tablesOf(before.edits); next.require = tablesOf(before.require);
    next.overlay = { labels: tablesOf(before.overlay.labels), symbols: tablesOf(before.overlay.symbols) };
    const move = (e: { x: number; y: number }) => { e.y -= 3; };
    next.overlay.labels.filter((l: { text: string }) => l.text.startsWith('E.2 ')).forEach(move);
    next.overlay.symbols.filter((s: { x: number; y: number }) => s.x === 4 && s.y === 150).forEach(move);
    write(from, next);
    const r = await cli('map', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json'), j = JSON.parse(r.out), after = read(target);
    expect(r.code).toBe(0);
    expect(j).toMatchObject({ version: 1, origin: 'tables', conflicts: [] });
    expect(j.lists.edits).toEqual({ removed: 1, added: 1, kept: 2 });
    expect(after.edits.map((e: { op: string; origin?: string }) => [e.op, e.origin ?? 'hand'])).toEqual([['road', 'tables'], ['elevate', 'hand'], ['elevate', 'hand']]);
    expect(after.edits.slice(1)).toEqual(before.edits.slice(1));      // the hand edits, as they were, in order
    expect(after.require).toEqual(before.require);
    expect(after.overlay.labels.find((l: { text: string }) => l.text.startsWith('E.2 ')).y).toBe(147);
    expect(after.overlay.symbols.find((s: { x: number; y: number }) => s.x === 4 && s.y === 147)).toMatchObject({ kind: 'cave-mouth', angle: 0, origin: 'tables' });
    expect(after.overlay.symbols.some((s: { x: number; y: number }) => s.x === 4 && s.y === 150)).toBe(false);
    // the ground is the same: the river is where it was
    const a = map.generateMap(map.parseMap(before)), b = map.generateMap(map.parseMap(after));
    expect(b.rivers.map(x => x.outline)).toEqual(a.rivers.map(x => x.outline));
    expect(Array.from(b.terrain)).toEqual(Array.from(a.terrain));
  }, 120_000);

  test('a hand edit applies after the generated ones, so a hand `elevate` still shapes ground made from requirements', () => {
    const spec = map.parseMap(read(F('ravine', 'map.json')));
    const lift = (spec.edits.at(-1) as { op: string; amount: number }).amount;
    const noHand = map.generateMap({ ...spec, edits: spec.edits.filter(e => e.origin) }), withHand = map.generateMap(spec);
    expect(lift).toBe(0.1);
    expect(Array.from(withHand.elevation)).not.toEqual(Array.from(noHand.elevation));
    // moving a hand edit before the generated ones in the file does not change the order a sync gives
    const shuffled = { ...spec, edits: [...spec.edits].reverse() }, synced = map.syncMap(shuffled, { ...spec, edits: spec.edits.filter(e => e.origin === 'tables'), require: [], overlay: { labels: [], symbols: [] } } as map.MapSpec, 'tables').spec;
    expect(synced.edits.map(e => e.origin ?? 'hand')).toEqual(['tables', 'hand', 'hand']);
  });

  test('every entry in the file synced from must carry the origin', async () => {
    const target = copy('ravine', 'map.json'), from = join(tmp(), 'new.json'), next = read(target);
    delete next.edits[0].origin;
    write(from, next);
    await expect(cli('map', 'sync', '--file', target, '--from', from, '--origin', 'tables')).rejects.toThrow(/--from: edits\[0\] has no origin, not "tables"/);
    await expect(cli('map', 'sync', '--file', target, '--origin', 'tables')).rejects.toThrow(/map sync/);
  });

  test('a hand mark that now lies over another mark is reported', async () => {
    const target = copy('ravine', 'map.json'), from = join(tmp(), 'new.json'), t = read(target);
    t.overlay.symbols.push({ kind: 'poi', x: 4, y: 140 });                    // a hand symbol, clear of every mark
    write(target, t);
    const next = structuredClone(t);
    next.edits = tablesOf(t.edits); next.require = tablesOf(t.require); next.overlay = { labels: tablesOf(t.overlay.labels), symbols: tablesOf(t.overlay.symbols) };
    next.overlay.symbols.find((s: { x: number; y: number }) => s.x === 4 && s.y === 150).y = 140.3;       // E.2's mark comes to rest on the hand symbol
    write(from, next);
    const j = JSON.parse((await cli('map', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out);
    expect(j.conflicts).toEqual([expect.objectContaining({ kind: 'over-mark', list: 'symbols', message: expect.stringContaining('symbol poi at 4,140 is now over symbol cave-mouth') })]);
    expect(read(target).overlay.symbols.at(-1)).toMatchObject({ kind: 'poi', y: 140 });
  }, 120_000);
});

describe('warren: dungeon sync', () => {
  const without5 = (spec: dungeon.DungeonSpec): dungeon.DungeonSpec => {
    const next = structuredClone(spec);
    next.rooms = tablesOf(spec.rooms).filter(r => r.id !== 'r5').map(r => { delete r.hand; if (r.id === 'r4') r.x = 11; return r; });
    next.corridors = tablesOf(spec.corridors).filter(c => !('room' in c.to && c.to.room === 'r5'));
    next.overlay = { labels: tablesOf(spec.overlay.labels), symbols: tablesOf(spec.overlay.symbols) };
    return next;
  };

  test('the web is kept, F.4\'s hand x is reported and the table\'s kept, F.5 and its corridor are gone', async () => {
    const target = copy('warren', 'dungeon.json'), from = join(tmp(), 'new.json'), before = read(target);
    write(from, without5(before));
    const r = await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json'), j = JSON.parse(r.out), after = read(target);
    expect(r.code).toBe(0);
    expect(after.overlay.symbols.map((s: { kind: string; origin?: string }) => [s.kind, s.origin ?? 'hand'])).toEqual([['trap', 'tables'], ['trap', 'tables'], ['web', 'hand']]);
    expect(after.overlay.symbols.at(-1)).toEqual({ kind: 'web', x: 12.5, y: 3.5 });
    expect(j.conflicts).toEqual([{ kind: 'overridden', list: 'rooms', index: 3, entry: 'r4', field: 'x', hand: 12, table: 11, message: expect.stringContaining('r4.x: the hand value 12') }]);
    const f4 = after.rooms.find((x: { id: string }) => x.id === 'r4');
    expect(f4.x).toBe(11);
    expect(f4.hand).toBeUndefined();
    expect(after.rooms.map((x: { id: string }) => x.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(after.corridors).toHaveLength(4);
    expect(JSON.stringify(after.corridors)).not.toContain('r5');
    expect(j.lists.rooms).toEqual({ removed: 5, added: 4, kept: 0 });
    const t = (await cli('dungeon', 'facts', '--file', target, '--json')).out;
    expect(JSON.parse(t).rooms).toHaveLength(4);
  });

  test('a hand corridor to a room the sync removed is dropped, and reported', async () => {
    const target = copy('warren', 'dungeon.json'), from = join(tmp(), 'new.json'), t = read(target);
    t.corridors.push({ from: { room: 'r4' }, to: { room: 'r5' }, route: 'hv' });       // a hand corridor F.4 to F.5
    write(target, t);
    write(from, without5(t));
    const j = JSON.parse((await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out), after = read(target);
    expect(j.conflicts.map((c: { kind: string }) => c.kind).sort()).toEqual(['dropped', 'overridden']);
    expect(j.conflicts.find((c: { kind: string }) => c.kind === 'dropped')).toMatchObject({ list: 'corridors', index: 5 });
    expect(after.corridors).toHaveLength(4);
  });

  test('a file with no origin anywhere syncs as all hand entries, and an empty origin leaves it unchanged', async () => {
    const target = copy('warren', 'dungeon.json'), t = read(target);
    for (const list of [t.rooms, t.corridors, t.overlay.labels, t.overlay.symbols]) for (const e of list) { delete e.origin; delete e.hand; }
    write(target, t);
    const before = readFileSync(target, 'utf8'), from = join(tmp(), 'new.json');
    write(from, { ...t, rooms: [], corridors: [], overlay: { labels: [], symbols: [] } });
    const j = JSON.parse((await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out);
    expect(j.conflicts).toEqual([]);
    expect(read(target)).toEqual(JSON.parse(before));
    expect(dungeon.parseDungeon(read(target)).rooms.every(r => r.origin === undefined)).toBe(true);
  });

  test('from the maps-only entry, and with an id inside a project', async () => {
    const target = copy('warren', 'dungeon.json'), from = join(tmp(), 'new.json');
    write(from, without5(read(target)));
    const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
    try { expect(await mapsMain(['dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables'])).toBe(0); } finally { log.mockRestore(); }
    expect(out.join('\n')).toMatch(/synced origin tables \(rooms: 5 of tables replaced by 4;/);
    expect(out.join('\n')).toContain('1 conflict:');
    expect(out.join('\n')).toContain('overridden: r4.x');
  });
});

describe('shrine-crypts: a hand label inside a room', () => {
  test('M.8 resized to cover a hand label reports the label as inside a room', async () => {
    const target = copy('shrine-crypts', 'dungeon.json'), from = join(tmp(), 'new.json'), t = read(target);
    for (const list of [t.rooms, t.corridors, t.overlay.labels]) for (const e of list) e.origin = 'tables';
    t.overlay.labels.push({ text: 'Seal here', x: 18.5, y: 16, kind: 'note' });      // a hand label, just beyond M.8's east wall
    write(target, t);
    const next = structuredClone(t);
    next.rooms = tablesOf(t.rooms); next.corridors = tablesOf(t.corridors); next.overlay = { labels: tablesOf(t.overlay.labels), symbols: [] };
    next.rooms.find((r: { id: string }) => r.id === 'r3').w = 18;                     // M.8 now runs to x = 20
    write(from, next);
    const j = JSON.parse((await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out);
    expect(j.conflicts).toEqual([expect.objectContaining({ kind: 'inside-room', list: 'labels', message: 'hand label "Seal here" at 18.5,16 is now inside room r3' })]);
    expect(read(target).overlay.labels.at(-1)).toMatchObject({ text: 'Seal here' });
    expect(read(target).overlay.symbols).toEqual(t.overlay.symbols);                   // the stairs, with no origin, are hand entries and stay
  });

  test('a hand label already inside a room is not a conflict, and one over another mark is', async () => {
    const target = copy('shrine-crypts', 'dungeon.json'), from = join(tmp(), 'new.json'), t = read(target);
    for (const list of [t.rooms, t.corridors, t.overlay.labels]) for (const e of list) e.origin = 'tables';
    t.overlay.labels.push({ text: 'Inside', x: 8, y: 16, kind: 'note' });
    write(target, t);
    const next = structuredClone(t);
    next.rooms = tablesOf(t.rooms); next.corridors = tablesOf(t.corridors); next.overlay = { labels: tablesOf(t.overlay.labels), symbols: [] };
    write(from, next);
    expect(JSON.parse((await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out).conflicts).toEqual([]);
    next.overlay.labels.find((l: { text: string }) => l.text === 'up to M.2').y = 29.9;                // the table's note moves onto the stairs symbol
    write(from, next);
    const j = JSON.parse((await cli('dungeon', 'sync', '--file', target, '--from', from, '--origin', 'tables', '--json')).out);
    expect(j.conflicts.map((c: { kind: string; message: string }) => c.kind)).toEqual(['over-mark']);
    expect(j.conflicts[0].message).toMatch(/^hand symbol stairs-up at 20,30.5 is now over label "up to M.2"/);
  });
});

describe('origin on the per-change commands, and hand edits recorded', () => {
  test('--origin is written by room add, link, label and symbol (dungeon) and edit, label and symbol (map)', async () => {
    const dir = tmp(), d = join(dir, 'd.json'), m = join(dir, 'm.json');
    await cli('dungeon', 'new', '--file', d, '--empty');
    await cli('dungeon', 'room', '--file', d, 'add', 'rect', '--at', '2,2', '--size', '6x4', '--room-id', 'a', '--origin', 'tables', '--fill', 'building');
    await cli('dungeon', 'room', '--file', d, 'add', 'rect', '--at', '12,2', '--size', '6x4', '--room-id', 'b');
    await cli('dungeon', 'link', '--file', d, 'a', 'b', '--origin', 'tables');
    await cli('dungeon', 'label', '--file', d, 'Hall', '--at', '5,4', '--origin', 'tables');
    await cli('dungeon', 'symbol', '--file', d, 'dais', '--at', '5,4', '--origin', 'tables');
    const spec = read(d);
    expect(spec.rooms.map((r: { origin?: string; fill?: string }) => [r.origin, r.fill])).toEqual([['tables', 'building'], [undefined, undefined]]);
    expect([spec.corridors[0].origin, spec.overlay.labels[0].origin, spec.overlay.symbols[0].origin]).toEqual(['tables', 'tables', 'tables']);
    await cli('map', 'new', '--file', m, '--preset', 'local', '--size', '20x20');
    await cli('map', 'edit', '--file', m, 'road', '--points', '1,1,9,9', '--origin', 'tables');
    await cli('map', 'label', '--file', m, 'Camp', '--at', '4,4', '--origin', 'tables');
    await cli('map', 'symbol', '--file', m, 'gate', '--at', '4,4', '--angle', '90', '--origin', 'tables');
    const mm = read(m);
    expect([mm.edits[0].origin, mm.overlay.labels[0].origin, mm.overlay.symbols[0].origin]).toEqual(['tables', 'tables', 'tables']);
    await expect(cli('map', 'label', '--file', m, 'X', '--at', '1,1', '--origin', '')).rejects.toThrow(/--origin/);
  });

  test('moving or resizing a generated room by hand records the field, so a sync can report it', async () => {
    const d = join(tmp(), 'd.json');
    await cli('dungeon', 'new', '--file', d, '--empty');
    await cli('dungeon', 'room', '--file', d, 'add', 'rect', '--at', '2,2', '--size', '6x4', '--room-id', 'a', '--origin', 'tables');
    await cli('dungeon', 'room', '--file', d, 'add', 'rect', '--at', '12,2', '--size', '6x4', '--room-id', 'h');
    await cli('dungeon', 'room', '--file', d, 'move', 'a', '--at', '3,2');
    await cli('dungeon', 'room', '--file', d, 'set', 'a', '--size', '8x4');
    await cli('dungeon', 'room', '--file', d, 'move', 'h', '--at', '13,2');
    const [a, h] = read(d).rooms;
    expect(a.hand).toEqual(['x', 'y', 'w', 'h']);
    expect(h.hand).toBeUndefined();
  });

  test('a bad origin in a file is refused with its path', () => {
    const bad = dungeon.newDungeon('o', { rooms: [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 3, h: 3 }] }) as unknown as { rooms: { origin?: unknown }[] };
    bad.rooms[0].origin = 3;
    expect(dungeon.checkDungeon(bad).errors).toEqual([{ path: 'rooms[0].origin', message: 'a non-empty string' }]);
    expect(map.checkMap({ ...map.newMap('o', 'local'), edits: [{ op: 'road', points: [0, 0, 1, 1], origin: '' }] }).errors).toEqual([{ path: 'edits[0].origin', message: 'a non-empty string' }]);
  });
});
