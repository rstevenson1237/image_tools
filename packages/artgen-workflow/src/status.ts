/**
 * Asset status lifecycle (SPEC §5.2), derived from the ledger and the pass state — never stored as the truth:
 *
 *   brief → in-pipeline (v1..v3, finish) → final → approved → exported
 *   revision   the user asked for changes; back in the pipeline (U stage)
 *   stale      approved or exported, then the direction version or the final's sources changed
 *
 * The agent moves assets through the pipeline; only `approved` and `revision` come from the user (D10). An approval
 * records the final version, its source hash (base + finish) and the direction version.
 */
import type { LedgerEntry } from './ledger.ts';
import { nextVersion } from './versions.ts';
import { parseSubjectKey } from './subject.ts';

export const STATUSES = ['brief', 'in-pipeline', 'final', 'approved', 'exported', 'revision', 'stale'] as const;
export type AssetStatus = (typeof STATUSES)[number];

/** The part of the pass machine's next step the status reads (`NextStep` of the artgen layer is assignable to it). */
export type StepLike = { action: string; version?: string; final?: string; issues?: string[]; [extra: string]: unknown };

export interface StatusInput {
  /** Ledger entries for this asset, in file order. */
  ledger: LedgerEntry[];
  /** Pass machine's next step, or undefined when the asset has no versions yet. */
  next?: StepLike;
  /** Locked direction now. */
  direction: { id: string; version: number };
  /** Source hash of the current final (base + finish sources), when the pipeline is ready. */
  finalHash?: string;
}

export interface StatusResult {
  status: AssetStatus;
  final?: string;
  issues: string[];
  why: string;
  approval?: LedgerEntry;
  export?: LedgerEntry;
}

const lastIndex = <T>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };

export function assetStatus({ ledger, next, direction, finalHash }: StatusInput): StatusResult {
  if (!next) return { status: 'brief', issues: [], why: 'no versions yet' };
  const iFeedback = lastIndex(ledger, e => e.type === 'feedback' && e.by === 'user');
  const iApprove = lastIndex(ledger, e => e.type === 'approve' && e.by === 'user');
  if (next.action !== 'ready') {
    const revising = iFeedback >= 0 && iFeedback > iApprove;
    return { status: revising ? 'revision' : 'in-pipeline', issues: [], why: `${next.action} ${next.version ?? ''}`.trim() };
  }
  const final = next.final, issues = next.issues ?? [];
  const approval = iApprove >= 0 ? ledger[iApprove] : undefined;
  if (!approval || iFeedback > iApprove || approval.version !== final || (finalHash && approval.sourceHash !== finalHash)) {
    // an approved asset whose final changed under it: restyle re-renders → back to the user as `final`
    return { status: 'final', final, issues, why: approval && iFeedback < iApprove ? `approved ${approval.version} changed since (re-review)` : 'finished; waiting for the user to approve or give feedback' };
  }
  const iExport = lastIndex(ledger, e => e.type === 'export' && e.version === final);
  const exp = iExport > iApprove ? ledger[iExport] : undefined;
  if (approval.direction?.version !== direction.version || approval.direction?.id !== direction.id) {
    const iRestyle = lastIndex(ledger, e => e.type === 'restyle' && (e.direction as { version?: number } | undefined)?.version === direction.version);
    const restyled = iRestyle > iApprove;
    // a restyle that changed no pixel carries the approval over (nothing new for the user to see)
    if (restyled && ledger[iRestyle].changedPct === 0) {
      const iExp2 = lastIndex(ledger, e => e.type === 'export' && e.version === final && (e.direction as { version?: number } | undefined)?.version === direction.version);
      if (iExp2 > iRestyle) return { status: 'exported', final, issues, approval, export: ledger[iExp2], why: `in pack ${String(ledger[iExp2].pack ?? '')} (approval carried over a no-change restyle)` };
      return { status: 'approved', final, issues, approval, why: `restyled to direction v${direction.version} with no pixel change; approval carried over` };
    }
    return restyled
      ? { status: 'final', final, issues, approval, why: `restyled to direction v${direction.version}; re-approve` }
      : { status: 'stale', final, issues, approval, export: exp, why: `approved under direction v${approval.direction?.version}, now v${direction.version}: run restyle` };
  }
  if (exp) {
    if (exp.sourceHash && finalHash && exp.sourceHash !== finalHash) return { status: 'stale', final, issues, approval, export: exp, why: 'sources changed since export' };
    return { status: 'exported', final, issues, approval, export: exp, why: `in pack ${String(exp.pack ?? '')}`.trim() };
  }
  return { status: 'approved', final, issues, approval, why: 'approved; ready to export' };
}

// ---- subjects (docs/WORKFLOW.md §6)

export interface SubjectStatusInput {
  /** That subject's ledger lines, in file order. */
  entries: LedgerEntry[];
  /** Hash of the working file now (`sourceHash` of its text). Unset: it is taken to equal the latest version. */
  workingHash?: string;
  /** The locked map direction now, if there is one. */
  direction?: { id: string; version: number };
}

export interface SubjectStatusResult {
  status: AssetStatus;
  /** The latest version. */
  version?: string;
  approval?: LedgerEntry;
  why: string;
}

/**
 * Status of a map, dungeon or settlement, in the art status names so Asset Review groups them with assets. Derived from the
 * ledger and the working file, never stored. Only the user approves or gives feedback; versions come from the agent or the
 * user.
 */
export function subjectStatus({ entries, workingHash, direction }: SubjectStatusInput): SubjectStatusResult {
  const iV = lastIndex(entries, e => e.type === 'version');
  if (iV < 0) {
    const k = entries[0] && parseSubjectKey(entries[0].asset);
    return { status: 'in-pipeline', why: `no version recorded yet${k ? `: artgen ${k.kind} version ${k.id}` : ''}` };
  }
  const V = entries[iV], v = String(V.version);
  const iApprove = lastIndex(entries, e => e.type === 'approve' && e.by === 'user' && e.version === v);
  const iFeedback = lastIndex(entries, e => e.type === 'feedback' && e.by === 'user');
  const approval = iApprove >= 0 ? entries[iApprove] : undefined, was = V.sourceHash ?? approval?.sourceHash;
  if (iFeedback > iV && iFeedback > iApprove) return { status: 'revision', version: v, approval, why: `feedback on ${String(entries[iFeedback].on ?? v)}: rework, then record ${nextVersion([v])}` };
  const edited = workingHash !== undefined && was !== undefined && workingHash !== was;
  if (approval) {
    if (edited) return { status: 'stale', version: v, approval, why: `edited since approved ${v}: record a version` };
    const d = approval.direction;
    if (direction && (d?.id !== direction.id || d?.version !== direction.version)) return { status: 'stale', version: v, approval, why: d ? `approved under map direction v${d.version}, now v${direction.version}` : `approved with no map direction, now v${direction.version}` };
    return { status: 'approved', version: v, approval, why: `approved ${v}` };
  }
  if (edited) return { status: 'in-pipeline', version: v, why: `edited since ${v}: record a version` };
  return { status: 'final', version: v, why: `${v} waiting for the user` };
}
