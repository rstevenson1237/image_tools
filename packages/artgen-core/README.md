# artgen-core

The artgen engine (PLAN P1, P1b, P2). TypeScript, ESM, no Node or DOM imports: the CLI (`artgen-cli`) and, from P5, the
image tools UI worker run the same build. Spec: [`docs/artgen/SPEC.md`](../../docs/artgen/SPEC.md) §4, §6, §11.

## Layout

| Module | What it holds |
|---|---|
| `src/lib/grid.ts` | `Grid` RGBA buffer (artlab semantics) + `crop/pad/trim/flip/scale/hash/toIndexed/over/diffCount` |
| `src/lib/color.ts`, `rng.ts`, `png.ts`, `font.ts` | colour parsing/HSL, seeded mulberry32, pure-JS PNG codec (fflate), 3×5 pixel font for sheet labels |
| `src/lib/palette.ts` | Lospec `.hex` / GIMP `.gpl` import, hue-shifted `generateRamp`, `extractPalette` (median cut → ramps), `restrict`, `swapColors` |
| `src/lib/post.ts` | artlab post passes (`outline`, `quantize`, `modeDownsample`, `dropShadow`, `despeckle`) + `selout`, ordered dither |
| `src/lib/prim.ts` | artlab T2 primitives (`Scene`), the T2+ starting point |
| `src/lib/blit.ts` | artlab T1 char-map writes (`blit`, `blitMirrored`, `shadeSide`), the future finishing `patch` |
| `src/lib/svg.ts` | artlab T3 raster path on resvg-wasm (`raw | crisp | ss`), the future T2+ `ss` mode (R3) |
| `src/lib/iso.ts`, `voxel.ts` | 2:1 iso helpers, artlab T4 `Voxels` + `cubes` renderer (future T2+ 3D mode) |
| `src/direction.ts` | `direction.json` types, `validateDirection` (defaults + path-tagged errors), `dirContext`, `resolveToken`, `kindPalette`, `resolveSize` |
| `src/render.ts` | asset module contract, `renderAsset` over states × facings × frames (west facings mirror east ones), `assembleSheet` |
| `src/qa/` | `measure` (artlab hygiene), `conformance` gate (SPEC §4.3), `reviewSheet` / `contactSheet`, ledger lines |
| `src/t2/geom.ts` | affine transforms, SVG path data → polygons, primitive outlines, `Mask` (coverage bitmap + windowed EDT) |
| `src/t2/scene.ts` | T2+ 2D scenes (S1): primitives, booleans, groups, clip, repeat, mirror copies, underlays, shading, `direct` / `ss` raster |
| `src/t2/raster.ts` | `Raster`: owner item + ramp step per pixel, so S2 and finishing move pixels along their own ramp |
| `src/t2/proc.ts` | procedural pass v1 (S2): `materialNoise`, `pattern`, `rimLight`, `ao`, `castShadow`, `dither`, `groundShadow`, `dropShadow` |
| `src/t2/scene3d.ts` | T2+ 3D mode: box / slab / ellipsoid / capsule / sdf, groups, booleans → voxels → `cubes` renderer, 4 facings, R5 lint |
| `src/t2/finish.ts` | finishing ops (`px.fix/fx/light/outline/patch`), `applyFinish`, anchor-following patches, `finishStale` |
| `src/t2/params.ts` | param schema (`range`, `toggle`, `choice`, `swap`) and seeded variants |
| `src/pipeline.ts` | pass state machine: v1 → v2 → v3 (from the best, R12) → finish → ready (re-finish when a later base wins); ledger pass ids |
| `src/w1/candidates.ts` | W1: interview → three candidate directions (A faithful, B bold, C muted) over the shared role ramps, `mixDirections`, `lockDirection` |
| `src/w1/sheets.ts` | W1: `styleTile` (the probe set under each candidate, one column each) and `styleSheet` (`art/direction.png`) |
| `src/views/` | view cameras and modules (P6a), `fp.ts`: the first-person raycaster preview, `fpShots`, `sky` (P6d) |
| `src/voxel/` | voxel `raster` renderer (any yaw and camera, depth / part / normal buffers, `toon`), `.vox`, greedy-mesh `.glb` (P6a) |
| `src/tex/` | periodic noise, material recipes (13 incl. `brick`), autotiles, iso tiles, WFC, L-systems (P6b) |
| `src/anim/anim.ts` | keyframe tracks, pose rig with 2-bone IK, spring chains, sweeps, sub-frame timing (P6c) |
| `src/fx/particles.ts` | particle emitters (+ `blob` metaball layers), 11 presets, `flame`, palette cycling (P6c) |
| `src/qa/anim.ts` | frame QA, attack QA, solid-fill metric, onion skin (P6c) |
| `bench/` | the artlab parity benchmark: six asset modules, `benchmark` + `alt` directions, artlab reference PNGs, golden hashes |
| `bench/p6/` | the P6 breadth benchmarks (views, voxel, textures, effects, animation, first-person) through the full pipeline |
| `bench/pipeline/` | the P1b parity experiment: the six assets rebuilt through the T2+ pipeline (briefs, `base.v1–3`, `finish.v1`, ledger) |

