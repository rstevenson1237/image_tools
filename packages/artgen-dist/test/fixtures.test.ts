// The fixture game repos (examples/, PLAN §1) as W1 + W2 acceptance evidence: each went from a pitch to a locked direction
// through the committed install (P2), then produced a 10-asset brief, took user feedback, restyled to direction v2 and
// exported a pack (P3), then became a small game that plays the pack through the vendored runtime (P4). Checks that the
// record is complete, that the anchors re-render exactly from the
// committed probe sources, and that the installed toolset matches the current distribution (fixtures are updated
// with `npm run fixtures:install` whenever the distribution changes).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { decodePNG, parseLedger, restyleDiff, type PackManifest } from 'artgen-core';
import {
  candidateNames, directionVersion, lockedDirection, openAsset, projectConfig, projectStatus, readBriefs, readJson, renderProbes, renderVersion,
  runtimeFiles, vendoredSource, type Project, type RuntimeStamp,
} from 'artgen-cli';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { buildDist } from '../build.mjs';
import { distFiles } from '../src/install.mjs';

const EXAMPLES = fileURLToPath(new URL('../../../examples/', import.meta.url));
const FIXTURES = ['swamp-topdown', 'iso-dungeon', 'billboard-crawler'];
const ENGINE: Record<string, string> = { 'swamp-topdown': 'pixi', 'iso-dungeon': 'pixi', 'billboard-crawler': 'three' };
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const GENERATED = new Set(['tools/artgen/artgen.js', 'tools/artgen/artgen-mcp.js', 'tools/artgen/resvg.wasm']);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex').slice(0, 16);
let dist = '';

beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'artgen-fixtures-')), 'out');
  await buildDist(out);
  dist = join(out, 'dist');
});

