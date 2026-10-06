# torchdeep: pipeline analytics

10 assets. Price basis: $4/M input (review images, measured input), $20/M output (code; estimated at 3.5 chars/token unless measured).

Totals: 14414 output tok, 40839 review-image tok, est. $0.452. Average gain from revisions +1.3, from the finishing pass +0.1.

## Per pass

| Pass | n | Mean score | Mean Δ | Regressed | Gate pass | Output tok | Review tok | Mean wall s |
|---|---|---|---|---|---|---|---|---|
| r1 | 10 | 5.1 | - | 0 | 9/10 | 6462 | 5766 | 18 |
| r2 | 10 | 5.95 | +0.85 | 1 | 9/10 | 3028 | 7725 | 14 |
| r3 | 10 | 6.25 | +0.3 | 2 | 9/10 | 2077 | 10213 | 13 |
| f | 10 | 6.45 | +0.05 | 0 | 10/10 | 1370 | 10222 | 13 |
| u | 2 | 6.5 | +1.25 | 0 | 2/2 | 851 | 2959 | 12 |
| f2+ | 4 | 6.63 | +0.13 | 0 | 4/4 | 626 | 3954 | 17 |

## Per asset

| Asset | Kind | r1 | Best revision | Final | From revisions | From finish | Passes | Output tok | Review tok | Est. cost |
|---|---|---|---|---|---|---|---|---|---|---|
| hero | character | 5.5 | 7 | 7 | +1.5 | +0 | 4 | 2695 | 6746 | $0.0809 |
| skeleton-knight | character | 6 | 7 | 7 | +1 | +0 | 5 | 2022 | 1972 | $0.0483 |
| slime | creature | 5 | 6.5 | 6.5 | +1.5 | +0 | 4 | 1234 | 4626 | $0.0432 |
| torch-flame | effect | 5.5 | 7 | 7 | +1.5 | +0 | 4 | 1088 | 3713 | $0.0366 |
| chest | prop | 6 | 6.5 | 6.5 | +0.5 | +0 | 4 | 1072 | 3142 | $0.0340 |
| barrel | prop | 5 | 6 | 6.5 | +1 | +0.5 | 5 | 1160 | 2172 | $0.0319 |
| pillar | prop | 5.5 | 6.5 | 6.5 | +1 | +0 | 4 | 919 | 1656 | $0.0250 |
| brazier | prop | 3.5 | 6 | 6.5 | +2.5 | +0.5 | 4 | 949 | 1656 | $0.0256 |
| rubble | prop | 3.5 | 5.5 | 6.5 | +2 | +0 | 6 | 1419 | 2688 | $0.0391 |
| floor | tile | 5.5 | 6 | 6.5 | +0.5 | +0 | 6 | 1856 | 12468 | $0.0870 |

## Cost by kind

| kind | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| character | 2 | 7 | $0.0600 | 4.5 |
| creature | 1 | 6.5 | $0.0400 | 4 |
| effect | 1 | 7 | $0.0400 | 4 |
| prop | 5 | 6.5 | $0.0300 | 4.6 |
| tile | 1 | 6.5 | $0.0900 | 6 |

## Cost by size

| size | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| character | 2 | 7 | $0.0600 | 4.5 |
| creature | 1 | 6.5 | $0.0400 | 4 |
| effect | 1 | 7 | $0.0400 | 4 |
| prop | 5 | 6.5 | $0.0300 | 4.6 |
| tile | 1 | 6.5 | $0.0900 | 6 |

## Cost by view

| view | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| iso | 10 | 6.65 | $0.0500 | 4.6 |

## Cost by importance

| importance | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| standard | 10 | 6.65 | $0.0500 | 4.6 |

## First-pass quality by template

| Template | n | Mean r1 |
|---|---|---|
| topdown/character-walk | 1 | 5.5 |
| iso/character | 2 | 5.5 |
| iso/effect | 1 | 5.5 |
| iso/prop | 5 | 4.7 |
| iso/tile | 1 | 5.5 |

## Regressions

- skeleton-knight base.v3 (r3) -0.5
- chest base.v2 (r2) -1
- floor base.v3 (r3) -1

## User revisions

4 feedback rounds over 10 finished assets (rate 0.4); by route: base 2, finish 2.

## Model / effort per stage

| Model | Effort | Passes | Mean Δ | Δ per 1k tok |
|---|---|---|---|---|
| default | default | 46 | +0.42 | 0.271 |

## Budget suggestions

- none: no kind crosses a threshold (v3 adding ≤ 0.1 or ≥ 0.75 over ≥ 3 assets, v2 not improving, finish ≤ 0, > 30% regressions)
