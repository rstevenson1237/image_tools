/**
 * The pixel-art numbers of a metrics export (`Ctx.artMetrics`, docs/WORKFLOW.md §9.3): assets, passes, tokens, minutes, first-pass
 * approval, gate failures per kind, and the `art` row of `generators`. Art module only: it reads the briefs and the pass records,
 * which the maps-only bundle does not have.
 */
import { analytics, generatorMetrics, passRecords, type LedgerEntry } from 'artgen-core';
import type { Project } from '../projectfs.ts';
import { ledgerSet } from '../w2.ts';
import type { ArtMetrics } from './metrics.ts';

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;

export function artMetricsOf(p: Project): ArtMetrics {
  const set = ledgerSet(p.root), ledger = set.ledger, report = analytics(ledger, set.metas);
  const ids = new Set(set.metas.map(m => m.id));
  const approved = new Set(ledger.filter(e => e.type === 'approve' && ids.has(e.asset)).map(e => e.asset));
  const userFeedback = new Set(ledger.filter(e => e.type === 'feedback' && e.by !== 'agent').map(e => e.asset));
  const untouched = [...approved].filter(a => !userFeedback.has(a)).length;
  const finals = report.perAsset.filter(a => a.final !== undefined).length;
  const gateFailures: Record<string, number> = {};
  for (const e of ledger as LedgerEntry[]) for (const c of e.conformance?.checks ?? []) if (c.status === 'fail') gateFailures[c.id] = (gateFailures[c.id] ?? 0) + 1;
  const recs = passRecords(ledger);
  const wall = (rs: typeof recs) => round(rs.reduce((n, r) => n + (r.wallMs ?? 0), 0) / 60_000, 1);
  return {
    assets: { total: set.metas.length, final: finals, approved: approved.size },
    byKind: Object.fromEntries(report.byGroup.kind.map(g => [g.key, { assets: g.n, meanFinal: g.meanFinal, meanPasses: g.meanPasses, meanCost: g.meanCost }])),
    passes: report.passes.map(x => ({ pass: x.pass, n: x.n, meanDelta: x.meanDelta, regressed: x.regressed, gatePass: x.gatePass, outTokens: x.outTokens, imageTokens: x.imageTokens, ...(x.meanWallS !== undefined && { wallMinutes: round((x.meanWallS * x.n) / 60, 1) }) })),
    totals: { outTokens: report.totals.outTokens, inTokens: report.totals.inTokens, imageTokens: report.totals.imageTokens, cost: round(report.totals.cost, 2), wallMinutes: wall(recs) },
    firstPassApproval: { approved: approved.size, untouched, rate: approved.size ? round(untouched / approved.size) : undefined },
    userRevisionRate: report.userRevisionRate.rate,
    gateFailures,
    blind: { n: report.review.blind.n, meanGap: report.review.blind.meanGap },
    generators: generatorMetrics(ledger, set.metas.map(m => ({ generator: 'art', key: m.id }))),
  };
}