describe.each(FIXTURES)('fixture %s', name => {
  const root = join(EXAMPLES, name), p: Project = { root, art: join(root, 'art') };

  test('W1 record: interview, 3 candidates + a mix, style tiles, locked direction, anchors, style sheet', () => {
    expect(readJson<{ pitch: string }>(join(p.art, 'interview.json')).pitch.length).toBeGreaterThan(80);
    expect(candidateNames(p).slice(0, 4)).toEqual(['a', 'b', 'c', 'mix1']); // + `next`, the P3 restyle draft
    const tiles = readdirSync(join(p.art, 'candidates')).filter(f => f.startsWith('style-tile-'));
    expect(tiles.length).toBeGreaterThanOrEqual(3);
    const d = lockedDirection(p)!;
    expect(d).toMatchObject({ status: 'locked', version: 2 }); // v1 from W1, v2 from the P3 restyle
    for (const f of [...d.anchors, 'direction.png']) expect(existsSync(join(p.art, f)), f).toBe(true);
    const ledger = parseLedger(readFileSync(join(p.art, 'ledger.jsonl'), 'utf8')).filter(e => e.asset === 'direction');
    expect(ledger.filter(e => e.type === 'approve').map(e => e.direction?.version)).toEqual([1, 2]);
    expect(ledger.filter(e => e.type === 'review').length).toBe(tiles.length);
  });

  test('anchors re-render exactly from the committed probe sources under the locked direction', async () => {
    const d = lockedDirection(p)!, { images } = await renderProbes(p, d);
    const strip = images.effect;
    for (const kind of ['character', 'prop', 'tile'] as const) {
      const committed = decodePNG(new Uint8Array(readFileSync(join(p.art, 'anchors', `${kind}.png`))));
      expect(images[kind].hash(), `${name} ${kind}`).toBe(committed.hash());
    }
    expect(decodePNG(new Uint8Array(readFileSync(join(p.art, 'anchors', 'effect.png')))).w).toBe(strip.reduce((n, f) => n + f.w, 0) + strip.length - 1);
  });

  test('W2 record (PLAN P3): a 10-asset brief, every asset through r1-r3 + finish, both feedback routes, approved ≥ 6.5 with a passing gate', async () => {
    const briefs = readBriefs(p), ledger = parseLedger(readFileSync(join(p.art, 'ledger.jsonl'), 'utf8'));
    expect(briefs).toHaveLength(10);
    expect(new Set(briefs.map(b => b.kind)).size).toBeGreaterThanOrEqual(2);
    expect(briefs.some(b => b.directions === 8 && b.anims?.walk)).toBe(true);
    for (const b of briefs) {
      const passes = new Set(ledger.filter(e => e.asset === b.id && e.type === 'score').map(e => e.pass));
      expect(['r1', 'r2', 'r3', 'f'].every(x => passes.has(x)), `${b.id} ran ${[...passes]}`).toBe(true);
    }
    const routes = new Set(ledger.filter(e => e.type === 'feedback' && e.by === 'user' && e.asset !== 'direction').map(e => e.route));
    expect([...routes].sort()).toEqual(['base', 'finish']);
    const rows = await projectStatus(p);
    expect(rows.map(r => r.status)).toEqual(Array(10).fill('exported'));
    for (const r of rows) {
      expect(r.score, r.id).toBeGreaterThanOrEqual(6.5);
      expect(r.gate, r.id).toBe(true);
    }
  }, 120_000);

  test('W2 restyle (direction v1 → v2): every finished asset kept its tokens; the hand edit survives under v2', async () => {
    const ledger = parseLedger(readFileSync(join(p.art, 'ledger.jsonl'), 'utf8')), d = lockedDirection(p)!, v1 = directionVersion(p, 1);
    expect(d.version).toBe(2);
    const restyles = ledger.filter(e => e.type === 'restyle');
    expect(restyles).toHaveLength(10);
    for (const e of restyles) expect({ id: e.asset, tokenSame: e.tokenSame, consistent: e.consistent, gate: e.gate }).toEqual({ id: e.asset, tokenSame: 1, consistent: true, gate: true });
    // the hand-edited asset: its import-edit finish renders under v2, and the edited pixels map to the same tokens as under v1
    const edit = ledger.find(e => e.type === 'import-edit')!, b = readBriefs(p).find(x => x.id === edit.asset)!;
    const path = join(p.art, 'assets', b.kind, b.id), now = await renderVersion(openAsset(path), edit.version!);
    const old = openAsset(path); old.dir = v1;
    const before = await renderVersion(old, edit.version!);
    expect(restyleDiff(before.strip, now.strip, v1, d)).toMatchObject({ tokenSame: 1, consistent: true });
    expect(now.report.pass).toBe(true);
  }, 120_000);

  test('W2 export: the committed pack matches the approved finals and the typed ids', async () => {
    const pack = readJson<PackManifest>(join(root, 'public/assets/main/pack.json')), d = lockedDirection(p)!;
    expect(pack.direction).toEqual({ id: d.id, version: d.version });
    expect(Object.keys(pack.assets).sort()).toEqual(readBriefs(p).map(b => b.id).sort());
    for (const r of await projectStatus(p)) expect(pack.assets[r.id].version, r.id).toBe(r.final);
    const atlas = decodePNG(new Uint8Array(readFileSync(join(root, 'public/assets/main', pack.atlases[0]))));
    for (const [id, a] of Object.entries(pack.assets)) for (const [, x, y, w, h] of a.frames) expect(x + w <= atlas.w && y + h <= atlas.h, id).toBe(true);
    const ts = readFileSync(join(root, 'src/art/assets.ts'), 'utf8');
    for (const id of Object.keys(pack.assets)) expect(ts).toContain(`id: "${id}"`);
  }, 120_000);

  test('W3 game (PLAN P4): the art code is < 20 lines, all inside the `art` blocks', () => {
    let inArt = false, art = 0;
    const outside: string[] = [];
    for (const line of readFileSync(join(root, 'src/main.ts'), 'utf8').split('\n')) {
      const t = line.trim();
      if (t === '// art' || t === '// /art') { inArt = t === '// art'; continue; }
      if (!t || t.startsWith('//')) continue;
      if (inArt) art++;
      // scene layout tables may name assets by their typed id (`keyof typeof Assets`); anything else is art code
      else if (/\b(Assets|Packs|pack|loadPack)\b|art\/runtime/.test(t.replace(/keyof typeof Assets/g, ''))) outside.push(t);
    }
    expect(art).toBeGreaterThan(5);
    expect(art).toBeLessThan(20);
    expect(outside).toEqual([]);
  });

  test('W3 game typechecks against its engine, the vendored runtime and the typed ids', () => {
    const r = spawnSync(process.execPath, [TSC, '-p', join(root, 'tsconfig.json')], { encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 120_000);

  test('W3 vendoring: the runtime + configured adapter in src/art/runtime match this runtime version; the pack names it', () => {
    const cfg = projectConfig(p), dir = join(root, cfg.export.runtimeDir), stamp = readJson<RuntimeStamp>(join(dir, 'runtime.json'));
    expect(cfg.runtime.adapters).toEqual([ENGINE[name]]);
    expect(stamp).toMatchObject({ runtime: RUNTIME_VERSION, adapters: [ENGINE[name]] });
    const files = runtimeFiles(stamp.adapters);
    expect(Object.keys(stamp.files).sort()).toEqual([...files].sort());
    const stale = files.filter(f => readFileSync(join(dir, f), 'utf8') !== vendoredSource(f));
    expect(stale, 're-run `node tools/artgen/artgen.js export --runtime` in the fixture').toEqual([]);
    expect(readJson<PackManifest>(join(root, 'public/assets/main/pack.json')).runtime).toBe(RUNTIME_VERSION);
  });

  test('the installed toolset matches the current distribution', () => {
    const stale: string[] = [];
    for (const [rel, src] of Object.entries(distFiles(dist) as Record<string, string>)) {
      if (GENERATED.has(rel)) continue;
      const f = join(root, rel);
      if (!existsSync(f) || sha(readFileSync(f)) !== sha(readFileSync(src))) stale.push(relative(EXAMPLES, f));
    }
    expect(stale, 'run `npm run fixtures:install` and commit the result').toEqual([]);
  });
});
