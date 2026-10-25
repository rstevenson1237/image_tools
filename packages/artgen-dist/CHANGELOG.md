# artgen changelog

Releases of the committed install (`artgen-dist`), the MCP server, the runtime it vendors and the Python client.

## Unreleased

Reads: **map format 1**, **dungeon format 1**. `artgen formats --json` prints `{"map": 1, "dungeon": 1}`.

**File format versions** (`map.json`, `dungeon.json`)
- The `version` in the file is read, no longer overwritten. A file without one reads as 1; a file at an older version is
  migrated on read; a file at a newer version is refused, with an error naming both versions
  (`map is format version 2; this artgen reads map format 1 and older`).
- The rule is the animation contract's: additions (an optional field, an enum value) extend a format and keep its
  version, and a consumer ignores what it does not know. Removing or renaming a field, changing a field's meaning, unit
  or default, or making a field required is a break. A break bumps the version in the same change, with a migration
  from the previous version (`packages/artgen-core/src/format.ts`), the consumer fixtures migrated with it and a line
  here (`map format 1 -> 2: …`).
- `artgen formats [--json]` reports both versions. Every `--json` result of a `map` or `dungeon` command carries the
  `version` of its format. A result that was a bare list (`map list`, `map symbols`, `dungeon list`, `dungeon symbols`
  and the room, link, door, label, symbol, overlay and grid commands) is now `{ "version": 1, "items": [...] }`.

**Consumer fixtures** (`packages/artgen-cli/fixtures/<consumer>/<case>/`, run by `npm test -w artgen-cli`)
- `setting-builder/`: `warren` (a dungeon block: five rooms, an exit, two traps), `ravine` (a 1-mile gorge map at 10
  yards a square) and `keep` (thirteen buildings, hatching off). Each holds the file as the consumer's converter wrote
  it and a `case.md` with the consumer's commit, the exact command, the facts it must go on drawing and what it does
  not yet draw well. The tests parse each at the format version its `case.md` states, render it to SVG and PNG in each
  theme, check the render is the same twice, and check its facts. They check structure, never pixels.

**Map and dungeon engines usable alone** (for consumers that build maps and nothing else)
- **Path mode.** Every `map` and `dungeon` command takes `--file <path>` in place of an id and then needs no project.
  `new --file` creates the file (its id is the file name, `F.a.json` → `F-a`, unless one is given); renders go to
  `--out`, which defaults to the file's folder, named after the file (`F.a.json` → `F.a.svg`, or `F.a.color.svg` for a
  map). Ids keep working inside a project.
- **A whole file in one call.** A consumer writes the JSON itself at a format version `formats --json` reports, then
  calls `artgen dungeon check --file F.a.json --json`, `dungeon fit --file …` and `map render --file … --format svg`.
  `dungeon check` lists every error with its JSON path (`{"version", "file", "ok", "errors": [{"path", "message"}]}`)
  and exits 1 when there are any; a file that is not JSON, or at a newer version, is reported the same way. A room that
  is too small or off-grid is now reported per field (`rooms[4].w: at least 1 cell`, was `rooms[4]: x, y and w, h ≥ 1`).
  `map check` is below, with the map requirements (A2).
- **A maps-only bundle.** `maps/artgen-maps.js` holds `map`, `dungeon` and `formats` and nothing that loads the
  pixel-art pipeline: 169 KB (172,981 bytes), against 947 KB (969,759 bytes) for `tools/artgen/artgen.js`. It is built
  beside the full bundle and published on `artgen-dist` under `maps/`, with `VERSION`, `package.json` (keeps it ESM),
  `fonts/` and `resvg.wasm` as separate files. SVG renders without `resvg.wasm`; a PNG render without it fails, naming
  the missing file. Fonts are optional: without them SVG labels use the renderer's CSS font list and a PNG leaves the
  text out (with a note). `artgen-maps.js --version` prints the release and the commit it was built from
  (`0.10.0 (64198fc)`).
