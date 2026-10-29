#!/usr/bin/env node
/**
 * artgen committed install (SPEC §3.1, D1; modules: docs/TOOLING-PLAN.md R3). Run from the game repo root, then commit the result:
 *
 *   npx -y github:rstevenson1237/image_tools#artgen-dist init [--with art,maps,ui]   first install: files + art/ scaffold
 *   npx -y github:rstevenson1237/image_tools#artgen-dist add ui                      add modules later
 *   npx -y github:rstevenson1237/image_tools#artgen-dist remove maps                 take a module out again
 *   npx -y github:rstevenson1237/image_tools#artgen-dist update                      later: shows the version change, protects local edits
 *   npx -y github:rstevenson1237/image_tools#artgen-dist status                      installed vs available, locally edited files
 *   npx -y github:rstevenson1237/image_tools#artgen-dist modules                     what each module holds
 *
 * Options: --target <dir> (default: cwd), --force (overwrite locally edited files), --dry-run, --no-scaffold,
 * --with <a,b> (init: the modules to install instead of the default core,art,maps), --notes <file> (update: write the
 * changelog and the list of kept files there, for a pull request description), --skip-workflows (update: leave changed
 * files under .github/workflows/ alone; the update workflow passes it when its token may not push them).
 *
 * Modules: `core` (always), `art`, `maps`, `ui` and `update-pr`; build.mjs writes what each holds to modules.json. The files
 * of the chosen modules are copied into `.claude/`, `tools/artgen/` and `.github/workflows/`, an `artgen` server is merged
 * into .mcp.json when `art` is installed, and a managed section (one fragment per module) goes into CLAUDE.md.
 * tools/artgen/MANIFEST.json records the modules and the hash of every file as installed, so `update` can tell an untouched
 * file (replace it) from a locally edited one (keep it unless --force). An install from before modules (no `modules` in
 * its manifest) counts as core, art and maps.
 * Plain Node (>= 20), no dependencies: it runs straight from the artgen-dist branch.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const MANIFEST = 'tools/artgen/MANIFEST.json';
const BEGIN = '<!-- artgen:begin — managed by the artgen installer; `update` rewrites this section -->';
const END = '<!-- artgen:end -->';
const MCP_ENTRY = { command: 'node', args: ['tools/artgen/artgen-mcp.js'] };
/** Where a path under `dist/` goes in the game repo. */
const TARGETS = [['claude/', '.claude/'], ['tools/artgen/', 'tools/artgen/'], ['github/', '.github/']];
/** What an install from before modules held. */
const LEGACY_MODULES = ['core', 'art', 'maps'];

const sha = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const posix = p => p.split(sep).join('/');

/** `modules.json` of a distribution: `{ release, modules: { name: { version, summary, default?, requiresAny?, files } } }`. */
export function moduleIndex(dist = DIST) {
  const f = join(dist, 'modules.json');
  if (!existsSync(f)) throw new Error(`${f} is missing — this is not an artgen distribution`);
  return JSON.parse(readFileSync(f, 'utf8'));
}

/** The repo path a `dist/` path installs to. */
export function targetOf(rel) {
  const t = TARGETS.find(([from]) => rel.startsWith(from));
  if (!t) throw new Error(`${rel}: not under a folder the installer knows`);
  return t[1] + rel.slice(t[0].length);
}

/** Files of the given modules: { target path (posix, repo-relative): source path }. */
export function distFiles(dist = DIST, names = Object.keys(moduleIndex(dist).modules)) {
  const index = moduleIndex(dist), files = {};
  for (const n of names) {
    const m = index.modules[n];
    if (!m) throw new Error(`no module ${n} in this distribution`);
    for (const rel of m.files) files[targetOf(rel)] = join(dist, ...rel.split('/'));
  }
  return files;
}

export const distVersion = (dist = DIST) => readFileSync(join(dist, 'tools', 'artgen', 'VERSION'), 'utf8').trim();

