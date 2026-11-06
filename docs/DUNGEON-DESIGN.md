# Designing dungeons, not only drawing them: findings and a proposal

Status: proposal, answered by setting_builder (§10). §10 records what is built so far and the plan for the rest. The findings come from
recreating two published maps with the dungeon tool; the proposal is my reading of `generate.ts`, `graph.ts`, `blocks.ts`
and the `setting-builder` fixtures. I have not read the `setting_builder` repo itself, so the split in §5 is an assumption
to check with its owner.

## 1. Summary

- The tool draws a given dungeon well. Two real maps were recreated to a floor overlap of about 0.90 with the tool's own
  rooms, corridors and symbols. The drawing side is sound; its gaps are filed as issues #46 to #56.
- It does not yet *design*. `dungeon gen` scatters random rooms and joins them with a spanning tree; `dungeon layout` packs a
  graph someone else wrote. Nothing turns a concept ("a keep with a central shrine, about 20 rooms, fits a 23×23 sheet") into
  a graph, and nothing in the engine knows the shapes that make real maps interesting.
- Proposal: a **third way to make a dungeon**, *layouts* (design patterns that chain together and grow from drawings
  people give us), plus a **higher-level `dungeon-design` skill** that turns a brief into candidates. Most of the concept
  work belongs with `setting_builder`; the engine side is the pattern format, the composition and the checks.

## 2. What the two recreations showed

| | Map 1: black-and-white keep | Map 2: blue keyed map |
|---|---|---|
| Passes | 6 drafts | 3 passes |
| Floor overlap (IoU), best | 0.90 (0.88 in the approved draft; 0.892 re-scored) | 0.91, 0.905, 0.903 (0.905 re-scored) |
| Checks at the end | clean | clean |
| Issues filed | #46 to #51 | #52 to #56 |

The compare harness became `scripts/dungeon-compare.mjs` (`npm run compare:dungeon`, documented in `docs/DUNGEON.md`).
Its numbers differ slightly from my earlier ones: the old harness resampled with nearest-neighbour and eroded a border strip.

**What worked**
- Measure first. The grid pitch and phase come from gridline positions, and room edges read off as cell coordinates.
- Set the style before scoring. Map 1's first score was polluted by the default white-hatched rock.
- Whole-cell rooms that abut, with doors at whole-cell points. Fractional shared walls gained about 0.03 overlap and cost the
  tool's own idioms; the user dropped them.
- Generate the JSON from a script. Each pass is then a small edit.
- Score and diff, not eyes. The diff caught a wrong reading of the door bands (map 1) and a corridor that ran through three
  rooms (map 2).

**What cost time**
- Misreading a feature from a zoomed view where a pixel sample would have settled it.
- Tool defaults that give no hint of the cause (a corridor junction chosen by distance; a 1-cell box minimum on thin shapes).
- Gaps that forced hand-faking: double doors, plain numerals, a palette, dashed walls, wavy edges, curved arrows.

**What the maps have that random generation does not.** These are structures, and each can be named:

| Pattern | Seen in | What it is |
|---|---|---|
| Axis of halls | map 1 | three large halls in a row (round hall with alcove, circle hub, pillared hall) joined by 2-wide passages with double doors |
| Cell row off a hall | map 1, rooms 7 to 12 | six small rooms in two rows, each with one door onto a shared hall |
| Spine and ring hub | map 2 | one 1-wide corridor the full height, crossing a ring chamber with eight door marks |
| Diagonal approach | map 2 | two 45° corridors from the corner rooms to the hub |
| Suite | both | a room with an `a` sub-room (14 and 14a, 15a and its alcove, 20 and 20a) |
| Secret bypass | both | a hidden corridor that links two rooms the main route also reaches |
| Stair vestibule | both | a small room or alcove whose job is to hold a stair |
| Dressed focal room | both | pillars, a pit, a statue or edging in the room the map is about |

Random scatter produces none of these. They are what a person means by "interesting".

## 3. What the engine has today

- **Random** (`dungeon gen`; `scatter`, `dense`, `blocks` layouts): seeded rooms, a minimum spanning tree plus a few loops,
  doors by weight. Cheap and varied, but structureless.
