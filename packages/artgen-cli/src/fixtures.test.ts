// Consumer fixtures (`fixtures/<consumer>/<case>/`): real files from artgen's consumers, held to the facts their
// `case.md` states. Structure only, never pixels: a theme, font or symbol may change how a fixture looks, never what it
// states. A fixture changes only through a brief from its consumer or a format bump that migrates it in the same change.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { initProject, type Project } from './project.ts';
import { dungeonFile, readDungeon, renderDungeonFiles } from './dungeon.ts';
import { mapFile, readMap, renderMapFiles } from './map.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
const formatOf = (caseMd: string, kind: string): number => {
  const m = caseMd.match(new RegExp(`^format: ${kind} (\\d+)$`, 'm'));
  if (!m) throw new Error(`case.md: a "format: ${kind} N" line is required`);
  return +m[1];
};
const bytes = (f: string) => readFileSync(f);

/** Run a CLI command and return its exit code and printed output. */
async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
}
/** The case's input file copied into a bare folder (no project), to run `--file` commands on. */
function bareCopy(consumer: string, name: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), `artgen-path-${name}-`)), file = join(dir, 'dungeon.json');
  cpSync(join(FIXTURES, consumer, name, 'dungeon.json'), file);
  return { dir, file };
}

/** The case in a fresh project: its input file where the CLI reads it. */
function place(consumer: string, name: string, kind: 'map' | 'dungeon'): { p: Project; id: string; caseMd: string } {
  const dir = join(FIXTURES, consumer, name), root = mkdtempSync(join(tmpdir(), `artgen-fixture-${name}-`));
  const { project } = initProject(root), input = join(dir, `${kind}.json`), id = JSON.parse(readFileSync(input, 'utf8')).id as string;
  const to = kind === 'map' ? mapFile(project, id) : dungeonFile(project, id);
  mkdirSync(join(to, '..'), { recursive: true });
  cpSync(input, to);
  return { p: project, id, caseMd: readFileSync(join(dir, 'case.md'), 'utf8') };
}

