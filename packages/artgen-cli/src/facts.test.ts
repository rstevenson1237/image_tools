// `artgen map facts` and `artgen dungeon facts`: the ground and the layout read back as numbers, held to the consumer
// fixtures (setting-builder: ravine, keep, warren), to every field the JSON carries, and to being the same twice.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { map } from 'artgen-core/maps';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';
import { initProject } from './project.ts';

const FIXTURE = (name: string, file: string) => join(fileURLToPath(new URL('../fixtures/setting-builder/', import.meta.url)), name, file);
const capture = async (fn: () => Promise<number>) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await fn(), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const run = (...args: string[]) => capture(() => main(args));
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

/** Every field of a JSON value as a path (`points[].river.at[]`); an empty array is its path with `[]`. */
function paths(v: unknown, at = ''): string[] {
  if (Array.isArray(v)) return v.length ? [...new Set(v.flatMap(x => paths(x, `${at}[]`)))] : [`${at}[]`];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => paths(x, at ? `${at}.${k}` : k));
  return [at];
}
const sorted = (v: unknown) => { const all = [...new Set(paths(v))]; return all.filter(p => !all.some(q => q !== p && q.startsWith(p) && '.['.includes(q[p.length]) && p.endsWith(']'))).sort(); };

const RULES = ['rules.height', 'rules.lineTolerance', 'rules.position', 'rules.prominence', 'rules.radius', 'rules.share', 'rules.slopeBands.flat', 'rules.slopeBands.gentle', 'rules.slopeBands.steep', 'rules.slopeWindow'];
const MAP_HEAD = ['id', 'size.cols', 'size.rows', 'unit.height', 'unit.map', 'unit.scale', 'version', ...RULES];
const NEAR = (k: string) => [`${k}.at[]`, `${k}.distance.map`, `${k}.distance.scale`, `${k}.name`];

