import { describe, expect, test } from 'vitest';
import type { LedgerEntry } from './ledger.ts';
import { diffStageKeys, gatesFor, stageState, stageVerdicts, STAGES } from './stages.ts';

const stage = (verdict: 'approve' | 'reject', key: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({ ts: 't', type: 'stage', asset: 'a', stage: 'shape', verdict, key, ...extra });

describe('gatesFor', () => {
  test('the brief\'s own gates win, then the kind\'s, then *, else none', () => {
    const cfg = { character: ['shape' as const], '*': ['placeholder' as const] };
    expect(gatesFor(cfg, { kind: 'character', gates: ['placeholder', 'shape'] })).toEqual(['placeholder', 'shape']);
    expect(gatesFor(cfg, { kind: 'character' })).toEqual(['shape']);
    expect(gatesFor(cfg, { kind: 'prop' })).toEqual(['placeholder']);
    expect(gatesFor({ character: ['shape'] }, { kind: 'prop' })).toEqual([]);
    expect(gatesFor(undefined, { kind: 'prop' })).toEqual([]);
    expect(gatesFor(cfg, { kind: 'character', gates: [] })).toEqual([]);
  });
});

describe('stage verdicts', () => {
  const ledger: LedgerEntry[] = [
    { ts: 't', type: 'stage', asset: 'a', stage: 'placeholder', event: 'written', key: 'p1' },
    stage('approve', 'k1', { version: 'base.v1', ts: '1' }), { ts: 't', type: 'score', asset: 'a', version: 'base.v2', score: 6 },
    stage('reject', 'k2', { version: 'base.v2', note: 'arms too long', ts: '2' }),
  ];
  test('entries without a verdict are ignored; the rest come oldest first', () => {
    expect(stageVerdicts(ledger).map(v => [v.stage, v.verdict, v.key])).toEqual([['shape', 'approve', 'k1'], ['shape', 'reject', 'k2']]);
    expect(stageVerdicts(ledger, 'placeholder')).toEqual([]);
    expect(stageVerdicts(ledger)[1]).toMatchObject({ version: 'base.v2', note: 'arms too long' });
  });
  test('the approved key is that of the latest verdict only when it is an approve', () => {
    expect(stageState(ledger.slice(0, 2), 'shape')).toMatchObject({ approvedKey: 'k1', latest: { verdict: 'approve' } });
    expect(stageState(ledger, 'shape')).toMatchObject({ latest: { verdict: 'reject', key: 'k2' } });
    expect(stageState(ledger, 'shape').approvedKey).toBeUndefined();
    expect(stageState([...ledger, stage('approve', 'k3')], 'shape').approvedKey).toBe('k3');
    expect(stageState([], 'shape')).toEqual({});
  });
});

describe('diffStageKeys', () => {
  test('same, changed, added, removed and n/a, stage by stage', () => {
    const d = diffStageKeys({ shape: 'a', decorate: 'b', rig: 'r' }, { shape: 'a', decorate: 'c', lighting: 'l' });
    expect(d).toMatchObject({ shape: 'same', decorate: 'changed', rig: 'removed', lighting: 'added', decal: 'n/a', placeholder: 'n/a' });
    expect(Object.keys(d)).toEqual([...STAGES]);
  });
});