- **Blocks** (`dungeon block`): one shape (rect, octagon, circle, hexagon, polygon) split into rooms that share walls, with
  doors between; blocks can be joined with `link`. Good for a wing, cells or a warren. The rooms are anonymous: a block knows
  how to split, not what its rooms are for.
- **Graph layout** (`dungeon layout --graph`): the strongest part. It takes named rooms with sizes and shapes, ways with a
  bearing and a wall, a footprint or polygon, `keepOut`, `fill`, `passages`, `detour`, a pinned `over` box, `against`, and a
  seed. It anneals a packing and routes every way. The graph must already exist.
- **Checks and tools**: `dungeon check`, `facts`, `version`, `review`, and now `dungeon-compare`.

So the engine can solve and draw a graph. What is missing is a way to *produce* good graphs and the knowledge of what a good
one looks like.

## 4. A third component: layouts (design patterns)

Random says "any rooms". A block says "this shape, split". A **layout** says "this kind of structure": named roles, how they
connect, how they sit relative to each other, and where it can join to something else.

### 4.1 What a layout holds

```json
{
  "id": "spine-ring-hub",
  "tags": ["hub", "spine", "axial"],
  "params": { "length": [14, 24], "ringRadius": [2, 3], "doors": 8 },
  "parts": [
    { "role": "spine", "kind": "corridor", "width": 1, "axis": "ns", "length": "$length" },
    { "role": "hub", "kind": "room", "shape": "circle", "r": "$ringRadius", "on": "spine@0.5", "dashed": true }
  ],
  "ways": [{ "a": "spine", "b": "hub", "doors": [null, null] }],
  "sockets": [
    { "id": "n", "at": "spine.start", "bearing": 0, "width": 1 },
    { "id": "s", "at": "spine.end", "bearing": 180, "width": 1 },
    { "id": "e", "at": "hub.e", "bearing": 90, "width": 1 },
    { "id": "w", "at": "hub.w", "bearing": 270, "width": 1 }
  ],
  "constraints": [{ "symmetry": "mirror-x" }],
  "source": { "kind": "drawn", "origin": "map-2", "note": "abstracted from a published map" }
}
```

Two flavours, one format:
- **Rigid** layouts stamp exact geometry (a ring hub with its eight door marks). They need no solver.
- **Flexible** layouts expand to a graph the existing annealer places (a cell row: "six rooms of 2×3 to 3×3 around a hall").

### 4.2 How layouts compose

- **Chain**: join one layout's socket to another's (`axis-of-halls.e` to `spine-ring-hub.w`). Sockets carry a bearing and a
  width, so the join is checked before anything is drawn.
- **Nest**: place a layout inside a block's shape or a room (a cell row inside a wing).
- **Repeat and mirror**: a wing on each side, or four cell rows around a hub.
- **Fill**: leave an area to `dungeon gen` or a block when the brief wants spread-out rooms between the structures.

Blocks stay as they are, and a layout can use one as a part (a cell row is a `rows` block plus names). Random stays for filler.
A dungeon then has three sources of rooms: random, blocks, layouts. The first two know shapes; layouts know *roles*.

### 4.3 Growing the library from drawings

This is the strongest reason for the format: the library grows from drawn maps. It takes two steps, and only the second is
new design work.

1. **Trace** (image to a draft `dungeon.json`). The steps I did by hand are the automatable ones: find the grid pitch and
   phase from gridlines, take the floor mask, read room rectangles and circles off it, find door glyphs. A first trace will be
   partial (symbols and unusual shapes need a person, or a model in the loop, as I was). `dungeon-compare` is the gate: a trace
   is accepted when it scores above a floor on the source.
2. **Extract** (a dungeon to a layout). A person or model picks the rooms and ways that make up the structure
   (`dungeon pattern extract <dungeon> --rooms 7,8,9,10,11,12 --hall hall --name cell-row`); the tool abstracts them: sizes
   become ranges, the corridor ends it cuts become sockets, roles are named, and the original coordinates are dropped.

Two cautions:
- **Provenance.** A pattern stores abstract topology and proportions, not the drawing. Record where it came from
  (`source`), and only add patterns from maps the user owns or has the right to study.
- **Quality.** A pattern from one drawing may fit its own map and little else. The library needs a few real uses (the
  recreations are the first tests, §7) before a pattern is trusted for new designs.

## 5. Where this belongs: this repo and `setting_builder`

