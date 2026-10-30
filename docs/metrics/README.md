# Metrics baseline

`baseline.json` holds the numbers the later phases of [`../TOOLING-PLAN.md`](../TOOLING-PLAN.md) are compared against
(R0). The KPIs are the ones in §11 of the plan.

| Section | What it holds | Deterministic |
|---|---|---|
| `ledgerKpis` | passes, tokens and minutes per scored asset (by kind), first-pass approval rate, blind-score gap, gate failures by check. Per ledger, for the bench, for the example game repos, and pooled | yes |
| `timings` | seconds for each CI step and for each package's tests (one run, 4 CPUs) | no: expect tens of percent of variation |
| `sizes` | bytes of the dist bundles and the web build (the 10 MB OpenCV asset the web tools used before R5b is listed apart in the baseline; the build no longer has one) | yes, for a given build |
| `boundaries` | imports that break the layer rules in `scripts/check-boundaries.mjs` | yes |
| `fixtures`, `interfaces` | consumer fixture cases; MCP tool count | yes |
| `notReportedYet` | KPIs that need a later phase before they can be measured | — |

How the ledger numbers are counted:

- *Scored asset*: an asset with at least one score record. *Approved asset*: one with an `approve` ledger line.
- *Tokens*: generated code, measured input, review-image estimate and agent input, summed over the asset's passes.
- *Minutes*: the recorded wall time of the asset's passes (generation and render), not a person's time. A pass longer
  than 30 minutes is a pause between sessions and is left out.
- *First-pass approval*: approved with no user feedback on the asset.

Read the caveats in the file before using a number: the example repos were approved by a simulated user, the bench has no
approvals, and most scores are self-scores.

Refresh:

```bash
npm run metrics:baseline
```

```bash
npm run build && npm run build:dist && node scripts/metrics-baseline.mjs --time
```

The first command refreshes the ledger numbers, sizes and boundary count and keeps the recorded timings. The second
re-measures timings too (about 5 minutes) and needs the builds to exist. Change the file in the same pull request that
changes a phase's numbers, so the comparison is in the diff.

## Pooled metrics from several repos (R4)

`baseline.json` is measured from this repo's own ledgers. Metrics from game repos arrive another way: each repo runs `artgen metrics
export`, which writes `art/metrics/<artgen version>.json` (counts and ratios only: assets, approved, passes, tokens, minutes, scores,
first-pass approval, gate checks that failed, per kind; no images, ids, notes or paths; the person reads the file first). Files that
repos send in go into [`pool/`](pool/), and one command puts them side by side per artgen version:

```bash
npm run metrics:pool
```

That writes [`pool/POOL.md`](pool/POOL.md): per artgen version, the repos, assets, approved assets, tokens and minutes per approved
asset, first-pass approval and the gate checks that fail most. A release made production cheaper when a later version shows fewer
tokens per approved asset for the same kinds of asset. (`artgen analytics --across <root>,<root>…` pools the ledgers themselves, for
tuning budgets; the export is for comparing versions, and works without the ledgers leaving the repo.)

The three files in `pool/` today are exports of this repo's example games (`examples/`), made with the sources (`dev`) from ledgers
that older versions wrote, and they stand for the mechanism: the first real consumer export replaces them.

### Schema 2: every generator (R5)

From R5 the export is schema 2. It gains `generators`: the same fields for pixel art (`art`) and for each kind of map that has any
(`map`, `dungeon`, `settlement`): subjects, how many were started, reached final, were approved, passes per approved subject
(art: scored passes; maps: versions), first-pass approval (approved with no user feedback), user feedback notes, review image
tokens, written tokens, minutes, and the checks that failed by id. The ledger is the source; map ids never leave the repo. The art
fields (`assets`, `byKind`, `passes`, `totals`, `firstPassApproval`, `userRevisionRate`, `gateFailures`, `blind`) are there only when the art
module is installed, so a maps-only repo exports `generators` and `maps` alone. `metrics export` and `metrics pool` belong to the
`core` module for that reason. `metrics pool` reads schemas 1 and 2 together and adds a per-generator table for the schema 2 exports;
the pool of schema 1 exports reads as before. `artgen analytics` shows the same table (Generators) once the ledger holds map work.

### Stage gates and time to the game (R6a)

With stage gates ([`../STAGES.md`](../STAGES.md)) the art numbers gain two optional fields, still schema 2. They are in the art
fields and in `generators.art`, and are absent until the ledger holds something to count:

- `gates`: per gated stage (`placeholder`, `shape`), how many times the user approved and rejected it (`{ "shape": { "approved": 5, "rejected": 2 } }`),
  from the `stage` ledger entries that carry a verdict.
- `firstInGameMinutes`: the median, over assets with any export, of the minutes from the asset's first ledger entry to its first `export`
  entry. A placeholder export (`export --placeholders`) counts, so this is the KPI "time to the first placeholder in the game".
  With an even number of assets the upper middle value is taken.

A user's stage reject counts as user feedback: an asset the user sent back at the shape gate is not approved at the first pass
(`firstPassApproval.untouched`, `feedback`).
