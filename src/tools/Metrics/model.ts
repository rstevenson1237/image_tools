/**
 * The metrics dashboard's numbers (R8, docs/TOOLING-PLAN.md §11): the KPIs of this repo, where the time goes, and the trend between
 * artgen versions in the pooled exports. Pure, so it is tested without a page; `index.svelte` only draws it.
 */
import { METRICS_SCHEMA, type AnalyticsReport, type GeneratorMetrics, type MetricsExport, type VersionPool } from 'artgen-core';

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;
const pct = (v: number | undefined): string => (v === undefined ? '–' : `${Math.round(v * 100)}%`);

export interface Kpi {
  id: string;
  label: string;
  value: string;
  /** What the number is over, so a bare 0.5 is never alone. */
  hint: string;
  /** Which way is better, for the arrow beside a trend. */
  better: 'lower' | 'higher';
}

/** The §11 KPIs a repo can show from its own ledger: one list per generator that has subjects. */
export function kpisOf(generators: Record<string, GeneratorMetrics>): Record<string, Kpi[]> {
  const out: Record<string, Kpi[]> = {};
  for (const [name, g] of Object.entries(generators)) {
    if (!g.subjects) continue;
    const approved = g.approved, tokens = g.outTokens + g.imageTokens;
    const gates = Object.entries(g.gates ?? {}), fails = Object.entries(g.checkFailures).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
    out[name] = [
      { id: 'passes', label: 'Passes per approved', value: g.passesPerApproved === undefined ? '–' : String(round(g.passesPerApproved, 1)), hint: `${approved} approved of ${g.subjects}`, better: 'lower' },
      { id: 'tokens', label: 'Tokens per approved', value: approved ? String(Math.round(tokens / approved)) : '–', hint: 'written code plus review images', better: 'lower' },
      { id: 'minutes', label: 'Minutes per approved', value: approved ? String(round(g.wallMinutes / approved, 1)) : '–', hint: `${round(g.wallMinutes, 1)} minutes in all`, better: 'lower' },
      { id: 'first', label: 'First-pass approval', value: pct(g.firstPassApproval.rate), hint: `${g.firstPassApproval.untouched} of ${g.firstPassApproval.approved} approved with no feedback`, better: 'higher' },
      { id: 'gate', label: 'Checks failing most', value: fails.length ? fails.map(([c, n]) => `${c} ×${n}`).join(', ') : '–', hint: 'top three, over every review, score and render', better: 'lower' },
      ...(name === 'art' && gates.length ? [{ id: 'stage-gates', label: 'Stage gates', value: gates.map(([s, v]) => `${s} ${v.approved}✓ ${v.rejected}✗`).join(', '), hint: 'your verdicts on the gated stages', better: 'higher' as const }] : []),
      ...(name === 'art' && g.firstInGameMinutes !== undefined ? [{ id: 'first-in-game', label: 'Time to first export', value: `${round(g.firstInGameMinutes, 1)} min`, hint: 'median, a placeholder export counts', better: 'lower' as const }] : []),
    ];
  }
  return out;
}

export interface TimeRow { pass: string; minutes: number; share: number }

/** Where the wall-clock time went, by kind of pass (`r1`, `r2`, `finish`, …), longest first. Passes with no recorded time are left out. */
export function whereTimeGoes(report: AnalyticsReport): TimeRow[] {
  const rows = report.passes.filter(p => p.meanWallS !== undefined).map(p => ({ pass: p.pass, minutes: round((p.meanWallS! * p.n) / 60, 1) })).filter(r => r.minutes > 0);
  const total = rows.reduce((n, r) => n + r.minutes, 0);
  return rows.map(r => ({ ...r, share: total ? r.minutes / total : 0 })).sort((a, b) => b.minutes - a.minutes || a.pass.localeCompare(b.pass));
}

/** An export file the user dropped in: JSON of schema 1 or 2 with a repo name, else the reason it was refused (the CLI's wording). */
export function parseExportFile(name: string, text: string): MetricsExport {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new Error(`${name}: not JSON`); }
  const e = j as Partial<MetricsExport>;
  if ((e?.schema !== 1 && e?.schema !== METRICS_SCHEMA) || typeof e.repo !== 'string' || typeof e.artgen !== 'string') throw new Error(`${name}: not an artgen metrics export (schema 1 or ${METRICS_SCHEMA})`);
  return e as MetricsExport;
}

export interface TrendRow { artgen: string; repos: number; assets: number; approved: number; tokensPerApproved?: number; minutesPerApproved?: number; firstPassApprovalRate?: number; topGateFailures: VersionPool['topGateFailures']; tokensChange?: number }

/** The pooled versions oldest first, each with the change in tokens per approved asset since the version before it that had a number (negative: the release made production cheaper). */
export function trendRows(versions: VersionPool[]): TrendRow[] {
  let last: number | undefined;
  return versions.map(v => {
    const change = v.tokensPerApproved !== undefined && last !== undefined && last > 0 ? round((v.tokensPerApproved - last) / last, 3) : undefined;
    if (v.tokensPerApproved !== undefined) last = v.tokensPerApproved;
    return { artgen: v.artgen, repos: v.repos.length, assets: v.assets, approved: v.approved, tokensPerApproved: v.tokensPerApproved, minutesPerApproved: v.wallMinutesPerApproved, firstPassApprovalRate: v.firstPassApprovalRate, topGateFailures: v.topGateFailures, ...(change !== undefined && { tokensChange: change }) };
  });
}
