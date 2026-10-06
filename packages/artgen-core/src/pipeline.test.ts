// Pass state machine (PLAN P1b): v1 → v2 → v3 with best-so-far (R12) → finish → ready; ledger pass ids.
import { describe, expect, test } from 'vitest';
import { passId, planPasses, type PlanInput } from './pipeline.ts';
import type { LedgerEntry } from './qa/ledger.ts';

const score = (version: string, s: number): LedgerEntry => ({ ts: '2026-10-06T00:00:00Z', type: 'score', asset: 'a', version, score: s });
const plan = (versions: string[], scores: [string, number][], extra: Partial<PlanInput> = {}) =>
  planPasses({ asset: 'a', versions, ledger: scores.map(([v, s]) => score(v, s)), revisionPasses: 3, finishPass: true, ...extra }).next;

describe('pass state machine', () => {
  test('pass ids', () => {
    expect(['base.v1', 'base.v3', 'base.v4', 'finish.v1', 'finish.v2'].map(v => passId(v, 3))).toEqual(['r1', 'r3', 'u1', 'f', 'f2']);
    expect(() => passId('hero.v1', 3)).toThrow();
  });

  test('walks v1 → v2 → v3, always revising from the best-scoring version so far (R12)', () => {
    expect(plan([], [])).toMatchObject({ action: 'write-base', version: 'base.v1', pass: 'r1', from: undefined });
    expect(plan(['base.v1'], [])).toMatchObject({ action: 'review', version: 'base.v1', pass: 'r1' });
    expect(plan(['base.v1'], [['base.v1', 5]])).toMatchObject({ action: 'write-base', version: 'base.v2', from: 'base.v1' });
    expect(plan(['base.v1', 'base.v2'], [['base.v1', 6], ['base.v2', 5]])).toMatchObject({ action: 'write-base', version: 'base.v3', from: 'base.v1' });
    expect(plan(['base.v1', 'base.v2'], [['base.v1', 6], ['base.v2', 6]])).toMatchObject({ version: 'base.v3', from: 'base.v2' }); // ties → later
  });

  test('finishes the best base, reviews it, then is ready; a later score replaces an earlier one', () => {
    const bases = ['base.v1', 'base.v2', 'base.v3'], s: [string, number][] = [['base.v1', 5], ['base.v2', 7], ['base.v3', 6.5]];
    expect(plan(bases, s)).toMatchObject({ action: 'write-finish', version: 'finish.v1', base: 'base.v2', pass: 'f' });
    expect(plan([...bases, 'finish.v1'], s)).toMatchObject({ action: 'review', version: 'finish.v1', pass: 'f' });
    expect(plan([...bases, 'finish.v1'], [...s, ['finish.v1', 7.5]])).toMatchObject({ action: 'ready', final: 'finish.v1', best: 'base.v2' });
    expect(plan(bases, [...s, ['base.v3', 8]])).toMatchObject({ action: 'write-finish', base: 'base.v3' });
    expect(plan(bases, s, { finishPass: false })).toMatchObject({ action: 'ready', final: 'base.v2' });
    expect(plan(['base.v1'], [['base.v1', 7]], { revisionPasses: 1 })).toMatchObject({ action: 'write-finish', base: 'base.v1' });
  });

  test('a user iteration (base.v4) is reviewed as u1 and then re-finished', () => {
    const v = ['base.v1', 'base.v2', 'base.v3', 'finish.v1', 'base.v4'], s: [string, number][] = [['base.v1', 5], ['base.v2', 7], ['base.v3', 6], ['finish.v1', 7.5]];
    expect(plan(v, s, { finishBase: { 'finish.v1': 'base.v2' } })).toMatchObject({ action: 'review', version: 'base.v4', pass: 'u1' });
    expect(plan(v, [...s, ['base.v4', 7]], { finishBase: { 'finish.v1': 'base.v2' } })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v4' });
  });

  test('rows carry pass, score, gate and the finish binding', () => {
    const st = planPasses({ asset: 'a', versions: ['base.v1', 'finish.v1'], ledger: [{ ...score('base.v1', 6), conformance: { pass: true, checks: [] } }], revisionPasses: 1, finishPass: true, finishBase: { 'finish.v1': 'base.v1' } });
    expect(st.rows).toEqual([{ version: 'base.v1', pass: 'r1', score: 6, gate: true }, { version: 'finish.v1', pass: 'f', score: undefined, gate: undefined, base: 'base.v1' }]);
    expect(st.best).toEqual({ version: 'base.v1', score: 6 });
  });
});
