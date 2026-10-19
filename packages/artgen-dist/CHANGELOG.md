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
  `map check` comes with the map requirements (A2).
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
