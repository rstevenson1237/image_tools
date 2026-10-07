/**
 * Pass state machine (SPEC §6.3, R1, R12; D12): v1 → v2 → v3 (each reviewed and scored) → finishing pass on the
 * best-scoring base → blind re-score of the final by a fresh reviewer (rev 9, when `blind` is set) → ready for the
 * user. Pure logic over the files present and the ledger; the CLI does the I/O.
 */
import type { LedgerEntry } from './qa/ledger.ts';

export interface Version { name: string; kind: 'base' | 'finish'; n: number }

/** `base.v3` → { kind: 'base', n: 3 }; also accepts file names (`base.v3.js`). */
export function parseVersion(s: string): Version | null {
  const m = s.match(/^(base|finish)\.v(\d+)(?:\.js)?$/);
  return m ? { name: `${m[1]}.v${m[2]}`, kind: m[1] as 'base' | 'finish', n: +m[2] } : null;
}

/**
 * Ledger pass id for a version: base.v1..vN → r1..rN, finish.v1 → f, later finishes → f2...
 * Bases after vN are user iterations (`u1..`). When `user` (the versions opened by user feedback) is given, the
 * other bases after vN are extra autonomous revisions (`x1..`, D19) and only the listed ones are `u`.
 */
export function passId(version: string, revisionPasses: number, user?: string[]): string {
  const v = parseVersion(version);
  if (!v) throw new Error(`not a pipeline version: ${version}`);
  if (v.kind === 'finish') return v.n === 1 ? 'f' : `f${v.n}`;
  if (v.n <= revisionPasses) return `r${v.n}`;
  if (!user) return `u${v.n - revisionPasses}`;
  const ub = user.map(parseVersion).filter((u): u is Version => !!u && u.kind === 'base').map(u => u.n).sort((a, b) => a - b);
  const k = ub.indexOf(v.n);
  return k >= 0 ? `u${k + 1}` : `x${v.n - revisionPasses - ub.filter(n => n < v.n).length}`;
}

export type NextStep =
  | { action: 'write-base'; version: string; pass: string; from?: string; why: string }
  | { action: 'review'; version: string; pass: string; why: string }
  | { action: 'write-finish'; version: string; pass: string; base: string; why: string }
  /** A fresh reviewer scores the final from a blind sheet (the final alone: no earlier versions, scores or notes). */
  | { action: 'blind-review'; version: string; pass: 'b'; why: string }
  | { action: 'ready'; final: string; best: string; why: string; /** Failing gate checks on the final (listed when it is marked final). */ issues: string[] };

export interface PassRow { version: string; pass: string; score?: number; gate?: boolean; base?: string }

/**
 * User feedback that opened a U-stage version (`route: base` → a new base, `finish` → a finish revision), with what the
 * user said — typed in Claude Code, or written by the image tools (a note pinned to a region of one cell).
 */
export interface FeedbackOpen { route: 'base' | 'finish'; opens: string; note?: string; region?: number[]; cell?: string }

/** The user's words for a step's `why`: ` — user: "…" (region x,y,w,h of idle/s/0)`. */
const userWords = (f: FeedbackOpen): string => {
  if (!f.note) return '';
  const where = f.region ? ` (region x,y,w,h ${f.region.join(',')}${f.cell ? ` of ${f.cell}` : ''})` : f.cell ? ` (${f.cell})` : '';
  return ` — user: "${f.note}"${where}`;
};

export interface PassState {
  asset: string;
  rows: PassRow[];
  /** Best-scoring base version so far (R12). */
  best?: { version: string; score: number };
  next: NextStep;
}

export interface PlanInput {
  asset: string;
  /** Version names present (`base.v1`, `finish.v1`, …). */
  versions: string[];
  /** Ledger entries for this asset (score entries carry `version` + `score`). */
  ledger: LedgerEntry[];
  revisionPasses: number;
  finishPass: boolean;
  /** Base each finish version is bound to. */
  finishBase?: Record<string, string>;
  /** Extra autonomous revisions allowed when the final still fails the gate (D19 budget). */
  extraRevisions?: number;
  /**
   * User feedback in ledger order. When given (even empty), bases after vN that no feedback opened are extra
   * autonomous revisions (`x1..`); when absent, every base after vN counts as a user iteration (P1b behaviour).
   */
  feedback?: FeedbackOpen[];
  /**
   * Blind re-score (rev 9): the final must also be scored blind (`score --blind`) before it is ready. A blind score under
   * `minScore`, or more than `maxGap` below the final's own score, is an open issue and — while the extra autonomous
   * revision budget lasts — starts one. Finals the user already approved are not asked for one.
   */
  blind?: { minScore: number; maxGap: number };
}

