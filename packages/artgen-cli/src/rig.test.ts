// Rigged 3D output on the command line (R7b, docs/RIGS3D.md): the rigged template's sprites keep their bones in every cell,
// `artgen rig` turns the bench's rigged biped into a skinned .glb with a clip per state and levels of detail, and an asset
// that isn't rigged is told how to become one.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, generateCandidates, readGlb, renderAsset, rigChecks, validateBrief, type AssetModule, type Brief } from 'artgen-core';
import { openAsset } from './asset.ts';
import { BENCH_ROOT } from './bench.ts';
import { main } from './cli.ts';
import { rigExport } from './mesh.ts';
import { initNodeSvg } from './node.ts';
import { templatesRoot } from './templates.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  const err = vi.spyOn(console, 'error').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); err.mockRestore(); }
};
afterEach(() => vi.restoreAllMocks());
const HERO = join(BENCH_ROOT, 'r7', 'rigged-hero');

describe('the rigged 3D template', () => {
  beforeAll(async () => { await initNodeSvg(); });

  test('every state × facing × frame keeps its bone lengths, carries head and hand, and the face only from the front', async () => {
    const [dir] = generateCandidates({ pitch: 'First-person crawler: billboard ghouls in torchlit corridors.' });
    const mod = await import(pathToFileURL(join(templatesRoot(), 'fp/character-rigged/base.js')).href) as AssetModule;
    const brief = { id: 'hero', kind: 'character', view: 'fp', size: [32, 48], states: ['idle', 'walk', 'attack', 'hurt'], directions: 8, anims: { walk: { frames: 4 }, attack: { frames: 4 }, hurt: { frames: 2 } } } as Brief;
    const r = renderAsset(mod, { dir, brief });
    expect(r.cells).toHaveLength(8 + 8 * 4 + 8 * 4 + 8 * 2);
    expect(rigChecks(r).map(c => [c.id, c.status])).toEqual([['rig-lengths', 'pass']]);
    for (const c of r.cells) {
      expect(c.anchors?.head, `${c.state}/${c.facing}/${c.frame}`).toBeDefined();
      expect(c.anchors?.hand, `${c.state}/${c.facing}/${c.frame}`).toBeDefined();
      expect(!!c.anchors?.eye).toBe(c.facing === 's');
    }
    // the walk moves the figure, the facings turn it
    const px = (state: string, facing: string, frame: number) => r.cells.find(c => c.state === state && c.facing === facing && c.frame === frame)!.grid.d.join(',');
    expect(px('walk', 's', 0)).not.toBe(px('walk', 's', 1));
    expect(px('idle', 's', 0)).not.toBe(px('idle', 'e', 0));
  });
});

describe('artgen rig', () => {
  test('the bench\'s rigged biped: a skinned .glb with a clip per state, three levels, and every check passing', async () => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-rig-')), { code, out: text } = await run('rig', HERO, '--out', out);
    expect(code, text).toBe(0);
    expect(text).toMatch(/^rigged-hero base\.v1: biped rig, 12 bones; LOD0 \d+\/4000, LOD1 \d+\/1000, LOD2 \d+\/250/);
    expect(text).toMatch(/clips: idle 2s loop, walk 0\.5s loop, attack 0\.5s, hurt 0\.25s/);
    expect(text).not.toMatch(/FAIL/);
    const g = readGlb(new Uint8Array(readFileSync(join(out, 'rigged-hero.rigged.glb')))), j = g.json;
    expect(j.animations.map((a: any) => a.name)).toEqual(['idle', 'walk', 'attack', 'hurt']);
    expect(j.skins[0].joints).toHaveLength(12);
    expect(j.nodes.filter((n: any) => n.skin === 0).map((n: any) => n.name)).toEqual(['rigged-hero_LOD0', 'rigged-hero_LOD1', 'rigged-hero_LOD2']);
    expect(j.extras.artgen.rig).toMatchObject({ plan: 'biped', set: 'biped' });
    expect(j.extras.artgen.clips.attack).toEqual({ duration: 0.5, loop: false, keys: 16 });
    // the model stands on the origin, about as tall as the brief says
    const pos = j.accessors[j.meshes[0].primitives[0].attributes.POSITION];
    expect(pos.min[1]).toBeGreaterThan(-0.1);
    expect(pos.max[1]).toBeGreaterThan(1.8 * 0.85);
    expect(pos.max[1]).toBeLessThan(1.8 * 1.2);
    const strip = decodePNG(new Uint8Array(readFileSync(join(out, 'rigged-hero-clips.png'))));
    expect([strip.w, strip.h]).toEqual([6 * 73 - 1, 4 * 97 - 1]);
  }, 60_000);

  test('the brief\'s mesh.lods and mesh.keys, and the command line over them', async () => {
    const d = mkdtempSync(join(tmpdir(), 'artgen-rig-')), hero = join(d, 'r7', 'rigged-hero');
    cpSync(join(BENCH_ROOT, 'r7'), join(d, 'r7'), { recursive: true, filter: f => !f.includes('/out') });
    cpSync(join(BENCH_ROOT, 'p6', 'direction.json'), join(d, 'p6', 'direction.json'));
    const b = JSON.parse(readFileSync(join(hero, 'brief.json'), 'utf8'));
    writeFileSync(join(hero, 'brief.json'), JSON.stringify({ ...b, states: ['idle', 'walk'], mesh: { budget: 1200, lods: 1, keys: 8 } }));
    const r = await rigExport(openAsset(hero), { out: join(d, 'out') });
    expect(r.lods.map(l => l.budget)).toEqual([1200]);
    expect(r.states.map(s => s.state)).toEqual(['idle', 'walk']);
    expect(readGlb(new Uint8Array(readFileSync(r.glb))).json.extras.artgen.clips.walk.keys).toBe(8);
    expect((await rigExport(openAsset(hero), { out: join(d, 'out'), lods: 2, keys: 4 })).lods.map(l => l.budget)).toEqual([1200, 300]);
    expect(validateBrief({ id: 'x', kind: 'character', mesh: { lods: 5, keys: 1 } })).toEqual(['brief x: mesh.lods must be 1, 2, 3 or 4', 'brief x: mesh.keys must be a whole number of samples per clip (2–120)']);
    expect(validateBrief({ id: 'x', kind: 'character', mesh: { lods: 2, keys: 24 } })).toEqual([]);
  }, 60_000);

  test('a 3D-mode asset that isn\'t built along a rig is told how to become one', async () => {
    await expect(run('rig', join(BENCH_ROOT, 'p6', 'imp'))).rejects.toThrow(/not a rigged model .*ctx\.lib\.rigs\.body3d.*fp\/character-rigged/);
  }, 60_000);
});
