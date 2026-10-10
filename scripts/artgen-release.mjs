#!/usr/bin/env node
// Prepare an artgen release (PLAN P7): bump the version, write the changelog section, and say what to tag.
//
//   node scripts/artgen-release.mjs <x.y.z | patch | minor | major> [--dry-run]
//
// Bumps the version in lockstep in packages/artgen-dist/package.json (+ package-lock.json, via npm), the Python
// client (python/artgen/pyproject.toml and its __version__), and prepends a section to packages/artgen-dist/CHANGELOG.md
// from the commit subjects since the previous `artgen-v*` tag (commits touching packages/, python/ or the dist
// content). Then: commit, merge to main, and push the tag `artgen-v<version>` — the artgen-release workflow verifies,
// publishes the artgen-dist branch, tags it `artgen-dist-v<version>` and creates the GitHub release.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const DIST_PKG = join(root, 'packages/artgen-dist/package.json'), CHANGELOG = join(root, 'packages/artgen-dist/CHANGELOG.md');
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

/** Commit subjects since the last release tag that touch the shipped packages. */
export function changes(since) {
  const range = since ? [`${since}..HEAD`] : ['HEAD'];
  const out = git('log', '--no-merges', '--format=%s', ...range, '--', 'packages', 'python', 'scripts/artgen-*', '.github/workflows/artgen-*');
  return out ? out.split('\n') : [];
}

export function changelogSection(version, date, subjects) {
  return `## ${version} — ${date}\n\n${subjects.length ? subjects.map(s => `- ${s}`).join('\n') : '- no changes to the shipped packages'}\n`;
}

function main(argv) {
  const bump = argv.find(a => !a.startsWith('--')), dry = argv.includes('--dry-run');
  if (!bump) { console.log('usage: node scripts/artgen-release.mjs <x.y.z | patch | minor | major> [--dry-run]'); return 1; }
  const current = JSON.parse(readFileSync(DIST_PKG, 'utf8')).version, version = nextVersion(current, bump);
  if (version === current) throw new Error(`already at ${version}`);
  const tags = git('tag', '--list', 'artgen-v*', '--sort=-v:refname').split('\n').filter(Boolean);
  if (tags.includes(`artgen-v${version}`)) throw new Error(`artgen-v${version} is already tagged`);
  const since = tags[0], section = changelogSection(version, new Date().toISOString().slice(0, 10), changes(since));
  console.log(`artgen ${current} → ${version} (changes since ${since ?? 'the start'})\n\n${section}`);
  if (dry) return 0;
  execFileSync('npm', ['version', version, '-w', 'artgen-dist', '--no-git-tag-version', '--allow-same-version'], { cwd: root, stdio: 'ignore' });
  writeFileSync(PYPROJECT, readFileSync(PYPROJECT, 'utf8').replace(/^version = "[^"]+"/m, `version = "${version}"`));
  writeFileSync(PYINIT, readFileSync(PYINIT, 'utf8').replace(/^__version__ = "[^"]+"/m, `__version__ = "${version}"`));
  let log = '';
  try { log = readFileSync(CHANGELOG, 'utf8'); } catch { /* first release */ }
  const head = '# artgen changelog\n\nReleases of the committed install (`artgen-dist`), the MCP server, the runtime it vendors and the Python client.\n\n';
  const earlier = log.indexOf('\n## ') >= 0 ? log.slice(log.indexOf('\n## ') + 1) : '';
  writeFileSync(CHANGELOG, head + section + (earlier ? '\n' + earlier : ''));
  console.log(`updated packages/artgen-dist/package.json, package-lock.json, python/artgen, CHANGELOG.md
next: commit ("artgen ${version}"), merge to main, then
  git tag -a artgen-v${version} -m "artgen ${version}" && git push origin artgen-v${version}`);
  return 0;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
