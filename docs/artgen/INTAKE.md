# artgen — Intake

Status: **draft for review, rev 3** · Owner: rstevenson1237 · Date: 2026-10-05
Companion docs: [SPEC.md](SPEC.md) (what we build) · [PLAN.md](PLAN.md) (how and in what order)

Rev 2 reframes the effort around four workflows (see §2). Rev 3 replaces "pick a technique per form" with
**one generation pipeline** (see §3.1): T2 primitives built out to T3 parity, a procedural second pass, three
revision passes, one direct-pixel finishing pass, then user-review iterations.

## 1. Request

> Use these findings to build out an art generation suite. Target textures and assets and effects, pixel and
> voxel, for top down, isometric, 2.5d and first person views. Python/js utilities wrapped in skill or tool
> interface.

Follow-up (defines the target):

> 1) import the repository into a claude code driven project and use the toolset to create a targeted art
> direction for consistent output (art style, color palette, camera style etc) 2) using a defined theme create
> assets with defined output styles etc for that specific project 3) have a reusable component to allow easy
> usage of the assets in a project 4) if a ui presence is desirable we should work within the existing image
> tools framework, though the framework can be updated to meet shared needs

Inputs supplied: `artlab.zip` (harness, libs, 60 technique versions, ledger), `FINDINGS.md`,
`FINDINGS-iso.md`, `REPORT-iso.md`, two final-comparison sheets.

## 2. The four workflows (the deliverables)

| # | Workflow | Who drives | Input | Output in the game project |
|---|---|---|---|---|
| **W1** | **Adopt + art direction.** Install the toolset into a game repo, then establish a locked art direction | Claude Code (skill), user decides | Game concept, mood words, reference notes, view type | `art/direction.json` (machine-readable style bible), style sheet PNG, approved "style anchor" assets |
| **W2** | **Themed asset production.** Produce the project's assets, all conforming to the direction | Claude Code, user approves | Direction + asset brief list | Versioned asset sources, review sheets, approved exports (sheets/atlases/textures/voxels + manifests) |
| **W3** | **Use the assets.** A reusable runtime component that loads and plays exported assets | Game developer | Exported pack + manifest | `@artgen/runtime` (typed asset ids, sprites/animation/directions, tiles, effects, palette swap) + engine adapters |
| **W4** | **UI where it helps.** Direction, review/approval and tweaking inside the existing image tools app | User | Game repo's `art/` folder | Edits written back to the same files Claude Code reads |

The connecting idea: **assets are code + a direction file.** Because every asset is a seeded render function
that pulls palette, sizes, outline, light and camera from `direction.json`, a direction change re-renders the
whole set consistently, and the UI and Claude Code cooperate through plain files.

## 3. What the evidence says (design constraints)

| # | Finding | Evidence |
|---|---|---|
| E1 | **No single technique wins.** Match technique to *form*. *(Superseded by §3.1: one pipeline, with T2 brought up to T3.)* | T1 wins small characters (7.5, 7); T3 large hard-surface & leggy organics (7.5, 7.5, 7); T4 boxy iso props (7, first try) |
| E2 | ≤32 px sprites: hand-authored char-maps (T1) are best and cheapest. | Hero 7 on v1; best points per dollar (1.5) |
| E3 | Large hard-surface: SVG → 8× supersample → **asset-restricted palette** quantize → majority downsample → 1 px raster outline; outlines as dark underlay shapes, never strokes. | T3 v3 ship/tank 7.5 |
| E4 | Voxels: best for iso props, multi-state objects, re-rotation; plateau ~5 for small organics. | T4 chest 7 vs hero 5, spider 4.5 |
| E5 | Primitives (T2) are the reuse play; seed variety was too narrow (4 combos). | T2 never best, 6.3–6.5 avg |
| E6 | Iso: decoration as surface slabs, no interpenetrating volumes; strokes don't compose. | T2/T3 chest regressions |
| E7 | Hygiene metrics saturate and can't rank quality — a gate, not a judge. | Finals 9.7–10 |
| E8 | ~1 in 4 refinement passes regress; always compare v(n) with v(n−1). | T3 ship v2, T1 tank v3 |
| E9 | Verify every pipeline stage — the SVG supersample silently did nothing until fixed. | Orphans 2.6→0.2%, 3.8→0.4% |
| E10 | Production hybrid: T3/T2 base → T1 char-map finishing → shared post passes. | FINDINGS §hybrid |
| E11 | Cost per asset is low and not the differentiator; review images are ~40% of it. | Report totals |
| E12 | Backlog: mask templates, 3D→pixel with internal-res outlines, WFC, L-systems, SDF banding, paper-doll + palette swap, normal maps, RotSprite, 8-dir voxel rotation, parametric animation. | FINDINGS "next" |

