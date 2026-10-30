/**
 * `artgen metrics export` and `metrics pool` (docs/TOOLING-PLAN.md §5, R4; docs/WORKFLOW.md §9, R5). The export is what one repo
 * contributes to the pool: counts and ratios from the ledger (per generator: pixel art and each kind of map; for art also assets,
 * passes, tokens, minutes, scores, gate failures per kind), the artgen version and the installed modules. No images, no ids, no prose,
 * no paths: the person reads the file before it is shared. The pool puts exports from several repos side by side per artgen version,
 * so a release can be judged on whether it made the work cheaper. This file is in the core module (the maps-only bundle has it); the
 * art numbers come from `Ctx.artMetrics` (`art-metrics.ts`), which only the art module's contexts provide.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { generatorMetrics, SUBJECT_KINDS, subjectKey, type GeneratorMetrics } from 'artgen-core/maps';
import type { Project } from '../projectfs.ts';
import { VERSION } from '../version.ts';
import { listSubjectIds, readLedger } from '../workflow.ts';

export const METRICS_SCHEMA = 2;

/** What the art module adds to an export: the numbers of pixel art, and its row of `generators`. */
export interface ArtMetrics {
  assets: { total: number; final: number; approved: number };
  byKind: Record<string, { assets: number; meanFinal?: number; meanPasses?: number; meanCost?: number }>;
  passes: { pass: string; n: number; meanDelta?: number; regressed: number; gatePass: number; outTokens: number; imageTokens: number; wallMinutes?: number }[];
  totals: { outTokens: number; inTokens: number; imageTokens: number; cost: number; wallMinutes: number };
  /** Assets approved with no feedback from the user, over all approved. */
  firstPassApproval: { approved: number; untouched: number; rate?: number };
  userRevisionRate?: number;
  /** Gate checks that failed, by check id, over every conformance record. */
  gateFailures: Record<string, number>;
  blind: { n: number; meanGap?: number };
  generators: Record<string, GeneratorMetrics>;
}

/** The art numbers of a project (`Ctx.artMetrics`): only the art module has them. */
export type ArtMetricsOf = (p: Project) => ArtMetrics;

export interface MetricsExport extends Partial<Omit<ArtMetrics, 'generators'>> {
  /** 1: the art numbers only; 2: also `generators`, and a repo with no art module has no art numbers. */
  schema: 1 | typeof METRICS_SCHEMA;
  /** The repo, as the person named it, else a short hash of its folder name: stable between exports, says nothing about the project. */
  repo: string;
  artgen: string;
  /** Installed modules and their versions (from `tools/artgen/MANIFEST.json`). */
  modules: Record<string, string>;
  /** The day, not the time. */
  exported: string;
  /** Maps, dungeons and settlements in the repo. */
  maps: { map: number; dungeon: number; settlement: number };
  /** The same fields for every generator that has subjects: `art`, `map`, `dungeon`, `settlement`. */
  generators?: Record<string, GeneratorMetrics>;
}

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;

function modulesOf(root: string): Record<string, string> {
  try { return JSON.parse(readFileSync(join(root, 'tools', 'artgen', 'MANIFEST.json'), 'utf8')).modules ?? {}; } catch { return {}; }
}

/** The numbers one repo exports. `name` is how it appears in the pool; `art` gives the pixel-art numbers (the art module's). */
export function metricsOf(p: Project, o: { name?: string; now?: Date; art?: ArtMetricsOf } = {}): MetricsExport {
  const art = o.art?.(p), { generators: artGenerators, ...artFields } = art ?? ({} as Partial<ArtMetrics>);
  const subjects = SUBJECT_KINDS.flatMap(kind => listSubjectIds(p, kind).map(id => ({ generator: kind as string, key: subjectKey(kind, id) })));
  const count = (kind: (typeof SUBJECT_KINDS)[number]) => subjects.filter(s => s.generator === kind).length;
  const generators = { ...artGenerators, ...generatorMetrics(readLedger(p), subjects) };
  return {
    schema: METRICS_SCHEMA,
    repo: o.name ?? `repo-${createHash('sha256').update(basename(p.root)).digest('hex').slice(0, 8)}`,
    artgen: VERSION, modules: modulesOf(p.root), exported: (o.now ?? new Date()).toISOString().slice(0, 10),
    ...(artFields.assets && { assets: artFields.assets }),
    maps: { map: count('map'), dungeon: count('dungeon'), settlement: count('settlement') },
    ...(artFields.assets && { byKind: artFields.byKind, passes: artFields.passes, totals: artFields.totals, firstPassApproval: artFields.firstPassApproval, userRevisionRate: artFields.userRevisionRate, gateFailures: artFields.gateFailures, blind: artFields.blind }),
    generators,
  };
}

