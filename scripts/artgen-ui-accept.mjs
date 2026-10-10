// UI acceptance run: the production build of the image tools, served from a sub-path with no special headers
// (as on GitHub Pages), driven in headless Chromium against a copy of a fixture game repo.
//
//   1. Art Direction: open the repo, change a ramp, watch the live style tile, save the draft and lock it.
//      → `artgen status` in the repo sees direction v3 and every approved asset stale.
//   2. Claude Code's turn: `artgen restyle` re-renders under v3.
//   3. Asset Review: reload, approve a restyled final; request changes on another with a note pinned to a region.
//      → `artgen status` shows the approval and the revision; `artgen make` quotes the pinned note to Claude Code.
//   4. Asset Lab: play an asset through the runtime's canvas2d adapter.
//   5. Zip fallback (a browser without showDirectoryPicker): import a zip, request changes, download the zip, unpack it.
//      → `artgen status` on the unpacked copy shows the revision.
//
// Headless Chromium can't click through a directory picker, so the picker is replaced by one that returns a folder in
// the origin-private file system holding a copy of the repo — the same FileSystemDirectoryHandle API the real picker
// returns. Needs Playwright (`npm i -g playwright`, or set NODE_PATH to where it lives), a production build
// (`BASE_PATH=/image_tools/ npm run build`) and the fixture tools (`npm run fixtures:install`).
//
//   node scripts/artgen-ui-accept.mjs [fixture=swamp-topdown] [out=<tmp>/artgen-ui-accept]   (screenshots + record)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { unzipSync } from 'fflate';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(import.meta.dirname, '..'), fixture = process.argv[2] ?? 'swamp-topdown';
const out = process.argv[3] ? resolve(process.argv[3]) : join(tmpdir(), 'artgen-ui-accept'), dist = join(root, 'dist'), BASE = '/image_tools/';
if (!existsSync(join(dist, 'index.html'))) throw new Error('build first: BASE_PATH=/image_tools/ npm run build');
mkdirSync(out, { recursive: true });

const tmp = mkdtempSync(join(tmpdir(), 'artgen-p5-')), repo = join(tmp, fixture);
cpSync(join(root, 'examples', fixture), repo, { recursive: true, filter: s => !s.includes('node_modules') });
const cli = (...args) => execFileSync(process.execPath, [join(repo, 'tools/artgen/artgen.js'), ...args], { cwd: repo, encoding: 'utf8' });
const statusJson = () => JSON.parse(cli('status', '--json'));
const log = (...a) => console.log('·', ...a);
const record = [];
const note = (k, v) => { record.push([k, v]); log(k, typeof v === 'string' ? v : JSON.stringify(v)); };

// ---- a static host like Pages: sub-path, no COOP/COEP ----------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let f = join(dist, url.slice(BASE.length));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const appUrl = `http://localhost:${server.address().port}${BASE}`;

// ---- art folder <-> origin-private file system ----------------------------------------------------------------------
function tree(dir) {
  const files = {};
  const go = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'out') go(p); } else files[relative(dir, p).split('\\').join('/')] = readFileSync(p).toString('base64'); } };
  go(dir);
  return files;
}
const toOpfs = (page, files) => page.evaluate(async ({ name, files }) => {
  const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
  for (const [p, b64] of Object.entries(files)) {
    const parts = p.split('/'), file = parts.pop();
    let d = root;
    for (const s of parts) d = await d.getDirectoryHandle(s, { create: true });
    const w = await (await d.getFileHandle(file, { create: true })).createWritable();
    await w.write(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    await w.close();
  }
}, { name: fixture, files });
const fromOpfs = page => page.evaluate(async name => {
  const out = {};
  const go = async (d, pre) => {
    for await (const [n, h] of d.entries()) {
      if (h.kind === 'directory') await go(h, `${pre}${n}/`);
      else { const b = new Uint8Array(await (await h.getFile()).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); out[`${pre}${n}`] = btoa(s); }
    }
  };
  await go(await (await navigator.storage.getDirectory()).getDirectoryHandle(name), '');
  return out;
}, fixture);
const writeBack = files => { for (const [p, b64] of Object.entries(files)) { const f = join(repo, p); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, Buffer.from(b64, 'base64')); } };

const browser = await chromium.launch();
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('dialog', d => d.accept());
};

