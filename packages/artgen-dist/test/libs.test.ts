// The library package files a release attaches (pack-libs.mjs): pack them, unpack them into a scratch project's node_modules
// the way `npm install <url>` would, and use them: import them in Node, and type-check a consumer against their declarations.
// (The third-party dependencies, @resvg/resvg-wasm and fflate, are linked from this repo's node_modules, so no network is needed.)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { MAPGEN_VERSION, VERSION } from '../build.mjs';
import { libPackages, packagesIndex, releaseUrl } from '../lib-packages.mjs';
import { packLibs } from '../pack-libs.mjs';

const require = createRequire(import.meta.url);
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'artgen-libs-')), packs = join(tmp, 'packs'), consumer = join(tmp, 'consumer');
const NAMES = ['artgen-runtime', 'artgen-primitives', 'artgen-scene', 'artgen-mapgen'];
const manifest = (name: string) => JSON.parse(readFileSync(join(consumer, 'node_modules', name, 'package.json'), 'utf8'));
const node = (args: string[]) => spawnSync(process.execPath, args, { cwd: consumer, encoding: 'utf8' });

beforeAll(() => {
  packLibs(packs);
  for (const name of NAMES) {
    const dir = join(consumer, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    const file = join(packs, `${name}-${(libPackages(VERSION) as Record<string, { version: string }>)[name].version}.tgz`);
    execFileSync('tar', ['-xzf', file, '-C', dir, '--strip-components=1']);
  }
  // what npm would fetch from the registry for the packages' own dependencies
  mkdirSync(join(consumer, 'node_modules', '@resvg'), { recursive: true });
  symlinkSync(join(REPO, 'node_modules', '@resvg', 'resvg-wasm'), join(consumer, 'node_modules', '@resvg', 'resvg-wasm'));
  symlinkSync(join(REPO, 'node_modules', 'fflate'), join(consumer, 'node_modules', 'fflate'));
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', private: true }));
}, 120_000);
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

describe('library packages', () => {
  test('four files, each named for its own version line; the release lists them in packages.json', () => {
    const idx = packagesIndex(VERSION);
    expect(Object.keys(idx.packages)).toEqual(NAMES);
    expect(idx.packages['artgen-mapgen']).toEqual({ version: MAPGEN_VERSION, file: `artgen-mapgen-${MAPGEN_VERSION}.tgz` });
    expect(idx.packages['artgen-runtime'].version).toBe(RUNTIME_VERSION);
    expect(idx.packages['artgen-scene'].version).toBe(VERSION);
    for (const p of Object.values(idx.packages)) expect(existsSync(join(packs, p.file)), p.file).toBe(true);
  });

  test('a package that needs another points at its file on the same release; the rest of its dependencies are the registry\'s', () => {
    expect(manifest('artgen-mapgen').dependencies).toEqual({ 'artgen-primitives': releaseUrl(VERSION, `artgen-primitives-${VERSION}.tgz`) });
    expect(manifest('artgen-scene').dependencies).toEqual({ 'artgen-primitives': releaseUrl(VERSION, `artgen-primitives-${VERSION}.tgz`) });
    expect(Object.keys(manifest('artgen-primitives').dependencies).sort()).toEqual(['@resvg/resvg-wasm', 'fflate']);
    expect(manifest('artgen-runtime').dependencies).toBeUndefined();
    expect(manifest('artgen-runtime').peerDependenciesMeta).toBeDefined();
    for (const n of NAMES) { expect(manifest(n).private).toBeUndefined(); expect(manifest(n).files).toEqual(['dist']); }
  });

  test('the files hold the build and its declarations, and no tests, sources or paths into another package', () => {
    const listing = execFileSync('tar', ['-tzf', join(packs, `artgen-mapgen-${MAPGEN_VERSION}.tgz`)], { encoding: 'utf8' }).split('\n');
    expect(listing).toEqual(expect.arrayContaining(['package/dist/index.js', 'package/dist/index.d.ts', 'package/dist/dungeon/index.js', 'package/package.json', 'package/README.md']));
    expect(listing.filter(f => /\.test\.|\.ts$/.test(f) && !f.endsWith('.d.ts'))).toEqual([]);
    const rt = execFileSync('tar', ['-tzf', join(packs, `artgen-runtime-${RUNTIME_VERSION}.tgz`)], { encoding: 'utf8' });
    expect(rt).toContain('package/dist/adapters/pixi.js');
    expect(rt).not.toMatch(/testkit|contract|\.test\./);
  });

  test('they import in Node: mapgen checks and renders a dungeon, scene and primitives load, the runtime reports its version', () => {
    const fixture = join(REPO, 'packages/artgen-cli/fixtures/setting-builder/warren/dungeon.json');
    writeFileSync(join(consumer, 'use.mjs'), `
      import { readFileSync } from 'node:fs';
      import { dungeon, map, settlement } from 'artgen-mapgen';
      import * as scene from 'artgen-scene';
      import * as primitives from 'artgen-primitives';
      import { rng } from 'artgen-primitives/lib/rng.js';
      import * as runtime from 'artgen-runtime';
      import { canvas2dAdapter } from 'artgen-runtime/canvas2d';
      const raw = JSON.parse(readFileSync(${JSON.stringify(fixture)}, 'utf8'));
      const checked = dungeon.checkDungeon(raw);
      const svg = dungeon.renderDungeonSvg(dungeon.parseDungeon(raw));
      console.log(JSON.stringify({
        errors: checked.errors.length, svg: svg.startsWith('<svg') || svg.includes('<svg'), maps: typeof map.generateMap, settlements: typeof settlement.generateSettlement,
        scene: Object.keys(scene).length > 10, primitives: typeof primitives.Grid, rng: rng(3)() < 1, runtime: runtime.RUNTIME_VERSION, adapter: typeof canvas2dAdapter,
      }));
    `);
    const r = node(['use.mjs']);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ errors: 0, svg: true, maps: 'function', settlements: 'function', scene: true, primitives: 'function', rng: true, runtime: RUNTIME_VERSION, adapter: 'function' });
  });

  test('a TypeScript consumer type-checks against the declarations, with the library check on', () => {
    writeFileSync(join(consumer, 'check.ts'), `
      import { dungeon, type map } from 'artgen-mapgen';
      import { loadPack, RUNTIME_VERSION, type PackManifest } from 'artgen-runtime';
      import { Scene2D } from 'artgen-scene';
      import { Grid } from 'artgen-primitives';
      const spec: dungeon.DungeonSpec = dungeon.parseDungeon({});
      const svg: string = dungeon.renderDungeonSvg(spec);
      const v: string = RUNTIME_VERSION;
      declare const m: map.MapSpec;
      declare const manifest: PackManifest;
      export { svg, v, m, manifest, loadPack, Scene2D, Grid };
    `);
    const tsc = require.resolve('typescript/bin/tsc');
    const r = node([tsc, '--noEmit', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--types', 'node', '--typeRoots', join(REPO, 'node_modules', '@types'), 'check.ts']);
    expect(r.stdout + r.stderr, 'tsc').toBe('');
    expect(r.status).toBe(0);
    // and the declarations say what they should: a wrong use is an error
    writeFileSync(join(consumer, 'wrong.ts'), `import { dungeon } from 'artgen-mapgen';\nconst n: number = dungeon.renderDungeonSvg(dungeon.parseDungeon({}));\nexport { n };\n`);
    const w = node([tsc, '--noEmit', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--types', 'node', '--typeRoots', join(REPO, 'node_modules', '@types'), 'wrong.ts']);
    expect(w.status).toBe(2);
    expect(w.stdout).toMatch(/Type 'string' is not assignable to type 'number'/);
  });
});
