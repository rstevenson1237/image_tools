import { describe, expect, test } from 'vitest';
import { poolExports, type AnalyticsReport, type GeneratorMetrics, type MetricsExport } from 'artgen-core';
import { kpisOf, parseExportFile, trendRows, whereTimeGoes } from './model';

const gen = (o: Partial<GeneratorMetrics> = {}): GeneratorMetrics => ({
  subjects: 4, started: 4, final: 3, approved: 2, passesPerApproved: 4.5, firstPassApproval: { approved: 2, untouched: 1, rate: 0.5 }, feedback: 1, imageTokens: 6000, outTokens: 4000, wallMinutes: 30,
  checkFailures: { line: 3, light: 1, fill: 1, extra: 0 }, ...o,
});
const exp = (repo: string, artgen: string, approved: number, tokens: number): MetricsExport => ({
  schema: 2, repo, artgen, modules: {}, exported: '2026-11-01', maps: { map: 0, dungeon: 0, settlement: 0 },
  assets: { total: approved, final: approved, approved }, totals: { outTokens: tokens / 2, inTokens: 0, imageTokens: tokens / 2, cost: 0, wallMinutes: 10 * approved }, firstPassApproval: { approved, untouched: approved / 2 },
  gateFailures: { line: 2 }, byKind: {}, passes: [], blind: { n: 0 },
});

describe('metrics dashboard model', () => {
  test('KPIs per generator, with the top three failing checks and the stage gates', () => {
    const k = kpisOf({ art: gen({ gates: { shape: { approved: 3, rejected: 1 } }, firstInGameMinutes: 12.34 }), map: gen({ subjects: 0 }) });
    expect(Object.keys(k)).toEqual(['art']);
    const by = Object.fromEntries(k.art.map(x => [x.id, x.value]));
    expect(by.passes).toBe('4.5');
    expect(by.tokens).toBe('5000');
    expect(by.minutes).toBe('15');
    expect(by.first).toBe('50%');
    expect(by.gate).toBe('line ×3, fill ×1, light ×1');
    expect(by['stage-gates']).toBe('shape 3✓ 1✗');
    expect(by['first-in-game']).toBe('12.3 min');
  });

  test('a generator with nothing approved shows dashes, not zeros or NaN', () => {
    const k = kpisOf({ art: gen({ approved: 0, passesPerApproved: undefined, firstPassApproval: { approved: 0, untouched: 0 }, checkFailures: {} }) });
    expect(k.art.map(x => x.value)).toEqual(['–', '–', '–', '–', '–']);
  });

  test('where the time goes: longest first, passes without time left out', () => {
    const rep = { passes: [
      { pass: 'r1', n: 4, regressed: 0, gatePass: 4, outTokens: 0, imageTokens: 0, meanWallS: 60 },
      { pass: 'finish', n: 2, regressed: 0, gatePass: 2, outTokens: 0, imageTokens: 0, meanWallS: 180 },
      { pass: 'r2', n: 4, regressed: 0, gatePass: 4, outTokens: 0, imageTokens: 0 },
    ] } as unknown as AnalyticsReport;
    expect(whereTimeGoes(rep)).toEqual([{ pass: 'finish', minutes: 6, share: 0.6 }, { pass: 'r1', minutes: 4, share: 0.4 }]);
  });

  test('a dropped export is checked as the CLI checks it', () => {
    expect(parseExportFile('a.json', JSON.stringify(exp('r', '0.12.0', 2, 1000))).repo).toBe('r');
    expect(() => parseExportFile('a.json', 'nope')).toThrow('a.json: not JSON');
    expect(() => parseExportFile('a.json', '{"schema":3,"repo":"r","artgen":"1"}')).toThrow('a.json: not an artgen metrics export (schema 1 or 2)');
  });

  test('the trend shows each version against the one before it', () => {
    const pool = poolExports([exp('a', '0.11.0', 4, 40000), exp('b', '0.11.0', 4, 40000), exp('a', '0.12.0', 4, 30000)]);
    const rows = trendRows(pool.versions);
    expect(rows.map(r => [r.artgen, r.repos, r.tokensPerApproved, r.tokensChange])).toEqual([['0.11.0', 2, 10000, undefined], ['0.12.0', 1, 7500, -0.25]]);
  });
});
