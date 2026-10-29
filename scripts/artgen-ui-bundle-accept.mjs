// Review UI acceptance (docs/TOOLING-PLAN.md R3): the `ui` module of the modular install, served by `artgen ui` from a game
// repo and driven in a headless browser. A fixture game repo is installed from the local build (`init --with art,maps,ui`),
// `artgen ui` serves it, and in each browser:
//
//   1. Art Direction: the repo is open without a click, with the art and map tools and without the OpenCV image tools;
//      change a ramp, watch the live style tile, save the draft and lock it. → `artgen status` sees direction v3 and
//      every approved asset stale.
//   2. Claude Code's turn: `artgen restyle` re-renders under v3.
//   3. Asset Review: Reload, approve a restyled final; request changes on another with a note pinned to a region.
//      → `artgen status` shows the approval and the revision, `artgen make` quotes the pinned note, and the ledger lines
//      carry `"via": "image-tools"`.
//   4. Asset Lab: play an asset through the runtime's canvas2d adapter.
//   5. A maps-only repo (`init --with maps,ui`): the sidebar shows the map tools and Asset Review (which lists the maps); a terrain map saved in the UI is the
//      file `artgen-maps.js map render` reads.
//
// Unlike the older acceptance (artgen-ui-accept.mjs: a folder handle in the origin-private file system, or a zip) no file
// API of the browser is involved, so it runs the same in Chromium and Firefox. A browser that is not installed is reported
// as skipped. Needs Playwright (`require('playwright')`, or set NODE_PATH) and the build (`npm run build -w artgen-dist`).
//
//   node scripts/artgen-ui-bundle-accept.mjs [--browsers chromium,firefox] [--fixture swamp-topdown] [--out <dir>]
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require('playwright');

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const root = join(import.meta.dirname, '..'), built = join(root, 'packages/artgen-dist/out');
const fixture = arg('--fixture', 'swamp-topdown'), browsers = arg('--browsers', 'chromium,firefox').split(',');
const out = resolve(arg('--out', join(tmpdir(), 'artgen-ui-bundle-accept')));
if (!existsSync(join(built, 'install.mjs'))) throw new Error('build the distribution first: npm run build -w artgen-dist');
mkdirSync(out, { recursive: true });
const log = (...a) => console.log('·', ...a);
const results = [];

/** A scratch game repo installed from the local build with these modules, and `artgen ui` serving it. */
async function serve(name, modules, withFixture) {
  const dir = mkdtempSync(join(tmpdir(), `artgen-ui-${name}-`)), repo = join(dir, 'game');
  mkdirSync(repo);
  execFileSync(process.execPath, [join(built, 'install.mjs'), 'init', '--with', modules, '--target', repo], { stdio: 'pipe' });
  if (withFixture) cpSync(join(root, 'examples', fixture, 'art'), join(repo, 'art'), { recursive: true });
  const prog = join(repo, 'tools/artgen', modules.includes('art') ? 'artgen.js' : 'artgen-maps.js');
  const child = spawn(process.execPath, [prog, 'ui', '--port', '0'], { cwd: repo });
  const link = await new Promise((ok, fail) => {
    let text = '';
    child.stdout.on('data', d => { text += d; const m = text.match(/artgen ui: (http:\/\/\S+)/); if (m) ok(m[1]); });
    child.stderr.on('data', d => { text += d; });
    child.once('exit', c => fail(new Error(`artgen ui exited ${c}: ${text}`)));
    setTimeout(() => fail(new Error(`no link printed: ${text}`)), 30_000);
  });
  const cli = (...args) => execFileSync(process.execPath, [join(repo, 'tools/artgen/artgen.js'), ...args], { cwd: repo, encoding: 'utf8' });
  return { dir, repo, link, cli, statusJson: () => JSON.parse(cli('status', '--json')), stop: () => { child.kill('SIGINT'); rmSync(dir, { recursive: true, force: true }); } };
}

