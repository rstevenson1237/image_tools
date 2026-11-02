# Dungeon engine plan: the consumer's report 2 (R9)

Status: built, 2026-11-02, released in artgen 0.12.0 (mapgen 0.12.0, dungeon format 2). §9 says what was built and where it
differs from the plan.

Source: setting_builder's `plans/dungeon-maps/report-artgen.md` ("report 2"), written against artgen-maps 0.11.0 built
from `1eb8e45`. It was checked again against `7c2f5fc`, the build now on `artgen-dist`. Since `1eb8e45` the dungeon engine
has moved into `artgen-mapgen` (R1) and gained an edit vocabulary (R2) and Tiled/LDtk export (R7c). Its drawing code
changed by 20 lines, and none of the findings A1–A16 is fixed. setting_builder now runs `7c2f5fc` as the `maps` module,
and its site builds byte-identical to the build on `1eb8e45`.

## 1. Summary

setting_builder draws every DANGEROUS block of its setting as a packed dungeon level. To get levels it can print, it wrote
about 1,400 lines of Python around the engine:

| Consumer code | What it does that the engine should | Lines | Retired by |
|---|---|---|---|
| `tools/mapcheck.py` | rebuilds the floor, ports, doors and slanted runs to test them | 284 | D1 |
| the 10-ft rock band in `route.py` | keeps passages off room walls, because no wall is drawn there (A1) | part of 515 | D2 |
| hub and lead points in `dungeon.py` | ports and doors that start in the room's centre (A13, A14) | ~50 | D3 |
| stair symbol, note and angle in `block_map` | a stair inside a room (A4) | ~40 | D7 |
| polygons for every shape but rect, circle and cave | room shapes fixed in cells (A15) | ~20 | D7 |
| `tools/pack.py` | rooms laid out to a graph, inside a footprint, at a target fill (A8) | 432 | D6 |
| `tools/route.py` | an A* router with clearance, sharing and named walls (A7) | 515 | D6 |

The plan takes the report's own priority order: the cheapest work that retires the most consumer code comes first.
Each phase (§5) opens with a consumer fixture that shows the defect, and closes when the consumer can delete the code
named above. §4 adds six faults in the install and the feedback loop, found while wiring `7c2f5fc` into setting_builder.
They are small, and they come first (D0).

## 2. Rules for every phase

- **Facts come from the drawing code.** Every new fact, check and placement is read from `layoutDungeon` (`layout.ts`),
  the code that draws. Nothing derives geometry a second time. That second derivation is the fault `mapcheck.py` has.
- **Additions stay in dungeon format 1.** An optional field or a new enum value is an addition. A changed default is a
  break (CHANGELOG, "File format versions"). D2 has one such break: it moves dungeon format to 2, with a migration that
  makes every format-1 file draw exactly as it did.
- **Checks get stable ids.** Each `dungeon check` finding gets an `id` (`door-off-wall`, `rooms-merge`, …) beside its
  `path` and `message`. A consumer can then raise chosen ids to errors, and a message can be reworded without breaking it.
- **The consumer's files are the spec.** Each phase starts by adding a case under `fixtures/setting-builder/` from a real
  block. The consumer sends it with `artgen report --file`, and `npm run intake` turns it into a fixture. The case's
  `case.md` states the facts the phase must make true. A phase is done when those facts pass and the consumer has retired
  its code.
- **Units are stated.** Every new length says whether it is in cells or in the scale unit, and the reference (D5) gives
  the formula.

## 3. Not isolated in the report (A17): settle these first

Write each one as a test in D1, before deciding whether it is a fault:

1. `dungeon sync` when an end changes from a side port to a waypointed `{room}` end: are `side` and `offset` left
   behind? (The consumer once got "an `offset` without a `side`", a file error.)
2. Partial overlaps of touching rooms: is a partition ever missing at a corner meeting?
3. A door wider than its wall (a 10-ft passage onto a 6-ft hall end): is it drawn whole, clipped, or not at all?
4. An anticlockwise `poly`: are its walls and openings the same as the clockwise one's?

## 4. Install and feedback-loop faults found in the upgrade (D0)