/** Latest blind score per version (`score --blind` records). */
export function blindScores(ledger: LedgerEntry[]): Map<string, { score: number; note?: string; reviewer?: string }> {
  const m = new Map<string, { score: number; note?: string; reviewer?: string }>();
  for (const e of ledger) if (e.type === 'score' && e.blind && e.version && typeof e.score === 'number')
    m.set(e.version, { score: e.score, ...(typeof e.note === 'string' && e.note && { note: e.note }), ...(typeof e.reviewer === 'string' && { reviewer: e.reviewer }) });
  return m;
}

/** Open issues a blind score raises against the final's own score (empty when it holds up). */
export function blindIssues(own: number, blind: { score: number; note?: string } | undefined, o: { minScore: number; maxGap: number }): string[] {
  if (!blind) return [];
  const out: string[] = [], note = blind.note ? `: ${blind.note}` : '';
  if (own - blind.score > o.maxGap) out.push(`blind re-score ${blind.score} vs ${own} (gap ${+(own - blind.score).toFixed(2)})${note}`);
  else if (blind.score < o.minScore) out.push(`blind re-score ${blind.score} is under ${o.minScore}${note}`);
  return out;
}

/** Latest score (and gate result, failing checks) per version from the ledger. */
export function latestScores(ledger: LedgerEntry[]): Map<string, { score: number; gate?: boolean; failing?: string[] }> {
  const m = new Map<string, { score: number; gate?: boolean; failing?: string[] }>();
  for (const e of ledger) if (e.type === 'score' && !e.blind && e.version && typeof e.score === 'number')
    m.set(e.version, { score: e.score, gate: e.conformance?.pass, failing: e.conformance?.checks?.filter(c => c.status === 'fail').map(c => `${c.id}: ${c.detail}`) });
  return m;
}

