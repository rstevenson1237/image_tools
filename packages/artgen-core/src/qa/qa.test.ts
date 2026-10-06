import { describe, expect, test } from 'vitest';
import { parseDirection } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { checkerWindows, conformance, histogramDistance, lintSource } from './conformance.ts';
import { formatLedgerLine, imageTokens, parseLedger, sourceHash } from './ledger.ts';
import { measure } from './metrics.ts';
import { contactSheet, reviewSheet } from './sheet.ts';

const O = '#1a1423', L = ['#eeeeee', '#999999', '#444444'];
const dir = parseDirection({
  id: 'qa', version: 1, status: 'locked', camera: { view: 'topdown', light: [-1, -1, 1] }, scale: { prop: [12, 12] },
  palette: { ramps: { stone: L, gem: ['#ff0000'] }, outline: O, perKindMax: { prop: 4 }, perKind: { effect: ['gem'] } },
});

/** 12×12 lit-from-upper-left block: light top/left edges, dark bottom/right, outlined, with a ground shadow. */
function block(): Grid {
  const g = new Grid(12, 12);
  g.fill(1, 1, 10, 10, O);
  g.fill(2, 2, 8, 8, L[1]);
  g.fill(2, 2, 8, 1, L[0]); g.fill(2, 2, 1, 8, L[0]);
  g.fill(2, 9, 8, 1, L[2]); g.fill(9, 2, 1, 8, L[2]);
  g.set(11, 11, 'rgba(0,0,0,0.35)');
  return g;
}
const status = (r: ReturnType<typeof conformance>) => Object.fromEntries(r.checks.map(c => [c.id, c.status]));

describe('conformance gate', () => {
  test('a clean asset passes every check', () => {
    const r = conformance({ frames: [block()], dir, kind: 'prop', size: [12, 12], source: 'export function render(ctx) { return ctx.dir.pal.stone[0]; }' });
    expect(status(r)).toEqual({ palette: 'pass', scale: 'pass', aa: 'pass', line: 'pass', light: 'pass', dither: 'pass', source: 'pass', lint: 'skip', anchors: 'skip' });
    expect(r.pass).toBe(true);
    expect(r.metrics.offPalettePct).toBe(0);
  });

  test('off-palette, colour count, partial alpha and size fail', () => {
    const g = block(); g.set(5, 5, '#123456'); g.set(0, 0, 'rgba(255,0,0,0.5)');
    const r = conformance({ frames: [g], dir, kind: 'prop', size: [16, 16] });
    expect(status(r)).toMatchObject({ palette: 'fail', aa: 'fail', scale: 'fail' });
    expect(r.pass).toBe(false);
    const many = block(); many.set(5, 5, '#ff0000');
    expect(status(conformance({ frames: [many], dir, kind: 'prop' })).palette).toBe('fail'); // 5 colours > 4
    expect(status(conformance({ frames: [block()], dir, kind: 'effect' })).palette).toBe('fail'); // stone not allowed
  });

  test('line: missing outline fails dark, passes none', () => {
    const g = new Grid(12, 12).blit(block().crop(2, 2, 8, 8), 2, 2); // the block without its outline ring
    expect(status(conformance({ frames: [g], dir })).line).toBe('fail');
    const none = parseDirection({ ...dir, line: { ...dir.line, outer: 'none' } });
    expect(status(conformance({ frames: [g], dir: none })).line).toBe('pass');
    expect(status(conformance({ frames: [block()], dir: none })).line).toBe('fail');
  });

  test('light: shading against the direction light fails the sign test', () => {
    const lit = block();
    expect(status(conformance({ frames: [lit.flip('x').flip('y')], dir })).light).toBe('fail');
    const fromRight = parseDirection({ ...dir, camera: { ...dir.camera, light: [1, 1, 1] } });
    expect(status(conformance({ frames: [lit], dir: fromRight })).light).toBe('fail');
  });

  test('dither: checkerboards fail under dither none', () => {
    const g = block();
    for (let y = 3; y < 9; y++) for (let x = 3; x < 9; x++) g.set(x, y, (x + y) % 2 ? L[0] : L[2]);
    expect(checkerWindows(g)).toBeGreaterThan(2);
    expect(status(conformance({ frames: [g], dir })).dither).toBe('fail');
    const bayer = parseDirection({ ...dir, shading: { ...dir.shading, dither: 'bayer2' } });
    expect(status(conformance({ frames: [g], dir: bayer })).dither).toBe('pass');
  });

  test('source lint (R11) catches colour literals but not ids or comments', () => {
    expect(lintSource("const c = '#ff00aa';\nfill: url(#pl); url(#dome)\n// was #123456\nrgba(0,0,0,1)")).toEqual(["1: const c = '#ff00aa';", '4: rgba(0,0,0,1)']);
    expect(status(conformance({ frames: [block()], dir, source: "g.set(0, 0, '#fff')" })).source).toBe('fail');
  });

  test('anchor similarity flags, never fails', () => {
    const other = new Grid(12, 12).fill(0, 0, 12, 12, '#ff0000');
    expect(histogramDistance(block(), block())).toBe(0);
    expect(histogramDistance(block(), other)).toBe(1);
    const r = conformance({ frames: [block()], dir, anchors: [other] });
    expect(status(r).anchors).toBe('flag');
    expect(r.pass).toBe(true);
  });
});

