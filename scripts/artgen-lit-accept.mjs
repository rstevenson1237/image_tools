// Lit-sprite acceptance (docs/STAGES.md §7.2, R6c): `pixiLitAdapter` rendered in headless Chromium (WebGL) and compared, pixel
// by pixel, with `shadeTexel` (the reference of the lighting model in the runtime core).
//
// esbuild bundles a page (scripts/artgen-lit-accept.page.ts: Pixi + the adapter + the runtime's synthetic pack with normals);
// Chromium renders it with software WebGL (SwiftShader where there is no GPU), the page draws four sprites (two frames, one mirrored,
// one without normals) under each of these light rigs and reads the canvas back: no light, a light on the left, a light on the right,
// each smooth and banded, and two lights. Every opaque texel must be within ±3/255 per channel of `shadeTexel` (texels that sit on a
// band edge, where float32 and float64 may round to different steps, are counted apart). The rig is mutated between renders, as a game
// moving a lantern would. A last check makes sure the lights were seen: the light's side is brighter than its far side.
//
//   node scripts/artgen-lit-accept.mjs [--out <dir>]      (npm run accept:lit)
// Needs Playwright (`require('playwright')`, or set NODE_PATH) with Chromium installed.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { build } = require('esbuild');

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const root = join(import.meta.dirname, '..');
const keep = arg('--out', '');
const work = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'artgen-lit-accept-'));
mkdirSync(work, { recursive: true });
const TOL = 3, MIN_COMPARED = 150;
const failures = [];
const fail = m => { failures.push(m); console.log('  FAIL', m); };

const bundled = await build({
  entryPoints: [join(import.meta.dirname, 'artgen-lit-accept.page.ts')], bundle: true, format: 'iife', platform: 'browser', target: 'es2022', write: false, logLevel: 'error',
});
writeFileSync(join(work, 'page.js'), bundled.outputFiles[0].text);
writeFileSync(join(work, 'index.html'), '<!doctype html><meta charset="utf-8"><title>lit accept</title><body style="margin:0"><script src="page.js"></script>');
console.log(`· bundled the page (${Math.round(bundled.outputFiles[0].text.length / 1024)} KB) into ${work}`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let result;
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 200 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`file://${join(work, 'index.html')}`);
  result = await page.evaluate(() => globalThis.runAccept());
  await page.screenshot({ path: join(work, 'lit.png') });
  for (const e of errors) fail(e);
} finally {
  await browser.close();
}

console.log(`· ${result.renderer}`);
for (const s of result.scenarios) {
  const ok = s.maxDelta <= TOL && s.compared >= MIN_COMPARED && !s.bad.length;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${s.name.padEnd(22)} ${String(s.compared).padStart(4)} texels compared, max delta ${s.maxDelta}/255, ${s.unstable} on a band edge, mean rgb ${s.mean.join(",")}, sum ${s.total}`);
  if (s.compared < MIN_COMPARED) fail(`${s.name}: only ${s.compared} texels compared (need ${MIN_COMPARED})`);
  if (s.maxDelta > TOL) fail(`${s.name}: ${s.bad.join('; ')}`);
}
const by = Object.fromEntries(result.scenarios.map(s => [s.name, s]));
if (by['no light'] && by['light left'] && by['light left'].total === by['no light'].total) fail('a light changed nothing');
if (by['light left, 3 bands'] && by['light left'] && by['light left, 3 bands'].total === by['light left'].total) fail('banding changed nothing');
if (by['light left'] && by['light right'] && by['light left'].total === by['light right'].total) fail('the light on the left and on the right look the same');
if (!keep) rmSync(work, { recursive: true, force: true });
if (failures.length) { console.log(`lit-sprite acceptance FAILED (${failures.length})`); process.exit(1); }
console.log(`lit-sprite acceptance passed: ${result.scenarios.length} light rigs, every texel within ±${TOL}/255 of shadeTexel`);
