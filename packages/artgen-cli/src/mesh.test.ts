// True 3D output and the converters on the command line (R7a, docs/MESHES.md): every 3D-mode bench asset meshes under its
// budget and passes the mesh checks, the .glb reads back, and outside .glb / .vox files and pictures come in as an
// asset's next base that renders and passes the gate.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, decodeVox, encodePNG, glbTriangles, Grid, parseLedger, readGlb } from 'artgen-core';
import { openAsset } from './asset.ts';
import { BENCH_ROOT } from './bench.ts';
import { main } from './cli.ts';
import { meshExport } from './mesh.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

const BENCH_3D = ['p6/car', 'p6/house', 'p6/imp', 'p6/skeleton', 'p6/isohero-toon', 'p6/isospider-toon', 'pipeline/isochest'];

describe('artgen mesh on the bench', () => {
  test('every 3D-mode bench asset meshes under its budget, passes the mesh checks, and its .glb reads back', async () => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-mesh-'));
    for (const id of BENCH_3D) {
      const a = openAsset(join(BENCH_ROOT, id)), r = await meshExport(a, { out });
      expect(r.checks.filter(c => c.status === 'fail'), id).toEqual([]);
      expect(r.triangles, id).toBeLessThanOrEqual(r.budget);
      const g = readGlb(new Uint8Array(readFileSync(r.glb)));
      expect(glbTriangles(g).positions.length / 9, id).toBe(r.triangles);
      expect(g.json.nodes[0].name).toBe(a.brief.id);
      const tt = decodePNG(new Uint8Array(readFileSync(r.turntable)));
      expect([tt.w, tt.h], id).toEqual([8 * 97 - 1, 96]);
    }
  }, 120_000);
});

/** A closed 1 × 1 × 2 m box as a .glb, its sides red and its top blue (one primitive each, base colour factors). */
function boxGlb(): Uint8Array {
  const v = (x: number, y: number, z: number) => [x - 0.5, y, z - 0.5];
  const corners = [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1), v(0, 2, 0), v(1, 2, 0), v(1, 2, 1), v(0, 2, 1)];
  const sides = [[0, 1, 5, 0, 5, 4], [1, 2, 6, 1, 6, 5], [2, 3, 7, 2, 7, 6], [3, 0, 4, 3, 4, 7], [3, 2, 1, 3, 1, 0]].flat(), top = [4, 5, 6, 4, 6, 7];
  const pos = new Float32Array(corners.flat()), a = new Uint16Array(sides), b = new Uint16Array(top);
  const bin = new Uint8Array(pos.byteLength + a.byteLength + b.byteLength + 4);
  bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(a.buffer), pos.byteLength); bin.set(new Uint8Array(b.buffer), pos.byteLength + a.byteLength);
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ children: [1] }, { mesh: 0, translation: [0, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }, { attributes: { POSITION: 0 }, indices: 2, material: 1 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.7, 0.06, 0.02, 1] } }, { pbrMetallicRoughness: { baseColorFactor: [0.05, 0.1, 0.6, 1] } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: a.length, type: 'SCALAR' }, { bufferView: 2, componentType: 5123, count: b.length, type: 'SCALAR' },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: a.byteLength }, { buffer: 0, byteOffset: pos.byteLength + a.byteLength, byteLength: b.byteLength }],
    buffers: [{ byteLength: bin.length }],
  };
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jb = new TextEncoder().encode(text), total = 28 + jb.length + bin.length, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
  dv.setUint32(20 + jb.length, bin.length, true); dv.setUint32(24 + jb.length, 0x004e4942, true); out.set(bin, 28 + jb.length);
  return out;
}

