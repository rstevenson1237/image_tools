// Tile map exports on disk (R7c): `artgen dungeon|map|settlement export` and `artgen tileset`, with tiles from an
// exported pack (the P6b blob47 grass autotile from the bench, packed as `artgen export` packs it), and the shared
// autotile bits checked against the runtime's own copy.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { buildPack, decodePNG, encodePNG } from 'artgen-core';
import type { AssetBrief } from './asset.ts';
import { BLOB47, NEIGHBOURS, autotileIndexOf, cellHash, reduceCorners } from 'artgen-primitives/lib/autobits.ts';
import { tileShapeProblem, VIEW_MAPS } from 'artgen-primitives/lib/viewmap.ts';
import { VIEW_MODULES } from 'artgen-core';
import * as runtime from 'artgen-runtime';
import { openAsset, renderVersion } from './asset.ts';
import { BENCH_ROOT } from './bench.ts';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';
import { findTemplate } from './templates.ts';

const capture = async (fn: () => Promise<number>) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await fn(), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const run = (...args: string[]) => capture(() => main(args));
const runMaps = (...args: string[]) => capture(() => mapsMain(args));
afterEach(() => vi.restoreAllMocks());

/** A pack holding the bench's grass autotile (blob47, 32 px) and a plain 64 px texture: the files `artgen export` writes. */
async function benchPack(dir: string): Promise<string> {
  const a = openAsset(join(BENCH_ROOT, 'p6', 'grass-autotile')), b = openAsset(join(BENCH_ROOT, 'p6', 'stone'));
  const inputs = await Promise.all([a, b].map(async x => ({
    brief: x.brief as AssetBrief, view: 'topdown' as const, renders: [(await renderVersion(x, x.brief.id === 'stone' ? 'base.v1' : 'finish.v1')).render], version: 'finish.v1', sourceHash: 'test',
  })));
  const built = buildPack('bench', a.dir, inputs);
  mkdirSync(dir, { recursive: true });
  built.atlases.forEach((g, i) => writeFileSync(join(dir, built.manifest.atlases[i]), encodePNG(g)));
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(built.manifest));
  return join(dir, 'pack.json');
}

describe('autotile bits and view maps', () => {
  test('the shared copy of the autotile bits agrees with the runtime: masks, the 47 order, indices and the variant hash', () => {
    expect(BLOB47).toEqual(runtime.BLOB47);
    expect(NEIGHBOURS.map(n => n[2])).toEqual([runtime.N, runtime.NE, runtime.E, runtime.SE, runtime.S, runtime.SW, runtime.W, runtime.NW]);
    for (let m = 0; m < 256; m++) {
      expect(reduceCorners(m)).toBe(runtime.reduceCorners(m));
      expect(autotileIndexOf('blob47', m)).toBe(runtime.resolveAutotile('blob47', m));
      expect(autotileIndexOf('wang16', m)).toBe(runtime.resolveAutotile('wang16', m));
    }
    for (const [x, y, n, s] of [[0, 0, 4, 0], [17, -3, 3, 9], [255, 1024, 7, 2]]) expect(cellHash(x, y, n, s)).toBe(runtime.cellHash(x, y, n, s));
  });

  test('every view module has the D8 shape: probe templates on disk, its checks, a map layout or none (free)', () => {
    expect(Object.keys(VIEW_MODULES)).toEqual(['topdown', 'oblique', 'iso', 'stack', 'side', 'fp', 'free']);
    for (const m of Object.values(VIEW_MODULES)) {
      for (const t of m.probes) { const [view, kind] = t.split('/'); expect(findTemplate(view, kind), `${m.id}: ${t}`).toMatchObject({ view, kind }); }
      expect(m.checks.length, m.id).toBeGreaterThan(0);
      expect(m.map, m.id).toBe(VIEW_MAPS[m.id]);
      expect(!!m.render3d, m.id).toBe(m.brief);
    }
    expect(VIEW_MODULES.free).toMatchObject({ brief: false, runtime: expect.arrayContaining(['riggedModel']) });
    expect(VIEW_MODULES.free.map).toBeUndefined();
    expect(VIEW_MODULES.iso.map).toEqual({ tiled: 'isometric', tile: 'diamond', ldtk: false });
    expect([tileShapeProblem('topdown', 16, 16), tileShapeProblem('iso', 32, 16), tileShapeProblem('iso', 32, 40), tileShapeProblem('side', 16, 24)]).toEqual([null, null, null, null]);
    expect(tileShapeProblem('topdown', 16, 24)).toBe('a topdown tile is square (16×24 px)');
    expect(tileShapeProblem('iso', 31, 16)).toBe('iso tiles are an even width (31 px)');
    expect(tileShapeProblem('free', 16, 16)).toContain('no tile maps');
  });
});

