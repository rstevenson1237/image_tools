/**
 * The user's two decisions on a subject (docs/WORKFLOW.md §7.2), as ledger entries. Approval needs the status `final` (a version
 * exists, the working file equals it, no feedback is open) and no failing check; flags are copied in as warnings. Feedback needs a
 * version. The CLI, the MCP server and the web engine all call these, so the rules and their messages are the same everywhere.
 */
import type { Check } from './check.ts';
import type { LedgerEntry } from './ledger.ts';
import type { SubjectStatusResult } from './status.ts';
import type { SubjectKind } from './subject.ts';

export interface Decided { kind: SubjectKind; id: string; key: string }

/** The approval entry for the latest version, or an error saying why not. `checks` are the version's (the working file's, when it is final). */
export function approvalEntry(s: Decided & { status: SubjectStatusResult; checks: Check[]; workingHash: string; direction?: { id: string; version: number } }, o: { note?: string; via?: string } = {}): Omit<LedgerEntry, 'ts'> {
  const { status, version } = s.status;
  if (status !== 'final' || !version) throw new Error(`${s.id} is ${status} (${s.status.why}): only a final ${s.kind} can be approved${status === 'in-pipeline' && version ? ` — artgen ${s.kind} version ${s.id} first` : ''}`);
  const bad = s.checks.filter(c => c.status === 'fail');
  if (bad.length) throw new Error(`${s.id} ${version}: ${bad.length} check${bad.length === 1 ? '' : 's'} fail (${[...new Set(bad.map(c => c.id))].join(', ')}) — fix them and record a new version, or give feedback instead`);
  const warnings = s.checks.filter(c => c.status === 'flag').map(c => `${c.id}: ${c.detail}`);
  return {
    type: 'approve', asset: s.key, version, sourceHash: s.workingHash, ...(s.direction && { direction: s.direction }), note: o.note ?? '',
    ...(warnings.length && { warnings }), by: 'user', ...(o.via && { via: o.via }),
  };
}

/** The feedback entry on the latest version, or an error. `region` is x,y,w,h (map units for a map, cells for the others). */
export function feedbackEntry(s: Decided & { latest?: string }, o: { note: string; region?: number[]; via?: string }): Omit<LedgerEntry, 'ts'> {
  if (!s.latest) throw new Error(`${s.id}: no version yet — feedback is on a version (artgen ${s.kind} version ${s.id})`);
  if (!o.note?.trim()) throw new Error('feedback: --note "<what the user asked for>" is required');
  if (o.region && o.region.length !== 4) throw new Error('--region: x,y,w,h');
  return { type: 'feedback', asset: s.key, on: s.latest, note: o.note.trim(), ...(o.region && { region: o.region }), by: 'user', ...(o.via && { via: o.via }) };
}
