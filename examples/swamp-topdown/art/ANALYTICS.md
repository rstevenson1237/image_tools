# bogwatch: pipeline analytics

10 assets. Price basis: $4/M input (review images, measured input), $20/M output (code; estimated at 3.5 chars/token unless measured).

Totals: 13722 output tok, 27426 review-image tok, est. $0.384. Average gain from revisions +1.35, from the finishing pass +0.2.

## Per pass

| Pass | n | Mean score | Mean Δ | Regressed | Gate pass | Output tok | Review tok | Mean wall s |
|---|---|---|---|---|---|---|---|---|
| r1 | 10 | 5.15 | - | 0 | 9/10 | 6455 | 4820 | 17 |
| r2 | 10 | 6.1 | +0.95 | 0 | 10/10 | 2831 | 5080 | 12 |
| r3 | 10 | 6.45 | +0.35 | 1 | 10/10 | 1926 | 7984 | 13 |
| f | 10 | 6.6 | +0.1 | 0 | 10/10 | 1430 | 8013 | 9 |
| u | 1 | 6.5 | +1 | 0 | 1/1 | 433 | 375 | 11 |
| f2+ | 3 | 7 | +0.5 | 0 | 3/3 | 647 | 1154 | 9 |

## Per asset

| Asset | Kind | r1 | Best revision | Final | From revisions | From finish | Passes | Output tok | Review tok | Est. cost |
|---|---|---|---|---|---|---|---|---|---|---|
| lantern-bearer | character | 5.5 | 7 | 7 | +1.5 | +0 | 4 | 2386 | 7272 | $0.0768 |
| bog-goblin | character | 6 | 6.5 | 7 | +0.5 | +0.5 | 5 | 1954 | 1639 | $0.0456 |
| leech | creature | 5.5 | 6.5 | 6.5 | +1 | +0 | 4 | 1020 | 3713 | $0.0353 |
| wisp | effect | 5.5 | 7 | 7 | +1.5 | +0 | 4 | 953 | 2905 | $0.0307 |
| sunk-crate | prop | 4.5 | 6.5 | 7 | +2 | +0.5 | 5 | 1303 | 1574 | $0.0324 |
| lantern-post | prop | 6 | 7 | 7 | +1 | +0 | 4 | 1215 | 1206 | $0.0291 |
| reeds | prop | 4 | 5.5 | 7 | +1.5 | +0.5 | 6 | 1629 | 1922 | $0.0403 |
| bone-pile | prop | 5 | 6.5 | 6.5 | +1.5 | +0 | 4 | 1182 | 1189 | $0.0284 |
| mud | tile | 4.5 | 6 | 6.5 | +1.5 | +0.5 | 4 | 1036 | 3003 | $0.0327 |
| bog-water | tile | 5 | 6.5 | 6.5 | +1.5 | +0 | 4 | 1044 | 3003 | $0.0329 |

## Cost by kind

| kind | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| character | 2 | 7 | $0.0600 | 4.5 |
| creature | 1 | 6.5 | $0.0400 | 4 |
| effect | 1 | 7 | $0.0300 | 4 |
| prop | 4 | 6.88 | $0.0300 | 4.75 |
| tile | 2 | 6.5 | $0.0300 | 4 |

## Cost by size

| size | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| character | 2 | 7 | $0.0600 | 4.5 |
| creature | 1 | 6.5 | $0.0400 | 4 |
| effect | 1 | 7 | $0.0300 | 4 |
| prop | 4 | 6.88 | $0.0300 | 4.75 |
| tile | 2 | 6.5 | $0.0300 | 4 |

## Cost by view

| view | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| topdown | 10 | 6.8 | $0.0400 | 4.4 |

## Cost by importance

| importance | n | Mean final | Mean cost | Mean passes |
|---|---|---|---|---|
| standard | 10 | 6.8 | $0.0400 | 4.4 |

## First-pass quality by template

| Template | n | Mean r1 |
|---|---|---|
| topdown/character-walk | 1 | 5.5 |
| topdown/character | 2 | 5.75 |
| topdown/effect | 1 | 5.5 |
| topdown/prop | 4 | 4.88 |
| topdown/tile | 2 | 4.75 |

## Regressions

- leech base.v3 (r3) -0.5

## User revisions

3 feedback rounds over 10 finished assets (rate 0.3); by route: base 1, finish 2.

## Model / effort per stage

| Model | Effort | Passes | Mean Δ | Δ per 1k tok |
|---|---|---|---|---|
| default | default | 44 | +0.49 | 0.401 |

## Budget suggestions

- none yet (needs ≥ 3 assets of a kind)
