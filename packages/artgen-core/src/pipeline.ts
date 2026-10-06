/**
 * Pass state machine (SPEC §6.3, R1, R12; D12): v1 → v2 → v3 (each reviewed and scored) → finishing pass on the
 * best-scoring base → ready for the user. Pure logic over the files present and the ledger; the CLI does the I/O.
 */
import type { LedgerEntry } from './qa/ledger.ts';

export interface Version { name: string; kind: 'base' | 'finish'; n: number }

/** `base.v3` → { kind: 'base', n: 3 }; also accepts file names (`base.v3.js`). */
export function parseVersion(s: string): Version | null {
  const m = s.match(/^(base|finish)\.v(\d+)(?:\.js)?$/);
  return m ? { name: `${m[1]}.v${m[2]}`, kind: m[1] as 'base' | 'finish', n: +m[2] } : null;
}

/** Ledger pass id for a version: base.v1..vN → r1..rN, later bases → u1.., finish.v1 → f, later finishes → f2... */
export function passId(version: string, revisionPasses: number): string {
  const v = parseVersion(version);
  if (!v) throw new Error(`not a pipeline version: ${version}`);
  if (v.kind === 'finish') return v.n === 1 ? 'f' : `f${v.n}`;
  return v.n <= revisionPasses ? `r${v.n}` : `u${v.n - revisionPasses}`;
}

export type NextStep =
  | { action: 'write-base'; version: string; pass: string; from?: string; why: string }
  | { action: 'review'; version: string; pass: string; why: string }
  | { action: 'write-finish'; version: string; pass: string; base: string; why: string }
  | { action: 'ready'; final: string; best: string; why: string };

export interface PassRow { version: string; pass: string; score?: number; gate?: boolean; base?: string }

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
}

/** Latest score (and gate result) per version from the ledger. */
export function latestScores(ledger: LedgerEntry[]): Map<string, { score: number; gate?: boolean }> {
  const m = new Map<string, { score: number; gate?: boolean }>();
  for (const e of ledger) if (e.type === 'score' && e.version && typeof e.score === 'number') m.set(e.version, { score: e.score, gate: e.conformance?.pass });
  return m;
}

export function planPasses(input: PlanInput): PassState {
  const { asset, revisionPasses: N, finishPass } = input;
  const vs = input.versions.map(parseVersion).filter((v): v is Version => !!v);
  const bases = vs.filter(v => v.kind === 'base').sort((a, b) => a.n - b.n), finishes = vs.filter(v => v.kind === 'finish').sort((a, b) => a.n - b.n);
  const scores = latestScores(input.ledger);
  const rows: PassRow[] = [...bases, ...finishes].map(v => ({
    version: v.name, pass: passId(v.name, N), score: scores.get(v.name)?.score, gate: scores.get(v.name)?.gate,
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
  if (unscored) return state({ action: 'review', version: unscored.name, pass: passId(unscored.name, N), why: 'render it, build the review sheet (v(n−1) beside v(n)), score it' });
  for (let i = 1; i <= N; i++) {
    if (bases.some(b => b.n === i)) continue;
    const from = bestOf(i - 1);
    return state({
      action: 'write-base', version: `base.v${i}`, pass: `r${i}`, from: from?.version,
      why: from ? `revise from the best-scoring version so far, ${from.version} (${from.score}) — R12` : 'first build: T2+ base + procedural pass from the brief and direction',
    });
  }
  const best = bestOf(Infinity)!;
  if (!finishPass) return state({ action: 'ready', final: best.version, best: best.version, why: 'finishing pass disabled by the direction' });
  const lastFinish = finishes[finishes.length - 1];
  if (!lastFinish) return state({ action: 'write-finish', version: 'finish.v1', pass: 'f', base: best.version, why: `one direct-pixel pass on the best base, ${best.version} (${best.score}) — R2, R12` });
  const latestBase = bases[bases.length - 1];
  const bound = input.finishBase?.[lastFinish.name];
  if (bound && latestBase.n > N && bound !== latestBase.name && (parseVersion(bound)?.n ?? 0) < latestBase.n)
    return state({ action: 'write-finish', version: `finish.v${lastFinish.n + 1}`, pass: passId(`finish.v${lastFinish.n + 1}`, N), base: latestBase.name, why: `a user iteration produced ${latestBase.name}; re-finish it` });
  // a revision written after the finish beat its base (e.g. W1 probes finished early, then taken through the full pipeline)
  if (bound && (parseVersion(bound)?.n ?? 0) < parseVersion(best.version)!.n)
    return state({ action: 'write-finish', version: `finish.v${lastFinish.n + 1}`, pass: passId(`finish.v${lastFinish.n + 1}`, N), base: best.version, why: `${best.version} (${best.score}) now beats ${bound}, which ${lastFinish.name} finishes; re-finish the best — R12` });
  return state({ action: 'ready', final: lastFinish.name, best: best.version, why: 'pipeline complete: show the finished asset to the user (approve or give feedback)' });
}