### 3.1 Technique decision (rev 3)

Owner's conclusion from the findings:

> build out t2 with primitives to bring it comparable with t3 + second pass procedural effects and special use
> algorithms and then use a three pass revision followed by a single pass of direct pixel
> manipulation/fixing/effects/lighting/outlining and then further iteration pending user review

What this means for the suite:

| Before (rev 1–2) | Now (rev 3) |
|---|---|
| Router picks T1, T2, T3 or T4 per asset by form (E1) | **Every asset uses one pipeline**; T2 is the only authoring technique |
| T3 (SVG) wins large hard-surface and organic curves | T2 gains what made T3 win: curves (paths), sub-pixel geometry, the supersample → palette-quantize → majority-downsample path, underlay outlines (E3). Target: T2 matches the T3 finals |
| T1 char-maps are a technique for small sprites | T1 becomes the **finishing pass**: one direct-pixel pass for fixes, pixel effects, lighting touches, outlines and face/emblem patches (the E10 hybrid, made mandatory) |
| Effects, textures and special algorithms are separate techniques (T5–T7) | They make up the **procedural second pass** layered on the T2 scene (noise/material patterns, L-systems, WFC, mask variation, particles, banded lighting, dither, shadows) |
| Iterate until the score stops improving | **Fixed cadence**: three reviewed revision passes, keep the best (regression guard for E8), finish once, then iterate only on user feedback |
| T4 voxels are their own technique | Voxels become T2's **3D mode**: the same primitive and material specs, rendered through the voxel renderers. Still needed for iso props, states, rotations, sprite stacks and FP billboards (E4) |

Why it holds up against the evidence: T2 already had the best reuse story (E5) and shading by material, and
lost to T3 mainly on curves and the supersampling path. Both can be moved into T2. T1's strength (every pixel is
a decision) is kept where it pays off most, as a final touch-up rather than as the way an asset is built.

Implication for W1: the findings show **consistency comes from shared constraints** — the restricted palette,
one outline rule, one light direction, fixed pixel scale — more than from the technique. Those constraints are
exactly what `direction.json` locks.

## 4. Goals

1. **G1 — Portable toolset.** One install step puts skills, CLI and MCP tools into any Claude Code game repo.
2. **G2 — Art direction as data.** Style, palette, camera/view, scale, outline, lighting, shading and
   proportion rules captured in a versioned file that every render reads and every review checks.
3. **G3 — Consistent production.** Brief → the fixed pipeline (§3.1) → user review → approve → export for the
   project's asset list, with conformance checks against the direction and a regression benchmark.
8. **G8 — T2 parity.** The extended T2 ("T2+") matches or beats artlab's best final for every benchmark asset
   (T1 hero 7.5, T3 ship/tank 7.5, T3 spider 7, T1 isohero 7, T4 chest 7) once the finishing pass is applied.
4. **G4 — Coverage.** Sprites/props, textures/tiles and effects for top-down, isometric, 2.5D and first-person,
   pixel output from pixel and voxel sources, plus voxel model export.
5. **G5 — Drop-in runtime.** A small typed component that makes exported assets one line to use in a game.
6. **G6 — UI in the existing app.** New tools in image_tools for direction, review and tweaking; shared
   framework changes made where they benefit all tools.
7. **G7 — JS core, Python access.** TS engine; Python client for Python pipelines.

## 5. Non-goals (proposed)

- Diffusion / external generative-image models (keeps output deterministic, licence-clean, palette-exact).
- A pixel editor (hand edits stay in Aseprite; we import them back as finishing-pass patches — see SPEC §6.5).
- Non-voxel 3D meshes, painted high-res art, audio, UI kits, fonts (v1).
- A hosted backend. The UI stays client-side, like the rest of image_tools.

## 6. Usage scenarios

| Scenario | Workflow |
|---|---|
| "Set up art for my top-down roguelike: grim swamp, 16-colour, 24 px characters" → three candidate style tiles → user picks B, tweaks palette in the UI → direction v1 locked | W1, W4 |
| "Make the 14 enemies in `art/briefs.yaml`, 8 directions, idle + walk" → batch loop, gallery sheet, user approves 12, asks for 2 redos | W2, W4 |
| Developer writes `sprites.play(Assets.goblin, 'walk', angle)` in Phaser with autocomplete | W3 |
| Direction v2 changes palette and outline colour → `artgen restyle` re-renders all approved assets, diff sheet for sign-off | W1→W2 |
| Python level-generator script calls `artgen.texture('swamp-mud', size=32)` | W2 (Python) |