- **Installing it at a commit.** A consumer copies `maps/` from `artgen-dist` at a sha into its own `tools/artgen/` and
  commits it; nothing runs at install (`<sha>` is a commit of the `artgen-dist` branch; record it where artgen is pinned):

  ```sh
  git clone -q --filter=blob:none --no-checkout https://github.com/rstevenson1237/image_tools.git /tmp/artgen-dist-src
  git -C /tmp/artgen-dist-src checkout -q <sha> -- maps
  mkdir -p tools/artgen && cp -r /tmp/artgen-dist-src/maps/. tools/artgen/
  node tools/artgen/artgen-maps.js --version && node tools/artgen/artgen-maps.js formats --json
  ```

**Consumer fixtures** (add)
- `setting-builder/shrine-crypts` (M's crypt block written whole as `dungeon.json`, run through `fit`: five rooms, four
  joining corridors with a secret door at M.8, three labelled exits) and `bad-file` (`warren` with a corridor to a room
  that does not exist and a room 0 cells wide: `check` exits 1 naming `rooms[4].w` and `corridors[5].to.room`).
  `warren` also runs in path mode with no project.

**Crop and fit renders** (`map render`, `dungeon render`; for a consumer that prints a sheet whole and cuts maps from it)
- `--crop x,y,w,h` renders a window on the full sheet. The coordinates are map units (cells, for a dungeon), the same as
  `--at`; on a map, `--crop x,y,w,h cells` (written `…,46cells`) gives them in grid cells. The window is cut from the full
  render, so the terrain, rivers, roads, contours, symbols and labels inside it are the full sheet's own drawing,
  nothing is regenerated for it, and a label or symbol the window edge cuts is drawn clipped, not moved. A window
  past the sheet is cut to it; one wholly outside is an error.
- `--room id [--margin n]` on `dungeon render` crops round a room, its doors and the first `n` cells (default 2) of each
  corridor that leaves it. `id` is the room's id or its label's first word (`F.3` for `F.3 The Hall`). Repeat `--room`
  to crop round all of them (`--room A.9 --room A.13`). `--room` and `--crop` are exclusive.
- `--fit WxH[mm|px]` picks the `ppu` that fits the crop, or the whole map, in the box with its aspect kept (px when no
  unit). With `mm` the SVG's `width` and `height` are in millimetres (96 px to the inch), so one side is exactly the
  box's (`--fit 180x260mm` on the 16 x 184 ravine: 260 mm tall, 22.61 mm wide). `--fit` and `--ppu` are exclusive.
- Furniture follows the crop: the legend, scale bar, compass and title sit inside the window's frame, and the scale bar
  is sized to the window. Grid lines and grid coordinates, and room numbers, stay the full sheet's: a square on a region
  map has the name it has on the sheet.
- `--json` of a render adds `crop` (the window drawn, in map units; the whole sheet when none was given), `ppu` (the
  one used), and `svg` (`{width, height, unit}`, as written in the SVG); `size` stays the render in pixels. The SVG's
  `viewBox` is the window in sheet pixels, so a crop and the full render share coordinates. A render with none of the new
  flags is unchanged, byte for byte.
- Tests: `src/crop.test.ts` on the `ravine` (16 x 46 crop round E.2, `--fit 180x260mm` whole), `warren` (`--room F.3
  --margin 2`) and `keep-flat` (`--room A.9 --room A.13`) fixtures; a crop's sheet layers are compared with the full
  render's as SVG text.

