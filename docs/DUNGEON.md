# Dungeon files: a reference

A dungeon is one JSON file (`dungeon.json`, or any path given with `--file`), format 2. This page says how each part is
drawn, with the formulas a consumer would otherwise find by experiment. The list of every key is generated at the end
from the schema (`artgen schema dungeon`, `--keys` for the list in the terminal). Check a file with
`artgen dungeon check --file F --json`; read it back as numbers with `artgen dungeon facts --file F --json`.

## Units and directions

- **Cells.** Every position and size is in cells: x to the right, y down, the sheet from `0,0` to `cols,rows`. A room's `x, y`
  is its box's top-left corner. `scale.perCell` is how many scale units (`scale.unit`, ft by default) one cell is: 5 ft.
- **Angles** of symbols, labels and doors: degrees, 0 east, clockwise on the page (90 is south).
- **Bearings** in a layout graph (`ways[].bearing`, `ways[].wall`) and a maze corridor's named wall: degrees clockwise from
  north, as a compass reads (90 is east).
- A **corridor's width** is in cells (`width`, default 1), or in the scale unit (`span: 10` for a 10 ft passage).

## Rooms

| Shape | Outline |
|---|---|
| `rect` | the box |
| `circle` | the box's ellipse, drawn as 64 straight sides |
| `octagon` | the box with its corners cut by `cut × min(w, h)` cells when `cut` is set (`1 / (2 + √2)` ≈ 0.293 makes a square box a regular octagon); unset, `max(0.5, round(0.3 × min(w, h) × 2) / 2)`, which moves with the cell size |
| `hexagon` | `orient: flat` (the default): flat north and south walls, points east and west at the box's middle, the flat walls `w / 4` in from the corners; `pointy`: the same turned, points north and south |
| `cave` | a seeded wobbly ring inside the box (`seed`, default from the id) |
| `poly` | `points`, x,y pairs in cells, in either winding; `x, y, w, h` are then its box |

A room's **anchor** is where its `{room}` corridors start and its badge sits: `anchor` when set, else the box's centre, or for
a poly the half-cell point deepest inside it (clear of the walls by up to 1.5 cells, nearest the box's centre). In an L-shaped
room that point lies in one arm: a corridor to the other arm should start at a **port** (below).

Its **label** (badge and name) stands at the anchor. Where it would lie on a symbol or another room's label it moves to the
first clear spot inside the room by its north, south, west or east wall. `labelAt` holds it by a wall (`"n"`), at the anchor
(`"c"`) or at `[dx, dy]` cells from it. A label with no clear spot is in a render's `--json` `unplaced` and `check` warns.

```json
{ "id": "G-3", "shape": "rect", "x": 10, "y": 4, "w": 2, "h": 4, "label": "G.3", "labelAt": "s",
  "exits": [{ "kind": "stairs-down", "side": "n", "text": "Down to H.1" }] }
```

`exits` are ways out of the map inside a room: the mark a cell in from the wall (at most a third of the room's depth),
turned toward it, and its note on the room's side of it; or at `at`. The note is kept on the room's floor: centred on its mark,
moved off the walls, and broken into lines where the room is narrower than it, and the mark and its note move together to stay
inside the room's height. Exits on one wall share it: each gets its own stretch (a north or south wall's width divided between
them; on an east or west wall each mark and note sit together in a stretch of the height), so two exits never fall on one point.
An exit placed with `at` stays where it is; `check` reports a note that still runs over a wall (`note-off-floor`) and marks drawn
on each other (`marks-overlap`).

**Numbers.** `rooms[].number` is a number, a **key** such as `15a` or `G.3` (shown as written, without a space; it takes no
place in the numbering of the rooms after it), or `false`. `style.numbers: "plain"` draws them as bold numerals on the floor,
with no badge.

**Thin shapes.** A `poly` room takes its box from its points, however thin (a ring or an arc is not stretched to a cell); `rect`,
`circle` and the other shapes still need a cell. `check` reports `no-floor` as an error only for an outline with no area at all,
and as a warning for one under half a square cell: a stroke with no floor is what `rings` (below) are for. A corridor may be 0.2
wide (a `maze` corridor needs 0.5).

**Edging.** `edge: "wavy"` draws a wavy line just inside the room's walls (a curtain, drapery, a rubble margin), on all of them
or on the sides in `edgeSides` (`["n", "w"]`: the walls that face north and west; a round room's quarters count the same way).

## Corridors

A corridor runs between two **ends** along its **centre line**, its floor the line stroked to its width, square at the ends
and mitred at the bends.

| End | Where the line starts |
|---|---|
| `{ "room": "a" }` | the room's anchor |
| `{ "room": "a", "side": "e", "offset": 3 }` | inside the room, on the anchor's row (for `e`/`w`) or column (`n`/`s`), `offset` cells from the room's top (for `e`/`w`) or left edge, then straight out through that wall. With no `offset`, the anchor's row or column snapped to the corridor: the middle of a cell for an odd width (`floor(v) + 0.5`), a grid line for an even one (`round(v)`) |
| `{ "room": "a", "port": [4, 9.5] }` | that point on the room's wall (moved onto the outline when it is off it); the room stays the corridor's end |
| `{ "at": [30, 5] }` | a point: a dead end, or past the sheet's edge, the way off the map (`exit` fades it out under a note) |
| `{ "corridor": "main" }` | the point of that corridor's centre line nearest the other end: a junction. With `"near": [x, y]` the point nearest that instead |

Three things about ends that are easy to miss:

- A **point end is square**: the floor reaches half the corridor's width past the point (a width-2 corridor ending at `[14, 12]`
  has floor out to x=15), so ending two stretches one cell apart closes the gap between them. A point exactly on a room's
  wall counts as inside it (`end-in-room`): end it 0.1 cell outside.
- `offset` is where the **centre line** crosses the wall. A width-2 corridor with `offset: 5` on a room at x=28 is centred on
  x=33 and its floor runs from 32 to 34. `check` reports a corridor whose centre line starts more than half a cell from the
  offset given (`offset-moved`).
- Several ends that leave **one wall with no `offset`** are spread along it, in the order of where each goes, rather than all
  set at its middle (where their floors and doors would meet). An end with an `offset` keeps it.
- A `{room}` end with `via` leaves the room **square on**: from the room's centre line level with the first bend (across, or
  down, whichever the bend lies further along), where the corridor's width fits on the floor there; not on a slant from the
  anchor. A room's own `anchor`, or a bend already square to it, keeps the anchor.
