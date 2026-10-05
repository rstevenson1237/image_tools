# artgen — Specification

Status: **rev 4** — written against the resolved decisions in [INTAKE §7](INTAKE.md#7-decisions-resolved-2026-10-05) / [DECISIONS.md](DECISIONS.md)

## 1. Summary

Four deliverables share one engine:

| Workflow | Deliverable | Section |
|---|---|---|
| W1 Adopt + art direction | Committed install + `direction.json` + direction workflow | §3, §4 |
| W2 Themed production | Briefs, autonomous pipeline, conformance, user approval, export, analytics | §5, §6–§11 |
| W3 Use the assets | `@artgen/runtime` + adapters + generated types | §12 |
| W4 UI | New tools in image_tools + shared framework updates | §13 |

```
 ┌───────────────────────── game repo (Claude Code project) ─────────────────────────┐
 │  art/direction.json   art/briefs.yaml   art/assets/**/<tech>.v<N>.js   ledger    │
 │        ▲    │                  │                 │                               │
 │        │    ▼                  ▼                 ▼                               │
 │  ┌─────┴──── committed toolset (.claude/skills · agent · .mcp.json · tools/) ─┐  │
 │  │                         artgen CLI  ──►  @artgen/core                       │  │
 │  └──────────────────────────────────────────────┬─────────────────────────────┘  │
 │                                export ▼         │                                │
 │  public/assets/<pack>/{atlas.png, pack.json} + src/art/{runtime/, assets.ts}     │
 │        │                                                                         │
 │        ▼  game code: Assets.goblin.play('walk', angle)  (W3)                     │
 └──────────────────────────────────────────────────────────────────────────────────┘
        ▲ File System Access (read/write the same art/ files)
 ┌──────┴───── image_tools web app (W4): Art Direction · Asset Review · Asset Lab ────┐
 │             core in a worker (same @artgen/core build)                            │
 └───────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Design rules

| Rule | Source | Enforced by |
|---|---|---|
| R1 **One pipeline for every asset**: T2+ base → procedural pass → 3 revision passes → 1 finishing pass → user-review iterations (§6.3) | INTAKE §3.1 | CLI pass state machine; skill |
| R2 The finishing pass is the only direct-pixel stage, it runs once per base version, and it is stored as ops (not a flattened PNG) so it re-applies after re-renders | E10, §3.1 | `finish` files bound to a base version |
| R3 T2+ `ss` raster mode is fixed: coverage at size×ss → quantize to **asset palette** → mode-downsample → final-res outline | E3, E9 | single ss implementation; stage test |
| R4 No strokes; outlines are auto-generated underlay ink or raster passes | E3, E6 | primitive lint |
| R5 Iso/voxel decoration is a surface slab | E6 | `slab()`; overlap lint |
| R6 Metrics + conformance gate; visual review judges; user approves | E7, D10 | `approve` requires sheet + passing gate |
| R7 Review = v(n) beside v(n−1), checker + in-context + direction anchors | E8 | sheet builder |
| R8 Every stage inspectable (`--stages`) | E9 | stage dumps + tests |
| R9 Determinism: seeded RNG, integer pixel math, no platform AA in final pixels | — | golden tests |
| R10 Never edit a scored version; a change is a new version | artlab | `new`, source hash in ledger |
| R12 Revision passes start from the **best-scoring** version so far, not the latest; finishing applies to the best | E8 | pass state machine |
| R11 **Assets never hard-code direction values** (palette hexes, outline colour, light, pixel scale); they reference direction tokens | W1 | conformance lint on source + output |

## 3. Packaging and adoption (W1, part 1)

### 3.1 Committed install (D1)
Plugins don't load in Claude Code cloud sessions, but everything committed under `.claude/` and `.mcp.json`
does (see DECISIONS D1). So the toolset is **installed by committing a built distribution into the game repo**.

This repo's CI builds an `artgen-dist` branch containing only the distribution and `install.mjs`:
```
dist/
  claude/skills/artgen/              # pipeline (S1→S2→R1–R3→F→U), rules, pitfalls (progressive disclosure)
  claude/skills/art-direction/       # W1 interview → candidates → lock
  claude/skills/asset-production/    # W2 brief → autonomous pipeline → final review → export
  claude/agents/art-reviewer.md      # subagent: scores a sheet against the direction
  claude/commands/                   # thin wrappers, if command names prove useful (settled in P2)
  tools/artgen/artgen.js             # CLI, single-file bundle (Node 20+, no npm install)
  tools/artgen/artgen-mcp.js         # MCP server, single-file bundle
  tools/artgen/templates/            # base + finish templates per kind × view
  install.mjs
plugin/                              # the same content in plugin layout, for local `/plugin install` users
```
Install or update in a game repo (local shell, or any session with network access), then commit:
```
npx -y github:rstevenson1237/image_tools#artgen-dist init     # first time: copy files + scaffold art/
npx -y github:rstevenson1237/image_tools#artgen-dist update   # later: shows version change, protects local edits
```
- Copies `dist/claude/*` into `.claude/`, `dist/tools/artgen` into `tools/artgen/`, merges an `artgen` entry
  into `.mcp.json` (`node tools/artgen/artgen-mcp.js`), appends the art section to `CLAUDE.md`.
- `tools/artgen/VERSION` pins the version; `MANIFEST.json` stores file hashes so `update` refuses to overwrite
  local edits without `--force`.
- After install, sessions (local or cloud) need no network or npm: everything comes from the clone.
- The repo is public, so `npx github:…` needs no credentials.

### 3.2 `artgen init` scaffolds the game repo
```
art/
  direction.json          # empty template until W1 locks it
  briefs.yaml             # asset list (W2)
  assets/                 # asset sources by kind
  anchors/                # approved style anchors (W1)
  sheets/                 # review sheets (gitignored except approved)
  ledger.jsonl
  artgen.config.json      # export paths, runtime adapter, pack names
CLAUDE.md                 # appended section: "art lives in art/, use /artgen:* , never hard-code palette"
```

## 4. Art direction (W1, part 2)

### 4.1 `direction.json` (the style bible as data)
```jsonc
{
  "id": "swamp-roguelike", "version": 1, "status": "locked",          // draft | candidate | locked
  "theme":   { "pitch": "grim swamp roguelike", "mood": ["damp","eerie","muted"], "era": "fantasy",
               "notes": "rot greens, bone whites, lantern amber as the only warm accent" },
  "camera":  { "view": "topdown",                   // topdown | oblique | iso | stack | side | fp
               "oblique": { "frontRatio": 0.5 }, "iso": { "tile": [32,16] },
               "light": [-1,-1,1], "directions": 8, "pixelScale": 3 },
  "scale":   { "tile": 16, "character": [24,24], "large": [48,48], "prop": [16,16],
               "texture": 32, "effect": [32,32], "proportions": { "headRatio": 0.4 } },
  "palette": { "source": "lospec:resurrect-64|custom", "maxColors": 24,
               "ramps": { "moss": ["#..","#..","#.."], "bone": [...], "amber": [...], "skin": [...] },
               "outline": "#1a1423", "shadow": { "color": "#000000", "alpha": 0.35 },
               "materials": { "metal": "bone", "foliage": "moss", "accent": "amber" },
               "perKindMax": { "character": 12, "prop": 8, "effect": 6 } },
  "line":    { "outer": "dark",                     // dark | selout | none
               "inner": "selective", "weight": 1 },
  "shading": { "bands": 3, "hueShift": 12, "dither": "none",  // none | bayer2 | bayer4 | noise
               "highlight": "sparing", "aa": false },
  "detail":  { "density": "medium", "minFeaturePx": 2 },
  "pipeline":  { "revisionPasses": 3, "finishPass": true, "raster": { "directMaxPx": 32, "ss": 8 },
                 "procedural": ["materialNoise", "rimLight", "groundShadow"],   // default second-pass layers
                 "finish": { "allow": ["patch","fix","fx","light","outline"] } },
  "effects": { "fps": 12, "maxFrames": 8, "palette": ["amber","bone"] },
  "anchors": ["anchors/hero.png", "anchors/crate.png", "anchors/mud-tile.png", "anchors/spark.png"],
  "rules":   { "do": ["silhouettes readable at 1x on mud"], "dont": ["pure white", "saturated blue"] }
}
```
Every render receives the direction via `ctx.dir` (palette refs, sizes, outline, light, bands). Techniques
consume it by default: `prim`/`voxel` shaders use `light` and `bands`; post passes use `outline`, `line`,
`dither`; quantize uses the restricted palette for the asset's kind.

### 4.2 Direction workflow (`/artgen:direction`, skill `art-direction`)
1. **Interview** — game pitch, genre, view, target resolution/scale, mood words, references (described, or
   images dropped into `art/refs/` for palette extraction), constraints (colour count, platform).
2. **Candidates** — generate **3** `direction.json` drafts that differ meaningfully (palette family, outline
   style, shading bands/dither, proportions). Palettes from Lospec import, ramp generator, or extracted from
   reference images (median-cut → ramp sort).
3. **Style tiles** — render the same **probe set** under each candidate: one character, one prop, one
   ground tile (3×3 tiled), one effect strip, on the game's background, at 1× and display scale. One sheet,
   three columns.
4. **Choose/mix** — the user picks one or mixes ("A's palette, B's outlines"); iterate (versions of the
   draft) until approved. W4's Art Direction tool can edit the palette and settings directly.
5. **Lock** — status `locked`, version bumped, probe assets saved as **anchors**, style sheet PNG
   (palette swatches with ramp names, scale ruler, light diagram, anchors, do/don't) written to
   `art/direction.png`.
6. **Restyle** — any later version change: `artgen restyle` re-renders every approved asset, writes a
   before/after diff sheet; changed assets return to `review`.

### 4.3 Conformance (gate, per asset)
| Check | Rule |
|---|---|
| palette | 0 off-palette pixels; colours ⊆ ramps allowed for the kind; count ≤ `perKindMax` |
| scale | frame size matches `scale` for the kind (or declared override) |
| line | outer outline present/absent per `line.outer`, uses direction outline colour (or selout ramp) |
| aa | no partial alpha except shadow colour |
| light | luminance gradient across the sprite agrees with `light` (sign test on lit vs shaded edges) |
| dither | none present if `dither: none` (checkerboard detector) |
| source lint | no hex literals in asset source (R11) except via `ctx.dir` |
| anchor similarity | colour-histogram and value-distribution distance to anchors of the same kind within tolerance (flag, not fail) |
Plus hygiene metrics from artlab (`measure()`): gate thresholds in `artgen.config.json`.

## 5. Production pipeline (W2)

### 5.1 Briefs
```yaml
# art/briefs.yaml
- id: goblin
  kind: character        # character | creature | prop | tile | tileset | texture | effect | viewmodel | ui-icon
  view: topdown          # defaults to direction.camera.view
  size: character        # direction scale key or [w,h]
  states: [idle, walk, attack, hurt]
  directions: 8
  anims: { walk: { frames: 4 }, attack: { frames: 3 } }
  variants: 3            # seeded variants (palette swaps / mask variants)
  notes: "hunched, oversized ears, rusty cleaver"
  priority: 1
```
### 5.2 Status lifecycle (tracked in ledger, shown in UI)
`brief → in-pipeline (v1..v3, finish) → final → approved → exported`, plus `revision` (user asked for changes,
back in the pipeline) and `stale` (direction or source changed after export). The agent moves assets through
the pipeline on its own; only `approved` and `revision` are set by the user (D10). Approval records direction
version + source hash + sheet id.

### 5.3 Loop (skill `asset-production`, `/artgen:make <id|all>`)
For each brief, the pipeline in §6.3: template → base + procedural (v1) → review → v2 → review → v3 → review →
pick best (R12) → finishing pass → review → mark `final`. All of this runs **autonomously** (D10): each review
is a sheet (v(n−1), anchors, in-context) scored by the `art-reviewer` subagent against the direction, plus the
conformance gate; no user input is requested mid-pipeline. An asset that fails the gate after the finishing
pass gets one extra autonomous revision within budget (D19), then is marked `final` with its open issues listed.
The user sees only finished assets: `/artgen:review` builds a gallery of `final` assets (final render, in-context
preview, scores, open issues); the user approves or requests revisions via `/artgen:approve`,
`/artgen:feedback` or the UI, which starts a user iteration (§6.3, stage U) that again runs autonomously.

### 5.4 Export (`/artgen:export`)
Packs approved assets into the paths in `artgen.config.json`: atlas PNG(s) + `pack.json`, textures (+ normal
maps), voxel exports, generated `assets.ts` (typed ids), and the runtime (§12) if not present or outdated.

## 6. Engine core

### 6.1 Grid, Palette, RNG, I/O
- Grid: RGBA buffer from artlab (`set/get/alpha/clone/stamp`) + `crop/pad/trim/flip/hash/toIndexed`.
- Palette: ramps + singles + shadow; `restrict`, `swap`, Lospec `.hex`/`.gpl` import, hue-shifted ramp
  generator, **extract from image** (median cut + ramp ordering) for W1.
- seeded mulberry32; pure-JS PNG codec; bitmap pixel font for sheet labels.

### 6.2 Asset module contract
```js
// art/assets/characters/goblin/base.v3.js — header: what changed vs v2
export const meta = { brief: 'goblin', pass: 'r3', notes: '...' };      // size/view/states come from brief
export const params = { earLen: 3, stoop: 0.2 };                           // overridable; t-driven for anims
export function render(ctx) {
  // ctx: { dir (direction tokens), brief, seed, params, state, facing, frame, t, lib }
  const { pal, line } = ctx.dir;
  ...
  const scene = ctx.lib.prim.scene();            // S1: T2+ primitives (2D or 3D mode)
  /* ... */
  return ctx.lib.proc(scene, ctx)                  // S2: procedural layers (direction defaults + asset-specific)
    .add('materialNoise', { mat: 'cloth', amount: 0.2 })
    .add('rimLight', { ramp: 'bone' })
    .render();                                     // Grid for one frame; engine loops state × facing × frame
}
export const anchors = (ctx) => ({ head: [12, 6] });  // named points per frame, used by finishing patches
```
Files per asset: `base.v<N>.js` (S1 + S2, one per revision pass or user iteration) and `finish.v<M>.js` (bound
to one base version).

### 6.3 Generation pipeline (replaces the per-form router)

| Stage | What happens | Written by | Stored as |
|---|---|---|---|
| **S1 Base** | T2+ primitive scene (2D, or 3D mode for voxel renders) built from brief + direction tokens | Claude | `base.vN.js` |
| **S2 Procedural pass** | effects and special-use algorithms layered on the scene (§6.4): material noise/patterns, procedural detail, lighting bands, dither, shadows, particles for effect assets | Claude, via library calls | same file (`proc` chain) |
| **R1–R3 Revision** | three reviewed versions of S1+S2: v1 (first build), v2, v3. Each: render → sheet → reviewer score + gate → revise from the best so far (R12) | Claude + `art-reviewer` | `base.v1..v3.js` |
| **F Finishing pass** | one direct-pixel pass on the best version: **fix** (jaggies, orphans, banding, broken lines, pillow shading), **fx** (glints, sparks, glow pixels), **light** (rim, highlights, light-side shade), **outline** (selout, inner lines, corner cleanup), **patch** (char-map faces, eyes, emblems) | Claude | `finish.v1.js` (ops) |
| **U User review** | user approves, or gives feedback. Feedback on form/proportion/colour starts a new base version (re-finished afterwards); pixel-level feedback starts a finish revision. Repeats until approved | user (+ Claude) | `base.vN+1` or `finish.vM+1` |

Pass count is `direction.pipeline.revisionPasses` (default 3). The ledger records the pass (`r1..r3`, `f`, `u1..`)
for every version so reports show where quality came from.

#### T2+ — primitives brought to T3 parity
What T3 had that T2 lacked, and how T2+ gets it:

| Gap (from the findings) | T2+ feature |
|---|---|
| Curves (hull bows, legs, domes) | `path` primitive taking SVG path data (Béziers, arcs); `capsule`, `ring`, `arc`, `star`; SVG files and SVG Tracer output import as `path` |
| Sub-pixel geometry and smooth edges | raster modes: `direct` (coverage-threshold sampling, not pixel-centre — fixes the chest gaps) for ≤ `directMaxPx`; `ss` (R3) above it |
| Clean internal outlines after downsampling | automatic **underlay ink** per group (dilated dark copy beneath), plus existing selective `ink`/`inkAll` |
| Complex silhouettes | groups with transforms (translate/rotate/scale/mirror), z-order, boolean `union/subtract/intersect`, clip masks, `repeat` (rivets, planks, ribs) |
| Asset-restricted palette quantize | quantize to the direction's ramps allowed for the asset kind |

T2's existing strengths stay: material ramps with `flat/bevel/sphere/cyl` shading, `rim`, mirror, seeded
params. Added: `normal` shading from shape SDF quantized to `direction.shading.bands`, hue-shifted ramps,
overlap ambient occlusion, cast shadows, and a declared **param schema** (ranges, part toggles, accessory slots,
palette swaps) so seeds give real variety (fixes the 4-combo limit).

**3D mode:** the same specs in 3D (`box`, `ellipsoid`, `capsule`, `slab`, `sdf`, groups, booleans) rendered by
the voxel renderers (§7) to iso, top-down, oblique, stack and billboard views with N facings. Replaces T4.

#### Finishing ops (`finish.vM.js`)
```js
export const base = 'base.v3';                     // bound to one base version
export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g); px.fix.jaggies(g, { region: 'blade' }); px.fix.banding(g);
  px.light.rim(g, { from: ctx.dir.camera.light, ramp: 'bone' });
  px.fx.glint(g, ctx.at('blade.tip'), 'amber.0');
  px.outline.selout(g); px.outline.inner(g, { between: ['cloth', 'skin'] });
  if (ctx.key('idle', 0)) px.patch(g, ctx.at('head'), FACE);  // char-map patch; follows the anchor in other frames
  return g;
}
```
- Global ops run on every frame and facing; patches target key frames and follow named anchors (D15).
- Colours are direction tokens, so finishing survives a restyle. After any re-render, each patch is checked
  against the pixels it was written over; large differences mark the asset `finish-stale` for review.

### 6.4 Procedural pass library (S2)
| Layer | Algorithms | Typical use |
|---|---|---|
| `materialNoise`, `pattern` | periodic value/simplex/Worley/fBm, banded to ramps | cloth, stone, metal wear, wood grain |
| `detail` | L-systems (foliage, cracks, roots), mask templates (Bollinger-style variation), scatter | trees, damage, decor |
| `tiles` | WFC, autotile edge synthesis (§9) | tilesets, floors |
| `lighting` | SDF/normal banding, rim light, AO at overlaps, cast + ground shadows, normal-map output | everything |
| `dither` | ordered Bayer 2/4, noise; only if the direction allows | gradients, skies |
| `particles` | deterministic emitters (§10) | effect assets, sparks on props |
| `cycle` | palette cycling ranges | water, lava, lights |
| `rotate` | RotSprite | rotations without a 3D model |
Layers are ordered, seeded and parameterised; the direction's `pipeline.procedural` list supplies defaults.

### 6.5 External image sources (extension point, not built — D18)
Reserved interface so outside image models (or other external art) can feed the pipeline later:
```ts
interface ImageSource {                      // registered like a view module or runtime adapter
  id: string;                                // e.g. 'diffusion:<provider>'
  generate(brief: Brief, dir: Direction, opts): Promise<RGBAImage[]>;   // candidates
}
```
Planned path for a sourced image: candidate → resize to the brief's size (mode downsample) → quantize to the
direction palette → finishing pass (F) → conformance → normal review. Sourced assets are marked
`source: external` in the ledger and manifest, and **cannot be restyled** (no primitive scene to re-render);
a restyle re-quantizes and re-finishes them instead. Nothing in v1 implements this interface.

### 6.6 Hand-edit round trip
A PNG edited in Aseprite is imported as a **finishing revision** (`artgen import-edit goblin edited.png`): diff
against the current render → patch ops in `finish.vM+1.js`. Hand fixes survive restyles where they map to
palette ramps.

## 7. Voxel subsystem
T2+ 3D mode renders through this subsystem; authors write primitive specs, not voxels directly.
- Model: artlab `Voxels` (box/ellipsoid/line/paint, fine `k`) + `slab`, `mirror`, `sdf`, `carve`, `merge`,
  named parts with transforms (states, animation).
- Renderers: `cubes` (artlab 4×4 iso cube stamp — crisp boxy props); `raster` (z-buffer at ss, any yaw/pitch
  and projection, depth/normal/ID buffers, internal-res outlines); `toon` (smooth normals → `direction.shading.bands`
  bands) to address the E4 organic plateau.
- Outputs: 4/8/16-direction sheets, sprite-stack slices, billboards; `.vox` read/write; greedy-mesh glTF.

## 8. Views and coverage

Views are **pluggable modules** (D8). A view module bundles: projection + anchor/sort conventions, 3D-mode
render settings, probe-set templates, review context preview, view-specific conformance checks, and the runtime
helper (coordinate/depth functions). Adding a view later means adding one module; nothing else changes.

| View | Projection | Anchor / sort | Review context |
|---|---|---|---|
| `topdown` | ortho down | centre | project ground texture |
| `oblique` (2.5D) | top + front face, `frontRatio` | base-front centre, Y-sort | oblique room |
| `iso` | 2:1, `P=((x−y)·2,(x+y)−2z)`, tile from direction | tile-diamond centre, x+y then z | iso floor of project tiles |
| `stack` (2.5D) | voxel z-slices | centre | 8-angle rotation strip |
| `side` (2.5D) | ortho side + parallax layers | feet | scroll strip |
| `fp` | raycaster preview; assets are textures/billboards/view-models | feet (billboards) | raycaster corridor shot |

| | Top-down | Iso | 2.5D | First-person |
|---|---|---|---|---|
| Characters/creatures | T2+ 2D (`direct` ≤32, `ss` above) + finish | T2+ 2D, or 3D mode for facings | T2+ oblique; 3D mode → stack | 3D mode → 8-dir billboards |
| Props/vehicles | T2+ 2D `ss` | **T2+ 3D mode** (states, rotations) | 3D mode → oblique/stack | billboards; view-models in T2+ 2D |
| Textures/tiles | S2 materials, autotile 16/47, WFC | iso floor/wall/transitions | oblique wall-fronts, parallax layers | 64/128 walls/floors + normals, skies, decals |
| Effects | S2 particles, palette cycling | particles + ground projection | as top-down/side | muzzle flash, impacts, projectiles |
| Voxel export | — | `.vox`, glTF | slice sheets | `.vox`, glTF |

## 9. Textures and tiles (procedural pass)
Periodic noise (value/simplex/Worley/fBm) so tiles are seamless by construction; material recipes (stone, cobble,
wood, metal, grass, dirt, sand, snow, water, lava, tech floor, carpet) banded to direction ramps with direction
dither; `seam` metric + 3×3 tiled review; autotiles (16 Wang, 47 blob) and iso sets; WFC; L-systems; normal
maps from height.

## 10. Effects and animation (procedural pass)
`t`-driven params; deterministic particles (life, velocity, drag, gravity, size curve, colour-by-life from
direction effect ramps); presets (explosion, smoke, fire, sparks, magic, heal, muzzle flash, impact, splash,
dust, trail); palette cycling; frame QA (bbox jitter, colour drift, loop seam); strip + onion-skin sheets,
GIF/APNG previews.

## 11. Quality and records
- Post passes: artlab `outline/quantize/modeDownsample/dropShadow/despeckle/groundShadow` + `selout`,
  `innerOutline`, `dither`, `rotsprite`, `paletteSwap`, `overlay`, `trim`, `normalFromHeight`.
- Gate = hygiene (artlab `measure()` + `seam`, `frameJitter`, `anchorOnTile`) + conformance (§4.3).
- Review sheets ≤ 1568 px long edge; `art-reviewer` subagent scores 0–10 against direction + anchors.
- `ledger.jsonl` append-only: source hash, tokens, metrics, conformance, sheet ids, scores, approvals, direction
  version; `report` reproduces artlab's cost/score tables per project.
- Golden-image and stage tests in this repo's CI over the benchmark set.

### 11.1 Pipeline analytics (D19)
Every pass writes a ledger record: asset, kind, view, size, pass (`r1..r3`, `f`, `u1..`), **model and effort
level**, input/output tokens (measured where Claude Code exposes them, e.g. via its OpenTelemetry export,
otherwise estimated as in artlab), review-image tokens, wall time, reviewer score, gate results, and score
delta vs the previous pass.
- `artgen analytics` reports: score gained per pass and per stage (how much came from revisions vs finishing),
  cost per asset by kind/size/view, passes that regressed, first-pass quality by template, user revision rate.
- **Budget tuning:** suggests `revisionPasses` per kind (e.g. stop at v2 if v3 rarely adds), and per-project
  caps, from accumulated data.
- **Model/effort selection:** `artgen.config.json` maps pipeline stages to model + effort
  (`{ base, revise, finish, review }`); stages run as subagents with that model. Analytics compares score per
  dollar across mappings so the defaults can be tuned (e.g. a smaller model for the reviewer or for v2/v3).
- Shown in the UI as an Analytics panel in Asset Review (W4).

## 12. Runtime component (W3) — `@artgen/runtime`

### 12.1 Export format (`pack.json`)
```jsonc
{ "pack": "swamp", "direction": { "id": "swamp-roguelike", "version": 1 }, "runtime": "1.0.0",
  "atlases": ["swamp-0.png"],
  "assets": {
    "goblin": { "kind": "character", "view": "topdown", "size": [24,24], "anchor": [12,21],
      "directions": 8, "states": { "idle": { "frames": 1 }, "walk": { "frames": 4, "fps": 8, "loop": true } },
      "frames": [[0,0,0,0,24,24, 0,"idle",0]],      // atlas, x, y, w, h, facing, state, frame (compact)
      "variants": ["base","red","grey"], "swaps": { "red": { "moss.1": "#8a3a34" } } },
    "mud": { "kind": "tileset", "tile": 16, "autotile": "blob47", "map": [ ... ] },
    "spark": { "kind": "effect", "frames": 6, "fps": 12, "loop": false, "blend": "normal" } } }
