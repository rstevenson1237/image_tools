/**
 * Metrics every generator provides (docs/WORKFLOW.md §9): the same fields for pixel art (`art`) and for each map kind
 * (`map`, `dungeon`, `settlement`), computed from the ledger. Pure over the entries.
 */
import type { LedgerEntry } from './ledger.ts';
import { subjectStatus } from './status.ts';

export interface GeneratorMetrics {
  /** Assets or maps of this generator in the repo. */
  subjects: number;
  /** With at least one version (art: a scored pass; maps: a version entry). */
  started: number;
  /** Reached final at least once (art: a final status entry or an approval; maps: an approval or currently final). */
  final: number;
  /** With an approval. */
  approved: number;
  /** Art: score entries; maps: version entries, per approved subject. */
  passesPerApproved?: number;
  /** `untouched`: approved with no user feedback. */
  firstPassApproval: { approved: number; untouched: number; rate?: number };
  /** User feedback entries. */
  feedback: number;
  /** Review images. */
  imageTokens: number;
  outTokens: number;
  wallMinutes: number;
  /** Check id → count of failing checks on review, score and render entries. */
  checkFailures: Record<string, number>;
  /** Art with stage gates (docs/STAGES.md §5.7): the user's approvals and rejections per gated stage. Absent until a verdict is recorded. */
  gates?: Record<string, { approved: number; rejected: number }>;
  /** Art: the median minutes from an asset's first ledger entry to its first export (a placeholder export counts), over assets with an export. */
  firstInGameMinutes?: number;
}

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Score entries that count: the latest of each version, blind re-scores left out (the pass records' rule). */
function latestScores(entries: LedgerEntry[]): LedgerEntry[] {
  const latest = new Map<string, LedgerEntry>();
  for (const e of entries) if (e.type === 'score' && !e.blind && e.version) latest.set(e.version, e);
  return [...latest.values()];
}

/** The numbers of one generator over its subjects (`key` is the ledger key: a brief id, or `map:keep`). */
function metricsFor(generator: string, keys: string[], byKey: Map<string, LedgerEntry[]>): GeneratorMetrics {
  const art = generator === 'art';
  let started = 0, final = 0, approved = 0, untouched = 0, feedback = 0, imageTokens = 0, outTokens = 0, wallMs = 0, passes = 0;
  const checkFailures: Record<string, number> = {}, gates: Record<string, { approved: number; rejected: number }> = {}, toGame: number[] = [];
  for (const key of keys) {
    const es = byKey.get(key) ?? [], scores = latestScores(es);
    // a stage reject by the user is the user asking for a change: it counts as feedback (docs/STAGES.md §5.7)
    const approves = es.some(e => e.type === 'approve'), fb = es.filter(e => (e.type === 'feedback' && e.by !== 'agent') || (art && e.type === 'stage' && e.verdict === 'reject' && e.by === 'user')).length;
    if (art) {
      for (const e of es) if (e.type === 'stage' && (e.verdict === 'approve' || e.verdict === 'reject') && typeof e.stage === 'string') {
        const g = (gates[e.stage] ??= { approved: 0, rejected: 0 });
        if (e.verdict === 'approve') g.approved++; else g.rejected++;
      }
      const first = Date.parse(es[0]?.ts ?? ''), exp = es.find(e => e.type === 'export'), at = Date.parse(exp?.ts ?? '');
      if (exp && Number.isFinite(first) && Number.isFinite(at)) toGame.push(Math.max(0, at - first) / 60_000);
    }
    if (art ? scores.length : es.some(e => e.type === 'version')) started++;
    if (approves || (art ? es.some(e => e.type === 'status' && e.status === 'final') : subjectStatus({ entries: es }).status === 'final')) final++;
    feedback += fb;
    if (approves) { approved++; if (!fb) untouched++; passes += art ? scores.length : es.filter(e => e.type === 'version').length; }
    for (const e of es) {
      if (e.type === 'review') imageTokens += num(e.imageTokens);
      if (e.type === 'review' || e.type === 'score' || e.type === 'render') for (const c of e.conformance?.checks ?? []) if (c.status === 'fail') checkFailures[c.id] = (checkFailures[c.id] ?? 0) + 1;
      if (e.type !== 'score') wallMs += num(e.wallMs);
    }
    for (const e of scores) {
      const tk = (e.tokens ?? {}) as { edit?: number; out?: number };
      outTokens += num(tk.out ?? tk.edit); wallMs += num(e.wallMs);
    }
  }
  return {
    subjects: keys.length, started, final, approved, ...(approved && { passesPerApproved: round(passes / approved) }),
    firstPassApproval: { approved, untouched, ...(approved && { rate: round(untouched / approved) }) },
    feedback, imageTokens, outTokens, wallMinutes: round(wallMs / 60_000, 1), checkFailures,
    ...(Object.keys(gates).length && { gates }), ...(toGame.length && { firstInGameMinutes: round([...toGame].sort((a, b) => a - b)[toGame.length >> 1], 1) }),
  };
}

/** Metrics per generator. `subjects` lists every subject there is (including those with no ledger line yet). */
export function generatorMetrics(ledger: LedgerEntry[], subjects: { generator: string; key: string }[]): Record<string, GeneratorMetrics> {
  const byKey = new Map<string, LedgerEntry[]>();
  for (const e of ledger) { const es = byKey.get(e.asset); if (es) es.push(e); else byKey.set(e.asset, [e]); }
  const gens = new Map<string, string[]>();
  for (const s of subjects) { const ks = gens.get(s.generator); if (ks) ks.push(s.key); else gens.set(s.generator, [s.key]); }
  return Object.fromEntries([...gens].map(([g, keys]) => [g, metricsFor(g, keys, byKey)]));
}

/** The Generators table of the analytics report: one row per generator, the same columns for art and for each map kind. */
export function generatorsMarkdown(g: Record<string, GeneratorMetrics>): string {
  const cell = (v: number | undefined) => (v === undefined ? '-' : String(v));
  let md = '\n## Generators\n\nThe same numbers for every generator: pixel art (`art`) and each kind of map, from the ledger.\n\n| Generator | Subjects | Started | Final | Approved | Passes per approved | First-pass approval | Feedback | Review tok | Minutes |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for (const [name, m] of Object.entries(g)) md += `| ${name} | ${m.subjects} | ${m.started} | ${m.final} | ${m.approved} | ${cell(m.passesPerApproved)} | ${cell(m.firstPassApproval.rate)} | ${m.feedback} | ${m.imageTokens} | ${m.wallMinutes} |\n`;
  const fails = Object.entries(g).flatMap(([name, m]) => Object.entries(m.checkFailures).map(([id, n]) => ({ name, id, n }))).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, 5);
  return fails.length ? `${md}\nChecks failing most: ${fails.map(f => `${f.name} ${f.id} x${f.n}`).join(', ')}.\n` : md;
}
