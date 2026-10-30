#!/usr/bin/env node
/**
 * The library package files of a release (docs/TOOLING-PLAN.md §4, R3): `artgen-runtime`, `artgen-primitives`, `artgen-scene`,
 * `artgen-workflow`, `artgen-imagekit` and `artgen-mapgen` built to JavaScript with type declarations and packed with `npm pack`, so code can install them from the
 * GitHub release without an npm account or registry:
 *
 *   npm install https://github.com/rstevenson1237/image_tools/releases/download/artgen-v0.12.0/artgen-mapgen-0.11.0.tgz
 *
 * The workspace packages export TypeScript source (`"." → ./src/index.ts`). Here the TypeScript compiler emits their `.js` and
 * `.d.ts` (relative `.ts` imports rewritten to `.js`), each package gets a `package.json` that points at the build, and the
 * packages that need another one (`scene`, `imagekit` and `mapgen` need `primitives`) name its file on the same release.
 * Deep imports into another package (`artgen-primitives/lib/color.ts`, as the packages write them to each other) become
 * `…/lib/color.js` in the build, and `"./*.js"` maps them to it.
 *
 * Usage: node pack-libs.mjs <out dir> [--release x.y.z]   (default release: the artgen-dist version)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libPackages, packFile, releaseUrl, REPO } from './lib-packages.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), PKGS = join(HERE, '..'), require = createRequire(import.meta.url);

/** Public `exports` of a package: its entry points, and `./*.ts` for the deep imports packages make into each other. */
const EXPORTS = {
  'artgen-runtime': {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './canvas2d': { types: './dist/adapters/canvas2d.d.ts', default: './dist/adapters/canvas2d.js' },
    './pixi': { types: './dist/adapters/pixi.d.ts', default: './dist/adapters/pixi.js' },
    './three': { types: './dist/adapters/three.d.ts', default: './dist/adapters/three.js' },
  },
  default: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './*.js': { types: './dist/*.d.ts', default: './dist/*.js' },
  },
};

const walk = dir => readdirSync(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

/** Emit `.js` and `.d.ts` for the four packages' sources (tests left out) into `out`, laid out as `<dir>/src/…`. */
function compile(out) {
  const tsc = require.resolve('typescript/bin/tsc'), cfg = join(out, 'tsconfig.json');
  writeFileSync(cfg, JSON.stringify({
    extends: join(PKGS, 'tsconfig.base.json'),
    compilerOptions: {
      noEmit: false, declaration: true, outDir: join(out, 'js'), rootDir: PKGS, rewriteRelativeImportExtensions: true, allowImportingTsExtensions: false,
      sourceMap: false, types: ['node'], typeRoots: [join(PKGS, '..', 'node_modules', '@types')], noUnusedLocals: false, noUnusedParameters: false,
    },
    include: Object.values(libPackages('0.0.0')).map(p => join(PKGS, p.dir, 'src', '**', '*.ts')),
    exclude: ['*.test.ts', 'testkit.ts', 'contract.ts'].map(g => join(PKGS, '*', 'src', '**', g)),
  }, null, 2));
  // TS2877 is the compiler noting that `artgen-primitives/lib/color.ts` isn't rewritten: `rewrite` below does it, in the .js and the .d.ts
  const r = spawnSync(process.execPath, [tsc, '-p', cfg], { encoding: 'utf8' });
  const other = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l) && !/error TS2877/.test(l));
  if (r.status !== 0 && other.length) throw new Error(`tsc failed:\n${other.join('\n')}`);
}

/** A deep import into another artgen package (`artgen-primitives/lib/color.ts`) names the built file. */
const rewrite = text => text.replace(/(['"])(artgen-[a-z]+\/[^'"]+)\.ts\1/g, '$1$2.js$1');

/**
 * Build and pack the library packages into `outDir` (created). Returns [{ name, version, file }].
 * `release`: the release the files are attached to (their dependencies on each other point there).
 */
export function packLibs(outDir, release = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).version) {
  outDir = resolve(outDir);
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'artgen-libs-')), pkgs = libPackages(release), made = [];
  try {
    compile(work);
    for (const [name, { dir, version }] of Object.entries(pkgs)) {
      const src = JSON.parse(readFileSync(join(PKGS, dir, 'package.json'), 'utf8')), root = join(work, 'pack', name);
      cpSync(join(work, 'js', dir, 'src'), join(root, 'dist'), { recursive: true });
      if (!existsSync(join(root, 'dist', 'index.js')) || !existsSync(join(root, 'dist', 'index.d.ts'))) throw new Error(`${name}: the build has no index.js and index.d.ts`);
      // a type that crosses packages must be written as an import of the package, never as a path into the other one's source
      for (const f of walk(join(root, 'dist'))) {
        const text = rewrite(readFileSync(f, 'utf8'));
        writeFileSync(f, text);
        if (/["']\.\.\/(?:\.\.\/)*artgen-[a-z]+\//.test(text) || text.includes(PKGS)) throw new Error(`${name}: ${f.slice(root.length + 1)} reaches into another package's folder`);
      }
      const dependencies = Object.fromEntries(Object.entries(src.dependencies ?? {}).map(([d, spec]) => [d, pkgs[d] ? releaseUrl(release, packFile(d, pkgs[d].version)) : spec]));
      const pkg = {
        name, version, description: src.description, type: 'module', license: 'MIT', sideEffects: false,
        repository: { type: 'git', url: `git+https://github.com/${REPO}.git`, directory: `packages/${dir}` },
        exports: EXPORTS[name] ?? EXPORTS.default, types: './dist/index.d.ts',
        ...(Object.keys(dependencies).length && { dependencies }),
        ...(src.peerDependencies && { peerDependencies: src.peerDependencies, peerDependenciesMeta: src.peerDependenciesMeta }),
        files: ['dist'],
      };
      writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
      const url = releaseUrl(release, packFile(name, version));
      const readme = existsSync(join(PKGS, dir, 'README.md')) ? readFileSync(join(PKGS, dir, 'README.md'), 'utf8') : `# ${name}\n\n${src.description}\n`;
      writeFileSync(join(root, 'README.md'), `${readme.replace(/\s+$/, '')}\n\n## Install\n\nFrom the artgen release (no npm account or registry needed):\n\n    npm install ${url}\n\nThis is the ${name} ${version} file of artgen release ${release}; the source is in \`packages/${dir}\` of https://github.com/${REPO}.\n`);
      execFileSync('npm', ['pack', '--pack-destination', outDir, '--silent', '--ignore-scripts'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
      const file = packFile(name, version);
      if (!existsSync(join(outDir, file))) throw new Error(`npm pack did not make ${file}`);
      made.push({ name, version, file });
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
  return made;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2], i = process.argv.indexOf('--release');
  if (!out || out.startsWith('--')) { console.error('usage: node pack-libs.mjs <out dir> [--release x.y.z]'); process.exit(1); }
  for (const m of packLibs(out, i > 0 ? process.argv[i + 1] : undefined)) console.log(`${m.file}`);
}
