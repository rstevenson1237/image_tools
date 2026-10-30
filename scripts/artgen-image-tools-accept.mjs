// Image tools acceptance (docs/TOOLING-PLAN.md R5b): the production build of the web app, driven in headless Chromium. The four tools
// that run on `artgen-imagekit` (no OpenCV any more) each take a picture and give a file:
//
//   1. SVG Tracer      trace an island sketch → export an SVG with an even-odd path for the island and its hole
//   2. Token Cutter    lasso it → extract the silhouette → export a PNG that is the island, cropped
//   3. Palette         take the colours of a two-tone picture → snapped picture and a .hex file
//   4. Sprite Slicer   slice a sheet by a grid and by loose sprites → a zip with the cells and slices.json
//
// The build holds no OpenCV: dist/ must not contain opencv.js. Needs Playwright (`require('playwright')`, or set NODE_PATH) and
// `npm run build`.
//
//   node scripts/artgen-image-tools-accept.mjs [--out <dir>]
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { decodePNG, encodePNG, Grid } from 'artgen-primitives';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const root = join(import.meta.dirname, '..'), dist = join(root, 'dist'), out = resolve(arg('--out', join(tmpdir(), 'artgen-image-tools-accept')));
if (!existsSync(join(dist, 'index.html'))) throw new Error('build first: npm run build');
mkdirSync(out, { recursive: true });
const log = (...a) => console.log('·', ...a);
const check = (ok, what) => { if (!ok) throw new Error(`FAILED: ${what}`); log('ok', what); };

// no OpenCV in the build
const walk = d => readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
check(!walk(dist).some(f => /opencv/i.test(f)), 'dist/ holds no OpenCV file');

// the pictures
const island = new Grid(240, 200);
island.fill(0, 0, 240, 200, '#f4f0e6');
for (let y = 0; y < 200; y++) for (let x = 0; x < 240; x++) if (Math.hypot(x - 120, y - 100) < 70 && Math.hypot(x - 140, y - 90) > 20) island.set(x, y, '#2b2b2b');
writeFileSync(join(out, 'island.png'), encodePNG(island));
const sheet = new Grid(64, 32);
sheet.fill(2, 2, 10, 10, '#d33'); sheet.fill(36, 4, 12, 8, '#3d3'); sheet.fill(40, 20, 8, 8, '#33d');
writeFileSync(join(out, 'sheet.png'), encodePNG(sheet));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]), file = join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  const openTool = async name => { await page.locator('nav button', { has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) }).click(); await page.waitForTimeout(300); };
  const button = name => page.getByRole('button', { name, exact: true });
  const download = async click => { const [d] = await Promise.all([page.waitForEvent('download'), click()]); const f = join(out, d.suggestedFilename()); await d.saveAs(f); return f; };

  // 1. SVG Tracer
  await openTool('SVG Tracer');
  await page.locator('input[type=file]').first().setInputFiles(join(out, 'island.png'));
  await button('Trace image').click();
  await page.getByText(/1 shape/).waitFor({ timeout: 20_000 });
  const svg = readFileSync(await download(() => button('Export SVG').click()), 'utf8');
  check(/fill-rule="evenodd"/.test(svg) && (svg.match(/<path /g) ?? []).length === 1 && (svg.match(/ Z/g) ?? []).length === 2, 'SVG Tracer: one path with the island and its hole');

  // 2. Token Cutter
  await openTool('VTT Token Cutter');
  await page.locator('input[type=file]').first().setInputFiles(join(out, 'island.png'));
  await page.waitForTimeout(800);
  const box = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  for (const [fx, fy] of [[0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]]) await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 6 });
  await page.mouse.up();
  await button('Extract silhouette').click();
  await page.getByText('Silhouette ready.').waitFor({ timeout: 20_000 });
  const png = decodePNG(new Uint8Array(readFileSync(await download(() => button('Export PNG').click()))));
  let opaque = 0;
  for (let i = 3; i < png.d.length; i += 4) if (png.d[i]) opaque++;
  check(opaque > 5000 && png.w < 240 && png.h < 200, `Token Cutter: a cropped silhouette (${png.w}x${png.h}, ${opaque} px)`);

  // 3. Palette
  await openTool('Palette');
  await page.locator('input[type=file]').first().setInputFiles(join(out, 'island.png'));
  await page.locator('.swatch').first().waitFor({ timeout: 20_000 });
  const swatches = await page.locator('.swatch').count();
  check(swatches >= 2, `Palette: ${swatches} colours taken`);
  const hex = readFileSync(await download(() => button('Download .hex').click()), 'utf8').trim().split('\n');
  check(hex.length === swatches && hex.every(h => /^[0-9a-f]{6}$/.test(h)), 'Palette: the .hex file lists them');

  // 4. Sprite Slicer
  await openTool('Sprite Slicer');
  await page.locator('input[type=file]').first().setInputFiles(join(out, 'sheet.png'));
  await page.getByText(/\d+ cells?/).waitFor({ timeout: 20_000 });
  await button('Loose sprites').click();
  await page.getByText('3 cells').waitFor({ timeout: 20_000 });
  const zip = unzipSync(new Uint8Array(readFileSync(await download(() => page.getByRole('button', { name: /Download \.zip/ }).click()))));
  const slices = JSON.parse(strFromU8(zip['slices.json']));
  check(slices.cells.length === 3 && Object.keys(zip).length === 4 && slices.cells[0].w === 10, 'Sprite Slicer: three sprites and slices.json in the zip');

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await page.screenshot({ path: join(out, 'final.png') });
  log('image tools acceptance passed');
} finally {
  await browser.close();
  server.close();
}