`layout` is already a port of `setting_builder`'s `pack.py`, and its fixtures show that `setting_builder` builds the
graphs from its own tables. That is a sound division, and the proposal keeps to it:

| Concern | Owner | Why |
|---|---|---|
| The setting: factions, region, what a level is for, room contents | `setting_builder` | it has the tables and the story |
| Turning that into a **brief** (rooms wanted, sizes, footprint, feel) | `setting_builder` | the brief comes from its data |
| The **brief format** | this repo (`artgen schema brief`, versioned) | one format every consumer can emit; consumer-driven contract tests already exist here |
| The **layout format**, the library, composition, constraints | this repo | engine knowledge, setting-agnostic |
| Solving (packing, routing), checks, scoring against a brief | this repo | already here |
| Choosing layouts for a brief, naming rooms, keying numbers | the design skill (§6), in either repo | needs judgement, so a model, over this repo's checks |

What this repo can offer beyond learning from drawn maps:
- the format and checks that make any design (from a drawing, a brief or a person) comparable;
- the **constraints the solver lacks**: enforced mirror pairs, a straight spine, pinned anchor rooms, 45° ways;
- **scoring against a brief**: room count, footprint fit, connectivity, dead-end share, symmetry;
- **candidate search**: run N seeds, score, keep the best three;
- **dressing rules**: by room role (pillars in a focal room, stairs in a vestibule, secret doors on shortcuts).

## 6. A higher-level `dungeon-design` skill

Yes, there is room. The existing `dungeon-map` skill is an *operations* manual (commands, readability rules). It starts from
"ask a few questions, then generate". A design skill sits above it and owns the step before: from concept to a brief and
candidates.

Steps:
1. **Concept.** Ask three things at most: what it is (crypt, keep, warren), size and fit (a number of rooms, or "fits 23×23"),
   and hard needs (a central room of this size, dense or spread out, maze-like, a secret route). Hard needs are optional.
2. **Brief.** Write `brief.json` (footprint, room range, density, topology, required rooms, symmetry, style).
3. **Design.** Choose layouts by tag, chain them, fill the gaps with blocks or random, and write the graph.
4. **Solve.** `dungeon layout` with several seeds, then score each against the brief.
5. **Show three.** A contact sheet of the best candidates, with scores and what each one trades off.
6. **Dress and key.** Apply the dressing rules, number rooms in the order a party meets them (with `a` sub-rooms), then the
   existing `dungeon-map` steps: check, version, review.
7. **Approval.** Only the user approves, as today.

The model owns concept, choice of layouts, names and keying; code owns geometry, scoring and checks. When a consumer such as
`setting_builder` already has the brief, the skill starts at step 3.

## 7. Plan, smallest useful step first