| # | Fault | Fix | Test |
|---|---|---|---|
| I1 | A maps-only install names a program it does not have. The `core` fragments and commands (`artgen-report`, `artgen-upstream`, `artgen-image`, the CLAUDE.md section) are built with `{{ARTGEN}}` = `node tools/artgen/artgen.js`. Only the `maps` content gets `artgen-maps.js` (`build.mjs`). | Fill `{{ARTGEN}}` at install time from the modules chosen. Record the hash of the text as written, so `update` still sees which files are untouched. | `init --with maps` into a scratch repo; no installed file names `artgen.js`. |
| I2 | The managed CLAUDE.md section assumes an `art/` project, even after `init --no-scaffold`. A consumer that generates its map files and uses path mode has no way to say so. Deleting the section brings it back on the next `update`. | A path-mode fragment for `maps` when there is no `art/` (`--file` always; `report --file`; no `brief`, `version` or `approve`). Also `init --claude-md none\|short`, recorded in `MANIFEST.json`. | Install with `--no-scaffold`; the section holds no `art/` path. |
| I3 | `VERSION` reads 0.11.0 across 12 `artgen-dist` builds (`b36ae89`…`3bb4e6a`). A consumer that keys a cache on it reuses results from an old engine. setting_builder did, and now keys on the bundle's hash. The bundle's `case.md` records only `artgen: 0.11.0`. | Write the build into `VERSION` (`0.11.0+7c2f5fc`, as `--version` prints it), or cut a patch release on each merge. Make `case.md`'s `artgen:` line the `--version` string. | Two builds from different commits give different `VERSION` files. |
| I4 | `update --notes` shows no changelog between builds of one release: `changelogSince` keeps only sections newer than the installed version, and R1–R8 have no section. | An `Unreleased` section in `CHANGELOG.md`, which the notes include whenever the build differs. | `update --notes` from a `1eb8e45` install lists the R1–R8 changes. |
| I5 | `report --file` writes the bundle beside the input by default. For setting_builder that is inside its content tree (`setting/region/G/feedback-…`). | In path mode, default to `artgen-feedback/<date>-<id>/` at the repo root (the git top level), and list it in `.gitignore` at install. | `report --file a/b/c.json` writes nothing under `a/b/`. |
| I6 | A bundle records artgen's own `check` command, but not how the consumer made the file. The fixtures README asks for "the exact command it was built with". | `report --made-by "python3 tools/maps.py draw"` puts the command in `case.md`, and the installed command text asks for it. | The intake keeps the line. |

## 5. Phases

### D1 — Geometry out, defects in (A5, A6; the check half of A2 and A13) — S–M

- `dungeon facts --json` adds:
  - `corridors[].path`: the drawn centreline, after `via`, `route` and ports;
  - `doors[]`: `{at, angle, kind, wall: [ownerA, ownerB], corridor}`;
  - `floor`: who owns each cell, as run-length rows of owner indexes, rooms first, then corridors;
  - `adjacent[]`: `{a, b, along}`, the length two units share.
- `dungeon check` adds warnings, each with an id, all read from the layout:

  | Id | What it finds |
  |---|---|
  | `door-off-wall` | a door in open floor or in rock |
  | `corridor-along-wall` | a corridor running along a room wall (A1) |
  | `rooms-merge` | rooms touching while shared walls are off (A2) |
  | `doors-stacked` | two doors within a door's width of each other |
  | `way-no-passage` | a connection or corridor with no opening drawn |
  | `port-outside-room` | a port whose first point lies outside its room, so no door is drawn (A13) |

- The four A17 questions (§3) become tests here.
- **Accept:** two new fixtures from setting_builder blocks (`G.a`, the densest, and `H.a`, whose detour warning is
  open). Their facts are tested in `facts.test.ts`, and every `mapcheck.py` finding on them has a matching `check` id.
- **Consumer retires:** `mapcheck.py`. The validator reads `check --json` and `facts --json` instead.

### D2 — A wall between any two units; shared walls on by default (A1, A2) — M, dungeon format 2

- Draw a partition wherever floors of two different owners meet: room and room, room and corridor, corridor and
  corridor. Leave it out only at a declared opening: a door, a `connection`, a corridor's end, or a junction (D6).
  This extends `sharedEdges` from room outlines to the owner grid D1 builds.
- `style.sharedWalls` defaults to on. This is the one break in the plan. Dungeon format 2's migration writes the value
  the old rule gave (`!!(connections.length || blocks.length)`) into every format-1 file, so old files draw unchanged.
  The consumer fixtures migrate with it.
