/**
 * The pure half of `artgen metrics` (docs/TOOLING-PLAN.md §5, R4; R8): the shape of an export and the pool that puts exports from
 * several repos side by side per artgen version. No file access, so the CLI (`metrics pool`) and the web dashboard use the same code.
 */
import type { GeneratorMetrics } from './metrics.ts';

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
  /** Stage gates (docs/STAGES.md §5.7): the user's approvals and rejections per gated stage. Absent until a verdict is recorded. */
  gates?: Record<string, { approved: number; rejected: number }>;
  /** Median minutes from an asset's first ledger entry to its first export; a placeholder export counts. */
  firstInGameMinutes?: number;
  generators: Record<string, GeneratorMetrics>;
}


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
export function poolExports(all: readonly MetricsExport[]): Pool {
  const latest = new Map<string, MetricsExport>();
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
