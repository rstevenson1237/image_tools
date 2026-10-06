// W2 core (PLAN P3): briefs.yaml, the status lifecycle, the atlas packer + pack.json, analytics, restyle diff and edit ops.
import { describe, expect, test } from 'vitest';
import { parseDirection } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { renderAsset, type AssetModule } from '../render.ts';
import type { NextStep } from '../pipeline.ts';
import type { LedgerEntry } from '../qa/ledger.ts';
import { briefOrder, parseBriefs, removeBrief, upsertBrief, validateBrief } from './briefs.ts';
import { assetStatus } from './status.ts';
import { assetsTs, buildPack, packRects, swapMaps } from './pack.ts';
import { analytics, analyticsMarkdown } from './analytics.ts';
import { editOps, nearestToken, restyleDiff, tokenizer } from './edit.ts';

const dir = parseDirection({
  id: 't', version: 1, status: 'locked', camera: { view: 'topdown', light: [-1, -1, 1] }, scale: { character: [8, 8], tile: 4 },
  palette: { ramps: { cloth: ['#ff8080', '#cc4040', '#802020'], accent: ['#80ff80', '#40cc40'], stone: ['#aaaaaa', '#666666'] }, outline: '#101010' },
});

describe('briefs.yaml', () => {
  const text = `# swamp briefs
- id: goblin
  kind: character
  states: [idle, walk]
  directions: 8
  anims: { walk: { frames: 4 } }
  priority: 2
- id: crate   # a prop
  kind: prop
  priority: 1
`;
  test('parses, validates, orders by priority', () => {
    const r = parseBriefs(text);
    expect(r.ok).toBe(true);
    expect(briefOrder(r.briefs).map(b => b.id)).toEqual(['crate', 'goblin']);
    expect(parseBriefs('').briefs).toEqual([]);
    expect(parseBriefs('[]\n').ok).toBe(true);
  });
  test('rejects bad briefs with readable errors', () => {
    expect(validateBrief({ id: 'Bad', kind: 'robot', directions: 3, anims: { run: { frames: 0 } } }).length).toBe(4);
    expect(validateBrief({ id: 'a', kind: 'prop', states: ['idle'], anims: { walk: { frames: 2 } } })[0]).toMatch(/not in states/);
    expect(validateBrief({ id: 'a', kind: 'prop', swaps: { red: { cloth: '#ff0000' } } })[0]).toMatch(/R11/);
    expect(parseBriefs('- id: a\n  kind: prop\n- id: a\n  kind: prop\n').errors).toEqual(['brief a: duplicate id']);
    expect(parseBriefs('id: a').ok).toBe(false);
  });
  test('upsert keeps comments and other entries; replace by id; remove', () => {
    const t2 = upsertBrief(text, { id: 'wisp', kind: 'effect', states: ['idle'], anims: { idle: { frames: 6 } } });
    expect(t2).toContain('# swamp briefs'); expect(t2).toContain('# a prop');
    expect(parseBriefs(t2).briefs.map(b => b.id)).toEqual(['goblin', 'crate', 'wisp']);
    const t3 = upsertBrief(t2, { id: 'crate', kind: 'prop', notes: 'iron bands' });
    expect(parseBriefs(t3).briefs.find(b => b.id === 'crate')!.notes).toBe('iron bands');
    expect(parseBriefs(upsertBrief('# Asset briefs\n[]\n', { id: 'x', kind: 'tile' })).briefs).toEqual([{ id: 'x', kind: 'tile' }]);
    expect(parseBriefs(removeBrief(t3, 'goblin')).briefs.map(b => b.id)).toEqual(['crate', 'wisp']);
    expect(() => upsertBrief(text, { id: 'x', kind: 'nope' })).toThrow(/kind/);
  });
});

