import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { MemoryFiles, walk } from './files';
import { findArt, loadSnapshot } from './snapshot';
import { artFromZip, zipArt } from './zip';

describe('MemoryFiles', () => {
  it('lists folders and files, walks, appends without rewriting', async () => {
    const f = new MemoryFiles('art', { 'ledger.jsonl': '{"a":1}\n', 'assets/prop/x/base.v1.js': 'x', 'assets/prop/x/out/r.png': new Uint8Array([1]) });
    expect(await f.list('')).toEqual(['assets/', 'ledger.jsonl']);
    expect(await f.list('assets/prop')).toEqual(['x/']);
    expect(await walk(f, '', d => d === 'out')).toEqual(['assets/prop/x/base.v1.js', 'ledger.jsonl']);
    const s0 = await f.stat('ledger.jsonl');
    await f.append('ledger.jsonl', '{"b":2}\n');
    expect(await f.readText('ledger.jsonl')).toBe('{"a":1}\n{"b":2}\n');
    expect((await f.stat('ledger.jsonl'))!.lastModified).not.toBe(s0!.lastModified);
    expect([...f.dirty]).toEqual(['ledger.jsonl']);
  });
});

describe('snapshot', () => {
  it('finds the art folder in a repo or as the picked folder', async () => {
    expect(await findArt(new MemoryFiles('repo', { 'art/artgen.config.json': '{}' }))).toBe('art/');
    expect(await findArt(new MemoryFiles('art', { 'artgen.config.json': '{}' }))).toBe('');
    expect(await findArt(new MemoryFiles('x', { 'README.md': '' }))).toBeNull();
  });

  it('loads sources and anchors, not renders or sheets', async () => {
    const f = new MemoryFiles('art', {
      'artgen.config.json': '{}', 'direction.json': '{}', 'ledger.jsonl': '', 'anchors/prop.png': new Uint8Array([9]),
      'assets/prop/x/base.v1.js': 'export const a = 1', 'assets/prop/x/out/base.v1.png': new Uint8Array([1]), 'sheets/approved/x.png': new Uint8Array([1]),
    });
    const s = await loadSnapshot(f);
    expect(Object.keys(s.text).sort()).toEqual(['artgen.config.json', 'assets/prop/x/base.v1.js', 'direction.json', 'ledger.jsonl']);
    expect(Object.keys(s.bin)).toEqual(['anchors/prop.png']);
    expect(s.stats['ledger.jsonl']).toBeDefined();
    expect(s.stats['briefs.yaml']).toBeUndefined();
  });
});

describe('zip fallback', () => {
  it('imports the shallowest art folder from a repo zip and exports it with the list of changes', async () => {
    const zip = zipSync({
      'game/art/artgen.config.json': strToU8('{}'), 'game/art/ledger.jsonl': strToU8(''),
      'game/art/probes/x/artgen.config.json': strToU8('{"nested":true}'), 'game/src/main.ts': strToU8('//'),
    });
    const f = artFromZip(zip, 'game');
    expect(f.paths()).toEqual(['artgen.config.json', 'ledger.jsonl', 'probes/x/artgen.config.json']);
    await f.append('ledger.jsonl', '{"type":"approve"}\n');
    const out = unzipSync(zipArt(f));
    expect(Object.keys(out).sort()).toEqual(['art/.image-tools-changes.txt', 'art/artgen.config.json', 'art/ledger.jsonl', 'art/probes/x/artgen.config.json']);
    expect(strFromU8(out['art/ledger.jsonl'])).toBe('{"type":"approve"}\n');
    expect(strFromU8(out['art/.image-tools-changes.txt'])).toContain('art/ledger.jsonl');
  });

  it('refuses a zip without an artgen project', () => {
    expect(() => artFromZip(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/no artgen.config.json/);
  });
});
