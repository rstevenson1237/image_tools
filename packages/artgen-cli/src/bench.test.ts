// The artlab parity benchmark (PLAN P1 accept): golden hashes, conformance under two directions, parity with artlab.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { kindPalette, lintSource, validateDirection } from 'artgen-core';
import { BENCH_ASSETS, BENCH_DIRECTIONS } from 'artgen-core/bench';
import { BENCH_ROOT, benchSource, GOLDEN_PATH, resolveDirection, runBench, type BenchResult } from './bench.ts';
import { main } from './cli.ts';

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Record<string, Record<string, string>>;
const runs: Record<string, BenchResult[]> = {};
beforeAll(async () => {
  for (const name of Object.keys(BENCH_DIRECTIONS)) runs[name] = await runBench(resolveDirection(name));
});
const by = (name: string, id: string) => runs[name].find(r => r.asset.id === id)!;

describe.each(Object.keys(BENCH_DIRECTIONS))('benchmark under %s', name => {
  test('all six assets render and match their golden hashes', () => {
    expect(runs[name].map(r => r.asset.id)).toEqual(BENCH_ASSETS.map(a => a.id));
    expect(Object.fromEntries(runs[name].map(r => [r.asset.id, r.hash]))).toEqual(golden[name]);
  });

  test('all six pass the conformance gate', () => {
    for (const r of runs[name]) expect({ id: r.asset.id, failed: r.report.checks.filter(c => c.status === 'fail') }).toEqual({ id: r.asset.id, failed: [] });
  });
});

describe('parity with artlab (benchmark direction)', () => {
  test('T1 ports are pixel-identical to the artlab finals', () => {
    expect(by('benchmark', 'hero').referenceDiff).toBe(0);
    expect(by('benchmark', 'isohero').referenceDiff).toBe(0);
  });

  test('T4 chest differs only where artlab flattened its ground shadow to opaque black', () => {
    const r = by('benchmark', 'isochest');
    const ref = new Uint8Array(readFileSync(join(BENCH_ROOT, 'reference', 'isochest.png')));
    expect(ref.length).toBeGreaterThan(0);
    expect(r.referenceDiff).toBe(22);
    let shadowOnly = 0;
    for (let i = 0; i < r.strip.d.length; i += 4) if (r.strip.d[i + 3] === 89 && !r.strip.d[i] && !r.strip.d[i + 1] && !r.strip.d[i + 2]) shadowOnly++;
    expect(shadowOnly).toBe(22);
  });

  test('T3 ports on resvg stay within 2% of artlab pixels (Skia vs resvg AA)', () => {
    for (const id of ['ship', 'tank', 'isospider']) {
      const r = by('benchmark', id);
      expect(r.referenceDiff! / (r.strip.w * r.strip.h)).toBeLessThan(0.02);
    }
  });
});

describe('restyle from direction tokens alone', () => {
  test('every asset changes under the alt direction, with a different outline and palette', () => {
    const b = BENCH_DIRECTIONS.benchmark, a = BENCH_DIRECTIONS.alt;
    expect(a.palette.outline).not.toBe(b.palette.outline);
    const benchColours = new Set(kindPalette(validateDirection(b).direction!));
    for (const id of BENCH_ASSETS.map(x => x.id)) {
      const alt = by('alt', id).strip, ix = alt.toIndexed();
      expect(by('benchmark', id).hash).not.toBe(by('alt', id).hash);
      expect(ix.palette.filter((c, i) => ix.alphas[i] === 255 && benchColours.has(c))).toEqual([]);
      expect(ix.palette).toContain(a.palette.outline);
    }
  });
});

test('benchmark sources contain no colour literals (R11)', () => {
  for (const a of BENCH_ASSETS) expect({ file: a.file, hits: lintSource(benchSource(a)) }).toEqual({ file: a.file, hits: [] });
});

test('artgen direction validate', async () => {
  expect(await main(['direction', 'validate', join(BENCH_ROOT, 'directions', 'alt.json')])).toBe(0);
  expect(await main(['direction', 'validate', join(BENCH_ROOT, 'assets', 'hero.js').replace('hero.js', '../golden.json')])).toBe(1);
});
