# Art-generation technique experiment

Model price basis: claude-opus-5-5 $4/M in, $20/M out. Token counts are estimates (3.5 chars/token for code; (w*h)/750 for review images). Shared library: ~6074 tokens.

| Asset | Tech | Ver | Code tok (full) | Edit tok | Hygiene | Visual | Colors | AA% | Orphan% | Outline% | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hero | t1 | v1 | 515 | 515 | 9.8 | 7 | 18 | 0 | 3.3 | 100 | Reads well; flat face, shield hides pauldron |
| hero | t1 | v2 | 705 | 422 | 9.4 | 7.5 | 20 | 0 | 5.7 | 100 | Blush, visible pauldron, directional shade; small polish gain |
| hero | t2 | v1 | 678 | 678 | 9.7 | 6 | 19 | 0 | 5.2 | 100 | Solid read; seed made tunic=cape red, no inner lines |
| hero | t2 | v2 | 673 | 619 | 9.1 | 6.5 | 20 | 0 | 7.7 | 100 | Ink lines + seeded steel tunic; face/fringe heavy, sides read as helmet |
| hero | t3 | v1 | 466 | 466 | 1 | 2 | 170 | 27.2 | 36.9 | 98.9 | AA mush, face gradient rendered black, strokes too thick for 32px |
| hero | t3 | v2 | 551 | 516 | 10 | 6.5 | 18 | 0 | 2.5 | 100 | Huge gain: crisp, on-palette; eyes weak, belt/emblem softened |
| hero | t3 | v3 | 210 | 197 | 10 | 7 | 18 | 0 | 2.5 | 100 | RE-SCORED after ss fix: crisp eyes, clean palette, no mush |
| ship | t1 | v1 | 616 | 616 | 8 | 4 | 7 | 0 | 0.1 | 0 | Stair-step bow, B barrels clip A, no outline, stripy deck |
| ship | t1 | v2 | 1087 | 989 | 10 | 6 | 8 | 0 | 1.1 | 100 | Outline+gunwale+shadow big gain; breakwater spikes outside hull, turrets undersized |
| ship | t1 | v3 | 1145 | 280 | 10 | 6.5 | 8 | 0 | 1.4 | 100 | Turrets now read at game zoom; bow still steppy |
| ship | t2 | v1 | 556 | 556 | 10 | 4.5 | 8 | 0 | 1.3 | 100 | Outline+shadow help; ball turrets, barrels hidden under turrets |
| ship | t2 | v2 | 780 | 681 | 10 | 5 | 8 | 0 | 1.8 | 100 | Gunwale/deck good; capsule turrets broken by ink, superstructure over-inked |
| ship | t2 | v3 | 867 | 374 | 10 | 5.5 | 8 | 0 | 3.1 | 100 | Cleaner, but poly turrets read as arrowheads |
| ship | t3 | v1 | 477 | 477 | 1 | 5.5 | 604 | 21 | 27.9 | 98.1 | Best silhouette/curved bow; blurry, not pixel art |
| ship | t3 | v2 | 192 | 180 | 10 | 4.5 | 9 | 0 | 0.2 | 100 | Crisp but turrets became blobs, gradient -> hard bands, stray colours |
| ship | t3 | v3 | 663 | 651 | 10 | 7.5 | 8 | 0 | 0.2 | 100 | RE-SCORED after ss fix: crisp turrets + planks; best ship |
| tank | t1 | v1 | 449 | 449 | 10 | 4.5 | 8 | 0 | 0.1 | 63.3 | Readable but flat hull, harsh dome banding, thin barrels |
| tank | t1 | v2 | 955 | 925 | 9.8 | 6.5 | 11 | 0 | 4.6 | 100 | Outline, cleats, shadow; dome dither noisy, hull too white, nose too pointed |
| tank | t1 | v3 | 1007 | 179 | 9.9 | 6.5 | 12 | 0 | 2.4 | 100 | Cleaner dome, but dome rim gaps and nose corner spikes (regressions) |
| tank | t2 | v1 | 514 | 514 | 10 | 4 | 12 | 0 | 1.6 | 100 | Sphere light inverted (lib bug), treads pattern lost, turret merges into deck |
| tank | t2 | v2 | 532 | 470 | 10 | 6.5 | 12 | 0 | 2.3 | 100 | Cleats, ink separation, rim dome; muzzle brakes merge into a lump |
| tank | t3 | v1 | 431 | 431 | 2.4 | 6 | 542 | 8 | 49.6 | 100 | Clean smooth read, nice dome; soft edges, 542 colours |
| tank | t3 | v2 | 144 | 144 | 10 | 5.5 | 14 | 0 | 1.9 | 100 | Crisp, on-palette; turret no longer separates from hull |
| tank | t3 | v3 | 306 | 292 | 10 | 7.5 | 8 | 0 | 0.4 | 100 | RE-SCORED after ss fix: tread stripes back, clean dome; best tank |

## Per-technique totals (all three assets, incl. technique-specific lib)

| Tech | Iterations | Output tok | Review tok | Est. cost | Avg final visual | Avg final hygiene | Visual pts per $0.01 |
|---|---|---|---|---|---|---|---|
| t1 Direct pixel writes | 8 | 4375 | 2104 | $0.096 | 6.8 | 9.8 | 0.7 |
| t2 Primitive composition | 7 | 5455 | 2104 | $0.118 | 6.2 | 9.7 | 0.5 |
| t3 SVG -> canvas | 9 | 3818 | 2104 | $0.085 | 7.3 | 10.0 | 0.9 |