describe('mesh, turntable, convert and extrude in a game repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-mesh-repo-')), R = ['--root', root], at = (...p: string[]) => join(root, ...p);
  beforeAll(async () => {
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Damp crypt crawler: knights, barrels and torchlight.', ...R);
    await run('direction', 'lock', 'a', ...R);
    await run('brief', 'add', 'crate', '--kind', 'prop', '--view', 'iso', '--notes', 'a wooden crate with metal bands', ...R);
    await run('new', 'crate', '--kind', 'prop', '--view', 'iso', ...R);
    writeFileSync(at('box.glb'), boxGlb());
  }, 60_000);

  test('mesh exports the asset; a budget too small fails its check and the command', async () => {
    const r = await json('mesh', 'crate', ...R);
    expect(r).toMatchObject({ asset: 'crate', version: 'base.v1', budget: 1500, mode: 'auto', look: 'pbr' });
    expect(existsSync(at(r.glb.replace(/^.*?art\//, 'art/')))).toBe(true);
    const tiny = await run('mesh', 'crate', '--budget', '20', ...R);
    expect(tiny.code).toBe(1);
    expect(tiny.out).toContain('FAIL mesh-budget');
    const tt = await json('turntable', 'crate', '--source', 'voxel', '--angles', '4', '--size', '48', ...R);
    expect(tt).toMatchObject({ source: 'voxel', size: [4 * 49 - 1, 48] });
  });

  test('convert voxelises a .glb at its own size, in the direction\'s ramps', async () => {
    const r = await json('convert', at('box.glb'), ...R);
    const vox = decodeVox(new Uint8Array(readFileSync(at('box.vox'))));
    // 2 m at the direction's pixels per metre ÷ 2 px a unit, k = 1
    expect(vox.size[2]).toBe(r.size[2]);
    expect(r.size[2]).toBeGreaterThan(10);
    expect(vox.voxels).toHaveLength(r.size[0] * r.size[1] * r.size[2]);
    expect(Object.values(r.mats)).toHaveLength(2);
    const mesh = await json('convert', at('box.glb'), '--to', 'mesh', '--height', '1', ...R);
    expect(mesh.size[2]).toBe(Math.round(r.size[2] / 2));
    expect(glbTriangles(readGlb(new Uint8Array(readFileSync(at('box.mesh.glb'))))).positions.length / 9).toBe(mesh.triangles);
  });

  test('convert --asset writes the next base, which renders and passes the gate, and records its source', async () => {
    const r = await json('convert', at('box.glb'), '--asset', 'crate', '--height', '1', ...R);
    expect(r).toMatchObject({ asset: 'crate', version: 'base.v2' });
    const src = readFileSync(r.file, 'utf8');
    expect(src).toContain('ctx.lib.t2.vox(VOX)');
    expect(src).toContain("view: \"iso\"");
    const rendered = await json('render', 'crate', '--version', 'base.v2', ...R);
    expect(rendered.checks.filter((c: { status: string }) => c.status === 'fail')).toEqual([]);
    const note = parseLedger(readFileSync(at('art', 'ledger.jsonl'), 'utf8')).filter(e => e.type === 'note' && e.version === 'base.v2').pop()!;
    expect(note.source).toMatchObject({ tool: 'convert', from: 'box.glb', height: 1, k: 1 });
    expect((note.source as { sha256: string }).sha256).toMatch(/^[0-9a-f]{16}$/);
    // the converted base is a 3D-mode asset like any other: it meshes
    expect((await json('mesh', 'crate', ...R)).version).toBe('base.v2');
    // and a .vox round-trips into the asset at its height
    const v = await json('convert', at('box.vox'), '--asset', 'crate', ...R);
    expect(v.version).toBe('base.v3');
    expect((await json('render', 'crate', '--version', 'base.v3', ...R)).checks.filter((c: { status: string }) => c.status === 'fail')).toEqual([]);
  });

  test('extrude stands a picture up as a slab with depth', async () => {
    const g = new Grid(12, 20);
    g.fill(4, 0, 4, 20, '#8a6038'); g.fill(0, 4, 12, 3, '#a0a8b0');
    writeFileSync(at('sign.png'), encodePNG(g));
    const r = await json('extrude', at('sign.png'), '--depth', '3', ...R);
    expect(r.size).toEqual([12, 3, 20]);
    expect(decodeVox(new Uint8Array(readFileSync(at('sign.vox')))).voxels).toHaveLength((4 * 20 + 8 * 3) * 3);
    const b = await json('extrude', at('sign.png'), '--asset', 'crate', ...R);
    expect(b).toMatchObject({ version: 'base.v4', k: 2 });
    expect((await json('render', 'crate', '--version', 'base.v4', ...R)).pass).toBe(true);
    // an asset's own render, extruded
    const own = await json('extrude', 'crate', '--to', 'mesh', ...R);
    expect(own.file).toContain('crate-extruded.mesh.glb');
    await expect(run('extrude', at('sign.png'), '--depth', '0', ...R)).rejects.toThrow('--depth');
    await expect(run('convert', at('sign.png'), ...R)).rejects.toThrow('.glb and .vox');
    await expect(run('convert', at('nope.glb'), ...R)).rejects.toThrow('not found');
    await expect(run('extrude', at('nope.png'), ...R)).rejects.toThrow('not found');
  });
});
