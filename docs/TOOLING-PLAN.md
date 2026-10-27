# Tooling plan: separate, refactor, and build a feedback loop

Status: proposal, 2026-10-27. Nothing here is built yet. It follows on from the finished artgen plan
([`archive/artgen/PLAN.md`](archive/artgen/PLAN.md)) and reuses its decisions (`Dn`) where they still hold.

## 1. Summary

This plan covers five things:

1. **Keep one source repo, split what gets published.** Split the engine into layered packages (primitives → scene →
   artgen and mapgen → workflow → interfaces). Then publish each one on its own, so a game repo or a tool like
   setting_builder takes only what it needs.
2. **Keep the `npx … init` committed install.** It is still the only way that works in both cloud and local Claude
   Code sessions (D1). Add modules (`init --with art,maps`), a scheduled update pull request in each consumer repo,
   and npm packages for code that imports the engine directly.
3. **Make the loop run both ways.** Each consumer repo can send back a feedback bundle (`artgen report`) and its local
   edits (`artgen upstream`). This repo turns them into consumer fixtures and tests every release against them before
   it ships. Metrics from every repo are pooled, so you can see if a change made the work faster.
4. **One workflow for everything.** Every generator goes through the same steps: Reference → Prompt → Theme → Data
   sheet → Iterate → Review → Approve → Metrics. Today only pixel assets have the full loop. Maps have no versions,
   approval or metrics.
5. **Make the production stages explicit.** The stages are Placeholder → Shape → Rig → Decorate → Decal/effect →
   Lighting → Rotation → Animation. Each stage gets its own file, check, cache and an optional approval gate. A wrong
   silhouette then gets caught before anyone pays for decoration and animation, which is how studios use a greybox.

Each phase in §10 makes the next one cheaper: it measures something, removes repeated work, or catches mistakes
earlier.

## 2. Where things stand

The suite today has three parts:

- **artgen**: a procedural pixel and voxel pipeline. Its engine is ~21k lines of TypeScript in `artgen-core`, which
  holds the primitives, scenes, voxels, views, animation, QA and the W1/W2 workflows.
- **mapgen**: three map engines (terrain, dungeon, settlement). They also live inside `artgen-core`, but they only use
  its `lib/` helpers and `format.ts`, so they can come out cleanly.
- **The image tools**: a Svelte web app with 8 tools in two sidebar groups.

They ship as one committed install on the `artgen-dist` branch. That branch already includes a maps-only bundle
(`maps/artgen-maps.js`), which setting_builder uses through consumer fixtures.

Coverage against the areas you listed (✅ have, ◐ partial, ✗ missing):

