// Path mode: every `map` and `dungeon` command takes `--file <path>` in place of an id and needs no project, and the
// maps-only entry (`mapsMain`) runs the same commands. The folders here are bare temp folders with no `art/` up the tree.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';

const capture = async (fn: () => Promise<number>) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await fn(), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const run = (...args: string[]) => capture(() => main(args));
const runMaps = (...args: string[]) => capture(() => mapsMain(args));
const bare = (name: string) => mkdtempSync(join(tmpdir(), `artgen-${name}-`));
afterEach(() => vi.restoreAllMocks());

describe('map --file', () => {
  const dir = bare('map-file'), file = join(dir, 'F.a.json'), F = ['--file', file];
  const spec = () => JSON.parse(readFileSync(file, 'utf8'));

  test('new → gen → edit → grid → label → symbol → overlay → set → show → list, with no project', async () => {
    expect((await run('map', 'new', '--preset', 'local', '--size', '16x12', '--seed', '4', '--title', 'Gorge', ...F)).code).toBe(0);
    expect(spec()).toMatchObject({ id: 'F-a', preset: 'local', cols: 16, rows: 12, seed: 4, title: 'Gorge' });
    await expect(run('map', 'new', ...F)).rejects.toThrow(/already exists/);
    await run('map', 'gen', '--sea', '0.2', '--rivers', '1', ...F);
    expect(spec().gen).toMatchObject({ sea: 0.2, rivers: 1 });
    await run('map', 'edit', 'paint', '--terrain', 'forest', '--circle', '5,5,2', ...F);
    await run('map', 'edit', 'road', '--points', '0,6,16,6', ...F);
    await run('map', 'edit', 'elevate', '--amount', '0.2', '--circle', '3,3,2', ...F);
    await run('map', 'edit', 'river', '--points', '1,1,8,9', ...F);
    await run('map', 'edit', 'undo', ...F);
    expect(spec().edits.map((e: { op: string }) => e.op)).toEqual(['paint', 'road', 'elevate']);
    await run('map', 'grid', 'square', '--coords', 'on', ...F);
    await run('map', 'label', 'E.2 Ledge', '--at', '4,4', ...F);
    await run('map', 'symbol', 'castle', '--at', '6,6', ...F);
    await run('map', 'symbol', 'town', '--at', '8,8', ...F);
    await run('map', 'overlay', 'rm', 'symbol', '0', ...F);
    await run('map', 'set', '--legend', 'off', '--per-cell', '10', '--unit', 'yd', ...F);
    expect(spec()).toMatchObject({ grid: { type: 'square', coords: true }, legend: false, scale: { perCell: 10, unit: 'yd' }, overlay: { labels: [{ text: 'E.2 Ledge' }], symbols: [{ kind: 'town' }] } });
    expect((await run('map', 'show', ...F)).out).toContain('F-a "Gorge"');
    expect(JSON.parse((await run('map', 'list', '--json', ...F)).out)).toMatchObject({ version: 1, items: [{ id: 'F-a', edits: 3 }] });
    expect((await run('map', 'symbols', '--json')).out).toContain('castle');
    await run('map', 'overlay', 'clear', ...F);
    expect(spec().overlay).toEqual({ labels: [], symbols: [] });
  });

  test('render goes beside the file by default, or to --out; the same twice', async () => {
    const r = JSON.parse((await run('map', 'render', '--theme', 'color', '--format', 'svg', '--ppu', '12', '--json', ...F)).out);
    expect(r.files.map((f: string) => f.split(/[\\/]/).pop())).toEqual(['F.a.color.svg']);
    const svg = readFileSync(join(dir, 'F.a.color.svg'), 'utf8');
    expect(svg).toContain('<svg');
    const out = join(dir, 'elsewhere');
    await run('map', 'render', '--theme', 'color', '--format', 'svg', '--ppu', '12', '--out', out, ...F);
    expect(readFileSync(join(out, 'F.a.color.svg'), 'utf8')).toBe(svg);
    await run('map', 'render', '--theme', 'bw', '--format', 'png', '--ppu', '8', ...F);
    expect(existsSync(join(dir, 'F.a.bw.png'))).toBe(true);
  }, 60_000);

  test('without a file or a project an id fails and says to use --file', async () => {
    await expect(run('map', 'show', 'vale', '--root', bare('empty'))).rejects.toThrow(/--file|no artgen project/);
    await expect(run('map', 'show', ...['--file', join(dir, 'missing.json')])).rejects.toThrow(/no map file/);
  });
});

