# Reviewing and scoring

`{{ARTGEN}} review <assetDir> [--version v]` writes `out/review-<v>.png` and logs its image-token cost. Rows: the
reference (if the brief has one), the best-scoring version so far, v(n−1), then **v(n)** (marked `>>`). Each row: 1×
on checker · scaled on checker · scaled in context (game background, iso floor for iso assets). The label carries
hygiene, colour count, orphan %, and the gate result.

Always open the PNG and look before scoring (R7). Read the 1× panel first: that is what the player sees.

## Rubric (0–10, against the direction and its anchors)
| Score | Reads as |
|---|---|
| 9–10 | could ship in a commercial pixel game; nothing to fix |
| 7.5–8.5 | strong: clear silhouette at 1×, deliberate shading, consistent with the anchors; small polish left |
| 6.5–7 | good: reads at 1×, on-style; one or two visible problems (a muddy part, a weak face, a stray line) |
| 5–6 | readable but generic or off-style; several problems or a weak silhouette |
| 3–4.5 | hard to read at 1×, shading noise, broken lines, clashes with the direction |
| 0–2.5 | wrong subject, broken render |

Penalise: unreadable silhouette at 1×, pillow shading, banding, orphan pixels, jaggies on curves, lines thicker than
the direction's weight, details below `detail.minFeaturePx`, anything that would not sit beside the anchors.

## Score notes
One line each: what works · the biggest problem · the next change. E.g. `--note "silhouette reads; cloak bands
blotchy (normal on thin panels) → flat bands + cyl arms in v3"`. The next revision starts from these notes.
