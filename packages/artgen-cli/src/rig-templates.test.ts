// R6b: the character and creature templates are built on the shared rigs (docs/STAGES.md §6.3): the rig stage check passes over every
// state × facing × frame, the anchors cover the placeholder's names, the rig reaches the stage report,.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { defaultPlaceholder, generateCandidates, renderAsset, stageReport, type AssetModule, type Brief } from 'artgen-core';
import { initNodeSvg } from './node.ts';
import { templatesRoot } from './templates.ts';

const [dir] = generateCandidates({ pitch: 'Grim swamp roguelike: bog goblins in the fog.' });
const KINDS = ['character', 'character-walk', 'creature-quadruped', 'creature-serpent', 'creature-flyer', 'creature-large'];
const CASES = ['topdown', 'iso'].flatMap(v => KINDS.map(k => [v, k] as const));

describe('rigged templates', () => {
  beforeAll(async () => { await initNodeSvg(); });

  test.each(CASES)('%s/%s: rig-lengths passes over every state, facing and frame; anchors cover the placeholder', async (view, kind) => {
    const base = JSON.parse(readFileSync(join(templatesRoot(), view, kind, 'brief.json'), 'utf8')), file = pathToFileURL(join(templatesRoot(), view, kind, 'base.js')).href;
    const mod = await import(file) as AssetModule;
    const brief = { id: 'rigged', view, ...base, states: ['idle', 'walk', 'attack', 'hurt'], anims: { ...base.anims, attack: { frames: 3 }, hurt: { frames: 2 } } } as Brief & { view: 'topdown' | 'iso' };
    const r = renderAsset(mod, { dir, brief });
    expect(r.cells.length).toBeGreaterThan(5);
    // every cell reports a rig (mirrored ones their source's), and the lengths agree across cells
    for (const c of r.cells) expect(r.rigs?.[`${c.state}/${c.facing}/${c.frame}`]?.length, `${c.state}/${c.facing}/${c.frame}`).toBeGreaterThan(0);
    const rep = stageReport(r, dir, { brief: brief as never });
    expect(rep.checks.find(c => c.id === 'rig-lengths'), JSON.stringify(rep.checks.filter(c => c.stage === 'rig'))).toMatchObject({ stage: 'rig', status: 'pass' });
    expect(rep.keys.rig).toMatch(/^[0-9a-f]{8}$/);
    // anchors: the placeholder's names are among the template's in every cell
    const ph = Object.keys(defaultPlaceholder(brief as never, dir).anchors), names = new Set(r.cells.flatMap(c => Object.keys(c.anchors ?? {})));
    for (const n of ph) expect(names.has(n), n).toBe(true);
  }, 60_000);

  test('a template whose limbs change length between cells fails rig-lengths and changes the rig key', async () => {
    const mod: AssetModule = {
      render: ctx => { ctx.lib.rigs.body('biped', ctx, { height: 20 + ctx.frame * 2 }); return ctx.lib.t2.scene(...ctx.size).add({ type: 'rect', x: 8, y: 8, w: 8, h: 8, mat: ctx.dir.pal.cloth }).render(); },
    } as AssetModule;
    const brief = { id: 'bad', kind: 'character', states: ['idle'], anims: { idle: { frames: 3 } } } as Brief;
    const r = renderAsset(mod, { dir, brief }), rep = stageReport(r, dir, { brief: brief as never }), c = rep.checks.find(x => x.id === 'rig-lengths')!;
    expect(c.status).toBe('fail');
    expect(c.detail).toMatch(/biped bone \w+ is [\d.]+ px in idle\/s\/0 and [\d.]+ px in idle\/s\/2/);
  });

  test('assets with no rig have no rig key; there is no rig-lengths check', () => {
    const mod = { render: ctx => ctx.lib.t2.scene(...ctx.size).add({ type: 'rect', x: 8, y: 8, w: 8, h: 8, mat: ctx.dir.pal.cloth }).render() } as AssetModule;
    const brief = { id: 'plain', kind: 'prop', states: ['idle'] } as Brief, r = renderAsset(mod, { dir, brief }), rep = stageReport(r, dir, { brief: brief as never });
    expect(r.rigs).toBeUndefined();
    expect(rep.keys.rig).toBeUndefined();
    expect(rep.checks.find(x => x.id === 'rig-lengths')).toBeUndefined();
  });
});
