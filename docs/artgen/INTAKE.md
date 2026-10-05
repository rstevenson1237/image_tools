# artgen — Intake

Status: **draft for review** · Owner: rstevenson1237 · Date: 2026-10-05
Companion docs: [SPEC.md](SPEC.md) (what we build) · [PLAN.md](PLAN.md) (how and in what order)

## 1. Request

> Use these findings to build out an art generation suite. Target textures and assets and effects, pixel and
> voxel, for top down, isometric, 2.5d and first person views. Python/js utilities wrapped in skill or tool
> interface.

Inputs supplied with the request:

| Input | What it is |
|---|---|
| `artlab.zip` | Experiment harness: `lib/{core,post,prim,svg,iso,voxel,metrics}.js`, `run.js` (render → review sheet → score → report loop), 60 versioned technique files, token/score ledger |
| `FINDINGS.md` | Top-down study: hero 32×32, battleship 160×41, sci-fi tank 64×64 × techniques T1–T3 |
| `FINDINGS-iso.md`, `REPORT-iso.md` | Isometric study: hero 32×48, spider 32×32, chest 64×32 × T1–T4 (adds voxels) |
| Two comparison sheets | Final iteration of every technique × asset, top-down and iso |

## 2. Problem statement

Claude can author good pixel art as **code** (scores of 6.5–7.5/10 on first or second try), but only inside a
throw-away experiment harness: one master palette, hard-coded asset table, two views, no textures, no effects,
no animation, no export format, and the knowledge of *which technique to use when* lives in two Markdown files
rather than in the tooling. We want a reusable, tested suite that an agent (Claude Code, or any MCP client) and
a human can drive to produce shippable game art across four view types.

## 3. What the evidence says (constraints the design must honour)

Distilled from the findings; each becomes a design rule in SPEC §2.

| # | Finding | Evidence |
|---|---|---|
| E1 | **No single technique wins.** Match technique to *form*, not to project. | T1 wins small characters (7.5, 7); T3 wins large hard-surface and leggy organics (7.5, 7.5, 7); T4 wins boxy iso props (7, first try) |
| E2 | Small sprites (≤32 px): hand-authored char-maps (T1) are best and cheapest. | Hero 7 on v1; best visual-points-per-dollar (1.5) |
| E3 | Large hard-surface: SVG → 8× supersample → asset-restricted palette quantize → majority downsample → 1 px raster outline. Outlines as dark **underlay shapes**, never strokes. | T3 v3 ship/tank 7.5; stroke-removal alone regressed |
| E4 | Voxels: best for iso props, multi-state objects and re-rotation; plateau ~5 for organic shapes at small sizes (stair-step speckle). | T4 chest 7 vs hero 5, spider 4.5 |
| E5 | Primitives (T2) are the **reuse** play: library fixes lift every sprite, seeds give variants — but variety was only 4 combos. | T2 averages 6.3–6.5, never best |
| E6 | Iso-specific: no interpenetrating volumes (decoration = surface slabs); vector strokes do not compose in iso. | T2/T3 chest regressions v1–v3 |
| E7 | Automated hygiene metrics **saturate** (9.7–10) and cannot rank quality. They are a gate; visual review is the judge. | Report tables |
| E8 | ~1 in 4 refinement passes regress. Always review v(n) beside v(n−1). | T3 ship v2, T1 tank v3, T3 hero |
| E9 | **Verify every pipeline stage**, not only the final sprite. The SVG supersample silently did nothing until fixed. | Orphans fell 2.6%→0.2% (ship), 3.8%→0.4% (tank) after fix |
| E10 | Recommended production hybrid: silhouette/large forms in T3 or T2 → T1 char-map finishing pass (faces, emblems) → shared post passes. | FINDINGS §Recommended hybrid |
| E11 | Cost per asset is low (~$0.03–0.04 visible tokens; real sessions several × that) and not the differentiator; review images are ~40% of it. | Report totals |
| E12 | Research backlog worth adopting: mask-template generators, 3D→pixel with outline at internal res, WFC, L-systems, SDF banded shading, paper-doll + palette swap, normal maps, RotSprite, 8-direction voxel rotation, animation via parameters. | Both FINDINGS "next" sections |

## 4. Goals

1. **G1 — Coverage matrix.** Produce *sprites/props*, *textures/tiles* and *effects* for *top-down*, *isometric*,
   *2.5D* and *first-person* views, in *pixel* output and from *voxel* sources (plus voxel model export).
2. **G2 — Encoded know-how.** The technique router, recipes and pitfalls (E1–E12) live in code defaults and in a
   Claude skill, not only in prose.