describe('status lifecycle', () => {
  const D = { id: 't', version: 1 };
  const ready: NextStep = { action: 'ready', final: 'finish.v1', best: 'base.v3', why: '', issues: [] };
  const e = (type: LedgerEntry['type'], extra: Partial<LedgerEntry> = {}): LedgerEntry => ({ ts: 't', type, asset: 'a', ...extra });
  const approve = e('approve', { by: 'user', version: 'finish.v1', sourceHash: 'h1', direction: D });
  test('brief → in-pipeline → final → approved → exported', () => {
    expect(assetStatus({ ledger: [], direction: D }).status).toBe('brief');
    expect(assetStatus({ ledger: [], next: { action: 'review', version: 'base.v1', pass: 'r1', why: '' }, direction: D }).status).toBe('in-pipeline');
    expect(assetStatus({ ledger: [], next: ready, direction: D, finalHash: 'h1' }).status).toBe('final');
    expect(assetStatus({ ledger: [approve], next: ready, direction: D, finalHash: 'h1' }).status).toBe('approved');
    expect(assetStatus({ ledger: [approve, e('export', { version: 'finish.v1', sourceHash: 'h1', pack: 'main' })], next: ready, direction: D, finalHash: 'h1' }).status).toBe('exported');
  });
  test('revision after feedback; final again when the U stage is done; stale after a direction change until restyled', () => {
    const fb = e('feedback', { by: 'user', route: 'base', opens: 'base.v4' });
    expect(assetStatus({ ledger: [approve, fb], next: { action: 'write-base', version: 'base.v4', pass: 'u1', why: '' }, direction: D }).status).toBe('revision');
    expect(assetStatus({ ledger: [approve, fb], next: { ...ready, final: 'finish.v2' }, direction: D, finalHash: 'h2' }).status).toBe('final');
    const D2 = { id: 't', version: 2 };
    expect(assetStatus({ ledger: [approve], next: ready, direction: D2, finalHash: 'h1' }).status).toBe('stale');
    expect(assetStatus({ ledger: [approve, e('restyle', { direction: D2, changedPct: 4 })], next: ready, direction: D2, finalHash: 'h1' }).status).toBe('final');
    expect(assetStatus({ ledger: [approve, e('restyle', { direction: D2, changedPct: 0 })], next: ready, direction: D2, finalHash: 'h1' }).status).toBe('approved');
    expect(assetStatus({ ledger: [approve], next: ready, direction: D, finalHash: 'changed' }).status).toBe('final');
  });
});

