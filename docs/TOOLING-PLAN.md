# Tooling plan: separate, refactor, and build a feedback loop

Status: proposal, 2026-10-27; decisions settled 2026-10-27 and revised 2026-10-29 (§12). R0, R1, R2, R3, R5, R5b, R6 and R7a are built, and R4's code is built but its acceptance run is not (§10); R6's production accept is not run either; the rest is not. It follows on from the finished artgen plan ([`archive/artgen/PLAN.md`](archive/artgen/PLAN.md)) and reuses its
decisions (`Dn`) where they still hold.

## 1. Summary

This is a **refactor that builds on the existing code**, not a rewrite. About nine tenths of what exists is kept and
moved, not rewritten (§6). The plan covers eight things:

1. **Keep one source repo, split what gets published.** Split the engine into layered packages (primitives → scene →
   artgen, mapgen and imagekit → workflow → interfaces). Then publish each one on its own, so a game repo or a tool
   like setting_builder takes only what it needs.
2. **Keep installing straight from this git repo** (`npx -y github:rstevenson1237/image_tools#artgen-dist init`). No
   npm account or registry. Game repos commit the installed files, the only way that works in both cloud and local
   Claude Code sessions (D1). Add modules (`init --with art,maps`) and a scheduled update pull request in each
   consumer repo. Code that imports the engine installs a package file attached to each GitHub release.
3. **Review where the project lives.** The review UI ships inside the install (`artgen ui`), so it always matches the
   engine version and writes straight to the files. Cloud sessions review on the GitHub pull request instead (§5b).
4. **Make the loop run both ways.** Each consumer repo can send back a feedback bundle (`artgen report`) and its local
   edits (`artgen upstream`). This repo turns them into consumer fixtures and tests every release against them before
   it ships. Metrics from every generator in every repo are pooled, so you can see if a change made the work faster.
5. **One workflow for everything.** Every generator goes through the same steps: Reference → Prompt → Theme → Data
   sheet → Iterate → Review → Approve → Metrics. Today only pixel assets have the full loop. Maps have no versions,
   approval or metrics.
6. **Make the production stages explicit.** The stages are Placeholder → Shape → Rig → Decorate → Decal/effect →
   Lighting → Rotation → Animation. Each stage gets its own file, check, cache and an optional approval gate. A wrong
   silhouette then gets caught before anyone pays for decoration and animation, which is how studios use a greybox.
7. **One source, many outputs.** A 3D asset written once renders as a true 3D mesh, as voxels, and as every 2D and 2.5D
   view, and `artgen convert` brings outside meshes and `.vox` files in (§8b).
8. **The image tools join the pipeline.** The SVG Tracer and Token Cutter become `imagekit` operations that the CLI,
   MCP and web all share. They feed the asset and map pipelines, and more mid-level tools of the same kind follow
   (§6b).

Section 13 gives models, effort levels and usage estimates for running each phase on the Pro plan.

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
| | 3D | ✅ | R7a: smooth or faceted meshes under a budget, UVs, baked colour / normal / roughness textures, `.glb` ([`MESHES.md`](MESHES.md)). Rigged meshes are R7b |
| **Camera** | Top-down, side, iso | ✅ | `views/camera.ts`: affine pixel-art cameras |
| | FPS | ◐ | billboards, wall/floor textures, view-models, raycaster preview (D9). No true perspective camera |
| | Free camera | ✅ | R7a: a perspective orbit camera, turntables and the orbit view in Asset Lab |
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
| | MCP | ✅ | about 45 tools, defined by hand in `artgen-mcp/src/server.ts` (R2: generated from the operation registry) |
| | Web UI | ✅ | 8 tools. Three of them (Terrain, Dungeon, Settlement) repeat each other's editor code |

Known gaps from the archive still apply: acceptance never ran in a local session, scores were mostly self-scored, and
some tiles sit below the bar.

## 3. How other projects do it

Each row names a pattern that is common in the field, the well-known tools that use it, and what this plan takes from
it.

| Concern | Common practice | Examples | What we take |
|---|---|---|---|
| Stages of an asset | Blockout/greybox → model → UV/texture → rig → animate → light → integrate, with a review gate between stages | game and film pipelines; level-design greyboxing | §8 stage graph, starting with the placeholder stage and gates |
| Procedural graphs | Each step is a node with typed inputs and outputs. Results are cached, and only nodes whose inputs changed run again | Houdini PDG/TOPs, Substance Designer, Blender Geometry Nodes | stage cache keys (§8). A node view in the web UI later (R8) |
| Review and approval | Versions per task, notes drawn on the frame, status (WIP → review → approved), dashboards | Autodesk Flow Production Tracking (ShotGrid), ftrack, Kitsu | one review model for assets and maps (§7) |
| Pixel-art tooling | Scriptable editors, batch export, sprite-sheet packing | Aseprite CLI (`--batch`), TexturePacker | already there (pack export). Keep exports importable by these tools |
| 2D rigs | Bones, skins and a reusable skeleton per body type, retargeted across characters | Spine, DragonBones | a shared rig library (R6) |
| Map generators | Seeded generator + hand edits + a layered file | Watabou's city/dungeon generators, Azgaar, Dungeondraft, LDtk/Tiled | already there. Add Tiled/LDtk export for game use (R7) |
| Interchange formats | open, versioned formats | glTF 2.0, OpenUSD, MagicaVoxel `.vox`, Tiled TMX, LDtk JSON | glTF for 3D, keep `.vox`. Format versions already exist |
| Sharing code into many repos | "copy into your repo" from a registry, with an `add`/`diff` command | shadcn/ui registry, copier (`copier update`, a 3-way merge) | the committed install is this model. Add modules and upstream diffs (§4–5) |
| Keeping consumers current | bot-opened update pull requests | Renovate, Dependabot | a scheduled update workflow shipped with the install (R3) |
| Not breaking consumers | consumer-driven contract tests: each consumer states what it relies on, and the provider runs those checks | Pact | consumer fixtures already do this for setting_builder. Make it the default for every consumer (R4) |
| Monorepo hygiene | enforced package boundaries, per-package versions | Nx module boundaries, dependency-cruiser, Changesets | R1 boundary rule, R3 versions per module |

## 4. Second repo or `npx` install?

You asked whether a game repo should pull this in as a second repo with only what it needs, or keep the `npx`
install.

| Option | Cloud sessions | Takes only what's needed | Updates | Two-way | Verdict |
|---|---|---|---|---|---|
| **A. `npx …#artgen-dist init` (today)** | ✅ files are committed | ◐ all or maps-only | `update`, by hand | one way | keep, extend |
| A+. A with modules (`init --with maps`, `add art`) | ✅ | ✅ | scheduled pull request | `report`, `upstream` | **chosen** (§12) |
| B. git submodule / subtree of a slim dist repo | submodule ✗ (not documented in cloud), subtree ✅ | ✅ | `subtree pull` | `subtree push` sends edits back | heavy for collaborators. Skills still have to be copied into `.claude/` |
| C. npm package dependency | ✅ after `npm install`, but needs the network or a lockfile cache | ✅ | Renovate | ✗ | needs an npm account and a registry to publish to; not chosen (§12) |
| C′. Package file attached to a GitHub release | ✅ same as C | ✅ | bump the URL | ✗ | for **code** consumers (runtime, mapgen library); no account needed |
| D. Plugin marketplace | ✗ in cloud (D1) | ✅ | auto | ✗ | optional, local only |
| E. Split the source into separate repos | n/a | n/a | releases in lockstep | n/a | not now (D2 still holds: the UI and CLI must run the same engine) |

**Decision (§12): one source repo; install from this git repo as today, with modules.** No npm account or registry.

- **Claude Code tooling** (skills, agents, commands, CLI and MCP bundles, and the review UI from §5b) installs with
  `npx -y github:rstevenson1237/image_tools#artgen-dist init`. `npx` fetches the `artgen-dist` branch from GitHub and
  runs its installer once; the installer copies the chosen modules into the game repo, where they are committed. After
  that, sessions need no network.
