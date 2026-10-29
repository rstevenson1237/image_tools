// HttpFiles against the real `artgen ui` server: the browser's file backend for the review UI behaves like the folder
// backends (list, stat, read, write, append; a missing file is undefined) and never reaches outside art/.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startUiServer, type UiServer } from '../../../packages/artgen-cli/src/ui-server';
import { findArt, loadSnapshot } from './snapshot';
import { HttpFiles, walk } from './files';

const tmp = mkdtempSync(join(tmpdir(), 'artgen-http-files-')), root = join(tmp, 'game');
let server: UiServer, files: HttpFiles, base = '';

beforeAll(async () => {
  mkdirSync(join(root, 'art', 'assets', 'prop', 'x'), { recursive: true }); mkdirSync(join(tmp, 'ui'));
  writeFileSync(join(root, 'art', 'artgen.config.json'), '{}');
  writeFileSync(join(root, 'art', 'ledger.jsonl'), '{"a":1}\n');
  writeFileSync(join(root, 'art', 'assets', 'prop', 'x', 'base.v1.js'), 'export const a = 1');
  writeFileSync(join(tmp, 'ui', 'index.html'), '<title>ui</title>');
  server = await startUiServer({ root, uiDir: join(tmp, 'ui'), info: { modules: ['core', 'art'] } });
  base = `http://127.0.0.1:${server.port}`;
  ({ files } = await HttpFiles.connect(server.token, base));
});
afterAll(async () => { await server.close(); rmSync(tmp, { recursive: true, force: true }); });

describe('HttpFiles', () => {
  it('connects, names the repo and reports its modules', async () => {
    const c = await HttpFiles.connect(server.token, base);
    expect(c.files.name).toBe('game');
    expect(c.files.kind).toBe('server');
    expect(c.modules).toEqual(['core', 'art']);
    await expect(HttpFiles.connect('wrong', base)).rejects.toThrow(/401/);
  });

  it('lists, walks, reads and stats like the folder backends; a missing file is undefined', async () => {
    expect(await files.list('')).toEqual(['artgen.config.json', 'assets/', 'ledger.jsonl']);
    expect(await walk(files)).toEqual(['artgen.config.json', 'assets/prop/x/base.v1.js', 'ledger.jsonl']);
    expect(await files.readText('ledger.jsonl')).toBe('{"a":1}\n');
    expect(await files.readText('missing.json')).toBeUndefined();
    expect(await files.readBytes('missing.png')).toBeUndefined();
    expect(await files.stat('missing.json')).toBeUndefined();
    expect((await files.stat('ledger.jsonl'))!.size).toBe(8);
    expect(await findArt(files)).toBe('');
  });

  it('writes text and bytes, appends without rewriting, and an empty file is not a missing one', async () => {
    await files.write('maps/isle/map.json', '{"w":1}');
    expect(readFileSync(join(root, 'art/maps/isle/map.json'), 'utf8')).toBe('{"w":1}');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]);
    await files.write('sheets/a.png', png);
    expect(await files.readBytes('sheets/a.png')).toEqual(png);
    const before = (await files.stat('ledger.jsonl'))!;
    await files.append('ledger.jsonl', '{"b":2}\n');
    expect(await files.readText('ledger.jsonl')).toBe('{"a":1}\n{"b":2}\n');
    expect((await files.stat('ledger.jsonl'))!.size).toBe(before.size + 8);
    await files.write('empty.txt', '');
    expect(await files.readText('empty.txt')).toBe('');
  });

  it('refuses paths outside art/', async () => {
    await expect(files.readText('../secret.txt')).rejects.toThrow(/400/);
    await expect(files.write('../x.txt', 'x')).rejects.toThrow(/400/);
  });

  it('loads a snapshot for the engine', async () => {
    const s = await loadSnapshot(files);
    expect(Object.keys(s.text)).toContain('assets/prop/x/base.v1.js');
    expect(s.stats['ledger.jsonl']).toBeDefined();
  });
});