## 7. Decisions needed from you

Defaults are what SPEC and PLAN assume. Answer only what you want to change. Full explanation, friction points
and alternatives for each: [DECISIONS.md](DECISIONS.md) (which also adds D16–D19).

| # | Question | Recommended default | Alternatives |
|---|---|---|---|
| D1 | How does a game repo "import" the toolset? | **This repo is a Claude Code plugin marketplace**: `/plugin install artgen` brings skills, slash commands, agent and MCP server; `npx artgen init` scaffolds `art/`. Engine shipped prebuilt inside the plugin | git submodule; npm package only; copy-in script |
| D2 | Where engine + UI code lives | **npm workspace in this repo** (`packages/*`), web tools in `src/tools/` | Separate repo |
| D3 | Runtime targets (W3) | **Engine-agnostic TS runtime + Canvas2D and Phaser adapters first**; PixiJS, Godot importer next | Name your engine (Godot/Unity/Pixi/Three/pygame) |
| D4 | Runtime distribution | **Vendored into the game repo by `artgen export --runtime`** (version-stamped, no registry needed); npm publish later | Publish to npm / GitHub Packages now |
| D5 | How the UI reaches a game repo's files | **File System Access API** (open the game's `art/` folder; Chromium); zip import/export fallback; optional `artgen ui` local server | Upload/download only |
| D6 | Art direction candidates | **3 candidate directions**, each rendered as a style tile (same probe set: character, prop, tile, effect) | 2 / 4+; single proposal |
| D7 | Python's role | **Thin typed client** over the CLI JSON protocol; optional Blender adapter later | Python-native engine |
| D8 | What "2.5D" means | **All three, in order:** 3/4 oblique, voxel sprite-stacking, side-view parallax | Pick one |
| D9 | First-person target | **Retro raycaster/billboard** assets + `.vox`/glTF export for voxel-world engines | One of them |
| D10 | Approval authority | **User approves**; Claude's 0–10 score + conformance gate recommend | Auto-approve ≥ threshold |
| D11 | artlab | **Port to TS; its six assets become the regression benchmark** | Fresh start |
| D12 | What "three pass revision" counts | **Three reviewed versions (v1, v2, v3)**: the first build plus two revisions, which matches where artlab's gains happened | v1 plus three revisions (v4) |
| D13 | Where voxels sit | **T2+ 3D mode** (same primitives, voxel renderers) used for iso props, states, rotations, stacks and FP billboards | Drop voxels as a source; keep only `.vox` export |
| D14 | Old T1/T3/T4 code | **Absorbed**: T1 → finishing-pass `patch`; T3 → T2+ `path` primitive + `ss` raster mode (SVG paths still import, including from the SVG Tracer); T4 → T2+ 3D mode. No separate authoring modes | Keep T3 as a fallback authoring mode |
| D15 | Finishing on animations | **Global finish ops on every frame + patches on key frames that follow named anchor points** (e.g. `head`) through the other frames | Hand-finish every frame |

## 8. Assumptions

- Game projects are git repos opened in Claude Code; agents have vision (the review loop depends on it).
- Node 22 available in game repos (the CLI needs it); Python ≥ 3.10 for the client.
- Output is palette-exact RGBA PNG; partial alpha only for declared shadow colours.
- Determinism is per platform + pinned dependency versions.

## 9. Success criteria

1. **W1:** In a fresh game repo, install + `/artgen:direction` produces 3 style tiles, the user's choice is
   locked to `direction.json` + style sheet in one session, and probe assets re-rendered under it pass
   conformance.
2. **W2:** A 10-asset brief across ≥ 2 kinds is produced, reviewed and exported; every approved asset passes
   conformance and scores ≥ 6.5; a direction change re-renders the set with one command.
3. **W3:** A sample Phaser and a Canvas2D game load the export and play a directional animation, a tile map
   and an effect, with typed asset ids, in < 20 lines of game code each.
4. **W4:** The image tools app opens a game's `art/` folder, edits the palette, approves assets, and Claude
   Code sees those changes on its next read. Existing tools unaffected.
5. **T2 parity (G8):** every artlab benchmark asset rebuilt through the pipeline scores ≥ artlab's best final
   for that asset, by the end of the third revision plus finishing pass.
6. Coverage matrix (SPEC §8) filled, each cell with a benchmark asset ≥ 6.5; artlab benchmark ≥ its finals.

## 10. Risks (details in PLAN §7)

Breadth (4 views × 3 categories × 2 media) vs depth; voxel organic quality; "consistency" being judged
subjectively; File System Access API being Chromium-only; plugin packaging details; runtime scope creep into a
game engine.
