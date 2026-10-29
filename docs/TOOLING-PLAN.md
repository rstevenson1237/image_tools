# Tooling plan: separate, refactor, and build a feedback loop

Status: proposal, 2026-10-27; decisions settled 2026-10-27 and revised 2026-10-29 (§12). Nothing here is built
yet. It follows on from the finished artgen plan ([`archive/artgen/PLAN.md`](archive/artgen/PLAN.md)) and reuses its
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
- The installer gets **modules**: `core` (always), `art`, `maps`, and `ui-links`. A module is a list of skills,
  commands, agents, bundles and the `CLAUDE.md` sections it needs. `MANIFEST.json` records the modules a repo has.
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
| `imagekit` | `src/tools/TokenCutter` and `SvgTracer` processing (now OpenCV in a browser worker), `lib/palette.ts` extract, `lib/trace.ts` | primitives |

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
| Turntable | any 3D or voxel asset → a strip of fixed angles for review sheets |
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
| Voxel | built | built | built | `.vox`/`.glb`, built | R7a orbit preview |
| True 3D (glTF meshes) | R7a | R7a | R7a | R7a | R7a |

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
| `Scene3D` source → true 3D mesh, voxel, 2D/2.5D views | render, as today (mesh output from R7a) | none: each is a render of the source |
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
- **Makes later work faster:** a new operation is written once instead of four times, so R5–R7 features reach every
  interface for free.
- **Accept:** the MCP tool list comes from the registry; the parity test passes; the Python tests pass unchanged.

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

### R4 — Feedback loop (M)
- Add `artgen report`, `artgen upstream`, `artgen metrics export`, the issue template, and the intake script that
  turns an issue into a fixture.
- Add pull request review for cloud sessions (`/artgen-review --pr`, §5b), and run it once from the phone app.
- Run consumer CI before each release, and pool the metrics with `analytics --across`.
- Run a full local-session production run on your machine with your own choices (the archive's known gap).
- **Makes later work faster:** real failures become regression tests, and the metrics show which stage costs most,
  which decides the order of R6's work.
- **Accept:** one real report from setting_builder goes through the whole path, from issue to fixture to fix to
  release to update pull request; pooled metrics show two repos.

### R5 — One workflow for maps and assets (M–L)
- Build the `workflow` package (§7): versions, ledger, review and approval for maps; map briefs; map themes as a
  locked direction; the one-page data sheet for both maps and assets; references shown on review sheets.
- Make metrics part of what every generator must provide, so terrain, dungeon and settlement maps report the same
  fields as art (§12).
- The Asset Review tool lists maps as well.
- **Makes later work faster:** maps get metrics, so map work can be tuned the same way art is; a single review tool
  is less code to maintain.
- **Accept:** a map goes through v1 → review → approve in the CLI and in the web UI, and analytics include maps.

### R5b — Image tools join the pipeline (M)
- Rewrite the Token Cutter's and SVG Tracer's processing in TypeScript as `imagekit` operations (§6b), checked against
  today's OpenCV output on a set of test images. Then drop the 10 MB OpenCV asset.
- Wire them in: Trace → `path` primitives and map outlines; Cut → VTT tokens from approved assets and the Shape-gate
  silhouette. Add Palette and Slice as tools.
- **Makes later work faster:** references and sketches become editable shapes in one step instead of being redrawn by
  hand, and each new mid-level tool reaches every interface for free.
- **Accept:** a traced sketch becomes a base that renders and passes the gate; `artgen cut` makes a token from an
  approved asset; the web tools give the same result as before, within tolerance.

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

### R7 — Output and camera breadth (L, three sub-phases)
- **R7a — true 3D meshes and the free camera.** Turn `Scene3D` primitives into meshes (polygon budget, smooth or
  faceted), add UVs and bake textures (colour, normal, roughness) from the palette and proc layers, and export `.glb`.
  Add a perspective camera and an orbit preview in the web UI for both voxel and mesh assets (three.js is already a
  runtime adapter). Add mesh checks: closed (watertight) meshes, polygon budget, scale, UVs that don't overlap, and
  texel density. Add `artgen convert` and `extrude` (§8b): outside `.glb` and `.vox` files in, voxelising at the
  direction's scale.
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