test('every case has its input file and a case.md with the commit, the command and the format', () => {
  for (const consumer of readdirSync(FIXTURES, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const c of readdirSync(join(FIXTURES, consumer.name), { withFileTypes: true }).filter(d => d.isDirectory())) {
      const dir = join(FIXTURES, consumer.name, c.name), md = readFileSync(join(dir, 'case.md'), 'utf8');
      expect(existsSync(join(dir, 'map.json')) || existsSync(join(dir, 'dungeon.json')), `${c.name}: an input file`).toBe(true);
      expect(md, `${c.name}: the consumer commit`).toMatch(/\b[0-9a-f]{40}\b/);
      expect(md, `${c.name}: the command`).toMatch(/```sh\n/);
      expect(md, `${c.name}: format`).toMatch(/^format: (map|dungeon) \d+$/m);
    }
  }
});

describe('setting-builder/warren', () => {
  const { p, id, caseMd } = place('setting-builder', 'warren', 'dungeon');
  let spec: dungeon.DungeonSpec;
  beforeAll(() => { spec = readDungeon(p, id); });

  test('parses at the format version case.md states', () => {
    expect(formatOf(caseMd, 'dungeon')).toBe(dungeon.DUNGEON_FORMAT);
    expect(spec.version).toBe(formatOf(caseMd, 'dungeon'));
  });

  test('renders to SVG and PNG without error, the same twice', async () => {
    const a = await renderDungeonFiles(p, id, { out: join(p.root, 'a') });
    await renderDungeonFiles(p, id, { out: join(p.root, 'b') });
    expect(a.files).toHaveLength(2);
    for (const f of ['svg', 'png']) expect(bytes(join(p.root, 'a', `${id}.${f}`)).equals(bytes(join(p.root, 'b', `${id}.${f}`)))).toBe(true);
    expect(readFileSync(join(p.root, 'a', `${id}.svg`), 'utf8')).toContain('<svg');
  });

  test('facts', () => {
    expect(spec.rooms.map(r => [r.number, r.w, r.h])).toEqual([[1, 8, 1], [2, 8, 1], [3, 6, 6], [4, 4, 3], [5, 3, 2]]);
    expect(spec.rooms.map(r => r.label?.split(' ')[0])).toEqual(['F.1', 'F.2', 'F.3', 'F.4', 'F.5']);
    const room = (code: string) => spec.rooms.find(r => r.label?.startsWith(`${code} `))!.id;
    const between = (a: string, b: string) => spec.corridors.find(c => 'room' in c.from && 'room' in c.to && c.from.room === room(a) && c.to.room === room(b))!;
    const open = (c: dungeon.Corridor) => !c.doors || c.doors.every(d => d === null);
    expect(open(between('F.1', 'F.2'))).toBe(true);
    expect(open(between('F.2', 'F.3'))).toBe(true);
    expect(open(between('F.3', 'F.4'))).toBe(false);
    expect(open(between('F.3', 'F.5'))).toBe(false);
    const out = spec.corridors.filter(c => 'room' in c.from && c.from.room === room('F.1') && 'at' in c.to);
    expect(out).toHaveLength(1);
    const end = (out[0].to as { at: [number, number] }).at;
    expect(spec.overlay.labels.filter(l => l.text === 'to E.2')).toHaveLength(1);
    const label = spec.overlay.labels.find(l => l.text === 'to E.2')!;
    expect(Math.hypot(label.x - end[0], label.y - end[1])).toBeLessThanOrEqual(2);
    expect(spec.overlay.symbols.filter(s => s.kind === 'trap')).toHaveLength(2);
  });
});

describe('setting-builder/warren in path mode', () => {
  test('check --file reports no errors; render by --file matches render by id', async () => {
    const { dir, file } = bareCopy('setting-builder', 'warren');
    expect(JSON.parse((await cli('dungeon', 'check', '--file', file, '--json')).out)).toMatchObject({ ok: true, errors: [] });
    await cli('dungeon', 'render', '--file', file, '--format', 'svg');
    const { p, id } = place('setting-builder', 'warren', 'dungeon');
    await renderDungeonFiles(p, id, { formats: ['svg'], out: join(p.root, 'by-id') });
    expect(bytes(join(dir, 'dungeon.svg')).equals(bytes(join(p.root, 'by-id', `${id}.svg`)))).toBe(true);
  });
});

describe('setting-builder/shrine-crypts', () => {
  const { dir, file } = bareCopy('setting-builder', 'shrine-crypts');
  const check = async () => JSON.parse((await cli('dungeon', 'check', '--file', file, '--json')).out);
  let spec: dungeon.DungeonSpec;
  beforeAll(async () => {
    expect(await check()).toMatchObject({ ok: true, errors: [] });
    expect((await cli('dungeon', 'fit', '--file', file)).code).toBe(0);
    spec = dungeon.parseDungeon(JSON.parse(readFileSync(file, 'utf8')));
  });

  test('is at the format version case.md states, and check still reports no errors after fit', async () => {
    expect(formatOf(readFileSync(join(FIXTURES, 'setting-builder', 'shrine-crypts', 'case.md'), 'utf8'), 'dungeon')).toBe(dungeon.DUNGEON_FORMAT);
    expect(spec.version).toBe(dungeon.DUNGEON_FORMAT);
    expect(await check()).toMatchObject({ ok: true, errors: [] });
  });

  test('renders to SVG, the same twice', async () => {
    await cli('dungeon', 'render', '--file', file, '--format', 'svg', '--out', join(dir, 'a'));
    await cli('dungeon', 'render', '--file', file, '--format', 'svg', '--out', join(dir, 'b'));
    expect(bytes(join(dir, 'a', 'dungeon.svg')).equals(bytes(join(dir, 'b', 'dungeon.svg')))).toBe(true);
  });

  test('facts', () => {
    expect(spec.rooms.map(r => r.number)).toEqual([6, 7, 8, 9, 13]);
    const room = (code: string) => spec.rooms.find(r => r.label?.startsWith(`${code} `))!.id;
    const between = (a: string, b: string) => spec.corridors.filter(c => 'room' in c.from && 'room' in c.to && c.from.room === room(a) && c.to.room === room(b));
    for (const [a, b] of [['M.6', 'M.7'], ['M.7', 'M.8'], ['M.7', 'M.9'], ['M.13', 'M.8']]) expect(between(a, b), `${a}-${b}`).toHaveLength(1);
    expect(between('M.13', 'M.8')[0].doors).toEqual([null, 'secret']);
    expect(spec.corridors.filter(c => c.doors?.includes('secret'))).toHaveLength(1);
    const exits = [['M.6', 'up to M.2'], ['M.9', 'up to M.10'], ['M.13', 'down to L.5']];
    expect(spec.overlay.labels.map(l => l.text).sort()).toEqual(exits.map(e => e[1]).sort());
    for (const [code, text] of exits) {
      const out = spec.corridors.filter(c => 'room' in c.from && c.from.room === room(code) && 'at' in c.to);
      expect(out, code).toHaveLength(1);
      const end = (out[0].to as { at: [number, number] }).at, l = spec.overlay.labels.find(x => x.text === text)!;
      expect(Math.hypot(l.x - end[0], l.y - end[1]), text).toBeLessThanOrEqual(2);
    }
  });
});

describe('setting-builder/bad-file', () => {
  test('check exits non-zero and names both errors by JSON path; the file is left alone', async () => {
    const { file } = bareCopy('setting-builder', 'bad-file'), before = readFileSync(file);
    const r = await cli('dungeon', 'check', '--file', file, '--json');
    expect(r.code).not.toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ ok: false, errors: [{ path: 'rooms[4].w' }, { path: 'corridors[5].to.room' }] });
    expect(JSON.parse(r.out).errors).toHaveLength(2);
    expect(readFileSync(file).equals(before)).toBe(true);
  });
});

describe('setting-builder/ravine', () => {
  const { p, id, caseMd } = place('setting-builder', 'ravine', 'map');
  let spec: map.MapSpec;
  beforeAll(() => { spec = readMap(p, id); });

  test('parses at the format version case.md states', () => {
    expect(formatOf(caseMd, 'map')).toBe(map.MAP_FORMAT);
    expect(spec.version).toBe(formatOf(caseMd, 'map'));
  });

  test('renders to SVG and PNG in each theme without error, the same twice', async () => {
    const themes = [...map.THEMES];
    const a = await renderMapFiles(p, id, { themes, out: join(p.root, 'a') }), b = await renderMapFiles(p, id, { themes, out: join(p.root, 'b') });
    expect(a.files).toHaveLength(themes.length * 2);
    expect(b.size).toEqual(a.size);
    for (const t of themes) for (const f of ['svg', 'png']) expect(bytes(join(p.root, 'a', `${id}.${t}.${f}`)).equals(bytes(join(p.root, 'b', `${id}.${t}.${f}`))), `${t}.${f}`).toBe(true);
  }, 180_000);

  test('facts', () => {
    expect(spec.scale).toMatchObject({ perCell: 10, unit: 'yd' });
    const codes = Array.from({ length: 11 }, (_, i) => `E.${i + 2}`);
    const labelled = spec.overlay.labels.map(l => l.text.split(' ')[0]);
    expect(labelled.sort()).toEqual([...codes].sort());
    expect(labelled).not.toContain('E.1');
    expect(spec.overlay.symbols).toHaveLength(codes.length);
    for (const code of codes) {
      const l = spec.overlay.labels.find(x => x.text.startsWith(`${code} `))!;
      expect(spec.overlay.symbols.some(s => Math.hypot(s.x - l.x, s.y - l.y) <= 2), `${code} has a symbol beside its label`).toBe(true);
    }
    expect(spec.edits.filter(e => e.op === 'road')).toHaveLength(1);
  });
});

describe('setting-builder/keep', () => {
  const { p, id, caseMd } = place('setting-builder', 'keep', 'dungeon');
  let spec: dungeon.DungeonSpec;
  beforeAll(() => { spec = readDungeon(p, id); });

  test('parses at the format version case.md states', () => {
    expect(formatOf(caseMd, 'dungeon')).toBe(dungeon.DUNGEON_FORMAT);
    expect(spec.version).toBe(formatOf(caseMd, 'dungeon'));
  });

  test('renders to SVG and PNG without error, the same twice', async () => {
    await renderDungeonFiles(p, id, { out: join(p.root, 'a') });
    await renderDungeonFiles(p, id, { out: join(p.root, 'b') });
    for (const f of ['svg', 'png']) expect(bytes(join(p.root, 'a', `${id}.${f}`)).equals(bytes(join(p.root, 'b', `${id}.${f}`)))).toBe(true);
  }, 120_000);

  test('facts', () => {
    const sizes = { 1: [8, 2], 2: [2, 1], 3: [8, 4], 4: [6, 4], 5: [6, 2], 6: [5, 4], 7: [3, 2], 8: [16, 16], 9: [8, 4], 10: [10, 5], 11: [12, 5], 12: [6, 3], 13: [30, 1] };
    expect(spec.rooms).toHaveLength(13);
    for (const [n, [w, h]] of Object.entries(sizes)) {
      const r = spec.rooms.find(x => x.label?.startsWith(`A.${n} `));
      expect([r?.w, r?.h], `A.${n}`).toEqual([w, h]);
    }
    expect(spec.style.hatch).toBe('none');
  });
});
