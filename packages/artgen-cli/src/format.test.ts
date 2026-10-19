// `artgen formats` and the version every map and dungeon `--json` result carries.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { main } from './cli.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
afterEach(() => vi.restoreAllMocks());

describe('artgen formats', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-format-')), R = ['--root', root];
  beforeAll(async () => { await run('init', ...R); });

  test('prints both versions', async () => {
    expect(JSON.parse((await run('formats', '--json')).out)).toEqual({ map: 1, dungeon: 1 });
    expect((await run('formats')).out).toBe('map 1\ndungeon 1');
  });

  test('every map and dungeon --json result carries the version', async () => {
    await run('map', 'new', 'vale', '--size', '12x10', '--seed', '3', ...R);
    await run('dungeon', 'new', 'cell', '--room', 'rect', '--room-size', '6x4', ...R);
    for (const args of [['map', 'new', 'v2', '--size', '8x8'], ['map', 'show', 'vale'], ['map', 'list'], ['map', 'symbols'], ['map', 'label', 'vale', 'Hi', '--at', '2,2'], ['map', 'render', 'vale', '--format', 'svg'],
      ['dungeon', 'show', 'cell'], ['dungeon', 'list'], ['dungeon', 'symbols'], ['dungeon', 'room', 'cell', 'add', 'rect', '--at', '20,20', '--size', '3x3'], ['dungeon', 'render', 'cell', '--format', 'svg']]) {
      const r = JSON.parse((await run(...args, '--json', ...R)).out);
      expect(r.version, args.join(' ')).toBe(1);
    }
    expect(JSON.parse((await run('map', 'list', '--json', ...R)).out).items).toHaveLength(2);
  });

  test('a file at a newer version is refused, one without a version reads as 1', async () => {
    const mapFile = join(root, 'art', 'maps', 'vale', 'map.json'), spec = JSON.parse(readFileSync(mapFile, 'utf8'));
    writeFileSync(mapFile, JSON.stringify({ ...spec, version: 2 }));
    await expect(run('map', 'show', 'vale', ...R)).rejects.toThrow(/map is format version 2.*reads map format 1/);
    const { version: _v, ...bare } = spec;
    writeFileSync(mapFile, JSON.stringify(bare));
    expect(JSON.parse((await run('map', 'show', 'vale', '--json', ...R)).out).version).toBe(1);

    const dFile = join(root, 'art', 'dungeons', 'cell', 'dungeon.json'), d = JSON.parse(readFileSync(dFile, 'utf8'));
    mkdirSync(join(root, 'art', 'dungeons', 'cell'), { recursive: true });
    writeFileSync(dFile, JSON.stringify({ ...d, version: 9 }));
    await expect(run('dungeon', 'show', 'cell', ...R)).rejects.toThrow(/dungeon is format version 9.*reads dungeon format 1/);
  });
});