/** Check a module list against the distribution: known names, `core` first, `requiresAny` met. Returns the list in index order. */
export function resolveModules(index, names) {
  const want = new Set(['core', ...names]);
  for (const n of want) if (!index.modules[n]) throw new Error(`no module ${n} — the modules are ${Object.keys(index.modules).join(', ')}`);
  const out = Object.keys(index.modules).filter(n => want.has(n));
  for (const n of out) {
    const need = index.modules[n].requiresAny;
    if (need && !need.some(r => want.has(r))) throw new Error(`module ${n} needs ${need.join(' or ')}`);
  }
  return out;
}

/** The managed CLAUDE.md section text (between the markers) for these modules, or '' when none has a fragment. */
export function claudeSection(dist = DIST, names = Object.keys(moduleIndex(dist).modules)) {
  const parts = names.map(n => join(dist, 'claude-md', `${n}.md`)).filter(existsSync).map(f => readFileSync(f, 'utf8').trim());
  return parts.length ? `${BEGIN}\n${parts.join('\n\n')}\n${END}` : '';
}

function mergeMcp(target, want, dry) {
  const f = join(target, '.mcp.json');
  let cfg = { mcpServers: {} };
  const existed = existsSync(f);
  if (existed) {
    try { cfg = JSON.parse(readFileSync(f, 'utf8')); } catch { throw new Error('.mcp.json is not valid JSON — fix it, then re-run'); }
    cfg.mcpServers ??= {};
  }
  const same = JSON.stringify(cfg.mcpServers.artgen) === JSON.stringify(MCP_ENTRY);
  if (want) {
    if (same) return 'unchanged';
    cfg.mcpServers.artgen = MCP_ENTRY;
    if (!dry) writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
    return existed ? 'merged' : 'created';
  }
  // the art module is not installed: take our entry out, and only ours
  if (!existed || !same) return 'unchanged';
  delete cfg.mcpServers.artgen;
  if (!dry) writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
  return 'artgen server removed';
}

/** Insert or replace the managed section (or take it out when `section` is empty). Returns { action, hash }. */
function writeClaudeMd(target, section, oldHash, force, dry) {
  const f = join(target, 'CLAUDE.md');
  const text = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const i = text.indexOf(BEGIN), j = text.indexOf(END);
  if (i >= 0 && j > i) {
    const current = text.slice(i, j + END.length);
    if (current === section) return { action: 'unchanged', hash: sha(section) };
    if (oldHash && sha(current) !== oldHash && !force) return { action: 'kept (edited locally; --force to replace)', hash: oldHash };
    if (!section) {
      if (!dry) writeFileSync(f, (text.slice(0, i).replace(/\s*$/, '') + text.slice(j + END.length).replace(/^\s*/, '\n\n')).replace(/^\s+|\s+$/g, '') + '\n');
      return { action: 'section removed', hash: undefined };
    }
    if (!dry) writeFileSync(f, text.slice(0, i) + section + text.slice(j + END.length));
    return { action: 'updated', hash: sha(section) };
  }
  if (!section) return { action: 'unchanged', hash: undefined };
  if (!dry) writeFileSync(f, (text ? text.replace(/\s*$/, '\n\n') : '') + section + '\n');
  return { action: text ? 'appended' : 'created', hash: sha(section) };
}

