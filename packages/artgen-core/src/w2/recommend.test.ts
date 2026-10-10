// Analytics v2 (PLAN P7): pooled budget and model/effort recommendations.
import { describe, expect, test } from 'vitest';
import type { LedgerEntry } from '../qa/ledger.ts';
import { DEFAULT_CONFIG } from './config.ts';
import { applyRecommendations, recommend, recommendMarkdown, type LedgerSet } from './recommend.ts';

const sc = (asset: string, version: string, pass: string, score: number, x: Partial<LedgerEntry> = {}): LedgerEntry =>
  ({ ts: 't', type: 'score', asset, version, pass, score, tokens: { code: 400, edit: 400 }, imageTokens: 1000, conformance: { pass: true, checks: [] }, model: 'big', effort: 'high', reviewModel: 'big', ...x });

/** An asset's three bases (scores s1..s3) and a finish one point over its best base. */
const asset = (id: string, [s1, s2, s3]: number[], x: Partial<LedgerEntry> = {}): LedgerEntry[] => [
  sc(id, 'base.v1', 'r1', s1, x), sc(id, 'base.v2', 'r2', s2, x), sc(id, 'base.v3', 'r3', s3, x), sc(id, 'finish.v1', 'f', Math.max(s1, s2, s3) + 1, { base: 'base.v3', ...x }),
  { ts: 't', type: 'status', asset: id, status: 'final', version: 'finish.v1' } as LedgerEntry,
];

describe('recommend (analytics v2)', () => {
  // props plateau after v2 (v3 adds nothing) in two projects; effects keep improving at v3
  const propsA: LedgerSet = { project: 'a', metas: ['p1', 'p2', 'p3'].map(id => ({ id, kind: 'prop' })), config: DEFAULT_CONFIG,
    ledger: [...asset('p1', [5, 6, 6]), ...asset('p2', [5, 6.5, 6]), ...asset('p3', [4, 5, 5])] };
  const propsB: LedgerSet = { project: 'b', metas: ['p1', 'p2', 'p3', 'fx1', 'fx2', 'fx3'].map(id => ({ id, kind: id.startsWith('fx') ? 'effect' : 'prop' })),
    ledger: [...asset('p1', [5, 6, 6.1]), ...asset('p2', [5, 5.5, 5.5]), ...asset('p3', [6, 6.5, 6.5]), ...asset('fx1', [4, 5, 6]), ...asset('fx2', [4, 5, 6]), ...asset('fx3', [4, 5.5, 6.5])] };

  test('revision passes per kind from the marginal gain on the best-so-far score; same ids in two projects stay apart', () => {
    const r = recommend([propsA, propsB]);
    const prop = r.kinds.find(k => k.kind === 'prop')!;
    expect(prop.assets).toBe(6);
    expect(prop.gains).toEqual([{ pass: 'r2', n: 6, mean: 0.92 }, { pass: 'r3', n: 6, mean: 0.02 }]);
    expect(prop).toMatchObject({ current: 3, revisionPasses: 2, confidence: 'medium' });
    const fx = r.kinds.find(k => k.kind === 'effect')!;
    expect(fx).toMatchObject({ revisionPasses: 4, confidence: 'low' });
    expect(fx.why).toMatch(/one more pass/);
    // low confidence never reaches the patch; medium does
    expect(r.patch.budget.perKind.prop).toMatchObject({ revisionPasses: 2 });
    expect(r.patch.budget.perKind.effect?.revisionPasses).toBeUndefined();
    expect(prop.finish).toMatchObject({ n: 6, meanGain: 1.08, extraFinishRate: 0 }); // over the bound base.v3, not the best base
  });

  test('image-token caps: 1.5 × p90 rounded up to 500, only with enough assets', () => {
    const r = recommend([propsA, propsB]), prop = r.kinds.find(k => k.kind === 'prop')!;
    expect(prop.imageTokens).toEqual({ n: 6, p50: 4000, p90: 4000, cap: 6000 });
    expect(r.kinds.find(k => k.kind === 'effect')!.imageTokens.cap).toBeUndefined();
  });

  test('model / effort: with two mappings, the cheaper one when its gain is close; one mapping proposes an experiment', () => {
    const small = (id: string, s: number[]) => asset(id, s, { model: 'small', effort: 'low', tokens: { code: 100, edit: 100 }, imageTokens: 500 });
    const mixed: LedgerSet = { project: 'c', metas: ['s1', 's2', 's3'].map(id => ({ id, kind: 'prop' })), ledger: [...small('s1', [5, 5.9, 5.9]), ...small('s2', [5, 6, 6]), ...small('s3', [5, 5.8, 5.8])] };
    const r = recommend([propsA, propsB, mixed]), revise = r.models.find(m => m.stage === 'revise')!;
    expect(revise.mappings.map(m => `${m.model}/${m.effort}`)).toEqual(['big/high', 'small/low']);
    expect(revise.recommend).toEqual({ model: 'small', effort: 'low' });
    expect(r.patch.models.revise).toEqual({ model: 'small', effort: 'low' });
    const one = recommend([propsA]);
    expect(one.models.find(m => m.stage === 'revise')!.why).toMatch(/one mapping recorded/);
    expect(one.notes.some(n => n.startsWith('experiment:'))).toBe(true);
  });

  test('notes: user revisions and blind gaps by kind; markdown and the config patch', () => {
    const fb = (id: string) => ({ ts: 't', type: 'feedback', asset: id, by: 'user', route: 'base' }) as LedgerEntry;
    const bl = (id: string) => sc(id, 'finish.v1', 'b', 5, { blind: true, reviewer: 'fresh' });
    const set: LedgerSet = { ...propsA, ledger: [...propsA.ledger, fb('p1'), fb('p2'), bl('p1'), bl('p2'), bl('p3')] };
    const r = recommend([set]), prop = r.kinds.find(k => k.kind === 'prop')!;
    expect(prop.userRevisionRate).toBe(0.67);
    expect(prop.blindGap).toEqual({ n: 3, mean: 1.83 });
    expect(r.notes.some(n => /sent back 67%/.test(n))).toBe(true);
    expect(r.notes.some(n => /blind re-scores sit 1.83/.test(n))).toBe(true);
    expect(recommendMarkdown(r)).toMatch(/\| prop \| 3 \| r2 \+1\.17 \(3\), r3 \+0 \(3\) \| 3 \| 2 \| low \|/);
    const cfg = applyRecommendations(DEFAULT_CONFIG, { budget: { perKind: { prop: { revisionPasses: 2 } } }, models: { revise: { model: 'small' } } });
    expect(cfg.budget.perKind).toEqual({ prop: { revisionPasses: 2 } });
    expect(cfg.budget.tiers).toEqual(DEFAULT_CONFIG.budget.tiers);
    expect(cfg.models).toMatchObject({ base: 'default', revise: { model: 'small' } });
  });
});