- **Code that imports the engine** (a game's runtime, a tool like setting_builder that builds maps in code) installs a
  package file that each release attaches to its GitHub release, for example `npm install
  https://github.com/rstevenson1237/image_tools/releases/download/artgen-v0.12.0/artgen-mapgen-0.12.0.tgz`. The
  release workflow already creates GitHub releases and attaches the Python files, so this adds files, not a service.
- The source stays in this repo, which avoids version skew between the web UI and the CLI.
- The installer gets **modules**: `core` (always), `art`, `maps`, `ui` and `update-pr`. A module is a list of skills,
  commands, agents, bundles and the `CLAUDE.md` section it needs. `MANIFEST.json` records the modules a repo has.
- The `maps` module is a first-class product (`mapgen`), with its own version line and changelog section. The
  maps-only bundle setting_builder uses today becomes this module. Its command stays `artgen map …` (§12).
- New tools join the same way: a package in this repo, a module in the installer, and a group of `artgen`
  subcommands.

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

- **`artgen report <asset|map> [--note]`** writes `art/feedback/<date>-<id>/`. (The older `artgen report <dir>`, a markdown report on benchmark runs, is now `artgen bench-report <dir>`.) It holds the input file, the
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
  `npx -y github:rstevenson1237/image_tools#artgen-dist update` and opens a pull request with the changelog section,
  and it never overwrites local edits (it already refuses without `--force`). Code that installs a release package
  file gets its URL bumped in the same pull request.
- **Metrics pooling.** Every generator reports metrics: art assets, all three map engines, and any tool added later
  (§12). The `workflow` package (§7) makes this part of what a generator must provide, so a new tool can't skip it.
  `artgen metrics export` writes counts and ratios only (passes, tokens, minutes, scores, check failures, per kind and
  per version) to `art/metrics/<version>.json`. There are no images and no prose. It is on by default in your own
  repos.
  `analytics --across` already pools across repos; a script here collects the files from known consumers. This is
  how you check whether a release made production cheaper.
- **Lessons.** When the pooled metrics show a pitfall that repeats (a gate check that fails often, or a kind that
  needs extra passes), it becomes a line in the skill's *Pitfalls* section or a template change. The bench runs
  before and after, as the archive phases did.

## 5b. Getting review feedback back to the project

**How it works today.** You open the hosted image tools site and point it at the game's `art/` folder. In Chromium
that is a live folder handle: approvals and notes are written straight into `art/` (ledger lines appended, never
rewritten, and a write is refused if Claude Code changed the file meanwhile). In Firefox and Safari it is a zip round
trip: zip the repo, import it, download `art.zip`, and unzip it over the repo.

**What was checked, and what wasn't.**

| Path | Status |
|---|---|
| Folder handle, written by the UI and read by the CLI | tested in headless Chromium against the origin-private file system (the acceptance script) |
| A real folder on your machine, with a local Claude Code session | **never run** (archive gap: no local-session acceptance) |
| Zip round trip | **never run** (archive: "Firefox zip fallback untested") |
| **A cloud session** (claude.ai/code, or the phone app) | **no working path.** The repo lives in a container you can't open from the browser. You would have to clone it locally, review, commit, push, and get the session to pull |

There is also a version problem. The hosted site runs the newest engine, but each game repo pins its own version. A
render or a gate check in the UI can then differ from what the repo's CLI shows.

**Recommendation: two paths that write the same ledger entries.**

1. **Local sessions: ship the review UI inside the install.** `tools/artgen/ui/` holds a static build of the art tools
   (Direction, Review, Lab, plus the map editors in the `maps` module) without OpenCV, about 1–3 MB to check in R3.
   `artgen ui` starts a small local server that serves the UI and reads and writes `art/` through the CLI's own file
   layer. It works in every browser (no folder picker or zip), always matches the repo's engine version, and Claude
   Code sees each approval at once. Claude can start it during `/artgen-review` and give you the link.
2. **Cloud sessions and the phone: review on the pull request.** `/artgen-review --pr` commits the review renders
   (small PNGs: the final in context, plus a before/after for each changed asset) and a review table to the session's
   pull request. You answer in a pull request comment, one line per asset: `approve goblin`, or
   `goblin: arms too long`. The session watches the pull request and records each line with `artgen approve` or
   `artgen feedback` (`via: pr`), then reworks and pushes. GitHub shows images in pull requests in the browser and the
   mobile app, so this needs nothing new installed.

The hosted site stays for the standalone tools (Token Cutter, SVG Tracer, maps without a repo) and as a quick viewer.
Notes pinned to a region of the sprite stay a UI-only feature; a pull request comment carries text only.

## 6. Target architecture

```
                 ┌──────────── interfaces ─────────────┐
                 │  cli   mcp   python   web (src/)    │   generated from one op registry (§9)
                 └──────────────────┬──────────────────┘
                 ┌──────────────────┴──────────────────┐
                 │  workflow: ledger, versions, review, │   shared by every generator (§7)
                 │  approve, metrics, stage runner      │
                 └───┬──────────────┬──────────────┬───┘
     ┌───────────────┴──┐  ┌────────┴─────────┐  ┌─┴────────────────┐
     │ artgen: direction│  │ mapgen: terrain, │  │ imagekit: trace, │
     │ briefs, passes,  │  │ dungeon, settle- │  │ cut, quantise,   │
     │ gates, export    │  │ ment, facts, lint│  │ slice, convert   │
     └───────────────┬──┘  └────────┬─────────┘  └─┬────────────────┘
          ┌──────────┴──────────────┴──────────────┴───────────┐
          │ scene: Scene2D/3D, proc layers, finish, voxel,     │
          │ meshes, views + cameras, anim + rigs, fx, textures │
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
| `mapgen` | `map/`, `dungeon/`, `settlement/`, `maps.ts` | primitives (+ workflow from R5) |
| `workflow` | new; ledger and status logic moved out of `qa/ledger.ts`, `w2/status.ts`, `pipeline.ts` | primitives |
| `imagekit` | `src/tools/TokenCutter` and `SvgTracer` processing (OpenCV in a browser worker until R5b), `lib/palette.ts` extract, `lib/trace.ts` | primitives |

`artgen-core` stays as a facade that re-exports everything, so the CLI, web app and examples keep working while
imports move over. In the web app, `src/tools/` gets three groups: **image** (Token Cutter, SVG Tracer and the tools
in §6b), **maps** (the three map editors, sharing one editor shell) and **art** (Direction, Review, Lab).

**How much existing code is kept.** Today there are about 21k lines in the engine, 7k in the CLI, 0.9k in the MCP
server, 1.9k in the runtime and 11k in the web app (tests included). Nearly all of the engine and runtime moves into
the new packages unchanged: R1's test is that output stays byte-identical. The parts that are replaced, rather than
moved, are small:

- the hand-written argument parsing in the CLI and the tool list in the MCP server, which the registry generates (R2);
- the OpenCV processing in the two image tools, rewritten in TypeScript (R5b);
- the three map editors' repeated code, merged into one shell (R1).

New code goes on top: the workflow package, the stage runner, true 3D meshes, converters, the bundled review server
and new image tools. By line count, roughly nine tenths of the finished suite is today's code.

## 6b. The image tools join the pipeline

Today the SVG Tracer and Token Cutter run only in the browser, through a 10 MB OpenCV build, and nothing else can call
them. Their links to the pipeline (a traced outline → a `path` primitive, a cut-out → a clip mask) were specified and
never built. They become **imagekit**: plain TypeScript operations in the registry, so the CLI, MCP, Python and web
all get them. The thresholding, blob, contour and simplify steps they use are short algorithms; the engine already
has marching squares (`lib/trace.ts`) for map contours.

| Tool | What it does in the pipeline |
|---|---|
| **Trace** (SVG Tracer) | a reference image or sketch → editable `path` primitives in a `Scene2D` base, or a map outline (coast, cave, building footprint) |
| **Cut** (Token Cutter) | VTT tokens from generated characters and creatures; clip masks; silhouettes for the Shape gate |
| Palette | extract and quantise from a reference (already in the engine, now a tool) |
| Slice | split an outside sprite sheet into cells and import it as a reference or a placeholder |
| Heightmap | an image → a terrain underlay for `mapgen` |
| Turntable | any 3D or voxel asset → a strip of fixed angles for review sheets (`artgen turntable`, built in R7a) |
| Print tiles | a map → page-sized tiles with overlap marks (the page layout exists for maps) |

A new mid-level tool follows the same recipe: one registry operation in `imagekit` (or its own package), and the web
tool is a thin page over it. Each one then appears in every interface without more work.

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
| Voxel | built | built | built | `.vox`/`.glb`, built | orbit preview, built (R7a) |
| True 3D (glTF meshes) | built (R7a) | built (R7a) | built (R7a) | built (R7a) | built (R7a) |

Voxel and true 3D are both targets (§12), built from the same `Scene3D` primitives:

- **Voxel** keeps today's path: cells, `.vox`, greedy-mesh `.glb`.
- **True 3D** turns the primitives into real meshes (smooth or faceted, with a set polygon budget). The meshes get
  UVs, and their textures (colour, normal, roughness) are baked from the direction's palette and the same proc layers.
  Each mesh is skinned to the shared rig library (§8, stage 2), with animation clips and levels of detail, and the
  whole asset exports as one `.glb`. A restyle re-bakes the textures, so 3D assets keep the direction model.
- Generated images stay out (D18): every texture comes from code and the palette.

## 8b. Moving assets between formats

Today a `Scene3D` asset already renders as voxels and from there as iso, top-down, oblique, side, billboard and
sprite-stack views, and exports `.vox` and `.glb`. The plan keeps that rule: **one source, many outputs**. The
source is the primitive description, never a rendered output, so nothing is converted twice and nothing loses detail.

| From → to | How | Loss |
|---|---|---|
| `Scene3D` source → true 3D mesh, voxel, 2D/2.5D views | render, as today (mesh output: `artgen mesh`, R7a) | none: each is a render of the source |
| An outside mesh (`.glb`) → voxel | `artgen convert --to voxel`: voxelise at the direction's scale, snap colours to the palette | fine detail below one voxel |
| Voxel → 2D/2.5D views | every view module, as today | none |
| `.vox` (MagicaVoxel) → asset | read with the existing `.vox` decoder, then a `Scene3D` that wraps the cells | none |
| An outside mesh → asset | a wrapped mesh asset: renders as the mesh, voxelises for the pixel views | as the row above for pixel views |
| `Scene2D` → 3D | `extrude`: a 2D shape becomes a slab with depth (good for props, tiles, signs, weapons) | no real depth: fine for flat objects, not for characters |
| A rendered sprite → 3D | not offered: a picture doesn't hold enough to rebuild a shape | — |

A converted asset goes through the same review and gates as any other. Converting into a format records where the
asset came from in the ledger, so a restyle of the source re-runs the conversion.

## 9. One operation registry for all interfaces

Settlement editing already shares one operation vocabulary between the CLI, MCP and web tool. R2 makes that the rule
everywhere: each operation is declared once (name, input schema, output schema, side effects, which module owns it).
From that one declaration:

- the CLI gets its flags and `--help`;
- MCP gets its tool list and schemas (replacing the hand-written list in `server.ts`);
- Python gets its methods and type hints (the client stays a thin wrapper around the CLI);
- the web UI gets its forms and the commands it can call in the worker;
- the docs get a reference table, and a parity test fails when an interface is missing an operation.

The Node/JS library interface comes from R1 + R3: `primitives`, `scene`, `mapgen`, `imagekit` and `runtime`, built to
JS with type declarations and attached to each GitHub release as package files (§4). Today the packages export
TypeScript source.

## 10. Phases

Sizes follow the archive plan: S is about one session, M is 2–3 sessions, L is 4 or more. Each phase ends green on
`npm run check`, `npm test`, `check:packages`, `test:packages` and the bench. Each phase also states what it makes
faster for the phases after it.

### R0 — Baseline and boundaries (S) — done 2026-10-29
- Record today's numbers from the ledgers and bench: passes, tokens and minutes per approved asset; first-pass
  approval rate; gate failures by check; build and test time; bundle sizes.
- Add a boundary lint (dependency-cruiser, or a small script) that encodes §6's arrows, warning only for now.
- Pick the KPIs in §11 and write them to `docs/metrics/baseline.json`.
- **Makes later work faster:** every later phase has a number to beat, and new cross-module imports stop appearing.
- **Accept:** baseline file committed; the lint runs in CI.
- **Built:** `scripts/metrics-baseline.mjs` writes [`docs/metrics/baseline.json`](metrics/baseline.json)
  (see [`metrics/README.md`](metrics/README.md)); `scripts/check-boundaries.mjs` is the lint (`npm run
  lint:boundaries`). It found 15 imports that point the wrong way, mostly the scene layer importing `direction.ts`: R1
  has to move the direction types below `scene` before the lint can go strict.

### R1 — Package split, no change in behaviour (M–L) — done 2026-10-29
- Move the code into `primitives`, `scene`, `artgen` and `mapgen` (§6). `artgen-core` stays as a re-exporting facade.
- Split the web app's sidebar into the image, maps and art groups. Pull the code the three map editors repeat into
  one shared map-editor shell.
- Turn the boundary lint into an error.
- **Makes later work faster:** a mapgen change no longer rebuilds or retests the pixel pipeline (per-package test
  runs), and each module can be released on its own.
- **Accept:** the bench and fixtures give byte-identical output; the dist bundles are no larger; the boundary lint
  passes; the web app's build is no larger.
- **Built:**
  - Three new packages, `artgen-primitives`, `artgen-scene` and `artgen-mapgen`, each with its own `index.ts`, typecheck
    and tests (`npm run test -w artgen-mapgen` no longer runs the pixel pipeline). Files moved with `git mv`; the only
    edits to them are import paths. A package also exports its files by path (`artgen-scene/direction.ts`).
  - `artgen-core` keeps the **artgen** layer (render, pipeline, QA, W1/W2) and is the facade: `src/index.ts` re-exports the
    three packages, and `artgen-core/maps` re-exports `artgen-mapgen`. The CLI, MCP server and web app are unchanged.
    The plan's separate `artgen` package is not cut out: the facade would have had to be a fourth package that
    re-exports it, for no gain yet.
  - To make the arrows point down: `direction.ts` (a leaf module the scene layer reads through `DirContext`) moved into
    `artgen-scene`, and `finish.ts` (it works on a `RenderResult`, and nothing in the scene layer uses it) moved from
    `t2/` into the artgen layer. The ledger and status logic still import `conformance`, `metrics` and `pipeline`, so
    they stay in the artgen layer; the `workflow` package is built in R5.
  - `npm run lint:boundaries -- --strict` runs in CI with one package per layer: **0 violations** (R0: 15). Test files
    are linted too. The one allowed exception is the runtime's type-parity test, which imports `artgen-core` on purpose.
  - Tests that render through the pipeline (`direction`, `t2`, `tex`, `anim`, `voxel`, `fp`) stay in
    `artgen-core/src/scene/`. The parts that need only the scene layer moved to `artgen-scene` (21 tests).
  - Web: the sidebar has three groups (image, maps, art). `src/core/maps/` holds the shared map-editor shell
    (`MapEditorShell.svelte` with the layout and shared styles, `MapProjectFiles` for open / save / download,
    `createPreviewLoop` for the debounced render, and the input and font helpers). Terrain, Dungeon and Settlement use it
    and shrink by about 600 lines in total; the shared modules add about 340 (net −260). Behaviour is unchanged (screenshots
    before and after match).
  - Measured against the R0 baseline: all tests pass with the same counts; the bench golden hashes and the consumer
    fixtures are unchanged; the maps-only bundle's import graph is still primitives + mapgen only. Raw bundle size is
    +0.06% (`artgen.js` +855 B, `artgen-maps.js` +162 B), all from longer package names in the bundler's per-module path
    comments; gzip size is within ±0.03% (two bundles smaller, `artgen-maps.js` +35 B). The web build is 8.5 KB smaller
    in JS and 12 KB smaller overall.

### R2 — Operation registry (M)
- Add the registry (§9) and move the map, dungeon and settlement operations onto it first, since they already share
  a vocabulary. Then move the asset operations.
- Generate the MCP tool list, the CLI help and the Python methods. Add the parity test.
- **Makes later work faster:** a new operation is written once instead of four times, so R5–R7 features reach every
  interface for free.
- **Accept:** the MCP tool list comes from the registry; the parity test passes; the Python tests pass unchanged.
- **Built:** the design and what was built are in [`OPERATION-REGISTRY.md`](OPERATION-REGISTRY.md); the generated
  reference of every operation is [`OPERATIONS.md`](OPERATIONS.md).
  - Every CLI command and MCP tool is one declaration in `packages/artgen-cli/src/ops/` (114 operations). The art
    operations are in `art-*.ts`, and the map, dungeon and settlement ones are in `maps-*.ts`, which the maps-only
    bundle holds alone. A declaration gives the name, the module, the typed parameters, the side effect, the
    implementation, and how each interface shows it.
  - The CLI's `main()` has no command branches left. One parser reads every command's flags from its declaration.
    `artgen --help` and the new `artgen <command> --help` are generated. Unknown flags and extra arguments are now
    errors instead of being ignored. Every `{{ARTGEN}}` example in the shipped skills (80 lines) still parses.
  - The MCP tool list is generated: today's 44 tools in today's order, plus `brief_add`, `brief_list`, `map_facts`,
    `map_check`, `dungeon_facts` and `formats`. Every operation that is not a tool states why (a batch tool covers it, it
    reads a path outside `art/`, or the user or a skill drives it). An MCP call reaches only the arguments in its
    schema, so a CLI-only path argument can't escape the sandbox.
  - The CLI gains what only MCP had: `conformance`, the batch edits (`dungeon edit <id> --ops '<json>'`, `map update`,
    `settlement edit`, …) and `direction show --candidate`.
  - The Python client gets a generated method for every CLI command (`python/artgen/src/artgen/_ops.py`, made by `npm
    run gen:ops`). The hand-written methods are unchanged and the Python tests pass unchanged.
  - The dungeon edits had two implementations, one in the CLI and one in `dungeon_edit`. They are now one vocabulary,
    `editDungeon`, in `artgen-mapgen`, beside `editSettlement`, so the web editors can use it.
  - Guards: transcripts of 556 CLI commands and of every MCP tool, recorded before anything moved, are unchanged. A
    snapshot of the old MCP schemas is still satisfied. A parity test checks that every operation is on the CLI, MCP
    and Python or names its reason, and that the generated files are current. The bench golden hashes are unchanged.
  - Bundles grew: `artgen.js` 1.35 → 1.48 MB, `artgen-mcp.js` 1.22 → 1.48 MB and `artgen-maps.js` 0.53 → 0.62 MB. The
    MCP bundle now holds every command's text formatting, and every bundle holds the usage text.
  - Left for R8: building the web UI's forms from the registry (`ops/registry.ts` has no Node imports, so the web app
    can use it).

### R3 — Modular install, bundled review UI, update pull requests (M–L)
- Add installer modules (`core`, `art`, `maps`, `ui`), plus `init --with`, `add <module>` and `remove
  <module>`. Record the modules in `MANIFEST.json`.
- Give `mapgen` its own version line in the changelog. Keep the format versions as they are.
- Ship the opt-in `artgen-update.yml` workflow (§5).
- Ship the review UI in the `ui` module and add `artgen ui`, the local server (§5b). Run the first real local-session
  review on your machine: open, approve, give feedback, and see Claude Code pick it up.
- Attach the library package files (`runtime`, `primitives`, `scene`, `mapgen`) to each GitHub release (§4).
- **Makes later work faster:** consumers stay current without being asked, so feedback arrives about the current
  version, not an old one; reviews no longer depend on the hosted site's version.
- **Accept:** a maps-only install has no art skills in it; an update opens a pull request in a scratch repo; `artgen
  ui` approves an asset in Chromium and Firefox and the CLI shows it; the release acceptance script passes for both
  modules.
- **Built:** see [`packages/artgen-dist/README.md`](../packages/artgen-dist/README.md) for the layout.
  - **Modules.** The distribution is built module by module (`content/<module>/` holds each one's skills, agents, commands
    and `CLAUDE.md` fragment) and `dist/modules.json` lists the files of each; the build fails if a file belongs to none or two.
    `core` is the rasteriser, fonts and `VERSION`; `art` the full CLI, MCP server, templates, runtime and art skills; `maps`
    `artgen-maps.js` and the three map skills (they call the maps-only bundle, so a maps-only repo has everything they use);
    `ui` the review UI; `update-pr` the workflow. `init` installs `core`, `art` and `maps` (what an install held before);
    `init --with`, `add`, `remove` and `modules` are new, `status` shows the version of each. A manifest from before
    modules counts as `core`, `art` and `maps`. `remove` deletes untouched files and keeps edited ones; the `.mcp.json`
    entry and the `CLAUDE.md` section follow the modules.
  - **mapgen's own version line.** `packages/artgen-mapgen/package.json` (0.11.0) is the version of the `maps` module, of
    `artgen-maps.js --version` and of its library package file. `scripts/artgen-release.mjs` moves it a patch when a commit
    since the last tag touched the map engines (`--mapgen` decides otherwise), and each changelog section names it and lists
    those commits again under `### mapgen`. Format versions are unchanged.
  - **Update pull requests.** `artgen-update.yml` (module `update-pr`) runs `update --notes` weekly and on demand, pushes
    `artgen-update-<version>` and opens (or edits) a pull request whose text is the changelog since the installed version,
    the modules moved and the files kept because they were edited. `update` also moves the release URLs of the library
    packages in the game's `package.json`. `scripts/artgen-release-acceptance.mjs` runs the workflow's own steps against a
    stand-in `gh` and a bare `origin`; it has not run on GitHub.
  - **Review UI.** `artgen ui` (operation `ui`, module `core`: in `artgen.js` and in `artgen-maps.js`) serves
    `tools/artgen/ui/` and a file API over `art/` on 127.0.0.1: token in the link, `Host` check, paths confined to `art/`
    (no `..`, `.git` or links out). The page is the web app built in bundle mode (`vite.ui.config.ts`, 1.3 MB: no OpenCV
    tools, and the rasteriser and fonts are the `core` module's files, served from `tools/artgen/`). It uses an `HttpFiles`
    backend beside the folder-handle and zip ones, so it needs no folder picker and runs the repo's own engine version. The
    sidebar shows the tools of the installed modules. `scripts/artgen-ui-bundle-accept.mjs` drives it in headless Chromium
    through the Art Direction, Asset Review and Asset Lab flow of the older acceptance and checks a maps-only repo's sidebar.
  - **Library packages.** `packages/artgen-dist/pack-libs.mjs` builds `artgen-runtime`, `artgen-primitives`, `artgen-scene`
    and `artgen-mapgen` (tsc output with declarations, `npm pack`; `primitives` and `scene` follow the release version, the other
    two their own lines) and the release workflow attaches them. A test unpacks them like `npm install <url>` would, imports
    them in Node and type-checks a consumer with the library check on.
  - **Not done here.** The first review on your own machine in a real local session, and in Firefox (not installed in the
    sandbox this was built in; the file API is plain `fetch`, so nothing in it is browser-specific). The update workflow and
    the release attachment have not run on GitHub. A maps-only install has no MCP server (the maps tools are in
    `artgen-mcp.js`, which belongs to `art`). Size: the installed UI is 1.3 MB (the estimate was 1–3 MB); the copy
    of the rasteriser and fonts it would have carried (3.2 MB) is shared with the `core` module instead.

### R4 — Feedback loop (M) — built 2026-10-29, acceptance not run
- Add `artgen report`, `artgen upstream`, `artgen metrics export`, the issue template, and the intake script that
  turns an issue into a fixture.
- Add pull request review for cloud sessions (`/artgen-review --pr`, §5b), and run it once from the phone app.
- Run consumer CI before each release, and pool the metrics with `analytics --across`.
- Run a full local-session production run on your machine with your own choices (the archive's known gap).
- **Makes later work faster:** real failures become regression tests, and the metrics show which stage costs most,
  which decides the order of R6's work.
- **Accept:** one real report from setting_builder goes through the whole path, from issue to fixture to fix to
  release to update pull request; pooled metrics show two repos.
- **Built:**
  - **`artgen report <id>`** (operation `report`, module `core`: the maps-only bundle has it too). It finds the id as an asset,
    map, dungeon or settlement in the project (`--kind` when it is more than one; `--file <path>` for a map file outside a project)
    and writes `art/feedback/<date>-<id>/`: the input file (an asset's folder, the direction and config, and the asset's own brief cut out of `briefs.yaml`), the render (a map's
    SVG and PNG; an asset's latest review sheet), the ledger lines of that asset, `case.md` in the consumer-fixture layout (kind,
    format version, consumer repo and commit, artgen version, the command, what `check` says), `report.json` and `ISSUE.md`, the text
    of the issue. Nothing is sent. `--issue` opens the issue on this repo through the GitHub API when `GH_TOKEN` or `GITHUB_TOKEN` is
    set, and prints a prefilled link when it is not. The old `artgen report <dir>` (benchmark markdown) is now `artgen bench-report <dir>`.
    The issue template is `.github/ISSUE_TEMPLATE/artgen-feedback.md`.
  - **`artgen upstream`** (module `core`). The build now records where each copied file comes from (`dist/modules.json` `sources`, and
    `sources` in the install's `MANIFEST.json`: skills, agents, commands, templates, runtime, the update workflow; bundles are built, so
    they are listed as `built` and have no patch). `upstream` compares each installed file with the manifest hash and writes the edited
    ones as one unified diff against the source paths (`art/feedback/upstream-<date>.patch`), with the build's `{{ARTGEN}}`, `{{CMD}}`
    and `{{CMD_DIRECTION}}` put back so the patch applies to the sources with `git apply`. The file as installed (the diff's base)
    comes from `--base <artgen-dist folder>` or from the release tag on GitHub, and a base that is not the installed file is flagged. An
    install made before this release has no `sources`: one `update` records them. New commands `/artgen-report` and `/artgen-upstream`
    (a new content folder for the `core` module, which also has a `CLAUDE.md` section now) and `/artgen-metrics` (art).
  - **`artgen metrics export`** (module `art`) writes `art/metrics/<artgen version>.json`: counts and ratios from the ledger and briefs
    (assets, approved, passes, tokens, minutes, scores, first-pass approval, gate failures by check, per kind), the artgen version and
    the modules; no images, ids, notes or paths. `artgen metrics pool <file|folder>…` puts exports from several repos side by side per
    artgen version. `npm run metrics:pool` pools `docs/metrics/pool/` (see `docs/metrics/README.md`); `analytics --across` is unchanged.
  - **Intake.** `scripts/artgen-intake.mjs <issue number | issue.json | ISSUE.md>` (or `--bundle <folder>`, which also takes asset
    bundles) writes `packages/artgen-cli/fixtures/<consumer>/<case>/` with the input file and the case.md marked `status: reported`
    and `intake: <issue>`; it refuses a report with no consumer commit and never overwrites a case without `--force`. The fixture
    tests hold every `status: reported` case to the minimum (it parses, `check` and a render run, the render is the same twice; an
    asset renders in a scratch project) until the maintainer writes down its facts. `.github/workflows/artgen-intake.yml` runs it for
    an issue number and opens a pull request.
  - **Review on the pull request.** `artgen pr prepare [ids]` copies each final's review sheet (and the sheet of the version the last
    feedback was on, as the "before") to `art/review/` and writes `REVIEW.md`; `artgen pr parse` reads the user's comment (`approve
    goblin`, `goblin: arms too long`, `goblin: finish: eyes too dark`) into the calls it asks for, and lists lines that name no asset
    apart; a quoted line (`> approve goblin`) is never read as a command. `approve` and `feedback` take `--via pr`, recorded in the ledger like the UI's `"via": "image-tools"`. `/artgen-review --pr` and
    the asset-production skill §4 say how the session commits `art/review/`, asks in a comment and watches for the answer.
  - **Consumer CI.** `scripts/artgen-consumer-ci.mjs` runs every fixture case against the candidate build (the bundles, not the
    sources): `check` must exit as case.md says ("Must go on failing" or not), and a passing case renders the same SVG twice. It runs in
    CI (`consumers` job), in `artgen-dist.yml` before the branch is published and in `artgen-release.yml` before anything is. The
    facts each case states stay with the fixture tests (`npm test`).
  - **Pooled metrics.** `docs/metrics/pool/` holds exports from this repo's three example games and the pooled table. They stand for
    the mechanism only: they were made from `dev` sources over ledgers older versions wrote.
  - **Not done.** The acceptance runs need people and repos this session does not have: one real report from setting_builder through
    issue, fixture, fix, release and update pull request; a review answered from the phone app; a full local-session production
    run; exports from two real consumers. `--issue` is tested against a stand-in `fetch`, and `upstream`'s fetch from the release tag
    against a local folder; neither has talked to GitHub (the tag fetch needs the repository to be readable without a token). The
    intake workflow and the new CI steps have not run on GitHub.

### R5 — One workflow for maps and assets (M–L) — built 2026-10-30
- Build the `workflow` package (§7): versions, ledger, review and approval for maps; map briefs; map themes as a
  locked direction; the one-page data sheet for both maps and assets; references shown on review sheets.
- Make metrics part of what every generator must provide, so terrain, dungeon and settlement maps report the same
  fields as art (§12).
- The Asset Review tool lists maps as well.
- **Makes later work faster:** maps get metrics, so map work can be tuned the same way art is; a single review tool
  is less code to maintain.
- **Accept:** a map goes through v1 → review → approve in the CLI and in the web UI, and analytics include maps.
- **Built:** the design and what was built are in [`WORKFLOW.md`](WORKFLOW.md) (§15 lists where the build differs from it).
  - **The `artgen-workflow` package** (`packages/artgen-workflow`, the `workflow` layer, depends on primitives only). The ledger format, the
    asset status rules and analytics moved out of `artgen-core` with `git mv` (one-line re-exports stay at the old paths). New in it: subject
    keys (`map:keep`), version names and `diffJson`, `subjectStatus` (the art status names for a map), `generatorMetrics`, the data sheet
    (markdown and picture, 1568 px cap), the map brief's front matter, and the approval and feedback rules as ledger entries. mapgen may import
    it (`ALLOWED.mapgen` is `primitives`, `workflow`); the maps-only bundle holds its files (the graph test names them) and still holds neither
    `yaml` nor the pixel pipeline. The library packages gain `artgen-workflow` (mapgen's file depends on it).
  - **Maps, dungeons and settlements are subjects.** One factory declares `brief`, `version`, `diff`, `review`, `feedback`, `approve`, `status`
    and `sheet` for each kind, and `map direction` (26 new operations with the art `sheet`: 147 operations in all, on the CLI, MCP and Python).
    They write the shared `art/ledger.jsonl` under a subject key, so every art reader ignores them; a version is a byte copy beside the working file
    (`map.v1.json`, refused when nothing changed); `review` renders the version in the map direction's theme and puts the render, the data sheet and
    the references on one sheet. Only the user approves or gives feedback or locks the direction (MCP: `user_approved`); an approval needs status `final`
    (the file equals a version, no feedback open) and no failing check. A map whose approval went stale only because the
    map direction changed (the file is unchanged) is approved again as the same version, since no new version can be recorded. They need a project, so none takes `--file`.
  - **The map direction** (`art/map-direction.json`): a theme for each kind and the symbols a kind may use, with a version and a lock. Only a locked one
    applies, to review sheets, checks and staleness; `map render` is unchanged. A dungeon's only theme is `bw`.
  - **Data sheets and references.** `artgen sheet <id>` writes an asset's one-page sheet (the same `assetDataSheet` Asset Review shows); briefs may
    list `refs: [refs/x.png]`, drawn in a REFERENCES row on every review sheet (a missing or non-PNG one is skipped with a warning).
  - **Metrics.** `generatorMetrics` gives the same fields for `art`, `map`, `dungeon` and `settlement`. `metrics export` and `metrics pool` are in the
    `core` module now (a maps-only repo exports too); the export is schema 2 with `generators`, its art fields come from `Ctx.artMetrics` and are absent
    without the art module; the pool reads schemas 1 and 2 (the pooled markdown of the three example exports is unchanged). `analytics` adds a Generators
    table once the ledger holds map work; art numbers are the same with map entries in the ledger (tested).
  - **Web.** Asset Review lists maps in the same status groups (kind badge), shows the latest version rendered by the editors' own render functions,
    the versions with any two side by side and their diff, the checks, the data sheet, the brief and the references, and approves or requests changes by
    the CLI's rules. It also shows an asset's data sheet and references. It is available when either art or maps is installed, and works with no locked art
    direction. The engine's subject code is tested against the CLI's on the same files.
  - **Docs and skills:** the three map skills and `maps/claude-md.md` have the steps (brief, generate, version, review, show the user, approve or feedback),
    the art skill's brief section mentions `refs` and `sheet`; `OPERATIONS.md` and the Python methods are regenerated; `metrics/README.md` has schema 2.
  - **Guards.** The bench golden hashes and the consumer fixtures are unchanged (`node packages/artgen-dist/build.mjs --no-ui && node scripts/artgen-consumer-ci.mjs`
    passes). Recorded transcripts change only where they list the maps commands (six group-help lines) and the maps bundle's commands (`metrics` added).
    Four recorded expectations had to change because the design says so: `metrics_export` moves after the maps tools in the MCP tool list (it is a `core`
    operation), the metrics tests expect schema 2 and pass the art numbers in, Asset Review is listed for a maps-only install, and the library packages test
    lists `artgen-workflow`. Tests: root 88 → 96; packages 805 → 886 (cli 275 → 304, core
    153 → 158, dist 73 → 73, mapgen 124 → 133, mcp 29 → 30, workflow 0 →
    37); `check`, `check:packages` and the strict boundary lint pass; the Python tests pass (16). Bundles grew: `artgen.js` 1.54 → 1.61 MB, `artgen-mcp.js`
    1.53 → 1.61 MB and `artgen-maps.js` 0.65 → 0.73 MB (the workflow code, the three subjects and the review sheet, every bundle holds the new usage text);
    the web build is 49 KB larger in JS (1.28 → 1.33 MB; the worker +32 KB).
  - **Acceptance run.** In the CLI, `workflow.test.ts` takes a map, a dungeon and a settlement through version, review, feedback, a new version and approval.
    In the web UI, `npm run accept:ui` (headless Chromium) now also records a map's v1 with `artgen-maps.js`, opens it in Asset Review in a maps-only
    repo, sees its render, approves it there, and checks that `map status` shows it approved with `"via": "image-tools"`. The whole acceptance passes.
  - **Not done here.** Firefox (not installed in this sandbox), a review on a real machine and the first use in a game repo. As designed: pull request review of maps (§12 of the
    design), region pins drawn on map renders, custom inks and fonts in the map direction, art assets as a subject.

### R5b — Image tools join the pipeline (M) — built 2026-10-30
- Rewrite the Token Cutter's and SVG Tracer's processing in TypeScript as `imagekit` operations (§6b), checked against
  today's OpenCV output on a set of test images. Then drop the 10 MB OpenCV asset.
- Wire them in: Trace → `path` primitives and map outlines; Cut → VTT tokens from approved assets and the Shape-gate
  silhouette. Add Palette and Slice as tools.
- **Makes later work faster:** references and sketches become editable shapes in one step instead of being redrawn by
  hand, and each new mid-level tool reaches every interface for free.
- **Accept:** a traced sketch becomes a base that renders and passes the gate; `artgen cut` makes a token from an
  approved asset; the web tools give the same result as before, within tolerance.
- **Built:**
  - **The `artgen-imagekit` package** (`packages/artgen-imagekit`, the `imagekit` layer, depends on primitives only; the boundary lint knows it). Plain
    TypeScript on RGBA pixels (`Grid`, or an `ImageData` as `{ w, h, d }`): `mask.ts` (grey, Gaussian blur, Otsu, threshold, ellipse dilate / erode / close,
    alpha), `contours.ts` (Suzuki–Abe border following, `approxPolyDP`, polygon and border fills), `trace.ts` (`traceImage`), `cut.ts` (silhouette, token crop,
    alpha mask), `palette.ts` (the primitives' median cut and snapping, `.hex` / `.gpl` files), `slice.ts` (grid and loose sprites), `svg.ts`.
  - **Held to OpenCV.** `fixtures/opencv/generate.mjs` runs the old worker's pipeline on real OpenCV 4.10 for 21 pictures (14 synthetic, 7 sprites from the repo)
    with 4 trace and 3 cut settings; `golden.json` is what it gave (257 KB) and `src/opencv.test.ts` holds the TypeScript to it. Result: every mask is the
    same pixel for pixel, every traced ring the same point for point (start point, direction, order, areas, what was dropped, the level Otsu chose). The
    one allowance is the edge of a lasso: `fillPoly` and the TypeScript fill a polygon with slightly different edge rules, so a hand-drawn selection differs by
    a pixel or two along its line (never inside), and the test allows 0.5 % of the selected pixels. Matching OpenCV took five findings, all in the code now
    and in its comments: the grey weights are 15-bit (9798, 19235, 3735), not 14-bit; the Gaussian kernel for sizes over 7 carries its rounding along the
    kernel (each weight is the difference of two rounded running sums); the ellipse kernel rounds its row half-widths; `approxPolyDP` ends with a pass that drops
    nearly collinear points; and `findContours` lists the last blob found first, each followed by its holes (it matters for ties when shapes are sorted by area).
    The OpenCV generator is not a dependency any more; its header says how to run it.
  - **Review fixes.** A review of the change found and fixed: the loose-sprite scan cost grew with `--gap` (it now grows each pixel right and down by the gap and joins the shapes that touch; a
    test checks it against a brute-force pairing at every gap); `dilate` kept a full plane per kernel width (now one at a time); the flood fill allocated per pixel; `trace --fill red` fell back to
    black silently (now an error); a mistyped picture path to `cut` read as a missing asset; the palette argument is a file first and a colour list second (3-digit colours work, any extension
    case); the Palette tool's overlay could stay up after a slider change. Ring points are pixel indexes, as OpenCV gave them (the web SVG Tracer is unchanged); `trace` and `map trace` draw
    through pixel centres, half a pixel in.
  - **Speed.** 512² in about 0.1 s, 1500² in 0.5 s, 3000×2000 in 1–2 s, in a worker.
  - **Command line, MCP, Python** (153 operations now, 6 more, all generated into `OPERATIONS.md` and the Python client). In the core module (so both bundles have them,
    and the maps-only bundle's import graph now allows `artgen-imagekit`): `trace <image>` (an SVG of even-odd shapes), `slice <sheet>` (`--cols/--rows`, `--cell WxH`
    or `--auto`; cells and `slices.json`) and `quantize <image>` (to a list, a `.hex` / `.gpl` / `.png`, or the picture's own colours; optional dither). In the maps
    module: `map trace <id> <image>` (the dark shapes become `paint` edits in map cells, their holes water; `--origin` and `--replace` make it repeatable). In the art
    module: `trace-base <asset> <image>` (the asset's next `base.vN.js`: the shapes as `path` primitives with `fillRule: evenodd`, fitted to the frame in the ramp nearest
    the picture's colour among those the direction allows the kind) and `cut <asset|image>` (a token from an approved asset's render, or a picture's subject; `--fill flat`
    is the flat silhouette the Shape gate will read; `--scale` for whole-number enlargement). None is an MCP tool, each with its reason (they read pictures by path outside
    the `art/` sandbox). `/artgen-image` (core) says which to use.
  - **Web.** `src/workers/opencv.worker.ts`, `scripts/vendor-opencv.mjs`, the `postinstall` / `prebuild` / `predev` hooks and the `@techstark/opencv-js` dependency are gone; Token Cutter
    and SVG Tracer call `imagekit.worker.ts` (same calls and results). New tools: **Palette** and **Sprite Slicer**, in the image group. The production build is 14.9 MB → 4.6 MB
    (the 10.4 MB vendor asset is gone; its JS is 1.28 → 1.36 MB for imagekit and the two tools). `npm run accept:images` drives all four tools in headless Chromium against the
    build (no OpenCV file in `dist/`; trace → SVG; lasso → silhouette PNG; colours → `.hex`; sheet → zip).
  - **Library packages.** `artgen-imagekit` is attached to each release beside the others (follows the release version; depends on the primitives file).
  - **Accept.** A traced sketch becomes a base that renders and passes the gate (`image.test.ts`: `trace-base` then `render`, no failing check); `cut` makes a token from an
    approved-or-chosen version and refuses an unapproved asset; the web tools give the same result as before (pixel for pixel, see above). Bundles grew: `artgen.js` 1.61 → 1.66 MB,
    `artgen-mcp.js` 1.60 → 1.65 MB, `artgen-maps.js` 0.73 → 0.77 MB.
  - **Not done here.** The other tools of §6b (Heightmap, Turntable, Print tiles); colour layers when tracing (a trace is one silhouette in one ramp; splitting a picture into
    several materials is for the pass that follows); tracing into dungeon and settlement footprints (only terrain maps take `map trace`); a pixel-exact lasso edge; Firefox
    (not installed in this sandbox); the Shape gate itself (R6a) that reads `cut --fill flat`.

### R6 — Stage graph (L; split into sub-phases ordered by R4's metrics) — built 2026-10-30, production accept not run
- R6a: the **Placeholder** stage and its export, so the runtime loads placeholder packs. Add gates and stage cache
  keys.
- R6b: the **shared rig library**, used by the creature and character templates.
- R6c: **decals** as a layer type; the lit-sprite runtime for Pixi.js (lighting).
- R6d: **RotSprite** for rotating 2D-only assets.
- **Makes later work faster:** wrong shapes are rejected at the gate, cached stages are skipped, and rigs are reused
  instead of written per asset.
- **Accept:** on the bench, tokens and passes per approved asset fall against the R0 baseline, with no drop in blind
  score; a restyle re-runs only stages 3 and later.
- **Built:** the design and what was built are in [`STAGES.md`](STAGES.md) (§13 per sub-phase, and the review's fixes).
  The order follows the metrics (STAGES §2): 8 of the 15 user notes in the example ledgers were about form, so R6a came first.
  - **R6a.** Stage ids and keys (`artgen-workflow/stages.ts`; `artgen-core/qa/stages.ts`): a key is a digest of a stage's
    *output* (the silhouette with the outer line removed, the bone lengths, the pixels, the normals, the contract and anchors), so a
    revision that keeps the silhouette keeps the shape key. Stage checks are a second report beside conformance, so no recorded
    output changed. `placeholder.json` (an asset module made from data: footprint, pivot, body, collision, facing tick, state shade,
    frame bob), `artgen placeholder`, `export --placeholders` (runtime 1.3.0: `placeholder` / `placeholders` in the manifest, contracts
    written, status unmoved). Gates (`review.gates` per kind, a brief's `gates`; new projects gate the shape of characters and
    creatures): the pass machine stops at `stage-gate placeholder` before v1 and `stage-gate shape` before v2, the finish and ready,
    passed by key; `stage approve` / `stage reject` (user only, MCP `user_approved`), PR lines `approve goblin shape`, the shape sheet
    (`review --stage shape`), `artgen stages`. Restyle records which stage keys changed; metrics gain gate counts and `firstInGameMinutes`.
  - **R6b.** `artgen-scene/anim/rigs.ts`: biped, quadruped, flyer, serpent and turret skeletons with proportions, facing projection,
    clips (idle, walk with foot IK, attack, hurt, flight) and standard anchors; `ctx.lib.rigs`; the `rig` key and `rig-lengths` check.
    The 12 character and creature templates are rebuilt on it.
  - **R6c.** Decals as a procedural layer (`decal`: on a part, a ramp, the surface's band, ordered-dither opacity), kept as masks on
    the cell, with the `decal` key and `decal-inside` check. Lit sprites in Pixi.js: the lighting model once in the runtime core
    (`light.ts`, `shadeTexel`) and `pixiLitAdapter` (a WebGL mesh shader with the same maths); `npm run accept:lit` matches the shader
    to the reference within 1/255 in headless Chromium. Runtime 1.4.0; the swamp example's lantern is a moving light.
  - **R6d.** RotSprite (`artgen-primitives/lib/rotsprite.ts`: Scale2x ×3, nearest sample of the inverse rotation; quarter turns exact;
    colours never invented), rotated assets (`rotate: rotsprite`, `rotateFrom`: one facing drawn, the rest turned with anchors,
    normals and decals), the `rotation-*` checks and `artgen rotate`.
  - **Measured (STAGES §12).** The shape sheet costs 11 % of the full review sheet's image tokens on the 25 non-tile example finals.
    A palette-only restyle of the three examples changed `decorate` on all 30 finals and no stage before it. The 8 form notes in the
    example ledgers came after 34 passes; 4 of them are on props and creatures a shape gate sees (16 passes, at most 12 saved), only
    one on a kind `init` gates by default. The rebuilt templates are 18,501 → 19,065 code tokens (+3 %).
  - **Not done.** The production accept (tokens, passes and blind scores per approved asset with gates on, time to first placeholder)
    needs model runs and a person answering the gates. Gates on stages after shape; a shape sheet in the web UI (R8); 3D rigs (R7b);
    WebGPU lit sprites; Firefox.

### R7 — Output and camera breadth (L, three sub-phases) — R7a built 2026-10-31
- **R7a — true 3D meshes and the free camera.** Turn `Scene3D` primitives into meshes (polygon budget, smooth or
  faceted), add UVs and bake textures (colour, normal, roughness) from the palette and proc layers, and export `.glb`.
  Add a perspective camera and an orbit preview in the web UI for both voxel and mesh assets (three.js is already a
  runtime adapter). Add mesh checks: closed (watertight) meshes, polygon budget, scale, UVs that don't overlap, and
  texel density. Add `artgen convert` and `extrude` (§8b): outside `.glb` and `.vox` files in, voxelising at the
  direction's scale.

  **Built (2026-10-31):** the design and what was built are in [`MESHES.md`](MESHES.md) (§12).
  - **Meshes from the source** (`artgen-scene/src/mesh/`): each `Scene3D` solid as a distance function that follows the
    voxel rules (it agrees with the voxels at every voxel centre), dual contouring under a triangle budget by kind, smooth
    or faceted per part, box-projected UV charts, and colour, normal and roughness-metal textures baked from the palette
    (palette-exact; a `grain` noise layer; a `baked` unlit look). `.glb` out with nearest sampling; any binary glTF in.
  - **Mesh checks:** `mesh-closed`, `mesh-budget`, `mesh-scale`, `uv-bounds`, `uv-overlap`, `texel-density`.
  - **The free camera:** a perspective orbit camera and a software rasteriser shared by `artgen turntable` (also an MCP
    tool) and Asset Lab's 3D panel (voxels or mesh, drag to turn).
  - **Commands:** `mesh`, `turntable`, `convert` (`.glb` voxelised at its size or `--height`, `.vox` fitted to the frame,
    colours snapped to the kind's ramps; into an asset's next base, recorded in the ledger) and `extrude` (a picture or a
    2D asset as a slab).
  - **Accept for R7a:** every 3D-mode bench asset meshes under its budget and passes the checks; the `.glb` reads back;
    a `.glb`, a `.vox` and a picture come in as bases that render and pass the gate; the orbit view turns a mesh and a voxel
    asset in headless Chromium. Not done: decimation (a box uses most of its budget), turntables on review sheets, rigs (R7b).
- **R7b — rigged and animated 3D.** Skin meshes to the shared rig library (R6b), export animation clips and levels of
  detail, and load them through the three.js adapter.
- **R7c — map and camera exports.** Add Tiled and LDtk export for maps and tilesets. Each new camera is a view module
  (projection, probe set, context view, check, runtime helper), the plug-in shape D8 already set.
- **Makes later work faster:** voxel and mesh output share the same primitives, rigs and review, so every cell of the
  output matrix is filled without a new pipeline.
- **Accept:** every cell in §8's matrix has a template and one bench asset at or above the approval bar; a rigged
  `.glb` character walks in the three.js example game.

### R8 — Web UI consolidation (M)
- One shell: project bar, a per-asset stage view (a simple node graph of §8's stages with cache status), a metrics
  dashboard fed by pooled analytics, and the same keyboard shortcuts and layout in every tool.
- Build the web tools' forms and worker commands from the operation registry (R2 left this for the one shell).
- Fill the archive's untested Firefox zip fallback.
- **Makes later work faster:** you can see where time goes and approve stages without Claude Code open.
- **Accept:** the headless UI acceptance (`scripts/artgen-ui-accept.mjs`) covers the stage view and maps review.

Order and what can run in parallel: R0 → R1 → (R2 ∥ R3) → R4 → (R5 ∥ R5b) → R6 → (R7 ∥ R8). R5b needs R2. R4 can start in a small form
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
- **True 3D pulls focus from the pixel pipeline.** R7 comes after the stage graph, so meshes reuse its rigs and cache
  instead of growing a second pipeline. 3D review sheets show fixed turntable angles, so the reviewer scores the same
  views every time. Self-scoring stays calibrated against blind scores.
- **The bundled UI grows the install.** It ships as its own module (`ui`), so a maps-only consumer like
  setting_builder doesn't carry it, and R3 checks its size.
- **Pull request review is slower than the UI** and carries no region-pinned notes. It is the cloud path only; local
  sessions use `artgen ui`.

**Decisions (settled 2026-10-27, revised 2026-10-29)**

1. **No npm account or registry.** Keep installing from this git repo with `npx …#artgen-dist` (§4). Code consumers install package
   files attached to GitHub releases. (Revised 2026-10-29: npm sign-up wasn't worth it.)
2. **The command stays `artgen`** (`artgen map …`, `artgen dungeon …`). New tools are added as more `artgen`
   subcommands and installer modules. There is no separate `mapgen` command.
3. **Every generator sends metrics:** art, all map engines, imagekit and every later tool, on by default in your
   repos (§5, R5).
4. **Both true 3D and voxel** are targets (§8, §8b, R7a–R7b).
5. **One source repo.** No separate source repo.
6. **Review ships with the install** (`artgen ui`) for local sessions, with pull request review for cloud sessions
   (§5b).
7. **The SVG Tracer and Token Cutter join the pipeline** as `imagekit`, the first of more mid-level tools (§6b, R5b).

## 13. Running this on the Pro plan

Anthropic doesn't publish fixed numbers for the Pro plan. Claude Code and the Claude apps share one allowance that
resets every five hours, under a weekly cap, and larger models use it up faster. Run `/usage` in Claude Code to see
where you stand. The estimates below are in **five-hour windows**: the share of one window's allowance a phase is
likely to use. They are planning guesses, and R0 replaces them with measured numbers.

**Building this plan (work in this repo)**

| Phase | Kind of work | Model | Effort | Windows (estimate) |
|---|---|---|---|---|
| R0 | scripts over ledgers, a lint rule | Sonnet | medium | 1–2 |
| R1 | many mechanical file moves, keep tests green | Sonnet | medium | 4–8 |
| R2 | design an API once, then move operations onto it | Opus for the design session, then Sonnet | high, then medium | 3–5 |
| R3 | installer, local server, release workflow | Sonnet | medium | 3–6 |
| R4 | commands, templates, CI | Sonnet | medium | 3–5 |
| R5 | shared workflow design | Opus to design, Sonnet to build | high, then medium | 4–7 |
| R5b | image algorithms in TypeScript | Sonnet | high | 3–5 |
| R6 | stage graph, rigs, decals, RotSprite | Opus to design, Sonnet to build | high, then medium | 8–14 |
| R7 | meshes, UVs, texture baking, skinning | Opus for the hard parts | high | 10–18 |
| R8 | UI work | Sonnet | medium | 3–6 |

That totals roughly **40–75 windows**. At a few heavy windows a week, the whole plan is a matter of months. The
phases are ordered so each one is useful on its own if you stop early: R0–R4 alone give the split, the modular
install, the review paths and the feedback loop.

How to keep usage down:

- **Use Sonnet at medium effort by default.** Switch to Opus (`/model`) only for a design session at the start of
  R2, R5, R6 and R7, and switch back once the design is written down. If Opus isn't on your plan, Sonnet at high
  effort does those sessions.
- **One phase or sub-phase per session**, started from a short brief that names the phase in this plan. Long
  sessions re-read their whole history on every turn; that is what uses up a window.
- **No subagents or parallel runs.** Each subagent starts cold and re-reads what it needs, so parallel work
  multiplies usage.
- **Keep CI as the check.** Let the test suite catch mistakes instead of asking the model to re-read files to verify.

**Making assets (the pipeline in a game repo)**

The bench ledgers record about 2k tokens of written code and 4–5k tokens of review images per asset. A real session
uses several times that, because each step re-reads the skill, the brief and the earlier versions (archive,
D19).

| Work | Model | Effort |
|---|---|---|
| Art direction (once per game) | Opus if available, else Sonnet | high |
| Hero assets (main characters, bosses) | Sonnet; the reviewer is Sonnet too | medium |
| Standard assets | Sonnet | medium |
| Filler tiles, textures, simple props | Haiku | low or medium |
| Maps | Sonnet | medium |

- **Make assets in batches of 5–10 per session**, one at a time; don't use parallel make with `art-maker` subagents
  on Pro.
- **Review images are the biggest cost.** Keep the review sheet size cap in `artgen.config.json`, and have the
  reviewer score key frames for long animations.
- **Record the model and effort** with each pass (the ledger already has the fields). `artgen analytics` then
  recommends the cheapest model and effort that still clears the bar for each stage. This replaces the table above
  with your own data once a few batches have run.
