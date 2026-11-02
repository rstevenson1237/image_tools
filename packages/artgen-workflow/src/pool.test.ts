import { describe, expect, test } from 'vitest';
import { poolExports, poolMarkdown, type MetricsExport } from './pool.ts';

const exp = (repo: string, artgen: string, exported: string, approved: number, tokens: number): MetricsExport => ({
  schema: 2, repo, artgen, modules: {}, exported, maps: { map: 0, dungeon: 0, settlement: 0 },
  assets: { total: approved, final: approved, approved }, totals: { outTokens: tokens, inTokens: 0, imageTokens: 0, cost: 0, wallMinutes: 5 * approved },
  firstPassApproval: { approved, untouched: approved / 2 }, gateFailures: { line: 2 }, byKind: {}, passes: [], blind: { n: 0 },
});

describe('poolExports', () => {
  test('puts exports side by side per artgen version, oldest first, over the repos that have it', () => {
    const p = poolExports([exp('b', '0.12.0', '2026-11-01', 2, 6000), exp('a', '0.11.0', '2026-10-30', 4, 40000), exp('a', '0.12.0', '2026-11-01', 2, 10000)]);
    expect(p.exports).toBe(3);
    expect(p.repos).toEqual(['a', 'b']);
    expect(p.versions.map(v => [v.artgen, v.repos, v.approved, v.tokensPerApproved])).toEqual([['0.11.0', ['a'], 4, 10000], ['0.12.0', ['a', 'b'], 4, 4000]]);
    expect(p.versions[1].topGateFailures).toEqual([{ check: 'line', n: 4 }]);
  });

  test('two exports of one repo at one version count once, the latest day winning', () => {
    const p = poolExports([exp('a', '0.12.0', '2026-10-30', 2, 20000), exp('a', '0.12.0', '2026-11-01', 2, 8000)]);
    expect(p.exports).toBe(1);
    expect(p.versions[0].tokensPerApproved).toBe(4000);
  });

  test('an empty pool and its markdown', () => {
    const p = poolExports([]);
    expect(p).toEqual({ exports: 0, repos: [], versions: [] });
    expect(poolMarkdown(p)).toContain('0 exports from 0 repos: —.');
  });
});
