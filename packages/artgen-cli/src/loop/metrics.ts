/**
 * `artgen metrics export` and `metrics pool` (docs/TOOLING-PLAN.md §5, R4). The export is what one repo contributes to the
 * pool: counts and ratios from the ledger and briefs (assets, passes, tokens, minutes, scores, gate failures, per kind), the
 * artgen version and the installed modules. No images, no ids, no prose, no paths: the person reads the file before it is
 * shared. The pool puts exports from several repos side by side per artgen version, so a release can be judged on whether
 * it made the work cheaper.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { analytics, passRecords, type LedgerEntry } from 'artgen-core';
import type { Project } from '../projectfs.ts';
import { VERSION } from '../version.ts';
import { ledgerSet } from '../w2.ts';

export const METRICS_SCHEMA = 1;

export interface MetricsExport {
  schema: typeof METRICS_SCHEMA;
  /** The repo, as the person named it, else a short hash of its folder name: stable between exports, says nothing about the project. */
  repo: string;
  artgen: string;
  /** Installed modules and their versions (from `tools/artgen/MANIFEST.json`). */
  modules: Record<string, string>;
  /** The day, not the time. */
  exported: string;
  assets: { total: number; final: number; approved: number };
  /** Maps, dungeons and settlements in the repo (the map engines keep no ledger yet). */
  maps: { map: number; dungeon: number; settlement: number };
  byKind: Record<string, { assets: number; meanFinal?: number; meanPasses?: number; meanCost?: number }>;
  passes: { pass: string; n: number; meanDelta?: number; regressed: number; gatePass: number; outTokens: number; imageTokens: number; wallMinutes?: number }[];
  totals: { outTokens: number; inTokens: number; imageTokens: number; cost: number; wallMinutes: number };
  /** Assets approved with no feedback from the user, over all approved. */
  firstPassApproval: { approved: number; untouched: number; rate?: number };
  userRevisionRate?: number;
  /** Gate checks that failed, by check id, over every conformance record. */
  gateFailures: Record<string, number>;
  blind: { n: number; meanGap?: number };
}

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;
const count = (dir: string): number => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).length : 0);

function modulesOf(root: string): Record<string, string> {
  try { return JSON.parse(readFileSync(join(root, 'tools', 'artgen', 'MANIFEST.json'), 'utf8')).modules ?? {}; } catch { return {}; }
}

/** The numbers one repo exports. `name` is how it appears in the pool. */
export function metricsOf(p: Project, o: { name?: string; now?: Date } = {}): MetricsExport {
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
    schema: METRICS_SCHEMA,
    repo: o.name ?? `repo-${createHash('sha256').update(basename(p.root)).digest('hex').slice(0, 8)}`,
    artgen: VERSION, modules: modulesOf(p.root), exported: (o.now ?? new Date()).toISOString().slice(0, 10),
    assets: { total: set.metas.length, final: finals, approved: approved.size },
    maps: { map: count(join(p.art, 'maps')), dungeon: count(join(p.art, 'dungeons')), settlement: count(join(p.art, 'settlements')) },
    byKind: Object.fromEntries(report.byGroup.kind.map(g => [g.key, { assets: g.n, meanFinal: g.meanFinal, meanPasses: g.meanPasses, meanCost: g.meanCost }])),
    passes: report.passes.map(x => ({ pass: x.pass, n: x.n, meanDelta: x.meanDelta, regressed: x.regressed, gatePass: x.gatePass, outTokens: x.outTokens, imageTokens: x.imageTokens, ...(x.meanWallS !== undefined && { wallMinutes: round((x.meanWallS * x.n) / 60, 1) }) })),
    totals: { outTokens: report.totals.outTokens, inTokens: report.totals.inTokens, imageTokens: report.totals.imageTokens, cost: round(report.totals.cost, 2), wallMinutes: wall(recs) },
    firstPassApproval: { approved: approved.size, untouched, rate: approved.size ? round(untouched / approved.size) : undefined },
    userRevisionRate: report.userRevisionRate.rate,
    gateFailures,
    blind: { n: report.review.blind.n, meanGap: report.review.blind.meanGap },
  };
}

/** Write `art/metrics/<artgen version>.json` (or `out`). */
export function exportMetrics(p: Project, o: { name?: string; out?: string; now?: Date } = {}): { file: string; metrics: MetricsExport } {
  const metrics = metricsOf(p, o), file = resolve(o.out ?? join(p.art, 'metrics', `${metrics.artgen}.json`));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(metrics, null, 2) + '\n');
  return { file, metrics };
}