try {
  // ---- 1. Art Direction ----------------------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(name => {
    // the directory picker the user would click through, returning the repo copy in the origin-private file system
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name);
  }, fixture);
  const page = await ctx.newPage();
  watch(page);
  // the existing tools still load as before (their own tests run in `npm test`)
  for (const [tool, text] of [['token-cutter', 'Drop an image here'], ['svg-tracer', 'Drop an image here']]) {
    await page.goto(`${appUrl}#${tool}`);
    await page.getByText(text).first().waitFor();
  }
  note('existing tools', 'Token Cutter and SVG Tracer load');
  await page.goto(`${appUrl}#art-direction`);
  await toOpfs(page, Object.fromEntries(Object.entries(tree(join(repo, 'art'))).map(([p, b]) => [`art/${p}`, b])));
  await page.getByRole('button', { name: 'Open game folder…' }).click();
  await page.getByText('Palette', { exact: true }).waitFor();
  await page.getByLabel('probe set under').waitFor({ timeout: 60_000 });
  const before = statusJson();
  note('before: direction', cli('direction', 'show', '--json').match(/"version":\s*(\d+)/)?.[1]);
  note('before: statuses', Object.fromEntries(before.map(r => [r.id, r.status])));

  // the change: the cloth ramp (the goblin's skin, the lantern-bearer's coat) a step greener and lighter
  const swatch = page.getByLabel('cloth 1', { exact: true });
  const oldCloth = await swatch.inputValue();
  await swatch.fill('#6f8a4f');
  await page.getByText('edited', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[aria-label^="probe set under edit"]'), null, { timeout: 60_000 });
  await page.screenshot({ path: join(out, 'art-direction.png') });
  note('ramp change', `cloth.1 ${oldCloth} → #6f8a4f`);
  await page.getByLabel('lock note').fill('greener cloth (image tools acceptance)');
  await page.getByRole('button', { name: 'Save draft and lock' }).click();
  await page.getByRole('status').filter({ hasText: 'locked next' }).waitFor({ timeout: 60_000 });
  note('UI notice', await page.getByRole('status').innerText());
  writeBack(Object.fromEntries(Object.entries(await fromOpfs(page)).filter(([p]) => p.startsWith('art/'))));
  const afterLock = statusJson(), dir = JSON.parse(readFileSync(join(repo, 'art/direction.json'), 'utf8'));
  note('after lock: direction', `${dir.id} v${dir.version} (${dir.status}), cloth ${dir.palette.ramps.cloth.join(' ')}`);
  note('after lock: statuses', Object.fromEntries(afterLock.map(r => [r.id, r.status])));
  if (dir.version !== 3 || dir.palette.ramps.cloth[1] !== '#6f8a4f') throw new Error('lock did not reach direction.json');
  if (!afterLock.every(r => r.status === 'stale')) throw new Error('approved assets should be stale after the lock');
  note('direction validate', cli('direction', 'validate', 'art/direction.json').trim().split('\n')[0]);

  // ---- 2. Claude Code's turn: restyle ------------------------------------------------------------------------------
  const rs = JSON.parse(cli('restyle', '--json'));
  note('restyle (CLI)', rs.assets.map(a => `${a.id} ${a.changedPct}%`).join(', '));
  await toOpfs(page, Object.fromEntries(Object.entries(tree(join(repo, 'art'))).map(([p, b]) => [`art/${p}`, b])));

  // ---- 3. Asset Review ----------------------------------------------------------------------------------------------
  await page.getByRole('button', { name: /Asset Review/ }).click();
  await page.getByRole('button', { name: 'Reload' }).click();
  await page.locator('[data-asset]').first().waitFor({ timeout: 60_000 });
  const finals = statusJson().filter(r => r.status === 'final').map(r => r.id);
  note('finals after restyle', finals);
  const approveId = finals.includes('bog-goblin') ? 'bog-goblin' : finals[0], feedbackId = finals.find(x => x !== approveId);
  await page.locator(`[data-asset="${approveId}"]`).click();
  await page.getByRole('button', { name: /^Approve / }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, 'asset-review.png') });
  await page.getByLabel('Approve note (optional)').fill('greener coat reads well (acceptance)');
  await page.getByRole('button', { name: /^Approve / }).click();
  await page.getByRole('status').filter({ hasText: `approved ${approveId}` }).waitFor({ timeout: 60_000 });
  await page.locator('header.head .badge', { hasText: 'approved' }).waitFor();
  note('UI notice', await page.getByRole('status').innerText());

  await page.locator(`[data-asset="${feedbackId}"]`).click();
  await page.getByRole('button', { name: /^Approve / }).waitFor();
  const preview = page.getByLabel(/drag to pin a note/);
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'form / colour (base)' }).click();
  await page.getByPlaceholder(/pinned region/).fill('this patch went too green under v3; keep it closer to the old mud tone');
  await page.screenshot({ path: join(out, 'asset-review-feedback.png') });
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await page.getByRole('status').filter({ hasText: `requested changes on ${feedbackId}` }).waitFor({ timeout: 60_000 });
  await page.locator('header.head .badge', { hasText: 'revision' }).waitFor();
  note('UI notice', await page.getByRole('status').innerText());
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.getByRole('region', { name: 'Analytics' }).waitFor();
  await page.screenshot({ path: join(out, 'analytics.png') });

  writeBack(Object.fromEntries(Object.entries(await fromOpfs(page)).filter(([p]) => p.startsWith('art/'))));
  const after = statusJson(), row = id => after.find(r => r.id === id);
  note('after review: statuses', Object.fromEntries(after.map(r => [r.id, r.status])));
  const ledger = readFileSync(join(repo, 'art/ledger.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(e => e.via === 'image-tools');
  note('ledger lines from the UI', ledger.map(e => `${e.type} ${e.asset}${e.version ? ` ${e.version}` : ''}${e.opens ? ` → ${e.opens}` : ''}${e.region ? ` region ${e.region.join(',')}` : ''} by ${e.by}`));
  if (row(approveId).status !== 'approved') throw new Error(`${approveId} should be approved, is ${row(approveId).status}`);
  if (row(feedbackId).status !== 'revision') throw new Error(`${feedbackId} should be in revision, is ${row(feedbackId).status}`);
  note('artgen status (CLI) after the UI', cli('status').trim());
  // the U-stage input reaches Claude Code: the next step `make` names quotes the note and the pinned region
  const mk = cli('make', feedbackId).trim();
  note(`artgen make ${feedbackId} (CLI)`, mk.split('\n').filter(l => /next|user:/.test(l)).join(' | '));
  if (!mk.includes('keep it closer to the old mud tone') || !/region x,y,w,h \d+,\d+,\d+,\d+/.test(mk)) throw new Error('make does not quote the feedback note and region');

  // ---- 4. Asset Lab -------------------------------------------------------------------------------------------------
  await page.getByRole('button', { name: /Asset Lab/ }).click();
  await page.getByLabel('runtime preview').waitFor();
  // a walker (8 facings, walk cycle) shows the most: the one that just got feedback still has its finished versions
  const labId = after.find(r => r.kind === 'character' && r.id === feedbackId)?.id ?? after.find(r => r.kind === 'character')?.id ?? after[0].id;
  await page.getByLabel('asset').selectOption(labId);
  await page.getByText(new RegExp(`${labId} .*played by artgen-runtime`)).waitFor({ timeout: 60_000 });
  if (await page.getByLabel('state').locator('option[value="walk"]').count()) await page.getByLabel('state').selectOption('walk');
  if (await page.getByRole('checkbox', { name: /turn/ }).count()) await page.getByRole('checkbox', { name: /turn/ }).check();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, 'asset-lab.png') });
  note('asset lab', await page.getByText(/played by artgen-runtime/).innerText());
  await ctx.close();

  // ---- 5. Zip fallback ------------------------------------------------------------------------------------------------
  const zctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  await zctx.addInitScript(() => { delete window.showDirectoryPicker; delete Window.prototype.showDirectoryPicker; });
  const zpage = await zctx.newPage();
  watch(zpage);
  await zpage.goto(`${appUrl}#asset-review`);
  const zipPath = join(tmp, `${fixture}.zip`);
  execFileSync('zip', ['-qr', zipPath, fixture, '-x', '*/node_modules/*', '*/out/*'], { cwd: tmp });
  await zpage.getByText("This browser can't open folders directly").waitFor();
  const [chooser] = await Promise.all([zpage.waitForEvent('filechooser'), zpage.getByRole('button', { name: 'Import zip…' }).click()]);
  await chooser.setFiles(zipPath);
  await zpage.locator('[data-asset]').first().waitFor({ timeout: 60_000 });
  // every final is decided by now: send feedback on an approved asset (a user iteration) through the zip copy
  const zId = after.find(r => r.status === 'approved' && r.id !== approveId).id;
  await zpage.locator(`[data-asset="${zId}"]`).click();
  await zpage.getByRole('button', { name: 'Send feedback' }).waitFor();
  await zpage.getByPlaceholder(/what should change/).fill('a little less contrast in the highlights (zip round trip)');
  await zpage.getByRole('button', { name: 'Send feedback' }).click();
  await zpage.getByRole('status').filter({ hasText: `requested changes on ${zId}` }).waitFor({ timeout: 60_000 });
  await zpage.locator('header.head .badge', { hasText: 'revision' }).waitFor();
  await zpage.screenshot({ path: join(out, 'zip-fallback.png') });
  const [dl] = await Promise.all([zpage.waitForEvent('download'), zpage.getByRole('button', { name: /Download art\.zip/ }).click()]);
  const zbytes = new Uint8Array(readFileSync(await dl.path())), files = unzipSync(zbytes);
  note('zip download', `${dl.suggestedFilename()}: ${Object.keys(files).length} files; ${new TextDecoder().decode(files['art/.image-tools-changes.txt']).trim().split('\n').slice(1).join(' ')}`);
  for (const [p, d] of Object.entries(files)) if (!p.endsWith('/')) { const f = join(repo, p); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, d); }
  const zrow = statusJson().find(r => r.id === zId);
  note('after zip round trip', `${zId}: ${zrow.status} (${zrow.why})`);
  if (zrow.status !== 'revision') throw new Error(`${zId} should be in revision after the zip round trip`);
  await zctx.close();

  note('console errors', errors.length ? errors : 'none');
  writeFileSync(join(out, 'acceptance.json'), JSON.stringify({ fixture, steps: record.map(([step, value]) => ({ step, value })) }, null, 2) + '\n');
  log(`ok — screenshots and acceptance.json in ${out}`);
} finally {
  await browser.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
