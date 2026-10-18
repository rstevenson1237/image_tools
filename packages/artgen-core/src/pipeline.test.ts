// Pass state machine (PLAN P1b): v1 → v2 → v3 with best-so-far (R12) → finish → ready; ledger pass ids.
import { describe, expect, test } from 'vitest';
import { blindIssues, latestScores, passId, planPasses, rosterNotes, wantsFinish, type PlanInput } from './pipeline.ts';
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
    const fb = { 'finish.v1': 'base.v2' }, v = [...three, 'finish.v1'], f3 = [fail('base.v1', 5), fail('base.v2', 6.5), fail('base.v3', 6)];
    expect(run(v, [...f3, fail('finish.v1', 6.5)], { finishBase: fb })).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'x1', from: 'base.v2' });
    // budget spent and nothing passes: ready with the open issues
    const n = run([...v, 'base.v4'], [...f3, fail('finish.v1', 6.5), fail('base.v4', 6)], { finishBase: fb });
    expect(n).toMatchObject({ action: 'ready', final: 'finish.v1', issues: ['palette: 3 off-palette pixels'] });
    // the extra revision passes the gate: it is the final even though it scores lower (a failing version can't be approved)
    expect(run([...v, 'base.v4'], [...f3, fail('finish.v1', 6.5), ok('base.v4', 6)], { finishBase: fb, finish: 'auto' })).toMatchObject({ action: 'ready', final: 'base.v4', issues: [] });
    // it beat the best: re-finish it
    expect(run([...v, 'base.v4'], [...f3, fail('finish.v1', 6.5), ok('base.v4', 7)], { finishBase: fb })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v4' });
    expect(run(v, [...f3, fail('finish.v1', 6.5)], { finishBase: fb, extraRevisions: 0 })).toMatchObject({ action: 'ready', issues: ['palette: 3 off-palette pixels'] });
    expect(run(v, [...l3, ok('finish.v1', 7)], { finishBase: fb })).toMatchObject({ action: 'ready', issues: [] });
    // a finish that breaks the gate on a passing base: the base is the final, no extra revision
    expect(run(v, [...l3, fail('finish.v1', 7)], { finishBase: fb })).toMatchObject({ action: 'ready', final: 'base.v2', issues: [], top: { version: 'finish.v1', score: 7 } });
  });

  test('user feedback opens a new base (form) or a finish revision (pixels); the user iteration is finished even if it scores lower', () => {
    const fb = { 'finish.v1': 'base.v2' }, v = [...three, 'finish.v1'], l = [...l3, ok('finish.v1', 7)];
    expect(run(v, l, { finishBase: fb, feedback: [{ route: 'finish', opens: 'finish.v2' }] })).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v2' });
    expect(run(v, l, { finishBase: fb, feedback: [{ route: 'base', opens: 'base.v4' }] })).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'u1', from: 'base.v2' });
    const u = { finishBase: fb, feedback: [{ route: 'base' as const, opens: 'base.v4' }] };
    expect(run([...v, 'base.v4'], [...l, ok('base.v4', 6)], u)).toMatchObject({ action: 'write-finish', version: 'finish.v2', base: 'base.v4' });
    expect(run([...v, 'base.v4', 'finish.v2'], [...l, ok('base.v4', 6), ok('finish.v2', 6.5)], { ...u, finishBase: { ...fb, 'finish.v2': 'base.v4' } })).toMatchObject({ action: 'ready', final: 'finish.v2' });
  });

  test("the step a user's feedback opens carries their words, region and cell (from Claude Code or the image tools)", () => {
    const fb = { 'finish.v1': 'base.v2' }, v = [...three, 'finish.v1'], l = [...l3, ok('finish.v1', 7)];
    const pinned = run(v, l, { finishBase: fb, feedback: [{ route: 'finish', opens: 'finish.v2', note: 'eyes too bright', region: [3, 2, 4, 4], cell: 'idle/s/0' }] });
    expect(pinned.why).toMatch(/user: "eyes too bright" \(region x,y,w,h 3,2,4,4 of idle\/s\/0\)$/);
    expect(run(v, l, { finishBase: fb, feedback: [{ route: 'base', opens: 'base.v4', note: 'bigger ears' }] }).why).toMatch(/user: "bigger ears"$/);
  });

  test('blind re-score (rev 9): a fresh reviewer scores the final; a gap or a low blind score is an issue and spends the extra revision', () => {
    const v = ['base.v1', 'base.v2', 'base.v3', 'finish.v1'], s: [string, number][] = [['base.v1', 5], ['base.v2', 7], ['base.v3', 6.5], ['finish.v1', 7]];
    const fb = { 'finish.v1': 'base.v2' }, blind = { minScore: 6.5, maxGap: 1 };
    const ledger = (extra: LedgerEntry[] = []) => [...s.map(([x, y]) => score(x, y)), ...extra];
    const bl = (version: string, n: number, note?: string): LedgerEntry => ({ ...score(version, n), blind: true, reviewer: 'fresh', ...(note && { note }) });
    const go = (versions: string[], l: LedgerEntry[], extra: Partial<PlanInput> = {}) =>
      planPasses({ asset: 'a', versions, ledger: l, revisionPasses: 3, finishPass: true, finishBase: fb, feedback: [], extraRevisions: 1, blind, ...extra }).next;
    expect(go(v, ledger())).toMatchObject({ action: 'blind-review', version: 'finish.v1', pass: 'b' });
    // a blind score never replaces the version's own score
    expect(latestScores(ledger([bl('finish.v1', 4)])).get('finish.v1')!.score).toBe(7);
    expect(go(v, ledger([bl('finish.v1', 6.5)]))).toMatchObject({ action: 'ready', final: 'finish.v1', issues: [] });
    // 2 points under its own score: one extra autonomous revision from the best base, naming the blind note
    const miss = go(v, ledger([bl('finish.v1', 5, 'reads as a crate, not a barrel')]));
    expect(miss).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'x1', from: 'base.v2' });
    expect(miss.why).toMatch(/blind re-score 5 vs 7 \(gap 2\): reads as a crate/);
    // budget spent (x1 scored lower, so finish.v1 still stands): ready, with the blind issue listed for the user
    const after = go([...v, 'base.v4'], ledger([bl('finish.v1', 5, 'reads as a crate'), score('base.v4', 6)]));
    expect(after).toMatchObject({ action: 'ready', final: 'finish.v1', issues: ['blind re-score 5 vs 7 (gap 2): reads as a crate'] });
    // off, or a final the user already approved: no blind step
    expect(go(v, ledger(), { blind: undefined })).toMatchObject({ action: 'ready' });
    expect(go(v, ledger([{ ts: 't', type: 'approve', asset: 'a', version: 'finish.v1', by: 'user' }]))).toMatchObject({ action: 'ready', issues: [] });
    expect(blindIssues(7, { score: 6 }, blind)).toEqual(['blind re-score 6 is under 6.5']);
    expect(blindIssues(6.5, { score: 6.5 }, blind)).toEqual([]);
  });
});