**Facts read back from a map** (`artgen map facts`, `artgen dungeon facts`; both take `--file` or an id, and `--json`)
- `artgen map facts --file … [--at x,y …] [--area x,y,x,y,…] [--above river|lowest] [--radius n]`. For each `--at` point (map
  units, or a cell name such as `C4`): the terrain, the height in `topo.unit`, the slope (the gradient in `topo.unit` per
  `scale.unit`, and a band: flat, gentle, steep, cliff) and the nearest river and road with their distance. For each
  `--area` (a rectangle `x0,y0,x1,y1`, or an outline of three or more x,y pairs): the share of each terrain, the lowest
  and highest ground, and the rivers and roads that cross it with where each enters and leaves (null when it starts or
  ends inside). With neither: the rivers drawn by edits and the roads as point lists, the rivers the generator traced
  (`generatedRivers`) apart from them, the hilltops and hollows with their heights, and each terrain's share. `--above
  river` adds each point's height over the nearest river; `--above lowest` its height over the lowest ground within
  `--radius` (map units, default 5).
- `artgen dungeon facts --file …`: each room's box in cells and in the scale unit, its shape, number and doors; each
  corridor's ends, doors and length; each exit (a corridor end at a point) with its point and the nearest map edge; the
  overlapping room pairs with the cells they share; the rooms no corridor reaches.
- Positions are coordinates, never bearings; lengths and distances come in map units (`map`) and in the scale unit
  (`scale`). Every result carries `version` and a `rules` block with the numbers below.
- **Rounding, which is part of the format.** The same file gives byte-identical `--json`. Heights, and heights above a
  reference, are the nearest whole multiple of `topo.interval`. Terrain shares are whole percent, adding to exactly 100
  (largest remainder; a terrain that rounds to 0% is left out; equal shares go in the order of the terrain list).
  Positions, lengths and distances are rounded to 0.1 map unit, and a scale-unit value is that rounded value times
  `scale.perCell`, to 0.1. A change to any of these changes what a consumer reads, so it is a format change: it bumps
  the map or dungeon format version, with a line here.
- The thresholds are stated in the same way: a slope is the height change across a 1-unit window, as rise over run in one
  unit (`topo.unit` and `scale.unit` must both be lengths artgen knows: in, ft, yd, mi, m, km; otherwise the band is
  null), flat below 0.05, gentle below 0.2, steep below 0.6, cliff from there. A hilltop or hollow is a summit that
  stands at least 2 `topo.interval`s clear of the saddle that joins it to higher (or lower) ground; a hollow is on dry
  ground. A river or road is listed as a point list thinned to within 0.25 map unit of its line. `--above lowest` counts
  water as 0.
- A map's rivers now say where they came from (`source`: `generated` or `edit`) in the engine's field; nothing in
  `map.json` changes.

**Map requirements and `map check`** (artgen A2; `require` is an optional field, so map format 1 and its version are unchanged)
- `require` in `map.json`: a list of what the ground must be, each entry an `id` the consumer chooses (letters, digits, `-`,
  `.`, `_`; unique) and a `kind`:
  - `terrain`: `area` (a shape, as an edit takes it: `{circle}`, `{poly}` or `{stroke, width}`), a `terrain` and the `share`
    (0 to 1) of the area it needs: `{"id": "C-ground", "kind": "terrain", "area": {"poly": […]}, "terrain": "forest", "share": 0.8}`.
  - `height`: `area`, `low` and `high` in `topo.unit` above the waterline (`high` at most `topo.maxElevation`) and an
    optional `share` (default 0.9) of the area that must stand between them.
  - `path`: `path` `"stream"` or `"road"`, `points` (x,y pairs) and a `tolerance` in map units (default 1): every point
    must lie within it of the line. A stream may carry `width` and `delta`, as a `river` edit does.
  - `clear`: `area`, which no *generated* river may enter. The streams and roads the file asks for, and its edits, are the
    consumer's own and may cross it.
  - Every entry may carry `blend` (map units; default `gen.feature`), the distance outside its area over which it fades.
- **Generation shapes the ground to the requirements; it does not paint.** Nothing is overwritten after the readability pass.
  Each requirement is felt in full inside its area and fades over its `blend` outside it, with an edge that wanders on noise,
  so a wood has a wood's edge and not the polygon's. A `terrain` pulls moisture and height towards what the generator
  classifies as that terrain (forest: wet, low-lying; marsh: wettest and lowest; rock: high) and the generator classifies as it
  always did. A `height` raises or lowers the field before classification, so the contours follow: a rise has a crown, and a
  wall rises away from the way it faces. A terrain and a height over the same ground take the part of the terrain's band
  inside the height's; where they do not meet the stated height wins and the terrain is named unmet. A `stream` carves its
  valley (a bed that never climbs, walls rising over a few squares) and is a river with `source` `required`; a `road` is routed
  through its points on a least-cost path that prefers gentle slope and avoids water, and keeps to every point. Generated rivers
  stay out of every `clear` area (a river that would enter it ends short of it). `gen.rivers` is still a count, and at 0 only
  the streams the file requires exist.
- `artgen map check <id>|--file … [--json]` lists every requirement with what it measured and whether it is met, and exits 1
  when any is unmet or the file has format errors. A line is `id kind what measured op needed met|unmet`, for example
  `C-forest terrain forest 0.71 < 0.80 unmet` or `B-road-clear clear rivers 0.00 <= 0.00 met`. `--json` gives
  `{version, file, ok, errors: [{path, message}], requirements: [{id, kind, what, measured, needed, op, met, text}], unmet: [ids]}`;
  `measured` is null when there is nothing to measure (a path that was not drawn). A terrain share is read as `map facts` reads
  an area: whole percent of the samples inside it. A file with format errors, found as `dungeon check` finds them (each with its JSON path;
  not JSON; a newer version), is not generated from. A map with no `require` is `ok`.
- **Fixed by seed.** The same file gives the same field and the same answer; artgen never reseeds. A consumer that reseeds does so
  knowing which requirement failed. Where two requirements cannot both be had, the later one wins the ground and the earlier is named.
- A map with no `require` generates exactly as before (tested against the hashes of three maps from before this change).
- `map facts` lists a required stream with the drawn rivers (`features.rivers`), with `source` `required`.
- Cases: `frontier` (the Frontier at 200 yards a square, 106 x 141, nine requirements, all met at its seed; no generated river
  enters `B-road-clear`; C's forest edge has no run of more than 4 squares along a row or column), `frontier-unmet` (C also
  needs rock at 0.9: `check` exits 1 naming `C-ground` alone) and `ravine` rebuilt with `require` in place of the hand
  `paint`, `elevate` and `river` edits (rock walls of 30 to 40 ft, a stream up the path, `gen.rivers` 0; the walls'
  contours run along the gorge). The Frontier's areas were placed in artgen from the brief's outline: see its `case.md`.

**Symbols, and sizes against the page** (artgen A6, A7; every addition is optional, so map format 1 and dungeon format 1 and their versions are unchanged)
- New symbols, each in `map symbols` or `dungeon symbols`, drawn, and in the legend when used:
  - Map `cave-mouth`: an opening in a cliff line, facing its `angle`; and map `gate`: a break in a wall line. A map symbol gains
    `angle` (degrees clockwise from east, as a dungeon symbol's), and `map symbol --angle`.
  - Dungeon `stairs-up` and `stairs-down` (a wedge that widens the way it climbs, a solid arrow; a wedge that narrows the way it
    falls, dashed treads and an open arrow), each pointing its `angle`; `curtain`, along a room edge or across a passage; `dais`, a
    raised floor drawn by its outline; and `gate` (the map's), which a wall's gate uses. Plain `stairs` stays.
  - Legends: a map's legend lists `cave-mouth` and `gate` when used. A dungeon has a `legend` layer, off unless the file says
    `"legend": true` (`dungeon style --legend on`), listing every symbol the overlay uses; so a file that does not ask for it renders as before.
- **Page scale.** `map render` and `dungeon render` take `--page-scale <px per mm>`, and `--fit` sets it (the SVG is 96 px to the inch).
  Label sizes, symbol sizes and stroke widths are then set on the page, not by the square: place labels 9 pt, notes 7 pt, regions
  12 pt, water 8 pt; dungeon names 9 pt, notes 7 pt, areas 12 pt, room numbers 8 pt, room names 8 pt; symbols 5 mm. A label's `size` is a
  multiple of its kind's default, and a symbol's `scale` of 5 mm. Furniture (the legend, scale bar, compass, title) and the terrain's
  stroke widths follow the page too. Without a page scale sizes follow `ppu` as before and every existing file renders byte for byte as it did.
- **Labels kept off one another.** With a page scale, a label that would overlap another label, a symbol (or a room's badge and name, on a
  dungeon) moves to the nearest free side of its anchor (right, left, above, below, the diagonals, then further out), staying on the sheet.
  `--json` of a render adds `pageScale` and `unplaced` (`[{index, text}]`: the labels that found no free spot; they stay where they were).
- Cases: `ravine` (the cave mouths are `cave-mouth`, angled across the gorge; labels lost their half `size`), `frontier` (A is a `castle`),
  `shrine-crypts` (M.6 `stairs-up` toward M.2, M.13 `stairs-down` toward L.5), `keep` (A.10 has a `dais`).

**Underlay, walls, towers, gates and room fills** (artgen A5; `underlay`, `walls`, room `fill` and `legend` are optional fields in `dungeon.json`)
- `underlay`: `{ "map": "map.json", "origin": [x, y], "scale": 0.5 }` (+ optional `theme`: `color` default, or `bw`). `map` is a map file, its path
  from the dungeon file's folder; `origin` is the map unit at the dungeon's top-left corner and `scale` the map units in one cell (a 5 ft
  cell on a 10 ft sheet: 0.5). The render draws the map's terrain, rivers, contours and roads under the rooms, cropped to the dungeon's
  extent (and so cut by `--crop` like everything else); the map's own legend, title, compass, scale bar, grid, labels and symbols are off and the
  dungeon's are kept. The engine reads no files: `renderDungeonSvg` takes the parsed map as `underlay: { map }`, and the CLI reads it.
  `dungeon check` reports a map file that is not there. With `hatch: none` the underlay shows between the rooms, not white.
- `walls`: a list of `{ id?, rooms | poly, thickness?, inset?, towers?, gates? }`. A wall follows the convex hull of the footprints of
  `rooms` (ids) moved out by `inset` cells (default 1), or `poly` (x,y pairs) as given; `thickness` is in cells (default 1). `towers`:
  `{ shape: round|square, size?: 3, at?: "corners" | [vertex indices] }`. `gates`: `{ at: [x, y], kind: gate|postern, room?, width? }`: the
  point is snapped onto the wall; a `gate` (2 cells wide) has a tower each side, a `postern` (1 cell) none; the wall is cut at each and the
  `gate` symbol set into the cut, turned along the wall. New layer `enclosure`.
- Room `fill`: `floor` (as now, the default), `building` (roofed: a plain tone, a ridge, thin walls; layer `buildings`), `yard` (open ground:
  no walls, no fill, the underlay showing through) or `cellar` (a dashed outline drawn above everything else; layer `cellars`). Only `floor`
  rooms take the hatching and the grid. New layers: `underlay`, `buildings`, `enclosure`, `cellars`, `legend`.
- `dungeon facts` gains `walls` when the file has them: each wall's corners, towers (with where each stands and why), gates (point, wall angle,
  width, the room it opens into, its towers) and whether each room's footprint is inside it. Files without walls give the facts they gave.
- Cases: `keep` is now the upper level (A.1 to A.11: A.8 a yard, the rest buildings, an underlay of a 66 x 54 square map at 10 ft with a rise, a
  wood and a road to A.1, one wall with round towers at the corners, a gate at A.1 and a postern at A.2, and a dais); `keep-cellars` (A.12 and A.13 as
  cellars over the same underlay); and `keep-flat`, the first drawing of all thirteen rooms, kept as it was for its overlap and crop facts.
  The upper rooms were nudged by hand (A.4 one cell west) until setting_builder T4.6 sets each building's place with its footprint.

**Hand edits kept across regeneration** (artgen A8; `origin` is an optional string, so the format versions are unchanged)
- `origin` on every entry: a map's `edits`, `require`, labels and symbols; a dungeon's rooms, corridors, walls, labels and symbols. An entry
  with none is a hand entry. `--origin` on the per-change commands (`map edit`, `map label`, `map symbol`, `dungeon room add`, `link`, `label`,
  `symbol`).
- `artgen map sync <id>|--file target.json --from new.json --origin tables` and `artgen dungeon sync …`: every entry of that origin in the
  target is replaced by the entries of `new.json` (each of which must carry that origin, or the sync is refused); every other entry is kept,
  in order, after the generated ones, so a hand `elevate` still shapes ground made from requirements and a hand `x` is applied last.
  A room keeps its id across a sync when `new.json` gives the same id. A file with no `origin` anywhere is all hand entries, and a sync
  of an origin that is on neither side leaves it unchanged. `--json` is `{version, origin, lists: {name: {removed, added, kept}}, conflicts}`.
- **Conflicts are reported, never resolved silently** (exit 0; the report is the finding):
  - `dropped`: a kept entry (a corridor, a wall) that refers to a room the sync removed is dropped.
  - `overridden`: a hand edit to a field of a generated room. `room move` and `room set` on a room that has an origin record the fields in
    `hand` (`["x"]`); the sync keeps the table's value and reports the hand one (`entry`, `field`, `hand`, `table`). A hand value equal to
    the table's is not a conflict.
  - `inside-room`, `over-mark`: a hand label or symbol that now lies inside a room, or within 0.75 cell of another mark, where it did not
    before the sync.
- Cases: `ravine` (marks, road and requirements `origin: tables`, two hand `elevate`s that a sync keeps after them), `warren` (every entry
  `tables`, a hand `web` in F.3, F.4's `x` moved by hand) and `shrine-crypts` (a hand label that a resized M.8 covers).

**Dungeon maps: denser layouts, links, exits and checks** (every addition is an optional field, so dungeon format 1 and its version are unchanged)
- **Grid as size, dimension and sub-grid.** `artgen dungeon grid <id> --size 10 [--unit ft] [--sub on|off] [--show on|off]`
  (the shorthands `10`, `5`, `10+5` and `none` still work); MCP `dungeon_update` takes `grid_size`, `grid_unit`, `sub_grid`
  and `show_grid`; the Dungeon Map tool has three controls in place of the grid menu. The file still keeps `grid.size` in
  squares: a size must be a whole number of squares, and the sub-grid (a line at every square) needs a grid of two or more.
- **Drawing checks.** `artgen dungeon check` goes on past the file's own errors to what draws wrongly: a room outline that
  crosses itself or has no floor (errors), and rooms laid over each other, a room off the sheet, a corridor that runs
  through a room it does not join or across another corridor with no junction, a corridor that never leaves its room (so
  its door is not drawn), an exit that ends inside a room, a repeated bend or corner, a label or symbol off the sheet, a
  symbol under a room number and labels on labels (warnings). `--json` adds `warnings: [{path, message}]`; only errors
  make it exit 1. The commands that change rooms, corridors and marks print the first five warnings. MCP `dungeon_check`;
  the Dungeon Map tool lists them under **Problems**, and a click shows the room or place.
- **Links.** A label and a room may carry `href`: an `http(s)` address, a path relative to the map (`level-2.svg#M.14`)
  or an `#anchor`; any other scheme (`javascript:`, `data:`, `file:`) is refused. The SVG wraps the label, or the room's
  number and name, in a link; the PNG draws them as before. `dungeon label … --href URL`, `room add|set … --href URL`
  (`--href none` removes it); MCP `add_labels[].href`, `add_room`/`set_room` `href`; link fields in the Dungeon Map tool.
