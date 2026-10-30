/**
 * Stages of an asset (docs/STAGES.md §4): the named steps a version passes through, their keys (a short digest of each
 * stage's output, so a revision that kept a stage's result keeps its key) and the gates the user passes. Pure over the
 * ledger; the pixel-art engine computes the keys, the CLI records them.
 */
import type { LedgerEntry } from './ledger.ts';

export const STAGES = ['placeholder', 'shape', 'rig', 'decorate', 'decal', 'lighting', 'rotation', 'animation'] as const;
export type StageId = (typeof STAGES)[number];
/** The stages the user can gate in R6. */
export const GATEABLE = ['placeholder', 'shape'] as const;
export type GateStage = (typeof GATEABLE)[number];
/** Stage keys of one version: a short digest per stage; absent = the stage does not apply (not rigged, no decals…). */
export type StageKeys = Partial<Record<StageId, string>>;

export const isGateStage = (s: unknown): s is GateStage => (GATEABLE as readonly string[]).includes(s as string);

/** The gates of one brief: its own `gates`, else `review.gates[kind]`, else `review.gates['*']`, else none. */
export function gatesFor(cfg: Record<string, GateStage[]> | undefined, brief: { kind: string; gates?: GateStage[] }): GateStage[] {
  return brief.gates ?? cfg?.[brief.kind] ?? cfg?.['*'] ?? [];
}

/** A stage verdict in the ledger (`type: 'stage'`). */
export interface StageVerdict { stage: GateStage; verdict: 'approve' | 'reject'; key: string; version?: string; note?: string; ts?: string }

/** Stage verdicts, oldest first (entries without a verdict, like the `written` record of a placeholder, are left out). */
export function stageVerdicts(ledger: LedgerEntry[], stage?: GateStage): StageVerdict[] {
  const out: StageVerdict[] = [];
  for (const e of ledger) {
    if (e.type !== 'stage' || (e.verdict !== 'approve' && e.verdict !== 'reject') || !isGateStage(e.stage) || (stage && e.stage !== stage)) continue;
    out.push({
      stage: e.stage, verdict: e.verdict, key: typeof e.key === 'string' ? e.key : '', ...(e.version && { version: e.version }),
      ...(typeof e.note === 'string' && e.note && { note: e.note }), ...(e.ts && { ts: e.ts }),
    });
  }
  return out;
}

/** The latest verdict on `stage`; `approvedKey` is the key of the latest approve (undefined when the latest verdict is a reject). */
export function stageState(ledger: LedgerEntry[], stage: GateStage): { latest?: StageVerdict; approvedKey?: string } {
  const latest = stageVerdicts(ledger, stage).pop();
  return { ...(latest && { latest }), ...(latest?.verdict === 'approve' && { approvedKey: latest.key }) };
}

/** Compare two key sets stage by stage: same / changed / added / removed (`n/a` when neither has the stage). */
export function diffStageKeys(a: StageKeys, b: StageKeys): Record<StageId, 'same' | 'changed' | 'added' | 'removed' | 'n/a'> {
  return Object.fromEntries(STAGES.map(s => [s, a[s] === undefined ? (b[s] === undefined ? 'n/a' : 'added') : b[s] === undefined ? 'removed' : a[s] === b[s] ? 'same' : 'changed'])) as Record<StageId, 'same' | 'changed' | 'added' | 'removed' | 'n/a'>;
}
