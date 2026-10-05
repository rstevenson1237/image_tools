# artgen — Implementation Plan

Status: **draft for review, rev 2** · implements [SPEC.md](SPEC.md) under the defaults in [INTAKE §7](INTAKE.md#7-decisions-needed-from-you)

## 1. Approach

- **Workflow-first thin slice, then breadth.** Get W1 → W2 → W3 → W4 working end-to-end for top-down and
  isometric sprites (where artlab already scores 6.5–7.5), then widen to 2.5D, textures, effects and
  first-person. Every breadth phase extends all four workflows at once (direction schema, conformance,
  export/runtime, UI preview), so nothing is engine-only.
- **Port, then extend.** artlab is ported to TS with behaviour unchanged and locked by golden images before new
  features land.
- **Two fixture game projects** live in `examples/` and are the acceptance environment for every milestone:
  `examples/swamp-topdown` (Canvas2D) and `examples/iso-dungeon` (Phaser). They start empty and are built *only*
  through the plugin, exactly as a real user would.
- **One PR per phase** (L phases split into 2–3), each with tests, the fixture-project evidence (sheets,
  screenshots) and a findings note if quality numbers move.
- Sizes: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks of focused agent+review time.

## 2. Repository layout (end state)

```
package.json                     # npm workspace root; app unchanged
packages/
  artgen-core/                   # engine (TS, ESM, no Node/DOM imports)
  artgen-cli/                    # CLI + Node I/O adapter
  artgen-runtime/                # W3 runtime core + adapters (canvas2d, phaser, …)
  artgen-mcp/                    # MCP stdio server
python/artgen/                   # Python client
.claude-plugin/marketplace.json  # this repo is a plugin marketplace
plugins/artgen/                  # skills, commands, agent, .mcp.json, bin/ (prebuilt bundles), templates
src/core/project/                # W4 shared: File System Access project store
src/tools/{ArtDirection,AssetReview,AssetLab}/
examples/{swamp-topdown,iso-dungeon}/   # fixture game repos (acceptance)
docs/artgen/                     # INTAKE, SPEC, PLAN, artlab/ (frozen reference), findings
```

## 3. Milestones at a glance

| Milestone | Workflow outcome | Phases |
|---|---|---|
| **M0** Foundations | artlab imported, workspace + CI | P0 |
| **M1** Engine + direction model | engine renders artlab assets driven by a `direction.json` | P1 |
| **M2** W1 usable | install plugin into a fixture repo → 3 style tiles → locked direction + anchors | P2 |
| **M3** W2 usable | brief → batch loop → approve → export pack; restyle works | P3 |
| **M4** W3 usable | fixture games play exported assets via runtime (Canvas2D, Phaser) | P4 |
| **M5** W4 usable | Art Direction + Asset Review (+ Lab) in the image tools app | P5 |
| **M6** Breadth | 2.5D + voxel raster/toon, textures/tiles, effects/animation, first-person | P6a–P6d |
| **M7** Access | MCP server, Python client, release automation | P7 |

## 4. Phases

### P0 — Foundations (S)
- Import artlab to `docs/artgen/artlab/` (source, findings, reports; no `out/`, no `node_modules`) as the frozen
  reference.
- Convert root `package.json` to an npm workspace; empty `packages/*` with tsconfig + vitest; CI runs workspace
  tests; app check/test/build and Pages deploy unchanged.
- **Accept:** CI green; artlab reproduces its two final comparison sheets from its folder.

### P1 — Engine core + direction model (M–L)
- `artgen-core`: Grid, Palette (restrict, swap, `.hex`/`.gpl` import, hue-shift ramp generator, **extract from
  image**), RNG, PNG, pixel font; post passes (artlab set); T1 charmap, T2 prim (+ wider seed axes), T3 svg on
  resvg with the fixed ss path, iso helpers, T4 voxel `cubes` renderer; `overlay()`.
- **`direction.json` schema + validator**; `ctx.dir` threaded into every technique and post pass (light,
  bands, outline, line, dither, restricted palettes per kind).
- Sheet assembly over states × facings × frames (mirror-aware facings for 2D techniques).
- QA: `measure()` port, **conformance checks** (SPEC §4.3), review sheet builder (v(n−1), anchors, context),
  ledger (jsonl).
- Port artlab's six finals as asset modules under a `benchmark` direction that reproduces artlab's master
  palette.
- Stage tests (svg ss detail, 1 px line preservation, 0 off-palette after quantize, exact 1 px outline).
- **Accept:** six benchmark assets render under the benchmark direction; golden hashes recorded; re-review
  scores ≥ artlab finals; swapping to a second direction re-renders all six with a different palette/outline
  and they pass conformance.

### P2 — W1: plugin + art direction workflow (M)
- Plugin packaging: `.claude-plugin/marketplace.json`, `plugins/artgen` (plugin.json, `.mcp.json` stub, bin
  bundles built by a CI job). Verify manifest format against current Claude Code plugin docs first.
- CLI: `init`, `direction new|candidates|tile|lock|show`, `palette import|extract|ramp`, `route`, `new`,
  `render`, `review`, `score`.
- Skills `artgen` (loop, router, rules R1–R11, pitfalls) and `art-direction` (interview → 3 candidates → style
  tiles → choose/mix → lock); commands `/artgen:init`, `/artgen:direction`; `art-reviewer` subagent.
- Probe set templates (character, prop, tile, effect-strip placeholder until P6c) per view (topdown, iso).
- Style sheet renderer (`art/direction.png`).
- **Accept:** in both fixture repos, starting from a one-paragraph game pitch: plugin installs, 3 visibly
  distinct style tiles are produced, a mixed choice is locked, anchors saved, style sheet written — in one
  session, with the user's choices as the only manual input.

### P3 — W2: themed production + export (M–L)
- Briefs (`briefs.yaml` schema), status lifecycle in ledger, `brief add|list`, `status`.
- Skill `asset-production`; commands `/artgen:brief`, `/artgen:make`, `/artgen:review` (gallery sheet),
  `/artgen:approve`, `/artgen:export`, `/artgen:restyle`.
- Export: atlas packer (maxrects), `pack.json` (SPEC §12.1), Aseprite JSON, generated `assets.ts`.
- `restyle` with before/after diff sheet; `stale` detection; `import-edit` (Aseprite PNG → T1 overlay version).
- T5 mask-template generator for variants.
- **Accept:** each fixture repo produces a 10-asset brief (≥ 2 kinds, ≥ 1 with 8 facings and a walk cycle),
  all approved assets pass conformance and score ≥ 6.5; direction v2 → `restyle` re-renders all, diff sheet
  shows consistent change; hand-edited PNG survives a restyle.

### P4 — W3: runtime component (M)
- `artgen-runtime`: `loadPack`, sprite state machine (state × facing × frame, fps, loop, mirror-aware facing
  from angle), variants/palette swap, autotile resolver (16/47), effect player, iso/oblique coordinate + depth
  helpers.
- Adapters: `canvas2d` (reference), `phaser`.
- `artgen export --runtime` vendoring with version stamp + upgrade check.
- Fixture games: `swamp-topdown` (Canvas2D) and `iso-dungeon` (Phaser) render a walking 8-dir character, a
  tile map and an effect from the exported pack.
- **Accept:** each fixture game's art code < 20 lines; typed ids autocomplete; runtime unit tests (frame
  selection, facing math, autotile masks); bundle size < 8 KB min+gz without adapters.

