/**
 * Tile map exports on disk (R7c, docs/TILEMAPS.md §7): a dungeon, terrain map or settlement → Tiled and LDtk files in its
 * `out/` folder, with tiles bound from an exported pack (`--pack public/assets/main/pack.json --tiles floor=mud`), and a
 * pack's tile asset on its own as a tileset (`artgen tileset`). The engine is `artgen-mapgen/tilemap`; this file only
 * reads and writes. It is in the maps-only bundle, so it never imports the pixel-art pipeline.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { decodePNG, map, tilemap, type Grid } from 'artgen-core/maps';
import { dungeonFile, dungeonsDir, readDungeon } from './dungeon.ts';
import { mapFile, mapsDir, readMap } from './map.ts';
import { readSettlement, settlementFile, settlementsDir } from './settlement.ts';
import { fileStem, type FileRef, type Project } from './projectfs.ts';

export type TilemapKind = 'dungeon' | 'map' | 'settlement';
export interface TilemapFlags {
  to?: 'tiled' | 'ldtk' | 'both';
  xml?: boolean;
  view?: string;
  tile?: number;
  /** A pack's `pack.json` (or its folder): the tiles bound with `tiles`. */
  pack?: string;
  /** `class=asset` bindings. */
  tiles?: string[];
  seed?: number;
  /** Terrain maps: map units per cell (default the square grid's size, the hex grid, or 1). */
  cell?: number;
  out?: string;
}

export interface TilemapResult {
  source: TilemapKind | 'tileset';
  id: string;
  size: [number, number];
  grid: 'square' | 'hex';
  view: string;
  orientation: string;
  tile: [number, number];
  tiles: number;
  bound: { class: string; source: string; autotile?: string; variants: number }[];
  counts: Record<string, number>;
  objects: number;
  checks: { id: string; class: string; source: string; status: string; detail: string }[];
  files: string[];
}

const shown = (p: Project | null, f: string): string => relative(p?.root ?? process.cwd(), f);

/** A pack manifest and its atlases, decoded once per export. */
interface LoadedPack { name: string; dir: string; manifest: { pack: string; atlases: string[]; assets: Record<string, tilemap.PackTileAsset> }; atlases?: Grid[] }
function loadPack(path: string): LoadedPack {
  const file = path.endsWith('.json') ? resolve(path) : join(resolve(path), 'pack.json');
  if (!existsSync(file)) throw new Error(`no pack at ${path} (an exported pack.json, e.g. public/assets/main/pack.json)`);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.format !== 1 || !manifest.assets || !Array.isArray(manifest.atlases)) throw new Error(`${path}: not an artgen pack.json`);
  return { name: manifest.pack, dir: dirname(file), manifest };
}
function bind(pk: LoadedPack, cls: string, asset: string): tilemap.TileBinding {
  const a = pk.manifest.assets[asset];
  if (!a) throw new Error(`no asset ${JSON.stringify(asset)} in pack ${pk.name} (tiles: ${Object.entries(pk.manifest.assets).filter(([, v]) => ['tile', 'tileset', 'texture'].includes(v.kind)).map(([k]) => k).join(', ') || 'none'})`);
  pk.atlases ??= pk.manifest.atlases.map(n => decodePNG(new Uint8Array(readFileSync(join(pk.dir, n)))));
  return tilemap.bindTiles(cls, pk.name, asset, a, pk.atlases);
}

/** `--to`: one editor, both, or (unset) the export's default. */
const editors = (v: TilemapFlags['to']): ('tiled' | 'ldtk')[] | undefined => (v === 'both' ? ['tiled', 'ldtk'] : v ? [v] : undefined);

/** `floor=mud,wall=stone` or repeated flags → [class, asset] pairs. */
export function parseTileBindings(v: string[] | undefined): [string, string][] {
  return (v ?? []).flatMap(s => s.split(',')).filter(Boolean).map(s => {
    const m = /^([\w-]+)=([\w-]+)$/.exec(s.trim());
    if (!m) throw new Error(`--tiles: class=asset (e.g. floor=mud), not ${JSON.stringify(s)}`);
    return [m[1], m[2]] as [string, string];
  });
}

function write(out: string, files: tilemap.TilemapFile[]): string[] {
  mkdirSync(out, { recursive: true });
  return files.map(f => { const path = join(out, f.name); writeFileSync(path, f.data); return path; });
}

