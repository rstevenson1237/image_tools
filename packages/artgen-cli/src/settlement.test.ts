// `artgen settlement`: a generated village and a castle in a project, a settlement built by hand with a floor plan,
// a settlement over a terrain map, renders of the site and the plans, check and facts, and --file path mode.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
afterEach(() => vi.restoreAllMocks());

describe('artgen settlement', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-settlement-')), R = ['--root', root];
  const spec = (id: string) => JSON.parse(readFileSync(join(root, 'art', 'settlements', id, 'settlement.json'), 'utf8'));
  beforeAll(async () => { await run('init', ...R); });

  test('a generated village with interiors, its facts and every plan rendered', async () => {
    expect((await run('settlement', 'new', 'brook', '--kind', 'village', '--seed', '7', '--interiors', '--title', 'Brookby', ...R)).code).toBe(0);
    const s = spec('brook');
    expect(s).toMatchObject({ id: 'brook', kind: 'village', seed: 7, title: 'Brookby', version: 1 });
    expect(s.buildings.length).toBeGreaterThan(5);
    expect(s.buildings.every((b: { floors?: unknown[] }) => b.floors?.length)).toBe(true);
    const facts = JSON.parse((await run('settlement', 'facts', 'brook', '--json', ...R)).out);
    expect(facts.version).toBe(1);
    expect(facts.buildings.length).toBe(s.buildings.length);
    const r = JSON.parse((await run('settlement', 'render', 'brook', '--plans', '--format', 'svg', '--json', ...R)).out);
    const floors = s.buildings.reduce((n: number, b: { floors: unknown[] }) => n + b.floors.length, 0);
    expect(r.renders.length).toBe(1 + floors);
    expect(r.renders[0].files[0]).toMatch(/brook\.color\.svg$/);
    expect(r.renders[1].files[0]).toMatch(/brook\.b1\.(f|c)\d\.color\.svg$/);
    expect(existsSync(join(root, r.renders[0].files[0]))).toBe(true);
  });

  test('a castle rendered in both themes, as PNG', async () => {
    await run('settlement', 'new', 'keep', '--kind', 'castle', '--seed', '3', ...R);
    const r = JSON.parse((await run('settlement', 'render', 'keep', '--theme', 'both', '--format', 'png', '--ppu', '8', '--json', ...R)).out);
    expect(r.files.map((f: string) => f.split(/[\\/]/).pop())).toEqual(['keep.color.png', 'keep.bw.png']);
    expect(spec('keep').walls.some((w: { kind: string }) => w.kind === 'curtain')).toBe(true);
  });

  test('build by hand: a street, a wall with a gate, an inn with a floor plan, trees and a well', async () => {
    await run('settlement', 'new', 'cross', '--empty', '--size', '40x30', ...R);
    expect(spec('cross')).toMatchObject({ buildings: [], roads: [] });
    await run('settlement', 'road', 'cross', 'add', 'street', '--points', '0,15,40,15', '--label', 'High Street', ...R);
    await run('settlement', 'water', 'cross', 'add', 'stream', '--points', '30,0,30,30', ...R);
    await run('settlement', 'wall', 'cross', 'add', 'palisade', '--points', '2,2,28,2,28,28,2,28', '--closed', '--towers', 'square', ...R);
    await run('settlement', 'wall', 'cross', 'gate', '0', '--at', '2,15', '--kind', 'gate', ...R);
    await run('settlement', 'building', 'cross', 'add', 'inn', '--at', '8,8', '--size', '8x6', '--label', 'The Ford', '--building-id', 'inn', ...R);
    await run('settlement', 'building', 'cross', 'add', 'house', '--at', '18,18', '--size', '5x4', '--angle', '20', ...R);
    await run('settlement', 'room', 'cross', 'inn', 'add', 'rect', '--at', '0,0', '--size', '5x6', '--label', 'Taproom', '--room-id', 'tap', ...R);
    await run('settlement', 'room', 'cross', 'inn', 'add', 'rect', '--at', '5,0', '--size', '3x6', '--room-id', 'kit', ...R);
    await run('settlement', 'connect', 'cross', 'inn', 'tap', 'kit', ...R);
    await run('settlement', 'door', 'cross', 'inn', '--at', '2.5,6', ...R);
    await run('settlement', 'window', 'cross', 'inn', '--at', '0,3', ...R);
    await run('settlement', 'fixture', 'cross', 'inn', 'add', 'bar', '--at', '2.5,1', ...R);
    await run('settlement', 'fixture', 'cross', 'inn', 'add', 'hearth', '--at', '6.5,3', ...R);
    await run('settlement', 'tree', 'cross', 'add', 'conifer', '--at', '35,5', ...R);
    await run('settlement', 'tree', 'cross', 'scatter', 'tree', '--area', '32,20,40,20,40,30,32,30', '--count', '6', ...R);
    await run('settlement', 'prop', 'cross', 'add', 'well', '--at', '15,12', ...R);
    await run('settlement', 'label', 'cross', 'Crossford', '--at', '15,4', '--kind', 'area', ...R);
    await run('settlement', 'style', 'cross', '--title', 'Crossford', '--legend', 'on', ...R);
    const s = spec('cross');
    expect(s.roads[0]).toEqual({ kind: 'street', points: [0, 15, 40, 15], label: 'High Street' });
    expect(s.walls[0]).toMatchObject({ kind: 'palisade', closed: true, towers: { shape: 'square' }, gates: [{ at: [2, 15], kind: 'gate' }] });
    expect(s.buildings.map((b: { id: string }) => b.id)).toEqual(['inn', 'b1']);
    expect(s.buildings[0].floors[0]).toMatchObject({ level: 0, rooms: [{ id: 'tap' }, { id: 'kit' }], connections: [{ a: 'tap', b: 'kit' }], doors: [{ at: [2.5, 6] }], fixtures: [{ kind: 'bar' }, { kind: 'hearth' }] });
    expect(s.trees.length).toBe(7);
    expect(s.legend).toBe(true);
    await expect(run('settlement', 'building', 'cross', 'add', 'castle', '--at', '1,1', '--size', '2x2', ...R)).rejects.toThrow(/kind: one of house/);
    await expect(run('settlement', 'room', 'cross', 'nope', 'add', 'rect', '--at', '0,0', '--size', '2x2', ...R)).rejects.toThrow(/no building nope/);
    const plan = JSON.parse((await run('settlement', 'render', 'cross', '--building', 'inn', '--format', 'svg', '--json', ...R)).out);
    expect(plan).toMatchObject({ view: 'plan', building: 'inn', floor: 0 });
    expect(readFileSync(join(root, plan.files[0]), 'utf8')).toContain('The Ford — Ground floor');
    // lay the inn out afresh: rooms, doors and furniture from its kind
    await run('settlement', 'interior', 'cross', 'inn', '--stories', '2', ...R);
    expect(spec('cross').buildings[0].floors.map((f: { level: number }) => f.level)).toEqual(expect.arrayContaining([0, 1]));
    await run('settlement', 'interior', 'cross', 'inn', 'clear', ...R);
    expect(spec('cross').buildings[0].floors).toBeUndefined();
    await run('settlement', 'building', 'cross', 'rm', 'b1', ...R);
    expect(spec('cross').buildings.length).toBe(1);
  });

  test('over a terrain map: the underlay path, scale and origin', async () => {
    await run('map', 'new', 'vale', '--preset', 'local', '--size', '40x30', '--seed', '5', ...R);
    await run('settlement', 'new', 'vale-town', '--kind', 'hamlet', '--seed', '2', '--map', 'vale', '--at', '4,4', ...R);
    expect(spec('vale-town').underlay).toMatchObject({ map: '../../maps/vale/map.json', origin: [4, 4] });
    const r = JSON.parse((await run('settlement', 'render', 'vale-town', '--format', 'svg', '--json', ...R)).out);
    expect(readFileSync(join(root, r.files[0]), 'utf8')).toContain('id="underlay"');
    expect((await run('settlement', 'check', 'vale-town', ...R)).code).toBe(0);
  });

  test('list, show and the fixture list', async () => {
    const list = JSON.parse((await run('settlement', 'list', '--json', ...R)).out);
    expect(list.items.map((s: { id: string }) => s.id)).toEqual(expect.arrayContaining(['brook', 'keep', 'cross']));
    expect((await run('settlement', 'show', 'cross', ...R)).out).toMatch(/cross "Crossford": a village/);
    expect(JSON.parse((await run('settlement', 'fixtures', '--json')).out).items.some((f: { kind: string }) => f.kind === 'bed')).toBe(true);
    expect(JSON.parse((await run('formats', '--json')).out)).toMatchObject({ settlement: 1 });
  });
});

