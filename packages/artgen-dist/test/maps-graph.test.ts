// The maps-only entry (`artgen-core/maps`, `artgen-cli/src/maps-bin.ts`) may import only the `artgen-primitives`,
// `artgen-imagekit`, `artgen-workflow` and `artgen-mapgen` packages (plus the one-line facade `artgen-core/src/maps.ts`): never the scene layer or the pixel-art
// pipeline. The bundle's import graph is checked file by file, so a stray import fails here, whatever it does to the
// bundle's size.
import { build } from 'esbuild';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const PKGS = fileURLToPath(new URL('../../', import.meta.url));
const CORE = ['artgen-core', 'src'].join(sep) + sep, CLI = ['artgen-cli', 'src'].join(sep) + sep;
const IMAGEKIT = ['artgen-imagekit', 'src'].join(sep) + sep, PRIM = ['artgen-primitives', 'src'].join(sep) + sep, MAPGEN = ['artgen-mapgen', 'src'].join(sep) + sep, WORKFLOW = ['artgen-workflow', 'src'].join(sep) + sep;
const OPS = ['registry', 'cli', 'core', 'image', 'maps', 'maps-shared', 'maps-map', 'maps-trace', 'maps-dungeon', 'maps-settlement', 'maps-workflow'].map(f => ['ops', `${f}.ts`].join(sep));   // the operation registry, its parser and the map module's operations (never the art ones)
const LOOP = ['feedback-bundle', 'diff', 'upstream', 'metrics'].map(f => ['loop', `${f}.ts`].join(sep));   // the feedback loop's report, upstream and metrics: Node and the map files only
const ALLOWED_CLI = new Set(['maps-bin.ts', 'maps-cli.ts', 'map.ts', 'dungeon.ts', 'settlement.ts', 'node-svg.ts', 'projectfs.ts', 'ui-server.ts', 'version.ts', 'workflow.ts', ...OPS, ...LOOP]);
const ALLOWED_MODULES = [/^node_modules[\\/]@resvg[\\/]resvg-wasm[\\/]/, /^node_modules[\\/]fflate[\\/]/];

test('the maps bundle imports only artgen-primitives, artgen-imagekit, artgen-workflow, artgen-mapgen and a short list of CLI files', async () => {
  const r = await build({
    entryPoints: [PKGS + 'artgen-cli/src/maps-bin.ts'], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', logLevel: 'error',
    define: { __ARTGEN_VERSION__: '"0"', __ARTGEN_SHA__: '"0"' },
  });
  const ROOT = resolve(PKGS, '..'), files = Object.keys(r.metafile.inputs).map(f => relative(PKGS, resolve(f)));
  const bad: string[] = [];
  for (const f of files) {
    if (f.startsWith(CORE)) { if (f.slice(CORE.length) !== 'maps.ts') bad.push(f); }
    else if (f.startsWith(PRIM) || f.startsWith(IMAGEKIT) || f.startsWith(MAPGEN) || f.startsWith(WORKFLOW)) continue;
    else if (f.startsWith(CLI)) { if (!ALLOWED_CLI.has(f.slice(CLI.length))) bad.push(f); }
    else if (f.startsWith('..')) { if (!ALLOWED_MODULES.some(re => re.test(relative(ROOT, resolve(PKGS, f))))) bad.push(f); }
    else bad.push(f);
  }
  expect(bad, 'the maps entry must not import the pixel-art pipeline').toEqual([]);
  expect(files.some(f => f.startsWith(MAPGEN + 'map'))).toBe(true);
  expect(files.some(f => f.startsWith(MAPGEN + 'dungeon'))).toBe(true);
  expect(files.some(f => f.startsWith(MAPGEN + 'settlement'))).toBe(true);
});