### P5 — W4: UI in image tools (M–L)
- Framework: `'artgen'` WorkerKind; `src/core/project/` File System Access store (persisted handle, schema
  validation via core, zip fallback); shared `PaletteRamp`, `PixelPreview`, `CompareView`, `StatusBadge`;
  integer-zoom mode in `CanvasStage`; registry tool groups.
- Tools: **Art Direction** (palette/ramps, settings, live style tile, candidate compare, lock), **Asset Review**
  (gallery by status, version compare, context preview, metrics/conformance, approve/request changes),
  **Asset Lab** (params/seed/facing/frame, animation playback through runtime canvas2d).
- **Accept:** on the Pages build in Chromium, open a fixture repo's `art/`, change a ramp, approve an asset;
  next `/artgen:status` in Claude Code reflects both; zip fallback works in Firefox; existing tools' tests and
  behaviour unchanged.

### P6 — Breadth (four independent tracks, each M–L)
Each track extends: direction schema → techniques → conformance → probe set/style tile → export/runtime →
UI preview → skill reference → fixture asset(s) at ≥ 6.5.

| Track | Adds | Benchmark |
|---|---|---|
| **P6a** Views + voxel | `oblique`, `stack`, `side` projections; voxel `raster` (any yaw, depth/normal/ID buffers, internal-res outlines) and `toon` shading; 4/8/16-dir voxel sheets; runtime stack/parallax helpers | 8-dir iso skeleton; oblique house; stacked car; parallax forest; artlab isohero/isospider ≥ 6 with `toon` (from 5/4.5) |
| **P6b** Textures/tiles | periodic noise, 12 material recipes, `seam` metric + 3×3 sheet, 16/47 autotiles, iso tile sets, WFC, L-systems, normal maps | stone 64, plank 32, grass autotile, iso floor/wall set |
| **P6c** Effects/animation | `t`-driven params, particle system + 11 presets, palette cycling, frame QA, onion-skin sheets, GIF/APNG | explosion, fire loop, sparks, spider walk |
| **P6d** First-person | raycaster preview for review + UI; 64/128 wall/floor/ceiling sets + normals; skies; 8-dir billboards from voxel; view-model template | brick/metal/wood walls, imp billboard, pistol idle/fire |