## Asset modules

Assets are plain ESM JavaScript (D17). Everything direction-specific comes from `ctx`; no colour literals (R11,
enforced by the conformance `source` check).

```js
export const meta = { brief: 'crate', notes: 'what changed vs the previous version' };
export function render(ctx) {
  const { pal } = ctx.dir;                          // ramps by name, plus ctx.dir.outline / ctx.dir.shadow
  const s = ctx.lib.prim.scene(16, 16);             // light, bands, line style, colours bound to the direction
  s.add({ type: 'rect', x: 3, y: 4, w: 10, h: 9, mat: pal.wood, shade: 'bevel' });
  return s.render();                                // one frame; the engine loops state × facing × frame
}
export const anchors = ctx => ({ lid: [8, 4] });    // optional named points per frame
```

`ctx` also carries `brief`, `size`, `seed`, `variant`, `params`, `state`, `facing`, `frame`, `t`, `ms`, `duration`, `logical`, `sub`, `rng`,
`palette(names?)` (restricted palette incl. outline) and `stage(name, grid)` for `--stages` dumps. `ctx.lib` hands out
`t2` (scenes), `proc`, `tex`, `anim`, `fx`, `prim`, `svg`, `voxel`, `iso`, `blit`, `post`, `palette` and `line` (the direction's outer-line
pass), each pre-bound to the direction. `prim`, `svg`, `voxel` and `blit` are the artlab internals the benchmark
ports use; new assets use `t2`.

## T2+ (the one generation pipeline, SPEC §6.3)

```js
// base.v2.js — S1 base + S2 procedural pass
export const params = { cloth: { type: 'swap', options: ['blue', 'red'] }, helmet: { type: 'toggle' } };
export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(32, 32);        // mode: auto = direct ≤ directMaxPx, else ss
  s.add({ type: 'path', name: 'tunic', d: 'M11 16 H21 L22 24 H10 Z', mat: pal[ctx.params.cloth], shade: 'normal', round: 3, underlay: true });
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'rect', x: 24, y: 4, w: 2, h: 14, mat: 'steel', shade: 'bevel' },
    { type: 'rect', x: 22, y: 18, w: 6, h: 1.5, color: 'gold.1' },
  ] });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 11, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  return ctx.lib.proc(s).add('materialNoise', { part: 'tunic', amount: 0.2 }).render();
}
export const anchors = ctx => ({ head: [16, 10] });
```

- Shapes: `rect` (`r` corner radius), `ellipse`, `circle`, `poly`, `path` (SVG path data), `line`, `capsule`
  (tapered with `r1`), `tube` (a band along `d`/`pts`, tapering `w` → `w1`), `ring`, `arc`, `star`, and
  `union` / `subtract` / `intersect` over `shapes`. Coordinates are pixels with SVG semantics.
- Nodes take `translate`, `rotate`, `scale`, `origin`, `flip`, `z`, `mirrorX`/`mirrorY` (adds a mirrored copy
  shaded for its own side); groups add `children`, `clip`, `repeat: { n, dx, dy, rotate }`; `mat` and `shade` inherit.
- Style: `mat` (ramp, ramp name or direction material), `color` (token or ramp colour), `shade`
  (`flat` + `band`, `bevel`, `sphere`, `cyl` + `axis`, `normal` + `round`, `linear`; `gain`), `ink` / `ink: 'all'`,
  `underlay` (dark copy beneath that inks only over content below it), `cast` (px), `ao`, `pattern(x, y, band)`, `name`.
- `scene.raster()` gives the `Raster` before outline/shadows; `scene.render()` = raster → direction line → shadows.
  Scene options: `mode`, `ss`, `outline`, `shadow: [dx, dy]`, `groundShadow: [cx, cy, rx]`.