- A **junction** is chosen by distance, so on a corridor that bends (a U) it can be a corner or an end, not the middle of a
  run. `check` says so (`junction-at-bend`) and `through-room` names the junction when the corridor that runs through a
  room starts at one: give `near`, the point on that corridor to meet nearest (`dungeon link … --from-near x,y`).

Between the ends: `via` (bends, exact), else `route`: `auto` (straight where the rooms line up and the run starts inside both,
else an elbow whose bend is clear of other rooms), `hv`, `vh`, `straight`, `around` (on the grid, round the rooms in the way),
or `maze` (below).

A **door** stands where the line leaves its room, set along the wall there: square to the wall (a circle's own curve, else
the outline's edge), whatever angle the line arrives at. Its width is the corridor's. `double` is two leaves across the
width (a 2-wide passage gets two squares side by side).

`midDoors` puts doors in the run itself, not at a room's wall: `{ "at": 9, "kind": "double" }` is 9 cells along the centre line
from the corridor's start, `{ "at": [13.1, 9], "kind": "door" }` the nearest point on it to that point. The door is set square
to the run. A door in the run is not reported by `door-off-wall`; `facts` lists it with `on: "open"`. `style.doors: "square"`
draws every door as a square with a jamb each side, in place of the thin bar.

## Walls between floors

`style.sharedWalls` (format 2): `true`, the default, draws a wall wherever two units' floors touch along a line (room and
room, room and corridor, corridor and corridor), with no wall where one floor runs into another (a corridor into its room,
two corridors sharing cells) or at a connection's opening. `"rooms"` draws them between rooms only (what format 1's `true`
was); `false` draws none, so floors that touch run together. `style.partition` sets their weight apart from the outer walls.

