# Calibration findings — blind re-score, roster lineup, silhouettes

Date: 2026-10-07 · Subject: the 30 approved finals of the three fixture games (P3), after the rev 8 export · Evidence:
[`calibration/`](calibration) (blind scores, lineup and silhouette sheets, reviewer outputs, metrics) · Prompted by an
outside write-up of a code-generated sprite pipeline whose quality only rose once "looks good to me" stopped being the
standard. These three experiments test which review signals catch what our pipeline misses.

Method, all three experiments: fresh general-purpose subagents that had not seen the assets, the ledgers or each other's
output, told to read only the sheets made for them (an instruction, not a sandbox). One reviewer per fixture per
experiment, so single verdicts are noisy; the patterns below held in all three fixtures. Nothing was written to the
fixture repos.

## 1. Blind re-score of the finals

Each final was shown alone — 1×, scaled, in context, the direction anchors, labelled with its id only (no earlier
versions, no scores, no notes) — and scored with the `art-reviewer` rubric. The P3 scores were self-assessed by the agent
that wrote the assets ([P3 findings](P3-w2.md)).

| | Self-scored (P3) | Blind |
|---|---|---|
| Mean | 6.68 | **6.15** (−0.53) |
| Lower / same / higher | | 19 / 5 / 6 |
| Off by more than 1 point | | 8 |
| Below the 6.5 approval bar | 0 | **15** |

By kind, tiles drifted most (−1.13 over 4: visible repetition grids in mud, bog-water and the iso floor); characters least
(−0.30). The large drops are concept misses the self-scorer passed: the barrel reads as a crate (6.5 → 4.5, checked by eye:
a hooped box), the wisp is warm amber against a "cold pale flame" brief and the direction's amber-only rule (7 → 5.5), the
bone pile is one oversized skull on a box (6.5 → 5), the slime reads as a dark mound (6.5 → 5), the orderly's pose doesn't
read (6.5 → 5), the IV bag reads as a lamp shade (6.5 → 5). Six assets went *up* half a point, so this is not uniform
harshness. Per-asset scores: [`original-scores.json`](calibration/original-scores.json),
`calibration/<fixture>/blind-scores.json`.

**Conclusion:** self-scores drift upward by about half a point and miss concept errors. A blind score at `final` would
have flagged all 8 large misses before approval, for ~600 image tokens per asset.

## 2. Roster lineup (sizes and cross-asset consistency)

Every non-tile asset of a fixture, first frame, side by side on one ground baseline at 1× and 4×
([swamp](calibration/swamp-topdown/lineup.png), [iso](calibration/iso-dungeon/lineup.png),
[crawler](calibration/billboard-crawler/lineup.png)); a reviewer judged relative scale and consistency.

**The kind-median size metric is worse than useless.** Flagging assets more than 8 % off their kind's median height
(characters and creatures pooled) against the reviewers' verdicts:

| | Assets |
|---|---|
| judged wrongly scaled by eye | 11 of 25 (9 too big, 2 too small) |
| … flagged by the metric in the right direction | **0** |
| … flagged in the wrong direction (rat "−52 %", eye: ~3× too big) | 7 |
| … missed (barrel, brazier, torch flame, pillar, wheelchair) | 4 |
| metric flags on assets the eye judged fine | 6 |

The cause is the same in all three fixtures: **every prop and creature was drawn to fill its frame** — a barrel as tall as
the hero, a leech nearly the player's length, a rat over half the orderly's height, a wheelchair as tall as a man. A
median over assets that all fill their frames looks normal. A useful size check has to compare against real-world size,
not against the roster.

**The lineup itself found what no per-asset review can:** an inverted light hierarchy in all three games (the swamp wisp
outshines the player's lantern, the brazier outshines the torch, warm accents leak outside the crawler's lamp); friend and
foe sharing a ramp (swamp player and goblin) or a silhouette (crawler orderly and ghoul); props and characters in two
styles (thin flat linework beside chunky shaded figures); inconsistent ground contact and camera angles.

## 3. Silhouettes

The same assets as shuffled, lettered black silhouettes ([swamp](calibration/swamp-topdown/silhouettes.png),
[iso](calibration/iso-dungeon/silhouettes.png), [crawler](calibration/billboard-crawler/silhouettes.png)). The reviewer
named each from the shape and rated readability 1–5 *before* seeing the asset list, then matched letters to ids.

- **Matching is too easy:** 25/25 correct, mostly by elimination. Not a useful signal.
- **The free guess is:** 11 of 25 silhouettes rated ≤ 2. It barely tracks the colour score, so it is independent signal:
  the swamp player `lantern-bearer` rated 1 ("tall egg / boulder") against a blind colour score of 7.5, the torch flame 2
  against 7.5, the rat and the brazier 2 against 7.
- **Pairwise overlap (IoU, bottom-centre aligned):** the planned 0.85 threshold caught nothing (max 0.80). Ranking works:
  the most-overlapping pair in each fixture was one the tester confused (barrel ~ pillar, sunk-crate ~ bone-pile,
  ghoul ~ orderly: 3/3), and the top 5 per fixture held 6 of the 11 confused pairs. Confusions between two small blobs
  have low overlap; the readability rating catches those.

## What gets built (rev 9)

| Signal | Built as |
|---|---|
| Blind re-score | a `blind` pass after the finish: blind sheet (final only), scored by a fresh reviewer; a gap > 1 point or a blind score under the approval bar is an open issue on `final`; `approve` warns |
| Who scored | `score --reviewer <name>`; self-scores are marked in the gallery and analytics |
| Real-world size | brief `height` (metres) and direction `scale.metre` (px per metre, default character height / 1.8 m); conformance `height` flag when the drawn height is > 20 % off |
| Silhouette | a solid-black panel on every review sheet |
| Roster review | `artgen roster`: lineup sheet, shuffled silhouette sheet, size table, top-5 overlap pairs; a fresh reviewer's guesses and lineup notes recorded with `roster record`, shown as open issues in the gallery |
| Kind-median size check | **not built** (see §2) |

**Check of the built size table** (rev 9, on a scratch copy of iso-dungeon): with plausible real-world heights in the
briefs (hero and knight 1.8 m, barrel and brazier 1 m, chest 0.8 m, slime 0.6 m, rubble 0.5 m, torch flame 0.4 m,
pillar 3 m) and the default world scale (character frame 32 px = 1.8 m), `artgen roster` flags 7 of 9 assets and
agrees in direction with the lineup reviewer on 8 of 9: barrel +74 % (reviewer: "70–80 % too big"), brazier +63 %,
chest +83 %, slime +106 %, torch flame +153 %, pillar −44 % (too short), hero and knight within tolerance; it disagrees
on rubble (+80 %, reviewer: fine). The heights were chosen for this check, so it shows the mechanism works when briefs
carry sizes, not that any particular height is right.
