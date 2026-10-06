# artgen-core

The artgen engine (PLAN P1). TypeScript, ESM, no Node or DOM imports: the CLI (`artgen-cli`) and, from P5, the
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
| `bench/` | the artlab parity benchmark: six asset modules, `benchmark` + `alt` directions, artlab reference PNGs, golden hashes |

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

`ctx` also carries `brief`, `size`, `seed`, `params`, `state`, `facing`, `frame`, `t`, `rng`, `palette(names?)`
(restricted palette incl. outline) and `stage(name, grid)` for `--stages` dumps. `ctx.lib` hands out `prim`,
`svg`, `voxel`, `iso`, `blit`, `post`, `palette` and `line` (the direction's outer-line pass), each pre-bound to the
direction.

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

Tests: `npm test -w artgen-core` (unit + stage tests, no wasm) and `npm test -w artgen-cli` (SVG stage tests,
golden hashes, conformance under both directions, artlab parity).