describe('dungeon --file', () => {
  const dir = bare('dungeon-file'), file = join(dir, 'M.a.json'), F = ['--file', file];
  const spec = () => JSON.parse(readFileSync(file, 'utf8'));

  test('new → gen → room → link → door → unlink → grid → style → label → symbol → overlay → fit → show → list, with no project', async () => {
    await run('dungeon', 'new', '--empty', '--seed', '2', '--size', '40x30', '--title', 'Crypts', ...F);
    expect(spec()).toMatchObject({ id: 'M-a', seed: 2, title: 'Crypts', rooms: [] });
    await expect(run('dungeon', 'new', ...F)).rejects.toThrow(/already exists/);
    await run('dungeon', 'room', 'add', 'rect', '--at', '5,5', '--size', '6x4', '--label', 'M.6 Stair', ...F);
    await run('dungeon', 'room', 'add', 'rect', '--at', '5,15', '--size', '8x6', '--label', 'M.7 Hall', ...F);
    await run('dungeon', 'room', 'set', 'r2', '--label', 'M.7 Ossuary', ...F);
    await run('dungeon', 'room', 'move', 'r2', '--at', '6,16', ...F);
    await run('dungeon', 'link', 'r1', 'r2', '--doors', 'arch', ...F);
    await run('dungeon', 'link', 'r2', '20,19', ...F);
    await run('dungeon', 'door', '1', 'from', 'secret', ...F);
    expect(spec().corridors).toHaveLength(2);
    expect(spec().corridors[1].doors[0]).toBe('secret');
    await run('dungeon', 'unlink', '1', ...F);
    await run('dungeon', 'grid', '10', ...F);
    await run('dungeon', 'style', '--hatch', 'none', ...F);
    await run('dungeon', 'label', 'up to M.2', '--at', '20,18', ...F);
    await run('dungeon', 'symbol', 'trap', '--at', '8,18', ...F);
    await run('dungeon', 'symbol', 'chest', '--at', '9,18', ...F);
    await run('dungeon', 'overlay', 'rm', 'symbol', '0', ...F);
    expect(spec()).toMatchObject({ style: { hatch: 'none' }, rooms: [{ id: 'r1' }, { id: 'r2', label: 'M.7 Ossuary', x: 6, y: 16 }], overlay: { labels: [{ text: 'up to M.2' }], symbols: [{ kind: 'chest' }] } });
    await run('dungeon', 'gen', '--rooms', '4', '--seed', '3', ...F);
    expect(spec().rooms.length).toBeGreaterThan(0);
    const r = JSON.parse((await run('dungeon', 'fit', '--margin', '3', '--json', ...F)).out);
    expect(r).toMatchObject({ version: 1 });
    expect([spec().cols, spec().rows]).toEqual([r.cols, r.rows]);
    expect((await run('dungeon', 'show', ...F)).out).toContain('M-a "Crypts"');
    expect(JSON.parse((await run('dungeon', 'list', '--json', ...F)).out).items[0]).toMatchObject({ id: 'M-a' });
    expect((await run('dungeon', 'symbols', '--json')).out).toContain('trap');
    await run('dungeon', 'overlay', 'clear', ...F);
    expect(spec().overlay).toEqual({ labels: [], symbols: [] });
  });

  test('render by --file beside the file, svg without a rasteriser, and the same twice', async () => {
    await run('dungeon', 'render', '--format', 'svg', ...F);
    const svg = readFileSync(join(dir, 'M.a.svg'), 'utf8');
    expect(svg).toContain('<svg');
    const out = join(dir, 'o');
    await run('dungeon', 'render', '--format', 'svg', '--out', out, ...F);
    expect(readFileSync(join(out, 'M.a.svg'), 'utf8')).toBe(svg);
    await run('dungeon', 'render', '--format', 'png', '--ppu', '8', ...F);
    expect(existsSync(join(dir, 'M.a.png'))).toBe(true);
  }, 60_000);

  test('check: ok on a good file; every error with its JSON path, exit 1, file untouched, on a bad one', async () => {
    const good = JSON.parse((await run('dungeon', 'check', '--json', ...F)).out);
    expect(good).toMatchObject({ version: 1, ok: true, errors: [] });
    const bad = join(dir, 'bad.json'), text = JSON.stringify({ id: 'bad', seed: 1, rooms: [{ id: 'a', shape: 'rect', x: 1, y: 1, w: 0, h: 2 }], corridors: [{ from: { room: 'a' }, to: { room: 'zz' } }] });
    writeFileSync(bad, text);
    const r = await run('dungeon', 'check', '--json', '--file', bad);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out)).toMatchObject({ ok: false, errors: [{ path: 'rooms[0].w' }, { path: 'corridors[0].to.room' }] });
    expect((await run('dungeon', 'check', '--file', bad)).out).toMatch(/rooms\[0\]\.w: .*\n.*corridors\[0\]\.to\.room/);
    expect(readFileSync(bad, 'utf8')).toBe(text);
    writeFileSync(bad, '{ not json');
    expect(JSON.parse((await run('dungeon', 'check', '--json', '--file', bad)).out).errors[0].message).toMatch(/not JSON/);
    writeFileSync(bad, JSON.stringify({ id: 'n', seed: 1, version: 9 }));
    expect(JSON.parse((await run('dungeon', 'check', '--json', '--file', bad)).out).errors[0]).toMatchObject({ path: 'version', message: expect.stringContaining('format version 9') });
    expect((await run('dungeon', 'check', '--json', '--file', join(dir, 'nope.json'))).code).toBe(1);
  });
});

describe('the maps-only entry', () => {
  test('formats, version, help and the same commands; other commands are refused', async () => {
    expect(JSON.parse((await runMaps('formats', '--json')).out)).toEqual({ map: 1, dungeon: 1 });
    expect((await runMaps('--version')).out).toMatch(/^\S+ \(\S+\)$/);
    expect((await runMaps('--help')).out).toContain('artgen dungeon check');
    const f = join(bare('maps-entry'), 'd.json');
    await runMaps('dungeon', 'new', '--empty', '--file', f);
    expect((await runMaps('dungeon', 'check', '--file', f)).code).toBe(0);
    await expect(runMaps('render', 'x')).rejects.toThrow(/not a command here/);
  });
});