- **Furniture beside the map.** `furniture: {place: over|outside|auto, side?: bottom|right}` sets where the title, scale
  bar, compass and legend go: `over` the map in its corners (the default, as before), `outside` in a band below or right
  of the map, or `auto`: in the band only when its corner would cover a room, corridor, wall, badge or mark. The band
  wraps at the map's edge, the map gets a thin frame, and the render grows by the band (`render --json` reports the
  whole size; `--fit` fits map and band on the page). `dungeon style … --furniture outside [--furniture-side right]`;
  MCP `dungeon_update` `furniture`; a menu in the Dungeon Map tool.
- **Corridors.** A room end may name the wall it leaves by (`{room, side: n|e|s|w, offset?}`), so several corridors leave
  one room by different walls, each square to its wall (a Z or an L between two walls). An end may join another
  corridor (`{corridor: id, near?}`): a T or a cross on its centre line; corridors take an optional `id` for this, a
  ring of joins is refused, and `facts` reports `joins`. `route: around` runs along the grid round the rooms in the way.
  `curve: smooth` draws a curve through the ends and bends. `style: natural` draws a passage with rough, uneven walls
  (seeded by `seed`, else its id). `dungeon link … --from-side e --to-side n --route around --curve smooth --style
  natural --id main`, `link <id> corridor:main r3`; the same fields on MCP `link`; the Corridor tool meets rooms at the
  centre or the wall clicked, joins a corridor when one is clicked, and sets route, curve and walls. Removing a room or
  corridor removes the corridors that join it. Rooms and passages that overlap now always fill as one floor, whichever
  way their outlines run (an odd-shaped room drawn anticlockwise over another used to leave a hole).

