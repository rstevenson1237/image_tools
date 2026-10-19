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
