#!/usr/bin/env node
/**
 * artgen committed install (SPEC §3.1, D1). Run from the game repo root, then commit the result:
 *
 *   npx -y github:rstevenson1237/image_tools#artgen-dist init      first install: files + art/ scaffold
 *   npx -y github:rstevenson1237/image_tools#artgen-dist update    later: shows the version change, protects local edits
 *   npx -y github:rstevenson1237/image_tools#artgen-dist status    installed vs available, locally edited files
 *
 * Options: --target <dir> (default: cwd), --force (overwrite locally edited files), --dry-run, --no-scaffold.
 *
 * Copies dist/claude/* into .claude/ and dist/tools/artgen/ into tools/artgen/, merges an `artgen` server into
 * .mcp.json, and writes a managed section into CLAUDE.md. tools/artgen/MANIFEST.json records the hash of every file
 * as installed, so `update` can tell an untouched file (replace it) from a locally edited one (keep it unless --force).
 * Plain Node (>= 20), no dependencies: it runs straight from the artgen-dist branch.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const MANIFEST = 'tools/artgen/MANIFEST.json';
const BEGIN = '<!-- artgen:begin — managed by the artgen installer; `update` rewrites this section -->';
const END = '<!-- artgen:end -->';
const MCP_ENTRY = { command: 'node', args: ['tools/artgen/artgen-mcp.js'] };

const sha = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const posix = p => p.split(sep).join('/');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

/** Files the distribution installs: { target path (posix, repo-relative): source path }. */
export function distFiles(dist = DIST) {
  const files = {};
  for (const f of walk(join(dist, 'claude'))) files[posix(join('.claude', relative(join(dist, 'claude'), f)))] = f;
  for (const f of walk(join(dist, 'tools', 'artgen'))) files[posix(join('tools/artgen', relative(join(dist, 'tools', 'artgen'), f)))] = f;
  return files;
}

export const distVersion = (dist = DIST) => readFileSync(join(dist, 'tools', 'artgen', 'VERSION'), 'utf8').trim();

/** Managed CLAUDE.md section text (between the markers). */
export const claudeSection = (dist = DIST) => `${BEGIN}\n${readFileSync(join(dist, 'claude-md.md'), 'utf8').trim()}\n${END}`;

function mergeMcp(target, dry) {
  const f = join(target, '.mcp.json');
  let cfg = { mcpServers: {} };
  const existed = existsSync(f);
  if (existed) {
    try { cfg = JSON.parse(readFileSync(f, 'utf8')); } catch { throw new Error('.mcp.json is not valid JSON — fix it, then re-run'); }
    cfg.mcpServers ??= {};
  }
  const same = JSON.stringify(cfg.mcpServers.artgen) === JSON.stringify(MCP_ENTRY);
  if (same) return 'unchanged';
  cfg.mcpServers.artgen = MCP_ENTRY;
  if (!dry) writeFileSync(f, JSON.stringify(cfg, null, 2) + '\n');
  return existed ? 'merged' : 'created';
}

/** Insert or replace the managed section. Returns { action, hash } where hash is the section as written. */
function writeClaudeMd(target, dist, oldHash, force, dry) {
  const f = join(target, 'CLAUDE.md'), section = claudeSection(dist);
  const text = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const i = text.indexOf(BEGIN), j = text.indexOf(END);
  if (i >= 0 && j > i) {
    const current = text.slice(i, j + END.length);
    if (current === section) return { action: 'unchanged', hash: sha(section) };
    if (oldHash && sha(current) !== oldHash && !force) return { action: 'kept (edited locally; --force to replace)', hash: oldHash };
    if (!dry) writeFileSync(f, text.slice(0, i) + section + text.slice(j + END.length));
    return { action: 'updated', hash: sha(section) };
  }
  if (!dry) writeFileSync(f, (text ? text.replace(/\s*$/, '\n\n') : '') + section + '\n');
  return { action: text ? 'appended' : 'created', hash: sha(section) };
}