One wall can differ from the rest: a connection's `weight` (0.2..4, a factor like `style.partition`) draws the whole wall its two
rooms share thinner or heavier, and its `line` is `solid` (default), `dashed` (an illusory or invisible wall; the opening stays
cut out) or `none` (no wall: the floors run together). A room's `partition` does the same for every wall it shares with another
room (the thinner where two rooms set one; a connection's weight wins over both).

A **connection** is a door or an opening in the wall two touching rooms share: `at` a point on it (default: the middle of its
longest stretch, on the grid for the opening's width), `width` cells, `kind` a door or `open`.

```json
{ "a": "G-4", "b": "G-5", "kind": "arch", "at": [14, 8] }
```

## Maze corridors and layouts

`route: "maze"` routes a corridor between two rooms on a lattice as wide as the corridor: round the rooms, off the other
corridors, inside `bounds` and off `areas`, leaving by its `side`, near its `port`, or by the door nearest the other room. Maze
corridors are routed in file order, each seeing those before it. Corridors from one room may join and part but never run beside
each other, and `check` treats their meeting as a junction. With walls drawn along corridors a passage may run against a wall;
otherwise (`maze.clearance: 1`) it keeps a lattice cell off every wall but at its own doors.

`artgen dungeon layout --graph g.json` lays a whole level out: the rooms packed in the footprint and every way a connection or
a routed corridor (with ports and its bends written out, so the file draws without routing again). The graph's keys are listed
below; an example:

```json
{ "id": "G-a", "width": 2, "footprint": 50, "fill": [0.35, 0.55], "passages": 0.35, "detour": 20, "seed": 1,
  "rooms": [{ "id": "G.1", "w": 2, "h": 4 }, { "id": "G.2", "w": 8, "h": 8, "shape": "round" }, { "id": "G.3", "w": 6, "h": 4, "turns": true }],
  "ways": [{ "a": "G.1", "b": "G.2", "doors": ["door", null] }, { "a": "G.2", "b": "G.3", "bearing": 90 }] }
```

What a level designed elsewhere (setting_builder's `design.py`) can hand the layout:

- **Spacing.** `pad` (the graph's, or a room's own) keeps that many cells clear round each room in the packing, rounded up to
  the lattice: joined rooms stand at least twice that apart, so every way is a passage long enough for a door at each end. A
  room with `pad: 0` may still touch its neighbours (a dense core). `passages` and `fill` alone do not spread the rooms.
- **Frames.** `over`, `at`, `via` and `keepOut` are given in the graph's frame. `origin` says where the footprint's top-left
  lies in that frame, so places read off another level or a table go in as they are. With no footprint and a room pinned
  (`over`) or placed (`at`), the square is centred on those rooms; the report's `origin` says where it fell. A polygon
  footprint's frame is its own points.
- **Places and routes as given.** A room with `at` (its box's top-left, on the lattice) is not moved; a way between two such
  rooms with `via` (its bends) is drawn as given, not routed, and other passages keep off it. A file whose rooms all stand `at`
  a place and whose ways all have `via` is written as it is.
- **Rules, not hints.** `hold: true` keeps a way's `bearing` ten times as hard, and a packing where it strays past 45° ranks
  below one that keeps it (the report's `held` lists strays). `lines` keep rooms' centres on one row (`ew`) or column (`ns`).
- **Caves** are routed to their drawn outline, so their doors stand on the wall the map shows, and their ways are passages.
- **Spokes.** Passages from one room join and run together by default; `spokes: true` keeps them apart where it can, so a hub
  reads as spokes. `check` reports passages from one room that cross or share a run (`passages-tangle`).
- **What a table cannot say.** A room's `draw` is written into its entry as given (`number`, `fill`, `edge`, `edgeSides`,
  `partition`, `labelAt`, `exits`, `orient`, `cut`, `seed`, `href`); its `symbols` stand at `dx, dy` cells from its centre; a
  `ring` circles it. A way's `draw` carries a passage's `curve`, `seed`, `midDoors` and `id`, or a shared wall's `weight`, `line`
  and opening `width`. The graph's `style` and `legend` go to the file.
- **When nothing routes.** `partial: true` writes the packing that routes the most ways and lists the rest in the report's
  `left`, instead of failing.
- **The report** gives the side, the fill, the tries that routed every way (`routed`), each room's place in the graph's frame
  (`places`: the corner, which is whole on the lattice, and the centre, which is a half cell for an odd size), the median and
  least gap between joined rooms (`gaps`), and the strays, detours and ways left.

`--seeds n` lays the graph out from n seeds (the seed and those after it), scores each and writes the best (`--keep k` writes
the next best too, as `<id>-2`, …; `--sheet s.png` draws a contact sheet of them). A score starts at 100 and loses points for
what `check` finds (a stacked door or one off its wall 8, floor outside the bounds 12, passages that cross or run together 6,
any other warning 2, an error 15) and for each way left (15), held bearing strayed (8) and detour past its limit (4).
`dungeon.layoutCandidates`, `scoreLayout` and `contactSheetSvg` are the same in code.

## Layouts and designs

A **layout** is a design pattern (`artgen schema layout`): parts with roles, each one room or a count of them (a number or a
parameter), sizes in cells (a number, a `[least, most]` range, or `$param`, `$param*k`, `$param*k+c`), where a part stands
(`at` a side of another part; `touch` sets it against it; `hold` keeps the bearing as a rule), ties between parts (`passage`,
or `door` through a shared wall; a tie of a part to itself chains its rooms, `side` or `sides` giving each step's bearing),
**sockets** where it joins something else (a part, a bearing, a width), and constraints (`line`, `mirror`). A `rigid` layout
places every part exactly (`place`) and moves as one block. `artgen dungeon layouts` lists the bundled ones (`cell-row`,
`spine-ring-hub`, `axis-of-halls`, `suite`, `secret-bypass`, `stair-vestibule`, `gatehouse`) and the project's
(`art/dungeons/layouts/<id>.json`; `--layouts dir` for a repo with no `art/`).

A **design** (`artgen schema design`) uses layouts, names the rooms each role holds (`bind`: ids, or rooms with what they set),
adds rooms and ways of its own, and **joins** sockets (`use.socket`) to sockets or rooms; any graph setting goes in it too.
`artgen dungeon design --design d.json [--out graph.json]` expands it to a graph and reports the rooms each use made, the
sockets left open and the rooms grown; `artgen dungeon layout --design d.json` lays it out directly (with `--seeds`). What the
expansion does:

- Joined sockets must face one another (within 45°) and match in width; a join leaves each socket's room by its wall
  (`wall`, `wallB`) and keeps its bearing as a rule.
- A room whose walls are short for the ways that leave it grows a passage's width at a time (a ring hub with eight passages),
  unless its part says `grow: false`; the report names it.
- A part of several rooms on one side of another stands in a row along it (a line); its ties carry no bearing from the other's
  centre, which would pull the row's ends off the wall they share. A `mirror` pairs its rooms with another part's.
- Rooms no binding names are placeholders, drawn unlabelled (`<use>.<role>` or `<use>.<role>.<n>`): bind them to name them.
- Rooms joined by a door through a shared wall (`run: wall`) or set against each other keep no `pad`.

`artgen dungeon extract <id> --rooms a,b,c --name x` makes a layout from rooms of a drawn dungeon: one part per room, its size
a range round the drawn one (`--spread`, default 0.25; `--rigid` keeps sizes and places exactly), ties from its connections
and corridors, each room's side of the one before it, and a socket for every way out. Only topology and proportions are
kept, with `source`; add patterns only from maps the user owns or may study.

## Laying a level out from the bottom up

`artgen dungeon layout --design d.json --nested` lays a design out from the bottom up, which holds where a level of 25 rooms
or more packed at once does not route. Top down, the design is a tree: the level, its thematic **blocks** (`blocks: [{id,
uses, rooms, blocks}]`), each block's layouts, each layout's rooms. A room in no layout joins the layout beside it that it
shares most ways with, in the level and in each block. Bottom up:

1. **Each layout alone**, small and fast. A way that leaves it gets a stand-in room beyond it, so the room it leaves from is
   kept at the edge; a layout whose room is walled in (no way out of the piece) is laid out again from other seeds. The layout
   becomes a **piece**: the box round its rooms, its passages and its ways out.
2. **Each block, then the level**, packs its pieces as boxes with a gap between them, each piece turned or mirrored to face its
   ways out at the pieces they join. Every room is then placed exactly where its piece put it, each piece's passages are kept
   as drawn, and only the ways between pieces are routed: again with the stuck ways first, and then letting a way cross
   another as a crossroads (`crossings`) where it finds no other.
3. **Growing.** Where a way between pieces finds no passage, the gap grows a lattice cell (three packings at each gap); where it
   still does not, the layouts that hold its rooms are laid out again and the level is packed again (twice at most). The size
   of everything comes out of the rooms; `footprint` only bounds the first packing of the level.

The report names every step (`layout`, `block`, `level`) with its rooms, its size, the gap its pieces stand apart and the ways it
left; `--seeds n` runs the whole tree from n seeds and keeps the best score. On setting_builder's 29-room level G (33 ways), every
way routed on 12 seeds of 12, about 17 s a seed, against 2 or 3 of 12 packed at once.

## Tracing a drawn map

`artgen dungeon trace --file draft.json --image map.png` is the measuring half of tracing: it reads the grid's pitch and phase
from the gridlines (thin dark lines across open floor; square cells, fitted on both axes, unless `--pitch px[,py]` and
`--origin x,y` give them), the floor cells (light, nearly unmarked; light cells joined to the image's edge are blank paper),
the walls between floor cells, and the rooms as rectangles of whole cells that cross no wall (`--min-room 3` leaves 10 ft
passages on a 5 ft grid out of them). It writes a draft and reports the grid, its clarity, the floor and the share of it the
rooms cover. Doors, symbols, labels and other shapes are left to finish; the pitch is the finest gridline it can see (a faint
sub-grid at a small scale may read as every second cell: give `--pitch`), and light lines on a dark floor are not read.

## Ground

`bounds` is the level's outline: the rock and the grid are drawn inside it and its edge is drawn. `areas` are rock (drawn as
rock) and voids (open paper, a dashed edge) within it; a floor on either, or outside the bounds, is a `check` warning.
`style.rock` draws the rock as hatching (`hatch`, the default, as `style.hatch` says), a solid `rockColor`, or not at all.

`rings` are lines drawn over the rock with no floor: `{ "shape": "circle", "at": [11.5, 11.5], "r": 4.4 }` or a `poly` through
`points`, dashed by default (`dash: [dash, gap]` cells), `width` 0.12 cells. They are not rooms, so they have no walls, no floor and
no `check` findings; `fit` moves them with the rooms.

## Look: colours, presets, symbols

The output is black on white unless the file says otherwise. `style.palette` sets `rock` (solid rock, and the hatching's
strokes; in place of `rockColor`), `floor`, `ink` (doors, symbols, labels; the walls too unless `wall` is set), `grid`, `wall`,
`partition` (the walls between touching floors: by default the wall colour, or the ink where the walls take the rock's colour,
so they stay visible) and `paper` (what the title, scale bar and legend stand on), each `#rrggbb`. A grid colour is drawn as
given; the default grid is the ink at a low opacity. The paper is white, unless the ink is light: then it is the rock's colour
(or black), so the band beside the map can be read. A legend of many symbols runs in columns, no taller than about a third of
the map.

`style.preset` is a named look that fills the style and grid settings the file leaves unset (the file's own always win):
`dark` (solid dark rock, one-cell grid with no sub-grid, plain numerals, a 0.3 wall that vanishes into the rock) and `blueprint`
(blue rock, white floors, light-blue grid, walls matching the rock). Both keep the walls between touching rooms at a full
weight (`partition: 1`), in the ink where the walls match the rock. `artgen dungeon style <id> --preset dark` writes its values
into the file, so the look can then be changed one key at a time.

Symbols (`artgen dungeon symbols`) take `scale` and, on top of it, `scaleX` (width) and `scaleY` (length) before the `angle` turns
them: a stair run 0.8 wide and 4 long is `stairs` with `scaleX: 0.8, scaleY: 4`. New kinds: `spiral-stair`, `pit-filled`,
`pool-filled`, `arch-stair` (steps curving round a post) and `curved-arrow` (`sweep` degrees, 120 by default, negative to turn
anticlockwise).

## What facts and check read

`dungeon facts` reads everything from the layout the renderer draws (a door in a run, `midDoors`, with `on: "open"`): each corridor's `path`, every door with the units behind
and ahead of it (`room:<id>`, `corridor:<index>`) and what it stands on (`wall`, `open`, `rock`, `end`), the owner of every cell
(`floor`, runs per row), the units whose cells meet (`adjacent`). Positions are rounded to 0.1 cell. `dungeon check` lists
errors (exit 1) and warnings, each with a stable `id`; `--errors id,id|all` reports chosen warnings as errors.

## Comparing a render with a reference image

To recreate an existing map, `scripts/dungeon-compare.mjs` scores a render against the reference: both become a floor mask,
the render is shifted onto the reference's grid, and the script reports the share of floor they have in common (IoU), the
pixels missing from the render and the pixels it has extra. It also writes the reference, the aligned render and a red/blue
diff side by side.

```bash
artgen dungeon render d --ppu 34.7        # one pixel per reference pixel: the reference's cell size
npm run compare:dungeon -- --source ref.png --mine art/dungeons/d/out/d.png --origin 7,-9.2 --channel r --floor 120
```

- **Cell size and origin.** Render at the reference's pixels a cell. `--origin x,y` is where the reference's cell 0,0 lies
  in its pixels; a gridline's position gives it (x = line − k × cell). The sheet starts at 0,0 in a render.
- **Floor.** A light pixel is floor (`--channel lum --floor 170`). A coloured rock needs a channel it is low in: blue rock
  with white floors works with `--channel r --floor 120`. `--close n` fills grid lines, text and symbols (default 3, use 0
  to score them), and `--margin n` ignores a border of the reference.
- **Reading the score.** It measures where the floor is, not how it looks: walls, symbols and one-pixel outlines move it by
  about 0.01. Look at the diff for what is missing (red) or extra (blue). `--min-iou x` exits 1 below x, `--json` prints
  the numbers.

## Reference

<!-- generated by npm run gen:ops from packages/artgen-mapgen/src/schema.ts: do not edit by hand -->

### Every key of a dungeon file

| Key | What it is |
|---|---|
| `id` | letters, digits, - and _ |
| `version` | the format version (2; older files are migrated on read) |
| `cols` | columns, 4..160 |
| `rows` | rows, 4..160 |
| `seed` | the generator seed |
| `title` | the title |
| `gen` | generator settings (`dungeon gen`) |
| `gen.rooms` | rooms to generate, 1..80 |
| `gen.minSize` | the smallest room side, cells |
| `gen.maxSize` | the largest room side, cells |
| `gen.caves` | the share of cave rooms, 0..1 |
| `gen.round` | the share of round and octagonal rooms, 0..1 |
| `gen.loops` | extra corridors beyond a tree, 0..1 |
| `gen.doors` | the share of corridor ends with a door, 0..1 |
| `gen.corridorWidth` | corridor width, cells |
| `gen.spacing` | empty cells between rooms |
| `gen.entrance` | a corridor from the first room off the nearest edge |
| `gen.layout` | scatter (default), dense (rooms side by side) or blocks |
| `gen.density` | dense: the share of the sheet filled |
| `grid` | the grid: a line every `size` cells, a fainter one at every cell with `sub`, on the floor or everywhere |
| `grid.show` | draw it |
| `grid.size` | cells between lines (2 = 10 ft at 5 ft a cell) |
| `grid.sub` | a line at every cell too |
| `grid.clip` | floor (default) or all |
| `style` | how it is drawn |
| `style.hatch` | rock hatching: a band along the walls, everywhere, or none |
| `style.band` | cells of the hatched band, 0..6 |
| `style.wall` | wall weight, 0.2..4 |
| `style.sharedWalls` | walls where two floors meet: true (default) between any two units, "rooms" between rooms only (format 1's true), false none |
| `style.rock` | the rock: hatch (as hatch says; default), solid (rockColor) or none |
| `style.rockColor` | solid rock's colour, #rrggbb (default #bdbdbd) |
| `style.partition` | the weight of the walls between floors, like wall (default: wall), 0.2..4 |
| `style.palette` | colours, each #rrggbb: rock, floor, ink, grid, wall, paper, partition |
| `style.palette.rock` | the solid rock (in place of rockColor) |
| `style.palette.floor` | the floor, and what fills doors and symbols (default #ffffff) |
| `style.palette.ink` | the ink: doors, symbols, labels, and the walls unless wall is set (default #000000) |
| `style.palette.grid` | the grid lines (default: the ink, faint) |
| `style.palette.wall` | the walls and partitions (default: the ink) |
| `style.numbers` | room numbers: a black badge (default) or plain bold numerals on the floor |
| `style.doors` | the door mark: a thin bar across the opening (default) or a square with a jamb each side |
| `style.preset` | a named look that fills the style and grid settings the file leaves unset (`dungeon style --preset` writes its values) |
| `scale` | the scale |
| `scale.perCell` | map units in one cell (5) |
| `scale.unit` | the unit (ft) |
| `numbers` | room number badges |
| `scaleBar` | the scale bar |
| `compass` | the compass |
| `legend` | a key of the symbols used |
| `furniture` | where the title, scale bar, compass and legend go: over the map, in a band outside it, or in the band only when they would cover something |
| `furniture.place` | over (default), outside or auto |
| `furniture.side` | the band's side |
| `rooms` | the rooms |
| `rooms[].id` | letters, digits, - and _ |
| `rooms[].shape` | the shape |
| `rooms[].x` | the box's left (cells) |
| `rooms[].y` | the box's top |
| `rooms[].w` | the box's width, at least 1 (a poly's is its points' own, any size above 0) |
| `rooms[].h` | the box's height, at least 1 (a poly's: as for width) |
| `rooms[].points` | a poly's outline, cells; x, y, w, h are then its box (x,y pairs) |
| `rooms[].seed` | a cave's outline seed (default: from its id) |
| `rooms[].label` | its name |
| `rooms[].number` | its number: a number, a key such as 15a (shown as written, not counted in the numbering), or false to hide it (default: file order) |
| `rooms[].fill` | what it is: floor (default), building, yard or cellar |
| `rooms[].href` | a link from it in the SVG: http(s)://…, a relative path or #anchor |
| `rooms[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `rooms[].hand` | fields a hand edit changed on an entry of some origin; a sync reports them |
| `rooms[].anchor` | where its {room} corridors start and its badge sits (default: the centre, or a poly's deepest point) |
| `rooms[].labelAt` | where its number and name stand: by a wall, at the anchor (c), or [dx, dy] from it; unset, they move off what they would lie on |
| `rooms[].cut` | an octagon's corner cut, a share of its shorter side, exactly (default: 0.3 of it to the half cell) |
| `rooms[].orient` | a hexagon: flat (points east and west; default) or pointy |
| `rooms[].edge` | wavy: a wavy line along its walls (a curtain, drapery, a rubble margin) |
| `rooms[].edgeSides` | the walls edge runs along, by the side each faces (default: all) |
| `rooms[].partition` | the weight of the walls it shares with other rooms, like style.partition (a connection's weight wins; the thinner of two rooms), 0.2..4 |
| `rooms[].exits` | ways out of the map inside the room |
| `rooms[].exits[].kind` | the mark |
| `rooms[].exits[].side` | a wall: n (top), e, s or w |
| `rooms[].exits[].at` | the mark's point |
| `rooms[].exits[].angle` | degrees, 0 east, clockwise (default: toward its wall) |
| `rooms[].exits[].text` | the note under it |
| `corridors` | the corridors |
| `corridors[].id` | a name other corridors can join |
| `corridors[].from` | a corridor end: a room, a point, or another corridor |
| `corridors[].from.room` | the room's id |
| `corridors[].from.side` | a wall: n (top), e, s or w |
| `corridors[].from.offset` | cells along the side wall from the room's top or left edge (goes with side) |
| `corridors[].from.port` | a point on the room's wall the corridor leaves from, its door set along the wall (moved onto the outline when off it) |
| `corridors[].from.at` | the point (cells) |
| `corridors[].from.exit` | where it leads: the corridor fades out over `fade` cells and a boxed note says so |
| `corridors[].from.exit.text` | the note |
| `corridors[].from.exit.href` | a link from it in the SVG: http(s)://…, a relative path or #anchor |
| `corridors[].from.exit.fade` | cells it fades over (default 3) |
| `corridors[].from.corridor` | the joined corridor's id |
| `corridors[].from.near` | the point on it to meet nearest |
| `corridors[].to` | a corridor end: a room, a point, or another corridor |
| `corridors[].to.room` | the room's id |
| `corridors[].to.side` | a wall: n (top), e, s or w |
| `corridors[].to.offset` | cells along the side wall from the room's top or left edge (goes with side) |
| `corridors[].to.port` | a point on the room's wall the corridor leaves from, its door set along the wall (moved onto the outline when off it) |
| `corridors[].to.at` | the point (cells) |
| `corridors[].to.exit` | where it leads: the corridor fades out over `fade` cells and a boxed note says so |
| `corridors[].to.exit.text` | the note |
| `corridors[].to.exit.href` | a link from it in the SVG: http(s)://…, a relative path or #anchor |
| `corridors[].to.exit.fade` | cells it fades over (default 3) |
| `corridors[].to.corridor` | the joined corridor's id |
| `corridors[].to.near` | the point on it to meet nearest |
| `corridors[].width` | width in cells, 0.2..6 (default 1; a maze corridor needs 0.5) |
| `corridors[].span` | width in the scale unit, in place of width (10 for a 10 ft passage) |
| `corridors[].route` | auto (straight when the rooms line up, else an elbow), hv, vh, straight, around (round the rooms on the grid) or maze (on the lattice of its width, off other corridors) |
| `corridors[].maze` | route maze: cells kept off rooms' walls (0 or 1; default 0 where walls are drawn along corridors), a bend's cost, the noise's seed |
| `corridors[].via` | its bends, in order (x,y pairs) |
| `corridors[].curve` | a smooth curve through the bends |
| `corridors[].style` | built (default) or natural (rough walls) |
| `corridors[].seed` | a natural passage's seed |
| `corridors[].doors` | the door at each end, from then to: a kind, or null for an open passage |
| `corridors[].midDoors` | doors standing in the run itself |
| `corridors[].midDoors[].at` | the distance from the corridor's start along its centre line (cells), or a point (the nearest point on the line) |
| `corridors[].midDoors[].kind` | the door kind |
| `corridors[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `connections` | doors and openings in the walls rooms share |
| `connections[].a` | a room |
| `connections[].b` | the room it touches |
| `connections[].at` | a point on their shared wall (default: the middle of its longest stretch) |
| `connections[].kind` | a door kind or open |
| `connections[].width` | the opening, cells (default 1) |
| `connections[].weight` | the stroke of the wall these rooms share, like style.partition, 0.2..4 (a thin gap or a heavy wall) |
| `connections[].line` | how that wall is drawn: solid (default), dashed (an illusory wall) or none (the floors run together) |
| `connections[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `rings` | lines over the rock with no floor: a ring of dashes, an illusory wall |
| `rings[].id` | its id |
| `rings[].shape` | a circle (at, r) or a poly (points, closed) |
| `rings[].at` | a circle's centre |
| `rings[].r` | a circle's radius, cells |
| `rings[].points` | a poly's outline (x,y pairs) |
| `rings[].line` | dashed (default) or solid |
| `rings[].width` | the line's width, cells, 0.02..2 (default 0.12) |
| `rings[].dash` | [dash, gap] in cells (default [0.5, 0.3]) |
| `rings[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `blocks` | shapes split into rooms that share walls |
| `blocks[].id` | its id |
| `blocks[].shape` | the shape |
| `blocks[].x` | left |
| `blocks[].y` | top |
| `blocks[].w` | width |
| `blocks[].h` | height |
| `blocks[].points` | a poly's outline (x,y pairs) |
| `blocks[].split` | how it splits |
| `blocks[].split.mode` | bsp, rows, cols, grid or cuts |
| `blocks[].split.min` | about the size of each room, cells |
| `blocks[].split.cuts` | where to cut |
| `blocks[].split.cuts.x` | x lines |
| `blocks[].split.cuts.y` | y lines |
| `blocks[].split.seed` | the seed |
| `blocks[].doors` | the share of extra connections, 0..1 |
| `blocks[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `overlay` | labels and symbols |
| `overlay.labels` | labels |
| `overlay.labels[].text` | the text |
| `overlay.labels[].x` | x |
| `overlay.labels[].y` | y |
| `overlay.labels[].kind` | name (bold), note (italic) or area (spaced capitals) |
| `overlay.labels[].size` | a factor on its size |
| `overlay.labels[].angle` | degrees |
| `overlay.labels[].href` | a link from it in the SVG: http(s)://…, a relative path or #anchor |
| `overlay.labels[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `overlay.symbols` | symbols |
| `overlay.symbols[].kind` | a symbol kind (`artgen dungeon symbols`) |
| `overlay.symbols[].x` | x |
| `overlay.symbols[].y` | y |
| `overlay.symbols[].scale` | a factor on its size |
| `overlay.symbols[].scaleX` | a factor on its width, on top of scale (a stair run 0.8 wide: scaleX 0.8, scaleY 4) |
| `overlay.symbols[].scaleY` | a factor on its length, on top of scale |
| `overlay.symbols[].sweep` | curved-arrow: how far it turns, degrees (default 120; negative: anticlockwise) |
| `overlay.symbols[].angle` | degrees, 0 east, clockwise on the page |
| `overlay.symbols[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `underlay` | a terrain map under the rooms |
| `underlay.map` | the map file's path, from this file's folder |
| `underlay.origin` | the map unit at the dungeon's top-left |
| `underlay.scale` | map units in one cell |
| `underlay.theme` | color or bw |
| `walls` | enclosing walls with towers and gates |
| `walls[].id` | its id |
| `walls[].rooms` | the rooms it goes round (their hull plus inset) |
| `walls[].poly` | its own line (x,y pairs) |
| `walls[].thickness` | cells, at most 4 |
| `walls[].inset` | cells round the rooms (default 1) |
| `walls[].towers` | towers |
| `walls[].towers.shape` | round or square |
| `walls[].towers.size` | cells across (default 3) |
| `walls[].towers.at` | at the corners or at these vertices |
| `walls[].gates` | gates |
| `walls[].gates[].at` | near the wall |
| `walls[].gates[].kind` | gate or postern |
| `walls[].gates[].room` | the room it opens into |
| `walls[].gates[].width` | cells |
| `walls[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |
| `bounds` | the ground the level occupies: the rock and grid are drawn inside it and its edge is drawn (x,y pairs) |
| `areas` | rock and voids within the level, which no floor may take |
| `areas[].points` | its outline (x,y pairs) |
| `areas[].kind` | rock or void |
| `areas[].label` | a note at its middle |
| `areas[].origin` | who wrote the entry; a sync replaces its own origin's entries and keeps the rest (none: a hand entry) |

### Every key of a layout graph

| Key | What it is |
|---|---|
| `id` | the dungeon's id |
| `title` | its title |
| `rooms` | the rooms |
| `rooms[].id` | its id (letters, digits, ., - and _) |
| `rooms[].w` | width, cells |
| `rooms[].h` | height, cells |
| `rooms[].shape` | the shape (round is drawn as a circle) |
| `rooms[].points` | a poly's outline, cells from its box's centre (x,y pairs) |
| `rooms[].label` | its name (default: its id) |
| `rooms[].turns` | may lie in any quarter turn or mirror of itself |
| `rooms[].hall` | shows its name alone: its label is shorter |
| `rooms[].against` | set against another room: its centre dx, dy cells from that room's |
| `rooms[].over` | must stand over this box (cells, the graph's frame: see origin) |
| `rooms[].at` | stands exactly here: its box's top-left (cells, the graph's frame, on the lattice); not moved by the packing |
| `rooms[].pad` | cells kept clear round it in the packing, in place of the graph's pad |
| `rooms[].draw` | room fields written into the file as given (see the dungeon file's rooms) |
| `rooms[].draw.number` | the room's number |
| `rooms[].draw.fill` | the room's fill |
| `rooms[].draw.href` | the room's href |
| `rooms[].draw.seed` | the room's seed |
| `rooms[].draw.cut` | the room's cut |
| `rooms[].draw.orient` | the room's orient |
| `rooms[].draw.exits` | the room's exits |
| `rooms[].draw.edge` | the room's edge |
| `rooms[].draw.edgeSides` | the room's edgeSides |
| `rooms[].draw.partition` | the room's partition |
| `rooms[].draw.labelAt` | the room's labelAt |
| `rooms[].symbols` | symbols in the room |
| `rooms[].symbols[].kind` | a symbol kind |
| `rooms[].symbols[].dx` | cells east of the centre |
| `rooms[].symbols[].dy` | cells south of the centre |
| `rooms[].symbols[].angle` | degrees |
| `rooms[].symbols[].sweep` | curved-arrow: degrees |
| `rooms[].ring` | a ring round the room, centred on it |
| `rooms[].ring.pad` | cells out from its box's longer half-side (default 1) |
| `rooms[].ring.line` | dashed (default) or solid |
| `rooms[].ring.width` | cells |
| `rooms[].ring.dash` | [on, off] cells |
| `ways` | the ways |
| `ways[].a` | a room |
| `ways[].b` | another room |
| `ways[].bearing` | degrees clockwise from north: b lies this way from a |
| `ways[].wall` | degrees clockwise from north: the wall a's door stands on |
| `ways[].wallB` | degrees clockwise from north: the wall b's door stands on |
| `ways[].doors` | the door at each end, from then to: a kind, or null for an open passage |
| `ways[].style` | built (default) or natural |
| `ways[].label` | a note |
| `ways[].run` | passage: always a corridor; wall: a door through a shared wall where the packing can (unset: as passages says) |
| `ways[].hold` | keep the bearing as a rule: weighed ten times as hard, and a packing that strays past 45° ranks below one that keeps it |
| `ways[].ports` | with via: where it leaves a and enters b, on their walls ([ax, ay, bx, by] cells) |
| `ways[].via` | the passage's bends (x,y cells, the graph's frame), drawn as given: both rooms stand at a place |
| `ways[].draw` | corridor or connection fields written into the file as given |
| `ways[].draw.id` | the passage's or the opening's id |
| `ways[].draw.curve` | the passage's or the opening's curve |
| `ways[].draw.seed` | the passage's or the opening's seed |
| `ways[].draw.midDoors` | the passage's or the opening's midDoors |
| `ways[].draw.weight` | the passage's or the opening's weight |
| `ways[].draw.line` | the passage's or the opening's line |
| `ways[].draw.width` | the passage's or the opening's width |
| `width` | the passage width in cells, the lattice (default 2) |
| `scale` | the scale |
| `footprint` | a square's side in cells, or a polygon (x,y cells); unset, the least square `fill` allows |
| `keepOut` | polygons no room or passage may take |
| `fill` | [least, most] share of the ground the rooms cover (default [0.35, 0.55]) |
| `passages` | the share of ways run as passages (default 0.35) |
| `detour` | cells a way may walk past the straight line between its rooms |
| `seed` | the seed (default 1) |
| `tries` | packings tried at each side (default 12) |
| `margin` | cells round the footprint in the file (default 2) |
| `clearance` | 0 (default) or 1: cells a passage keeps off walls |
| `pad` | cells kept clear round every room in the packing, to the lattice: joined rooms stand twice that apart |
| `origin` | [x, y]: where the footprint's top-left lies in the frame over, at, via and keepOut are given in (default [0, 0]; with no footprint, round the pinned rooms) |
| `mirrors` | rooms that mirror each other about a third |
| `mirrors[].a` | a room |
| `mirrors[].b` | its mirror |
| `mirrors[].about` | the room they mirror about |
| `mirrors[].along` | ew: across the east-west line through its centre (one x); ns: across the north-south line (one y) |
| `lines` | rooms whose centres stand on one line |
| `lines[].rooms` | the rooms |
| `lines[].along` | ew: one y; ns: one x |
| `partial` | with no packing that routes every way, write the one that routes most and list the rest in the report |
| `reach` | cells between joined rooms past which the packing pulls them together hard (default 24); the most a gap should be |
| `bounds` | the outline in the file: square (the footprint, default) or hull (round what the packing holds, a cell out) |
| `crossings` | let a passage cross another as a crossroads where it finds no other way |
| `routeFirst` | ways the router takes before the rest, in this order: [a, b] pairs |
| `spokes` | passages from one room keep apart where they can, each its own spoke, rather than joining into one run |
| `style` | style settings for the file, over the layout's own (see the dungeon file's style) |
| `legend` | draw a legend of the symbols |

### Every key of a layout (a design pattern)

| Key | What it is |
|---|---|
| `id` | its id (letters, digits, - and _) |
| `name` | what it is |
| `tags` | words to find it by |
| `source` | where it came from: topology and proportions, not the drawing |
| `source.kind` | written by hand or abstracted from a drawn map |
| `source.origin` | the map or file |
| `params` | parameters by name: {default, min?, max?, note?} |
| `parts` | the parts |
| `parts[].role` | its role (letters, digits, - and _) |
| `parts[].shape` | a graph shape, or hall (a rect that shows its name alone) |
| `parts[].w` | cells, [least, most] (its middle is taken), or a parameter: $name, $name*k, $name*k+c |
| `parts[].h` | cells, [least, most] (its middle is taken), or a parameter: $name, $name*k, $name*k+c |
| `parts[].points` | a poly's outline, cells from its box's centre |
| `parts[].count` | rooms in it (default 1, or as many as a design binds) |
| `parts[].at` | where its rooms stand against another part |
| `parts[].at.part` | the part |
| `parts[].at.side` | a compass point (n ne e se s sw w nw) or degrees clockwise from north |
| `parts[].at.touch` | set against it exactly (one room each) |
| `parts[].at.hold` | keep the bearing as a rule |
| `parts[].place` | rigid layouts: its box's top-left in the layout's frame |
| `parts[].turns` | may turn |
| `parts[].grow` | false: not grown when its walls are short for its ways |
| `parts[].focal` | the room the level is about |
| `parts[].draw` | room fields for the file (see the graph's rooms[].draw) |
| `parts[].symbols` | symbols from the room's centre (see the graph's rooms[].symbols) |
| `parts[].ring` | a ring round the room (see the graph's rooms[].ring) |
| `ties` | how the parts are joined |
| `ties[].a` | a part |
| `ties[].b` | a part (the same: a chain of its rooms) |
| `ties[].kind` | passage, or door (through a shared wall); unset: as the graph's passages share |
| `ties[].ofA` | first, last, each (default) or the n-th (1-based) |
| `ties[].ofB` | first, last, each (default) or the n-th (1-based) |
| `ties[].side` | a compass point (n ne e se s sw w nw) or degrees clockwise from north |
| `ties[].sides` | a chain's bearing step by step |
| `ties[].loop` | close the chain |
| `ties[].doors` | the door at each end, from then to: a kind, or null for an open passage |
| `ties[].style` | built (default) or natural |
| `ties[].hold` | keep its bearing as a rule |
| `sockets` | where it joins something else |
| `sockets[].name` | its name |
| `sockets[].part` | the part |
| `sockets[].of` | first, last, each (default) or the n-th (1-based) |
| `sockets[].bearing` | a compass point (n ne e se s sw w nw) or degrees clockwise from north |
| `sockets[].width` | cells (default the graph's width) |
| `sockets[].hold` | keep the join's bearing as a rule (default true) |
| `constraints` | what keeps its shape |
| `constraints[].line` | parts |
| `constraints[].along` | ew: one y; ns: one x |
| `constraints[].mirror` | two parts of one size |
| `constraints[].about` | a part of one room |
| `rigid` | its parts are placed exactly and move as one block |
| `hold` | keep every at bearing as a rule |

### Every key of a design

| Key | What it is |
|---|---|
| `id` | the dungeon's id |
| `title` | its title |
| `width` | the passage width in cells, the lattice (default 2) |
| `scale` | the scale |
| `footprint` | a square's side in cells, or a polygon (x,y cells); unset, the least square `fill` allows |
| `keepOut` | polygons no room or passage may take |
| `fill` | [least, most] share of the ground the rooms cover (default [0.35, 0.55]) |
| `passages` | the share of ways run as passages (default 0.35) |
| `detour` | cells a way may walk past the straight line between its rooms |
| `seed` | the seed (default 1) |
| `tries` | packings tried at each side (default 12) |
| `margin` | cells round the footprint in the file (default 2) |
| `clearance` | 0 (default) or 1: cells a passage keeps off walls |
| `pad` | cells kept clear round every room in the packing, to the lattice: joined rooms stand twice that apart |
| `origin` | [x, y]: where the footprint's top-left lies in the frame over, at, via and keepOut are given in (default [0, 0]; with no footprint, round the pinned rooms) |
| `mirrors` | rooms that mirror each other about a third |
| `mirrors[].a` | a room |
| `mirrors[].b` | its mirror |
| `mirrors[].about` | the room they mirror about |
| `mirrors[].along` | ew: across the east-west line through its centre (one x); ns: across the north-south line (one y) |
| `lines` | rooms whose centres stand on one line |
| `lines[].rooms` | the rooms |
| `lines[].along` | ew: one y; ns: one x |
| `partial` | with no packing that routes every way, write the one that routes most and list the rest in the report |
| `reach` | cells between joined rooms past which the packing pulls them together hard (default 24); the most a gap should be |
| `bounds` | the outline in the file: square (the footprint, default) or hull (round what the packing holds, a cell out) |
| `crossings` | let a passage cross another as a crossroads where it finds no other way |
| `routeFirst` | ways the router takes before the rest, in this order: [a, b] pairs |
| `spokes` | passages from one room keep apart where they can, each its own spoke, rather than joining into one run |
| `style` | style settings for the file, over the layout's own (see the dungeon file's style) |
| `legend` | draw a legend of the symbols |
| `rooms` | rooms of its own (a graph's rooms) |
| `ways` | ways of its own (a graph's ways) |
| `uses` | the layouts it uses |
| `uses[].id` | its id (letters, digits, - and _) |
| `uses[].layout` | a layout id |
| `uses[].params` | parameter values |
| `bind` | the rooms a use's role holds |
| `bind[].use` | a use |
| `bind[].role` | a role of its layout |
| `bind[].rooms` | room ids, or rooms with what they set (a graph room's keys) |
| `joins` | ways between sockets (use.socket) and rooms |
| `joins[].from` | use.socket or a room |
| `joins[].to` | use.socket or a room |
| `joins[].kind` | passage or door |
| `joins[].doors` | the door at each end, from then to: a kind, or null for an open passage |
| `joins[].style` | built (default) or natural |
| `joins[].hold` | keep its bearing as a rule (default: as the sockets say) |
| `layouts` | layouts of its own, over the library's |
| `blocks` | thematic blocks, for dungeon layout --nested: each laid out from its uses and rooms (and blocks within it), then the level from its blocks |
| `blocks[].id` | its id |
| `blocks[].uses` | the uses in it |
| `blocks[].rooms` | rooms of its own in it |
| `blocks[].blocks` | blocks within it (the same keys) |

### What `dungeon check` reports, by id

| Key | What it is |
|---|---|
| `outline-crosses` | a poly room's outline crosses itself |
| `zero-wall` | a poly room repeats a corner (a zero-length wall) |
| `no-floor` | a room has almost no floor |
| `off-sheet` | a room, symbol or label lies off the sheet |
| `runs-off-sheet` | a room runs past the sheet's edge |
| `rooms-overlap` | two rooms are laid over each other |
| `rooms-merge` | two floor rooms touch while shared walls are off, so their floors run together |
| `repeated-bend` | a corridor's via repeats a bend |
| `never-leaves` | a corridor never leaves a room it starts or ends at |
| `port-outside-room` | a corridor end at a room starts outside that room, so it has no door and does not reach it |
| `reenters-room` | a corridor leaves a room and runs back into it, drawing a passage over the rock between |
| `end-in-room` | a corridor ends at a point inside a room (or on its wall) |
| `offset-moved` | a corridor that leaves a room by a side starts more than half a cell from the offset given |
| `junction-at-bend` | a corridor joins another corridor at one of its corners or ends, the point nearest the other end, not along a run |
| `no-length` | a corridor has no length |
| `through-room` | a corridor runs through a room it does not join |
| `corridors-cross` | two corridors that share no room cross with no junction (corridors that leave one room may join and part) |
| `passages-tangle` | two corridors that leave one room cross each other, or run together for more than two cells, outside every room (they read as one passage, not as two spokes) |
| `maze-no-route` | a maze corridor found no passage (or its rooms touch, which a connection joins), so it is drawn as an elbow |
| `corridor-along-wall` | a corridor runs along a room's wall with no wall drawn between them, so the floors run together |
| `way-no-passage` | a way the file states draws no passage: a connection between rooms that share no wall, or a corridor between rooms laid over each other |
| `wall-too-short` | a shared wall is narrower than the opening in it |
| `connection-off-wall` | a connection's point is not on the wall the rooms share |
| `door-off-wall` | a door stands in open floor or on rock, not on a wall between two floors |
| `doors-stacked` | two doors stand on each other |
| `mark-on-badge` | a symbol lies under a room's number |
| `note-off-floor` | a room exit's note runs over the room's wall or off its floor |
| `marks-overlap` | two of a room's exit marks are drawn on each other |
| `label-overlap` | a label lies over another label |
| `outside-bounds` | a room or corridor has floor outside the level's bounds |
| `in-keep-out` | a room or corridor has floor on an area of rock or a void |

<!-- end of generated -->