| Area | Item | State | What exists / what's missing |
|---|---|---|---|
| **Output** | 2D | ✅ | `Scene2D` primitives, tiles, textures, effects; SVG/PNG maps |
| | 2.5D | ◐ | iso, 3/4 oblique, sprite stacks, parallax strips (D8). Lit sprites and sprite stacks are not in the Pixi.js runtime |
| | Voxel | ✅ | `Scene3D` voxel mode, `.vox` and greedy-mesh `.glb` export |
| | 3D | ◐ | Only voxel meshes. No low-poly/smooth meshes, UVs or PBR materials |
| **Camera** | Top-down, side, iso | ✅ | `views/camera.ts`: affine pixel-art cameras |
| | FPS | ◐ | billboards, wall/floor textures, view-models, raycaster preview (D9). No true perspective camera |
| | Free camera | ✗ | Needs real 3D output and an orbit preview |
| **Stages** | Geometric placeholder | ✗ | `base.v1` is already a full build. Nothing ships a greybox to the game first |
| | Shape | ✅ | S1 base: primitives, booleans, shading models |
| | Rig | ◐ | `anim.rig`, `solveTwoBone`, `spring` exist, but templates don't use them. Each asset builds its own rig |
| | Decorating | ✅ | S2 `proc` layers, finish ops |
| | Decal / effect | ◐ | Effects: `fx/particles`. No decals (marks placed on a surface, kept as their own layer) |
| | Lighting | ◐ | light direction, banded shading, normal maps. No lit-sprite runtime |
| | Rotation | ◐ | facings from a 3D yaw. RotSprite (rotating 2D art) is not built |
| | Animation | ✅ | tracks, easing, animation contracts, animation QA |
| **Workflow** | Reference | ◐ | `art/refs/` + `palette extract`. Nothing is kept for comparing results later |
| | Prompt | ✅ | the direction interview, briefs |
| | Theme / concept | ✅ art, ◐ maps | 3 candidates and style tiles for art; maps only have colour and black-and-white themes |
| | Data sheet | ◐ | `brief.json` and map `facts`. No one-page sheet a person reads and signs off |
| | Iterate | ✅ art, ✗ maps | v1–v3 + finish pass machine. Maps are edited in place, with no versions |
| | Review | ✅ art, ◐ maps | reviewer agent, blind re-score, Asset Review tool. Maps only have `check` and lint |
| | Approve | ✅ art, ✗ maps | ledger `approve`. Maps have none |
| | Metrics | ✅ art, ✗ maps | ledger, analytics v2, pixel hygiene. Maps have none |
| **Interface** | Node/JS | ◐ | the CLI works. Library packages are `private` and export TS source, so nothing can `npm install` them |
| | Python / CLI | ✅ | thin client over the CLI and MCP (`python/artgen`) |
| | MCP | ✅ | about 45 tools, defined by hand in `artgen-mcp/src/server.ts` |
| | Web UI | ✅ | 8 tools. Three of them (Terrain, Dungeon, Settlement) repeat each other's editor code |

Known gaps from the archive still apply: acceptance never ran in a local session, scores were mostly self-scored, and
some tiles sit below the bar.

## 3. How other projects do it

Each row names a pattern that is common in the field, the well-known tools that use it, and what this plan takes from
it.

| Concern | Common practice | Examples | What we take |
|---|---|---|---|
| Stages of an asset | Blockout/greybox → model → UV/texture → rig → animate → light → integrate, with a review gate between stages | game and film pipelines; level-design greyboxing | §8 stage graph, starting with the placeholder stage and gates |
| Procedural graphs | Each step is a node with typed inputs and outputs. Results are cached, and only nodes whose inputs changed run again | Houdini PDG/TOPs, Substance Designer, Blender Geometry Nodes | stage cache keys (§8). A node view in the web UI later (P8) |
| Review and approval | Versions per task, notes drawn on the frame, status (WIP → review → approved), dashboards | Autodesk Flow Production Tracking (ShotGrid), ftrack, Kitsu | one review model for assets and maps (§7) |
| Pixel-art tooling | Scriptable editors, batch export, sprite-sheet packing | Aseprite CLI (`--batch`), TexturePacker | already there (pack export). Keep exports importable by these tools |
| 2D rigs | Bones, skins and a reusable skeleton per body type, retargeted across characters | Spine, DragonBones | a shared rig library (P6) |
| Map generators | Seeded generator + hand edits + a layered file | Watabou's city/dungeon generators, Azgaar, Dungeondraft, LDtk/Tiled | already there. Add Tiled/LDtk export for game use (P7) |
| Interchange formats | open, versioned formats | glTF 2.0, OpenUSD, MagicaVoxel `.vox`, Tiled TMX, LDtk JSON | glTF for 3D, keep `.vox`. Format versions already exist |
| Sharing code into many repos | "copy into your repo" from a registry, with an `add`/`diff` command | shadcn/ui registry, copier (`copier update`, a 3-way merge) | the committed install is this model. Add modules and upstream diffs (§4–5) |
| Keeping consumers current | bot-opened update pull requests | Renovate, Dependabot | a scheduled update workflow shipped with the install (P3) |
| Not breaking consumers | consumer-driven contract tests: each consumer states what it relies on, and the provider runs those checks | Pact | consumer fixtures already do this for setting_builder. Make it the default for every consumer (P4) |
| Monorepo hygiene | enforced package boundaries, per-package versions | Nx module boundaries, dependency-cruiser, Changesets | P1 boundary rule, P3 versions per module |

