# Findings: isometric roguelike set (2:1 iso, 32x16 floor tiles)

Assets: hooded rogue hero 32x48, cave spider 32x32, treasure chest 64x32 (closed | open frames = interactive states).
Techniques: T1 direct pixels, T2 primitives, T3 SVG -> canvas, **T4 voxel model -> iso render (new, from the research list)**.
New libs: `lib/iso.js` (2:1 projection, box faces, ground shadow), `lib/voxel.js` (voxel model + painter-order renderer,
fine-voxel `k`, supersampled `ss` render). Review sheets draw iso floor tiles under each sprite.

## Final visual scores (0-10)
| Asset | T1 Direct | T2 Primitives | T3 SVG | T4 Voxel |
|---|---|---|---|---|
| Hero 32x48 | **7** (v1) | 6 (v1) | 6.5 (v3) | 5 (v3) |
| Spider 32x32 | 6.5 (v1) | 6.5 (v1) | **7** (v1) | 4.5 (v3) |
| Chest 64x32 | 6.5 (v1) | 6.5 (v3) | 6 (v4) | **7** (v1) |

Trajectories: T3 hero 4.5 -> 5.5 -> 6.5; T3 chest 2.5 -> 3 -> 4.5 -> 6; T2 chest 4 -> 5 -> 6.5; T4 hero 3 -> 4.5 -> 5; T4 spider 2.5 -> 4 -> 4.5.

## Conclusions
- **Match technique to form, not to project.** Hand-authored pixels (T1) win the character; vector curves (T3) win the
  leggy organic creature; voxels (T4) win the boxy prop on the first try. No single technique wins the set.
- **Voxels are the best fit for iso props and states.** The chest's open/closed states fall out of one parametric model
  function; T4 also gives free re-rotation (render other facings) which none of the 2D techniques can.
- **Voxels plateau around 5 for organic sprites at this size.** Even with finer voxels + 2x render + majority downsample
  (the 3D->pixel pipeline), ellipsoid surfaces stair-step into speckle. Needs larger sprites, smooth normals/toon shading
  instead of 3-face shading, or a pixel-level cleanup pass.
- **Iso-specific pitfall: interpenetrating volumes.** Straps modelled as boxes through the chest body made the painter's
  algorithm draw their faces across the front (T2 and T3). Fix: model decoration as surface slabs. T1/T4 were immune.
- **Vector stroke outlines don't compose in iso.** paint-order strokes from later faces paint over earlier faces; the
  clean result came from removing strokes and relying on face-colour contrast + a 1px raster outline.
- **Lessons transfer partially.** Starting T3 from the top-down v3 recipe avoided the AA-mush stage entirely, but the
  outline recipe (underlays/strokes) did not transfer from top-down to iso.

## Pipeline bug found and fixed (affects the top-down results too)
`lib/svg.js` rasterize(): @napi-rs/canvas (and browsers) decode an SVG at its own width/height attributes; drawImage
then scales the *bitmap*. So "8x supersample" was a 32px raster stretched 8x. The fix rewrites the root width/height
before decoding. After the fix, orphan pixels on T3 outputs fell sharply (top-down ship 2.6% -> 0.2%, tank 3.8% -> 0.4%)
and re-review raised T3 to best ship and best tank. Lesson: verify each pipeline stage's output, not just the final sprite.

## Next experiments worth running
- T4 with 8-direction rotation sheet (the main reason to use voxels in an iso game).
- Hybrid: T4 or T3 base render + T1 char-map overlay for faces/eyes.
- Animation frames (spider walk cycle via leg-angle parameters in T2/T3/T4).