describe('export', () => {
  test('maxrects packs without overlap inside power-of-two bins, and splits over bins when needed', () => {
    const sizes = Array.from({ length: 40 }, (_, i) => ({ w: 8 + (i % 5) * 4, h: 8 + (i % 3) * 8 }));
    const { placed, bins } = packRects(sizes);
    expect(bins.length).toBe(1);
    for (const [w, h] of bins) { expect(Math.log2(w) % 1).toBe(0); expect(Math.log2(h) % 1).toBe(0); }
    for (const p of placed) { expect(p.x + p.w).toBeLessThanOrEqual(bins[p.bin][0]); expect(p.y + p.h).toBeLessThanOrEqual(bins[p.bin][1]); }
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${i} overlaps ${j}`).toBe(true);
    }
    expect(packRects(Array.from({ length: 6 }, () => ({ w: 60, h: 60 })), { maxSize: 128 }).bins.length).toBe(2);
    expect(() => packRects([{ w: 300, h: 10 }], { maxSize: 256 })).toThrow();
  });

  test('pack.json, Aseprite JSON and assets.ts from renders; identical frames stored once; swaps as hex maps', () => {
    const mod: AssetModule = { render(ctx) { const g = new ctx.lib.Grid(8, 8); g.fill(1, 1, 6, 6, ctx.dir.pal.cloth[1]); g.set(2 + ctx.frame, 2, ctx.dir.outline); return g; } };
    const brief = { id: 'goblin', kind: 'character', size: 'character', states: ['idle', 'walk'], directions: 8 as const, anims: { walk: { frames: 4 } }, swaps: { red: { cloth: 'accent' } } };
    const r = renderAsset(mod, { dir, brief });
    const tile = renderAsset({ render: ctx => new ctx.lib.Grid(4, 4).fill(0, 0, 4, 4, ctx.dir.pal.stone[0]) }, { dir, brief: { id: 'floor', kind: 'tile' } });
    const p = buildPack('main', dir, [{ brief, view: 'topdown', renders: [r], version: 'finish.v1', sourceHash: 'h' }, { brief: { id: 'floor', kind: 'tile' }, view: 'topdown', renders: [tile], version: 'base.v3', sourceHash: 'k', draft: true }]);
    const g = p.manifest.assets.goblin;
    expect(g.frames.length).toBe(8 * 5);
    expect(g.states).toEqual({ idle: { frames: 1, fps: 8, loop: true }, walk: { frames: 4, fps: 8, loop: true } });
    expect(g.anchor).toEqual([4, 4]);
    expect(g.variants).toEqual(['base', 'red']);
    expect(g.swaps!.red).toEqual({ '#ff8080': '#80ff80', '#cc4040': '#40cc40', '#802020': '#40cc40' });
    expect(new Set(g.frames.map(f => `${f[1]},${f[2]}`)).size).toBe(4); // idle 0 = walk 0: 4 distinct pixel frames; facings share them
    expect(p.manifest.drafts).toEqual(['floor']);
    expect(p.manifest.assets.floor.tile).toBe(4);
    // atlas pixels match the frames they index
    for (const [at, x, y, w, h, fi, state, frame] of g.frames) {
      const cell = r.cells.find(c => c.state === state && c.facing === g.facings[fi] && c.frame === frame)!;
      const sub = new Grid(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = p.atlases[at].get(x + i, y + j); if (c) sub.set(i, j, c); }
      expect(sub.hash()).toBe(cell.grid.hash());
    }
    const ase = p.aseprite[0] as { frames: { filename: string; duration: number }[]; meta: { frameTags: { name: string; from: number; to: number }[] } };
    expect(ase.frames[0].filename).toBe('goblin/idle/s/0');
    expect(ase.meta.frameTags.find(t => t.name === 'goblin/walk/s')).toMatchObject({ to: expect.any(Number) });
    const ts = assetsTs([{ manifest: p.manifest, url: '/assets/main/pack.json' }]);
    expect(ts).toContain('goblin: { id: "goblin", pack: "main"'); expect(ts).toContain('export type AssetId');
    expect(() => swapMaps(dir, { x: { nope: 'cloth' } })).toThrow(/unknown ramp/);
  });
});

describe('analytics', () => {
  const s = (asset: string, version: string, pass: string, score: number, extra: Partial<LedgerEntry> = {}): LedgerEntry =>
    ({ ts: 't', type: 'score', asset, version, pass, score, tokens: { code: 500, edit: 200 }, imageTokens: 1000, conformance: { pass: true, checks: [] }, model: 'm1', effort: 'medium', ...extra });
  const ledger = [
    ...['a', 'b', 'c'].flatMap(id => [s(id, 'base.v1', 'r1', 5), s(id, 'base.v2', 'r2', 6.5), s(id, 'base.v3', 'r3', 6.5), s(id, 'finish.v1', 'f', 7, { base: 'base.v3' })]),
    s('a', 'base.v2', 'r2', 6.5, { note: 'rescored' }), // a later score replaces the earlier one
    { ts: 't', type: 'feedback', asset: 'a', by: 'user', route: 'base' } as LedgerEntry,
  ];
  test('per pass gains, revisions vs finish, regressions, suggestions', () => {
    const r = analytics(ledger, [{ id: 'a', kind: 'character', template: 'topdown/character' }, { id: 'b', kind: 'character' }, { id: 'c', kind: 'character' }]);
    expect(r.passes.map(p => p.pass)).toEqual(['r1', 'r2', 'r3', 'f']);
    expect(r.passes.find(p => p.pass === 'r2')!.meanDelta).toBeCloseTo(1.5, 1);
    expect(r.perAsset.find(a => a.id === 'b')).toMatchObject({ r1: 5, best: 6.5, final: 7, fromRevisions: 1.5, fromFinish: 0.5 });
    expect(r.regressions).toEqual([]);
    expect(r.suggestions.some(x => x.includes('revisionPasses = 2'))).toBe(true);
    expect(r.userRevisionRate).toMatchObject({ feedback: 1, byRoute: { base: 1 } });
    expect(analyticsMarkdown(r)).toContain('| r2 | 3 |');
  });
});

describe('tokens: restyle diff and edit ops', () => {
  const dir2 = parseDirection({ ...JSON.parse(JSON.stringify(dir)), version: 2, palette: { ...dir.palette, ramps: { cloth: ['#8080ff', '#4040cc', '#202080'], accent: ['#ffff80', '#cccc40'], stone: ['#aaaaaa', '#666666'] } } });
  const img = (d: typeof dir) => { const g = new Grid(4, 4); g.fill(0, 0, 4, 2, d.palette.ramps.cloth[1]); g.fill(0, 2, 4, 2, d.palette.ramps.stone[0]); g.set(3, 3, d.palette.outline); return g; };
  test('a palette-only restyle changes colours but keeps every token, consistently', () => {
    const d = restyleDiff(img(dir), img(dir2), dir, dir2);
    expect(d).toMatchObject({ changedPct: 50, tokenSame: 1, consistent: true });
    expect(tokenizer(dir)(img(dir), 0, 0)).toBe('cloth.1');
  });
  test('edit ops snap to palette tokens and record clears', () => {
    const cur = img(dir), ed = cur.clone();
    ed.set(1, 1, '#81ff7f'); ed.clear(0, 0); ed.set(2, 2, dir.palette.ramps.cloth[0]);
    const r = editOps(cur, ed, dir);
    expect(r.ops).toEqual([[0, 0, null], [1, 1, 'accent.0'], [2, 2, 'cloth.0']]);
    expect(r.snapped).toBe(1);
    expect(nearestToken(dir, '#101010')).toEqual({ token: 'outline', exact: true });
  });
});
