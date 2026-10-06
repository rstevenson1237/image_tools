# P1 findings — engine core and direction model

Date: 2026-10-06 · Phase: [PLAN P1](../PLAN.md#p1--engine-core--direction-model-ml) · Code: `packages/artgen-core`,
`packages/artgen-cli`

## Outcome against the acceptance criteria

| Criterion | Result |
|---|---|
| Six benchmark assets render under the benchmark direction | Yes — `npx artgen bench`, all six through `renderAsset` from token-only sources |
| Golden hashes recorded | `packages/artgen-core/bench/golden.json` (both directions), checked in `artgen-cli` tests |
| Re-review scores ≥ artlab finals | Held — see the parity table; side by side in [`p1/parity.png`](p1/parity.png) |
| A second direction re-renders all six with a different palette/outline, passing conformance | Yes — `alt` ("ember-dusk"), [`p1/comparison-alt.png`](p1/comparison-alt.png); every gate check passes, no benchmark colour survives |

## Parity with artlab

The benchmark direction reproduces artlab's master palette. Each port is compared pixel by pixel with the
artlab final it came from (`bench/reference/*.png`, copied from an artlab run — the same images as the two
committed comparison sheets).

| Asset | artlab final | artlab score | Pixels differing | Why | Re-review |
|---|---|---|---|---|---|
| hero | t1 v2 | 7.5 | 0 | — | 7.5 (identical) |
| isohero | t1 v1 | 7 | 0 | — | 7 (identical) |
| isochest | t4 v1 | 7 | 22 / 2048 | artlab's `Grid.stamp` flattened the voxel ground shadow to opaque black; the port composites it (35 % alpha) | 7 (shadow now reads as a shadow on the floor) |
| tank | t3 v3 | 7.5 | 7 / 4096 | Skia vs resvg coverage on the outer outline | 7.5 |
| isospider | t3 v1 | 7 | 15 / 1024 | leg tips and shadow edge | 7 |
| ship | t3 v3 | 7.5 | 109 / 6560 | plank `<pattern>` lands one row off under the hull transform (Skia vs resvg tiling) — same stripes, shifted phase | 7.5 |

Scores are this session's visual re-review of the review sheets (artlab row above the port row, same scale and
context). Hygiene is 10 for all six except hero (9.6 for its char-map orphans). It's higher than artlab's
9.4 / 9.7 for hero / chest because artlab hard-coded `#ffffff` highlights outside its palette; the benchmark direction
declares them as a `white` ramp (R11), so they're no longer off-palette.

### One port change needed to match the scored image
artlab's SVG path (Skia via `@napi-rs/canvas`) **ignored `paint-order="stroke"`**: the spider's body outline was
drawn over the fill, so its dark ring sat inside the body edge and separated body from legs. resvg honours
`paint-order`, which moves the ring outward and lets the purple body run into the legs (75 px / 7.3 % different,
visibly softer). The port drops the attribute so resvg renders what was scored (15 px different). Lesson for T2+
`ss` mode (P1b): the reference renders encode Skia's SVG quirks; when an SVG-authored reference disagrees with
resvg, check attribute support before assuming geometry differences.

## What the alt direction shows
`alt.json` is generated from the benchmark ramps with `generateRamp` (each ramp's middle re-tinted +18° hue,
×0.8 saturation, regenerated with a 14° hue shift) plus a new outline (`#2a160e`) and shadow (`#140a1e` at 40 %).
No asset source changed. All six pass palette, scale, aa, line, light, dither and source checks.

It is a restyle proof, not a good style: hue shifting toward yellow turns some light ends beige (the spider's red
eyes and the hero's shield lose contrast). That is a palette-design problem for W1's candidate generation, not an
engine one; it argues for checking accent ramps' contrast when candidates are generated (P2).

## Notes for P1b
- **Light check on symmetric assets:** the ship's lit-minus-shaded edge luma is −0.9 under both directions — its
  shading is symmetric, not lit from the direction's upper-left. It passes on the tolerance (4). The finishing
  pass's `light` ops should give it a real gradient; the check can tighten once T2+ shading is direction-driven.
- **Line style coverage:** prim, svg and voxel outputs follow `line.outer` (`dark | selout | none`). T1 char maps
  bake the outline into the map, so they ignore it until they become finishing `patch` ops.
- **Bands:** `prim` caps material ramps to `shading.bands`; the voxel `cubes` renderer still uses fixed faces
  (top / left / right); `toon` in P6a takes the bands.
- **Performance:** the whole benchmark (six assets, ss = 8 for three of them) renders and checks in about a second on Node 22.
