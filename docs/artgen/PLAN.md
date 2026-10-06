# artgen — Implementation Plan

Status: **rev 4** · implements [SPEC.md](SPEC.md) under the resolved decisions in [DECISIONS.md](DECISIONS.md)

## 1. Approach

- **Workflow-first thin slice, then breadth.** Get W1 → W2 → W3 → W4 working end-to-end for top-down and
  isometric sprites (where artlab already scores 6.5–7.5), then widen to 2.5D, textures, effects and
  first-person. Every breadth phase extends all four workflows at once (direction schema, conformance,
  export/runtime, UI preview), so nothing is engine-only.
- **Port, then extend.** artlab is ported to TS with behaviour unchanged and locked by golden images before new
  features land.
- **Prove the pipeline before building on it.** T2+ must reach T3 parity on the artlab benchmark (P1b) before
  the workflows are built on it. If it falls short, we find out in week 2, not after the UI exists.
- **Three fixture game projects** live in `examples/` and are the acceptance environment for every milestone:
  `swamp-topdown` (Pixi.js), `iso-dungeon` (Pixi.js) and `billboard-crawler` (three.js; 8-direction billboards,
  grows into the first-person fixture in P6d). They start empty and are built *only* through the committed
  install, exactly as a real user would — and each milestone is accepted in **both a local and a cloud
  (claude.ai/code) session**.
- **Autonomous by default.** The agent runs the whole generation pipeline without asking; the user sees finished
  assets and approves or asks for revisions (D10). Analytics on every pass (D19) feed budget and model choices.
- **One PR per phase** (L phases split into 2–3), each with tests, the fixture-project evidence (sheets,
  screenshots) and a findings note if quality numbers move.
- Sizes: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks of focused agent+review time.

## 2. Repository layout (end state)

```
package.json                     # npm workspace root; app unchanged
packages/
  artgen-core/                   # engine (TS, ESM, no Node/DOM imports)
  artgen-cli/                    # CLI + Node I/O adapter
  artgen-runtime/                # W3 runtime core + adapters (pixi, three, canvas2d; more later)
  artgen-mcp/                    # MCP stdio server
python/artgen/                   # Python client
packages/artgen-dist/            # builds the committed-install distribution + install.mjs (→ artgen-dist branch)
                                 # also emits the same content in plugin layout for local /plugin users
src/core/project/                # W4 shared: File System Access project store
src/tools/{ArtDirection,AssetReview,AssetLab}/
examples/{swamp-topdown,iso-dungeon,billboard-crawler}/   # fixture game repos (acceptance)
docs/artgen/                     # INTAKE, SPEC, PLAN, DECISIONS, artlab/ (reference until superseded), findings
docs/archive/artgen/             # P8: artlab + planning docs once superseded
```

## 3. Milestones at a glance

| Milestone | Workflow outcome | Phases |
|---|---|---|
| **M0** Foundations | artlab imported, workspace + CI | P0 |
| **M1** Engine + direction model | engine renders artlab assets driven by a `direction.json` | P1 |
| **M1b** Pipeline proven | T2+ base → procedural → 3 revisions → finishing pass matches artlab's best on all six benchmark assets | P1b |
| **M2** W1 usable | committed install into a fixture repo (local + cloud) → 3 style tiles → locked direction + anchors | P2 |
| **M3** W2 usable | brief → autonomous pipeline (3 revisions + finish) → user approves/revises finished assets → export pack; restyle; analytics | P3 |
| **M4** W3 usable | fixture games play exported assets via runtime (Pixi.js, three.js) | P4 |
| **M5** W4 usable | Art Direction + Asset Review (+ Lab) in the image tools app | P5 |
| **M6** Breadth | 2.5D + voxel raster/toon, textures/tiles, effects/animation, first-person | P6a–P6d |
| **M7** Access | MCP server, Python client, release automation | P7 |
| **M8** Wrap-up | artlab and planning docs archived once superseded | P8 |

## 4. Phases

### P0 — Foundations (S)
- artlab is already in `docs/artgen/artlab/` (imported with the planning docs: source, findings, reports, the
  two final comparison sheets). P0 verifies it runs from there and stays unchanged until superseded (D11).
- Convert root `package.json` to an npm workspace; empty `packages/*` with tsconfig + vitest; CI runs workspace
  tests; app check/test/build and Pages deploy unchanged.