export function planPasses(input: PlanInput): PassState {
  const { asset, revisionPasses: N, finishPass } = input;
  const vs = input.versions.map(parseVersion).filter((v): v is Version => !!v);
  const bases = vs.filter(v => v.kind === 'base').sort((a, b) => a.n - b.n), finishes = vs.filter(v => v.kind === 'finish').sort((a, b) => a.n - b.n);
  const scores = latestScores(input.ledger), fb = input.feedback, userOpened = fb?.map(f => f.opens);
  const pid = (v: string) => passId(v, N, userOpened);
  const isUserBase = (b: Version) => b.n > N && (!fb || fb.some(f => f.opens === b.name));
  const rows: PassRow[] = [...bases, ...finishes].map(v => ({
    version: v.name, pass: pid(v.name), score: scores.get(v.name)?.score, gate: scores.get(v.name)?.gate,
    ...(v.kind === 'finish' && input.finishBase?.[v.name] && { base: input.finishBase[v.name] }),
  }));
  const bestOf = (upTo: number) => {
    let best: { version: string; score: number } | undefined;
    for (const b of bases) {
      if (b.n > upTo) break;
      const s = scores.get(b.name)?.score;
      if (s !== undefined && (!best || s >= best.score)) best = { version: b.name, score: s }; // ties → the later, more refined version
    }
    return best;
  };
  const state = (next: NextStep): PassState => ({ asset, rows, best: bestOf(Infinity), next });

  // any written but unscored version is reviewed first
  const unscored = [...bases, ...finishes].find(v => !scores.has(v.name));
  if (unscored) return state({ action: 'review', version: unscored.name, pass: pid(unscored.name), why: 'render it, build the review sheet (v(n−1) beside v(n)), score it' });
  for (let i = 1; i <= N; i++) {
    if (bases.some(b => b.n === i)) continue;
    const from = bestOf(i - 1);
    return state({
      action: 'write-base', version: `base.v${i}`, pass: `r${i}`, from: from?.version,
      why: from ? `revise from the best-scoring version so far, ${from.version} (${from.score}) — R12` : 'first build: T2+ base + procedural pass from the brief and direction',
    });
  }
  const best = bestOf(Infinity)!;
  const lastFinish = finishes[finishes.length - 1], bound = lastFinish && input.finishBase?.[lastFinish.name];
  const nextBase = `base.v${(bases[bases.length - 1]?.n ?? 0) + 1}`, nextFinish = `finish.v${(lastFinish?.n ?? 0) + 1}`;
  // user feedback that opened a version not written yet (U stage)
  const open = fb?.filter(f => !vs.some(v => v.name === f.opens)).pop();
  if (open) {
    const shown = bound ?? best.version;
    if (open.route === 'base') return state({ action: 'write-base', version: open.opens, pass: pid(open.opens), from: shown, why: `user feedback (form, proportion, colour): new base from ${shown}, the version the user saw${userWords(open)}` });
    return state({ action: 'write-finish', version: open.opens, pass: pid(open.opens), base: shown, why: `user feedback (pixels): finish revision on ${shown}${userWords(open)}` });
  }
  // the base to finish: the latest user iteration (the user asked for it), else the best-scoring base (R12)
  const userBases = bases.filter(isUserBase), target = userBases.length ? { version: userBases[userBases.length - 1].name, score: scores.get(userBases[userBases.length - 1].name)!.score } : best;
  if (!finishPass) return state({ action: 'ready', final: target.version, best: best.version, issues: scores.get(target.version)?.failing ?? [], why: 'finishing pass disabled by the direction' });
  if (!lastFinish) return state({ action: 'write-finish', version: 'finish.v1', pass: 'f', base: target.version, why: `one direct-pixel pass on the best base, ${target.version} (${target.score}) — R2, R12` });
  if (bound && bound !== target.version && (parseVersion(bound)?.n ?? 0) < parseVersion(target.version)!.n) {
    const why = userBases.some(b => b.name === target.version) ? `a user iteration produced ${target.version}; re-finish it`
      : `${target.version} (${target.score}) now beats ${bound}, which ${lastFinish.name} finishes; re-finish the best — R12`;
    return state({ action: 'write-finish', version: nextFinish, pass: pid(nextFinish), base: target.version, why });
  }
  const fin = scores.get(lastFinish.name)!, extrasUsed = bases.filter(b => b.n > N && !isUserBase(b)).length;
  const canExtra = !userBases.length && extrasUsed < (input.extraRevisions ?? 0);
  if (fin.gate === false && canExtra)
    return state({ action: 'write-base', version: nextBase, pass: pid(nextBase), from: best.version, why: `the final still fails the gate (${(fin.failing ?? []).join('; ') || 'see conformance'}): one extra autonomous revision from ${best.version} (budget)` });
  let blindOpen: string[] = [];
  if (input.blind && !input.ledger.some(e => e.type === 'approve' && e.by === 'user' && e.version === lastFinish.name)) {
    const bl = blindScores(input.ledger).get(lastFinish.name);
    if (!bl) return state({ action: 'blind-review', version: lastFinish.name, pass: 'b', why: 'a fresh reviewer scores the final from the blind sheet (`review --blind`, then `score --blind --reviewer <name>`): self-scores drift upward' });
    blindOpen = blindIssues(fin.score, bl, input.blind);
    if (blindOpen.length && canExtra)
      return state({ action: 'write-base', version: nextBase, pass: pid(nextBase), from: best.version, why: `${blindOpen.join('; ')}: one extra autonomous revision from ${best.version} that fixes what the blind reviewer named (budget)` });
  }
  const issues = [...(fin.gate === false ? fin.failing ?? ['gate failed'] : []), ...blindOpen];
  return state({
    action: 'ready', final: lastFinish.name, best: best.version, issues,
    why: issues.length ? 'pipeline complete with open issues: mark it final and list them for the user' : 'pipeline complete: show the finished asset to the user (approve or give feedback)',
  });
}