```
Also emits Aseprite-compatible JSON per sheet for tools that expect it.

### 12.2 Runtime API (dependency-free TS, ~few KB)
```ts
const pack = await loadPack('/assets/swamp/pack.json');          // fetch + decode atlases
const goblin = pack.sprite(Assets.goblin, { variant: 'red' });   // typed ids from generated assets.ts
goblin.play('walk'); goblin.face(angleRad);                      // picks nearest of N facings (mirror-aware)
goblin.update(dtMs); goblin.draw(ctx2d, x, y);                   // or adapter-specific
pack.tiles(Assets.mud).resolve(neighbourMask) → tileIndex        // 16/47 autotile resolver
pack.effect(Assets.spark).spawn(x, y)
isoToScreen / screenToIso / depthKey(x, y, z)                     // iso + oblique helpers
```
Core is renderer-agnostic (frame rects + state machine + coordinate helpers). Adapters implement one small
interface and are separate entry points, so new targets can be added without touching the core (D3):
```ts
interface RuntimeAdapter<Tex, Node> {
  id: string;                                            // 'pixi' | 'three' | 'canvas2d' | …
  loadTexture(atlas: AtlasImage): Promise<Tex>;          // nearest filtering, no mipmaps
  createNode(tex: Tex): Node;                            // sprite / billboard / mesh
  setFrame(node: Node, rect: FrameRect, flipX: boolean): void;
  setAnchor(node: Node, anchor: [number, number]): void;
  dispose(node: Node): void;
}
```
- **`pixi`** (first): `Texture`/`Spritesheet` from `pack.json`, `AnimatedSprite`-compatible frames, palette
  swap via a colour-map filter, iso/oblique depth sorting with `zIndex`.
- **`three`** (first): pixel textures with `NearestFilter`; 8-direction **billboards** (`Sprite`/quad, facing
  chosen from camera-relative angle), sprite-stack planes, FP wall/floor textures, and `.glb` voxel models
  loaded with `GLTFLoader`; frame changes via UV offset/repeat.
- **`canvas2d`** (reference): used by the image tools UI previews, docs and adapter contract tests.
- Later: `phaser`, Godot importer (`SpriteFrames` `.tres` + `TileSet`), pygame. One shared contract test
  suite runs against every adapter.

### 12.3 Delivery
`artgen export --runtime` vendors `src/art/runtime/` (version-stamped) and `src/art/assets.ts` into the game
repo; re-export updates both. npm publication is a later option (D4).

## 13. UI (W4) — inside image_tools

### 13.1 New tools (registered in `src/core/tools/registry.ts`)
| Tool | Purpose |
|---|---|
| **Art Direction** | open a project's `art/`; palette editor (ramps, hue-shift, Lospec import, extract from reference image), camera/scale/line/shading settings, live style tile of anchors under the edited direction, compare candidates, save draft / lock |
| **Asset Review** | gallery by status; per asset: versions side-by-side, in-context preview (iso floor, tiled, raycaster), metrics + conformance, score note, approve / request changes (writes ledger) |
| **Asset Lab** | load an asset module, sliders for `params`/seed/variant/facing/frame, animation playback via the runtime's canvas2d adapter, export single asset |
Asset Review shows the pass timeline (v1 → v2 → v3 → finish → user iterations) with scores, and collects
user feedback as notes pinned to regions of the sprite (sent to Claude as the U-stage input). Existing tools
gain small integrations: SVG Tracer output imports as a T2+ `path`; Token Cutter silhouettes can seed a
`clip` mask.

### 13.2 Shared framework updates
- `WorkerKind` gains `'artgen'` (core bundle in a worker via the existing ref-counted pool).
- `core/project/` — project store over the **File System Access API** (directory handle persisted in IndexedDB,
  read/write `direction.json`, `briefs.yaml`, `ledger.jsonl`, asset sources); zip import/export fallback for
  non-Chromium browsers. Image data never leaves the machine (unchanged principle).
- Shared components: `PaletteRamp` editor, `PixelPreview` (nearest-neighbour zoom, checker/context bg),
  `CompareView` (v(n) vs v(n−1)), `StatusBadge`.
- `CanvasStage` gains an integer-zoom pixel mode.
- Registry gains optional tool **groups** (sidebar sections: "Image tools", "Art pipeline").

### 13.3 Claude Code ↔ UI contract
Files are the API: UI writes the same files the CLI writes, through the same `@artgen/core` validators
(schema-checked `direction.json`, append-only ledger entries with `by: "user"`). Claude Code commands re-read
files on every run; nothing is cached across the boundary.

## 14. Interfaces

**CLI** (`artgen`, all with `--json`): `init`, `direction new|candidates|tile|lock|show`, `palette import|extract|ramp`,
`brief add|list`, `new`, `render [--stages]`, `review`, `score`, `pass next|status` (pipeline state), `finish`,
`feedback`, `approve`, `status`, `variants`,
`texture`, `fx`, `voxel`, `restyle`, `export [--runtime]`, `import-edit`, `report`, `bench`.

**Skills / commands / agent**: §3.1. `artgen analytics` (§11.1). **MCP tools**: `direction_get`, `direction_tile`, `pass_status`, `render`, `finish`,
`review`, `conformance`, `score`, `approve`, `texture`, `fx`, `export` — image results returned as MCP image
content. **Python**: `artgen-py` client (`Artgen(project).render(...)`, `.texture(...)`, `.export(...)`)
returning Pillow images + dicts.

## 15. Non-functional
- `@artgen/core` and `@artgen/runtime` have no Node/DOM imports; runtime adapters isolate I/O.
- Deps: `@resvg/resvg-wasm`, pure-JS PNG, `gifenc`, `yaml`. Nothing native.
- 64×64 sprite incl. ss=8 < 200 ms; 128 texture < 100 ms; 10-asset batch render < 10 s (excluding agent time).
- Tests: vitest in the existing CI job; install smoke test runs `install.mjs` into a fixture game repo and
  checks a session-equivalent run of the CLI and MCP server from the committed files.

## 16. Out of scope (v1)
Diffusion/ML generation (extension point only, §6.5); pixel editor; non-voxel 3D; audio; UI kits; hosted backend; Unity importer.