- **Accept:** CI green; artlab reproduces its two final comparison sheets from its folder.
- **Done.** Root is an npm workspace over `packages/*` with empty `artgen-core`, `-cli`, `-runtime` and `-mcp`
  (shared `packages/tsconfig.base.json`; `artgen-core` and `-runtime` get no Node or DOM types). CI runs
  `check:packages` and `test:packages` after the app steps; `deploy.yml` is unchanged. artlab (`npm ci`,
  `node run.js all`, `report`, `report iso`, run on a copy so the frozen folder isn't rewritten) reproduces
  both final comparison sheets pixel-identical (0 differing pixels).

### P1 — Engine core + direction model (M–L)
- `artgen-core`: Grid, Palette (restrict, swap, `.hex`/`.gpl` import, hue-shift ramp generator, **extract from
  image**), RNG, PNG, pixel font; post passes (artlab set); artlab T2 `prim` ported as the T2+ starting point;
  T1 char-map `blit` (becomes the finishing `patch`), T3's ss raster path on resvg (becomes T2+ `ss` mode), iso
  helpers and T4 voxel `cubes` renderer (becomes T2+ 3D mode's renderer) ported as internals.
- **`direction.json` schema + validator**; `ctx.dir` threaded into every technique and post pass (light,
  bands, outline, line, dither, restricted palettes per kind).
- Sheet assembly over states × facings × frames (mirror-aware facings for 2D techniques).
- QA: `measure()` port, **conformance checks** (SPEC §4.3), review sheet builder (v(n−1), anchors, context),
  ledger (jsonl).
- Port artlab's six finals **as they are** (T1/T3/T4 code) under a `benchmark` direction that reproduces artlab's
  master palette. They are the reference images and target scores for P1b, not the new authoring style.
- Stage tests (svg ss detail, 1 px line preservation, 0 off-palette after quantize, exact 1 px outline).
- **Accept:** six benchmark assets render under the benchmark direction; golden hashes recorded; re-review
  scores ≥ artlab finals; swapping to a second direction re-renders all six with a different palette/outline
  and they pass conformance.
- **Done.** `artgen-core` holds the engine (grid, palette tools, PNG, pixel font, post passes, the T1/T2/T3/T4
  internals with SVG on resvg-wasm), the `direction.json` validator and token context, `renderAsset` over
  states × facings × frames with mirrored west facings, conformance, review sheets and ledger lines. The six
  artlab finals live in `artgen-core/bench/` as token-only asset modules; `npx artgen bench` renders them. Golden
  hashes are in `bench/golden.json`. T1 ports are pixel-identical to artlab, and the T3/T4 ports are within
  0.2–1.7 % of artlab's pixels (Skia vs resvg; artlab's flattened chest shadow). Re-review scores held. A
  generated second direction restyles all six, and they pass every conformance check. Details:
  [findings/P1-engine-core.md](findings/P1-engine-core.md).

### P1b — T2+ parity and the pipeline (L, 2 PRs)
- **T2+ primitives** (SPEC §6.3): `path` (SVG path data), `capsule/ring/arc/star`; groups with transforms,
  z-order, booleans, clip masks, `repeat`; raster modes `direct` (coverage threshold) and `ss` (R3); automatic
  underlay ink; `normal`/SDF banded shading, hue-shifted ramps, overlap AO, cast shadow; param schema for
  variants; lint (strokes, iso overlaps, hard-coded colours).
- **T2+ 3D mode** over the voxel `cubes` renderer (iso), enough for the chest and iso hero/spider.
- **Procedural pass v1** (SPEC §6.4): `materialNoise`, `pattern`, `lighting` (rim, AO, shadows), `dither`; others
  arrive with P6 tracks.
- **Finishing ops library** `px.fix/fx/light/outline/patch`, anchors per frame, `finish-stale` detection.
- **Pass state machine** in the CLI (`pass next|status`): v1 → v2 → v3 with best-so-far (R12) → finish → ready
  for user; ledger records pass ids.
- **Parity experiment:** rebuild all six artlab assets through the full pipeline, in artlab's harness style
  (render → sheet → score each pass). Report per-pass scores and cost, like REPORT-iso.md.
- **Accept (gate for everything after):** every asset ≥ artlab's best final (hero 7.5, ship 7.5, tank 7.5,
  isohero 7, isospider 7, isochest 7) after finish; findings note on how much came from revisions vs the
  finishing pass; the same assets as 8-variant sheets show ≥ 6 distinct designs each.
