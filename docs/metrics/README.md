# Metrics baseline

`baseline.json` holds the numbers the later phases of [`../TOOLING-PLAN.md`](../TOOLING-PLAN.md) are compared against
(R0). The KPIs are the ones in §11 of the plan.

| Section | What it holds | Deterministic |
|---|---|---|
| `ledgerKpis` | passes, tokens and minutes per scored asset (by kind), first-pass approval rate, blind-score gap, gate failures by check. Per ledger, for the bench, for the example game repos, and pooled | yes |
| `timings` | seconds for each CI step and for each package's tests (one run, 4 CPUs) | no: expect tens of percent of variation |
| `sizes` | bytes of the dist bundles and the web build (the 10 MB OpenCV asset is listed apart) | yes, for a given build |
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
