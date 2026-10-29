import { describe, expect, test } from 'vitest';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { dataSheetMarkdown, fitGrid, renderDataSheet, subjectReviewSheet, wrap, type DataSheet } from './sheet.ts';

const sheet: DataSheet = {
  title: 'keep — terrain map', subject: 'map:keep',
  rows: [{ label: 'Size', value: '30×22 cells, 6 mi each' }, { label: 'Grid', value: 'hex' }, { label: 'Seed', value: '42' }],
  must: [{ text: 'C-forest: forest at least 0.80 of the area', met: false }, { text: 'a road joins the gates', met: true }, { text: 'no label overlaps' }],
  refs: ['refs/coast.png'], notes: 'A border keep on a river bend, printed for the table.',
};
const long: DataSheet = { ...sheet, rows: Array.from({ length: 200 }, (_, i) => ({ label: `Row ${i}`, value: `value number ${i} `.repeat(6) })), notes: 'word '.repeat(4000), swatches: Array.from({ length: 64 }, (_, i) => `#${(i * 4).toString(16).padStart(2, '0')}80c0`) };
const solid = (w: number, h: number, c: string) => new Grid(w, h).fill(0, 0, w, h, c);

describe('data sheet', () => {
  test('markdown has the title, the table, what must hold and the references', () => {
    const md = dataSheetMarkdown(sheet);
    expect(md).toContain('# keep — terrain map');
    expect(md).toContain('| Size | 30×22 cells, 6 mi each |');
    expect(md).toContain('- [ ] C-forest: forest at least 0.80 of the area');
    expect(md).toContain('- [x] a road joins the gates');
    expect(md).toContain('- no label overlaps');
    expect(md).toContain('- refs/coast.png');
    expect(md).toContain('A border keep');
  });

  test('wrap: on spaces, and a word longer than the line is cut', () => {
    expect(wrap('aa bb cc dd', 5)).toEqual(['aa bb', 'cc dd']);
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  test('the picture is drawn, deterministic, and within the 1568 px cap even for a huge sheet', () => {
    const a = renderDataSheet(sheet), b = renderDataSheet(sheet);
    expect(a.hash()).toBe(b.hash());
    expect(Math.max(a.w, a.h)).toBeLessThanOrEqual(1568);
    const big = renderDataSheet(long);
    expect(Math.max(big.w, big.h)).toBeLessThanOrEqual(1568);
    expect(big.h).toBeGreaterThan(1000);
    expect(Math.max(renderDataSheet(long, { maxEdge: 600 }).h)).toBeLessThanOrEqual(600);
  });

  test('references are drawn as thumbnails', () => {
    const without = renderDataSheet(sheet), withRefs = renderDataSheet(sheet, { refs: [{ label: 'coast', grid: solid(300, 200, '#cc8844') }] });
    expect(withRefs.h).toBeGreaterThan(without.h);
  });

  test('the review sheet puts the render beside the sheet, shrinks a big render and keeps within the cap', () => {
    const small = subjectReviewSheet({ title: 'keep v1', render: solid(400, 300, '#88aacc'), sheet });
    expect(small.w).toBeGreaterThan(400);
    const huge = subjectReviewSheet({ title: 'keep v1', render: solid(4000, 3000, '#88aacc'), sheet: long, refs: [{ label: 'a', grid: solid(500, 500, '#222222') }, { label: 'b', grid: solid(50, 50, '#ffffff') }] });
    expect(Math.max(huge.w, huge.h)).toBeLessThanOrEqual(1568);
    expect(subjectReviewSheet({ title: 'keep v1', render: solid(4000, 3000, '#88aacc'), sheet: long }).hash()).toBe(subjectReviewSheet({ title: 'keep v1', render: solid(4000, 3000, '#88aacc'), sheet: long }).hash());
  });

  test('fitGrid averages down and never enlarges', () => {
    const g = new Grid(4, 2); g.fill(0, 0, 2, 2, '#000000'); g.fill(2, 0, 2, 2, '#ffffff');
    const f = fitGrid(g, 2, 1);
    expect([f.w, f.h]).toEqual([2, 1]);
    expect(f.get(0, 0)).toBe('#000000'); expect(f.get(1, 0)).toBe('#ffffff');
    expect(fitGrid(g, 100, 100)).toBe(g);
  });
});
