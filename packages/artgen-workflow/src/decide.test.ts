import { describe, expect, test } from 'vitest';
import type { Check } from './check.ts';
import { approvalEntry, feedbackEntry } from './decide.ts';
import { subjectStatus } from './status.ts';
import type { LedgerEntry } from './ledger.ts';

const D = { kind: 'map' as const, id: 'keep', key: 'map:keep' };
const v1: LedgerEntry = { ts: '2026-10-29T10:00:00Z', type: 'version', asset: 'map:keep', version: 'v1', sourceHash: 'h1' };
const final = subjectStatus({ entries: [v1], workingHash: 'h1' });
const ok: Check[] = [{ id: 'format', status: 'pass', detail: 'ok' }];

describe('approvalEntry', () => {
  test('a final version with no failing check: the entry, flags as warnings, the direction and the via', () => {
    expect(approvalEntry({ ...D, status: final, checks: ok, workingHash: 'h1' }, { note: 'yes' })).toEqual({ type: 'approve', asset: 'map:keep', version: 'v1', sourceHash: 'h1', note: 'yes', by: 'user' });
    const flagged: Check[] = [...ok, { id: 'symbols', status: 'flag', detail: 'not in the set: tower' }];
    expect(approvalEntry({ ...D, status: final, checks: flagged, workingHash: 'h1', direction: { id: 'maps', version: 2 } }, { via: 'pr' })).toEqual({
      type: 'approve', asset: 'map:keep', version: 'v1', sourceHash: 'h1', direction: { id: 'maps', version: 2 }, note: '', warnings: ['symbols: not in the set: tower'], by: 'user', via: 'pr',
    });
  });

  test('refused unless final, and when a check fails', () => {
    const none = subjectStatus({ entries: [], key: 'map:keep' }), edited = subjectStatus({ entries: [v1], workingHash: 'h2' });
    expect(() => approvalEntry({ ...D, status: none, checks: ok, workingHash: 'h1' })).toThrow('keep is in-pipeline (no version recorded yet: artgen map version keep): only a final map can be approved');
    expect(() => approvalEntry({ ...D, status: edited, checks: ok, workingHash: 'h2' })).toThrow('keep is in-pipeline (edited since v1: record a version): only a final map can be approved — artgen map version keep first');
    const bad: Check[] = [{ id: 'require:C-a', status: 'fail', detail: '' }, { id: 'require:C-b', status: 'fail', detail: '' }, { id: 'lint', status: 'fail', detail: '' }, { id: 'lint', status: 'fail', detail: '' }];
    expect(() => approvalEntry({ ...D, status: final, checks: bad, workingHash: 'h1' })).toThrow('keep v1: 4 checks fail (require:C-a, require:C-b, lint) — fix them and record a new version, or give feedback instead');
  });
});

test('approved, then the map direction changed: the same version is approved again under the new one; an edit since is not', () => {
  const a1: LedgerEntry = { ts: '2026-10-29T11:00:00Z', type: 'approve', asset: 'map:keep', version: 'v1', sourceHash: 'h1', by: 'user' }, dir = { id: 'maps', version: 1 };
  const stale = subjectStatus({ entries: [v1, a1], workingHash: 'h1', direction: dir });
  expect(stale.status).toBe('stale');
  expect(approvalEntry({ ...D, status: stale, checks: ok, workingHash: 'h1', direction: dir })).toMatchObject({ type: 'approve', version: 'v1', direction: dir });
  const edited = subjectStatus({ entries: [v1, a1], workingHash: 'h2', direction: dir });
  expect(() => approvalEntry({ ...D, status: edited, checks: ok, workingHash: 'h2', direction: dir })).toThrow(/only a final map can be approved/);
});

describe('feedbackEntry', () => {
  test('on the latest version, with the words trimmed; refused with no version, no words or a bad region', () => {
    expect(feedbackEntry({ ...D, latest: 'v2' }, { note: ' move the gate ', region: [1, 2, 3, 4], via: 'pr' })).toEqual({ type: 'feedback', asset: 'map:keep', on: 'v2', note: 'move the gate', region: [1, 2, 3, 4], by: 'user', via: 'pr' });
    expect(() => feedbackEntry(D, { note: 'x' })).toThrow(/no version yet/);
    expect(() => feedbackEntry({ ...D, latest: 'v1' }, { note: ' ' })).toThrow(/--note/);
    expect(() => feedbackEntry({ ...D, latest: 'v1' }, { note: 'x', region: [1] })).toThrow(/x,y,w,h/);
  });
});