describe('settlement --file (the maps-only bundle)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'artgen-settlement-file-')), file = join(dir, 'S.a.json'), F = ['--file', file];
  const maps = async (...args: string[]) => {
    const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
    try { return { code: await mapsMain(args), out: out.join('\n') }; } finally { log.mockRestore(); }
  };

  test('new, edit, check and render beside the file, the same twice', async () => {
    await maps('settlement', 'new', '--kind', 'hamlet', '--seed', '1', ...F);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ id: 'S-a', kind: 'hamlet' });
    await maps('settlement', 'building', 'add', 'tower', '--at', '1,1', '--size', '4x4', '--shape', 'circle', ...F);
    const r1 = JSON.parse((await maps('settlement', 'render', '--format', 'svg', '--json', ...F)).out), a = readFileSync(join(dir, 'S.a.color.svg'), 'utf8');
    expect(r1.files[0]).toMatch(/S\.a\.color\.svg$/);
    await maps('settlement', 'render', '--format', 'svg', ...F);
    expect(readFileSync(join(dir, 'S.a.color.svg'), 'utf8')).toBe(a);
    expect((await maps('settlement', 'check', ...F)).code).toBe(0);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ id: 'bad', kind: 'village', roads: [{ kind: 'canal', points: [0, 0, 1, 1] }] }));
    const c = await maps('settlement', 'check', '--json', '--file', bad);
    expect(c.code).toBe(1);
    expect(JSON.parse(c.out).errors.map((e: { path: string }) => e.path)).toContain('roads[0].kind');
  });
});
