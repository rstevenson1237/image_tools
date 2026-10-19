// The maps-only entry (`artgen-core/maps`, `artgen-cli/src/maps-bin.ts`) may import only the shared primitives in
// `lib/`, the `map` and `dungeon` engines and the format reader: never the pixel-art pipeline. The bundle's import graph
// is checked file by file, so a stray import fails here, whatever it does to the bundle's size.
import { build } from 'esbuild';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const PKGS = fileURLToPath(new URL('../../', import.meta.url));
const CORE = ['artgen-core', 'src'].join(sep) + sep, CLI = ['artgen-cli', 'src'].join(sep) + sep;
const ALLOWED_CORE = [/^lib[\\/]/, /^map[\\/]/, /^dungeon[\\/]/, /^format\.ts$/, /^maps\.ts$/];
const ALLOWED_CLI = new Set(['maps-bin.ts', 'maps-cli.ts', 'map.ts', 'dungeon.ts', 'node-svg.ts', 'projectfs.ts']);
const ALLOWED_MODULES = [/^node_modules[\\/]@resvg[\\/]resvg-wasm[\\/]/, /^node_modules[\\/]fflate[\\/]/];

test('the maps bundle imports only lib/, map/, dungeon/ and format.ts of the core, and a short list of CLI files', async () => {
  const r = await build({
    entryPoints: [PKGS + 'artgen-cli/src/maps-bin.ts'], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', logLevel: 'error',
    define: { __ARTGEN_VERSION__: '"0"', __ARTGEN_SHA__: '"0"' },
  });
  const ROOT = resolve(PKGS, '..'), files = Object.keys(r.metafile.inputs).map(f => relative(PKGS, resolve(f)));
  const bad: string[] = [];
  for (const f of files) {
    if (f.startsWith(CORE)) { if (!ALLOWED_CORE.some(re => re.test(f.slice(CORE.length)))) bad.push(f); }
    else if (f.startsWith(CLI)) { if (!ALLOWED_CLI.has(f.slice(CLI.length))) bad.push(f); }
    else if (f.startsWith('..')) { if (!ALLOWED_MODULES.some(re => re.test(relative(ROOT, resolve(PKGS, f))))) bad.push(f); }
    else bad.push(f);
  }
  expect(bad, 'the maps entry must not import the pixel-art pipeline').toEqual([]);
  expect(files.some(f => f.startsWith(CORE + 'map'))).toBe(true);
  expect(files.some(f => f.startsWith(CORE + 'dungeon'))).toBe(true);
});