function summarise(p: Project | null, g: tilemap.TileGrid, r: tilemap.TilemapExport, paths: string[]): TilemapResult {
  return {
    source: g.source, id: g.id, size: [g.cols, g.rows], grid: g.grid, view: r.view, orientation: r.orientation, tile: [r.sheet.tileW, r.sheet.tileH],
    tiles: r.sheet.tiles.length, bound: r.sheet.bindings, counts: r.counts, objects: g.objects.length, checks: r.checks, files: paths.map(f => shown(p, f)),
  };
}

/** Export a dungeon, terrain map or settlement to its `out/` folder (a file: beside it), or `out`. */
export function exportTilemapFiles(p: Project | null, kind: TilemapKind, ref: string | FileRef, o: TilemapFlags = {}): TilemapResult {
  const id = typeof ref === 'string' ? ref : fileStem(ref.file);
  if (o.cell !== undefined && kind !== 'map') throw new Error('--cell is for terrain maps (dungeons and settlements are one tile a cell)');
  let g: tilemap.TileGrid, file: string, dir: string;
  if (kind === 'dungeon') { g = tilemap.dungeonTiles(readDungeon(p, ref)); file = dungeonFile(p, ref); dir = typeof ref === 'string' ? join(dungeonsDir(p!), id, 'out') : dirname(file); }
  else if (kind === 'settlement') { g = tilemap.settlementTiles(readSettlement(p, ref)); file = settlementFile(p, ref); dir = typeof ref === 'string' ? join(settlementsDir(p!), id, 'out') : dirname(file); }
  else {
    const m = readMap(p, ref);
    if (o.cell !== undefined && !(o.cell > 0)) throw new Error('--cell: map units per cell, above 0');
    g = tilemap.mapTiles(m, map.generateMap(m), { cell: o.cell }); file = mapFile(p, ref); dir = typeof ref === 'string' ? join(mapsDir(p!), id, 'out') : dirname(file);
  }
  const pairs = parseTileBindings(o.tiles);
  if (pairs.length && !o.pack) throw new Error('--tiles needs --pack <pack.json>');
  const pk = o.pack ? loadPack(o.pack) : undefined, bindings = pairs.map(([c, a]) => bind(pk!, c, a));
  const to = editors(o.to);
  const r = tilemap.exportTilemap(g, { to, xml: o.xml, view: o.view, tile: o.tile, bindings, seed: o.seed, name: id });
  return summarise(p, g, r, write(o.out ?? dir, r.files));
}

/** A pack's tile asset as a tileset on its own: the tile sheet, a Tiled tileset (with its wang set) and map, an LDtk project, on an island of the tiles. */
export function exportTilesetFiles(o: { pack: string; asset: string; to?: TilemapFlags['to']; xml?: boolean; view?: string; size?: number; out?: string }): TilemapResult {
  const pk = loadPack(o.pack), b = bind(pk, o.asset, o.asset);
  const g = tilemap.tilesetTiles(o.asset, { id: o.asset, name: o.asset, color: '#808080' }, { size: o.size, island: !!b.autotile });
  const to = editors(o.to);
  const r = tilemap.exportTilemap(g, { to, xml: o.xml, view: o.view, bindings: [b], name: o.asset });
  return summarise(null, g, r, write(o.out ?? join(pk.dir, 'tilesets'), r.files));
}

/** The lines `artgen dungeon|map|settlement export` and `artgen tileset` print. */
export function tilemapText(r: TilemapResult): string {
  const counts = Object.entries(r.counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ');
  return [
    `${r.source} ${r.id} ${r.size.join('×')} ${r.grid === 'hex' ? 'hexes' : 'cells'}: ${r.view} view, ${r.orientation}, ${r.tile.join('×')} px tiles, ${r.tiles} in the tileset, ${r.objects} objects`,
    `  cells: ${counts || 'none'}`,
    ...r.bound.map(b => `  ${b.class} ← ${b.source}${b.autotile ? ` (${b.autotile})` : ''}${b.variants > 1 ? `, ${b.variants} variants` : ''}`),
    ...r.checks.map(c => `  ${c.id.padEnd(12)} ${c.status}  ${c.class}: ${c.detail}`),
    ...r.files.map(f => `  ${f}`),
  ].join('\n');
}
