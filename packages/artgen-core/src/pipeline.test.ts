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

describe('re-finish when a later base becomes the best', () => {
  test('W1 probes finished early, then revised: the new best gets a new finish (R12)', () => {
    const v = ['base.v1', 'base.v2', 'base.v3', 'finish.v1'], s: [string, number][] = [['base.v1', 5], ['base.v2', 6], ['finish.v1', 6.5], ['base.v3', 7]];
    expect(plan(v, s, { finishBase: { 'finish.v1': 'base.v2' } })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v3' });
    expect(plan(v, [...s.slice(0, 3), ['base.v3', 5.5]], { finishBase: { 'finish.v1': 'base.v2' } })).toMatchObject({ action: 'ready', final: 'finish.v1' });
  });
});

describe('W2: extra autonomous revision, user feedback routes, open issues (P3)', () => {
  const fail = (version: string, s: number): LedgerEntry => ({ ...score(version, s), conformance: { pass: false, checks: [{ id: 'palette', status: 'fail', detail: '3 off-palette pixels' }] } });
  const ok = (version: string, s: number): LedgerEntry => ({ ...score(version, s), conformance: { pass: true, checks: [] } });
  const run = (versions: string[], ledger: LedgerEntry[], extra: Partial<PlanInput> = {}) =>
    planPasses({ asset: 'a', versions, ledger, revisionPasses: 3, finishPass: true, extraRevisions: 1, feedback: [], ...extra }).next;
  const three = ['base.v1', 'base.v2', 'base.v3'], l3 = [ok('base.v1', 5), ok('base.v2', 6.5), ok('base.v3', 6)];

  test('pass ids distinguish extra revisions (x) from user iterations (u)', () => {
    expect(['base.v4', 'base.v5', 'base.v6'].map(v => passId(v, 3, ['base.v5']))).toEqual(['x1', 'u1', 'x2']);
  });

  test('a final that fails the gate gets one extra base revision, then is ready with its issues listed', () => {
    const fb = { 'finish.v1': 'base.v2' }, v = [...three, 'finish.v1'];
    expect(run(v, [...l3, fail('finish.v1', 6.5)], { finishBase: fb })).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'x1', from: 'base.v2' });
    // the extra revision didn't beat the best: budget spent → ready with open issues
    const n = run([...v, 'base.v4'], [...l3, fail('finish.v1', 6.5), ok('base.v4', 6)], { finishBase: fb });
    expect(n).toMatchObject({ action: 'ready', final: 'finish.v1', issues: ['palette: 3 off-palette pixels'] });
    // it did beat the best: re-finish it
    expect(run([...v, 'base.v4'], [...l3, fail('finish.v1', 6.5), ok('base.v4', 7)], { finishBase: fb })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v4' });
    expect(run(v, [...l3, fail('finish.v1', 6.5)], { finishBase: fb, extraRevisions: 0 })).toMatchObject({ action: 'ready', issues: ['palette: 3 off-palette pixels'] });
    expect(run(v, [...l3, ok('finish.v1', 7)], { finishBase: fb })).toMatchObject({ action: 'ready', issues: [] });
  });

  test('user feedback opens a new base (form) or a finish revision (pixels); the user iteration is finished even if it scores lower', () => {
    const fb = { 'finish.v1': 'base.v2' }, v = [...three, 'finish.v1'], l = [...l3, ok('finish.v1', 7)];
    expect(run(v, l, { finishBase: fb, feedback: [{ route: 'finish', opens: 'finish.v2' }] })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v2' });
    expect(run(v, l, { finishBase: fb, feedback: [{ route: 'base', opens: 'base.v4' }] })).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'u1', from: 'base.v2' });
    const u = { finishBase: fb, feedback: [{ route: 'base' as const, opens: 'base.v4' }] };
    expect(run([...v, 'base.v4'], [...l, ok('base.v4', 6)], u)).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v4' });
    expect(run([...v, 'base.v4', 'finish.v2'], [...l, ok('base.v4', 6), ok('finish.v2', 6.5)], { ...u, finishBase: { ...fb, 'finish.v2': 'base.v4' } })).toMatchObject({ action: 'ready', final: 'finish.v2' });
  });
});
