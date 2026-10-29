import { describe, expect, test } from 'vitest';
import type { LedgerEntry } from './ledger.ts';
import { subjectStatus } from './status.ts';

const A = 'map:keep', T = (n: number) => `2026-10-29T10:00:${String(n).padStart(2, '0')}Z`;
const ver = (n: number, hash: string): LedgerEntry => ({ ts: T(n), type: 'version', asset: A, version: `v${n}`, sourceHash: hash, by: 'agent' });
const approve = (n: number, hash: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({ ts: T(30 + n), type: 'approve', asset: A, version: `v${n}`, sourceHash: hash, by: 'user', note: '', ...extra });
const feedback = (on: string, ts = T(40)): LedgerEntry => ({ ts, type: 'feedback', asset: A, on, note: 'move the gate', by: 'user' });

describe('subjectStatus', () => {
  const table: [string, LedgerEntry[], Parameters<typeof subjectStatus>[0] extends infer I ? Omit<I & object, 'entries'> : never, string, RegExp][] = [
    ['no version yet', [], {}, 'in-pipeline', /no version recorded yet/],
    ['a version, working file the same, waiting for the user', [ver(1, 'h1')], { workingHash: 'h1' }, 'final', /v1 waiting for the user/],
    ['a version, no working hash given', [ver(1, 'h1')], {}, 'final', /v1 waiting/],
    ['edited since the version, nothing approved', [ver(1, 'h1')], { workingHash: 'h2' }, 'in-pipeline', /edited since v1: record a version/],
    ['approved', [ver(1, 'h1'), approve(1, 'h1')], { workingHash: 'h1' }, 'approved', /approved v1/],
    ['edited after approval', [ver(1, 'h1'), approve(1, 'h1')], { workingHash: 'h2' }, 'stale', /edited since approved v1/],
    ['feedback after the version', [ver(1, 'h1'), feedback('v1')], { workingHash: 'h1' }, 'revision', /feedback on v1: rework, then record v2/],
    ['feedback after an approval', [ver(1, 'h1'), approve(1, 'h1'), feedback('v1', T(50))], { workingHash: 'h1' }, 'revision', /rework, then record v2/],
    ['feedback, then a new version', [ver(1, 'h1'), feedback('v1'), { ...ver(2, 'h2'), ts: T(45) }], { workingHash: 'h2' }, 'final', /v2 waiting/],
    ['approval of an older version only', [ver(1, 'h1'), approve(1, 'h1'), { ...ver(2, 'h2'), ts: T(45) }], { workingHash: 'h2' }, 'final', /v2 waiting/],
    ['approved under another map direction', [ver(1, 'h1'), approve(1, 'h1', { direction: { id: 'maps', version: 1 } })], { workingHash: 'h1', direction: { id: 'maps', version: 2 } }, 'stale', /approved under map direction v1, now v2/],
    ['approved under the same direction', [ver(1, 'h1'), approve(1, 'h1', { direction: { id: 'maps', version: 2 } })], { workingHash: 'h1', direction: { id: 'maps', version: 2 } }, 'approved', /approved v1/],
    ['approved with no direction, one is locked now', [ver(1, 'h1'), approve(1, 'h1')], { workingHash: 'h1', direction: { id: 'maps', version: 1 } }, 'stale', /approved with no map direction, now v1/],
    ['an approval by the agent does not count', [ver(1, 'h1'), approve(1, 'h1', { by: 'agent' })], { workingHash: 'h1' }, 'final', /waiting for the user/],
  ];
  test.each(table)('%s', (_name, entries, input, status, why) => {
    const r = subjectStatus({ entries, ...input });
    expect(r.status).toBe(status);
    expect(r.why).toMatch(why);
  });

  test('the version and the approval it names', () => {
    const r = subjectStatus({ entries: [ver(1, 'h1'), approve(1, 'h1'), ver(2, 'h2')], workingHash: 'h2' });
    expect(r).toMatchObject({ status: 'final', version: 'v2' });
    expect(r.approval).toBeUndefined();
    expect(subjectStatus({ entries: [ver(1, 'h1'), approve(1, 'h1')], workingHash: 'h1' }).approval?.version).toBe('v1');
  });

  test('the hint names the command when the ledger has the key', () => {
    expect(subjectStatus({ entries: [] }).why).toBe('no version recorded yet');
  });
});