function readManifest(target) {
  const f = join(target, MANIFEST);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** The modules an install holds, with the version of each (a manifest from before modules held core, art and maps). */
const installedModules = old => old?.modules ?? (old ? Object.fromEntries(LEGACY_MODULES.map(m => [m, `${old.version} (before modules)`])) : {});

const vkey = v => v.split('.').map(n => parseInt(n, 10) || 0);
/** semver-ish order of x.y.z strings: negative when a < b. */
export const compareVersions = (a, b) => { const x = vkey(a), y = vkey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };

/** The changelog sections newer than `from` (all of them when `from` is null), as markdown. '' when there is no changelog. */
export function changelogSince(dist, from) {
  const f = join(dist, '..', 'CHANGELOG.md');
  if (!existsSync(f)) return '';
  const sections = readFileSync(f, 'utf8').split(/^(?=## \d)/m).filter(s => /^## \d/.test(s));
  return sections.filter(s => !from || compareVersions(s.match(/^## (\d+\.\d+\.\d+)/)?.[1] ?? '0.0.0', from) > 0).map(s => s.trim()).join('\n\n');
}

/**
 * The library package URLs in the game's package.json (`…/releases/download/artgen-v0.11.0/artgen-mapgen-0.11.0.tgz`) follow the
 * release: each one this distribution knows (packages.json) is pointed at the new release's file. Returns the packages changed.
 */
export function bumpPackages(target, dist = DIST, dry = false) {
  const f = join(target, 'package.json'), idx = join(dist, 'packages.json');
  if (!existsSync(f) || !existsSync(idx)) return [];
  const { release, repo, packages } = JSON.parse(readFileSync(idx, 'utf8')), changed = [];
  const text = readFileSync(f, 'utf8');
  const re = new RegExp(`(https://github\\.com/${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/releases/download/)artgen-v[\\d.]+/(artgen-[a-z]+)-[\\d.]+\\.tgz`, 'g');
  const next = text.replace(re, (m, base, name) => {
    const p = packages[name];
    if (!p) return m;
    const url = `${base}artgen-v${release}/${p.file}`;
    if (url !== m) changed.push(name);
    return url;
  });
  if (changed.length && !dry) writeFileSync(f, next);
  return changed;
}

/** Delete empty folders from `dir` up to (not including) `stop`. */
function pruneEmpty(dir, stop) {
  for (let d = dir; d !== stop && d.startsWith(stop + sep); d = dirname(d)) {
    try { if (readdirSync(d).length) return; rmdirSync(d); } catch { return; }
  }
}

/** The `art/` folder a maps-only repo needs (maps are found by their project): an empty config, never overwriting one. */
const MAPS_ONLY_CONFIG = '{}\n';

function scaffoldProject(target, modules, report) {
  const config = join(target, 'art', 'artgen.config.json');
  if (modules.includes('art')) {
    // a config left by a maps-only install is the placeholder; `init` writes the real one
    if (existsSync(config) && readFileSync(config, 'utf8') === MAPS_ONLY_CONFIG) rmSync(config);
    const r = spawnSync(process.execPath, [join(target, 'tools', 'artgen', 'artgen.js'), 'init', '--root', target], { cwd: target, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`artgen init failed:\n${r.stderr || r.stdout}`);
    report.scaffold = r.stdout.trim();
  } else if (modules.includes('maps') && !existsSync(config)) {
    mkdirSync(dirname(config), { recursive: true });
    writeFileSync(config, MAPS_ONLY_CONFIG);
    report.scaffold = `artgen project in ${join(target, 'art')} (maps only)`;
  }
}

/** @typedef {{ mode?: string, modules?: string[], force?: boolean, dryRun?: boolean, scaffold?: boolean, skipWorkflows?: boolean, dist?: string, notes?: string, log?: ((s: string) => void) | null }} InstallOptions */

/**
 * Install, add modules to, or update an install. `mode`: `init` (the modules in `modules`, default core, art and maps),
 * `add` (the modules in `modules`, on top of those installed) or `update` (the modules installed). Returns a report:
 * { from, to, modules, written, unchanged, kept, removed, conflicts, mcp, claudeMd, packages }.
 * `kept` = locally edited files left alone (pass force to overwrite); `conflicts` = files that exist but were not
 * installed by artgen (first install), also left alone unless forced.
 * @param {string} target
 * @param {InstallOptions} [options]
 */
export function install(target, { mode = 'init', modules, force = false, dryRun = false, scaffold = true, skipWorkflows = false, dist = DIST, notes, log = console.log } = {}) {
  target = resolve(target);
  const index = moduleIndex(dist), old = readManifest(target), to = distVersion(dist), had = installedModules(old);
  if (mode === 'init' && old && !force) throw new Error(`artgen ${old.version} is already installed here — use \`update\`, or \`add <module>\``);
  if (mode !== 'init' && !old) throw new Error('artgen is not installed here — use `init`');
  if (mode === 'add' && !modules?.length) throw new Error('add: name the modules to add (`modules` lists them)');
  const defaults = Object.entries(index.modules).filter(([, m]) => m.default).map(([n]) => n);
  const names = resolveModules(index, mode === 'init' ? modules ?? defaults : mode === 'add' ? [...Object.keys(had).filter(n => index.modules[n]), ...(modules ?? [])] : Object.keys(had).filter(n => index.modules[n]));
  const files = distFiles(dist, names);
  const report = { from: old?.version ?? null, to, modules: Object.fromEntries(names.map(n => [n, index.modules[n].version])), hadModules: had, written: [], unchanged: [], kept: [], removed: [], conflicts: [], mcp: '', claudeMd: '', packages: [] };
  const hashes = {};
  for (const [rel, src] of Object.entries(files)) {
    const dest = join(target, rel), data = readFileSync(src), h = sha(data);
    if (existsSync(dest)) {
      const cur = sha(readFileSync(dest));
      if (cur === h) { report.unchanged.push(rel); hashes[rel] = h; continue; }
      const installed = old?.files?.[rel];
      // a token that can't push workflow files (the built-in one of GitHub Actions) must leave them as they are
      if (skipWorkflows && rel.startsWith('.github/workflows/') && installed) { report.kept.push(`${rel} (changed in this release; workflow files need a token that may push them)`); hashes[rel] = installed; continue; }
      if (!force && (installed ? cur !== installed : true)) {
        // edited here: still ours, and kept. Not installed by artgen: never ours, so it is not recorded (update leaves it alone again, remove never deletes it)
        if (installed) { report.kept.push(rel); hashes[rel] = installed; } else report.conflicts.push(rel);
        continue;
      }
    }
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, data); }
    report.written.push(rel);
    hashes[rel] = h;
  }
  // files the previous version installed that the new one no longer ships
  for (const [rel, h] of Object.entries(old?.files ?? {})) {
    if (files[rel] || rel === MANIFEST) continue;
    const dest = join(target, rel);
    if (!existsSync(dest)) continue;
    if (sha(readFileSync(dest)) === h || force) { if (!dryRun) { rmSync(dest); pruneEmpty(dirname(dest), target); } report.removed.push(rel); }
    else { report.kept.push(`${rel} (no longer shipped)`); }
  }
  report.mcp = mergeMcp(target, names.includes('art'), dryRun);
  const cm = writeClaudeMd(target, claudeSection(dist, names), old?.claudeMd, force, dryRun);
  report.claudeMd = cm.action;
  if (mode === 'update') report.packages = bumpPackages(target, dist, dryRun);
  if (!dryRun) {
    mkdirSync(join(target, 'tools', 'artgen'), { recursive: true });
    writeFileSync(join(target, MANIFEST), JSON.stringify({ version: to, modules: report.modules, files: hashes, claudeMd: cm.hash }, null, 2) + '\n');
  }
  if (scaffold && !dryRun) scaffoldProject(target, names, report);
  if (notes && !dryRun) writeFileSync(resolve(notes), releaseNotes(report, dist));
  log?.(formatReport(report, mode, dryRun));
  return report;
}

/**
 * Take modules out: their files that are still as installed are deleted, edited ones are kept (unless force), and the
 * `.mcp.json` entry and the CLAUDE.md section follow. `core` stays, and so does a module another one needs.
 * @param {string} target
 * @param {string[]} names
 * @param {Pick<InstallOptions, 'force' | 'dryRun' | 'dist' | 'log'>} [options]
 */
export function remove(target, names, { force = false, dryRun = false, dist = DIST, log = console.log } = {}) {
  target = resolve(target);
  const index = moduleIndex(dist), old = readManifest(target);
  if (!old) throw new Error('artgen is not installed here — use `init`');
  const had = installedModules(old);
  if (!names?.length) throw new Error('remove: name the modules to remove');
  for (const n of names) {
    if (n === 'core') throw new Error('core cannot be removed');
    if (!had[n]) throw new Error(`module ${n} is not installed here (installed: ${Object.keys(had).join(', ')})`);
  }
  const keep = Object.keys(had).filter(n => !names.includes(n));
  resolveModules(index, keep);   // throws when a module that stays needs one that goes
  const report = { from: old.version, to: old.version, modules: Object.fromEntries(keep.map(n => [n, had[n]])), hadModules: had, written: [], unchanged: [], kept: [], removed: [], conflicts: [], mcp: '', claudeMd: '', packages: [] };
  // the files that go: those of the removed modules in this distribution, and anything the old manifest holds that no module that stays ships
  const stays = distFiles(dist, keep), hashes = { ...old.files };
  for (const rel of Object.keys(old.files)) {
    if (stays[rel] || rel === MANIFEST) continue;
    const dest = join(target, rel);
    delete hashes[rel];
    if (!existsSync(dest)) continue;
    if (force || sha(readFileSync(dest)) === old.files[rel]) { if (!dryRun) { rmSync(dest); pruneEmpty(dirname(dest), target); } report.removed.push(rel); }
    else { report.kept.push(rel); hashes[rel] = old.files[rel]; }
  }
  report.unchanged = Object.keys(stays).filter(r => hashes[r]);
  report.mcp = mergeMcp(target, keep.includes('art'), dryRun);
  const cm = writeClaudeMd(target, claudeSection(dist, keep), old.claudeMd, force, dryRun);
  report.claudeMd = cm.action;
  if (!dryRun) writeFileSync(join(target, MANIFEST), JSON.stringify({ ...old, modules: report.modules, files: hashes, claudeMd: cm.hash }, null, 2) + '\n');
  log?.(formatReport(report, 'remove', dryRun));
  return report;
}

/** The pull request description of an update: what changed in the modules, the changelog since the installed version, and what was kept. */
export function releaseNotes(r, dist = DIST) {
  const lines = [`artgen ${r.from ?? 'none'} → ${r.to}`, ''];
  const mods = Object.entries(r.modules).map(([n, v]) => (r.hadModules[n] && r.hadModules[n] !== v ? `${n} ${r.hadModules[n]} → ${v}` : `${n} ${v}`));
  lines.push(`Modules: ${mods.join(', ')}`, '', `${r.written.length} files written, ${r.removed.length} removed, ${r.unchanged.length} unchanged.`);
  if (r.packages.length) lines.push(`Library package URLs in package.json moved to this release: ${r.packages.join(', ')} (run npm install to refresh the lockfile).`);
  if (r.kept.length) lines.push('', 'Kept because they were edited here (`artgen-dist update --force` replaces them; `status` lists them):', ...r.kept.map(f => `- ${f}`));
  if (r.conflicts.length) lines.push('', 'Skipped because they exist here and were not installed by artgen:', ...r.conflicts.map(f => `- ${f}`));
  const log = changelogSince(dist, r.from);
  if (log) lines.push('', '# Changelog', '', log);
  return lines.join('\n') + '\n';
}

export function formatReport(r, mode, dryRun) {
  const lines = [`artgen ${mode}${dryRun ? ' (dry run)' : ''}: ${r.from && r.from !== r.to ? `${r.from} → ${r.to}` : r.to}`];
  lines.push(`  modules: ${Object.entries(r.modules).map(([n, v]) => `${n} ${v}`).join(', ')}`);
  const list = (label, xs) => { if (xs.length) lines.push(`  ${label} (${xs.length}):`, ...xs.map(x => `    ${x}`)); };
  list('written', r.written);
  list('kept — edited locally, pass --force to overwrite', r.kept);
  list('skipped — exists and was not installed by artgen, pass --force to overwrite', r.conflicts);
  list('removed', r.removed);
  lines.push(`  unchanged: ${r.unchanged.length} files`, `  .mcp.json: ${r.mcp}`, `  CLAUDE.md: ${r.claudeMd}`);
  if (r.packages.length) lines.push(`  package.json: library URLs moved to this release (${r.packages.join(', ')})`);
  if (r.scaffold) lines.push(`  ${r.scaffold.split('\n')[0]}`);
  if (!dryRun) lines.push('Commit .claude/, tools/artgen/, .mcp.json, CLAUDE.md and art/ — sessions (local or cloud) then need no network or npm.');
  return lines.join('\n');
}

/** Installed version, available version, the modules (installed and available versions) and locally edited files. */
export function status(target, { dist = DIST } = {}) {
  target = resolve(target);
  const old = readManifest(target), edited = [], index = moduleIndex(dist), had = installedModules(old);
  if (old) for (const [rel, h] of Object.entries(old.files)) {
    const f = join(target, rel);
    if (!existsSync(f)) edited.push(`${rel} (deleted)`);
    else if (sha(readFileSync(f)) !== h) edited.push(rel);
  }
  const modules = Object.fromEntries(Object.entries(index.modules).map(([n, m]) => [n, { installed: had[n] ?? null, available: m.version, summary: m.summary }]));
  return { installed: old?.version ?? null, available: distVersion(dist), modules, edited };
}

const VALUE_FLAGS = new Set(['--target', '--with', '--notes']);

/** `argv` after the command: the flags it has and the words that are not flags. */
function parseArgs(rest) {
  const flags = {}, words = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (VALUE_FLAGS.has(a)) { if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) throw new Error(`${a}: needs a value`); flags[a] = rest[++i]; }
    else if (a.startsWith('--')) flags[a] = true;
    else words.push(a);
  }
  return { flags, words };
}

const USAGE = `usage: install.mjs init [--with art,maps,ui,update-pr] | add <module…> | remove <module…> | update [--notes file] [--skip-workflows] | status | modules
       options: [--target dir] [--force] [--dry-run] [--no-scaffold]`;

function main(argv) {
  const [cmd = 'help', ...rest] = argv, { flags, words } = parseArgs(rest);
  const target = flags['--target'] ?? process.cwd(), common = { force: !!flags['--force'], dryRun: !!flags['--dry-run'], scaffold: !flags['--no-scaffold'] };
  const list = s => s.split(',').map(x => x.trim()).filter(Boolean);
  if (cmd === 'init') { install(target, { mode: 'init', ...common, modules: flags['--with'] ? list(flags['--with']) : undefined }); return 0; }
  if (cmd === 'update') { install(target, { mode: 'update', ...common, notes: flags['--notes'], skipWorkflows: !!flags['--skip-workflows'] }); return 0; }
  if (cmd === 'add') { install(target, { mode: 'add', ...common, modules: words.flatMap(list) }); return 0; }
  if (cmd === 'remove') { remove(target, words.flatMap(list), common); return 0; }
  if (cmd === 'status') {
    const s = status(target);
    console.log(`installed: ${s.installed ?? 'none'}\navailable: ${s.available}`);
    for (const [n, m] of Object.entries(s.modules)) console.log(`  ${n.padEnd(10)} ${(m.installed ?? '—').padEnd(8)} available ${m.available}`);
    if (s.edited.length) console.log(`edited locally:\n  ${s.edited.join('\n  ')}`);
    return 0;
  }
  if (cmd === 'modules') {
    for (const [n, m] of Object.entries(moduleIndex().modules)) console.log(`${n.padEnd(10)} ${m.version.padEnd(8)} ${m.default ? '(default) ' : ''}${m.summary}${m.requiresAny ? ` — needs ${m.requiresAny.join(' or ')}` : ''}`);
    return 0;
  }
  console.log(USAGE);
  return cmd === 'help' ? 0 : 1;
}

// npx runs the bin through a node_modules/.bin symlink, so compare real paths
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