- **If an asset misses:** close the specific gap in T2+ (one extra PR, up to 1 week), re-run. If still short,
  bring the result to you with the options (accept, add a primitive, or allow an SVG-authored base for that form).
- **Result (awaiting your decision).** T2+ (`artgen-core/src/t2`: 2D scenes with `path/capsule/tube/ring/arc/star`,
  booleans, clip, `repeat`, transforms, underlay ink, `direct`/`ss` modes, `flat/bevel/sphere/cyl/normal/linear`
  shading, AO, cast shadows, param schema, lint; 3D mode over `cubes`; procedural pass v1; finishing ops with
  anchor-following patches and `finish-stale` snapshots) and the CLI pass machine (`pass next|status`, `render`,
  `review`, `score`, `variants`, `report`) are in. Parity run: **4/6 at or above artlab's best** (hero 7.5, tank
  7.5, isochest 7, isospider 7); ship 7 (target 7.5) and isohero 6.5 (target 7) miss by half a point, both on
  authoring rather than a missing primitive. Revisions gave +0.83 on average, the finishing pass +0.17; 8-variant
  sheets show 7–8 distinct designs per asset. Details and options:
  [findings/P1b-pipeline.md](findings/P1b-pipeline.md).

### P2 — W1: committed install + art direction workflow (M)
- `artgen-dist`: single-file CLI and MCP bundles, `install.mjs` (`init` / `update` with VERSION + MANIFEST
  hashes, `.mcp.json` merge, `CLAUDE.md` section), CI job publishing the `artgen-dist` branch; plugin-layout
  output for local users. Settle command naming (skills are the primary interface).
- CLI: `init`, `direction new|candidates|tile|lock|show`, `palette import|extract|ramp`, `new`, `render`,
  `review`, `score`, `pass`.
- Skills `artgen` (the pipeline, rules R1–R12, pitfalls) and `art-direction` (interview → 3 candidates → style
  tiles → choose/mix → lock); commands `/artgen:init`, `/artgen:direction`; `art-reviewer` subagent.
- Probe set templates (character, prop, tile, effect-strip placeholder until P6c) per view (topdown, iso).
  Style tiles use a **short pipeline** (1 revision + finish) per candidate to keep W1 fast; the full pipeline
  runs on the anchors once a direction is chosen.
- Style sheet renderer (`art/direction.png`).
- **Accept:** in the fixture repos, in a local session **and** a claude.ai/code cloud session, starting from a
  one-paragraph game pitch: the committed install works with no further setup, 3 visibly
  distinct style tiles are produced, a mixed choice is locked, anchors saved, style sheet written — in one
  session, with the user's choices as the only manual input.

### P3 — W2: themed production + export (M–L)
- Briefs (`briefs.yaml` schema), status lifecycle in ledger (`in-pipeline → final → approved / revision`),
  `brief add|list`, `status`.
- **Autonomous run** (D10): `/artgen:make` drives every brief through v1–v3 + finish with the reviewer subagent
  and gate, without user prompts; budget caps from `artgen.config.json` (D19); one extra autonomous revision
  when the gate still fails, then `final` with open issues listed.
- **Analytics v1** (D19): per-pass ledger records (model, effort, tokens, image tokens, time, score, delta,
  gate); `artgen analytics` report; stage → model/effort mapping in config, run as subagents.
- Skill `asset-production`; commands `/artgen:brief`, `/artgen:make` (runs the pipeline per brief, batchable),
  `/artgen:review` (gallery of finished assets), `/artgen:feedback` (user notes → U-stage: new base or finish revision),
  `/artgen:approve`, `/artgen:export`, `/artgen:restyle`.
- Export: atlas packer (maxrects), `pack.json` (SPEC §12.1), Aseprite JSON, generated `assets.ts`.
- `restyle` with before/after diff sheet; `stale` / `finish-stale` detection; `import-edit` (Aseprite PNG →
  finishing revision).