## 4. Second repo or `npx` install?

You asked whether a game repo should pull this in as a second repo with only what it needs, or keep the `npx`
install.

| Option | Cloud sessions | Takes only what's needed | Updates | Two-way | Verdict |
|---|---|---|---|---|---|
| **A. `npx …#artgen-dist init` (today)** | ✅ files are committed | ◐ all or maps-only | `update`, by hand | one way | keep, extend |
| A+. A with modules (`init --with maps`, `add art`) | ✅ | ✅ | scheduled pull request | `report`, `upstream` | **recommended** |
| B. git submodule / subtree of a slim dist repo | submodule ✗ (not documented in cloud), subtree ✅ | ✅ | `subtree pull` | `subtree push` sends edits back | heavy for collaborators. Skills still have to be copied into `.claude/` |
| C. npm package dependency | ✅ after `npm install`, but needs the network or a lockfile cache | ✅ | Renovate | ✗ | good for **code** consumers (runtime, mapgen library), not for skills |
| D. Plugin marketplace | ✗ in cloud (D1) | ✅ | auto | ✗ | optional, local only |
| E. Split the source into separate repos | n/a | n/a | releases in lockstep | n/a | not now (D2 still holds: the UI and CLI must run the same engine) |

**Recommendation.** Use A+ for Claude Code tooling (skills, agents, commands, CLI and MCP bundles), and C for code that
imports the engine.

- The source stays in this repo, which avoids version skew between the web UI and the CLI.
- The installer gets **modules**: `core` (always), `art`, `maps`, and `ui-links`. A module is a list of skills,
  commands, agents, bundles and the `CLAUDE.md` sections it needs. `MANIFEST.json` records the modules a repo has.
- The `maps` module is a first-class product (`mapgen`), with its own version line and changelog section. The
  maps-only bundle setting_builder uses today becomes this module.
- A separate source repo only makes sense if mapgen gains consumers that never use artgen **and** someone else
  maintains it. §12 records this as a later decision.

## 5. The two-way loop

```
 consumer repo (game, setting_builder)                        image_tools
 ─────────────────────────────────────                        ───────────
 art/ ledger, maps, briefs ──── artgen metrics export ──────▶ metrics/pool  (anonymised analytics, per version)
 a bad render / missing feature ─ artgen report <id> ───────▶ issue (template) ─▶ fixtures/<consumer>/<case>/
 a local fix to a skill or bundle ─ artgen upstream ────────▶ patch / pull request against content/ or src/
                                                              │
                                            consumer CI: every fixture × candidate build
                                                              │
 update PR (scheduled workflow) ◀── release artgen-dist-vX ◀──┘  (+ changelog, fixtures that now pass)
```

- **`artgen report <asset|map> [--note]`** writes `art/feedback/<date>-<id>/`. It holds the input file, the
  command, the version, the render, the ledger lines and a `case.md` in the consumer-fixture layout that already
  exists. With `--issue` it opens a GitHub issue on this repo from a template; without a token, it prints the link
  instead. The person still decides what gets sent.
- **`artgen upstream`** compares each installed file with `MANIFEST.json` (it already detects local edits) and writes
  a patch that maps them back to their source paths (`content/skills/…`, templates). Your edits stop being forks.
- **Intake.** An issue with a feedback bundle becomes a consumer fixture (§3, the contract-test pattern). The rule
  already in `fixtures/README.md` stays: a fixture changes only through a brief from its consumer or a format bump.
- **Consumer CI.** Before a release, run every fixture against the candidate build, and stop the release on a
  regression.