describe('artgen dungeon|map|settlement export, artgen tileset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'artgen-tilemap-')), F = ['--file', join(dir, 'lair.json')];
  let pack = '';
  beforeAll(async () => {
    pack = await benchPack(join(dir, 'pack'));
    await run('dungeon', 'new', '--seed', '7', ...F);
  }, 60_000);

  test('flat tiles by default: Tiled and LDtk files and a preview beside the file', async () => {
    const r = await run('dungeon', 'export', ...F, '--json');
    const j = JSON.parse(r.out);
    expect(j).toMatchObject({ source: 'dungeon', id: 'lair', grid: 'square', view: 'topdown', orientation: 'orthogonal', tile: [16, 16], tiles: 4, bound: [] });
    expect(j.files.map((f: string) => f.split('/').pop())).toEqual(['lair-tiles.png', 'lair-preview.png', 'lair.tmj', 'lair.tsj', 'lair.ldtk']);
    const tmj = JSON.parse(readFileSync(join(dir, 'lair.tmj'), 'utf8'));
    expect(tmj.layers[0].data.filter((t: number) => t).length).toBe(j.counts.floor + j.counts.wall + j.counts.door + j.counts.yard);
  });

  test('a floor bound to the bench\'s blob47 autotile: a mixed wang set, tiles resolved as the runtime would, the same pixels in Tiled and LDtk', async () => {
    const out = join(dir, 'grass');
    const r = await run('dungeon', 'export', ...F, '--pack', pack, '--tiles', 'floor=grass-autotile', '--out', out);
    expect(r.out).toContain('floor ← bench/grass-autotile (blob47)');
    expect(r.out).toContain('tile-shape   pass  floor: 32×32 px fits the topdown cell');
    const tmj = JSON.parse(readFileSync(join(out, 'lair.tmj'), 'utf8')), tsj = JSON.parse(readFileSync(join(out, 'lair.tsj'), 'utf8'));
    const ldtk = JSON.parse(readFileSync(join(out, 'lair.ldtk'), 'utf8')), sheet = decodePNG(new Uint8Array(readFileSync(join(out, 'lair-tiles.png'))));
    expect(tsj.wangsets[0]).toMatchObject({ name: 'floor', type: 'mixed' });
    expect(tsj.wangsets[0].wangtiles).toHaveLength(47);
    // each cell's tile, from the Tiled map: the floor cells show the tile the runtime resolves for their neighbours
    const W = tmj.width, H = tmj.height, gid = (x: number, y: number) => tmj.layers[0].data[y * W + x];
    const floorIds = new Set(tsj.tiles.filter((t: any) => t.type === 'floor').map((t: any) => t.id + 1));
    const floor = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || floorIds.has(gid(x, y));
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floorIds.has(gid(x, y))) {
      const t = tsj.tiles.find((u: any) => u.id === gid(x, y) - 1), index = t.properties.find((p: any) => p.name === 'index').value;
      expect(index).toBe(runtime.resolveAutotile('blob47', runtime.neighbourMask(x, y, floor)));
      n++;
    }
    expect(n).toBeGreaterThan(100);
    // LDtk draws the same tile from the same place in the same sheet
    const tiles = ldtk.levels[0].layerInstances[1].gridTiles;
    expect(tiles.length).toBe(tmj.layers[0].data.filter((t: number) => t).length);
    for (const t of tiles.slice(0, 50)) {
      expect(gid(t.px[0] / 32, t.px[1] / 32)).toBe(t.t + 1);
      expect([t.src[0], t.src[1]]).toEqual([(t.t % tsj.columns) * 32, Math.floor(t.t / tsj.columns) * 32]);
    }
    expect([sheet.w, sheet.h]).toEqual([tsj.imagewidth, tsj.imageheight]);
  });

  test('the maps-only entry runs it too; errors say what to do', async () => {
    expect((await runMaps('map', 'new', '--seed', '2', '--file', join(dir, 'vale.json'))).code).toBe(0);
    const r = await runMaps('map', 'export', '--file', join(dir, 'vale.json'), '--json');
    expect(JSON.parse(r.out)).toMatchObject({ source: 'map', grid: 'hex', orientation: 'hexagonal' });
    await expect(run('map', 'export', '--file', join(dir, 'vale.json'), '--to', 'ldtk')).rejects.toThrow('LDtk has square grids only');
    await expect(run('dungeon', 'export', ...F, '--tiles', 'floor=x')).rejects.toThrow('--tiles needs --pack');
    await expect(run('dungeon', 'export', ...F, '--pack', pack, '--tiles', 'floor=nope')).rejects.toThrow('no asset "nope" in pack bench (tiles: grass-autotile, stone)');
    await expect(run('dungeon', 'export', ...F, '--pack', pack, '--tiles', 'floor')).rejects.toThrow('--tiles: class=asset');
    await expect(run('dungeon', 'export', ...F, '--cell', '2')).rejects.toThrow('unknown flag --cell');
    await expect(run('dungeon', 'export', ...F, '--view', 'free')).rejects.toThrow('no tile maps for the free view');
  });

  test('a tile asset on its own: the tileset with its wang set, on an island of it', async () => {
    const out = join(dir, 'ts');
    const r = await run('tileset', 'grass-autotile', '--pack', pack, '--out', out, '--json'), j = JSON.parse(r.out);
    expect(j).toMatchObject({ source: 'tileset', id: 'grass-autotile', size: [10, 10], tiles: 47, bound: [{ class: 'grass-autotile', autotile: 'blob47', variants: 1 }] });
    const tmj = JSON.parse(readFileSync(join(out, 'grass-autotile.tmj'), 'utf8'));
    expect(tmj.layers[0].data.some((t: number) => t === 0)).toBe(true);   // the island has a shore
    expect(JSON.parse(readFileSync(join(out, 'grass-autotile.tsj'), 'utf8')).wangsets[0].wangtiles).toHaveLength(47);
    const xml = await run('tileset', 'stone', '--pack', pack, '--out', out, '--xml', '--to', 'tiled');
    expect(xml.out).toContain('stone.tsx');
    expect(readFileSync(join(out, 'stone.tsx'), 'utf8')).toMatch(/<image source="stone-tiles.png" width="\d+" height="64"\/>/);
  });
});
