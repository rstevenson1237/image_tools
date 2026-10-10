# P1b parity experiment: artlab's six assets through the T2+ pipeline

Price basis (same as artlab): $4/M input (review images), $20/M output (code). Code tokens are estimates (3.5 chars/token); "edit" counts lines new vs the previous version. Review tokens are (w·h)/750 per review sheet.

| Asset | Pass | Version | Score | Δ | Gate | Hygiene | Colours | Code tok | Edit tok | Review tok | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hero | r1 | base.v1 | 5.5 |  | pass | 9.6 | 21 | 657 | 657 | 952 | Readable chibi, clean shield and sword; face normal-shading goes dark on the lower half and reads as a beard; spiky crown; arms lost; no blush |
| hero | r2 | base.v2 | 6.5 | +1 | pass | 9.9 | 21 | 792 | 564 | 700 | Big step: friendly face with blush, smooth hair dome, sleeves and hands read; hair has no fringe/strand detail, tunic flat, shield lacks a rim |
| hero | r3 | base.v3 | 7 | +0.5 | pass | 9.3 | 21 | 1387 | 1109 | 924 | Shield rim and sword fuller add polish, tunic seam/collar read; hair still a smooth blob without strands, orphans up to 7% |
| hero | f | finish.v1 (on base.v3) | 7.5 | +0.5 | pass | 9 | 22 | 268 | 268 | 924 | Fringe with tips and strands gives the hair texture, face lifted to light skin like the reference, tunic lighter; shield with steel rim; matches the artlab final |
| isochest | r1 | base.v1 | 6.5 |  | pass | 10 | 8 | 328 | 328 | 1114 | Closed state equals the reference (clean faces, straps, lock); open lid is a solid backboard with no dark inside, so the open read is weaker |
| isochest | r2 | base.v2 | 7 | +0.5 | pass | 10 | 8 | 570 | 557 | 815 | Open lid now hollow with a dark inside and straps over its edge; heap reads; both states as clear as the reference; 8/8 distinct variants |
| isochest | r3 | base.v3 | 6.5 | -0.5 | pass | 10 | 11 | 628 | 235 | 1073 | Regressed: the raised lock is a protruding white block and the seam slab darkens the whole top band of the body; brackets barely read |
| isochest | f | finish.v1 (on base.v2) | 7 | +0 | pass | 10 | 9 | 211 | 211 | 1073 | Keyhole and coin glints add small polish over v2; same read as the reference in both states |
| isohero | r1 | base.v1 | 5.5 |  | pass | 10 | 14 | 573 | 573 | 413 | Hood and cloak read; the tunic is a flat brown slab that reads as a door, no arms, legs hidden (boots only), small face |
| isohero | r2 | base.v2 | 6 | +0.5 | pass | 10 | 14 | 725 | 636 | 608 | Open cloak, jerkin, legs and hands read; the mirrored cloak halves leave an ink seam that splits the hood; dagger floats in front of the chest; boots lost in the legs |
| isohero | r3 | base.v3 | 6.5 | +0.5 | pass | 10 | 14 | 1145 | 815 | 804 | Single hood (no seam), V collar, legs with darker boots and a dagger at the side; cloak panels shade blotchy on the right, dagger is a dark blob, no cloak lining; 7/8 distinct variants |
| isohero | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 10 | 15 | 183 | 183 | 804 | Lining, hood rim and dagger edge are small gains; cloak shading stays blotchy and the figure is narrower and less charming than the T1 reference; below target |
| isospider | r1 | base.v1 | 6.5 |  | pass | 9.5 | 6 | 406 | 406 | 294 | Reads as a spider at once: hourglass, eyes, fangs, curved legs; legs thinner and paler than the reference's, abdomen/head lack a highlight so the body is flat |
| isospider | r2 | base.v2 | 6 | -0.5 | pass | 8.9 | 6 | 595 | 436 | 430 | Regressed: heavier legs merge into one mass (one underlay for the whole leg group, no ink between legs), knee circles read as pale spots, gloss crescents barely visible |
| isospider | r3 | base.v3 | 6 | +0 | pass | 8 | 6 | 767 | 643 | 566 | Per-leg ink separates the legs, but bevel shading speckles them (14% orphans) and the abdomen went dark; 7/8 distinct variants |
| isospider | f | finish.v1 (on base.v1) | 7 | +0.5 | pass | 10 | 7 | 242 | 242 | 566 | Extra ink ring makes the legs as heavy as the reference's, eye glints add menace, orphans down to 0.9%; gloss crescent barely visible; same read as the artlab final |
| ship | r1 | base.v1 | 6 |  | pass | 10 | 8 | 544 | 544 | 830 | Hull, plank deck and layout read at once; turrets too dark and crowded (forward pair overlaps), barrels heavy black bars, bridge lacks the light front block |
| ship | r2 | base.v2 | 6.5 | +0.5 | pass | 10 | 8 | 582 | 395 | 1211 | Turrets spaced, bridge front block and funnels read; aft/rear turrets still dark, barrels are heavy inked bars, the hull rim only shows at the stern |
| ship | r3 | base.v3 | 7 | +0.5 | pass | 10 | 8 | 794 | 670 | 1592 | Hull rim on both sides, light turrets, thin barrels and catwalks bring it close to the reference; turret tops and the bridge are flat, no small deck fittings; 8/8 distinct variants |
| ship | f | finish.v1 (on base.v3) | 7 | +0 | pass | 10 | 8 | 277 | 277 | 1592 | Fittings, turret hoods and roof rims add small detail; turrets still read as round blobs vs the reference's flat-faced housings and the bridge window line reads as an I glyph; below target |
| tank | r1 | base.v1 | 6.5 |  | pass | 10 | 8 | 405 | 405 | 732 | Strong silhouette and layout first try; dome and hull edges shade too dark (bottom-right half near black), treads faint, tracks banded by cyl shading |
| tank | r2 | base.v2 | 7.5 | +1 | pass | 10 | 8 | 521 | 389 | 1081 | Linear hull gradient and lighter dome match the reference's read; tread segments crisp; at parity, plain hull surfaces (no panel lines or hatches) |
| tank | r3 | base.v3 | 7 | -0.5 | pass | 10 | 8 | 878 | 778 | 1430 | Vents, glacis seams and sensor socket add detail; the dome hatch ring breaks up after downsampling and reads as a crack; 8/8 distinct variants |
| tank | f | finish.v1 (on base.v2) | 7.5 | +0 | pass | 10 | 10 | 191 | 191 | 2860 | Glacis seams and dome/sensor glints add polish over v2 without changing the read; at parity with the artlab final |

## Per asset

| Asset | Target | r1 | Best revision | Finish | From revisions | From finish | Output tok | Review tok | Est. cost | Target met |
|---|---|---|---|---|---|---|---|---|---|---|
| hero | 7.5 | 5.5 | 7 (base.v3) | 7.5 | +1.5 | +0.5 | 2598 | 3500 | $0.066 | yes |
| isochest | 7 | 6.5 | 7 (base.v2) | 7 | +0.5 | +0 | 1331 | 4075 | $0.043 | yes |
| isohero | 7 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 2207 | 2629 | $0.055 | **no** |
| isospider | 7 | 6.5 | 6.5 (base.v1) | 7 | +0 | +0.5 | 1727 | 1856 | $0.042 | yes |
| ship | 7.5 | 6 | 7 (base.v3) | 7 | +1 | +0 | 1886 | 5225 | $0.059 | **no** |
| tank | 7.5 | 6.5 | 7.5 (base.v2) | 7.5 | +1 | +0 | 1763 | 6103 | $0.060 | yes |

Totals: 11512 output tok, 23388 review tok, est. $0.324. Average gain from revisions 0.83, from the finishing pass 0.17. 4/6 assets at or above target.