- **Update pull requests.** The install ships `.github/workflows/artgen-update.yml` (opt-in). Once a week it runs
  `npx …#artgen-dist update` and opens a pull request with the changelog section, and it never overwrites local edits
  (it already refuses without `--force`).
- **Metrics pooling.** `artgen metrics export` writes counts and ratios only (passes, tokens, minutes, scores, gate
  failures by check, per kind and per version) to `art/metrics/<version>.json`. There are no images and no prose.
  `analytics --across` already pools across repos; a script here collects the files from known consumers. This is
  how you check whether a release made production cheaper.
- **Lessons.** When the pooled metrics show a pitfall that repeats (a gate check that fails often, or a kind that
  needs extra passes), it becomes a line in the skill's *Pitfalls* section or a template change. The bench runs
  before and after, as the archive phases did.

## 6. Target architecture

```
                 ┌──────────── interfaces ─────────────┐
                 │  cli   mcp   python   web (src/)    │   generated from one op registry (§9)
                 └──────────────────┬──────────────────┘
                 ┌──────────────────┴──────────────────┐
                 │  workflow: ledger, versions, review, │   shared by art and maps (§7)
                 │  approve, metrics, stage runner      │
                 └───────┬──────────────────────┬──────┘
          ┌──────────────┴───────┐      ┌───────┴──────────────┐
          │ artgen: direction,   │      │ mapgen: terrain,     │
          │ briefs, pass machine,│      │ dungeon, settlement, │
          │ QA gates, pack export│      │ facts, lint, formats │
          └──────────────┬───────┘      └───────┬──────────────┘
          ┌──────────────┴──────────────────────┴──────────────┐
          │ scene: Scene2D/3D, proc layers, finish, voxel,     │
          │ views + cameras, anim + rigs, fx, textures         │
          └──────────────────────────┬─────────────────────────┘
          ┌──────────────────────────┴─────────────────────────┐
          │ primitives: grid, geometry, colour/palette, rng,   │
          │ noise, raster, svg, font, page, format versions    │
          └────────────────────────────────────────────────────┘
 runtime (separate, dependency-free, already its own package)
```

| New package | Comes from (in `artgen-core/src`) | Depends on |
|---|---|---|
| `primitives` | `lib/*`, `t2/geom.ts`, `t2/raster.ts`, `format.ts` | — |
| `scene` | `t2/scene*.ts`, `t2/proc.ts`, `t2/finish.ts`, `voxel/`, `views/`, `anim/`, `fx/`, `tex/` | primitives |
| `artgen` | `direction.ts`, `w1/`, `w2/`, `qa/`, `pipeline.ts`, `render.ts` | scene, workflow |
| `mapgen` | `map/`, `dungeon/`, `settlement/`, `maps.ts` | primitives (+ workflow from P5) |
| `workflow` | new; ledger and status logic moved out of `qa/ledger.ts`, `w2/status.ts`, `pipeline.ts` | primitives |

`artgen-core` stays as a facade that re-exports everything, so the CLI, web app and examples keep working while
imports move over. In the web app, `src/tools/` gets three groups: **image** (Token Cutter, SVG Tracer), **maps**
(the three map editors, sharing one editor shell) and **art** (Direction, Review, Lab).

## 7. One workflow for every generator