3. **G3 — Agent-drivable.** One CLI with JSON in/out, a Claude Code skill that runs the author → render →
   review → score loop, and an MCP server so any MCP client can call the same operations.
4. **G4 — Python and JS.** JS/TS is the engine; Python gets a first-class client so Python pipelines and
   notebooks can generate assets.
5. **G5 — Shippable output.** Sprite sheets/atlases with manifests (pivots, frames, directions), seamless
   textures with normal maps, `.vox` / glTF for voxel models.
6. **G6 — Quality is measured.** Deterministic renders, golden-image tests, hygiene gate, review sheets with
   in-context previews, and a ledger of versions, scores and token cost.

## 5. Non-goals (proposed)

- Diffusion / external generative-image models. Everything is procedural or Claude-authored code (keeps
  output deterministic, licence-clean, palette-exact).
- A full sprite editor. The existing web app hosts viewing/tweaking later; pixel editing stays in Aseprite etc.
- High-res painted or 3D-mesh (non-voxel) art.
- Audio, UI kits, fonts (UI may come later; not in v1).

## 6. Users and usage scenarios

| User | Scenario |
|---|---|
| Claude Code agent | "Make a 32×48 iso skeleton with 8 directions and a 4-frame walk" → skill picks T4+T1 overlay, iterates with review sheets, exports sheet + manifest |
| Game developer (human) | Runs `artgen texture stone-brick --size 64 --seamless --normal` from a shell or a Python build script |
| Other MCP clients | Call `artgen.render`, `artgen.review` tools; receive PNG + metrics as tool results |
| Web app user (later) | Browses packs, nudges seeds/params, previews in context, downloads |

## 7. Decisions needed from you

Each has a recommended default; the spec and plan are written assuming the default. Answer only the ones you
want to change.

| # | Question | Recommended default | Alternatives |
|---|---|---|---|
| D1 | Where does it live? | **npm workspace in this repo** (`packages/artgen`, `packages/artgen-mcp`), so the web app can reuse the core | Separate repo |
| D2 | Python's role | **Thin, typed Python client** over the CLI's JSON protocol (`pip install artgen`), plus an optional Blender adapter later | Python-native core (duplicate engine); Python-only |
| D3 | What "2.5D" means | **All three, in this priority:** (a) 3/4 oblique top-down (Zelda/Stardew), (b) sprite-stacking from voxels, (c) side-view with parallax layers | Pick one |
| D4 | First-person target | **Retro raycaster/billboard style** (Doom/Wolf-like): wall/floor/ceiling textures, 8-dir billboard sprites, weapon view-models, skies; plus voxel `.vox`/glTF export for voxel-world engines | Raycaster only; voxel-world only |
| D5 | Interface priority | **CLI + Claude Code skill first**, MCP server second, Python client third, web UI last | MCP first |
| D6 | Export targets | **Generic PNG + JSON manifest, Aseprite-compatible sheet JSON, `.vox`, glTF**; engine importers (Godot/Unity/Phaser) as follow-ups | Name a primary engine now |
| D7 | Palette policy | **Per-project palettes** (Lospec `.hex`/`.gpl` import) with the artlab master palette as default; per-asset restricted sub-palettes | One fixed palette |
| D8 | Canonical sizes | Sprites 16/24/32/48/64; iso tile 32×16 (64×32 option); FP textures 64 and 128; effects 32/64 | Other grid |
| D9 | Carry artlab over? | **Port to TS, keep artlab's 6 assets as the regression benchmark** (re-render, re-score, must not drop below their finals) | Fresh start |
| D10 | Review judge | **Claude visual review (0–10) recorded in ledger, human spot-checks**; metrics gate only | Human-only scoring |

## 8. Assumptions

- Node 22 (matches CI). Python ≥ 3.10 for the client.
- Agents have vision and can read PNG review sheets (the whole loop depends on it).
- Output is palette-exact RGBA PNG; no partial alpha except deliberate shadows.
- Determinism is defined per platform+dependency version (golden images pinned in CI on Linux).

## 9. Success criteria (for the whole effort)

1. Every cell of the coverage matrix (SPEC §3) has at least one recipe and one benchmark asset scoring ≥ 6.5.
2. artlab benchmark assets re-rendered through the suite score ≥ their artlab finals.
3. A fresh agent session, given only the skill, produces a reviewed, exported asset in each view without reading
   the findings files.
4. CI: typecheck, unit tests, golden-image tests, stage-verification tests green.

## 10. Risks (summary — details in PLAN §6)

Scope breadth (4 views × 3 categories × 2 media); voxel organic quality plateau; SVG rasteriser differences
between Node and browser; visual-review cost growth with animation; metrics that cannot see quality.
