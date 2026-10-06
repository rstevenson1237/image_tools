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
import type { NextStep } from '../pipeline.ts';
import type { LedgerEntry } from '../qa/ledger.ts';

export const STATUSES = ['brief', 'in-pipeline', 'final', 'approved', 'exported', 'revision', 'stale'] as const;
export type AssetStatus = (typeof STATUSES)[number];

export interface StatusInput {
  /** Ledger entries for this asset, in file order. */
  ledger: LedgerEntry[];
  /** Pass machine's next step, or undefined when the asset has no versions yet. */
  next?: NextStep;
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
    return { status: revising ? 'revision' : 'in-pipeline', issues: [], why: `${next.action} ${'version' in next ? next.version : ''}`.trim() };
  }
  const final = next.final, issues = next.issues;
  const approval = iApprove >= 0 ? ledger[iApprove] : undefined;
  if (!approval || iFeedback > iApprove || approval.version !== final || (finalHash && approval.sourceHash !== finalHash)) {
    // an approved asset whose final changed under it: restyle re-renders → back to the user as `final`
    return { status: 'final', final, issues, why: approval && iFeedback < iApprove ? `approved ${approval.version} changed since (re-review)` : 'finished; waiting for the user to approve or give feedback' };
  }
  const iExport = lastIndex(ledger, e => e.type === 'export' && e.version === final);
  const exp = iExport > iApprove ? ledger[iExport] : undefined;
  if (approval.direction?.version !== direction.version || approval.direction?.id !== direction.id) {
    const restyled = lastIndex(ledger, e => e.type === 'restyle' && (e.direction as { version?: number } | undefined)?.version === direction.version) > iApprove;
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
