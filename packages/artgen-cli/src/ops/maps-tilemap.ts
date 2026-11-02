/**
 * The tile map exports (R7c, docs/TILEMAPS.md §8): `artgen dungeon|map|settlement export` (Tiled and LDtk files for a
 * game or a level editor) and `artgen tileset` (a pack's tile asset as a tileset on its own). The work is in
 * `../tilemap.ts` and `artgen-mapgen/tilemap`. They write files for the game, so they are command-line operations.
 */
import { exportTilemapFiles, exportTilesetFiles, tilemapText, type TilemapKind } from '../tilemap.ts';
import { idParam, pathParam, projectOf, refOf, type Inp } from './maps-shared.ts';
import { defineOp, p, type Param } from './registry.ts';

const VIEWS = 'topdown, oblique, iso, stack, side or fp: Tiled\'s orientation and the tile shape (default: the bound tiles\' view, else topdown)';
const MCP = { exclude: 'writes map files for a game or a level editor; run from the CLI' };
const shared = (): Record<string, Param> => ({
  to: p.oneOf(['tiled', 'ldtk', 'both'], 'which editor: tiled, ldtk or both (default both; Tiled only for iso and hex maps)', { error: 'tiled, ldtk or both' }),
  xml: p.bool('Tiled as .tmx / .tsx (default .tmj / .tsj)'),
  view: p.str(VIEWS),
});

function exportOp(kind: TilemapKind, what: string, extra: Record<string, Param> = {}, usage: string, about: string) {
  return defineOp({
    name: `${kind}.export`, module: 'maps', effect: 'render',
    summary: `Export a ${what} as a tile map for Tiled (.tmj / .tmx) and LDtk (.ldtk): a class per cell, tiles from a pack or flat colours, objects for its named things.`,
    description: about,
    params: {
      id: idParam(`the ${what} id`, `${kind} export: <id>`), path: pathParam(kind), ...shared(),
      pack: p.str('an exported pack (its pack.json or folder) to take tiles from'),
      tiles: { kind: 'string', doc: 'class=asset: draw a class with a tile asset of the pack (a tile, a tileset with an autotile layout, or a texture); repeat or comma-separate', repeat: true } as Param,
      tile: p.int('cell width in px when no tiles are bound (default 16; iso 32)'), seed: p.int('seed of the variant pick (the runtime\'s cellHash)'),
      ...extra, out: p.str('the folder to write into (default the map\'s out/, or beside --file)'),
    },
    run: (i: Inp, ctx) => exportTilemapFiles(projectOf(i, ctx), kind, refOf(i), { to: i.to, xml: i.xml, view: i.view, tile: i.tile, pack: i.pack, tiles: i.tiles, seed: i.seed, cell: i.cell, out: i.out }),
    cli: { usage, text: r => tilemapText(r) },
    mcp: MCP, python: {},
  });
}

const dungeonExport = exportOp('dungeon', 'dungeon', {},
  '       artgen dungeon export <id> [--to tiled|ldtk|both] [--xml] [--view topdown|iso|…] [--pack pack.json --tiles floor=…,wall=…] [--tile px] [--seed n] [--out dir]',
  'A dungeon as a tile map: floor, wall (every empty cell next to a floor), door and yard cells; rooms, corridors, doors, shared walls, exits, labels and symbols as objects.');
const mapExport = exportOp('map', 'terrain map', { cell: p.num('map units per cell (default: the square grid\'s size, the hex grid, or 1)') },
  '       artgen map export <id> [--to tiled|ldtk|both] [--xml] [--cell units] [--pack pack.json --tiles grass=…] [--tile px] [--out dir]   (a hex grid exports hexagonal, to Tiled)',
  'A terrain map as a tile map: the terrain most of each cell has (a hex grid exports as Tiled\'s staggered hexagons); rivers, roads, labels and symbols as objects.');
const settlementExport = exportOp('settlement', 'settlement', {},
  '       artgen settlement export <id> [--to tiled|ldtk|both] [--xml] [--view …] [--pack pack.json --tiles ground=…,road=…] [--tile px] [--out dir]',
  'A settlement\'s site as a tile map: ground, area, water, road, bridge, wall and building cells; buildings, roads, water, walls, towers, gates, trees and props as objects.');

const tileset = defineOp({
  name: 'tileset', module: 'maps', effect: 'render',
  summary: 'Export a tile asset of a pack as a tileset for Tiled (with a wang set for an autotile layout) and LDtk, with a sample map of it.',
  params: {
    asset: p.str('the tile, tileset or texture asset in the pack', { positional: true, required: 'tileset: <asset> --pack <pack.json>' }),
    pack: p.str('the exported pack (its pack.json or folder)', { required: 'tileset: --pack <pack.json> (an exported pack)' }), ...shared(),
    size: p.int('the sample map\'s side in cells (default 10)'), out: p.str('the folder to write into (default <pack folder>/tilesets)'),
  },
  run: (i: Inp) => exportTilesetFiles({ pack: i.pack, asset: i.asset, to: i.to, xml: i.xml, view: i.view, size: i.size, out: i.out }),
  cli: {
    usage: '       artgen tileset <asset> --pack pack.json [--to tiled|ldtk|both] [--xml] [--view …] [--size n] [--out dir]   (a pack\'s tile asset as a Tiled / LDtk tileset)',
    text: r => tilemapText(r),
  },
  mcp: MCP, python: {},
});

export const TILEMAP_OPS = [dungeonExport, mapExport, settlementExport, tileset];