describe('measure (artlab hygiene)', () => {
  test('counts colours, outline share and symmetry; skips shadow pixels', () => {
    const m = measure(block(), { palette: [...L, O], symAxis: 'none' });
    expect(m).toMatchObject({ colors: 4, aaPartialPct: 0, offPalettePct: 0, outlinePct: 100, symmetryPct: 0, hygiene: 10 });
    expect(measure(block(), { palette: [O] }).offPalettePct).toBeGreaterThan(50);
  });
});

describe('sheets', () => {
  test('review sheet holds every row and fits the 1568 px long edge', () => {
    const big = new Grid(160, 41).fill(0, 0, 160, 41, L[1]);
    const s = reviewSheet({ title: 'ship', rows: [{ label: 'v1', grid: big, scale: 8 }, { label: 'v2', grid: big, scale: 8, bg: '#24527a' }], anchors: [{ label: 'a', grid: block() }] });
    expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(1568);
    const small = reviewSheet({ title: 't', rows: [{ label: 'x', grid: block(), scale: 4, context: new Grid(12, 12).fill(0, 0, 12, 12, '#00ff00') }] });
    expect(small.toIndexed().palette).toEqual(expect.arrayContaining(['#00ff00', O]));
  });
  test('contact sheet lays items out in columns', () => {
    const s = contactSheet('c', [1, 2, 3].map(i => ({ label: `#${i}`, grid: block() })), 2, 2);
    expect(s.w).toBeGreaterThan(2 * 24);
  });
});

describe('ledger', () => {
  test('jsonl round trip', () => {
    const e = { ts: '2026-10-06T00:00:00.000Z', type: 'render' as const, asset: 'hero', direction: { id: 'qa', version: 1 }, score: 7 };
    const text = formatLedgerLine(e) + '\n\n' + formatLedgerLine({ ...e, type: 'score' }) + '\n';
    expect(parseLedger(text)).toEqual([e, { ...e, type: 'score' }]);
    expect(() => parseLedger('{"ok":1}\nnot json')).toThrow('ledger line 2');
    expect(() => formatLedgerLine({ ...e, asset: '' })).toThrow();
  });
  test('source hash ignores line-ending style; image token estimate matches artlab', () => {
    expect(sourceHash('a\r\nb')).toBe(sourceHash('a\nb'));
    expect(sourceHash('a')).not.toBe(sourceHash('b'));
    expect(imageTokens(750, 100)).toBe(100);
    expect(imageTokens(3136, 100)).toBe(Math.ceil((1568 * 50) / 750));
  });
});