- `scene.lint()`: strokes (R4), colours outside the asset palette (R11), shapes that cover nothing; renders collect it
  as `RenderResult.lint` and conformance checks it.
- 3D mode: `ctx.lib.t2.scene3d({ k })` with `box`, `slab` (recolours surfaces; `add: true` fills), `ellipsoid`,
  `capsule`, `sdf`, `group` (`translate`, `rotate` in 90° steps, `mirror`), booleans; `render(w, h, { ox, oy, facing })`.
  Set `meta.mirror = false` so every facing is rendered from the model.
- Procedural pass: `ctx.lib.proc(sceneOrGrid).add(layer, { part, mat, … }).render()`; the direction's
  `pipeline.procedural` names default layers.
- Finishing (`finish.vM.js`): `export const base = 'base.v3'; export function finish(g, ctx) { … }` with `ctx.lib.px`,
  `ctx.at(anchor)`, `ctx.key(state, frame)`, `ctx.protect(...)`. See `src/t2/finish.ts` for the op list.

SVG rendering needs the wasm module once per process: `await initSvg(wasmBytes)` (the Node adapter in
`artgen-cli` does this with `initNodeSvg()`).

## Benchmark

```
npx artgen bench                       # benchmark direction → artgen-out/artlab-benchmark/
npx artgen bench --direction alt       # same six assets restyled by the generated "ember-dusk" direction
npx artgen bench --stages --ledger artgen-out/ledger.jsonl
npx artgen bench --update-golden       # after an intended render change; commit bench/golden.json
npx artgen direction validate <file>
```

Output per direction: 1× and scaled PNGs, per-asset review sheets (artlab final beside the port), a comparison
sheet, `parity.png` (benchmark only), `conformance.json`. The CLI runs TypeScript directly, so it needs Node ≥ 22.18.

## Game projects and W1 (PLAN P2)

In a game repo the CLI runs from the committed install (`node tools/artgen/artgen.js …`, see
[`packages/artgen-dist`](../artgen-dist)); in this repo it is `npx artgen …`. Skills `art-direction` and `artgen`
(`packages/artgen-dist/content/`) describe the workflow for the agent.

```
artgen init                                              # art/ scaffold (never overwrites)
artgen direction candidates --pitch "…" [--view iso] [--mood a,b] [--scale small|medium|large] [--colors src]
artgen direction tile [a b c]                            # art/candidates/style-tile-rN.png + gate per probe
artgen finish art/probes/character                       # finish.vM.js from the template, bound to the right base
artgen direction mix a --line b [--shading c]            # art/candidates/mixN.json
artgen direction lock mix1 --note "…"                    # art/direction.json, art/anchors/*.png, art/direction.png
artgen direction anchors | show | new [--from c] | validate <file>
artgen palette import <.hex|.gpl> | extract <png> [--n 16] | ramp <#hex>   (--interview feeds candidate A)
artgen new <id> --kind character|prop|tile|effect|…      # art/assets/<kind>/<id>/ from a template
```

Templates live in `packages/artgen-cli/templates/<view>/<kind>/` (topdown and iso; other views fall back to topdown)
and use only role ramps and `ctx.size`-relative coordinates. The fixture game repos in `examples/` show the result.

## Pipeline (asset directories)

An asset directory holds `brief.json`, `base.v<N>.js`, `finish.v<M>.js`; scores and reviews go to the nearest
`ledger.jsonl` up the tree. From the repo root:

```
npx artgen pass next   <assetDir>                 # what to do next (write-base / review / write-finish / ready)
npx artgen review      <assetDir> [--version v]   # sheet: reference, best so far, v(n−1), v(n); logs image tokens
npx artgen score       <assetDir> base.v2 6.5 --note "…"
npx artgen pass status <assetDir>                 # r1..r3, f with scores and gates; flags a stale finish
npx artgen variants    <assetDir> [--n 8]
npx artgen report packages/artgen-core/bench/pipeline --out REPORT.md
```

Tests: `npm test -w artgen-core` (unit + stage tests, no wasm), `npm test -w artgen-cli` (SVG stage tests,
golden hashes, conformance under both directions, artlab parity, the P1b experiment's recorded hashes, restyle,
variants, a full pass cycle, and the W1 flow in a scratch project), `npm test -w artgen-mcp` (protocol, tools,
sandbox) and `npm test -w artgen-dist` (install smoke test from a fresh build, update edit-protection, fixture repos).
