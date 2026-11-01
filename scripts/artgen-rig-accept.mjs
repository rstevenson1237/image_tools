// Rigged-model acceptance (docs/RIGS3D.md, R7b; plan §10 R7: "a rigged .glb character walks in the three.js example game"):
// the billboard-crawler example is built with Vite and served, and headless Chromium (software WebGL) plays it. The night
// warden there is `art/assets/character/warden`, exported by `artgen rig` to `public/assets/models/warden.rigged.glb` and
// loaded with three's GLTFLoader through the runtime's `riggedModel`. Checks:
//
//   - the model loads: a clip per state (idle, walk, attack, hurt), three levels of detail, one skeleton of 12 bones
//   - it walks: on the walk clip its leg bones turn, its feet move against the root, and it travels round its circle
//   - it is drawn: the frame with the warden differs from the same frame with it hidden, in a patch round where it stands
//   - it strikes and walks on: `play('attack')` holds at the end (`done`), `play('walk')` resumes
//   - its levels of detail follow the camera: near shows LOD0, far the last
//   - the page logs no errors
//
//   node scripts/artgen-rig-accept.mjs [--out <dir>] [--screenshot]   (npm run accept:rig)
// --screenshot also writes examples/billboard-crawler/screenshot.png. Needs Playwright with Chromium.
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const root = join(import.meta.dirname, '..'), game = join(root, 'examples', 'billboard-crawler');
const keep = arg('--out', ''), work = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'artgen-rig-accept-')), dist = join(work, 'dist');
mkdirSync(work, { recursive: true });
const failures = [];
const ok = (cond, m) => { console.log(`${cond ? '  ok  ' : '  FAIL'} ${m}`); if (!cond) failures.push(m); };

if (!existsSync(join(game, 'public', 'assets', 'models', 'warden.rigged.glb'))) throw new Error('no warden.rigged.glb: run `node tools/artgen/artgen.js rig warden --out public/assets/models` in examples/billboard-crawler');
execFileSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: game, stdio: 'inherit' });
console.log(`· built the game into ${dist}`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = existsSync(p) && statSync(p).isDirectory() ? join(p, 'index.html') : p;
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => globalThis.__game?.warden, null, { timeout: 60_000 });

  const info = await page.evaluate(() => {
    const { warden: w } = globalThis.__game, skinned = [];
    w.object.traverse(o => { if (o.isSkinnedMesh) skinned.push({ name: o.name, bones: o.skeleton.bones.length, tris: o.geometry.index.count / 3 }); });
    return { clips: Object.keys(w.clips), lods: w.lods.map(l => l.triangles), skinned, state: w.state, plan: w.info.rig.plan };
  });
  ok(['idle', 'walk', 'attack', 'hurt'].every(c => info.clips.includes(c)), `clips: ${info.clips.join(', ')}`);
  ok(info.lods.length === 3 && info.skinned.length >= 3 && info.skinned.every(s => s.bones === 12), `${info.plan} rig: ${info.skinned.length} skinned meshes over 12 bones, LODs ${info.lods.join(' / ')} triangles`);
  ok(info.state === 'walk', `the game starts it walking (${info.state})`);

  // it travels: the game's own loop carries it round its circle
  const p0 = await page.evaluate(() => globalThis.__game.warden.object.position.toArray());
  await page.waitForTimeout(800);
  const p1 = await page.evaluate(() => globalThis.__game.warden.object.position.toArray());
  ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.05, `the game walks it round its circle (${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)} units in 0.8 s)`);
  if (process.argv.includes('--screenshot')) {
    await page.evaluate(() => globalThis.__game.setTime(9.5));
    await page.waitForTimeout(300);
    await page.locator('canvas').screenshot({ path: join(game, 'screenshot.png') });
    console.log('· wrote examples/billboard-crawler/screenshot.png');
  }

  // freeze the game's loop, then step the walk by hand: bones turn, the feet move against the root
  const walk = await page.evaluate(async () => {
    const g = globalThis.__game, w = g.warden, out = [];
    g.renderer.setAnimationLoop(null);
    w.play('walk', { fade: 0, restart: true });
    const v = new w.object.position.constructor();
    for (let i = 0; i < 4; i++) {
      w.update(i ? 125 : 0);
      const bone = n => w.object.getObjectByName(n), foot = bone('legL_lo').getWorldPosition(v.clone()), hip = bone('hip').getWorldPosition(v.clone());
      out.push({ thigh: bone('legL_up').quaternion.toArray().map(x => +x.toFixed(4)), footFwd: +(foot.clone().sub(hip).applyQuaternion(w.object.quaternion.clone().invert()).z.toFixed(4)) });
    }
    return out;
  });
  ok(new Set(walk.map(k => k.thigh.join(','))).size === 4, 'the thigh turns at every quarter of the walk');
  const fwd = walk.map(k => k.footFwd);
  ok(Math.max(...fwd) - Math.min(...fwd) > 0.05, `the left foot swings ${(Math.max(...fwd) - Math.min(...fwd)).toFixed(2)} units fore and aft of the hip`);

  // drawn: the frame with and without the warden (the game paused, the same camera)
  const drawn = await page.evaluate(() => {
    const g = globalThis.__game, w = g.warden, gl = g.renderer.getContext();
    g.setTime(3);
    g.camera.position.set(0, 1.2, 4.4); g.camera.lookAt(0, 0.6, 0);
    w.at(0, 0, 1.6).face(0.5).play('walk', { fade: 0 }).update(200, g.camera);
    const read = () => { g.renderer.render(g.scene, g.camera); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return { W, H, px }; };
    const a = read();
    w.object.visible = false;
    const b = read();
    w.object.visible = true;
    let changed = 0;
    for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 12) changed++;
    g.renderer.render(g.scene, g.camera);
    return { changed, total: a.W * a.H, lod: w.lod };
  });
  ok(drawn.changed > 400, `the warden covers ${drawn.changed} of ${drawn.total} pixels of the frame (LOD${drawn.lod})`);
  await page.screenshot({ path: join(work, 'warden.png') });

  // strike and walk on; levels of detail by distance
  const more = await page.evaluate(() => {
    const g = globalThis.__game, w = g.warden, cam = g.camera.clone();
    w.play('attack', { fade: 0 });
    w.update(250, g.camera); const mid = w.done;
    w.update(400, g.camera); const end = w.done;
    w.play('walk', { fade: 0 }); w.update(100, g.camera);
    const lod = d => { cam.position.set(w.object.position.x, 1, w.object.position.z + d); cam.updateMatrixWorld(); w.update(0, cam); return w.lod; };
    return { mid, end, state: w.state, near: lod(1), far: lod(500), distances: w.lods.map(l => l.distance) };
  });
  ok(!more.mid && more.end && more.state === 'walk', 'attack plays once and holds (done at its end), then the walk resumes');
  ok(more.near === 0 && more.far === 2, `LOD0 near, LOD2 far (switch distances ${more.distances.join(', ')})`);

  for (const e of errors) ok(false, e);
} finally {
  await browser.close();
  server.close();
}
if (!keep) rmSync(work, { recursive: true, force: true });
if (failures.length) { console.log(`rigged-model acceptance FAILED (${failures.length})`); process.exit(1); }
console.log('rigged-model acceptance passed: the warden loads, walks, strikes and switches levels of detail in the three.js example game');
