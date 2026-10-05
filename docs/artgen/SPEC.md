# artgen — Specification

Status: **draft for review** · assumes the recommended defaults in [INTAKE §7](INTAKE.md#7-decisions-needed-from-you)

## 1. Summary

`artgen` is a procedural game-art engine (TypeScript, runs in Node and the browser) plus three front-ends — a
CLI, a Claude Code skill, an MCP server — and a Python client. Assets are small **code modules** authored by an
agent or a human; the engine supplies techniques, projections, a voxel subsystem, texture and effect generators,
post-processing passes, quality checks, review sheets and exporters.

```
            ┌──────────── front-ends ─────────────┐
 Claude ──► │ skill (.claude/skills/artgen)       │
 Code       │   └─ drives CLI                     │
 MCP    ──► │ artgen-mcp (stdio)                  │──┐
 Python ──► │ artgen-py  (subprocess, JSON)       │  │  all call
 Web app ─► │ ArtLab tool (worker, later)         │  │  the same API
            └─────────────────────────────────────┘  ▼
 ┌──────────────────────────── @artgen/core ─────────────────────────────┐
 │ core: Grid · Palette · RNG · PNG · bitmap font                       │
 │ techniques: charmap(T1) · prim(T2) · svg(T3) · voxel(T4) ·           │
 │             mask(T5) · field/noise(T6) · particles(T7)               │
 │ proj: topdown · oblique · iso · stack · side · billboard · fp        │
 │ tex: noise · seamless · materials · autotile · wfc · normal          │
 │ fx: timeline · particles · palette-cycle · dither                    │
 │ post: outline · quantize · downsample · despeckle · shadow · rotsprite│
 │ qa: metrics · sheets · context previews (iso floor, tiled, raycaster) │
 │ pack: atlas · manifest · aseprite json · gif/apng · .vox · gltf      │
 └───────────────────────────────────────────────────────────────────────┘
```

## 2. Design rules (from the findings)

| Rule | Source | Enforced by |
|---|---|---|
| R1 Route by form: small character → T1; large hard-surface or organic curves → T3; boxy/stateful/rotating prop → T4; families/variants → T2/T5; surfaces → T6; effects → T7 | E1–E5 | `artgen route` command + skill table; asset `meta.technique` |
| R2 Hybrid is the default for hero assets: base (T2/T3/T4) → T1 char-map overlay → post | E10 | `overlay()` pass + recipe templates |
| R3 Supersampled vector path is fixed: render vector at `size×ss` natively, quantize to **asset palette**, mode-downsample, outline at final res | E3, E9 | `svg.render()` has no other ss path; stage-verification test |
| R4 Outlines are underlays or raster passes, never vector strokes (strokes are linted) | E3, E6 | `svg` lint warns on `stroke` in ss mode |
| R5 Iso/voxel decoration is a surface slab, not an interpenetrating volume | E6 | voxel `slab()` helper; prim iso lint for overlapping boxes |
| R6 Metrics gate, review judges | E7 | `review` required before `score`; `score` requires a sheet id |
| R7 Every review shows v(n) beside v(n−1) on checker **and** in-context background | E8 | sheet builder default |
| R8 Every pipeline stage is inspectable (`--stages` dumps each intermediate) | E9 | stage dumps + tests |
| R9 Determinism: seeded RNG, integer pixel math, no platform AA in final output | — | golden tests |
| R10 Never edit a scored version; new idea = new version file | artlab CLAUDE.md | CLI `new` copies v(n) → v(n+1); ledger hashes source |

## 3. Coverage matrix

Rows are deliverable categories, columns are views. Each cell lists the primary technique(s) and the context
preview used in review.

| | Top-down | Isometric (2:1) | 2.5D | First-person |
|---|---|---|---|---|
| **Characters / creatures** | T1 (≤32), T3 (>32 or organic), T2 variants; 4/8 dirs by mirror + overlay | T1 / T3; T4 for rotations; ground shadow + pivot on tile | Oblique 3/4: T1/T2; stack: T4 slices | Billboard sprites, 8 dirs from T4 or authored front/side/back + mirror |
| **Props / vehicles / buildings** | T3 hard-surface, T4 ortho render | **T4** (states, rotations), T2 boxFaces | Oblique: T4 oblique render; stack: T4 | Billboards (T4), weapon view-models (T3+T1) |
| **Textures / tiles** | T6 seamless materials, autotile 16/47, WFC decor | Iso floor diamonds, wall blocks (T4/T6), edge transitions | Oblique wall-front tiles, parallax layers (side) | Wall/floor/ceiling 64/128 seamless + normal maps, sky panoramas, decals |
| **Effects** | T7 particles (explosion, smoke, fire, sparks, magic), palette cycling (water/lava) | T7 with iso ground projection of splashes/shadows | Same as top-down / side | Muzzle flash, impacts, projectiles, screen-space hit sprites |
| **Voxel output** | — | `.vox` + glTF of any T4 model | slice sheet (sprite stack) | `.vox` / greedy-mesh glTF for voxel-world engines |
| **Context preview** | grass/water/dirt bg | iso floor grid | oblique room / stack rotation strip / parallax scroll strip | raycaster corridor render |

## 4. Core data model

### 4.1 Grid
RGBA `Uint8ClampedArray` buffer, as in artlab (`set/get/alpha/clone/stamp`), plus: `crop`, `pad`, `flipX/Y`,
`trim() → {grid, offset}`, `toIndexed(palette)`/`fromIndexed`, `equals`, `hash()` (for golden tests). Colors are
`#rrggbb` strings or palette refs (`'steel.1'`). Partial alpha is allowed only for colors tagged `shadow`.

### 4.2 Palette
```ts
interface Palette {
  id: string;
  ramps: Record<string, string[]>;   // light → dark, e.g. steel: ['#eef2f5', ...]
  singles: Record<string, string>;   // outline, ink, blush ...
  shadow: { color: string; alpha: number };
}
```
- Sources: built-in `artlab` master palette (default), Lospec `.hex`/`.gpl` import, generated hue-shifted ramps
  (`ramp(base, steps, {hueShift, satShift})`).
- `restrict(palette, ['armor','cyan','orange','outline'])` → asset-restricted sub-palette (R3).
- Palette swap maps (`{ 'blue': 'red' }`) for variants and team colors.

### 4.3 Asset module (the authoring unit)
Plain ESM file, one per version, written by agent or human. Layout: `art/<project>/<asset>/<tech>.v<N>.js`.

```js
// art/dungeon/chest/t4.v1.js — header comment: what changed vs previous version
export const meta = {
  view: 'iso',                 // topdown | oblique | iso | stack | side | fp
  kind: 'prop',                // character | creature | prop | tile | texture | effect | viewmodel
  size: [32, 32],              // per frame
  palette: 'dungeon',          // project palette id, optionally .restrict([...])
  anchor: [16, 24],            // pivot in px (feet / tile centre)
  states: ['closed', 'open'],  // optional named frames
  directions: 1,               // 1 | 4 | 8 | 16
  anim: null,                  // { name: { frames, fps, loop } }
  notes: 'Parametric open/closed voxel chest',
};
export function render(ctx) {   // ctx: { seed, params, pal, state, dir, frame, t, lib }
  const v = ctx.lib.voxel.model();
  /* ... */
  return v.render({ proj: 'iso', ...});  // returns Grid (one frame); engine loops states × dirs × frames
}
```

The engine calls `render` once per `(state, direction, frame)` and assembles sheets — authors never hand-pack.
`params` are declared defaults (`export const params = { legAngle: 0.3 }`) that the CLI/MCP can override, which
is also how animation is driven (`t` in 0..1).

### 4.4 Manifest (per exported asset)
```json
{ "id": "dungeon/chest", "version": "t4.v1", "view": "iso", "size": [32,32], "anchor": [16,24],
  "palette": "dungeon", "sheet": "chest.png", "layout": {"rows":"state","cols":"dir"},
  "frames": [{"state":"closed","dir":0,"frame":0,"x":0,"y":0,"w":32,"h":32}],
  "anims": {}, "normalMap": null, "score": 7, "hygiene": 9.7, "sourceHash": "…" }
```

### 4.5 Project
`art/<project>/project.json`: palette, default sizes per kind, iso tile size, light direction, outline color,
review backgrounds, export targets.

## 5. Techniques

| Id | Name | Library | Use when | Carries over from artlab |
|---|---|---|---|---|
| T1 | Char-map | `charmap` | ≤32 px characters, faces, emblems, finishing overlays | `blit`, mirrored half-maps, right-side shade pass (generalised to light direction) |
| T2 | Primitives | `prim` | parametric families, quick props | `Scene`, `bevel/sphere/cyl/flat`, `rim`, `ink`, `inkAll`, mirror, `pattern`; **add** more seed axes (proportions, accessories, palette swaps) |
| T3 | SVG → pixel | `svg` | >32 px hard-surface, organic curves | `doc`, `ss` pipeline (R3) via **resvg** (identical in Node and browser, renders natively at target size) |
| T4 | Voxel | `voxel` | iso props, stateful objects, any multi-direction asset, sprite stacks, FP billboards | `Voxels` box/ellipsoid/line/paint, `k` fine voxels; **new** renderer (§7) |
| T5 | Mask template | `mask` | mass variants of ships/creatures/items (Bollinger-style mirrored random masks) | new |
| T6 | Field / noise | `tex` | textures, terrain, materials | new |
| T7 | Particles | `fx` | effects | new |

Cross-technique: `overlay(grid, charmap, at)` (R2), `compose(layers)` for paper-doll layering, `variants(render,
seeds)`.

### 5.1 Router
`artgen route --kind creature --view iso --size 32x32 --traits organic,legs` returns ranked techniques with the
reason and the matching recipe file, from a table seeded by the findings and updated from the ledger (mean final
score per technique × kind × view × size bucket).

## 6. Views and projections

All projections take world coords (x right, y away/down-screen, z up) and return screen px. Light defaults to
upper-left; one `light` setting per project feeds every shader.

| View | Projection | Conventions | Review context |
|---|---|---|---|
| `topdown` | orthographic straight down | anchor = centre; facings by rotation (RotSprite) or authored | checker + project bg (grass/water/dirt) |
| `oblique` (2.5D a) | top face + front face, front height ratio `r` (default 0.5) | anchor = base front centre; Y-sort by base | small oblique room tiles |
| `iso` | 2:1 dimetric, `P(x,y,z) = ((x−y)·2, (x+y) − 2z)` per unit; tile 32×16 | anchor on tile diamond centre; ground shadow; painter order `x+y`, then `z` | iso floor grid (artlab `isoFloor`) |
| `stack` (2.5D b) | z-slices of a voxel model, 1 slice per px of height | output = slice strip; preview = slices drawn rotated + offset 1 px/slice at 8 angles | rotation strip |
| `side` (2.5D c) | orthographic side view | parallax layers with declared depth factors | horizontal scroll strip of layers |
| `fp` | perspective raycaster for preview only; assets are flat textures and billboards | walls 64/128 square, power-of-two, seamless; billboards anchored at feet, N directions | raycaster corridor render with the textures and sprites in place |

## 7. Voxel subsystem

### 7.1 Model
Sparse map `x,y,z → material` (artlab `Voxels`) plus: `slab(face, rect, mat)` for surface decoration (R5),
`mirror(axis)`, `sdf(fn, mat)` for smooth organics, `carve`, `paint`, `merge(model, offset)`, palette materials as
ramp refs, named parts for states/animation (`part('lid').rotate(axis, angle, pivot)`).

### 7.2 Renderers
| Renderer | How | Best for |
|---|---|---|
| `cubes` (artlab) | stamp exact 4×4 px iso cubes in painter order, 3-face shading | crisp boxy iso props (artlab chest 7/10) |
| `raster` (new) | z-buffered point/face rasteriser at `ss×` for any yaw/pitch & any projection; depth + normal buffers | rotations (8/16 dirs), top-down/oblique/side, billboards |
| `toon` shading (new) | smooth normals (SDF gradient or 3×3×3 neighbourhood average) → N quantized light bands on the material ramp | organics — the fix for the E4 plateau |
| outlines | from depth/ID discontinuities **at internal res**, then 1 px final-res outer outline | guaranteed 1 px lines (FINDINGS research item) |

All renders: optional `ss` → quantize to palette → mode-downsample → despeckle → outline → shadow (artlab order).

### 7.3 Voxel export
MagicaVoxel `.vox` (read/write), glTF 2.0 via greedy meshing with palette texture, slice PNG strip.

## 8. Textures and tiles (T6)

- **Noise**: value, Perlin/simplex, Worley, fBm — all **periodic** (wrap on the tile size) so tiles are seamless
  by construction.
- **Materials** (recipes with params + seed): stone brick, cobble, wood plank, metal panel/rivets, grass, dirt,
  sand, snow, water, lava, tech floor, carpet. Output banded to the palette ramp, optional ordered/Bayer dither.
- **Seamless check**: render 3×3 tiled, measure seam discontinuity vs interior (metric `seam`).
- **Autotiles**: 16-tile (4-bit corner/Wang) and 47-tile blob sets generated from an edge/corner recipe;
  iso variants (floor diamond, wall block, edge transitions).
- **WFC**: overlapping-model WFC for decor/layout variation, seeded.
- **L-systems**: foliage, roots, cracks.
- **Normal maps** from height field (textures) or from the voxel normal buffer (sprites).

## 9. Effects and animation (T7)

- **Timeline**: `params` are functions of `t ∈ [0,1)`; engine samples N frames (also drives walk cycles via leg
  angles etc. in T2/T3/T4).
- **Particles**: deterministic seeded emitter → per-particle life, velocity, drag, gravity, size curve; colour
  from a ramp by life; rendered as pixel discs/sprites into frames; optional iso ground projection.
- **Presets**: explosion, smoke puff, fire loop, sparks, magic burst, heal, muzzle flash, bullet impact, water
  splash, dust, projectile trail.
- **Palette cycling**: index-range rotation for water/lava/conveyors — exported as frames and as a cycle spec.
- Frame QA: bbox jitter, colour drift between frames, loop seam (last→first diff).

## 10. Post-processing passes

From artlab (keep semantics): `outline(color, diag)`, `quantize(pal)`, `modeDownsample(f)`, `dropShadow`,
`despeckle`, `groundShadow`.
New: `selout` (outline coloured by the adjacent ramp), `innerOutline` (ID-boundary), `dither(bayer|noise)`,
`hueShiftRamp`, `rotsprite(angle)`, `paletteSwap`, `overlay`, `trim`, `normalFromHeight`.

## 11. Quality assurance

| Layer | What |
|---|---|
| Hygiene metrics | artlab `measure()` (colours, AA%, off-palette%, orphan%, outline%, symmetry%) + `seam`, `frameJitter`, `anchorOnTile`, `silhouetteFill`. Used as a **gate** (default: hygiene ≥ 8.5, off-palette = 0, AA% = 0 except shadow) |
| Review sheets | rows of `[1×] [n× on checker] [n× in context]`, v(n) beside v(n−1); animations as frame strip + onion skin; directions as a ring; textures 3×3 tiled; FP as raycaster shot. Labels drawn with a built-in pixel font. Sheet size kept under the 1568 px long edge (vision token budget) |
| Score | 0–10 visual score + note, recorded against a sheet id (R6) |
| Ledger | `art/ledger.jsonl`, append-only: source hash, full/edit tokens, metrics, sheet ids + image tokens, scores; `report` produces per-technique cost/score tables (artlab REPORT format) |
| Golden tests | seeded render hash per benchmark asset; diffs surface as an image in CI artifacts |
| Stage tests | each pipeline stage verified independently (e.g. svg ss stage actually renders `size×ss` pixels of new detail; downsample preserves 1 px lines) |

## 12. Interfaces

### 12.1 CLI (`artgen`)
All commands accept `--json` (machine output) and `--project`.

| Command | Purpose |
|---|---|
| `init <project>` | scaffold `art/<project>/project.json` + palette |
| `route --kind --view --size [--traits]` | ranked technique suggestion + recipe |
| `new <asset> <tech> [--from vN]` | create v(n+1) by copying v(n) (or a recipe template) |
| `render <asset> [<tech> <ver>] [--seed --params --stages]` | render frames, write PNGs, log metrics |
| `review <asset> [tech\|latest\|compare a,b]` | build review sheet; prints path + image-token estimate |
| `score <asset> <tech> <ver> <0-10> "note"` | record visual score |
| `variants <asset> --n 8` | seeded variant sheet |
| `texture <material> --size 64 [--seamless --normal --dither]` | one-shot texture generation |
| `fx <preset> --size 32 --frames 12` | one-shot effect sheet |
| `voxel <asset> --dirs 8 --proj iso\|topdown\|oblique\|stack\|billboard` | multi-direction render |
| `export <asset\|project> --to png,aseprite,atlas,vox,gltf` | packaged output + manifests |
| `report [project]` | REPORT.md + final comparison sheet |
| `bench` | re-render benchmark set, compare to recorded finals |

### 12.2 Claude Code skill
```
.claude/skills/artgen/
  SKILL.md                 # when to use, the loop, router table, gate, hard rules R1–R10
  references/
    techniques.md          # T1–T7 recipes with minimal working examples
    topdown.md iso.md 2_5d.md first_person.md
    textures.md effects.md voxel.md
    pitfalls.md            # every regression in the findings, with the fix
  templates/               # starter asset modules per (kind × view × technique)
```
The loop the skill prescribes: `route` → `new` → edit → `render` → `review` (open the PNG) → `score` → repeat
until score ≥ target or 2 non-improving passes → `export`. Max iterations and target score are arguments.

### 12.3 MCP server (`artgen-mcp`, stdio)
Tools mirror the CLI: `route`, `render`, `review`, `score`, `texture`, `fx`, `voxel_render`, `export`,
`palette_import`, `measure`. `render`/`review`/`texture`/`fx` return the PNG as MCP image content plus metrics
JSON, so a client sees the result without a separate file read. Asset source is passed as a string or path.

### 12.4 Python client (`artgen-py`)
```python
from artgen import Artgen
ag = Artgen(project="dungeon")
img, meta = ag.texture("stone-brick", size=64, seamless=True, normal=True)   # PIL.Image, dict
ag.render("chest", tech="t4", ver="v1", seed=3).save("chest.png")
```
Subprocess to `artgen --json`, typed dataclasses, optional Pillow/numpy conversion. Optional `artgen.blender`
adapter (later) for 3D→pixel renders from `.blend`/glTF.

### 12.5 Web app (later)
`ArtLab` tool in `src/tools/`: browse projects, tweak seed/params live (core in a worker), preview in context,
export. Uses the existing tool registry and worker pool.

## 13. Output formats

PNG (palette-exact), sprite sheet + manifest JSON (§4.4), Aseprite-compatible JSON (`frames`/`meta.frameTags`),
packed atlas + JSON, GIF/APNG previews, normal-map PNG, `.vox`, `.gltf/.glb`, `.hex`/`.gpl` palettes.

## 14. Non-functional

- **Portability**: `@artgen/core` has no Node or DOM imports; I/O adapters per runtime. Dependencies: `@resvg/resvg-wasm`
  (SVG), a pure-JS PNG codec, `gifenc`; nothing native.
- **Determinism**: seeded mulberry32 (artlab), integer pixel math, no canvas AA in final pixels.
- **Performance**: a 64×64 sprite incl. ss=8 renders < 200 ms; a 128 texture < 100 ms; benchmark suite < 30 s.
- **Testing**: vitest; runs in the repo's existing CI job.
- **Docs**: README per package; the skill is the user-facing guide.

## 15. Out of scope (v1)

Diffusion/ML image generation; pixel editor; non-voxel 3D meshes; audio; UI kits; engine-specific importers
(follow-up after D6).
