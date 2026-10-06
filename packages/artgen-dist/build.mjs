#!/usr/bin/env node
/**
 * Build the artgen distribution (SPEC §3.1) into `out/` — the content of the `artgen-dist` branch:
 *
 *   package.json, install.mjs, README.md      `npx github:…#artgen-dist init|update|status`
 *   dist/claude/{skills,agents,commands}/     → .claude/ in the game repo (commands: /artgen-init, /artgen-direction)
 *   dist/tools/artgen/                        → tools/artgen/: artgen.js + artgen-mcp.js (single-file bundles),
 *                                               resvg.wasm, templates/, VERSION
 *   dist/claude-md.md                         the managed CLAUDE.md section
 *   plugin/ + .claude-plugin/marketplace.json the same content in plugin layout (/artgen:init, /artgen:direction)
 *
 * Usage: node build.mjs [--out <dir>]
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = join(HERE, '..');
const require = createRequire(import.meta.url);

export const VERSION = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).version;

/** How each layout invokes the CLI and names the direction command. */
const LAYOUTS = {
  committed: { ARTGEN: 'node tools/artgen/artgen.js', CMD_DIRECTION: '`/artgen-direction`' },
  plugin: { ARTGEN: 'node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js"', CMD_DIRECTION: '`/artgen:direction`' },
};

const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

/** Copy a content folder, filling {{ARTGEN}} / {{CMD_DIRECTION}} in text files. */
function copyContent(src, dest, vars, rename = n => n) {
  for (const f of walk(src)) {
    const rel = relative(src, f), out = join(dest, dirname(rel), rename(rel.split(/[\\/]/).pop()));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, fill(readFileSync(f, 'utf8'), vars));
  }
}

async function bundle(entry, outfile) {
  await build({
    entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20',
    define: { __ARTGEN_VERSION__: JSON.stringify(VERSION) },
    legalComments: 'none', logLevel: 'warning',
  });
}

/** tools/artgen: bundles, wasm, templates, VERSION. */
async function tools(dest) {
  mkdirSync(dest, { recursive: true });
  await bundle(join(PKGS, 'artgen-cli', 'src', 'bin.ts'), join(dest, 'artgen.js'));
  await bundle(join(PKGS, 'artgen-mcp', 'src', 'bin.ts'), join(dest, 'artgen-mcp.js'));
  cpSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'), join(dest, 'resvg.wasm'));
  cpSync(join(PKGS, 'artgen-cli', 'templates'), join(dest, 'templates'), { recursive: true });
  writeFileSync(join(dest, 'VERSION'), VERSION + '\n');
  // the bundles are ESM; this keeps them ESM even in a game repo whose package.json says "type": "commonjs"
  writeFileSync(join(dest, 'package.json'), JSON.stringify({ name: 'artgen-tools', private: true, version: VERSION, type: 'module' }, null, 2) + '\n');
}

export async function buildDist(out = join(HERE, 'out')) {
  rmSync(out, { recursive: true, force: true });
  const content = join(HERE, 'content');

  // committed layout
  const dist = join(out, 'dist'), vc = LAYOUTS.committed;
  await tools(join(dist, 'tools', 'artgen'));
  copyContent(join(content, 'skills'), join(dist, 'claude', 'skills'), vc);
  copyContent(join(content, 'agents'), join(dist, 'claude', 'agents'), vc);
  copyContent(join(content, 'commands'), join(dist, 'claude', 'commands'), vc, n => `artgen-${n}`);
  writeFileSync(join(dist, 'claude-md.md'), fill(readFileSync(join(content, 'claude-md.md'), 'utf8'), vc));

  // plugin layout (local `/plugin install` users)
  const plugin = join(out, 'plugin'), vp = LAYOUTS.plugin;
  cpSync(join(dist, 'tools'), join(plugin, 'tools'), { recursive: true });
  copyContent(join(content, 'skills'), join(plugin, 'skills'), vp);
  copyContent(join(content, 'agents'), join(plugin, 'agents'), vp);
  copyContent(join(content, 'commands'), join(plugin, 'commands'), vp);
  const desc = 'Pixel and voxel game art pipeline: art direction, T2+ asset sources, review and conformance (artgen).';
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true });
  writeFileSync(join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'artgen', version: VERSION, description: desc }, null, 2) + '\n');
  writeFileSync(join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { artgen: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen-mcp.js'] } } }, null, 2) + '\n');
  mkdirSync(join(out, '.claude-plugin'), { recursive: true });
  writeFileSync(join(out, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: 'artgen', owner: { name: 'rstevenson1237' }, plugins: [{ name: 'artgen', source: './plugin', description: desc, version: VERSION }],
  }, null, 2) + '\n');

  // installer package (what `npx github:…#artgen-dist` runs)
  cpSync(join(HERE, 'src', 'install.mjs'), join(out, 'install.mjs'));
  writeFileSync(join(out, 'package.json'), JSON.stringify({
    name: 'artgen-dist', version: VERSION, description: 'artgen committed install: run `init` or `update` in a game repo root, then commit.',
    type: 'module', bin: { 'artgen-dist': 'install.mjs' }, engines: { node: '>=20' }, license: 'MIT',
  }, null, 2) + '\n');
  cpSync(join(HERE, 'DIST-README.md'), join(out, 'README.md'));
  return { out, version: VERSION, files: walk(out).length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--out'), r = await buildDist(i > 0 ? process.argv[i + 1] : undefined);
  console.log(`artgen-dist ${r.version}: ${r.files} files in ${r.out}`);
  if (!existsSync(join(r.out, 'dist', 'tools', 'artgen', 'artgen.js'))) process.exit(1);
}