- **Accept:** a fixture with a corridor laid along a room wall draws the wall. On setting_builder's G with touching
  allowed, the room share goes from 34% to about 43%, as the report measured.
- **Consumer retires:** the 10-ft rock band rule in `route.py`.

### D3 — Ports on the wall, doors along the wall (A13, A14) — S

- A new end, `{room, port: [x, y]}` (not `at`, which already marks a point end): a port at a point on the room's outline that keeps the room link, so `render --room`
  and `facts` still count the room. Also `rooms[].anchor`, to override `roomAnchor`.
- A door takes the outline's tangent where the path crosses it (`exitPoint`), not the angle of the path.
- **Accept:** an L-shaped poly with a port on its far arm draws no passage over rock. A port on a round or octagonal
  wall gives a flush door, whatever angle the path arrives at.
- **Consumer retires:** the hub and lead points written into every `via`.

### D4 — Room labels that move and are checked (A3) — S–M

- `rooms[].labelAt`: a side (`n e s w c`) or an offset in cells.
- Room labels go through `placeLabels` as items in every render, not only with `--fit`. A room label that finds no
  clear spot is listed in `unplaced`, and `check` warns `label-overlap`.
- **Accept:** the report's two cases: two adjacent 10-ft halls, and a stair in a 10 x 20 ft room. Neither overlaps.

### D5 — A schema and a reference (A12) — S

- Declare the fields of each file once, in a table in `spec.ts`. Both the validator and `artgen schema
  dungeon|map|settlement` (JSON Schema) are built from that table. A parity test checks that every key the validator
  accepts is in the schema.
- `--help` lists every key from the same table. The keys it omits today are `style.sharedWalls`, `style.wall`,
  `style.hatch`, `corridor.via`, `offset` and `exit`.
- `docs/DUNGEON.md`: one example per key, and the formulas a consumer otherwise finds by experiment: `sidePort`'s
  offset and snapping, `roomAnchor`, the octagon's cut, and the symbol `angle` convention (degrees, 0 east,
  clockwise).
- This could go first, since it is cheap and stops rework like report 1's F11. It sits here so that it documents
  D1–D4 as built.

### D6 — Layout from a graph, and a router (A8, A7) — L, two sub-phases

- **D6a, router.** `link --route maze`: A* on a lattice, with options for clearance from walls, a cost per bend, a
  door at a named point on a wall (D3), a slanted run from a curved wall onto the grid, ground the route must stay on,
  and a seed. Corridors that leave one room together may share cells, which draws a junction rather than raising
  "crosses corridor with no junction". `route.py` is the reference implementation, and its tests carry over.
- **D6b, layout.** `dungeon layout --graph g.json --footprint square|poly --keep-out poly --fill 0.45 --passages 0.35
  --detour 100 --seed n` writes a dungeon file. It anneals with `pack.py`'s energy terms: overlap, touching,
  face-to-face alignment, the mix of doors and passages, clearance round round rooms, label spacing, and walls shared
  between floors. Its moves turn, mirror and nest rooms, and a repair loop re-anneals ways that found no passage.
- **Accept:** on setting_builder's blocks C–L, `layout` meets the same bars as `pack.py`: every way within the brief's
  detour, `check` clean of the D1 ids, and density at least `pack.py`'s. It runs in under 5 s a block (`pack.py` takes
  about 30 s on four cores). The output is the same for the same seed on Node 20 and 22.
- **Consumer retires:** `pack.py` and `route.py`. `maps.py pack` becomes one `artgen dungeon layout` call per block.

### D7 — Smaller drawing options (A4, A9, A10, A11, A15, A16) — S each, any order