async function artAndMaps(browserType, label) {
  const browser = await browserType.launch();
  const s = await serve(label, 'art,maps,ui', true), { repo, cli, statusJson, link } = s;
  const record = [], errors = [];
  const note = (k, v) => { record.push([k, v]); log(`[${label}]`, k, typeof v === 'string' ? v : JSON.stringify(v)); };
  const shot = n => join(out, `${label}-${n}.png`);
  const watch = page => {
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('dialog', d => d.accept());
  };
  try {
  // ---- 1. Art Direction ----------------------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${link.split('?')[0]}?${link.split('?')[1]}#art-direction`);
  // the served repo is open without a click, with the tools of its modules and no OpenCV image tools
  await page.locator('header.bar .name', { hasText: 'game' }).waitFor({ timeout: 60_000 });
  const sidebar = await page.locator('nav').innerText();
  for (const t of ['Art Direction', 'Asset Review', 'Asset Lab', 'Terrain Map', 'Dungeon Map', 'Settlement Map']) if (!sidebar.includes(t)) throw new Error(`the sidebar lacks ${t}`);
  for (const t of ['Token Cutter', 'SVG Tracer']) if (sidebar.includes(t)) throw new Error(`the review UI should not carry ${t}`);
  note('sidebar', 'art and maps tools, no image tools');
  if (page.url().includes('t=')) throw new Error('the token should be taken out of the address bar');
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
  await page.screenshot({ path: shot('art-direction') });
  note('ramp change', `cloth.1 ${oldCloth} → #6f8a4f`);
  await page.getByLabel('lock note').fill('greener cloth (image tools acceptance)');
  await page.getByRole('button', { name: 'Save draft and lock' }).click();
  await page.getByRole('status').filter({ hasText: 'locked next' }).waitFor({ timeout: 60_000 });
  note('UI notice', await page.getByRole('status').innerText());
  const afterLock = statusJson(), dir = JSON.parse(readFileSync(join(repo, 'art/direction.json'), 'utf8'));
  note('after lock: direction', `${dir.id} v${dir.version} (${dir.status}), cloth ${dir.palette.ramps.cloth.join(' ')}`);
  note('after lock: statuses', Object.fromEntries(afterLock.map(r => [r.id, r.status])));
  if (dir.version !== 3 || dir.palette.ramps.cloth[1] !== '#6f8a4f') throw new Error('lock did not reach direction.json');
  if (!afterLock.every(r => r.status === 'stale')) throw new Error('approved assets should be stale after the lock');
  note('direction validate', cli('direction', 'validate', 'art/direction.json').trim().split('\n')[0]);

  // ---- 2. Claude Code's turn: restyle ------------------------------------------------------------------------------
  const rs = JSON.parse(cli('restyle', '--json'));
  note('restyle (CLI)', rs.assets.map(a => `${a.id} ${a.changedPct}%`).join(', '));

  // ---- 3. Asset Review ----------------------------------------------------------------------------------------------
  await page.getByRole('button', { name: /Asset Review/ }).click();
  await page.getByRole('button', { name: 'Reload' }).click();   // Claude Code's restyle changed the files
  await page.locator('[data-asset]').first().waitFor({ timeout: 60_000 });
  const finals = statusJson().filter(r => r.status === 'final').map(r => r.id);
  note('finals after restyle', finals);
  const approveId = finals.includes('bog-goblin') ? 'bog-goblin' : finals[0], feedbackId = finals.find(x => x !== approveId);
  await page.locator(`[data-asset="${approveId}"]`).click();
  await page.getByRole('button', { name: /^Approve / }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('asset-review') });
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
  await page.screenshot({ path: shot('asset-review-feedback') });
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await page.getByRole('status').filter({ hasText: `requested changes on ${feedbackId}` }).waitFor({ timeout: 60_000 });
  await page.locator('header.head .badge', { hasText: 'revision' }).waitFor();
  note('UI notice', await page.getByRole('status').innerText());
  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.getByRole('region', { name: 'Analytics' }).waitFor();
  await page.screenshot({ path: shot('analytics') });

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
  await page.screenshot({ path: shot('asset-lab') });
  note('asset lab', await page.getByText(/played by artgen-runtime/).innerText());

    await ctx.close();
    note('console errors', errors.length ? errors : 'none');
    if (errors.length) throw new Error(`console errors: ${errors.join('; ')}`);
    results.push({ browser: label, steps: record.map(([step, value]) => ({ step, value })) });
  } finally { await browser.close(); s.stop(); }
}

async function mapsOnly(browserType, label) {
  const browser = await browserType.launch();
  const s = await serve(`${label}-maps`, 'maps,ui', false), errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${s.link}#terrain-map`);
    await page.locator('header.bar .name').waitFor({ timeout: 60_000 });
    const sidebar = await page.locator('nav').innerText();
    for (const t of ['Terrain Map', 'Dungeon Map', 'Settlement Map', 'Asset Review']) if (!sidebar.includes(t)) throw new Error(`maps-only: the sidebar lacks ${t}`);   // Asset Review lists the maps (R5)
    for (const t of ['Art Direction', 'Asset Lab', 'Token Cutter']) if (sidebar.includes(t)) throw new Error(`maps-only: the sidebar should not show ${t}`);
    // a terrain map made in the editor and saved to the project is the file the maps-only CLI reads
    await page.getByRole('button', { name: 'Save to project' }).click();
    await page.getByRole('status').filter({ hasText: /saved art\/maps\// }).waitFor({ timeout: 60_000 });
    const saved = (await page.getByRole('status').innerText()).match(/art\/maps\/([\w-]+)\/map\.json/);
    if (!saved || !existsSync(join(s.repo, 'art/maps', saved[1], 'map.json'))) throw new Error('maps-only: the map is not on disk');
    const rendered = execFileSync(process.execPath, [join(s.repo, 'tools/artgen/artgen-maps.js'), 'map', 'render', saved[1], '--ppu', '6'], { cwd: s.repo, encoding: 'utf8' });
    if (!/\.png/.test(rendered) || !existsSync(join(s.repo, 'art/maps', saved[1], 'out', `${saved[1]}.color.png`))) throw new Error(`maps-only: artgen-maps.js could not render the saved map\n${rendered}`);
    await page.screenshot({ path: join(out, `${label}-maps-only.png`) });
    log(`[${label}] maps-only: the sidebar shows the map tools and Asset Review, no art tools; the map saved in the UI (${saved[1]}) renders with artgen-maps.js`);
    if (errors.length) throw new Error(`maps-only: ${errors.join('; ')}`);
  } finally { await browser.close(); s.stop(); }
}

let failed = false;
for (const name of browsers) {
  const type = playwright[name];
  let ok = false;
  try { const b = await type.launch(); await b.close(); ok = true; } catch (e) { log(`${name}: skipped, not installed (${String(e.message).split('\n')[0]})`); results.push({ browser: name, skipped: true }); }
  if (!ok) continue;
  try { await artAndMaps(type, name); await mapsOnly(type, name); log(`${name}: passed`); }
  catch (e) { failed = true; console.error(`${name}: FAILED\n`, e); results.push({ browser: name, failed: String(e.message) }); }
}
writeFileSync(join(out, 'acceptance.json'), JSON.stringify({ fixture, results }, null, 2) + '\n');
log(`record and screenshots in ${out}`);
process.exit(failed || !results.some(r => r.steps) ? 1 : 0);
