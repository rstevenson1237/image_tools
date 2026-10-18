// Character templates and the face-first finish: the face and hand anchors sit on the drawn pixels in every cell,
// the finish paints a per-state face there (and nothing on back views), and `artgen finish` picks the template by kind.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { applyFinish, conformance, generateCandidates, renderAsset, type AssetModule, type Brief, type FinishModule, type Grid } from 'artgen-core';
import { initNodeSvg } from './node.ts';
import { findTemplate, finishTemplate, newFinish, templatesRoot } from './templates.ts';

const load = async <T>(rel: string): Promise<T> => import(pathToFileURL(join(templatesRoot(), rel)).href) as Promise<T>;
const [dir] = generateCandidates({ pitch: 'Grim swamp roguelike: bog goblins in the fog.' });

/** Pixels where two renders of the same cell differ. */
const diff = (a: Grid, b: Grid) => { const out: [number, number][] = []; for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.get(x, y) !== b.get(x, y)) out.push([x, y]); return out; };

describe('character templates + finish-character.js', () => {
  let finish: FinishModule;
  beforeAll(async () => { await initNodeSvg(); finish = await load<FinishModule>('finish-character.js'); });

  const cases: [string, Brief][] = [
    ['topdown/character-walk/base.js', { id: 'walker', kind: 'character', states: ['idle', 'walk', 'attack', 'hurt'], directions: 8, anims: { walk: { frames: 4 }, attack: { frames: 2 } } }],
    ['topdown/character/base.js', { id: 'front', kind: 'character', states: ['idle', 'hurt'] }],
    ['iso/character/base.js', { id: 'iso', kind: 'character', size: [32, 32], states: ['idle', 'attack'], anims: { attack: { frames: 2 } } }],
  ];

  test.each(cases)('%s: face anchors on the drawn eyes; the finish paints a per-state face and leaves back views alone', async (file, brief) => {
    const mod = await load<AssetModule>(file), r = renderAsset(mod, { dir, brief }), out = applyFinish(r, finish, dir).render.cells;
    const faced = r.cells.filter(c => c.anchors?.eye);
    expect(faced.length).toBeGreaterThan(0);
    for (const c of r.cells) {
      const k = `${c.state}/${c.facing}/${c.frame}`;
      expect(c.anchors?.hand, k).toBeDefined();
      for (const e of ['eye', 'eye2'] as const) if (c.anchors?.[e]) expect(c.grid.get(...c.anchors[e]!), `${k} ${e}`).toBe(dir.palette.outline);
      if (c.anchors?.mouth) expect(c.grid.get(...c.anchors.mouth), `${k} mouth`).not.toBeNull();
    }
    // back views (no face anchors) get the clean-up ops and nothing else
    const clean = applyFinish(r, { finish: (g, ctx) => { ctx.lib.px.fix.orphans(g); ctx.lib.px.fix.jaggies(g); return g; } } as FinishModule, dir).render.cells;
    out.forEach((c, i) => { if (!c.anchors?.eye) expect(diff(clean[i].grid, c.grid), `${c.state}/${c.facing}/${c.frame}`).toEqual([]); });
    // the face differs between calm and the other moods on the same facing
    const face = (state: string) => out.find(c => c.state === state && c.facing === 's' && c.frame === 0)!.grid;
    for (const s of brief.states!.filter(s => s !== 'idle' && s !== 'walk')) expect(diff(face('idle'), face(s)).length, s).toBeGreaterThan(0);
  });

  test('artgen finish starts characters and creatures from the face-first template, everything else from the generic one', () => {
    expect(finishTemplate('character')).toMatch(/finish-character\.js$/);
    expect(finishTemplate('creature')).toMatch(/finish-character\.js$/);
    expect(finishTemplate('prop')).toMatch(/[\\/]finish\.js$/);
    const d = mkdtempSync(join(tmpdir(), 'artgen-finish-'));
    writeFileSync(join(d, 'brief.json'), JSON.stringify({ id: 'x', kind: 'creature' }));
    expect(readFileSync(newFinish(d, 1, 'base.v2'), 'utf8')).toMatch(/^\/\/ finish\.v1 \(f\) on base\.v2 — character finish/);
    expect(readFileSync(newFinish(d, 2, 'base.v2', 'prop'), 'utf8')).toMatch(/^\/\/ finish\.v2 \(f\) on base\.v2 — the one direct-pixel pass/);
  });
});

describe('body rigs and the iso walker (0.10.0)', () => {
  beforeAll(async () => { await initNodeSvg(); });
  const rigs = ['quadruped', 'serpent', 'flyer', 'large'].flatMap(b => ['topdown', 'iso'].map(v => `${v}/creature-${b}`));

  test.each([...rigs, 'iso/character-walk'])('%s renders four facings and a walk on the palette, with face anchors on drawn eyes', async t => {
    const mod = await load<AssetModule>(`${t}/base.js`), size: [number, number] = t.endsWith('large') ? [64, 64] : [32, 32];
    const brief: Brief = { id: 'rig', kind: t.endsWith('walk') ? 'character' : 'creature', size, states: ['idle', 'walk'], directions: 4, anims: { idle: { frames: 2 }, walk: { frames: 4 } } };
    const r = renderAsset(mod, { dir, brief });
    expect(r.cells).toHaveLength(4 * 6);
    const rep = conformance({ frames: r.cells.map(c => c.grid), dir, kind: brief.kind, size, symAxis: 'none' });
    for (const id of ['palette', 'aa', 'line']) expect(rep.checks.find(c => c.id === id), `${t} ${id}: ${rep.checks.find(c => c.id === id)?.detail}`).toMatchObject({ status: 'pass' });
    expect(r.cells.filter(c => c.anchors?.eye).length, t).toBeGreaterThan(0);
    for (const c of r.cells) {
      const k = `${t} ${c.state}/${c.facing}/${c.frame}`;
      for (const e of ['eye', 'eye2'] as const) if (c.anchors?.[e]) expect(c.grid.get(...c.anchors[e]!), `${k} ${e}`).toBe(dir.palette.outline);
      if (!t.endsWith('walk')) expect(c.anchors?.ground, k).toBeDefined();
    }
    // the face-first finish runs on it
    const finish = await load<FinishModule>('finish-character.js');
    expect(() => applyFinish(r, finish, dir)).not.toThrow();
  });

  test('iso briefs no longer fall back to the top-down walker; each body has a rig in both views', () => {
    expect(findTemplate('iso', 'character-walk')).toMatchObject({ view: 'iso', fallback: false });
    for (const t of rigs) { const [v, k] = t.split('/'); expect(findTemplate(v, k)).toMatchObject({ view: v, kind: k, fallback: false }); }
  });
});
