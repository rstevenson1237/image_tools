# Art-generation technique experiment

Model price basis: claude-opus-5-5 $4/M in, $20/M out. Token counts are estimates (3.5 chars/token for code; (w*h)/750 for review images). Shared library: ~6074 tokens.

| Asset | Tech | Ver | Code tok (full) | Edit tok | Hygiene | Visual | Colors | AA% | Orphan% | Outline% | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| isohero | t1 | v1 | 604 | 604 | 10 | 7 | 14 | 0 | 3.1 | 90.7 | Charming, clear hood/face/cloak; dagger hand slightly detached |
| isohero | t2 | v1 | 460 | 460 | 10 | 6 | 15 | 0 | 3.5 | 100 | Clean; hood reads as hair/helmet, face cramped |
| isohero | t3 | v1 | 630 | 630 | 10 | 4.5 | 9 | 0 | 0.3 | 100 | Stroke 2 + raster outline = 3px black blobs; eyes blurred |
| isohero | t3 | v2 | 219 | 143 | 10 | 5.5 | 10 | 0 | 0.4 | 100 | Post-fix: clean face/eyes; outlines still 2px+, dagger lost in dark mass |
| isohero | t3 | v3 | 421 | 249 | 10 | 6.5 | 11 | 0 | 0.1 | 100 | Clean face, readable dagger; cloak outline still a bit heavy |
| isohero | t4 | v1 | 484 | 484 | 10 | 3 | 12 | 0 | 0 | 100 | 4px cubes too coarse: green box, face mostly hidden |
| isohero | t4 | v2 | 520 | 481 | 10 | 4.5 | 13 | 0 | 3.9 | 100 | Fine voxels fix silhouette; edge-light speckle, face hidden |
| isohero | t4 | v3 | 577 | 164 | 9.8 | 5 | 13 | 0 | 4.7 | 100 | Face now visible; hood surface speckle from ellipsoid stair-steps |
| isospider | t1 | v1 | 590 | 590 | 9.6 | 6.5 | 6 | 0 | 5.4 | 100 | Readable, menacing; legs thin/jagged |
| isospider | t2 | v1 | 400 | 400 | 8.9 | 6.5 | 7 | 0 | 8.2 | 100 | Clean, same read as T1 at lower effort |
| isospider | t3 | v1 | 558 | 558 | 10 | 7 | 6 | 0 | 1.4 | 97.9 | Post-fix: curved legs + clean body; best spider |
| isospider | t4 | v1 | 299 | 299 | 10 | 2.5 | 6 | 0 | 0 | 91.3 | Legs merge into a block; not a spider |
| isospider | t4 | v2 | 384 | 345 | 8 | 4 | 7 | 0 | 12.1 | 97.6 | Legs visible but squat; speckle |
| isospider | t4 | v3 | 424 | 136 | 8.3 | 4.5 | 7 | 0 | 10.9 | 95.7 | Leggier but still a speckled blob; voxel plateau for organic forms |
| isochest | t1 | v1 | 614 | 614 | 9.9 | 6.5 | 9 | 0 | 4.2 | 98.7 | Both states read; lock off-centre, odd lid seam line |
| isochest | t2 | v1 | 428 | 428 | 10 | 4 | 10 | 0 | 1.5 | 100 | Pixel-centre sampling gaps, gold top floods open state |
| isochest | t2 | v2 | 478 | 182 | 9.9 | 5 | 11 | 0 | 0.9 | 100 | Interior/bevel better; same strap interpenetration notch |
| isochest | t2 | v3 | 553 | 163 | 9.7 | 6.5 | 10 | 0 | 1.9 | 100 | Strap fix works: clean bands, bevel, clear states |
| isochest | t3 | v1 | 597 | 597 | 10 | 2.5 | 7 | 0 | 0.2 | 100 | Arched-lid path bug (wrong control points): broken shape |
| isochest | t3 | v2 | 541 | 174 | 9.8 | 3 | 8 | 0 | 0.5 | 100 | Strap boxes interpenetrate body: painter draws their faces across front |
| isochest | t3 | v3 | 621 | 129 | 9.8 | 4.5 | 7 | 0 | 0.9 | 100 | Straps fixed but paint-order strokes darken whole front face |
| isochest | t3 | v4 | 653 | 90 | 9.7 | 6 | 8 | 0 | 1.6 | 100 | Clean faces and states; closed lid/body seam lost |
| isochest | t4 | v1 | 257 | 257 | 9.7 | 7 | 9 | 0 | 2.7 | 100 | Best chest: clean faces, straps, clear open/closed |

## Per-technique totals (all three assets, incl. technique-specific lib)

| Tech | Iterations | Output tok | Review tok | Est. cost | Avg final visual | Avg final hygiene | Visual pts per $0.01 |
|---|---|---|---|---|---|---|---|
| t1 Direct pixel writes | 3 | 1808 | 2052 | $0.044 | 6.7 | 9.8 | 1.5 |
| t2 Primitive composition | 5 | 3196 | 2052 | $0.072 | 6.3 | 9.5 | 0.9 |
| t3 SVG -> canvas | 8 | 3034 | 2232 | $0.070 | 6.5 | 9.9 | 0.9 |
| t4 Voxel -> iso render | 7 | 3391 | 2288 | $0.077 | 5.5 | 9.3 | 0.7 |
