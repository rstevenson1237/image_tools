// The P1b parity experiment and the pass pipeline on disk: every scored version still renders what was scored
// (R10), the pipeline state of each asset, restyle from tokens, variants, and a pass cycle in a scratch asset dir.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { kindPalette, latestScores, parseLedger, validateDirection } from 'artgen-core';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import { ledgerFor, openAsset, passState, renderVersion, versionsIn, type AssetDir } from './asset.ts';
import { BENCH_ROOT } from './bench.ts';
import { main } from './cli.ts';
import { assetDirs, report } from './report.ts';

const PIPELINE = join(BENCH_ROOT, 'pipeline');
const assets: AssetDir[] = assetDirs(PIPELINE).map(p => openAsset(p));
const finalOf = (a: AssetDir) => versionsIn(a).filter(v => v.startsWith('finish.')).pop()!;

describe('P1b parity experiment (bench/pipeline)', () => {
  test('six assets, each through r1–r3 and the finishing pass, ready for the user, no stale finish', async () => {
    expect(assets.map(a => a.brief.id).sort()).toEqual(['hero', 'isochest', 'isohero', 'isospider', 'ship', 'tank']);
    for (const a of assets) {
      const st = await passState(a);
      expect({ id: a.brief.id, passes: st.rows.map(r => `${r.pass}:${r.score !== undefined}`), next: st.next.action, stale: st.stale })
        .toEqual({ id: a.brief.id, passes: ['r1:true', 'r2:true', 'r3:true', 'f:true'], next: 'ready', stale: undefined });
    }
  });

  test('every scored version renders exactly what was scored (R10) and passes the gate', async () => {
    for (const a of assets) for (const [version] of latestScores(ledgerFor(a))) {
      const e = [...ledgerFor(a)].reverse().find(x => x.type === 'score' && x.version === version)!, r = await renderVersion(a, version);
      expect({ asset: a.brief.id, version, hash: r.strip.hash(), gate: r.report.pass }).toEqual({ asset: a.brief.id, version, hash: e.outputHash, gate: true });
    }
  });

  test('the report reproduces the ledger: per-pass rows, gains and which assets met their artlab target', async () => {
    const r = await report(PIPELINE);
    expect(r.summaries).toHaveLength(6);
    const by = Object.fromEntries(r.summaries.map(s => [s.id, s]));
    expect(by.hero).toMatchObject({ target: 7.5, r1: 5.5, finish: 7.5, met: true });
    expect(r.summaries.filter(s => !s.met).map(s => s.id).sort()).toEqual(['isohero', 'ship']);
    expect(r.markdown).toContain('| tank | r2 | base.v2 | 7.5 |');
    for (const s of r.summaries) expect(s.cost).toBeGreaterThan(0);
  });

  test('restyle: every final re-renders under the alt direction from tokens alone and passes conformance', async () => {
    const bench = new Set(kindPalette(validateDirection(BENCH_DIRECTIONS.benchmark).direction!));
    for (const a of assets) {
      const alt = openAsset(a.path, { direction: 'alt' }), v = finalOf(a);
      const [b, r] = [await renderVersion(a, v), await renderVersion(alt, v)];
      expect({ id: a.brief.id, failed: r.report.checks.filter(c => c.status === 'fail') }).toEqual({ id: a.brief.id, failed: [] });
      expect(r.strip.hash()).not.toBe(b.strip.hash());
      const ix = r.strip.toIndexed();
      expect(ix.palette.filter((c, i) => ix.alphas[i] === 255 && bench.has(c))).toEqual([]);
    }
  });

  test('8-variant sheets show at least 6 distinct designs per asset (param schema)', async () => {
    for (const a of assets) {
      const v = versionsIn(a).filter(x => x.startsWith('base.') && /export const params/.test(readFileSync(join(a.path, `${x}.js`), 'utf8'))).pop()!;
      const hashes = new Set<string>();
      for (let k = 0; k < 8; k++) hashes.add((await renderVersion(a, v, { variant: k })).strip.hash());
      expect({ id: a.brief.id, distinct: hashes.size >= 6 }).toEqual({ id: a.brief.id, distinct: true });
    }
  });
});

