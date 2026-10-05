# Findings: procedural game-art techniques (Claude-authored sprites)

Assets: 32x32 fantasy hero (RPG), 160x41 WWII battleship (naval sim), 64x64 sci-fi tank (RTS).
Loop per pass: write code -> `node run.js render` -> `node run.js review` (PNG sheet viewed by the model) -> `node run.js score`.
Full numbers: REPORT.md (generated). Visual scores are the model's own review (0-10), hygiene is automated (metrics.js).

## Final scores (visual)
| Asset | T1 Direct pixels | T2 Primitives | T3 SVG -> canvas |
|---|---|---|---|
| Hero 32x32 | **7.5** (v2) | 6.5 (v2) | 7 (v3)* |
| Battleship | 6.5 (v3) | 5.5 (v3) | **7.5** (v3)* |
| Sci-fi tank | 6.5 (v3) | 6.5 (v2) | **7.5** (v3)* |

*Re-scored after the supersampling bug fix found during the isometric run (see FINDINGS-iso.md). Before the fix,
"ss=8" decoded the SVG at its 32px attribute size and merely stretched it, so all earlier T3 scores were on degraded renders.

## Score trajectory (v1 -> v2 -> v3)
- T1: hero 7 -> 7.5 | ship 4 -> 6 -> 6.5 | tank 4.5 -> 6.5 -> 6.5
- T2: hero 6 -> 6.5 | ship 4.5 -> 5 -> 5.5 | tank 4 -> 6.5
- T3: hero 2 -> 6.5 -> 6.5 | ship 5.5 -> 4.5 -> 7 | tank 6 -> 5.5 -> 6.5

## Conclusions
- **Small sprites (<= 32px): T1 wins.** A hand-authored char map is the only method where every pixel is a decision; first attempt scored 7. Diminishing returns after v2.
- **Large hard-surface sprites: T3 wins clearly once supersampling actually works.** Raw SVG raster = nice shapes, not pixel art. Stripping strokes (v2) regressed. What works (v3): outlines as dark *underlay shapes*, 8x supersample, quantize to an *asset-restricted* palette, majority-vote downsample, 1px raster outline pass.
- **T2 is the reuse play, not the quality play.** Highest up-front cost (prim.js library), lowest scores on the ship, but every library fix (sphere-light sign bug, selective `ink` outlines) improves all future sprites, and seeds give free variants (variants.js). Variety in the current seed logic is limited (4 combos) - add more parameters.
- **Automated hygiene metrics saturate** (most finals 9.7-10) and cannot rank quality; they catch AA fuzz, off-palette and orphan pixels but not readability. Keep the visual review step; metrics are a gate, not a judge.
- **Regressions happen in ~1 in 4 refinement passes** (T3 ship v2, T1 tank v3 dome rim). Always review v(n) beside v(n-1) - the harness sheets do this.
- **Cost is not the differentiator.** All three cost roughly $0.08-0.12 of output+review tokens for 3 assets at Opus 5.5 list price ($4/$20 per M). Real sessions cost several times more because reasoning and context re-reads are not captured; treat ledger figures as lower bounds.

## Recommended hybrid for production
1. Silhouette + large forms authored as SVG (T3 v3 pipeline) or primitives (T2) for parametric families.
2. Pixel-level finishing pass in T1 style (char-map overlays for faces, emblems, highlights).
3. Shared post passes from post.js: palette snap, outline, drop shadow, despeckle.

## Other techniques worth testing (research)
- **Mask-template generators** (Dave Bollinger / pixel-sprite-generator): randomized, mirrored 2D masks; great for mass ship/tank variants.
- **3D -> pixel pipelines**: low-res toon render, outline computed at internal resolution (guaranteed 1px), dithering; ideal for 8/16-direction rotation of tanks and ships (Blender/Unity, SpritePress, BoneToPix).
- **Voxel models** rendered orthographic top-down with face shading.
- **Small learned generators** (e.g. a ~2.9M-param transformer for 32x32 palette-indexed sprites) plus a procedural palette-only lighting shader.
- **Pose/direction translation** (Pix2Pix-style GANs) to derive other facings from one sprite.
- **Wave Function Collapse** (tiles, decks, panel layouts), **L-systems** (foliage), **SDF shading** with quantized bands, **paper-doll layering + palette swaps** (LPC-style), **normal-map generation** for dynamic lighting, **RotSprite** for clean sprite rotation.