/** Write `art/metrics/<artgen version>.json` (or `out`). */
export function exportMetrics(p: Project, o: { name?: string; out?: string; now?: Date; art?: ArtMetricsOf } = {}): { file: string; metrics: MetricsExport } {
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
    const schema = (j as { schema?: number })?.schema;
    if ((schema !== 1 && schema !== METRICS_SCHEMA) || typeof (j as MetricsExport).repo !== 'string') throw new Error(`${f}: not an artgen metrics export (schema 1 or ${METRICS_SCHEMA})`);
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
  /** Per generator over the schema 2 exports of this version (none for schema 1 exports). */
  generators: Record<string, { subjects: number; approved: number; passesPerApproved?: number; firstPassApprovalRate?: number; imageTokens: number; wallMinutes: number }>;
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
    const art = es.filter(e => e.assets), approved = sum(art.map(e => e.assets!.approved)), untouched = sum(art.map(e => e.firstPassApproval!.untouched));
    const tokens = sum(art.map(e => e.totals!.outTokens + e.totals!.imageTokens)), fails: Record<string, number> = {};
    for (const e of art) for (const [c, n] of Object.entries(e.gateFailures!)) fails[c] = (fails[c] ?? 0) + n;
    const gens: VersionPool['generators'] = {}, byGen = new Map<string, GeneratorMetrics[]>();
    for (const e of es) for (const [g, m] of Object.entries(e.generators ?? {})) byGen.set(g, [...(byGen.get(g) ?? []), m]);
    for (const [g, ms] of [...byGen].sort(([a], [b]) => a.localeCompare(b))) {
      const ap = sum(ms.map(m => m.approved));
      gens[g] = {
        subjects: sum(ms.map(m => m.subjects)), approved: ap, ...(ap && { passesPerApproved: round(sum(ms.map(m => (m.passesPerApproved ?? 0) * m.approved)) / ap), firstPassApprovalRate: round(sum(ms.map(m => m.firstPassApproval.untouched)) / ap) }),
        imageTokens: sum(ms.map(m => m.imageTokens)), wallMinutes: round(sum(ms.map(m => m.wallMinutes)), 1),
      };
    }
    return {
      artgen, repos: es.map(e => e.repo).sort(), assets: sum(art.map(e => e.assets!.total)), approved,
      tokensPerApproved: approved ? Math.round(tokens / approved) : undefined, wallMinutesPerApproved: approved ? round(sum(art.map(e => e.totals!.wallMinutes)) / approved, 1) : undefined,
      firstPassApprovalRate: approved ? round(untouched / approved) : undefined,
      topGateFailures: Object.entries(fails).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([check, n]) => ({ check, n })),
      generators: gens,
    };
  }).sort((a, b) => a.artgen.localeCompare(b.artgen, undefined, { numeric: true }));
  return { exports: latest.size, repos: [...new Set([...latest.values()].map(e => e.repo))].sort(), versions };
}

export function poolMarkdown(r: Pool, title = 'artgen pooled metrics'): string {
  const cell = (v: number | undefined) => (v === undefined ? '—' : String(v));
  const gens = r.versions.flatMap(v => Object.entries(v.generators).map(([g, m]) => ({ artgen: v.artgen, g, ...m })));
  return [
    `# ${title}`, '', `${r.exports} exports from ${r.repos.length} repo${r.repos.length === 1 ? '' : 's'}: ${r.repos.join(', ') || '—'}.`, '',
    '| artgen | repos | assets | approved | tokens / approved | minutes / approved | first-pass approval | gate checks failing most |', '|---|---|---|---|---|---|---|---|',
    ...r.versions.map(v => `| ${v.artgen} | ${v.repos.length} | ${v.assets} | ${v.approved} | ${cell(v.tokensPerApproved)} | ${cell(v.wallMinutesPerApproved)} | ${cell(v.firstPassApprovalRate)} | ${v.topGateFailures.map(f => `${f.check} ×${f.n}`).join(', ') || '—'} |`),
    '', 'Tokens are written code plus review images. A lower tokens / approved number at a later version is the sign a release made production cheaper; compare versions only when they hold the same kinds of asset.', '',
    ...(gens.length ? [
      '## Per generator', '', 'From the exports of schema 2: the same numbers for pixel art and each kind of map.', '',
      '| artgen | generator | subjects | approved | passes / approved | first-pass approval | review image tokens | minutes |', '|---|---|---|---|---|---|---|---|',
      ...gens.map(m => `| ${m.artgen} | ${m.g} | ${m.subjects} | ${m.approved} | ${cell(m.passesPerApproved)} | ${cell(m.firstPassApprovalRate)} | ${m.imageTokens} | ${m.wallMinutes} |`), '',
    ] : []),
  ].join('\n');
}
