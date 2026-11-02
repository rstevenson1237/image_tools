/**
 * One call from a tile grid to the files a game or editor opens (R7c, docs/TILEMAPS.md §7): the tile sheet PNG, the
 * Tiled map and tileset (JSON, or XML with `xml`), the LDtk project, and a preview of the map drawn from its tiles. No file system here: the CLI writes the files.
 */
import { encodePNG } from 'artgen-primitives/lib/png.ts';
import { VIEW_MAPS, tileShapeProblem } from 'artgen-primitives/lib/viewmap.ts';
import { classCounts, type PropValue, type TileGrid } from './grid.ts';
import { buildSheet, previewTiles, resolveTiles, type TileBinding, type TileSheet } from './tileset.ts';
import { tiledMap, tiledTileset, tmx, tsx, type TiledOrientation } from './tiled.ts';
import { ldtkProject } from './ldtk.ts';

export interface TilemapExportOptions {
  /** Which editors to write for (default both; Tiled alone for iso and hex maps, which LDtk cannot draw). */
  to?: ('tiled' | 'ldtk')[];
  /** Tiled as `.tmx` / `.tsx` instead of `.tmj` / `.tsj`. */
  xml?: boolean;
  /**
   * The camera the game draws the map with (a view module's id: topdown, iso, side…). It sets Tiled's orientation and
   * the tile shape, and the bound tiles must pass its `tile-shape` check. Default: the bound tiles' view, else topdown.
   * A hex terrain map is always hexagonal.
   */
  view?: string;
  /** Cell width in px when no binding sets it. */
  tile?: number;
  bindings?: TileBinding[];
  /** Seed for the variant pick (the runtime's `cellHash`). */
  seed?: number;
  /** Extra Tiled map properties (`view`…). */
  properties?: Record<string, PropValue>;
  /** File name stem (default the grid's id). */
  name?: string;
}

export interface TilemapFile { name: string; data: Uint8Array | string }
export interface TilemapExport {
  files: TilemapFile[];
  sheet: TileSheet;
  tiles: Int32Array;
  orientation: TiledOrientation;
  view: string;
  /** The view's `tile-shape` check on each bound tileset (they all pass, or the export throws). */
  checks: { id: 'tile-shape'; class: string; source: string; status: 'pass'; detail: string }[];
  counts: Record<string, number>;
}

/**
 * JSON as the editors write it: indented, but an array of numbers or strings, and an object or array of those, on one
 * line (a tile layer is one line, not one number a line).
 */
export function editorJson(v: unknown): string {
  const flat = (x: unknown): boolean => x === null || typeof x !== 'object' || ((Array.isArray(x) ? x : Object.values(x as object)).every(y => y === null || typeof y !== 'object'));
  const short = (x: unknown) => flat(x) || (Array.isArray(x) && x.every(y => flat(y) && JSON.stringify(y).length <= 80) && x.length <= 64);
  const out = (x: unknown, pad: string): string => {
    if (x === null || typeof x !== 'object' || short(x)) return JSON.stringify(x);
    const inner = pad + ' ';
    if (Array.isArray(x)) return x.length ? `[\n${x.map(y => inner + out(y, inner)).join(',\n')}\n${pad}]` : '[]';
    const e = Object.entries(x as object).filter(([, y]) => y !== undefined);
    return e.length ? `{\n${e.map(([k, y]) => `${inner}${JSON.stringify(k)}: ${out(y, inner)}`).join(',\n')}\n${pad}}` : '{}';
  };
  return `${out(v, '')}\n`;
}
const json = editorJson;

export function exportTilemap(g: TileGrid, o: TilemapExportOptions = {}): TilemapExport {
  const stem = o.name ?? g.id;
  const views = [...new Set((o.bindings ?? []).map(b => b.view))];
  if (!o.view && views.length > 1) throw new Error(`the bound tiles are drawn for different views (${views.join(', ')}): say which with --view`);
  const view = o.view ?? views[0] ?? 'topdown', vm = VIEW_MAPS[view];
  if (!vm) throw new Error(`no tile maps for the ${view} view (have: ${Object.keys(VIEW_MAPS).join(', ')})`);
  const checks: TilemapExport['checks'] = [];
  for (const b of o.bindings ?? []) {
    const problem = tileShapeProblem(view, b.size[0], b.size[1]);
    if (problem) throw new Error(`tile-shape: ${b.source} for ${b.class}: ${problem}`);
    checks.push({ id: 'tile-shape', class: b.class, source: b.source, status: 'pass', detail: `${b.size[0]}×${b.size[1]} px fits the ${view} cell` });
  }
  const orientation: TiledOrientation = g.grid === 'hex' ? 'hexagonal' : vm.tiled;
  // both editors by default, but only Tiled draws iso and hex maps
  const to = o.to ?? (orientation === 'orthogonal' ? ['tiled', 'ldtk'] : ['tiled']);
  if (g.grid === 'hex' && vm.tile !== 'square') throw new Error(`a hex map is drawn flat: it has no ${view} export`);
  if (to.includes('ldtk') && (orientation !== 'orthogonal' || !vm.ldtk)) throw new Error(`LDtk has square grids only: export the ${orientation} map with --to tiled`);
  const sheet = buildSheet(g, { name: `${stem}-tiles`, shape: orientation === 'isometric' ? 'diamond' : orientation === 'hexagonal' ? 'hex' : 'square', tile: o.tile, bindings: o.bindings });
  const tiles = resolveTiles(g, sheet, o.seed ?? 0), image = `${stem}-tiles.png`;
  const files: TilemapFile[] = [{ name: image, data: encodePNG(sheet.image) }, { name: `${stem}-preview.png`, data: encodePNG(previewTiles(g, sheet, tiles, '#1e1e24')) }];
  if (to.includes('tiled')) {
    const tsFile = `${stem}.${o.xml ? 'tsx' : 'tsj'}`;
    const map = tiledMap(g, sheet, { orientation, tilesetFile: tsFile, image, tiles, properties: { generator: 'artgen', view, ...o.properties } });
    const ts = tiledTileset(g, sheet, { image });
    files.push({ name: `${stem}.${o.xml ? 'tmx' : 'tmj'}`, data: o.xml ? tmx(map) : json(map) }, { name: tsFile, data: o.xml ? tsx(ts) : json(ts) });
  }
  if (to.includes('ldtk')) files.push({ name: `${stem}.ldtk`, data: json(ldtkProject(g, sheet, { image, tiles })) });
  return { files, sheet, tiles, orientation, view, checks, counts: classCounts(g) };
}
