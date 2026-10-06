# hollow-ward: pipeline analytics

10 assets. Price basis: $4/M input (review images, measured input), $20/M output (code; estimated at 3.5 chars/token unless measured).

Totals: 14485 output tok, 47342 review-image tok, est. $0.479. Average gain from revisions +1.15, from the finishing pass +0.1.

## Per pass

| Pass | n | Mean score | Mean Δ | Regressed | Gate pass | Output tok | Review tok | Mean wall s |
|---|---|---|---|---|---|---|---|---|
| r1 | 10 | 5.25 | - | 0 | 10/10 | 6569 | 7611 | 19 |
| r2 | 10 | 6 | +0.75 | 1 | 10/10 | 3188 | 10499 | 19 |
| r3 | 10 | 6.4 | +0.4 | 0 | 10/10 | 1599 | 10557 | 14 |
| f | 10 | 6.4 | +0 | 1 | 10/10 | 1359 | 10557 | 1532 |
| u | 2 | 6.5 | +0.5 | 0 | 2/2 | 696 | 2705 | 14 |
| f2+ | 5 | 6.5 | +0.1 | 0 | 5/5 | 1074 | 5413 | 14 |

## Per asset

| Asset | Kind | r1 | Best revision | Final | From revisions | From finish | Passes | Output tok | Review tok | Est. cost |
|---|---|---|---|---|---|---|---|---|---|---|
| ghoul | creature | 4.5 | 6 | 6.5 | +1.5 | +0 | 6 | 3144 | 13235 | $0.1158 |
| orderly | character | 4.5 | 6 | 6.5 | +1.5 | +0.5 | 5 | 1904 | 2172 | $0.0468 |
| rat | creature | 5 | 6.5 | 6.5 | +1.5 | +0 | 4 | 1199 | 3142 | $0.0365 |
| lamp-flicker | effect | 5 | 7 | 7 | +2 | +0 | 4 | 1125 | 4637 | $0.0410 |
| iron-bed | prop | 6 | 6 | 6.5 | +0 | +0 | 6 | 1562 | 2688 | $0.0420 |
| iv-stand | prop | 6 | 6.5 | 6.5 | +0.5 | +0 | 4 | 1080 | 1656 | $0.0282 |
| wheelchair | prop | 5.5 | 6.5 | 6.5 | +1 | +0 | 5 | 1331 | 2172 | $0.0353 |
| linoleum | tile | 5 | 6.5 | 6.5 | +1.5 | +0 | 5 | 1267 | 8762 | $0.0604 |
| ward-wall | texture | 5 | 6 | 6.5 | +1 | +0.5 | 4 | 965 | 7086 | $0.0476 |
| pill-bottle | ui-icon | 6 | 7 | 7 | +1 | +0 | 4 | 908 | 1792 | $0.0253 |

## Cost by kind

| kind | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| creature | 2 | 6.5 | $0.0800 | 5 |
| character | 1 | 6.5 | $0.0500 | 5 |
| effect | 1 | 7 | $0.0400 | 4 |
| prop | 3 | 6.5 | $0.0400 | 5 |
| tile | 1 | 6.5 | $0.0600 | 5 |
| texture | 1 | 6.5 | $0.0500 | 4 |
| ui-icon | 1 | 7 | $0.0300 | 4 |

## Cost by size

| size | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| creature | 2 | 6.5 | $0.0800 | 5 |
| character | 1 | 6.5 | $0.0500 | 5 |
| effect | 1 | 7 | $0.0400 | 4 |
| prop | 3 | 6.5 | $0.0400 | 5 |
| tile | 1 | 6.5 | $0.0600 | 5 |
| texture | 1 | 6.5 | $0.0500 | 4 |
| 16x16 | 1 | 7 | $0.0300 | 4 |

## Cost by view

| view | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| fp | 10 | 6.6 | $0.0500 | 4.7 |

## Cost by importance

| importance | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| standard | 10 | 6.6 | $0.0500 | 4.7 |

## First-pass quality by template

| Template | n | Mean r1 |
|---|---|---|
| topdown/character-walk | 1 | 4.5 |
| topdown/character | 2 | 4.75 |
| topdown/effect | 1 | 5 |
| topdown/prop | 4 | 5.88 |
| topdown/tile | 2 | 5 |

## Regressions

- iv-stand base.v2 (r2) -0.5
- linoleum finish.v1 (f) -0.5

## User revisions

5 feedback rounds over 10 finished assets (rate 0.5); by route: base 2, finish 3.

## Model / effort per stage

| Model | Effort | Passes | Mean Δ | Δ per 1k tok |
|---|---|---|---|---|
| default | default | 47 | +0.35 | 0.21 |

## Budget suggestions

- none yet (needs ≥ 3 assets of a kind)
