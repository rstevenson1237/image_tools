/**
 * The pictures and settings the OpenCV comparison runs (generate.mjs makes `golden.json` from real OpenCV; src/opencv.test.ts holds the
 * TypeScript to it). The synthetic pictures are drawn from a seed, so the case list is the same everywhere.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePNG } from 'artgen-primitives/lib/png.ts';
import type { Pixels } from '../../src/mask.ts';

export type Picture = { name: string; w: number; h: number; d: Uint8ClampedArray };

const rngOf = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

/** Dark ellipses and bright cut-outs on a speckled light ground; with `alpha`, everything outside a big ellipse is transparent. */
function synth(name: string, w: number, h: number, seed: number, alpha: boolean): Picture {
  const r = rngOf(seed), d = new Uint8ClampedArray(w * h * 4), bg = 200 + Math.floor(r() * 55);
  for (let i = 0; i < w * h; i++) { const n = Math.floor(r() * 12); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = bg - n; d[i * 4 + 3] = 255; }
  const k = 3 + Math.floor(r() * 5);
  for (let q = 0; q < k; q++) {
    const cx = r() * w, cy = r() * h, rx = 3 + r() * w / 4, ry = 3 + r() * h / 4, v = Math.floor(r() * 120), hole = r() < 0.3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) {
      const i = (y * w + x) * 4, val = hole ? bg : v;
      d[i] = val + (x % 3); d[i + 1] = val; d[i + 2] = val + (y % 4);
    }
  }
  if (alpha) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x - w / 2) / (w * 0.45)) ** 2 + ((y - h / 2) / (h * 0.4)) ** 2 > 1) d[(y * w + x) * 4 + 3] = 0;
  return { name, w, h, d };
}

export function pictures(): Picture[] {
  const out: Picture[] = [];
  for (let i = 0; i < 14; i++) out.push(synth(`synth${i}`, 40 + (i * 13) % 90, 40 + (i * 17) % 90, i + 1, i % 3 === 0));
  const dir = fileURLToPath(new URL('../images/', import.meta.url));
  for (const f of ['hero', 'ship', 'tank', 'isospider', 'bog-goblin.v2', 'wisp.v1', 'sunk-crate.v2']) {
    const g = decodePNG(new Uint8Array(readFileSync(`${dir}${f}.png`)));
    out.push({ name: f, w: g.w, h: g.h, d: g.d });
  }
  return out;
}

export const asPixels = (p: Picture): Pixels => ({ w: p.w, h: p.h, d: p.d });

/** Trace settings: the web defaults, then outlines only with no blur or simplifying, then a high fixed level with a big blur and close. */
export const TRACE_SETTINGS = [
  { threshold: 'otsu', invert: false, blur: 3, smoothing: 3, respectAlpha: true, simplifyTolerance: 1.5, minArea: 24, keepHoles: true, maxPaths: 120 },
  { threshold: 'otsu', invert: true, blur: 0, smoothing: 0, respectAlpha: false, simplifyTolerance: 0, minArea: 0, keepHoles: false, maxPaths: 50 },
  { threshold: 100, invert: false, blur: 7, smoothing: 5, respectAlpha: true, simplifyTolerance: 3, minArea: 10, keepHoles: true, maxPaths: 120 },
  { threshold: 160, invert: true, blur: 15, smoothing: 9, respectAlpha: false, simplifyTolerance: 0.7, minArea: 5, keepHoles: true, maxPaths: 120 },
] as const;

/** Cut settings. */
export const CUT_SETTINGS = [
  { threshold: 'otsu', invert: false, keepLargestBlob: true, smoothing: 5 },
  { threshold: 128, invert: true, keepLargestBlob: false, smoothing: 0 },
  { threshold: 'otsu', invert: false, keepLargestBlob: true, smoothing: 0 },
] as const;

/** The lassos: none (the whole picture), and a four-sided one inside it. */
export const LASSOS = [
  (_w: number, _h: number) => [] as { x: number; y: number }[],
  (w: number, h: number) => [{ x: w * 0.1, y: h * 0.1 }, { x: w * 0.9, y: h * 0.15 }, { x: w * 0.8, y: h * 0.9 }, { x: w * 0.2, y: h * 0.7 }],
];