**Limits**
- A map may be up to 200 squares a side (was 120), so a 1-mile gorge fits at 10 yards a square. Raising a limit
  extends map format 1: files that were valid stay valid.

## 0.10.0 — 2026-10-18

Two new map tools for tabletop RPGs, and the fixes from the first production run: 70 assets in megadungeon, 371
scored passes on 0.9.0.

**Terrain maps** (`/artgen-map`, `artgen map …`, MCP `map_*`, the image tools' **Terrain Map**)
- A regional hex-crawl map or a local battle map generated from a seed, shaped with ordered edits: paint terrain,
  raise and lower ground, rivers and roads. Topographic contours, shaded terrain (water, marsh, sand, desert,
  grassland, scrub, forest, rock, snow), a square or hex grid, labels and symbols, legend, scale bar and compass.
- Rivers are smooth water ribbons that widen from source to mouth, with a filled flare where they meet the water.
- Renders in colour and in black and white, as SVG and PNG. Label fonts (SIL OFL) ship in `tools/artgen/fonts/`.

**Dungeon maps** (`/artgen-dungeon`, `artgen dungeon …`, MCP `dungeon_*`, the image tools' **Dungeon Map**)
- One room (rectangle, circle, octagon, cave or any polygon, with exits) or a complex of rooms and corridors with doors
  (secret, locked, portcullis, arch), generated from a seed or laid out by hand.
- Black and white with hatched rock and thick walls, a 10 ft grid with an optional 5 ft sub-grid, room numbers, labels
  and symbols (stairs, pillars, statues, altars, chests, traps, pits, pools…). SVG and PNG.

**Production fixes**
- The final is the best version, not the newest. Approval and export used the last finish even when an earlier
  version scored higher; about 15 of 70 assets shipped below their best. Gate-passing versions come first, then the
  best blind score, then the best own score. `status` and the gallery show `final≠best` when a higher score lost.
- The analytics budget suggestion now reports a finishing pass that loses. It judged the last finish per asset and
  never counted finish regressions; it now uses the first finish (mean ≤ 0, or at least 30 % of assets regressed) and
  gives its share of the tokens. When every kind is under the minimum, the batch is judged as a whole.
- Heights fail. An upright character or creature more than 15 % off its brief height fails the gate
  (`review.heightFail`); props, low bodies and first-person billboards still only flag. The roster and the gate
  measure height the same way: the tallest frame of the first state.
- `feedback --by roster` (MCP `by: "roster"`) lets the agent start a revision from a roster note. It is recorded as
  the agent's (an `x` pass within `review.rosterRevisions`), never as the user's.

**New defaults** (in every project's config; a version the user already approved stays final, so updating reopens no
finished asset)
- `review.finish: "auto"`. The finishing pass runs only when the base's review names a finish-level problem
  (outline, banding, clusters, jaggies, stray pixels) or the base scores at least `approveMin`. In megadungeon it
  averaged −0.06, regressed 30 % of assets and used about a third of the tokens. `"always"` restores the old behaviour.
- The blind re-score chooses and gates the final. A blind miss gets its own revision budget
  (`review.blindRevisions: 1`), so a gate revision no longer uses it up.
- A roster after v1 (`review.earlyRoster`). `make` holds every v2 until each non-tile asset has a scored v1 and a
  `roster --stage v1` review is recorded; its notes go into each asset's v2 step. The final roster runs before the
  gallery (`make` names it).
- The gallery labels assets under `approveMin` **BELOW BAR**, and the skills ask about them separately at approval.
- The roster pages past 26 assets in one call (`roster-lineup-N.png`, labels AA, AB…).
- `review.sheetDetail: { "r1": "low" }`. A low-detail sheet shows the first facing at 3× beside the previous version
  only, for about half the image tokens. `review --detail low|full` overrides it.

**Briefs and templates**
- Material lint: `brief add` warns, and `brief lint` / MCP `brief_lint` list, materials a brief names that its kind's
  ramps leave out (a lute on a character without wood, steel on a creature without metal, lava on a tile without glow).
- An iso walker template (`iso/character-walk`). Iso characters no longer start from the top-down walker.
- Body rigs, top-down and iso: `--body quadruped | serpent | flyer | large`. Each has four facings, a walk, a `ground`
  anchor and face anchors for the face-first finish.

**Cost and robustness**
- Review tiers: `models.reviewEarly` (r1 and r2), `models.blind` and `models.roster`. The skills recommend a cheaper
  reviewer early and the strong model for revisions, blind scores and the roster. Analytics reports Δ per 1k tokens
  per tier.
- `score --agent-tokens-in <n>` (MCP `agent_tokens_in`) records the context each maker and reviewer read, and
  analytics counts it in the cost.
- `make --wave <n>` keeps only n assets in flight. A version that was written but never reviewed comes back as a
  `resume` maker packet, so a respawned maker continues it instead of starting over.
- `fix.jaggies` leaves an iso tile's 2:1 diamond rim alone.
- `review --scene`: the sprite at game zoom on the background, a floor, and in front of a wall.
- The image tools' project engine follows the same pass logic, so the web app and the CLI pick the same final.

## 0.9.0 — 2026-10-10

First tagged release, and the first build actually published to the `artgen-dist` branch (see the last entry).

- MCP server: the full tool set — `finish`, `make` (with the parallel round), `gallery`, `feedback`, `approve` (the
  user's call only: needs `user_approved`), `texture`, `fx`, `export`, `restyle`, `analytics` join the direction and
  pipeline tools; asset arguments take a brief id; `direction` takes a bench name; quick looks write under
  `art/sheets/`.
- Parallel make: `artgen make --parallel <n>` returns a round of maker packets (one subagent per asset, each owning its
  `art/assets/<kind>/<id>/`) and the main agent's review steps; new `art-maker` subagent; the asset-production skill
  and `/artgen-make` describe the rounds.
- Analytics v2: `artgen analytics --across <roots> [--apply]` pools ledgers across projects and recommends revision
  passes and image-token caps per kind, model/effort per stage, with evidence and confidence; `--apply` merges the
  config patch.
- New projects: `artgen init` writes per-kind revision passes from those recommendations (textures 2, props 4).
  Existing projects keep their config.
- Runtime 1.2.1: the three.js adapters keep translucent shadow pixels (alpha cut-out 0.5 → 0.02); `loadPack` warns when a
  pack carries unapproved drafts (`onDrafts`).
- Export: `assets.ts` prefixes pack URLs with Vite's `BASE_URL`, so games served from a sub-path (GitHub Pages) load.
- CLI: `--help` describes the tool and lists every command; unknown commands say so; `texture` / `fx` explain an
  unlocked direction.
- Skills and commands no longer cite the design docs; the `artgen` skill defines every rule number the others use.
- Python client (`python/artgen`): `Artgen(project).render / review / texture / fx / export / …` over the CLI's
  `--json`, returning dicts and Pillow images; quickstart notebook.
- Release automation: `scripts/artgen-release.mjs` (version bump in lockstep, changelog), the `artgen-release`
  workflow (tag `artgen-v<version>` → tests → `artgen-dist` branch + `artgen-dist-v<version>` tag → GitHub release),
  optional npm publish of the runtime.
- Fixed: the publish step failed on the first publish (no `artgen-dist` branch yet), so no earlier build ever reached
  the branch and `npx …#artgen-dist init` could not work until this release.

## Before 0.9.0 (untagged builds, never published)

- 0.8.0 — breadth: views, voxel raster/toon, normal maps, textures and tiles, effects and animation, first-person;
  runtime 1.2.0 (sub-frames, additive blend, lit billboards).
- 0.7.0 — the image tools' Art Direction / Asset Review / Asset Lab: skills explain their ledger lines and locks.
- 0.6.0 — independent review (blind re-scores, roster review, real-world heights, silhouettes); 0.6.1 — effect briefs
  name a drawable object.
- 0.5.0 — per-frame anchors in packs, frozen animation contracts, held frames, face-first character finish.
- 0.4.0 — the runtime: Pixi.js / three.js / Canvas 2D adapters, `export --runtime`.
- 0.3.0 — production: asset-production skill and commands.
- 0.2.0 — the committed install and the art direction workflow.