- Animation finishing: global ops on all frames, key-frame patches following anchors (D15).
- Mask-template variation as a procedural `detail` layer.
- **Accept:** each fixture repo produces a 10-asset brief (≥ 2 kinds, ≥ 1 with 8 facings and a walk cycle)
  in one autonomous run with no mid-pipeline questions; all go through 3 revisions + finish; approved assets
  pass conformance and score ≥ 6.5; the analytics report shows per-pass gains and cost per asset; at least one user
  feedback round is handled in each of the two U-stage routes (base and finish); direction v2 → `restyle`
  re-renders all and the diff sheet shows a consistent change; hand-edited PNG survives a restyle.

### P4 — W3: runtime component (M)
- `artgen-runtime`: `loadPack`, sprite state machine (state × facing × frame, fps, loop, mirror-aware facing
  from angle), variants/palette swap, autotile resolver (16/47), effect player, iso/oblique coordinate + depth
  helpers.
- `RuntimeAdapter` interface (SPEC §12.2) + shared adapter contract tests; adapters as separate entry points.
- Adapters: **`pixi`**, **`three`** (billboards with camera-relative facing, `NearestFilter`, UV frames;
  sprite-stack planes and `.glb` loading land with P6a), `canvas2d` (reference, used by the UI).
- `artgen export --runtime` vendoring with version stamp + upgrade check; `artgen.config.json` selects adapters.
- Fixture games: `swamp-topdown` and `iso-dungeon` (Pixi.js) render a walking 8-dir character, a tile map and an
  effect; `billboard-crawler` (three.js) shows the same character as an 8-direction billboard walking around a
  camera, on a textured floor.
- **Accept:** each fixture game's art code < 20 lines; typed ids autocomplete; contract tests pass for all three
  adapters; runtime unit tests (frame selection, facing math, autotile masks); core < 8 KB min+gz without
  adapters; a stub fourth adapter can be added without touching the core (proves modularity).

### P5 — W4: UI in image tools (M–L)
- Framework: `'artgen'` WorkerKind; `src/core/project/` File System Access store (persisted handle, schema
  validation via core, zip fallback); shared `PaletteRamp`, `PixelPreview`, `CompareView`, `StatusBadge`;
  integer-zoom mode in `CanvasStage`; registry tool groups.
- Asset Review shows finished assets (with the pass timeline and scores one click away), region-pinned feedback
  notes written to the ledger as U-stage input, and an **Analytics** panel (per-pass gains, cost, revision rate).
- Tools: **Art Direction** (palette/ramps, settings, live style tile, candidate compare, lock), **Asset Review**
  (gallery by status, version compare, context preview, metrics/conformance, approve/request changes),
  **Asset Lab** (params/seed/facing/frame, animation playback through runtime canvas2d).
- **Accept:** on the Pages build in Chromium, open a fixture repo's `art/`, change a ramp, approve an asset;
  next `/artgen:status` in Claude Code reflects both; zip fallback works in Firefox; existing tools' tests and
  behaviour unchanged.

### P6 — Breadth (four independent tracks, each M–L)
Each track extends: direction schema → T2+ primitives / procedural layers / finishing ops → conformance →
probe set/style tile → export/runtime → UI preview → skill reference → fixture asset(s) at ≥ 6.5. Views are
added as **view modules** (SPEC §8) so later targets follow the same path (D8).

| Track | Adds | Benchmark |
|---|---|---|
| **P6a** Views + voxel | `oblique`, `stack`, `side` projections; voxel `raster` (any yaw, depth/normal/ID buffers, internal-res outlines) and `toon` shading; 4/8/16-dir voxel sheets; runtime stack/parallax helpers | 8-dir iso skeleton; oblique house; stacked car; parallax forest; artlab isohero/isospider ≥ 6 with `toon` (from 5/4.5) |
| **P6b** Textures/tiles | periodic noise, 12 material recipes, `seam` metric + 3×3 sheet, 16/47 autotiles, iso tile sets, WFC, L-systems, normal maps | stone 64, plank 32, grass autotile, iso floor/wall set |
| **P6c** Effects/animation | `t`-driven params, particle system + 11 presets, palette cycling, frame QA, onion-skin sheets, GIF/APNG | explosion, fire loop, sparks, spider walk |
| **P6d** First-person | raycaster preview for review + UI; 64/128 wall/floor/ceiling sets + normals; skies; 8-dir billboards from voxel; view-model template | brick/metal/wood walls, imp billboard, pistol idle/fire |

`.vox` read/write and greedy-mesh glTF export land with P6a.

