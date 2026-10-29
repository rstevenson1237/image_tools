// The asset data sheet and references on briefs and review sheets (docs/WORKFLOW.md §8).
import { describe, expect, test } from 'vitest';
import { parseDirection } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { dataSheetMarkdown, renderDataSheet } from 'artgen-workflow/sheet.ts';
import { reviewSheet } from '../qa/sheet.ts';
import { validateBrief, type BriefEntry } from './briefs.ts';
import { assetDataSheet } from './sheet.ts';
import { briefContract } from './contract.ts';
import { budgetFor } from './config.ts';

const dir = parseDirection({
  id: 't', version: 1, status: 'locked', camera: { view: 'topdown', light: [-1, -1, 1] }, scale: { character: [16, 24], tile: 8, metre: 12 },
  palette: { ramps: { cloth: ['#ff8080', '#cc4040', '#802020'], accent: ['#80ff80', '#40cc40'], stone: ['#aaaaaa', '#666666'] }, outline: '#101010' },
});
const brief: BriefEntry & { template?: string } = {
  id: 'goblin', kind: 'character', states: ['idle', 'walk'], directions: 4, anims: { walk: { frames: 4, fps: 10 } }, height: 1.2, importance: 'hero', notes: 'a sneaky one, with a torn ear', refs: ['refs/goblin-1.png'], template: 'character.walker',
};

describe('brief refs', () => {
  test('a list of paths under refs/', () => {
    expect(validateBrief({ id: 'a', kind: 'prop', refs: ['refs/a.png', 'refs/sub/b.png'] })).toEqual([]);
    for (const refs of ['refs/a.png', ['a.png'], ['refs/../x.png'], ['/etc/passwd'], [3], ['refs\\a.png']]) expect(validateBrief({ id: 'a', kind: 'prop', refs }), JSON.stringify(refs)).toEqual([expect.stringContaining('refs must be a list of paths under refs/')]);
  });
});

describe('the asset data sheet', () => {
  const budget = budgetFor(undefined, brief, dir), sheet = assetDataSheet(brief, dir, budget);
  const row = (l: string) => sheet.rows.find(r => r.label === l)?.value;

  test('what the brief asks for, as a reader signs it off', () => {
    expect(sheet).toMatchObject({ title: 'goblin — character', subject: 'goblin', refs: ['refs/goblin-1.png'], notes: 'a sneaky one, with a torn ear' });
    expect(row('Kind')).toBe('character');
    expect(row('Importance')).toBe('hero');
    expect(row('View')).toBe('topdown');
    expect(row('Size')).toBe('16x24 px, 12 px per metre; 1.2 m tall is about 14 px');
    expect(row('States')).toBe('idle, walk');
    expect(row('Facings')).toMatch(/^4: /);
    expect(row('Frames')).toBe('idle 1 frame, loops; walk 4 frames at 10 fps, loops');
    expect(row('Template')).toBe('character.walker');
    expect(row('Budget')).toBe(`${budget.revisionPasses} revision passes, 3 user iterations`);
    expect(sheet.swatches).toEqual(expect.arrayContaining(['#ff8080', '#101010']));
    expect(sheet.must).toBeUndefined();
  });

  test('the frozen animation contract is what must hold', () => {
    const s = assetDataSheet(brief, dir, budget, briefContract(brief, dir));
    expect(s.must![0].text).toMatch(/^facings s /);
    expect(s.must![1].text).toMatch(/^idle: 1 frame, \d+ ms, loops$/);
    expect(s.must![2].text).toMatch(/^walk: 4 frames, 100\/100\/100\/100 ms, loops$/);
  });

  test('markdown and the picture say the same, and the picture stays within the cap', () => {
    const md = dataSheetMarkdown(sheet);
    expect(md).toContain('| Size | 16x24 px, 12 px per metre; 1.2 m tall is about 14 px |');
    expect(md).toContain('- refs/goblin-1.png');
    const g = renderDataSheet(sheet, { refs: [{ label: 'goblin-1', grid: new Grid(200, 160).fill(0, 0, 200, 160, '#44aa66') }] });
    expect(Math.max(g.w, g.h)).toBeLessThanOrEqual(1568);
    expect(renderDataSheet(sheet).hash()).toBe(renderDataSheet(sheet).hash());
  });
});

describe('references on the review sheet', () => {
  const row = { label: 'goblin', grid: new Grid(16, 24).fill(2, 2, 10, 18, '#cc4040'), scale: 4 };
  test('a REFERENCES row under the anchors; none, and the sheet is as it was', () => {
    const plain = reviewSheet({ title: 't', rows: [row] }), same = reviewSheet({ title: 't', rows: [row], refs: [] });
    expect(same.hash()).toBe(plain.hash());
    const refs = [{ label: 'goblin-1', grid: new Grid(300, 200).fill(0, 0, 300, 200, '#44aa66') }, { label: 'sketch', grid: new Grid(20, 20).fill(0, 0, 20, 20, '#ffffff') }];
    const withRefs = reviewSheet({ title: 't', rows: [row], refs });
    expect(withRefs.h).toBeGreaterThan(plain.h);
    expect(Math.max(withRefs.w, withRefs.h)).toBeLessThanOrEqual(1568);
    expect(reviewSheet({ title: 't', rows: [row], refs }).hash()).toBe(withRefs.hash());
  });
});