describe('megadungeon fixes (0.10.0): best final, auto finish, blind gating, approval pin, roster notes, agent feedback', () => {
  const ok = (version: string, s: number, note?: string): LedgerEntry => ({ ...score(version, s), conformance: { pass: true, checks: [] }, ...(note && { note }) });
  const bl = (version: string, n: number): LedgerEntry => ({ ...score(version, n), blind: true, reviewer: 'fresh' });
  const blind = { minScore: 6.5, maxGap: 1 }, three = ['base.v1', 'base.v2', 'base.v3'];
  const go = (versions: string[], ledger: LedgerEntry[], extra: Partial<PlanInput> = {}) =>
    planPasses({ asset: 'a', versions, ledger, revisionPasses: 3, finishPass: true, feedback: [], extraRevisions: 1, ...extra }).next;

  test('the final is the best-scoring version, not the newest: a finish that loses to its base ships the base', () => {
    const v = [...three, 'base.v4', 'finish.v1', 'finish.v2'], fb = { 'finish.v1': 'base.v3', 'finish.v2': 'base.v4' };
    const l = [ok('base.v1', 5), ok('base.v2', 6), ok('base.v3', 7), ok('base.v4', 7), ok('finish.v1', 6.5), ok('finish.v2', 6)];
    // terrain-stairs-down: 7 at base.v3 and base.v4, finish.v2 approved at 6
    expect(go(v, l, { finishBase: fb })).toMatchObject({ action: 'ready', final: 'base.v4' });
  });

  test('blind scores choose the final: the best own score is blinded first, then the best blind score wins', () => {
    const v = [...three, 'finish.v1'], fb = { 'finish.v1': 'base.v3' }, l = [ok('base.v1', 5), ok('base.v2', 6.5), ok('base.v3', 7), ok('finish.v1', 7.5)];
    expect(go(v, l, { finishBase: fb, blind })).toMatchObject({ action: 'blind-review', version: 'finish.v1' });
    expect(go(v, [...l, bl('finish.v1', 7)], { finishBase: fb, blind })).toMatchObject({ action: 'ready', final: 'finish.v1', issues: [] });
    // a base blinded higher than the finish wins
    expect(go(v, [...l, bl('finish.v1', 6.6), bl('base.v3', 6.8)], { finishBase: fb, blind })).toMatchObject({ action: 'ready', final: 'base.v3' });
  });

  test('a blind score more than maxGap under the own score starts a revision from its own budget, even after a gate revision', () => {
    const v = [...three, 'base.v4', 'finish.v1'], fb = { 'finish.v1': 'base.v3' };
    const l = [ok('base.v1', 5), ok('base.v2', 6), ok('base.v3', 7), ok('base.v4', 6), ok('finish.v1', 7), bl('finish.v1', 5)];
    expect(go(v, l, { finishBase: fb, blind })).toMatchObject({ action: 'ready', issues: [expect.stringMatching(/gap 2/)] });
    expect(go(v, l, { finishBase: fb, blind, blindRevisions: 1 })).toMatchObject({ action: 'write-base', version: 'base.v5', pass: 'x2' });
  });

  test('finish: auto runs the finishing pass only on a finish-level note or a base over the bar', () => {
    expect(go(three, [ok('base.v1', 5), ok('base.v2', 6), ok('base.v3', 5.5, 'silhouette reads as a crate')], { finish: 'auto' })).toMatchObject({ action: 'ready', final: 'base.v2' });
    expect(go(three, [ok('base.v1', 5), ok('base.v2', 6, 'banding on the cloak, stray pixels'), ok('base.v3', 5.5)], { finish: 'auto' })).toMatchObject({ action: 'write-finish', base: 'base.v2' });
    expect(go(three, [ok('base.v1', 5), ok('base.v2', 7), ok('base.v3', 5.5)], { finish: 'auto' })).toMatchObject({ action: 'write-finish', base: 'base.v2' });
    expect(go(three, [ok('base.v1', 5), ok('base.v2', 7), ok('base.v3', 5.5)], { finish: 'never' })).toMatchObject({ action: 'ready', final: 'base.v2' });
    expect(wantsFinish('outline breaks at the boots', 5, 6.5)).toBe(true);
    expect(wantsFinish('head too small', 5, 6.5)).toBe(false);
  });

  test('a final the user approved stays the final until something newer is written', () => {
    const v = [...three, 'finish.v1'], fb = { 'finish.v1': 'base.v3' }, l = [ok('base.v1', 5), ok('base.v2', 6), ok('base.v3', 7), ok('finish.v1', 6.5)];
    const approve: LedgerEntry = { ts: 't', type: 'approve', asset: 'a', version: 'finish.v1', by: 'user' };
    expect(go(v, [...l, approve], { finishBase: fb, blind, finish: 'auto' })).toMatchObject({ action: 'ready', final: 'finish.v1' });
    expect(go(v, l, { finishBase: fb, finish: 'auto' })).toMatchObject({ action: 'ready', final: 'base.v3' });
  });

  test('roster notes on the version a revision starts from go into its brief', () => {
    const l = [ok('base.v1', 5), { ts: 't', type: 'roster' as const, asset: 'a', version: 'base.v1', issues: ['lineup: twin of kobold'] }];
    expect(go(['base.v1'], l).why).toMatch(/roster review of base.v1 found: lineup: twin of kobold/);
    expect(rosterNotes(l, 'base.v1')).toEqual(['lineup: twin of kobold']);
  });

  test('agent feedback from a roster note opens an extra revision (x), not a user iteration, on the version it names', () => {
    const v = [...three], l = [ok('base.v1', 5), ok('base.v2', 7), ok('base.v3', 6)];
    const fb = [{ route: 'base' as const, opens: 'base.v4', on: 'base.v2', note: 'reads friendly, not hostile', by: 'agent' as const, source: 'roster' }];
    const n = go(v, l, { feedback: fb, finish: 'never' });
    expect(n).toMatchObject({ action: 'write-base', version: 'base.v4', pass: 'x1', from: 'base.v2' });
    expect(n.why).toMatch(/roster: "reads friendly, not hostile"/);
    // written and scored higher: it is the final; the gate-fail budget is untouched
    expect(go([...v, 'base.v4'], [...l, ok('base.v4', 7.5)], { feedback: fb, finish: 'never' })).toMatchObject({ action: 'ready', final: 'base.v4' });
  });
});