describe('map facts: setting-builder/ravine', () => {
  const file = FIXTURE('ravine', 'map.json'), spec = map.parseMap(JSON.parse(readFileSync(file, 'utf8')));
  const marks = spec.overlay.symbols.map(s => `${s.x},${s.y}`);
  const at = marks.flatMap(m => ['--at', m]);

  test('the eleven marks each report a terrain, a whole-interval height, a slope and their height above the river', async () => {
    const r = await json('map', 'facts', '--file', file, ...at, '--above', 'river');
    expect(r).toMatchObject({ version: 1, id: 'e', size: { cols: 16, rows: 184 }, unit: { map: 'cell', scale: 'yd', height: 'ft' } });
    expect(r.points).toHaveLength(11);
    r.points.forEach((p: map.PointFacts, i: number) => {
      expect(p.at).toEqual(spec.overlay.symbols[i] && [spec.overlay.symbols[i].x, spec.overlay.symbols[i].y].map(v => Math.round(v * 10) / 10));
      expect(map.TERRAINS).toContain(p.terrain);
      expect(p.height % spec.topo.interval, `${marks[i]} height`).toBe(0);
      expect(p.slope.band).toMatch(/^(flat|gentle|steep|cliff)$/);
      expect(p.river).toMatchObject({ name: 'river-1', source: 'edit' });
      expect(p.above).toMatchObject({ of: 'river', value: p.height - p.above!.reference!.height });
      expect(Math.abs(p.above!.value!) % spec.topo.interval).toBe(0);
    });
  });

  test('the marks on the east wall, which the file paints rock, report rock; so does ground inside the west wall', async () => {
    const east = spec.overlay.symbols.filter(s => s.x >= 12), r = await json('map', 'facts', '--file', file, ...east.flatMap(s => ['--at', `${s.x},${s.y}`]), '--at', '2,60', '--at', '14,100');
    expect(east).toHaveLength(5);
    expect(r.points.map((p: map.PointFacts) => p.terrain)).toEqual(Array(7).fill('rock'));
  });

  test('the west-wall marks stand higher above the river than the river\'s own points, which are 0 above it', async () => {
    const west = spec.overlay.symbols.filter(s => s.x === 4), river = [20, 60, 100, 150].flatMap(y => ['--at', `8,${y}`]);
    const r = await json('map', 'facts', '--file', file, ...west.flatMap(s => ['--at', `${s.x},${s.y}`]), ...river, '--above', 'river');
    expect(west).toHaveLength(3);
    const [walls, own] = [r.points.slice(0, 3), r.points.slice(3)] as map.PointFacts[][];
    for (const p of own) { expect(p.above!.value).toBe(0); expect(p.river).toMatchObject({ distance: { map: 0 }, within: true }); }
    for (const p of walls) expect(p.above!.value, `${p.at}`).toBeGreaterThan(Math.max(...own.map(o => o.above!.value!)));
  });

  test('with no query: the road and the drawn river are each a point list that runs the length of the map; no generated river is reported here', async () => {
    const { features: f } = await json('map', 'facts', '--file', file);
    expect(f.rivers).toHaveLength(1);
    expect(f.roads).toHaveLength(1);
    expect(f.generatedRivers).toEqual([]);   // gen.rivers is 1, but the generator traces none at this size and seed
    for (const line of [f.rivers[0], f.roads[0]]) {
      const ys = line.points.map((p: number[]) => p[1]);
      expect((Math.max(...ys) - Math.min(...ys)) / spec.rows, line.name).toBeGreaterThan(0.9);
      expect(line.length.map).toBeGreaterThan(0.9 * spec.rows);
      expect(line.length.scale).toBe(Math.round(line.length.map * 10 * 10) / 10);
    }
    expect(f.rivers[0]).toMatchObject({ source: 'edit', points: [[8, 4], [8, 180]], mouth: false });
    expect(f.roads[0].points[0]).toEqual([8, 180]);
    expect(f.roads[0].points.at(-1)).toEqual([10, 4]);
    expect(f.terrain.reduce((n: number, s: { share: number }) => n + s.share, 0)).toBe(100);
    expect(f.terrain[0]).toMatchObject({ terrain: 'rock' });
  });

  test('an area across the gorge: its shares, its ground and the river and road that cross it', async () => {
    const { areas: [a] } = await json('map', 'facts', '--file', file, '--area', '0,50,16,100');
    expect(a.terrain.reduce((n: number, s: { share: number }) => n + s.share, 0)).toBe(100);
    expect(a.terrain[0].terrain).toBe('rock');
    expect(a.rivers).toEqual([{ name: 'river-1', source: 'edit', enters: [8, 50], leaves: [8, 100], length: { map: 50, scale: 500 } }]);
    expect(a.roads).toHaveLength(1);
    expect(a.lowest.height).toBeLessThan(a.highest.height);
    expect(a.highest.height).toBe(40);
  });

  test('in a project the map is named by id, and gives the same facts as by --file', async () => {
    const { project } = initProject(mkdtempSync(join(tmpdir(), 'artgen-facts-')));
    const dir = join(project.art, 'maps', 'e');
    cpSync(file, join(dir, 'map.json'), { recursive: true, force: true, errorOnExist: false, dereference: true, filter: () => true, mode: 0 } as never);
    expect(await json('map', 'facts', 'e', '--root', project.root, '--at', '8,60')).toEqual(await json('map', 'facts', '--file', file, '--at', '8,60'));
  });
});

