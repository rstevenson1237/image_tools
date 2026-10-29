// Fixes from the first production run (megadungeon, 0.10.0): the analytics budget suggestions speak up when the
// finishing pass loses, the roster pages past 26 assets, briefs warn about materials their kind can't colour, and
// fix.jaggies leaves an iso tile's 2:1 rim alone.
import { describe, expect, test } from 'vitest';
import { dirContext, parseDirection } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import type { LedgerEntry } from '../qa/ledger.ts';
import { makePx } from '../finish.ts';
import { analytics, analyticsMarkdown, type AssetMeta } from './analytics.ts';
import { briefMaterialIssues } from './briefs.ts';
import { roster, rosterLabel } from './roster.ts';

const dir = parseDirection({
  id: 't', version: 1, status: 'locked', camera: { view: 'iso', light: [-1, -1, 1] }, scale: { character: [8, 8], tile: 4 },
  palette: {
    ramps: { cloth: ['#ff8080', '#cc4040', '#802020'], leather: ['#c08040', '#804020'], metal: ['#e0e0f0', '#9090a0'], wood: ['#d0a060', '#806030'], stone: ['#aaaaaa', '#666666'] },
    outline: '#101010', perKind: { character: ['cloth', 'leather'], creature: ['cloth', 'leather', 'metal'], tile: ['stone'] },
  },
});

describe('analytics: the finishing pass that loses is reported', () => {
  // the megadungeon shape: per kind under 3 assets each, the first finish averaging −0.06 and regressing 30%
  const sc = (asset: string, version: string, pass: string, score: number, x: Partial<LedgerEntry> = {}): LedgerEntry =>
    ({ ts: 't', type: 'score', asset, version, pass, score, tokens: { out: 100 }, imageTokens: 400, ...x });
  const ledger: LedgerEntry[] = [], metas: AssetMeta[] = [];
  const fDeltas = [-0.5, -0.5, -0.5, 0.2, 0.2, 0.2, 0.1, 0, 0, 0.2];
  fDeltas.forEach((d, i) => {
    const id = `a${i}`;
    metas.push({ id, kind: `kind${i % 5}` });
    ledger.push(sc(id, 'base.v1', 'r1', 5), sc(id, 'base.v2', 'r2', 6), sc(id, 'finish.v1', 'f', 6 + d, { base: 'base.v2', tokens: { out: 400 } }));
  });

  test('a first finish that regresses ≥ 30% of assets is a suggestion, with its share of the tokens', () => {
    const r = analytics(ledger, metas);
    expect(r.passes.find(p => p.pass === 'f')).toMatchObject({ n: 10, regressed: 3 });
    expect(r.suggestions).toEqual(expect.arrayContaining([expect.stringMatching(/^the finishing pass adds -0\.06 on average and regressed 30% of 10 assets, for \d+% of the tokens — set review\.finish = "auto"/)]));
  });

  test('when every kind is under the minimum, the batch as a whole is judged', () => {
    const flat: LedgerEntry[] = metas.flatMap(m => [sc(m.id, 'base.v1', 'r1', 6), sc(m.id, 'base.v2', 'r2', 5.5)]);
    expect(analytics(flat, metas).suggestions).toEqual(expect.arrayContaining([expect.stringMatching(/^all kinds together: v2 does not improve on v1/)]));
  });

  test('agent input counts in the cost when reported; review tiers get their own table', () => {
    const r = analytics([...ledger, sc('a0', 'base.v3', 'r3', 6, { tokens: { out: 100, agentIn: 50_000 }, reviewModel: 'small' })], metas);
    expect(r.totals).toMatchObject({ agentIn: 50_000, agentInRecords: 1 });
    expect(r.reviewers.map(x => x.model).sort()).toEqual(['small', 'unrecorded']);
    expect(analyticsMarkdown(r)).toMatch(/Agent input \(the context each maker and reviewer read\) is in the cost for 1 of 31/);
    expect(analyticsMarkdown(analytics(ledger, metas))).toMatch(/score --agent-tokens-in/);
  });
});

describe('roster pages', () => {
  const fig = (h: number) => { const g = new Grid(8, 16); g.fill(2, 16 - h, 4, h, dir.palette.ramps.cloth[1]); return g; };
  test('60 assets: three sheet pairs in one call, labels run on past Z, one key, pairs over the whole set', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, kind: 'creature', grid: fig(4 + (i % 12)) }));
    const r = roster(items, { bg: '#000000', pxPerMetre: 8, seed: 2 });
    expect(r.pages.map(p => p.ids.length)).toEqual([26, 26, 8]);
    expect(Object.keys(r.key)).toHaveLength(60);
    expect(r.key.AZ).toBeDefined();
    expect(r.key.BH).toBeDefined();
    expect([rosterLabel(0), rosterLabel(25), rosterLabel(26), rosterLabel(59)]).toEqual(['A', 'Z', 'AA', 'BH']);
    expect(r.pairs[0].overlap).toBe(1); // identical bodies on different pages are still compared
  });
  test('sizes use the drawn height the gate measured, and the figure limit', () => {
    const r = roster([{ id: 'dragon', kind: 'creature', grid: fig(10), drawn: 49, height: 4 }, { id: 'hero', kind: 'character', grid: fig(10), height: 1.8 }], { bg: '#000', pxPerMetre: 16, heightFail: 0.15 });
    expect(r.sizes[0]).toMatchObject({ drawn: 49, expected: 64, dev: -0.23, flag: true });
  });
});

describe('brief material lint', () => {
  test('materials the kind leaves out are named before any drawing starts', () => {
    expect(briefMaterialIssues({ id: 'bard', kind: 'character', notes: 'plays a lute, oak staff' }, dir)).toEqual([expect.stringMatching(/"oak", "lute", "staff" \(wood\) but character colours leave out the wood ramp \(palette\.perKind\.character: cloth, leather\)/)]);
    expect(briefMaterialIssues({ id: 'lava-tile', kind: 'tile' }, dir)).toEqual([expect.stringMatching(/"lava" \(glow\) but the direction has no glow material/)]);
    expect(briefMaterialIssues({ id: 'knight', kind: 'creature', notes: 'steel armour' }, dir)).toEqual([]);
    expect(briefMaterialIssues({ id: 'goblin', kind: 'creature', notes: 'ragged, sneaky' }, dir)).toEqual([]);
  });
});

describe('fix.jaggies on an iso tile', () => {
  test('the diamond rim keeps its 2:1 stair; elsewhere elbows still go', () => {
    const O = dir.palette.outline, F = dir.palette.ramps.stone[0];
    // a 4-connected 2:1 edge: runs of three outline pixels, each overlapping the next row by one
    const edge = () => { const g = new Grid(12, 6); for (let r = 0; r < 4; r++) { for (let x = 0; x < 3; x++) g.set(2 * r + x, r, O); for (let x = 2 * r + 3; x < 12; x++) g.set(x, r, F); } for (let y = 4; y < 6; y++) for (let x = 0; x < 12; x++) g.set(x, y, F); return g; };
    const dc = dirContext(dir), iso = edge(), flat = edge();
    makePx(dc, undefined, undefined, { isoTile: true }).fix.jaggies(iso);
    makePx(dc).fix.jaggies(flat);
    expect(iso.diffCount(edge())).toBe(0);
    expect(flat.diffCount(edge())).toBeGreaterThan(0);
  });
});
