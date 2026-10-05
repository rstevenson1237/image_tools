# artgen — Implementation Plan

Status: **draft for review** · implements [SPEC.md](SPEC.md) under the defaults in [INTAKE §7](INTAKE.md#7-decisions-needed-from-you)

## 1. Approach

- **Port, then extend.** artlab already scores 6.5–7.5; Phase 0–1 port it to TypeScript unchanged in behaviour
  and lock it with golden images before anything new is added. Every later phase must keep the benchmark green.
- **Vertical slices.** Each phase ends with something an agent can use end-to-end (CLI + skill section +
  benchmark assets), not a library waiting on a later UI.
- **One PR per phase** (larger phases split into 2–3 PRs), each with tests, benchmark sheet and a short
  findings note when quality numbers move.
- Sizes: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks of focused agent+review time.

## 2. Repository layout (end state)

```
package.json                    # becomes an npm workspace root; app unchanged
packages/
  artgen/                       # @artgen/core + CLI (TS, ESM)
    src/{core,techniques,proj,voxel,tex,fx,post,qa,pack,cli}/
    test/  bench/
  artgen-mcp/                   # MCP stdio server over @artgen/core
python/artgen/                  # Python client (pyproject.toml)
.claude/skills/artgen/          # SKILL.md, references/, templates/
art/                            # authored assets: <project>/<asset>/<tech>.v<N>.js, ledger.jsonl
docs/artgen/                    # INTAKE, SPEC, PLAN, FINDINGS (imported), phase findings
src/tools/ArtLab/               # web tool (Phase 9)
```

## 3. Benchmark set

Grows per phase; every entry has a target score and is re-rendered by `artgen bench` in CI (hash) and reviewed
visually at phase end.

| Phase | Assets |
|---|---|
| 0 | artlab six: hero, ship, tank (top-down), isohero, isospider, isochest (iso) — targets = artlab finals |
| 3 | 8-dir iso skeleton (T4+T1 overlay), oblique 3/4 house, stacked car (sprite stack), side-view parallax forest (3 layers) |
| 4 | stone-brick 64, wood-plank 32, grass 16-autotile, iso floor + wall set, lava (cycling) |
| 5 | explosion 32×12f, fire loop 16×8f, sparks, spider 4-frame walk (param-driven) |
| 6 | FP wall set 64 (brick, metal, wood) + normals, imp billboard 8-dir, pistol view-model idle/fire, sky panorama |

## 4. Phases

### Phase 0 — Import and baseline (S)
- Copy artlab into `docs/artgen/artlab/` (source, findings, reports; no `out/` renders, no `node_modules`) as the
  frozen reference.
- Convert root `package.json` to an npm workspace; create empty `packages/artgen` with vitest + tsconfig; make CI
  run workspace tests. App build stays green.
- **Accept:** CI green; artlab runs from its folder and reproduces the two final comparison sheets byte-for-byte
  (or documented diff).

### Phase 1 — Core engine port (M)
- `core`: Grid (+ crop/pad/trim/flip/hash/indexed), Palette (ramps, restrict, swap, `.hex`/`.gpl` import, hue-shift
  ramp generator), RNG, PNG codec, bitmap pixel font.
- `post`: outline, quantize, modeDownsample, dropShadow, despeckle, groundShadow (+ tests per pass).
- `techniques`: charmap (T1), prim (T2), svg (T3) on resvg with the fixed ss path, iso helpers, voxel `cubes`
  renderer (T4).
- `qa`: `measure()` port, sheet builder (checker + context bg + v(n−1) column), ledger (jsonl).
- Port the six artlab finals to `art/benchmark/*` as asset modules (new `meta` + `render(ctx)` contract).
- **Stage tests:** svg ss renders new detail (regression test for the E9 bug); downsample keeps 1 px lines;
  quantize leaves 0 off-palette; outline is exactly 1 px.
- **Accept:** six benchmark assets render; golden hashes recorded; visual re-review scores ≥ artlab finals
  (resvg vs napi-canvas differences on T3 documented and, if lower, fixed before moving on).

### Phase 2 — CLI, ledger, skill v1 (M)
- CLI commands: `init, route, new, render, review, score, variants, report, bench` (+ `--json`, `--stages`).
- `route` table seeded from findings (E1–E5).
- Skill v1: `SKILL.md` (loop, router, gate, rules R1–R10), `references/{techniques,topdown,iso,pitfalls}.md`,
  templates for each technique × {topdown, iso}.
- T2 upgrade: more seed axes (proportions, accessories, palette swap) — fixes the "4 combos" limitation.
- T5 mask-template generator (ships, creatures, items).
- **Accept:** a fresh agent session with only the skill produces a new top-down item and a new iso prop to
  score ≥ 6.5, ledger + report produced, without reading the findings; T2 `variants --n 16` shows ≥ 12
  distinct sprites.

### Phase 3 — Views and the voxel renderer (L, 2–3 PRs)
- `proj`: topdown, oblique (ratio param), iso (tile size param), side, stack, billboard; common anchor + Y-sort
  conventions; context backgrounds per view.
- Voxel model additions: `slab`, `mirror`, `sdf`, named parts with transforms (states/animation).
- `raster` voxel renderer: z-buffer at ss, any yaw/pitch, depth/normal/ID buffers, internal-res outlines;
  `toon` smooth-normal banded shading; 4/8/16-direction sheets; sprite-stack slice export + rotation preview.
- `overlay()` hybrid pass (T1 char-map onto any base) with per-direction overlays.
- Skill: `references/2_5d.md`, `voxel.md`; templates for oblique, stack, multi-dir.
- **Accept:** 8-dir iso skeleton ≥ 6.5; artlab isohero/isospider re-done with `toon` shading beat their T4
  scores (5 / 4.5) — target ≥ 6; oblique house, stacked car, parallax forest ≥ 6.5; isochest still ≥ 7.

### Phase 4 — Textures and tiles (M–L)
- Periodic noise (value, simplex, Worley, fBm), material recipes (12, SPEC §8), ramp banding + dither.
- `seam` metric + 3×3 tiled review sheet.
- Autotile generators (16 Wang, 47 blob), iso floor/wall/transition sets.
- WFC (overlapping) and L-systems; normal maps from height.
- CLI `texture`; skill `references/textures.md`.
- **Accept:** all benchmark textures seam-free by metric and on review; autotile set assembles a test map with
  no visible breaks; normal maps validated in a lit preview.

### Phase 5 — Effects and animation (M)
- Timeline (`t`-driven params, N-frame sampling), particle system, 11 presets, palette cycling.
- Frame QA metrics (jitter, drift, loop seam); review sheet: strip + onion skin; GIF/APNG preview.
- Parameter-driven walk cycles for T2/T3/T4 (spider walk from findings).
- CLI `fx`; skill `references/effects.md`.
- **Accept:** benchmark effects ≥ 6.5, loops seamless by metric, spider walk reads at 1× in the strip.

### Phase 6 — First-person (M)
- Raycaster preview renderer (walls, floor/ceiling, billboards at 8 angles, distance shading) for review sheets.
- FP wall/floor/ceiling sets at 64/128 (from Phase 4 recipes) + normals; sky panorama (horizontally seamless).
- Billboard sprites from voxel `raster` at 8 dirs; view-model template (T3 base + T1 overlay, idle/fire frames
  with muzzle flash from Phase 5).
- Skill `references/first_person.md`.
- **Accept:** FP benchmark ≥ 6.5 judged on the raycaster shot, not only flat tiles.

### Phase 7 — Export and packaging (M)
- Sheet assembly from states × dirs × frames; atlas packer (maxrects); manifest (SPEC §4.4); Aseprite JSON;
  `.vox` read/write; greedy-mesh glTF/GLB with palette texture.
- CLI `export`.
- **Accept:** exported Aseprite JSON opens in Aseprite with correct tags; `.vox` opens in MagicaVoxel; glb
  validates with the Khronos validator; round-trip `.vox` → model → `.vox` identical.

### Phase 8 — MCP server and Python client (M)
- `artgen-mcp`: tools per SPEC §12.3, image content in results, path sandboxing to `art/`.
- `python/artgen`: client, dataclasses, Pillow/numpy helpers, pytest against the CLI; publish-ready
  `pyproject.toml` (not published without your go-ahead).
- **Accept:** Claude Desktop (or MCP inspector) renders + reviews a benchmark asset via MCP; Python notebook
  example generates a texture and a sprite sheet.

### Phase 9 — Web ArtLab tool (optional, M)
- `src/tools/ArtLab`: project browser, seed/param sliders, in-context preview, export; core runs in a worker
  from the existing pool.
- **Accept:** works on the GitHub Pages build; no regressions to existing tools.

## 5. Dependency graph

```
P0 → P1 → P2 ─┬─► P3 ─┬─► P6
              ├─► P4 ─┤
              └─► P5 ─┘
P1 ─────────────────────► P7 (format work can start after P1; sheet assembly needs P3 dirs/P5 frames)
P2 ─────────────────────► P8
P7, P8 ─────────────────► P9
```
P3, P4 and P5 are independent after P2 and can run in parallel.

## 6. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope breadth (4 views × 3 categories × 2 media) dilutes quality | High | High | Coverage matrix is filled cell-by-cell with a benchmark asset each; a cell isn't "done" below 6.5 |
| Voxel organics stay ~5 (E4) | Medium | Medium | `toon` smooth-normal shading + internal-res outlines + T1 overlay; fall back to T1/T3 per router if still < 6 |
| resvg output differs from napi-canvas → T3 scores move | Medium | Medium | Phase 1 re-review gate; asset-palette quantize + mode-downsample make the pipeline robust to AA differences |
| Metrics can't see quality (E7) | Certain | Medium | Visual review remains mandatory; new metrics (seam, jitter) target objective defects only |
| Review cost grows with animation/directions | Medium | Low | Sheets capped at 1568 px long edge; `latest` and per-tech sheets; frame strips at 1× + one scaled row |
| Silent stage bugs (E9) | Medium | High | `--stages` dumps + stage tests per pipeline, written before features |
| Regressions on refinement (E8) | High | Low | v(n−1) column always in sheet; never edit scored versions; `bench` in CI |
| Workspace conversion breaks the app CI/deploy | Low | High | Phase 0 alone; CI + Pages build verified before any engine code lands |

## 7. Definition of done (per phase)

1. Typecheck, unit, stage and golden tests green in CI; app build unaffected.
2. Benchmark assets for the phase rendered, reviewed (sheet committed under `docs/artgen/sheets/`), scored in
   the ledger at or above target.
3. Skill and references updated so a fresh agent can use the new capability.
4. Short findings note appended if scores or recipes changed.

## 8. First step after approval

Phase 0: import artlab as the frozen reference, convert to a workspace, wire CI — one small PR, no behaviour
change to the app.