describe('dungeon facts: setting-builder', () => {
  test('keep: thirteen rooms at their sizes; the overlaps A.12/A.4 and A.13/A.10 are reported (and A.13/A.9, which the same tunnel also crosses)', async () => {
    const r = await json('dungeon', 'facts', '--file', FIXTURE('keep', 'dungeon.json'));
    const sizes: Record<number, [number, number]> = { 1: [8, 2], 2: [2, 1], 3: [8, 4], 4: [6, 4], 5: [6, 2], 6: [5, 4], 7: [3, 2], 8: [16, 16], 9: [8, 4], 10: [10, 5], 11: [12, 5], 12: [6, 3], 13: [30, 1] };
    expect(r.rooms).toHaveLength(13);
    for (const [n, [w, h]] of Object.entries(sizes)) {
      const room = r.rooms.find((x: { label: string }) => x.label.startsWith(`A.${n} `));
      expect(room.box.cells, `A.${n}`).toMatchObject({ w, h });
      expect(room.box.scale, `A.${n} in feet`).toMatchObject({ w: w * 5, h: h * 5 });
      expect(room).toMatchObject({ shape: 'rect', number: +n });
    }
    const code = (id: string) => r.rooms.find((x: { id: string }) => x.id === id).label.split(' ')[0];
    expect(r.overlaps.map((o: { rooms: string[]; count: number }) => [o.rooms.map(code).join('/'), o.count])).toEqual([['A.4/A.12', 18], ['A.9/A.13', 7], ['A.10/A.13', 10]]);
    expect(r.overlaps[0]).toMatchObject({ box: { cells: { x: 3, y: 69, w: 6, h: 3 }, scale: { x: 15, y: 345, w: 30, h: 15 } } });
    expect(r.overlaps[0].cells).toHaveLength(18);
    expect(r.corridors).toHaveLength(4);
    expect(r.exits.map((x: { at: number[]; edge: string }) => [x.at, x.edge])).toEqual([[[6, 40], 'w'], [[42, 4], 'n']]);
    expect(r.unreached.map(code)).toEqual(['A.3', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.11']);
  });

  test('warren: five rooms, four corridors between rooms, one exit, no overlaps, no unreached rooms', async () => {
    const r = await json('dungeon', 'facts', '--file', FIXTURE('warren', 'dungeon.json'));
    expect(r.rooms.map((x: { box: { cells: { w: number; h: number } } }) => [x.box.cells.w, x.box.cells.h])).toEqual([[8, 1], [8, 1], [6, 6], [4, 3], [3, 2]]);
    const between = r.corridors.filter((c: { from: object; to: object }) => 'room' in c.from && 'room' in c.to);
    expect(between).toHaveLength(4);
    expect(between.map((c: { doors: unknown[] }) => c.doors.some(Boolean))).toEqual([false, false, true, true]);   // F.1-F.2 and F.2-F.3 open; F.3-F.4 and F.3-F.5 with doors
    expect(r.exits).toHaveLength(1);
    expect(r.exits[0]).toMatchObject({ room: 'r1', at: [35, 5], edge: 'e', distance: { map: 4, scale: 20 } });
    expect(r.overlaps).toEqual([]);
    expect(r.unreached).toEqual([]);
    expect(r.rooms.find((x: { id: string }) => x.id === 'r3').doors).toHaveLength(2);
  });

  test('shrine-crypts: three exits, one of them past the west edge; nothing overlaps or is left out', async () => {
    const r = await json('dungeon', 'facts', '--file', FIXTURE('shrine-crypts', 'dungeon.json'));
    expect(r.exits.map((x: { edge: string }) => x.edge)).toEqual(['s', 'n', 'w']);
    expect(r.exits[2].distance).toEqual({ map: -2, scale: -10 });
    expect(r.overlaps).toEqual([]);
    expect(r.unreached).toEqual([]);
  });

  test('every field the JSON carries is named here, so adding, removing or renaming one is noticed', async () => {
    const f = join(mkdtempSync(join(tmpdir(), 'artgen-facts-d-')), 'd.json');
    await run('dungeon', 'new', '--empty', '--file', f);
    const d = JSON.parse(readFileSync(f, 'utf8'));
    d.rooms = [{ id: 'a', shape: 'rect', x: 2, y: 2, w: 4, h: 3, label: 'A' }, { id: 'b', shape: 'rect', x: 4, y: 3, w: 4, h: 3 }, { id: 'c', shape: 'rect', x: 20, y: 20, w: 3, h: 3 }, { id: 'd', shape: 'rect', x: 12, y: 2, w: 3, h: 3 }];
    d.corridors = [{ from: { room: 'a' }, to: { room: 'd' }, doors: ['door', null] }, { from: { at: [1, 1] }, to: { room: 'a' } }, { from: { room: 'd' }, to: { at: [30, 5] }, doors: [null, 'secret'] }];
    writeFileSync(f, JSON.stringify(d));
    expect(sorted(await json('dungeon', 'facts', '--file', f))).toEqual([
      'corridors[].doors[]', 'corridors[].from.at[]', 'corridors[].from.room', 'corridors[].index', 'corridors[].length.map', 'corridors[].length.scale', 'corridors[].to.at[]', 'corridors[].to.room', 'corridors[].width',
      'exits[].at[]', 'exits[].corridor', 'exits[].distance.map', 'exits[].distance.scale', 'exits[].door', 'exits[].edge', 'exits[].end', 'exits[].room',
      'id', 'overlaps[].box.cells.h', 'overlaps[].box.cells.w', 'overlaps[].box.cells.x', 'overlaps[].box.cells.y', 'overlaps[].box.scale.h', 'overlaps[].box.scale.w', 'overlaps[].box.scale.x', 'overlaps[].box.scale.y',
      'overlaps[].cells[][]', 'overlaps[].count', 'overlaps[].rooms[]',
      'rooms[].box.cells.h', 'rooms[].box.cells.w', 'rooms[].box.cells.x', 'rooms[].box.cells.y', 'rooms[].box.scale.h', 'rooms[].box.scale.w', 'rooms[].box.scale.x', 'rooms[].box.scale.y',
      'rooms[].doors[].at[]', 'rooms[].doors[].corridor', 'rooms[].doors[].kind', 'rooms[].doors[].to', 'rooms[].id', 'rooms[].label', 'rooms[].number', 'rooms[].shape',
      'rules.position', 'size.cols', 'size.rows', 'unit.map', 'unit.scale', 'unreached[]', 'version',
    ]);
    const r = await json('dungeon', 'facts', '--file', f);
    expect(r.exits.map((x: { end: string; room: string; door: string | null }) => [x.end, x.room, x.door])).toEqual([['from', 'a', null], ['to', 'd', 'secret']]);
    expect(r.rooms[0].doors).toEqual([{ kind: 'door', at: [6, 3.5], corridor: 0, to: 'd' }]);
    expect(r.overlaps[0].rooms).toEqual(['a', 'b']);
    expect(r.unreached).toEqual(['b', 'c']);
  });

  test('the same file gives byte-identical --json twice, by --file and from the maps-only entry', async () => {
    const f = FIXTURE('keep', 'dungeon.json'), a = (await run('dungeon', 'facts', '--file', f, '--json')).out, b = (await run('dungeon', 'facts', '--file', f, '--json')).out;
    expect(a).toBe(b);
    expect((await capture(() => mapsMain(['dungeon', 'facts', '--file', f, '--json']))).out).toBe(a);
  });

  test('human text names the rooms, the exits and the overlaps', async () => {
    const t = (await run('dungeon', 'facts', '--file', FIXTURE('keep', 'dungeon.json'))).out;
    expect(t).toContain('rooms (13):');
    expect(t).toContain('r4 #4: rect 6×4 cells (30×20 ft) at 3,68 "A.4 The Broken Wheel"');
    expect(t).toContain('r4 / r12: 18 cells');
    expect(t).toContain('unreached rooms: r3, r5, r6, r7, r8, r9, r11');
  });
});

describe('map facts: the command line and every field', () => {
  const dir = mkdtempSync(join(tmpdir(), 'artgen-facts-map-')), file = join(dir, 'reg.json');
  beforeAll(async () => {
    await run('map', 'new', '--preset', 'regional', '--seed', '2', '--file', file);
    await run('map', 'edit', 'river', '--points', '1,1,6,7,12,10', '--width', '0.3', '--file', file);
    await run('map', 'edit', 'road', '--points', '0,20,15,11,29,2', '--file', file);
  });

  test('--at takes repeats, a run of values and cell names; --area takes a rectangle or an outline; both can be asked at once', async () => {
    const one = await json('map', 'facts', '--file', file, '--at', '3,4', '--at', '5,6');
    const run2 = await json('map', 'facts', '--file', file, '--at', '3,4', '5,6');
    expect(run2).toEqual(one);
    expect(one.points.map((p: map.PointFacts) => p.at)).toEqual([[3, 4], [5, 6]]);
    expect((await json('map', 'facts', '--file', file, '--at', 'C4')).points[0].at).toEqual([2.5, 3.5]);
    const both = await json('map', 'facts', '--file', file, '--at', '3,4', '--area', '2,2,8,8', '--area', '2,2,8,2,8,8');
    expect(both.points).toHaveLength(1);
    expect(both.areas).toHaveLength(2);
    expect(both.features).toBeUndefined();
    expect(both.areas[0].area).toEqual([[2, 2], [8, 2], [8, 8], [2, 8]]);
    expect(both.areas[1].area).toEqual([[2, 2], [8, 2], [8, 8]]);
  });

  test('bad input is refused with a message', async () => {
    await expect(run('map', 'facts', '--file', file, '--at', '99,1')).rejects.toThrow(/outside the map/);
    await expect(run('map', 'facts', '--file', file, '--at', '3,4', '--above', 'sky')).rejects.toThrow(/--above: river or lowest/);
    await expect(run('map', 'facts', '--file', file, '--at', '3,4', '--above', 'lowest', '--radius', '-1')).rejects.toThrow(/--radius/);
    await expect(run('map', 'facts', '--file', file, '--area', '1,2,3')).rejects.toThrow(/--area/);
    await expect(run('map', 'facts', '--file', join(dir, 'nope.json'))).rejects.toThrow(/no map file/);
  });

  test('every field the JSON carries is named here: points, areas and features', async () => {
    const r = await json('map', 'facts', '--file', file, '--at', '3,4', '--above', 'river', '--area', '4,0,8,22'), f = await json('map', 'facts', '--file', file);
    const point = ['points[].at[]', 'points[].height', 'points[].slope.band', 'points[].slope.gradient', 'points[].terrain', ...NEAR('points[].river').map(p => p), 'points[].river.source', 'points[].river.within', ...NEAR('points[].road'),
      'points[].above.of', 'points[].above.value', 'points[].above.reference.at[]', 'points[].above.reference.height'];
    expect(sorted(r).filter(p => p.startsWith('points'))).toEqual(point.sort());
    const lowest = (await json('map', 'facts', '--file', file, '--at', '3,4', '--above', 'lowest', '--radius', '2')).points[0].above;
    expect(Object.keys(lowest)).toEqual(['of', 'value', 'reference']);
    expect(lowest.of).toBe('lowest');
    expect(sorted(r).filter(p => p.startsWith('areas'))).toEqual([
      'areas[].area[][]', 'areas[].highest.at[]', 'areas[].highest.height', 'areas[].lowest.at[]', 'areas[].lowest.height',
      'areas[].rivers[].enters[]', 'areas[].rivers[].leaves[]', 'areas[].rivers[].length.map', 'areas[].rivers[].length.scale', 'areas[].rivers[].name', 'areas[].rivers[].source',
      'areas[].roads[].enters[]', 'areas[].roads[].leaves[]', 'areas[].roads[].length.map', 'areas[].roads[].length.scale', 'areas[].roads[].name',
      'areas[].terrain[].share', 'areas[].terrain[].terrain',
    ].sort());
    expect(sorted(r).filter(p => !/^(points|areas|features)/.test(p))).toEqual(MAP_HEAD.sort());
    const line = (k: string, extra: string[] = []) => [`features.${k}[].length.map`, `features.${k}[].length.scale`, `features.${k}[].name`, `features.${k}[].points[][]`, ...extra.map(e => `features.${k}[].${e}`)];
    expect(sorted(f).filter(p => p.startsWith('features') && !p.startsWith('features.hollows'))).toEqual([
      ...line('rivers', ['mouth', 'source']), ...line('generatedRivers', ['mouth', 'source']), ...line('roads'),
      'features.hilltops[].at[]', 'features.hilltops[].height', 'features.hilltops[].prominence', 'features.highest.at[]', 'features.highest.height', 'features.lowest.at[]', 'features.lowest.height',
      'features.terrain[].share', 'features.terrain[].terrain',
    ].sort());
    expect(Array.isArray(f.features.hollows)).toBe(true);
    for (const h of f.features.hollows) expect(Object.keys(h).sort()).toEqual(['at', 'height', 'prominence']);
  });

  test('the same file gives byte-identical --json twice, for every kind of query, and the rules are stated in it', async () => {
    for (const q of [[], ['--at', '3,4', '--above', 'river'], ['--at', '3,4', '--above', 'lowest'], ['--area', '2,2,12,12']]) {
      const a = (await run('map', 'facts', '--file', file, ...q, '--json')).out, b = (await run('map', 'facts', '--file', file, ...q, '--json')).out;
      expect(a).toBe(b);
      expect(JSON.parse(a).rules).toMatchObject({ height: 'topo.interval', position: 0.1, share: 1 });
    }
  });

  test('human text', async () => {
    const t = (await run('map', 'facts', '--file', file, '--at', '3,4', '--above', 'river', '--area', '2,2,20,12')).out;
    expect(t).toMatch(/^reg: 30×22 cells; heights in ft, distances in cells \(mi\)/);
    expect(t).toMatch(/at 3,4: \w+, \d+ ft, slope \w+/);
    expect(t).toMatch(/above the river/);
    expect(t).toMatch(/area 2,2 20,2 20,12 2,12: /);
    expect((await run('map', 'facts', '--file', file)).out).toMatch(/hilltops: /);
  });
});