| Step | Art asset (today → target) | Map (today → target) | Stored in |
|---|---|---|---|
| Reference | `art/refs/` + palette extract → refs tagged per brief, shown on the review sheet | — → refs per map (a sketch or a real map) | `art/refs/` |
| Prompt | brief interview → unchanged | skill interview → saved as the map's brief | `briefs.yaml` / `map.brief.md` |
| Theme / concept | 3 candidates, style tile → unchanged | colour/bw → map themes as a locked direction (fonts, inks, symbol set) | `direction.json` |
| Data sheet | `brief.json` → **one-page sheet**: size, scale, states, facings, frames, palette, budget | `facts` → one-page sheet: scale, rooms or buildings, what must hold | rendered `sheet.png` + JSON |
| Iterate | v1–v3 + finish → plus stage gates (§8) | edit in place → **versions** (`map.v3.json`) with a diff between them | asset or map dir |
| Review | reviewer agent, blind score → unchanged | `check` → check + reviewer pass on readability rules | ledger |
| Approve | ledger `approve` → unchanged | — → ledger `approve`, shown in the same Review tool | ledger |
| Metrics | analytics v2 → pooled across repos (§5) | — → same fields | ledger, `art/metrics/` |

The `workflow` package owns steps 5–8 for both. artgen and mapgen each supply a *subject*, which knows how to render,
check and describe itself. The web **Asset Review** tool then reviews maps without any new UI.

## 8. Production stages and the output matrix

Every asset becomes a chain of named stages. A stage has an input, an output, a check, a cache key (a hash of its
inputs) and an optional gate (`review.gates: [placeholder, shape]`).

| # | Stage | What it produces | Check | Exists as |
|---|---|---|---|---|
| 0 | **Placeholder** | flat-coloured primitives at the right size, footprint, pivot and collision box. Exportable, so the game runs with it | size against the direction's scale, pivot, footprint | new |
| 1 | Shape | silhouette and form | silhouette readability at 1×, gate checks | S1 base |
| 2 | Rig | named bones from a **shared rig library** (biped, quadruped, flyer, serpent, vehicle turret) | bone lengths stay the same across frames | helpers only |
| 3 | Decorate | materials, proc layers | palette, banding, noise | S2 |
| 4 | Decal / effect | decals as their own layer (damage, dirt, emblems, team colours) and effects | decal stays inside the shape mask | fx only |
| 5 | Lighting | banded shading, normal map, optional emissive map | light direction matches the direction | partial |
| 6 | Rotation | facings (3D yaw, or RotSprite for 2D-only assets) | each facing reads, and they agree with each other | partial |
| 7 | Animation | states × frames against the animation contract | contract, timing, foot sliding | yes |
| — | Finish | direct-pixel ops on the result | finish-staleness check | F pass |

Why this order: the placeholder lets the game team start on day one. A gate after Shape catches a bad silhouette
before stages 2–7 are spent on it. With cache keys, a change to decoration does not re-run rigging or re-render
unchanged facings. Today a restyle re-renders everything.

Output × camera targets. "Built" means it exists today; the phase number says when the rest lands.

| | Top-down | Side | Iso | FPS | Free camera |
|---|---|---|---|---|---|
| 2D | built | built | built | textures, built | — |
| 2.5D | oblique, built | parallax, built | built | billboards, built | — |
| Voxel | built | built | built | `.vox`/`.glb`, built | P7 orbit preview |
| 3D (low-poly glTF) | P7 | P7 | P7 | P7 | P7 |

3D means primitives from `Scene3D` exported as meshes (not voxels): flat-shaded low-poly with palette colours, so it
keeps the direction model. Painted textures and PBR stay out of scope (D18 still applies).

## 9. One operation registry for all interfaces

Settlement editing already shares one operation vocabulary between the CLI, MCP and web tool. P2 makes that the rule
everywhere: each operation is declared once (name, input schema, output schema, side effects, which module owns it).
From that one declaration:

- the CLI gets its flags and `--help`;
- MCP gets its tool list and schemas (replacing the hand-written list in `server.ts`);
- Python gets its methods and type hints (the client stays a thin wrapper around the CLI);
- the web UI gets its forms and the commands it can call in the worker;
- the docs get a reference table, and a parity test fails when an interface is missing an operation.

The Node/JS library interface comes from P1 + P3: `primitives`, `scene`, `mapgen` and `runtime` published to npm under
one scope, built to JS with type declarations. Today the packages export TypeScript source.

## 10. Phases