function readManifest(target) {
  const f = join(target, MANIFEST);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/**
 * Install or update. Returns a report: { from, to, written, unchanged, kept, removed, conflicts, mcp, claudeMd }.
 * `kept` = locally edited files left alone (pass force to overwrite); `conflicts` = files that exist but were not
 * installed by artgen (first install), also left alone unless forced.
 */
export function install(target, { mode = 'init', force = false, dryRun = false, scaffold = true, dist = DIST, log = console.log } = {}) {
  target = resolve(target);
  const old = readManifest(target), files = distFiles(dist), to = distVersion(dist);
  if (mode === 'init' && old && !force) throw new Error(`artgen ${old.version} is already installed here — use \`update\``);
  if (mode === 'update' && !old) throw new Error('artgen is not installed here — use `init`');
  const report = { from: old?.version ?? null, to, written: [], unchanged: [], kept: [], removed: [], conflicts: [], mcp: '', claudeMd: '' };
  const hashes = {};
  for (const [rel, src] of Object.entries(files)) {
    const dest = join(target, rel), data = readFileSync(src), h = sha(data);
    if (existsSync(dest)) {
      const cur = sha(readFileSync(dest));
      if (cur === h) { report.unchanged.push(rel); hashes[rel] = h; continue; }
      const installed = old?.files?.[rel];
      if (!force && (installed ? cur !== installed : true)) {
        (installed ? report.kept : report.conflicts).push(rel);
        hashes[rel] = installed ?? cur;
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
    if (sha(readFileSync(dest)) === h || force) { if (!dryRun) rmSync(dest); report.removed.push(rel); }
    else { report.kept.push(`${rel} (no longer shipped)`); }
  }
  report.mcp = mergeMcp(target, dryRun);
  const cm = writeClaudeMd(target, dist, old?.claudeMd, force, dryRun);
  report.claudeMd = cm.action;
  if (!dryRun) {
    mkdirSync(join(target, 'tools', 'artgen'), { recursive: true });
    writeFileSync(join(target, MANIFEST), JSON.stringify({ version: to, files: hashes, claudeMd: cm.hash }, null, 2) + '\n');
  }
  if (scaffold && !dryRun) {
    const r = spawnSync(process.execPath, [join(target, 'tools', 'artgen', 'artgen.js'), 'init', '--root', target], { cwd: target, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`artgen init failed:\n${r.stderr || r.stdout}`);
    report.scaffold = r.stdout.trim();
  }
  log?.(formatReport(report, mode, dryRun));
  return report;
}

export function formatReport(r, mode, dryRun) {
  const lines = [`artgen ${mode}${dryRun ? ' (dry run)' : ''}: ${r.from ? `${r.from} → ${r.to}` : r.to}`];
  const list = (label, xs) => { if (xs.length) lines.push(`  ${label} (${xs.length}):`, ...xs.map(x => `    ${x}`)); };
  list('written', r.written);
  list('kept — edited locally, pass --force to overwrite', r.kept);
  list('skipped — exists and was not installed by artgen, pass --force to overwrite', r.conflicts);
  list('removed', r.removed);
  lines.push(`  unchanged: ${r.unchanged.length} files`, `  .mcp.json: ${r.mcp}`, `  CLAUDE.md: ${r.claudeMd}`);
  if (r.scaffold) lines.push(`  ${r.scaffold.split('\n')[0]}`);
  if (!dryRun) lines.push('Commit .claude/, tools/artgen/, .mcp.json, CLAUDE.md and art/ — sessions (local or cloud) then need no network or npm.');
  return lines.join('\n');
}

/** Installed version, available version and locally edited files. */
export function status(target, { dist = DIST } = {}) {
  target = resolve(target);
  const old = readManifest(target), edited = [];
  if (old) for (const [rel, h] of Object.entries(old.files)) {
    const f = join(target, rel);
    if (!existsSync(f)) edited.push(`${rel} (deleted)`);
    else if (sha(readFileSync(f)) !== h) edited.push(rel);
  }
  return { installed: old?.version ?? null, available: distVersion(dist), edited };
}

function main(argv) {
  const [cmd = 'help', ...rest] = argv, flag = n => rest.includes(n), val = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const target = val('--target') ?? process.cwd();
  if (cmd === 'init' || cmd === 'update') {
    install(target, { mode: cmd, force: flag('--force'), dryRun: flag('--dry-run'), scaffold: !flag('--no-scaffold') });
    return 0;
  }
  if (cmd === 'status') {
    const s = status(target);
    console.log(`installed: ${s.installed ?? 'none'}\navailable: ${s.available}${s.edited.length ? `\nedited locally:\n  ${s.edited.join('\n  ')}` : ''}`);
    return 0;
  }
  console.log('usage: install.mjs init|update|status [--target dir] [--force] [--dry-run] [--no-scaffold]');
  return cmd === 'help' ? 0 : 1;
}

// npx runs the bin through a node_modules/.bin symlink, so compare real paths
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
