// The image tools ran on OpenCV (a 10 MB build, in a browser worker) until R5b. `fixtures/opencv/golden.json` is what that pipeline
// gave on a set of pictures (see fixtures/opencv/generate.mjs); these tests hold the TypeScript to it. Masks and traced rings must be
// the same, pixel for pixel and point for point. The one allowance is the edge of a hand-drawn lasso, where the two fill a polygon
// with slightly different rules: a pixel or two along the line, never inside.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { silhouetteMask } from './cut.ts';
import { binarize } from './mask.ts';
import { traceImage } from './trace.ts';
import { asPixels, CUT_SETTINGS, LASSOS, pictures, TRACE_SETTINGS } from '../fixtures/opencv/cases.ts';

type Ring = { area: number; points: number[] };
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/opencv/golden.json', import.meta.url)), 'utf8')) as {
  cases: { image: string; w: number; h: number; binarize: { used: number; sha: string }[]; trace: { used: number; dropped: number; shapes: { outer: Ring; holes: Ring[] }[] }[]; silhouette: { cut: number; lasso: number; sha: string; runs?: number[] }[] }[];
};
const sha = (b: Uint8Array) => createHash('sha1').update(b).digest('hex');
const unrle = (runs: number[], n: number) => { const out = new Uint8Array(n); let i = 0, v = 0; for (const r of runs) { if (v) out.fill(255, i, i + r); i += r; v ^= 1; } return out; };
const pics = pictures();

describe('the same as OpenCV', () => {
  test('the case list is the one the goldens were made from', () => {
    expect(golden.cases.map(c => c.image)).toEqual(pics.map(p => p.name));
    expect(golden.cases.every((c, i) => c.w === pics[i].w && c.h === pics[i].h)).toBe(true);
  });

  for (const [i, pic] of pics.entries()) describe(pic.name, () => {
    const g = golden.cases[i];
    test.each(TRACE_SETTINGS.map((s, k) => [k, s] as const))('mask %i: grey, blur, level, close, alpha', (k, s) => {
      const r = binarize(asPixels(pic), s);
      expect(r.thresholdUsed).toBe(g.binarize[k].used);
      expect(sha(r.binary.d)).toBe(g.binarize[k].sha);
    });

    test.each(TRACE_SETTINGS.map((s, k) => [k, s] as const))('trace %i: the rings, their order and what was dropped', (k, s) => {
      const t = traceImage(asPixels(pic), s), want = g.trace[k];
      expect(t.thresholdUsed).toBe(want.used);
      expect(t.droppedCount).toBe(want.dropped);
      expect(t.shapes.map(sh => ({ outer: { area: sh.outer.area, points: Array.from(sh.outer.points) }, holes: sh.holes.map(h => ({ area: h.area, points: Array.from(h.points) })) }))).toEqual(want.shapes);
    });

    test.each(g.silhouette.map(x => [x.cut, x.lasso, x] as const))('silhouette %i, lasso %i', (cut, lasso, want) => {
      const m = silhouetteMask(asPixels(pic), LASSOS[lasso](pic.w, pic.h), CUT_SETTINGS[cut]);
      if (!lasso) { expect(sha(m.d)).toBe(want.sha); return; }
      const ref = unrle(want.runs!, m.d.length);
      let diff = 0, on = 0;
      for (let p = 0; p < ref.length; p++) { if (ref[p]) on++; if ((ref[p] !== 0) !== (m.d[p] !== 0)) diff++; }
      expect(diff).toBeLessThanOrEqual(Math.max(8, Math.ceil(on * 0.005)));
    });
  });
});