Sizes follow the archive plan: S is about one session, M is 2–3 sessions, L is 4 or more. Each phase ends green on
`npm run check`, `npm test`, `check:packages`, `test:packages` and the bench. Each phase also states what it makes
faster for the phases after it.

### R0 — Baseline and boundaries (S)
- Record today's numbers from the ledgers and bench: passes, tokens and minutes per approved asset; first-pass
  approval rate; gate failures by check; build and test time; bundle sizes.
- Add a boundary lint (dependency-cruiser, or a small script) that encodes §6's arrows, warning only for now.
- Pick the KPIs in §11 and write them to `docs/metrics/baseline.json`.
- **Makes later work faster:** every later phase has a number to beat, and new cross-module imports stop appearing.
- **Accept:** baseline file committed; the lint runs in CI.

### R1 — Package split, no change in behaviour (M–L)
- Move the code into `primitives`, `scene`, `artgen` and `mapgen` (§6). `artgen-core` stays as a re-exporting facade.
- Split the web app's sidebar into the image, maps and art groups. Pull the code the three map editors repeat into
  one shared map-editor shell.
- Turn the boundary lint into an error.
- **Makes later work faster:** a mapgen change no longer rebuilds or retests the pixel pipeline (per-package test
  runs), and each module can be released on its own.
- **Accept:** the bench and fixtures give byte-identical output; the dist bundles are no larger; the boundary lint
  passes; the web app's build is no larger.

### R2 — Operation registry (M)
- Add the registry (§9) and move the map, dungeon and settlement operations onto it first, since they already share
  a vocabulary. Then move the asset operations.
- Generate the MCP tool list, the CLI help and the Python methods. Add the parity test.
- **Makes later work faster:** a new operation is written once instead of four times, so P5–P7 features reach every
  interface for free.
- **Accept:** the MCP tool list comes from the registry; the parity test passes; the Python tests pass unchanged.

### R3 — Modular install and update pull requests (M)
- Add installer modules (`core`, `art`, `maps`, `ui-links`), plus `init --with`, `add <module>` and `remove
  <module>`. Record the modules in `MANIFEST.json`.
- Give `mapgen` its own version line in the changelog. Keep the format versions as they are.
- Ship the opt-in `artgen-update.yml` workflow (§5).
- Publish `runtime`, `primitives`, `scene` and `mapgen` to npm. This is an owner step: pick the npm scope first.
- **Makes later work faster:** consumers stay current without being asked, so feedback arrives about the current
  version, not an old one.
- **Accept:** a maps-only install has no art skills in it; an update opens a pull request in a scratch repo; the
  release acceptance script passes for both modules.

### R4 — Feedback loop (M)
- Add `artgen report`, `artgen upstream`, `artgen metrics export`, the issue template, and the intake script that
  turns an issue into a fixture.
- Run consumer CI before each release, and pool the metrics with `analytics --across`.
- Run the first local-session acceptance on the owner's machine with real choices. This is a known gap from the
  archive.
- **Makes later work faster:** real failures become regression tests, and the metrics show which stage costs most,
  which decides the order of R6's work.
- **Accept:** one real report from setting_builder goes through the whole path, from issue to fixture to fix to
  release to update pull request; pooled metrics show two repos.

### R5 — One workflow for maps and assets (M–L)
- Build the `workflow` package (§7): versions, ledger, review and approval for maps; map briefs; map themes as a
  locked direction; the one-page data sheet for both maps and assets; references shown on review sheets.
- The Asset Review tool lists maps as well.
- **Makes later work faster:** maps get metrics, so map work can be tuned the same way art is; a single review tool
  is less code to maintain.
- **Accept:** a map goes through v1 → review → approve in the CLI and in the web UI, and analytics include maps.

### R6 — Stage graph (L; split into sub-phases ordered by R4's metrics)
- R6a: the **Placeholder** stage and its export, so the runtime loads placeholder packs. Add gates and stage cache
  keys.