`.vox` read/write and greedy-mesh glTF export land with P6a.

### P7 — Access + release (M)
- `artgen-mcp` (tools per SPEC §14, image content results, path sandbox to `art/`) wired into the plugin's
  `.mcp.json`.
- `python/artgen` client + pytest + notebook example; `pyproject.toml` ready (publish only on your go-ahead).
- Release workflow: build plugin `bin/` bundles, version bump, changelog; optional npm publish of runtime (D4).
- **Accept:** MCP inspector renders + reviews a benchmark asset; Python example generates a texture and a
  sheet; tagging a release updates the plugin that fixture repos install.

## 5. Dependency graph

```
P0 → P1 → P2 → P3 ─┬─► P4 ─► P5
                   └─► P6a, P6b, P6c, P6d   (parallel; P6d uses P6b textures + P6c flashes)
P2 ─────────────────► P7 (MCP can start once CLI exists; release after P4)
```
P4 and P5 can run in parallel with P6 once P3 lands.

## 6. Per-phase definition of done

1. Typecheck, unit, stage, golden and plugin-smoke tests green; app check/test/build unaffected.
2. Fixture project evidence committed (review sheets, style sheet, screenshots of fixture games / UI).
3. Benchmarks at or above target; ledger + report updated.
4. Skill, command and reference docs updated so a fresh agent can use the capability without the findings.
5. Findings note appended when scores or recipes change.

## 7. Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Breadth dilutes quality | High | High | Thin slice first (M1–M5 top-down + iso only); a coverage cell isn't done below 6.5 |
| "Consistency" judged subjectively | High | Medium | Direction tokens are mandatory in sources (R11); objective conformance checks; anchors shown in every review sheet; reviewer agent scores *against* the direction |
| Voxel organics stay ~5 | Medium | Medium | `toon` + internal-res outlines + T1 overlay; router falls back to T1/T3 |
| Plugin packaging/format changes | Medium | Medium | Verify against current docs in P2; smoke test installs into fixtures in CI; CLI usable without the plugin |
| File System Access is Chromium-only | Certain | Low | Zip import/export fallback; optional `artgen ui` local server |
| Runtime grows into a game engine | Medium | Medium | Runtime scope = load, select frame, draw via adapter; no physics, scenes or input |
| resvg vs napi-canvas changes T3 results | Medium | Medium | P1 re-review gate; palette quantize + mode downsample absorb AA differences |
| Silent stage bugs (E9) | Medium | High | `--stages` dumps; stage tests written before features |
| Refinement regressions (E8) | High | Low | v(n−1) in every sheet; immutable versions; `bench` in CI |
| Workspace conversion breaks app CI/deploy | Low | High | P0 isolated; verify CI + Pages before engine code |

## 8. First step after approval

P0: import artlab as the frozen reference, convert to a workspace, wire CI — one small PR, no change to the
app's behaviour.
