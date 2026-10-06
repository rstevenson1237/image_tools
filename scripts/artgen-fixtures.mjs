// Restore / update the committed install in every fixture game repo under examples/ from the local build
// (packages/artgen-dist/out). The bundles and wasm are gitignored there, so run this after a fresh clone:
//   npm run fixtures:install
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..'), installer = join(root, 'packages/artgen-dist/out/install.mjs');
if (!existsSync(installer)) throw new Error('build the distribution first: npm run build -w artgen-dist');
for (const name of readdirSync(join(root, 'examples'))) {
  const target = join(root, 'examples', name);
  if (!existsSync(join(target, 'tools/artgen/MANIFEST.json'))) continue;
  const r = spawnSync(process.execPath, [installer, 'update', '--target', target], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
