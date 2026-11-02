# Map and camera exports (R7c)

Status: built, 2026-11-02 (§10 has what was built, where it differs from this design, and what is not done). This is
phase R7c of [`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§10): "Add Tiled and LDtk export for maps and tilesets. Each new camera
is a view module (projection, probe set, context view, check, runtime helper), the plug-in shape D8 already set."

## 1. Goal

The three map engines (terrain, dungeon, settlement) draw maps for people: SVG and PNG for a table or a VTT. A game needs
the same map as **cells** it can walk, collide with and draw with its own tiles, and a level designer wants to open it in
an editor. Tiled and LDtk are the two editors most 2D games read (§3 of the plan), each with an open, versioned format.

R7c adds:

- **tile grids**: each map file read as one class per cell (floor, wall, grass, road…) plus objects for its named things
  (rooms, doors, buildings, rivers, labels);
- **tilesets**: the cells drawn with the game's own tile assets from an exported pack (plain tiles with variants, or an
  autotile set resolved as the runtime resolves it), or with flat colours before there is art;
- **writers** for Tiled (`.tmj` / `.tsj`, or `.tmx` / `.tsx`; format 1.10) and LDtk (`.ldtk`, JSON 1.5.3), and a
  preview of the map drawn from its tiles;
- **commands**: `artgen dungeon|map|settlement export` and `artgen tileset` (a pack's tile asset on its own);
- **the view modules completed** to D8's shape: each view now names its probe templates, its own checks and how a map is
  laid out for it, and the free camera (R7a) becomes the seventh module.

**Accept (this phase).** Every map kind exports to both editors (Tiled alone where LDtk has no grid for it); the files
open in a third-party Tiled reader and validate against LDtk's published schema; each map drawn from its files alone
matches the export's preview pixel for pixel; an autotile set's Tiled wang set picks the same tile the export chose.
As for every phase: `npm run check`, `npm test`, `check:packages`, `test:packages`, the strict boundary lint, the bench
and the consumer fixtures stay green, and no existing output changes.

## 2. Decisions

1. **One path for every map.** The engines produce a `TileGrid` (§3); the tileset binding, both writers and the preview
   read only that. A fourth map kind needs only its classifier.
2. **Cells by the centre.** A cell takes the class of what covers its centre (terrain maps: the terrain most of its
   height-field samples have). No partial cells, no anti-aliasing: a tile map has one thing per cell.
3. **Walls are cells.** A dungeon's walls are every empty cell next to a floor (eight ways), so a tile game can collide
   with them. The walls rooms share run along cell edges, so they are objects (`walls` layer), not cells.
4. **Classes, not tiles, are the data.** Each tile carries its class (and `solid`) as Tiled properties and LDtk custom
   data, and LDtk gets an IntGrid of the classes too, so a game reads walls without knowing which art drew them.
5. **Flat tiles first.** With no art bound, each class is a flat tile in its own colour, so a game can load the map on
   day one (the placeholder idea of plan §8, stage 0).
6. **The runtime's rules.** An autotile resolves from the eight neighbours of the same class with the runtime's
   `wang16` / `blob47`; variants spread with its `cellHash`. Cells off the map count as the same class, so the map's
   border draws no edge. The bit maths moves to `artgen-primitives/lib/autobits.ts`; the runtime keeps its own copy
   (it imports nothing) and a test keeps the two equal.
7. **The view sets the camera.** A map is exported for a view module: Tiled `orthogonal` for top-down, oblique, stack,
   side and first-person; `isometric` (2:1 diamonds) for iso. A terrain map's hex grid is Tiled's staggered hexagons
   (flat-top, odd columns down, as `gridlines.ts` draws it). LDtk has square grids only, so iso and hex go to Tiled.
8. **Where the table lives.** The view → map layout table and the `tile-shape` check are in
   `artgen-primitives/lib/viewmap.ts`, and the view modules point at it. The maps-only bundle exports maps without the
   pixel pipeline (scene layer), and the strict boundary lint stays at 0.
9. **Stable output.** LDtk's `uid`s count up and its `iid`s are UUID-shaped hashes of the map's id and the thing's place,
   so the same map exports the same bytes.
10. **Editors' JSON.** Indented, with flat arrays (a tile layer) and small objects on one line, as the editors write it.

## 3. Tile grids (`artgen-mapgen/src/tilemap/grid.ts`)

```ts
interface TileGrid { source: 'dungeon' | 'map' | 'settlement' | 'tileset'; id; title?; format; cols; rows;
  cell: { size; unit }; grid: 'square' | 'hex'; classes: TileClass[]; cells: Uint8Array /* class + 1, 0 empty */; objects: TileObject[] }
interface TileClass { id; name; color; solid? }
interface TileObject { layer; type; name?; x; y; w?; h?; angle?; polygon?; polyline?; text?; props }   // cells
```

| Source | Classes | Objects (layer: types) |
|---|---|---|
| `dungeonTiles` | `floor` (rooms, corridors, buildings), `wall` (solid), `door` (the corridor cell a door opens on), `yard` | rooms: room (outline, id, number, label, fill); corridors: corridor; doors: door, opening; walls: wall (shared), curtain, tower, gate; exits: exit; labels; symbols |
| `mapTiles` | the ten terrains (`deep` and `rock` solid), in the colour theme's fills | water: river (width, mouth); roads: road; labels; symbols |
| `settlementTiles` | `ground`, `road`, `water`, `bridge`, `wall`, `building` (solid), and `area-<kind>` for each area kind it has | buildings: building (outline, id, kind, number, label, roof, stories); roads; water; walls: wall, tower, gate; areas; trees; props; labels; symbols |
| `tilesetTiles` | the one tile asset | none (an island for an autotile set, else the whole map) |

A terrain map's cell is its square grid's size, one map unit with no grid, or `--cell`; a hex grid gives one cell a hex.
Settlement priority, top first: building, wall (a gate's gap is road), bridge, road, water, area, ground.

## 4. Tilesets (`tileset.ts`)

- `bindTiles(class, pack, id, asset, atlases)` cuts a tile, tileset or texture asset out of its pack: the first state
  and facing, every param variant (palette swaps left out), in canonical autotile order (the asset's `map` honoured).
- `buildSheet(grid, { shape, tile, bindings })`: every bound tile, then a flat tile per unbound class, `columns` wide
  with no spacing. The cell is the bound tiles' width (all must match); iso cells are half as tall, hex cells
  `round(w·√3/2)`; a taller tile image (an iso block) sits on the cell's bottom, as Tiled draws it.
- `resolveTiles(grid, sheet, seed)`: the tile id per cell (§2.6).
- `previewTiles(grid, sheet, tiles)`: the map drawn from its tiles where Tiled draws them (rows top down; iso on the
  diamond lattice; hex columns ¾ of a tile apart, odd ones half a tile down).

## 5. Tiled (`tiled.ts`)

- **Map** (`.tmj`, or `.tmx` with CSV data): `ground` tile layer, then an object group per object layer in the grid's
  order. Map properties: `source`, `id`, `title`, `format`, `cellSize`, `cellUnit`, `generator`, `view`. Objects in
  pixels: orthogonal `cell × tile`; isometric in tile-height units on both axes (Tiled's iso object space); hexagonal at
  the staggered centres. Polygons and polylines relative to their first point; labels as centred text boxes; points as
  `point`. Hexagonal maps: `staggeraxis: x`, `staggerindex: odd`, `hexsidelength` half the tile.
- **Tileset** (`.tsj` / `.tsx`, its own file): the sheet image; each tile's `type` is its class, with properties
  `class`, `solid`, and `variant`, `autotile`, `index` or `placeholder` where they apply; `bind.<class>` names the pack
  asset; iso tilesets carry an isometric `grid`.
- **Wang sets.** An autotile binding becomes a wang set named after its class: `blob47` → `mixed` (edges and corners),
  `wang16` → `edge`. Colour 1 is the class, colour 2 the other ground. A tile's wang id lists its mask's bits clockwise
  from the top (Tiled's order is the runtime's: N, NE, E, SE, S, SW, W, NW), 1 where set, else 2; `edge` sets leave the
  corners 0. A blob47 tile's mask is reduced (a corner counts only with both its edges), so for every neighbourhood the
  exactly matching wang id is the runtime's tile.

## 6. LDtk (`ldtk.ts`)

One level, three layers, top first:

- `Objects` (Entities): an entity definition per object type, tagged with its layer, `hollow` rectangles; fields
  `name`, `text`, `angle`, one per property (typed by the values: Int, Float, Bool, else String), and for shapes
  `outline` (the exact points, in cells, as text) and `points` (`Array<Point>`, grid cells, drawn as a path). An
  instance sits at its shape's box.
- `Tiles`: the resolved tiles (`gridTiles`, `src` in the sheet).
- `Classes` (IntGrid): a value per class, named and coloured, `intGridCsv` = the grid's cells.

The tileset definition has the sheet, `tileGridSize`, and each tile's class (and `solid`, `variant`, `autotile`,
`index`, `placeholder`) as JSON custom data. Every field the 1.5.3 schema requires is written.

## 7. Export (`export.ts`, the CLI's `tilemap.ts`)

`exportTilemap(grid, { to, xml, view, tile, bindings, seed, name })` checks the view (§8), builds the sheet, resolves
the tiles and returns the files: `<id>-tiles.png`, `<id>-preview.png`, `<id>.tmj` + `<id>.tsj` (or `.tmx` + `.tsx`),
`<id>.ldtk`. Defaults: the view is the bound tiles' (all must agree), else `topdown`; both editors, or Tiled alone for an
iso or hex map. The CLI writes them to the map's `out/` folder (with `--file`, beside the file), reads `--pack` (a
`pack.json` or its folder) and decodes its atlases once.

## 8. Views (`artgen-scene/src/views/views.ts`)

`ViewModule` gains:

| Field | What it holds |
|---|---|
| `brief` | whether a brief may name the view (`free` is for meshes) |
| `probes` | the templates (`<view>/<kind>`) the probes and new assets start from; views without their own fall back to top-down's, as `findTemplate` does |
| `checks` | checks only this view's outputs get: `tile-shape` for the six sprite views, the mesh and skin checks (R7a, R7b) for `free` |
| `map` | `VIEW_MAPS[view]`: Tiled orientation, cell shape, whether LDtk can take it; none for `free` |
| `render3d` | now optional: `free` shows meshes, not a 3D-mode render |

**`free`** (new): perspective orbit camera; anchor `feet`; depth-buffer sort; runtime `GLTFLoader` (a static `.glb`
from `artgen mesh`), `voxelModel`, `riggedModel`; probe `fp/character-rigged`.

**`tile-shape`** (`tileShapeProblem(view, w, h)`): iso tiles are an even width and at least half as tall as wide (a
taller one is a block standing on its diamond); top-down, stack and first-person tiles are square; side and oblique
tiles at least as tall as wide (the front face hangs below the cell). An export refuses a binding that fails and lists
the passes.

## 9. Operations

| Operation | Module | Effect | What it does |
|---|---|---|---|
| `dungeon export <id>` | maps | render | a dungeon → Tiled and LDtk files, tile sheet, preview in `out/` |
| `map export <id>` | maps | render | a terrain map → the same (`--cell units`; a hex grid → Tiled hexagonal) |
| `settlement export <id>` | maps | render | a settlement's site → the same |
| `tileset <asset> --pack p` | maps | render | a pack's tile asset → a tileset for both editors, on a sample map (default `<pack>/tilesets/`) |

Shared options: `--to tiled|ldtk|both`, `--xml`, `--view`, `--file` (the three map commands), `--pack` + `--tiles
class=asset` (repeat or comma-separate), `--tile px`, `--seed`, `--out`. Not MCP tools: they write files for a game or an
editor. All four are in the maps-only bundle.

## 10. Built (2026-11-02)

- **Primitives:** `lib/autobits.ts` (the autotile bits, `neighbourMask`, `cellHash`; `artgen-scene/tex/autotile.ts`
  re-exports them, unchanged for its users) and `lib/viewmap.ts` (`VIEW_MAPS`, `tileShapeProblem`).
- **Scene:** `views/views.ts`: `brief`, `probes`, `checks`, `map` on every module; `render3d` optional; the `free` module.
- **Mapgen:** `tilemap/` (`grid.ts`, `tileset.ts`, `tiled.ts`, `ldtk.ts`, `export.ts`), exported as `tilemap`.
- **CLI:** `tilemap.ts` and `ops/maps-tilemap.ts`: 167 operations (four more); `OPERATIONS.md` and the Python client
  regenerated; the maps-only bundle's import list gains the two files.
- **Accept:** `npm run accept:tilemap` (`scripts/artgen-tilemap-accept.mjs`). In a scratch folder it makes a dungeon, a
  hex and a square terrain map, a village and a pack of the bench's blob47 grass and plank finals, and runs eight exports:
  flat; the grass autotile on the floor (JSON and XML); the iso-dungeon example's floor, iso; both terrain maps; the
  swamp-topdown example's mud and bog water on the village; the grass autotile alone. Then:
  - every `.tmj` and `.tmx` opens in pytiled-parser 2.2.9 with the reported orientation, size, tile size, tile count
    and layers (8 files);
  - every `.ldtk` validates against LDtk's JSON schema 1.5.3 (5 files, 0 errors);
  - every map redrawn from its Tiled files, and every level from its LDtk file, matches the preview pixel for pixel
    (12 drawings: orthogonal, isometric and hexagonal);
  - the blob47 wang set gives each of the 280 floor cells (and the 36 island cells) the tile it holds.

  All 27 checks pass. The Python readers install once into `node_modules/.cache/artgen-tilemap-accept`.
- **Skills:** `dungeon-map`, `terrain-map`, `settlement-map`: *For a game or a level editor*; the three map commands
  point at it; `artgen` `references/breadth.md`: tilesets for a level editor and the view modules. The three examples are
  reinstalled (skills, commands and manifests only).
- **Measured:**
  - Exports take about 1 s on the command line (startup is 0.7 s of it); a village with swamp tiles 1.6 s.
  - The 80×60 village: `.tmj` 57 KB, `.tsj` 4 KB, `.ldtk` 880 KB (4,800 tiles, 111 entities with their fields), sheet
    1 KB.
  - Bundles: `artgen-maps.js` 774 → 832 KB, `artgen.js` 1,858 → 1,919 KB, `artgen-mcp.js` 1,856 → 1,917 KB (every
    bundle holds every command's declaration).
- **Tests** (before → after):

  | Package | Tests |
  |---|---|
  | artgen-mapgen | 133 → 145 (the three classifiers, flat sheets in three shapes, autotile resolution, the preview, Tiled JSON and XML, iso and hex, wang ids against every mask, `tile-shape`, LDtk layers, ids, field types and stable bytes) |
  | artgen-cli | 352 → 358 (autotile bits against the runtime, the view modules' shape and probe templates on disk, the four commands on the bench's grass autotile: the runtime's tile in every floor cell, the same tiles in Tiled and LDtk, the errors) |

- **Guards:** the other tests, the bench golden hashes, the consumer fixtures, `check`, `check:packages` and the strict
  boundary lint pass; no map render, pack or runtime file changes.

**Where the build differs from the design above:**

- **The default editors.** The CLI first chose "Tiled only" for iso and hex maps itself; the engine now does it, so a
  library caller gets the same default.
- **`tile-shape` lets iso blocks through.** A square 32 px tile fits an iso cell: it is a block standing on its diamond,
  as the iso-dungeon walls are. Only tiles flatter than the diamond are refused.
- **The editors' JSON.** Plain indented JSON put each number of a tile layer on its own line (the village's `.ldtk` was
  1.3 MB); flat arrays and small objects now stay on one line.

**Not done here:**

- **LDtk auto-layer rules.** An autotile set goes to LDtk as resolved tiles and an IntGrid, not as rules, so LDtk does not
  re-tile when a cell is painted. Tiled's wang sets do re-tile.
- **Thin walls.** The walls touching rooms share are objects only; a tile game that needs them solid must add them.
- **Floor plans.** A settlement's building floors are not exported; `floorAsDungeon` makes a dungeon of one, which
  exports.
- **Iso and side-view tilesets beyond floors.** Walls with height, stairs and sloped tiles bind as plain tiles; there is no
  wall-face resolution (a north wall drawn differently from a west one).
- **A game loading the exports.** The examples still build their maps in code; none reads a `.tmj` or `.ldtk` yet.
- **R7's matrix accept.** "Every cell in §8's matrix has a template and one bench asset at or above the approval bar"
  still needs templates of their own for the oblique, stack and side views (they start from top-down's, see `probes`),
  bench assets for each cell, and blind-scored bench runs.
- **Elsewhere.** No web UI for the exports. Tiled itself and LDtk itself were not run (the sandbox has neither); the
  checks above use a third-party reader and LDtk's own schema.
