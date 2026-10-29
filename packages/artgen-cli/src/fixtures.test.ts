// Consumer fixtures (`fixtures/<consumer>/<case>/`): real files from artgen's consumers, held to the facts their
// `case.md` states. Structure only, never pixels: a theme, font or symbol may change how a fixture looks, never what it
// states. A fixture changes only through a brief from its consumer or a format bump that migrates it in the same change.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { initProject, type Project } from './project.ts';
import { dungeonFile, readDungeon, renderDungeonFiles } from './dungeon.ts';
import { mapFile, readMap, renderMapFiles } from './map.ts';
import { settlementFile } from './settlement.ts';

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

/** The case's map file copied into a bare folder (no project), to run `--file` commands on. */
function bareMap(consumer: string, name: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), `artgen-path-${name}-`)), file = join(dir, 'map.json');
  cpSync(join(FIXTURES, consumer, name, 'map.json'), file);
  return { dir, file };
}

/**
 * The longest straight run of the edge of `terrain` within `band` squares of `outline`: the squares (a square is of the
 * terrain when more than half its samples are) whose neighbour along a row, or a column, is not, counted along one row or column.
 */
function longestEdge(f: map.MapField, spec: map.MapSpec, terrain: map.Terrain, outline: number[], band: number): number {
  const t = map.TERRAINS.indexOf(terrain), r = f.res, grid: boolean[][] = [];
  for (let row = 0; row < spec.rows; row++) {
    grid.push([]);
    for (let col = 0; col < spec.cols; col++) {
      let n = 0;
      for (let j = row * r; j < (row + 1) * r; j++) for (let i = col * r; i < (col + 1) * r; i++) if (f.terrain[j * f.w + i] === t) n++;
      grid[row].push(n * 2 > r * r);
    }
  }
  const near = (x: number, y: number) => {
    let best = Infinity;
    for (let i = 0; i < outline.length; i += 2) {
      const ax = outline[i], ay = outline[i + 1], bx = outline[(i + 2) % outline.length], by = outline[(i + 3) % outline.length], dx = bx - ax, dy = by - ay;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy));
    }
    return best;
  };
  let worst = 0;
  for (const d of [-1, 1]) {
    for (let row = 1; row < spec.rows - 1; row++) { let run = 0; for (let col = 0; col < spec.cols; col++) { run = grid[row][col] && !grid[row + d][col] && near(col + 0.5, row + 0.5 + d / 2) <= band ? run + 1 : 0; worst = Math.max(worst, run); } }
    for (let col = 1; col < spec.cols - 1; col++) { let run = 0; for (let row = 0; row < spec.rows; row++) { run = grid[row][col] && !grid[row][col + d] && near(col + 0.5 + d / 2, row + 0.5) <= band ? run + 1 : 0; worst = Math.max(worst, run); } }
  }
  return worst;
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
      const asset = /^kind: asset$/m.test(md);
      expect(['map.json', 'dungeon.json', 'settlement.json'].some(f => existsSync(join(dir, f))) || (asset && existsSync(join(dir, 'asset'))), `${c.name}: an input file`).toBe(true);
      expect(md, `${c.name}: the consumer commit`).toMatch(/\b[0-9a-f]{40}\b/);
      expect(md, `${c.name}: the command`).toMatch(/```sh\n/);
      expect(md, `${c.name}: format`).toMatch(asset ? /^kind: asset$/m : /^format: (map|dungeon|settlement) \d+$/m);
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

  test('is built with require, not with paint or elevate edits (A2)', () => {
    // the generated edits are the road; the two after them are the hand edits (A8)
    expect(spec.edits.filter(e => e.origin === 'tables').map(e => e.op)).toEqual(['road']);
    expect(spec.edits.filter(e => e.origin === undefined).map(e => e.op)).toEqual(['elevate', 'elevate']);
    expect(spec.require!.map(r => [r.id, r.kind])).toEqual([['E-stream', 'path'], ['E-wall-west', 'terrain'], ['E-wall-west-height', 'height'], ['E-wall-east', 'terrain'], ['E-wall-east-height', 'height']]);
    expect(spec.gen.rivers).toBe(0);
  });

  test('check reports every requirement met and exits 0', async () => {
    const { file } = bareMap('setting-builder', 'ravine'), r = await cli('map', 'check', '--file', file, '--json'), j = JSON.parse(r.out);
    expect(r.code).toBe(0);
    expect(j).toMatchObject({ ok: true, errors: [], unmet: [] });
    expect(j.requirements).toHaveLength(5);
    expect(j.requirements.find((q: map.RequirementResult) => q.id === 'E-wall-east-height')).toMatchObject({ what: '30-40 ft', met: true });
  });

  /** Along the walls' slopes (x 3 to 7 and 9 to 13): the length of contour that runs along the gorge (y) over the length that runs across it (x). */
  const along = (s: map.MapSpec) => {
    let dx = 0, dy = 0;
    for (const { lines } of map.contourLines(s, map.generateMap(s))) for (const l of lines) for (let i = 2; i < l.pts.length; i += 2) {
      const x = (l.pts[i] + l.pts[i - 2]) / 2, y = (l.pts[i + 1] + l.pts[i - 1]) / 2;
      if (!((x >= 3 && x <= 7) || (x >= 9 && x <= 13)) || y < 10 || y > 170) continue;
      dx += Math.abs(l.pts[i] - l.pts[i - 2]); dy += Math.abs(l.pts[i + 1] - l.pts[i - 1]);
    }
    return dy / dx;
  };

  test('the walls\' contours run along the gorge, not across it; the hand-painted build\'s did not', () => {
    expect(along(spec)).toBeGreaterThan(2);
    const wall = (x0: number, x1: number) => ({ poly: [x0, 0, x1, 0, x1, 184, x0, 184] }), painted: map.MapSpec = {
      ...spec, require: undefined, gen: { ...spec.gen, rivers: 1 },
      edits: [{ op: 'river', points: [8, 4, 8, 180], width: 2, delta: false }, { op: 'paint', terrain: 'rock', shape: wall(0, 4) }, { op: 'paint', terrain: 'rock', shape: wall(12, 16) },
        { op: 'elevate', amount: 0.6, shape: wall(0, 4) }, { op: 'elevate', amount: 0.6, shape: wall(12, 16) }, ...spec.edits],
    };
    expect(along(painted)).toBeLessThan(2);
  }, 120_000);
});

describe('setting-builder/keep-flat', () => {
  const { p, id, caseMd } = place('setting-builder', 'keep-flat', 'dungeon');
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

const FRONTIER_IDS = ['A-ground', 'B-road', 'B-road-clear', 'C-ground', 'D-ground', 'D-low', 'E-ground', 'E-hills', 'E-stream'];

describe('setting-builder/frontier', () => {
  const { dir, file } = bareMap('setting-builder', 'frontier'), caseMd = readFileSync(join(FIXTURES, 'setting-builder', 'frontier', 'case.md'), 'utf8');
  const raw = JSON.parse(readFileSync(file, 'utf8')), spec = map.parseMap(raw), field = map.generateMap(spec);
  const area = (id: string) => (spec.require!.find(r => r.id === id) as Extract<map.Requirement, { area: map.Shape }>).area;

  test('is at the format version case.md states, with a require list and no paint or elevate edit', () => {
    expect(formatOf(caseMd, 'map')).toBe(map.MAP_FORMAT);
    expect(spec.version).toBe(1);
    expect(spec).toMatchObject({ cols: 106, rows: 141, scale: { perCell: 200, unit: 'yd' }, preset: 'local' });
    expect(spec.require!.map(r => r.id)).toEqual(FRONTIER_IDS);
    expect(new Set(spec.require!.map(r => r.kind))).toEqual(new Set(['terrain', 'height', 'path', 'clear']));
    expect(spec.edits).toEqual([]);
  });

  test('check reports every requirement met at the committed seed and exits 0', async () => {
    const r = await cli('map', 'check', '--file', file, '--json'), j = JSON.parse(r.out);
    expect(r.code).toBe(0);
    expect(j).toMatchObject({ version: 1, ok: true, errors: [], unmet: [] });
    expect(j.requirements.map((q: map.RequirementResult) => q.id)).toEqual(FRONTIER_IDS);
    expect(j.requirements.every((q: map.RequirementResult) => q.met)).toBe(true);
    expect(j.requirements.find((q: map.RequirementResult) => q.id === 'C-ground').text).toMatch(/^C-ground terrain forest 0\.\d\d >= 0\.80 met$/);
    expect(JSON.parse((await cli('map', 'check', '--file', file, '--json')).out)).toEqual(j);   // the same file, the same answer
    const text = (await cli('map', 'check', '--file', file)).out;
    expect(text).toContain('all 9 requirements met');
    expect(text).toContain('  B-road-clear clear rivers 0.00 <= 0.00 met');
  }, 120_000);

  test('no generated river crosses B-road-clear; without it, one comes into the strip', () => {
    const road = (spec.require!.find(r => r.id === 'B-road') as { points: number[] }).points, half = 5;
    const reach = (f: map.MapField) => Math.min(...f.rivers.filter(r => r.source === 'generated').flatMap(r => Array.from({ length: r.outline.length / 2 }, (_, i) => {
      let best = Infinity;
      for (let k = 2; k < road.length; k += 2) {
        const ax = road[k - 2], ay = road[k - 1], dx = road[k] - ax, dy = road[k + 1] - ay, u = Math.max(0, Math.min(1, ((r.outline[i * 2] - ax) * dx + (r.outline[i * 2 + 1] - ay) * dy) / (dx * dx + dy * dy)));
        best = Math.min(best, Math.hypot(r.outline[i * 2] - ax - u * dx, r.outline[i * 2 + 1] - ay - u * dy));
      }
      return best;
    })));
    expect(field.rivers.filter(r => r.source === 'generated').length).toBeGreaterThan(0);
    expect(reach(field)).toBeGreaterThan(half);
    const open = map.generateMap({ ...spec, require: spec.require!.filter(r => r.id !== 'B-road-clear') });
    expect(reach(open)).toBeLessThan(half);
  });

  test('C\'s forest edge is not a straight line: no run of more than 4 squares along one row or column; a painted forest has one', () => {
    const c = (area('C-ground') as { poly: number[] }).poly;
    expect(longestEdge(field, spec, 'forest', c, 3)).toBeLessThanOrEqual(4);
    const painted = { ...spec, require: undefined, edits: [{ op: 'paint' as const, terrain: 'forest' as const, shape: { poly: c } }] };
    expect(longestEdge(map.generateMap(painted), spec, 'forest', c, 3)).toBeGreaterThan(4);
  }, 60_000);

  test('with gen.rivers at 0 the only river is E-stream', () => {
    const f = map.generateMap({ ...spec, gen: { ...spec.gen, rivers: 0 } });
    expect(f.rivers.map(r => [r.source, r.for])).toEqual([['required', 'E-stream']]);
  }, 60_000);

  test('the ground shows what was asked: rock hills in the north, marsh low by the road, a rise at its end', async () => {
    const q = async (...a: string[]) => JSON.parse((await cli('map', 'facts', '--file', file, ...a, '--json')).out);
    const e = (await q('--area', (area('E-ground') as { poly: number[] }).poly.join(','))).areas[0], d = (await q('--area', (area('D-ground') as { poly: number[] }).poly.join(','))).areas[0];
    expect(e.terrain[0]).toMatchObject({ terrain: 'rock' });
    expect(e.lowest.height).toBeGreaterThanOrEqual(150);
    expect(e.highest.height).toBeLessThanOrEqual(400);
    expect(d.terrain[0]).toMatchObject({ terrain: 'marsh' });
    expect(d.highest.height).toBeLessThanOrEqual(10);
    const { features } = await q();
    expect(features.rivers.map((r: { source: string }) => r.source)).toEqual(['required']);
    expect(features.roads).toHaveLength(1);
  }, 120_000);

  test('renders to SVG, the same twice', async () => {
    await cli('map', 'render', '--file', file, '--format', 'svg', '--theme', 'color', '--out', join(dir, 'a'));
    await cli('map', 'render', '--file', file, '--format', 'svg', '--theme', 'color', '--out', join(dir, 'b'));
    expect(bytes(join(dir, 'a', 'map.color.svg')).equals(bytes(join(dir, 'b', 'map.color.svg')))).toBe(true);
  }, 120_000);
});

describe('setting-builder/frontier-unmet', () => {
  const { file } = bareMap('setting-builder', 'frontier-unmet'), before = readFileSync(file);

  test('check exits non-zero and names C-ground alone', async () => {
    const r = await cli('map', 'check', '--file', file, '--json'), j = JSON.parse(r.out);
    expect(r.code).not.toBe(0);
    expect(j).toMatchObject({ ok: false, errors: [], unmet: ['C-ground'] });
    expect(j.requirements).toHaveLength(10);
    expect(j.requirements.filter((q: map.RequirementResult) => !q.met).map((q: map.RequirementResult) => q.id)).toEqual(['C-ground']);
    expect(j.requirements.find((q: map.RequirementResult) => q.id === 'C-ground')).toMatchObject({ kind: 'terrain', what: 'forest', op: '>=', needed: 0.8, met: false });
    expect(j.requirements.find((q: map.RequirementResult) => q.id === 'C-ground').text).toMatch(/^C-ground terrain forest 0\.\d\d < 0\.80 unmet$/);
    const text = (await cli('map', 'check', '--file', file)).out;
    expect(text).toContain('1 of 10 requirements unmet');
    expect(text.split('\n').filter(l => l.startsWith('  ') && l.endsWith(' unmet'))).toHaveLength(1);
    expect(readFileSync(file).equals(before)).toBe(true);
  }, 120_000);

  test('is frontier with C-rock added over C-ground\'s area; nothing else differs', () => {
    const a = JSON.parse(readFileSync(join(FIXTURES, 'setting-builder', 'frontier', 'map.json'), 'utf8')), b = JSON.parse(before.toString());
    const c = a.require.find((q: { id: string }) => q.id === 'C-ground');
    expect(b.require.at(-1)).toEqual({ id: 'C-rock', kind: 'terrain', area: c.area, terrain: 'rock', share: 0.9 });
    expect({ ...b, id: a.id, require: b.require.slice(0, -1) }).toEqual(a);
  });
});

// Cases that came in through scripts/artgen-intake.mjs (case.md says `status: reported`) are held to the minimum until their
// facts are written down: the tools do not throw on the file, and a render is the same twice. The maintainer then adds the
// facts to case.md and a describe block above, and drops the status line.
const reported: { consumer: string; name: string; md: string }[] = [];
for (const consumer of readdirSync(FIXTURES, { withFileTypes: true }).filter(d => d.isDirectory())) {
  for (const c of readdirSync(join(FIXTURES, consumer.name), { withFileTypes: true }).filter(d => d.isDirectory())) {
    const md = readFileSync(join(FIXTURES, consumer.name, c.name, 'case.md'), 'utf8');
    if (/^status: reported/m.test(md)) reported.push({ consumer: consumer.name, name: c.name, md });
  }
}
describe.each(reported)('$consumer/$name (reported)', ({ consumer, name, md }) => {
  const dir = join(FIXTURES, consumer, name), asset = /^kind: asset$/m.test(md);
  const kind = (md.match(/^format: (map|dungeon|settlement) \d+$/m)?.[1] ?? 'map') as 'map' | 'dungeon' | 'settlement';
  test('check and render run on it, and the render is the same twice', async () => {
    const root = mkdtempSync(join(tmpdir(), `artgen-reported-${name}-`)), { project } = initProject(root);
    if (asset) {
      for (const f of ['direction.json', 'briefs.yaml', 'artgen.config.json', 'ledger.jsonl']) if (existsSync(join(dir, f))) cpSync(join(dir, f), join(project.art, f));
      const at = md.match(/^asset: (\S+)$/m)?.[1];
      expect(at, 'case.md names the asset folder (asset: assets/<kind>/<id>)').toBeTruthy();
      cpSync(join(dir, 'asset'), join(project.art, at!), { recursive: true });
      const r = await cli('render', basename(at!), '--root', root);
      expect([0, 1]).toContain(r.code);
      return;
    }
    const input = join(dir, `${kind}.json`), id = JSON.parse(readFileSync(input, 'utf8')).id as string | undefined ?? name;
    const to = (kind === 'map' ? mapFile : kind === 'dungeon' ? dungeonFile : settlementFile)(project, id);
    mkdirSync(join(to, '..'), { recursive: true });
    cpSync(input, to);
    const check = await cli(kind, 'check', id, '--root', root, '--json');
    expect([0, 1]).toContain(check.code);
    if (check.code !== 0) return;   // a file the tools refuse is not drawn
    for (const o of ['a', 'b']) expect((await cli(kind, 'render', id, '--root', root, '--out', join(root, o))).code).toBe(0);
    const files = readdirSync(join(root, 'a'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(bytes(join(root, 'a', f)).equals(bytes(join(root, 'b', f))), f).toBe(true);
  }, 120_000);
});