describe('pass cycle in a scratch asset directory', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'artgen-p1b-'));
    writeFileSync(join(dir, 'direction.json'), JSON.stringify(BENCH_DIRECTIONS.benchmark));
    writeFileSync(join(dir, 'ledger.jsonl'), '');
    const asset = join(dir, 'crate');
    mkdirSync(asset);
    writeFileSync(join(asset, 'brief.json'), JSON.stringify({ id: 'crate', kind: 'prop', size: [16, 16], review: { scale: 4 } }));
  });
  const base = (shade: string) => `export function render(ctx) {
  const s = ctx.lib.t2.scene(16, 16);
  s.add({ type: 'rect', x: 2, y: 3, w: 12, h: 10, r: 1, mat: 'wood', shade: '${shade}', underlay: true });
  s.add({ type: 'rect', x: 2, y: 7, w: 12, h: 1, mat: 'gold', shade: 'flat' });
  return ctx.lib.proc(s).render();
}
export const anchors = () => ({ lock: [8, 7] });
`;

  test('next → write v1 → review → score → next revises from the best → finish → ready', async () => {
    const asset = join(dir, 'crate'), log: string[] = [], orig = console.log;
    console.log = (...m: unknown[]) => { log.push(m.join(' ')); };
    try {
      await main(['pass', 'next', asset]); expect(log.pop()).toMatch(/^write-base base\.v1/);
      writeFileSync(join(asset, 'base.v1.js'), base('bevel'));
      await main(['pass', 'next', asset]); expect(log.pop()).toMatch(/^review base\.v1/);
      expect(await main(['review', asset])).toBe(0);
      expect(await main(['score', asset, 'base.v1', '6', '--note', 'ok'])).toBe(0);
      await main(['pass', 'next', asset]); expect(log.pop()).toMatch(/^write-base base\.v2 .*base\.v1 \(6\)/);
      writeFileSync(join(asset, 'base.v2.js'), base('normal'));
      await main(['score', asset, 'base.v2', '5']);
      await main(['pass', 'next', asset]); expect(log.pop()).toMatch(/^write-base base\.v3 .*base\.v1 \(6\)/);
      writeFileSync(join(asset, 'base.v3.js'), base('linear'));
      await main(['score', asset, 'base.v3', '6.5']);
      await main(['pass', 'next', asset]); expect(log.pop()).toMatch(/^write-finish finish\.v1 .*base\.v3/);
      writeFileSync(join(asset, 'finish.v1.js'), "export const base = 'base.v3';\nexport function finish(g, ctx) { ctx.lib.px.patch(g, ctx.at('lock'), ['k'], { k: 'steel.0' }); return g; }\n");
      await main(['score', asset, 'finish.v1', '7']);
      await main(['pass', 'status', asset]);
      expect(log.pop()).toMatch(/next: ready/);
    } finally { console.log = orig; }
    const ledger = parseLedger(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'));
    expect(ledger.filter(e => e.type === 'score').map(e => `${e.version}:${e.pass}:${e.score}`)).toEqual(['base.v1:r1:6', 'base.v2:r2:5', 'base.v3:r3:6.5', 'finish.v1:f:7']);
    expect(ledger.find(e => e.type === 'review')).toMatchObject({ version: 'base.v1', pass: 'r1', sheet: 'crate/out/review-base.v1.png' });
    expect(ledger.find(e => e.version === 'base.v1' && e.type === 'score')).toMatchObject({ imageTokens: expect.any(Number), tokens: { code: expect.any(Number), edit: expect.any(Number) } });
    const snap = JSON.parse(readFileSync(join(asset, 'finish.v1.snapshot.json'), 'utf8'));
    expect(snap).toEqual([expect.objectContaining({ cell: 'idle/s/0', anchor: 'lock', under: ['gold.1'] })]);
    // a base whose pixels change under the patch makes the finish stale
    writeFileSync(join(asset, 'base.v3.js'), base('linear').replace("y: 7, w: 12, h: 1, mat: 'gold'", "y: 5, w: 12, h: 1, mat: 'gold'"));
    expect((await passState(openAsset(asset))).stale).toEqual(['idle/s/0#lock: 100% of the pixels under the patch changed']);
  });
});