| Finding | Addition |
|---|---|
| A4 | `rooms[].exits: [{side \| at, kind: stairs-up\|stairs-down\|arrow, text}]`: draws the mark and a note placed clear of it |
| A9 | `style.rock: hatch\|solid\|none` and `style.rockColor` (solid ground, white floors, as the old reference maps) |
| A10 | `style.partition`: a stroke factor for partitions apart from `style.wall`, scaled with the page |
| A11 | `corridors[].span`: width in the scale unit, beside `width` in cells. Each engine's side limit appears in `formats --json` and the schema. The settlement overlay takes the `water` label kind. |
| A15 | octagon `cut` as a ratio of the short side, in map units (default: today's formula), and `hexagon` with `orient: flat\|pointy` in `rooms[]` |
| A16 | `bounds`: a polygon the hatch and grid are clipped to, with its edge drawn. `areas: [{points, kind: rock\|void, label}]` |

## 6. Order and what can run in parallel

D0 → D1 → (D2 ∥ D3 ∥ D4) → D5 → D6a → D6b. D7 can run at any point after D1. D2 waits for D1's owner grid. D6a waits
for D3's wall ports. D5 can be moved up if a consumer is blocked on undocumented keys.

## 7. What to measure

| Measure | Now | After |
|---|---|---|
| Consumer lines working round the dungeon engine | ~1,400 (pack 432, route 515, mapcheck 284, dungeon.py ~110) | under 150 (the converter from tables) |
| Room share on setting_builder's G | 34% | ~43% (D2) |
| Time to pack one block | ~30 s, Python, four cores | under 5 s (D6b) |
| Defects found by `check` that a consumer found first | 6 kinds (A6) | 0 |
| Keys missing from `--help` and the schema | 6+ | 0 (parity test) |
| setting-builder fixtures | 9 | 9 + one per phase |

## 8. Risks and open decisions

- **Format 2 for one default.** D2 could add the partition rule without changing the default, so no break and no
  migration. But the silent merge (A2) would stay, for every new consumer. Recommendation: take the break once, with
  the migration, and add `rooms-merge` (D1) first so the change is visible before it lands.
- **Layout in the engine.** D6 brings optimisation code into `artgen-mapgen`. It stays a separate module
  (`dungeon/layout-graph.ts`) behind its own operation, so `gen` and the web tool are unaffected. The web Dungeon Map
  tool can call it later.
- **Determinism.** The annealer uses the seeded PRNG in `artgen-primitives` and no `Math.random`. A fixture pins one
  seed's output as facts, not pixels.
- **The consumer keeps its own rules.** The setting's own rules (BRIEF.md's detour, where a stair goes) stay in
  setting_builder and are passed as parameters. The engine takes numbers, not setting terms.

## 9. Built (2026-11-02)

Every phase is built, in the order D0, D1, D2, D3, D4, D7, D6, D5 (D7 before D6: the router needs its `bounds` and `areas`).
What differs from the plan above:

- **D0.** `report --file` writes to `artgen-feedback/<date>-<id>/` at the repo root, and the folder holds its own `.gitignore` (`*`)
  rather than the installer editing the consumer's. The build is recorded in `modules.json` and `MANIFEST.json`; `VERSION` stays the
  release. `--claude-md none` and a files-layout CLAUDE.md fragment for maps-only repos with no `art/`.
- **D1.** One more check than planned: `reenters-room` (a corridor that leaves a room and runs back into it over rock, the L's notch
  case of A13). `check --errors id,…|all` raises chosen warnings. `doors-stacked` compares the doors' openings as segments, so two doors
  meeting corner to corner at a room's corner are not stacked.
- **D2.** `style.sharedWalls` takes `true | "rooms" | false`; the 1 -> 2 migration writes `"rooms"` (format 1's `true`) or `false`, so
  every format 1 file draws as before, byte for byte (tested on the generated and Keep renders).
- **D3.** The end is `{room, port: [x, y]}`, not `{room, at}`: `at` already marks a point end everywhere in the engine. An `auto`
  corridor between rooms that line up runs straight only where the run starts inside both rooms.
- **D4.** A moved label's middle stays inside its room; in a narrow hall a label overhangs the walls wherever it stands.
- **D5.** The schemas are declared once (`schema.ts`) and held to the validators by a test that records every key each validator reads;
  the validators are not generated from them (their messages are part of what consumers read). `formats --json` keeps its shape; the side
  limits are in the schemas.
- **D6.** The router (`router.ts`) and the packer (`graph.ts`) are ports of `route.py` and `pack.py`. A layout routes with clearance 0
  (a passage may run along a wall, which D2 now draws), which is what lets H.a pack at all. Measured on setting_builder's ten levels at the
  brief's footprints, 12 tries each: every way routes, none past its detour, `check` clean, 1.4 to 9.6 s a block on one core (G and H
  over the 5 s target; `pack.py` took about 30 s on four cores). With the footprint unset the rooms reach about 55% of the square.
- **D7.** As planned; `formats --json` is unchanged (see D5).
