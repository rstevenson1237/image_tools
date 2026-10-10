# artgen analytics v2: recommendations

Pooled over 4 project(s): examples/swamp-topdown (10 assets, 51 scores), examples/iso-dungeon (10 assets, 49 scores), examples/billboard-crawler (10 assets, 47 scores), packages/artgen-core/bench/p6 (21 assets, 91 scores).

## Revision passes by kind

Mean gain on the best-so-far score from each base pass (n = assets that reached it).

| Kind | Assets | Gains by pass | Current | Recommended | Confidence | Why |
|---|---|---|---|---|---|---|
| character | 9 | r2 +0.94 (9), r3 +0.39 (9) | 3 | 3 | high | every observed pass up to r3 adds ≥ 0.25 |
| creature | 7 | r2 +0.79 (7), r3 +0.36 (7) | 3 | 3 | medium | every observed pass up to r3 adds ≥ 0.25 |
| effect | 6 | r2 +1 (6), r3 +0.58 (6) | 3 | 4 | medium | r3 still adds 0.58 on average over 6 assets (≥ 0.5): one more pass should pay |
| layer | 1 | r2 +1.5 (1), r3 +1 (1) | - | 3 | low | fewer than 3 assets reached a second pass: keep the current budget |
| prop | 14 | r2 +0.75 (14), r3 +0.5 (14) | 3 | 4 | high | r3 still adds 0.5 on average over 14 assets (≥ 0.5): one more pass should pay |
| texture | 6 | r2 +0.58 (6), r3 +0.17 (6) | 3 | 2 | medium | r3 adds 0.17 on average over 6 assets (< 0.25) |
| tile | 4 | r2 +0.88 (4), r3 +0.38 (4) | 3 | 3 | low | every observed pass up to r3 adds ≥ 0.25 |
| tileset | 2 | r2 +0.75 (2), r3 +0.5 (2) | - | 3 | low | fewer than 3 assets reached a second pass: keep the current budget |
| ui-icon | 1 | r2 +0.5 (1), r3 +0.5 (1) | 3 | 3 | low | fewer than 3 assets reached a second pass: keep the current budget |
| viewmodel | 1 | r2 +1.5 (1), r3 +1 (1) | - | 3 | low | fewer than 3 assets reached a second pass: keep the current budget |

## Image-token caps by kind

| Kind | Assets | p50 | p90 | Suggested cap |
|---|---|---|---|---|
| character | 9 | 2172 | 7272 | 11000 |
| creature | 7 | 3328 | 13235 | 20000 |
| effect | 6 | 2905 | 6021 | 9500 |
| layer | 1 | 2069 | 2069 | - (too few assets) |
| prop | 14 | 1662 | 2688 | 4500 |
| texture | 6 | 4801 | 7838 | 12000 |
| tile | 4 | 4929 | 17354 | - (too few assets) |
| tileset | 2 | 1547 | 2621 | - (too few assets) |
| ui-icon | 1 | 1792 | 1792 | - (too few assets) |
| viewmodel | 1 | 5050 | 5050 | - (too few assets) |

## Finishing, user revisions and blind gaps by kind

| Kind | Finished | First finish gain | Second finish needed | User sent back | Blind gap (own − blind) |
|---|---|---|---|---|---|
| character | 9 | +0.11 | 33% | 60% | - |
| creature | 7 | +0 | 14% | 25% | - |
| effect | 6 | +0 | 17% | 0% | - |
| layer | 1 | +0 | 0% | - | - |
| prop | 14 | +0.11 | 43% | 50% | - |
| texture | 6 | +0.08 | 0% | 0% | - |
| tile | 4 | +0 | 100% | 100% | +1.33 (3) |
| tileset | 2 | +0 | 50% | - | - |
| ui-icon | 1 | +0 | 0% | 0% | - |
| viewmodel | 1 | +0 | 0% | - | - |

## Model / effort by stage

| Stage | Mappings (passes, mean Δ, Δ per 1k tok) | Recommendation |
|---|---|---|
| base | default/default (51, +5.18, 4.254) | one mapping recorded (default/default, 51 passes): nothing to compare yet |
| revise | default/default (113, +0.61, 0.506) | one mapping recorded (default/default, 113 passes): nothing to compare yet |
| finish | default/default (69, +0.08, 0.073) | one mapping recorded (default/default, 69 passes): nothing to compare yet |
| review | default (233, -, -) | blind re-scores sit 1.33 under the pipeline's own on average over 3 finals: a stronger reviewer model (or effort) is worth a try |

## Notes

- experiment: the finish stage gains least per pass (0.08) — run its passes on a smaller model or lower effort for the next 6 assets (artgen.config.json models.finish = { "model": "…", "effort": "low" }), then compare here
- character: the user sent back 60% of finished assets — raise this kind's bar (one more revision, or hero tier) or read the feedback notes for a common cause
- creature: the first finishing pass adds 0 on average — check what the finish template does for this kind
- effect: the first finishing pass adds 0 on average — check what the finish template does for this kind
- tile: the first finishing pass adds 0 on average — check what the finish template does for this kind
- tile: 100% of assets needed a second finish — the first finish leaves visible problems
- tile: the user sent back 100% of finished assets — raise this kind's bar (one more revision, or hero tier) or read the feedback notes for a common cause
- tile: blind re-scores sit 1.33 under the pipeline's own over 3 finals — the in-pipeline reviewer is generous on this kind

## Config patch

`artgen analytics --across … --apply` merges this into art/artgen.config.json:

```json
{
  "budget": {
    "perKind": {
      "character": {
        "maxImageTokensPerAsset": 11000
      },
      "creature": {
        "maxImageTokensPerAsset": 20000
      },
      "effect": {
        "revisionPasses": 4,
        "maxImageTokensPerAsset": 9500
      },
      "prop": {
        "revisionPasses": 4,
        "maxImageTokensPerAsset": 4500
      },
      "texture": {
        "revisionPasses": 2,
        "maxImageTokensPerAsset": 12000
      }
    }
  }
}
```