- R6b: the **shared rig library**, used by the creature and character templates.
- R6c: **decals** as a layer type; the lit-sprite runtime for Pixi.js (lighting).
- R6d: **RotSprite** for rotating 2D-only assets.
- **Makes later work faster:** wrong shapes are rejected at the gate, cached stages are skipped, and rigs are reused
  instead of written per asset.
- **Accept:** on the bench, tokens and passes per approved asset fall against the R0 baseline, with no drop in blind
  score; a restyle re-runs only stages 3 and later.

### R7 — Output and camera breadth (L)
- Add low-poly glTF output from `Scene3D` primitives (flat-shaded, palette materials) and a free-camera orbit preview
  in the web UI (three.js is already a runtime adapter).
- Add Tiled and LDtk export for maps and tilesets.
- Each new camera is a view module (projection, probe set, context view, check, runtime helper), the plug-in shape
  D8 already set.
- **Makes later work faster:** more of the output matrix can be filled without new pipelines, since it is the same
  primitives and the same review.
- **Accept:** every cell in §8's matrix has a template and one bench asset at or above the approval bar.

### R8 — Web UI consolidation (M)
- One shell: project bar, a per-asset stage view (a simple node graph of §8's stages with cache status), a metrics
  dashboard fed by pooled analytics, and the same keyboard shortcuts and layout in every tool.
- Fill the archive's untested Firefox zip fallback.
- **Makes later work faster:** you can see where time goes and approve stages without Claude Code open.
- **Accept:** the headless UI acceptance (`scripts/artgen-ui-accept.mjs`) covers the stage view and maps review.

Order and what can run in parallel: R0 → R1 → (R2 ∥ R3) → R4 → R5 → R6 → (R7 ∥ R8). R4 can start in a small form
straight after R3. The `report` command alone does not need the registry.

## 11. What to measure each iteration

| KPI | Source | Direction |
|---|---|---|
| Passes per approved asset, by kind | ledger | ↓ |
| Tokens and minutes per approved asset | ledger (D19) | ↓ |
| First-pass approval rate (approved with no user feedback) | ledger | ↑ |
| Blind score of finals (not self-score) | blind review | ↑ or flat |
| Gate failures by check | ledger | ↓ for the top 3 |
| Time to first placeholder in the game | ledger timestamps (R6a) | ↓ |
| Consumer fixtures, and regressions caught before release | fixtures, consumer CI | fixtures ↑, escapes = 0 |
| How far consumers lag behind the latest release | `MANIFEST.json` versions in pooled metrics | ↓ |
| Operations missing from an interface | parity test | 0 |

## 12. Risks and open decisions

**Risks**

- **The split breaks consumers.** The facade package, byte-identical bench output and consumer CI guard against this.
  Nothing is renamed in the files consumers write.
- **The stage graph adds overhead to small assets.** Gates and stages are opt-in per kind. Filler tiles keep today's
  single-file path.
- **Metrics leak project details.** The export holds counts and ratios only and is opt-in. The person reads the file
  before it is shared.
- **3D output pulls focus from the pixel pipeline.** R7 comes last and stays low-poly with palette colours.
  Self-scoring stays calibrated against blind scores.

**Decisions for you**

1. Package names and npm scope (`@<scope>/primitives`, `…/mapgen`). This is needed before R3 publishes anything.
2. Whether `mapgen` keeps the `artgen` CLI name in game repos (`artgen map …`) or gets its own (`mapgen …`).
   Recommendation: keep `artgen map` and add a `mapgen` alias.
3. Which consumers send metrics. Recommendation: your own repos, opt-in per repo.
4. Is 3D low-poly output wanted at all, or is voxel enough? This decides whether R7's first half happens.
5. Whether to split the source into a separate repo later. Recommendation: revisit only if mapgen gets a second
   maintainer or consumers that never use artgen.
