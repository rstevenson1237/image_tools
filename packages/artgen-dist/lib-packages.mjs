/**
 * The library packages a release attaches to its GitHub release (docs/TOOLING-PLAN.md §4, R3): the ones code can import.
 * `primitives`, `scene`, `workflow` and `imagekit` follow the release version; `mapgen` and `runtime` carry their own version lines (the
 * package.json of each). `packages.json` in the distribution tells the installer which file each package is, so
 * `update` can move a consumer's release URLs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKGS = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = 'rstevenson1237/image_tools';
const own = dir => JSON.parse(readFileSync(join(PKGS, dir, 'package.json'), 'utf8')).version;

/** name → { dir, version }, for a release `release` (x.y.z). */
export const libPackages = release => ({
  'artgen-runtime': { dir: 'artgen-runtime', version: own('artgen-runtime') },
  'artgen-primitives': { dir: 'artgen-primitives', version: release },
  'artgen-scene': { dir: 'artgen-scene', version: release },
  'artgen-workflow': { dir: 'artgen-workflow', version: release },
  'artgen-imagekit': { dir: 'artgen-imagekit', version: release },
  'artgen-mapgen': { dir: 'artgen-mapgen', version: own('artgen-mapgen') },
});

/** The file `npm pack` makes for a package. */
export const packFile = (name, version) => `${name}-${version}.tgz`;

/** Where a release's package files are: `https://github.com/<repo>/releases/download/artgen-v<release>/<file>`. */
export const releaseUrl = (release, file, repo = REPO) => `https://github.com/${repo}/releases/download/artgen-v${release}/${file}`;

/** `packages.json` of the distribution. */
export function packagesIndex(release) {
  return {
    release, repo: REPO,
    packages: Object.fromEntries(Object.entries(libPackages(release)).map(([name, p]) => [name, { version: p.version, file: packFile(name, p.version) }])),
  };
}