/** Every `*.json` export under the given files and folders. */
function exportsIn(paths: string[]): MetricsExport[] {
  const out: MetricsExport[] = [];
  const add = (f: string) => {
    let j: unknown;
    try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { throw new Error(`${f}: not JSON`); }
    if ((j as { schema?: number })?.schema !== METRICS_SCHEMA || typeof (j as MetricsExport).repo !== 'string') throw new Error(`${f}: not an artgen metrics export (schema ${METRICS_SCHEMA})`);
    out.push(j as MetricsExport);
  };
  const walk = (x: string): void => {
    if (!existsSync(x)) throw new Error(`${x}: no such file or folder`);
    if (statSync(x).isDirectory()) for (const e of readdirSync(x).sort()) { const f = join(x, e); if (statSync(f).isDirectory() ? e !== 'node_modules' && e !== '.git' : e.endsWith('.json')) walk(f); } else add(x);
  };
  for (const x of paths) walk(x);
  return out;
}

export interface VersionPool {
  artgen: string;
  repos: string[];
  assets: number;
  approved: number;
  /** Tokens (written + review images) per approved asset. */
  tokensPerApproved?: number;
  wallMinutesPerApproved?: number;
  firstPassApprovalRate?: number;
  /** The three gate checks that fail most often. */
  topGateFailures: { check: string; n: number }[];
}
export interface Pool { exports: number; repos: string[]; versions: VersionPool[] }

/** Put exports from several repos side by side per artgen version. Two exports of one repo at one version count once (the latest day wins). */
export function pool(paths: string[]): Pool {
  const all = exportsIn(paths), latest = new Map<string, MetricsExport>();
  for (const e of all) { const k = `${e.repo}\0${e.artgen}`, had = latest.get(k); if (!had || e.exported >= had.exported) latest.set(k, e); }
  const byVersion = new Map<string, MetricsExport[]>();
  for (const e of latest.values()) byVersion.set(e.artgen, [...(byVersion.get(e.artgen) ?? []), e]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const versions = [...byVersion.entries()].map(([artgen, es]): VersionPool => {
    const approved = sum(es.map(e => e.assets.approved)), untouched = sum(es.map(e => e.firstPassApproval.untouched));
    const tokens = sum(es.map(e => e.totals.outTokens + e.totals.imageTokens)), fails: Record<string, number> = {};
    for (const e of es) for (const [c, n] of Object.entries(e.gateFailures)) fails[c] = (fails[c] ?? 0) + n;
    return {
      artgen, repos: es.map(e => e.repo).sort(), assets: sum(es.map(e => e.assets.total)), approved,
      tokensPerApproved: approved ? Math.round(tokens / approved) : undefined, wallMinutesPerApproved: approved ? round(sum(es.map(e => e.totals.wallMinutes)) / approved, 1) : undefined,
      firstPassApprovalRate: approved ? round(untouched / approved) : undefined,
      topGateFailures: Object.entries(fails).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([check, n]) => ({ check, n })),
    };
  }).sort((a, b) => a.artgen.localeCompare(b.artgen, undefined, { numeric: true }));
  return { exports: latest.size, repos: [...new Set([...latest.values()].map(e => e.repo))].sort(), versions };
}

export function poolMarkdown(r: Pool, title = 'artgen pooled metrics'): string {
  const cell = (v: number | undefined) => (v === undefined ? '—' : String(v));
  return [
    `# ${title}`, '', `${r.exports} exports from ${r.repos.length} repo${r.repos.length === 1 ? '' : 's'}: ${r.repos.join(', ') || '—'}.`, '',
    '| artgen | repos | assets | approved | tokens / approved | minutes / approved | first-pass approval | gate checks failing most |', '|---|---|---|---|---|---|---|---|',
    ...r.versions.map(v => `| ${v.artgen} | ${v.repos.length} | ${v.assets} | ${v.approved} | ${cell(v.tokensPerApproved)} | ${cell(v.wallMinutesPerApproved)} | ${cell(v.firstPassApprovalRate)} | ${v.topGateFailures.map(f => `${f.check} ×${f.n}`).join(', ') || '—'} |`),
    '', 'Tokens are written code plus review images. A lower tokens / approved number at a later version is the sign a release made production cheaper; compare versions only when they hold the same kinds of asset.', '',
  ].join('\n');
}
