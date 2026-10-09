// PLAN P6 benchmarks on disk (packages/artgen-core/bench/p6): every asset went through r1–r3 + finish and is ready,
// every scored version still renders what was scored (R10), finals pass the gate; voxel exports from a 3D asset.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { decodeVox, latestScores, readGlbJson } from 'artgen-core';
import { ledgerFor, openAsset, passState, renderVersion, type AssetDir } from './asset.ts';
import { BENCH_ROOT } from './bench.ts';
import { voxelExport } from './p6.ts';
import { assetDirs } from './report.ts';

const P6 = join(BENCH_ROOT, 'p6');
const assets: AssetDir[] = assetDirs(P6).map(p => openAsset(p));

describe('P6 benchmarks (bench/p6)', () => {
  test('every asset ran the whole pipeline and is ready for the user', async () => {
    expect(assets.length).toBeGreaterThanOrEqual(6);
    for (const a of assets) {
      const st = await passState(a);
      expect({ id: a.brief.id, next: st.next.action, stale: st.stale, f: st.rows.some(r => r.pass === 'f' && r.score !== undefined) }).toEqual({ id: a.brief.id, next: 'ready', stale: undefined, f: true });
    }
  });

  test('every scored version renders exactly what was scored (R10); the finals pass the gate and meet their target', async () => {
    for (const a of assets) {
      const scores = latestScores(ledgerFor(a));
      for (const [version] of scores) {
        const e = [...ledgerFor(a)].reverse().find(x => x.type === 'score' && x.version === version && !x.blind)!, r = await renderVersion(a, version);
        expect({ asset: a.brief.id, version, hash: r.strip.hash() }).toEqual({ asset: a.brief.id, version, hash: e.outputHash });
        if (version.startsWith('finish.')) {
          expect(r.report.pass, `${a.brief.id} ${version}`).toBe(true);
          expect(scores.get(version)!.score, `${a.brief.id} target`).toBeGreaterThanOrEqual(a.brief.target ?? 6.5);
        }
      }
    }
  }, 120_000);
});

describe('artgen voxel', () => {
  test('exports the 3D model behind a render as .vox and .glb', async () => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-vox-')), a = openAsset(join(P6, 'car'));
    const r = await voxelExport(a, { version: 'base.v3', out });
    expect(r.voxels).toBeGreaterThan(100);
    const vox = decodeVox(new Uint8Array(readFileSync(join(out, 'car.vox'))));
    expect(vox.voxels).toHaveLength(r.voxels);
    expect(vox.size).toEqual(r.size);
    const glb = readGlbJson(new Uint8Array(readFileSync(join(out, 'car.glb'))));
    expect(glb.meshes[0].primitives.length).toBe(r.materials);
    await expect(voxelExport(openAsset(join(P6, 'forest')), { out })).rejects.toThrow('no 3D-mode scene');
  });
});
