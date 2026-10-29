import { describe, expect, test } from 'vitest';
import type { LedgerEntry } from './ledger.ts';
import { analytics, passRecords } from './analytics.ts';
import { generatorMetrics, generatorsMarkdown } from './metrics.ts';

let n = 0;
const e = (asset: string, type: string, x: Record<string, unknown> = {}): LedgerEntry => ({ ts: `2026-10-29T10:00:${String(n++).padStart(2, '0')}Z`, type: type as LedgerEntry['type'], asset, ...x });
const fail = (id: string) => ({ pass: false, checks: [{ id, status: 'fail' as const, detail: '' }, { id: 'ok', status: 'pass' as const, detail: '' }] });

describe('generatorMetrics', () => {
  const ledger: LedgerEntry[] = [
    // map keep: two versions, one round of feedback, approved
    e('map:keep', 'version', { version: 'v1', sourceHash: 'a', wallMs: 60_000, by: 'agent' }),
    e('map:keep', 'review', { version: 'v1', imageTokens: 900, conformance: fail('require:C-forest'), by: 'agent' }),
    e('map:keep', 'feedback', { on: 'v1', note: 'more forest', by: 'user' }),
    e('map:keep', 'version', { version: 'v2', sourceHash: 'b', wallMs: 30_000, by: 'agent' }),
    e('map:keep', 'review', { version: 'v2', imageTokens: 1100, conformance: { pass: true, checks: [] }, by: 'agent' }),
    e('map:keep', 'approve', { version: 'v2', sourceHash: 'b', by: 'user' }),
    // map isle: one version, approved without feedback
    e('map:isle', 'version', { version: 'v1', sourceHash: 'c', by: 'agent' }),
    e('map:isle', 'approve', { version: 'v1', sourceHash: 'c', by: 'user' }),
    // map bay: a version, waiting
    e('map:bay', 'version', { version: 'v1', sourceHash: 'd', by: 'agent' }),
    // the direction lock and an art asset
    e('maps:direction', 'approve', { version: 'v2', by: 'user' }),
    e('goblin', 'score', { version: 'base.v1', score: 6, tokens: { out: 400 }, wallMs: 120_000, imageTokens: 500, conformance: fail('palette') }),
    e('goblin', 'score', { version: 'base.v2', score: 8, tokens: { edit: 100 }, wallMs: 60_000 }),
    e('goblin', 'score', { version: 'base.v2', score: 8.5, tokens: { edit: 150 }, wallMs: 60_000 }),
    e('goblin', 'review', { version: 'base.v2', imageTokens: 700, by: 'agent' }),
    e('goblin', 'approve', { version: 'base.v2', by: 'user' }),
    e('torch', 'score', { version: 'base.v1', score: 7, tokens: { out: 50 } }),
    e('torch', 'status', { status: 'final' }),
  ];
  const subjects = [
    ...['keep', 'isle', 'bay', 'ghost'].map(id => ({ generator: 'map', key: `map:${id}` })), { generator: 'dungeon', key: 'dungeon:warren' },
    { generator: 'art', key: 'goblin' }, { generator: 'art', key: 'torch' }, { generator: 'art', key: 'orc' },
  ];
  const m = generatorMetrics(ledger, subjects);

  test('one entry per generator that has subjects', () => {
    expect(Object.keys(m)).toEqual(['map', 'dungeon', 'art']);
    expect(m.dungeon).toMatchObject({ subjects: 1, started: 0, final: 0, approved: 0, feedback: 0, imageTokens: 0, outTokens: 0, wallMinutes: 0, checkFailures: {} });
    expect(m.dungeon.passesPerApproved).toBeUndefined();
    expect(m.dungeon.firstPassApproval).toEqual({ approved: 0, untouched: 0 });
  });

  test('maps: versions are the passes; final is an approval or a version waiting for the user', () => {
    expect(m.map).toMatchObject({ subjects: 4, started: 3, final: 3, approved: 2, feedback: 1, imageTokens: 2000, outTokens: 0, wallMinutes: 1.5, checkFailures: { 'require:C-forest': 1 } });
    expect(m.map.passesPerApproved).toBe(1.5);
    expect(m.map.firstPassApproval).toEqual({ approved: 2, untouched: 1, rate: 0.5 });
  });

  test('art: scored passes (the latest score of each version), tokens, a final status entry counts as final', () => {
    expect(m.art).toMatchObject({ subjects: 3, started: 2, final: 2, approved: 1, feedback: 0, imageTokens: 700, outTokens: 600, wallMinutes: 3, checkFailures: { palette: 1 } });
    expect(m.art.passesPerApproved).toBe(2);
    expect(m.art.firstPassApproval).toEqual({ approved: 1, untouched: 1, rate: 1 });
  });

  test('a ledger with no subject lines gives zeros, and the direction lock is nobody\'s', () => {
    const z = generatorMetrics([e('maps:direction', 'approve', { by: 'user' })], [{ generator: 'map', key: 'map:keep' }]);
    expect(z.map).toMatchObject({ subjects: 1, started: 0, approved: 0 });
  });
});

describe('what the art readers see', () => {
  const art: LedgerEntry[] = [e('goblin', 'score', { version: 'base.v1', pass: 'r1', score: 6, tokens: { out: 100 }, conformance: fail('palette') }), e('goblin', 'approve', { version: 'base.v1', by: 'user' })];
  const maps: LedgerEntry[] = [
    e('map:keep', 'score', { version: 'v1', score: 3, reviewer: 'self' }), e('map:keep', 'score', { version: 'v1', score: 9, blind: true }), e('map:keep', 'feedback', { on: 'v1', note: 'x', by: 'user' }),
    e('map:keep', 'status', { status: 'final' }), e('maps:direction', 'approve', { version: 'v1', by: 'user' }),
  ];

  test('analytics and pass records give the same numbers whatever the maps add to the ledger', () => {
    expect(passRecords([...art, ...maps])).toEqual(passRecords(art));
    expect(analytics([...maps, ...art], [{ id: 'goblin', kind: 'character' }])).toEqual(analytics(art, [{ id: 'goblin', kind: 'character' }]));
  });

  test('the Generators table has a row per generator and names the checks failing most', () => {
    const md = generatorsMarkdown(generatorMetrics([...art, ...maps], [{ generator: 'art', key: 'goblin' }, { generator: 'map', key: 'map:keep' }]));
    expect(md).toContain('## Generators');
    expect(md).toContain('| art | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |');
    expect(md).toContain('| map | 1 | 0 | 0 | 0 | - | - | 1 | 0 | 0 |');
    expect(md).toContain('Checks failing most: art palette x1.');
  });
});