| # | Step | Size | Notes |
|---|---|---|---|
| 1 | **Brief schema** and a `dungeon brief --json` validator | S | The contract with `setting_builder`; settles the field names |
| 2 | **Layout format** and three or four layouts written by hand from the maps (`cell-row`, `spine-ring-hub`, `axis-of-halls`, `suite`) | M | Proves the format on structures already drawn |
| 3 | **`dungeon design`**: layouts plus a brief become a graph; run `layout` over several seeds; score; contact sheet | M | Uses the existing solver unchanged |
| 4 | **Design skill** over steps 1 to 3 | S | Mostly instructions |
| 5 | **Solver constraints**: mirror pairs, straight spine, pinned room, diagonals | M | Needed by rigid patterns |
| 6 | **Extract** (dungeon to layout) | M | Makes the library grow from drawings |
| 7 | **Trace** (image to draft dungeon) | L | Automates the measuring I did by hand; semi-automatic at best |
| 8 | **Dressing rules** | M | Depends on the tool gaps (#46 doors, #48 numerals, #54 palette, #52 thin shapes) |

The filed gaps are not a separate stream: steps 5 and 8 cannot finish while doors, numerals, palette and thin shapes are faked
by hand.

**Acceptance.** The two recreated maps become golden briefs. Describe each as a brief (about 22 rooms in a 23×23 sheet, spine
and ring hub, mirrored wings with `a` sub-rooms) and require a design to match their counts and topology and to pass
`dungeon check`. The compare script can score a design against the real map as a sanity check, but a design is not meant to
reproduce the drawing, so the brief check is the real gate.

## 8. Open questions

- **Does `setting_builder` want to emit a brief, or keep calling `layout` with its own graph?** The proposal works either way;
  the brief only matters if the design step is shared.
- **Pattern ownership.** Does the library live in this repo (shared) or in each consumer (their own style)? A bundled set
  plus a project folder (`art/dungeons/layouts/`) covers both.
- **How far to take trace.** A partial trace that a model finishes is useful; a full automatic one for arbitrary drawings
  is a research problem. I would build the measuring half and stop.
- **Rigid versus flexible.** Whether the first layouts should be rigid (fast, exact) or flexible (varied, uses the solver).
  I would start with flexible, since it needs no new engine, and add rigid ones for features like the ring.

## 9. Related

- Tool gaps from the recreations: #46 doors, #47 symbols, #48 numerals, #49 corridor ends, #50 style preset, #51 wall
  thickness, #52 thin shapes, #53 dashed walls, #54 colours, #55 wavy edging and curved arrows, #56 corridor junctions.
- `scripts/dungeon-compare.mjs` and the section in `docs/DUNGEON.md`.
- `docs/DUNGEON-PLAN.md` (R9), where `layout` was specified, and `docs/TOOLING-PLAN.md` for the consumer-driven contract tests.

## 10. setting_builder's reply, and the plan from here

setting_builder built §4 to §7 on its side first (a layout library, a design file per level, `tools/design.py` to expand a
design to a graph, solve it over seeds, score the packings and hold its tables to the result), designed one level end to end
with it, and a three-level test dungeon, and sent seventeen requests (R1 to R17) with evidence. This section answers it.

### 10.1 Its answers to §8, and corrections

- **Brief or graph?** It keeps calling `layout` with its own graph for now, and will emit a brief once this repo has one and
  layouts of its own (`design.py` then shrinks, as `pack.py` did).
- **Who owns the library?** A bundled set here plus a project folder; setting_builder keeps its `layouts/` and offers the
  ones that prove out.
- **Rigid or flexible?** Flexible first; R2 and R4 are its limits.
- **Words.** setting_builder's `BRIEF.md` is a whole build's brief and its *block* is one level. Here, the per-dungeon input is
  called a **design brief**, and this repo's block (§3) is a *split* to it. These docs say "design brief" from now on.
- §7 step 8 and §9: #46 to #56 are fixed in 0.13.0, so dressing and rigid features no longer wait on drawing gaps.
- setting_builder already has pinned rooms (`over`), voids (`keepOut`) and a 3D place for every room (`tools/space.py`).

### 10.2 Done on this branch

| # | Request | What was done |
|---|---|---|
| R3 | growth from a point; `over` without a frame | `origin` gives the frame `over`, `at`, `via` and `keepOut` are in; with no footprint the square centres on the pinned rooms, and the report gives the `origin` it chose |
| R5 (part) | N seeds, scoring, a contact sheet; a minimum gap | `dungeon layout --seeds n --keep k --sheet`; `scoreLayout` (check findings, ways left, strays, detours); `pad`; the report's `gaps`; `check` finds `passages-tangle` (two passages from one room that cross or run together), and `spokes` keeps them apart |
| R2 (part) | constraints | `hold` (a bearing as a rule, strays ranked down and reported) and `lines` (one row or column). Mirror pairs, opposite sockets and a straight spine wait for R1's parts |
| R9 | rock colour on the hatch; preset walls | `palette.rock` colours the hatch; `palette.partition`; `dark` and `blueprint` keep partitions at full weight, in the ink where walls match the rock |
| R10 | settlement `--theme bw` ground | the terrain underlay follows the theme |
| R11 | routes as an input | `at` (a room placed exactly) and `via` (a passage drawn as given; routed passages keep off it) |
| R12 | room places in whole feet | the report's `places` give each room's corner, whole on the lattice, as well as its centre; a table can hold the corner. A centre on a half cell is what an odd size is, so it is not moved |
| R13 (part) | a repair when no seed routes | `partial` writes the packing that routes most and lists the rest; `routed` says how many tries routed. Speed at 25+ rooms is open (10.3) |
| R14 | caves joined as boxes | a cave is routed to its drawn outline, and its ways are passages |
| R15 | `dark` band unreadable; a legend that shrinks the map | light ink gets the rock's colour (or `palette.paper`) as paper; the legend runs in columns |
| R16 | what a table cannot say | a room's `draw` (number, fill, edge, partition, labelAt, exits, …), `symbols` from its centre and a `ring`; a way's `draw` (curve, midDoors, id, weight, line, width); the graph's `style` and `legend` |
| R17 | diagonal final legs; stacked doors | a door off the lattice stands on the passage's own lattice line, and a `{room}` end with `via` leaves square on; side ends with no offset are spread; a room's doors keep a passage's width apart where they can; passages stay inside a square footprint |

Tried on setting_builder's own `E-graph.json` (four seeds, four tries each): before, all four routed, three of them by running
passages outside the 28-cell square (`outside-bounds`), and every one stacked two doors on the ring hub. Now passages stay inside, so fewer seeds route at 28 cells
and the scores say why (doors stacked on an eight-door hub of 40 ft, passages that share a run behind other rooms). That hub is
what R4 is for.

### 10.3 Done since (the second round)

| # | Request | What was done |
|---|---|---|
| R1 | layouts and composition | the layout format (`artgen schema layout`), designs (`artgen schema design`), `dungeon layouts`, `dungeon design`, `dungeon layout --design`; joined sockets checked for facing and width; a room grows when its walls are short for its ways (the ring hub's size follows its passages); a bundled library of seven, and the project's `art/dungeons/layouts/`. setting_builder's six layouts are test fixtures (`src/dungeon/__fixtures__/`), not bundled |
| R2 | the rest of the constraints | `mirrors` (a cell row's rows mirrored about its hall), a row of rooms on one side held by its line, a chain's bearing step by step (a spiral holds, `held` empty), ways that say how they run (`run: passage` or `wall`), a wall for each end (`wallB`) |
| R4 | rigid layouts | `rigid: true` with `place`: every part set against the first at its exact offset (the `gatehouse`) |
| R5 | the rest | `reach` (the most a joined gap should be) and `bounds: hull` (the outline round what the packing holds); the report's `hull` |
| R6 | `dungeon extract` | rooms of a dungeon as a layout: ranged sizes, ties, sides, sockets for the ways out, `source`; `--rigid` |
| R7 | the measuring half of trace | `dungeon trace`: grid pitch and phase from gridlines on open floor (square cells fitted on both axes), floor cells, walls between them, rooms as rectangles of whole cells, a draft and its coverage |
| R13 | speed | the packer skips pairs that cannot cost (the same packings): G's graph from 20.4 s to 13.5 s for twelve tries |

Measured on setting_builder's own material:
- **Trace.** On artgen renders of X and G, the floor cells match the source's to a cell IoU of 0.92 and 0.98. On setting_builder's
  `level1.png` and `level2.png` the grid reads at 22.4 and 12.0 px a cell (level 1's 10 ft lines, level 2's 5 ft sub-grid);
  `level3.png` (light lines on a dark floor) is not read, and needs `--pitch`.
- **R13, routing at 29 rooms.** G as a design of the bundled layouts (29 rooms, 33 ways) routes no seed of 36 at 48 cells;
  with `pad: 1` at 60 cells, 2 or 3 seeds of 12, and nearly every other seed leaves one way. Three cheap repairs were tried and
  measured over 12 seeds, and none kept: a pull on a stuck way's rooms (no change), routing the stuck ways first (3 of 12
  against 2, at 50% more time), twice the repair rounds (2 of 12, 70% more time). The level packs into a clump that walls a
  room in; what it needs is a packing that leaves room for passages it has not routed yet.

### 10.4 Next, in order

1. **R13, routing** (M to L): space for passages in the packing (a free lane round rooms with many ways, scored before
   routing), or a repair that moves the rooms blocking a stuck way rather than its own two; then seeds in worker threads. The gate
   is G routing most seeds at 60 cells.
2. **R8, a settlement from a graph** (L): streets that run past several buildings, a gate, a wall, spacing as a target. Its own
   proposal first, against setting_builder's settlement spikes.
3. **Trace, the next half**: doors (gaps in the walls it finds), round rooms, light lines on a dark floor.

setting_builder's fixtures (`layouts/`, `E/Design.md`, the evidence) come in through `artgen report`, and become the golden
cases for R1 and R4 as the recreated maps are for §7's acceptance.