### P7 — Access + release (M)
- `artgen-mcp` (tools per SPEC §14, image content results, path sandbox to `art/`) wired into the committed
  `.mcp.json` entry.
- `python/artgen` client + pytest + notebook example; `pyproject.toml` ready (publish only on your go-ahead).
- Release workflow: version bump, changelog, `artgen-dist` branch + tag; optional npm publish of runtime (D4).
- Analytics v2: budget and model/effort recommendations from accumulated ledger data across fixture projects.
- **Accept:** MCP inspector renders + reviews a benchmark asset; Python example generates a texture and a
  sheet; tagging a release and running `update` in a fixture repo moves it to the new version with local
  edits preserved.

### P8 — Archive (S)
- Trigger: artlab is fully superseded — P1b parity passed, the benchmark runs from the new engine, and nothing
  in the suite imports artlab code (D11).
- Move `docs/artgen/artlab/` and the planning docs (INTAKE, SPEC, PLAN, DECISIONS, findings) to
  `docs/archive/artgen/`, with a short README pointing at the live docs (skill references + package READMEs).
- **Accept:** no live docs or code link into the archive except the archive README.

## 5. Dependency graph

```
P0 → P1 → P1b (gate) → P2 → P3 ─┬─► P4 ─► P5
                                 └─► P6a, P6b, P6c, P6d   (parallel; P6d uses P6b textures + P6c flashes)
P2 ─────────────────────────────────► P7 (MCP can start once CLI exists; release after P4)
P1b + all of the above ─────────────► P8 (archive)
```
P4 and P5 can run in parallel with P6 once P3 lands.

## 6. Per-phase definition of done

1. Typecheck, unit, stage, golden and install-smoke tests green; app check/test/build unaffected.
2. Fixture project evidence committed (review sheets, style sheet, screenshots of fixture games / UI).
3. Benchmarks at or above target; ledger + report updated.
4. Skill, command and reference docs updated so a fresh agent can use the capability without the findings.
5. Findings note appended when scores or recipes change.

## 7. Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Breadth dilutes quality | High | High | Thin slice first (M1–M5 top-down + iso only); a coverage cell isn't done below 6.5 |
| "Consistency" judged subjectively | High | Medium | Direction tokens are mandatory in sources (R11); objective conformance checks; anchors shown in every review sheet; reviewer agent scores *against* the direction |
| T2+ doesn't reach T3 parity on curves/organics | Medium | High | P1b gate before any workflow work; T2+ `ss` mode *is* T3's raster path, so the remaining gap is authoring ergonomics (`path`, booleans); escalation options defined in P1b |
| Finishing pass doesn't survive re-renders or animation | Medium | Medium | Ops not pixels; tokens not hexes; anchor-following patches; `finish-stale` check sends the asset back for review instead of shipping it broken |
| Fixed 3 passes wastes effort on easy assets or is too few on hard ones | Medium | Low | `revisionPasses` is set in the direction; per-pass score data from P1b tells us whether 3 is right |
| Voxel organics stay ~5 | Medium | Medium | `toon` + internal-res outlines in 3D mode, then the finishing pass; use 2D mode when facings aren't needed |
| Committed copies drift between game repos | Medium | Low | VERSION + MANIFEST hashes; `update` shows the version change and protects local edits; fixture repos updated in CI |
| Autonomous runs ship weak assets or overspend | Medium | Medium | Gate + reviewer per pass, budget caps, open issues listed on `final`; the user still approves every asset; analytics flags kinds with high revision rates |
| File System Access is Chromium-only | Certain | Low | Zip import/export fallback; optional `artgen ui` local server |
| Runtime grows into a game engine | Medium | Medium | Runtime scope = load, select frame, draw via adapter; no physics, scenes or input |
| resvg vs napi-canvas changes reference renders | Medium | Low | References are the artlab PNGs as shipped; the ported code only has to match them closely enough for parity scoring |
| Silent stage bugs (E9) | Medium | High | `--stages` dumps; stage tests written before features |
| Refinement regressions (E8) | High | Low | v(n−1) in every sheet; immutable versions; `bench` in CI |
| Workspace conversion breaks app CI/deploy | Low | High | P0 isolated; verify CI + Pages before engine code |

## 8. First step after approval

P0: import artlab as the frozen reference, convert to a workspace, wire CI — one small PR, no change to the
app's behaviour.
