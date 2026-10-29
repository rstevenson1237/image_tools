#!/usr/bin/env node
// Prepare an artgen release (PLAN P7): bump the version, write the changelog section, and say what to tag.
//
//   node scripts/artgen-release.mjs <x.y.z | patch | minor | major> [--mapgen x.y.z|patch|minor|major|keep] [--dry-run]
//
// Bumps the version in lockstep in packages/artgen-dist/package.json (+ package-lock.json, via npm), the Python
// client (python/artgen/pyproject.toml and its __version__), and prepends a section to packages/artgen-dist/CHANGELOG.md
// from the commit subjects since the previous `artgen-v*` tag (commits touching packages/, python/ or the dist
// content). The map engines have a version line of their own (packages/artgen-mapgen/package.json: the `maps` module,
// `artgen-maps.js` and the artgen-mapgen package file carry it): `--mapgen` bumps it, and by default it moves one patch
// when a commit since the last tag touched the map engines (or what they are built from) and stays where it is when none
// did. The section names it and lists those commits again under `### mapgen`.
// Then: commit, merge to main, and push the tag `artgen-v<version>` — the artgen-release workflow verifies,
// publishes the artgen-dist branch, tags it `artgen-dist-v<version>`, builds the library package files and creates the
// GitHub release with them attached.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const DIST_PKG = join(root, 'packages/artgen-dist/package.json'), CHANGELOG = join(root, 'packages/artgen-dist/CHANGELOG.md');
const MAPGEN_PKG = join(root, 'packages/artgen-mapgen/package.json');
/** What the map engines are made of: a commit touching one of these is a mapgen change. */
export const MAPGEN_PATHS = [
  'packages/artgen-mapgen', 'packages/artgen-primitives', 'packages/artgen-core/src/maps.ts',
  'packages/artgen-cli/src/map.ts', 'packages/artgen-cli/src/dungeon.ts', 'packages/artgen-cli/src/settlement.ts',
  'packages/artgen-cli/src/maps-cli.ts', 'packages/artgen-cli/src/maps-bin.ts', 'packages/artgen-cli/src/ops/maps*.ts',
];
const PYPROJECT = join(root, 'python/artgen/pyproject.toml'), PYINIT = join(root, 'python/artgen/src/artgen/__init__.py');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();

export function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [ma, mi, pa] = current.split('.').map(Number);
  if (bump === 'major') return `${ma + 1}.0.0`;
  if (bump === 'minor') return `${ma}.${mi + 1}.0`;
  if (bump === 'patch') return `${ma}.${mi}.${pa + 1}`;
  throw new Error(`version: x.y.z, patch, minor or major (got ${bump})`);
}

/** Commit subjects since the last release tag that touch the shipped packages (or just `paths`). */
export function changes(since, paths = ['packages', 'python', 'scripts/artgen-*', '.github/workflows/artgen-*']) {
  const range = since ? [`${since}..HEAD`] : ['HEAD'];
  const out = git('log', '--no-merges', '--format=%s', ...range, '--', ...paths);
  return out ? out.split('\n') : [];
}

/** The mapgen version after this release: `--mapgen`'s bump, else a patch when the map engines changed and no move when they did not. */
export function nextMapgen(current, bump, mapgenChanges) {
  if (bump === 'keep') return current;
  if (bump) return nextVersion(current, bump);
  return mapgenChanges.length ? nextVersion(current, 'patch') : current;
}

/** A release's section of the changelog; `mapgen` = { from, to, subjects } for the map engines' version line. */
export function changelogSection(version, date, subjects, mapgen) {
  const list = xs => xs.map(s => `- ${s}`).join('\n');
  let out = `## ${version} — ${date}\n\n`;
  if (mapgen) out += mapgen.from === mapgen.to ? `mapgen ${mapgen.to} (unchanged)\n\n` : `mapgen ${mapgen.from} → ${mapgen.to}\n\n`;
  out += `${subjects.length ? list(subjects) : '- no changes to the shipped packages'}\n`;
  if (mapgen && mapgen.from !== mapgen.to) out += `\n### mapgen ${mapgen.to}\n\n${mapgen.subjects.length ? list(mapgen.subjects) : '- version bumped by hand'}\n`;
  return out;
}

function main(argv) {
  const mi = argv.indexOf('--mapgen'), mapgenBump = mi >= 0 ? argv[mi + 1] : undefined;
  const bump = argv.find((a, i) => !a.startsWith('--') && (mi < 0 || i !== mi + 1)), dry = argv.includes('--dry-run');
  if (!bump || (mi >= 0 && (!mapgenBump || mapgenBump.startsWith('--')))) { console.log('usage: node scripts/artgen-release.mjs <x.y.z | patch | minor | major> [--mapgen x.y.z|patch|minor|major|keep] [--dry-run]'); return 1; }
  const current = JSON.parse(readFileSync(DIST_PKG, 'utf8')).version, version = nextVersion(current, bump);
  if (version === current) throw new Error(`already at ${version}`);
  const tags = git('tag', '--list', 'artgen-v*', '--sort=-v:refname').split('\n').filter(Boolean);
  if (tags.includes(`artgen-v${version}`)) throw new Error(`artgen-v${version} is already tagged`);
  const since = tags[0], mapgenFrom = JSON.parse(readFileSync(MAPGEN_PKG, 'utf8')).version, mapgenChanges = changes(since, MAPGEN_PATHS);
  const mapgenTo = nextMapgen(mapgenFrom, mapgenBump, mapgenChanges);
  const section = changelogSection(version, new Date().toISOString().slice(0, 10), changes(since), { from: mapgenFrom, to: mapgenTo, subjects: mapgenChanges });
  console.log(`artgen ${current} → ${version} (changes since ${since ?? 'the start'}), mapgen ${mapgenFrom} → ${mapgenTo}\n\n${section}`);
  if (dry) return 0;
  execFileSync('npm', ['version', version, '-w', 'artgen-dist', '--no-git-tag-version', '--allow-same-version'], { cwd: root, stdio: 'ignore' });
  if (mapgenTo !== mapgenFrom) execFileSync('npm', ['version', mapgenTo, '-w', 'artgen-mapgen', '--no-git-tag-version', '--allow-same-version'], { cwd: root, stdio: 'ignore' });
  writeFileSync(PYPROJECT, readFileSync(PYPROJECT, 'utf8').replace(/^version = "[^"]+"/m, `version = "${version}"`));
  writeFileSync(PYINIT, readFileSync(PYINIT, 'utf8').replace(/^__version__ = "[^"]+"/m, `__version__ = "${version}"`));
  let log = '';
  try { log = readFileSync(CHANGELOG, 'utf8'); } catch { /* first release */ }
  const head = '# artgen changelog\n\nReleases of the committed install (`artgen-dist`) and its modules, the MCP server, the runtime it vendors, the library package files and the Python client. The map engines (`mapgen`, the `maps` module) have a version line of their own, named in each section.\n\n';
  const earlier = log.indexOf('\n## ') >= 0 ? log.slice(log.indexOf('\n## ') + 1) : '';
  writeFileSync(CHANGELOG, head + section + (earlier ? '\n' + earlier : ''));
  console.log(`updated packages/artgen-dist/package.json${mapgenTo !== mapgenFrom ? ', packages/artgen-mapgen/package.json' : ''}, package-lock.json, python/artgen, CHANGELOG.md
next: commit ("artgen ${version}"), merge to main, then
  git tag -a artgen-v${version} -m "artgen ${version}" && git push origin artgen-v${version}`);
  return 0;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
