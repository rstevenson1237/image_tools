#!/usr/bin/env node
/**
 * Build the artgen distribution (SPEC §3.1, docs/TOOLING-PLAN.md R3) into `out/` — the content of the `artgen-dist` branch:
 *
 *   package.json, install.mjs, README.md      `npx github:…#artgen-dist init|add|remove|update|status`
 *   dist/modules.json                         what each installer module holds (its files, version, requirements)
 *   dist/packages.json                        the library package files a release attaches (lib-packages.mjs)
 *   dist/claude/{skills,agents,commands}/     → .claude/ in the game repo
 *   dist/tools/artgen/                        → tools/artgen/ (core: VERSION, resvg.wasm, fonts/; art: artgen.js, artgen-mcp.js,
 *                                               templates/, runtime/; maps: artgen-maps.js; ui: ui/, the review UI)
 *   dist/github/workflows/                    → .github/workflows/ (update-pr: the weekly update pull request)
 *   dist/claude-md/<module>.md                the managed CLAUDE.md section, one fragment per module
 *   plugin/ + .claude-plugin/marketplace.json the art and maps content in plugin layout (/artgen:init, /artgen:direction)
 *   maps/                                     the map and dungeon engines alone: artgen-maps.js (no pixel-art pipeline),
 *                                             resvg.wasm (PNG only), fonts/ (optional), VERSION (the mapgen version).
 *                                             A consumer may copy the folder at a sha into its own repo (tools/artgen/).
 *
 * Every file of `dist/` belongs to exactly one module (`modules.json`); `content/<module>/` holds each module's skills,
 * agents and commands. Usage: node build.mjs [--out <dir>] [--no-ui]
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packagesIndex } from './lib-packages.mjs';
import { buildUi } from './ui-build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = join(HERE, '..');
const require = createRequire(import.meta.url);

export const VERSION = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).version;
/** The map engines' own version line (docs/TOOLING-PLAN.md R3): the maps module, `artgen-maps.js` and `maps/VERSION` carry it. */
export const MAPGEN_VERSION = JSON.parse(readFileSync(join(PKGS, 'artgen-mapgen', 'package.json'), 'utf8')).version;

/** How each layout invokes the CLI and names the direction command. */
const LAYOUTS = {
  committed: { ARTGEN: 'node tools/artgen/artgen.js', CMD_DIRECTION: '`/artgen-direction`', CMD: '/artgen-' },
  plugin: { ARTGEN: 'node "${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen.js"', CMD_DIRECTION: '`/artgen:direction`', CMD: '/artgen:' },
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

/** Copy a content folder, filling {{ARTGEN}} / {{CMD_DIRECTION}} / {{CMD}} in text files. */
function copyContent(src, dest, vars, rename = n => n) {
  for (const f of walk(src)) {
    const rel = relative(src, f), out = join(dest, dirname(rel), rename(rel.split(/[\\/]/).pop()));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, fill(readFileSync(f, 'utf8'), vars));
  }
}

/** The commit the build is from: ARTGEN_SHA, else the checkout's HEAD (7 characters), else `unknown`. */
export function sourceSha() {
  if (process.env.ARTGEN_SHA) return process.env.ARTGEN_SHA.slice(0, 7);
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: HERE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown'; } catch { return 'unknown'; }
}

async function bundle(entry, outfile, version = VERSION) {
  await build({
    entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20',
    define: { __ARTGEN_VERSION__: JSON.stringify(version), __ARTGEN_SHA__: JSON.stringify(sourceSha()) },
    // CommonJS dependencies (yaml) call require() for Node built-ins; give the ESM bundle a real one
    banner: { js: "import { createRequire as __artgenRequire } from 'node:module'; const require = __artgenRequire(import.meta.url);" },
    legalComments: 'none', logLevel: 'warning',
  });
}

/**
 * The installer modules, in install order. `requiresAny`: at least one of these must be installed with it. `default`: what a
 * bare `init` installs (everything the install held before modules existed); the rest is opt-in (`--with`, `add`).
 */
export const MODULES = {
  core: { summary: 'tools/artgen basics: VERSION, the PNG rasteriser and the map label fonts', default: true },
  art: { summary: 'the pixel-art pipeline: skills, agents and commands, the artgen CLI and MCP server, templates, the runtime', default: true },
  maps: { summary: 'terrain, dungeon and settlement maps: skills, commands and the maps-only CLI (artgen-maps.js)', default: true },
  ui: { summary: 'the review UI (artgen ui): Asset Review, Art Direction, Asset Lab and the map editors in the browser', requiresAny: ['art', 'maps'] },
  'update-pr': { summary: 'a weekly workflow that opens a pull request when a new artgen release is out' },
};

/** tools/artgen, core: what the other modules' programs read beside themselves. */
function core(dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'), join(dest, 'resvg.wasm'));
  // terrain map label fonts (SIL OFL), loaded by the CLI's map renderer next to the bundle
  cpSync(join(PKGS, 'artgen-core', 'assets', 'fonts'), join(dest, 'fonts'), { recursive: true });
  writeFileSync(join(dest, 'VERSION'), VERSION + '\n');
  // the bundles are ESM; this keeps them ESM even in a game repo whose package.json says "type": "commonjs"
  writeFileSync(join(dest, 'package.json'), JSON.stringify({ name: 'artgen-tools', private: true, version: VERSION, type: 'module' }, null, 2) + '\n');
}

/** tools/artgen, art: the full CLI and MCP server bundles, the asset templates and the runtime sources `export --runtime` vendors. */
async function art(dest) {
  await bundle(join(PKGS, 'artgen-cli', 'src', 'bin.ts'), join(dest, 'artgen.js'));
  await bundle(join(PKGS, 'artgen-mcp', 'src', 'bin.ts'), join(dest, 'artgen-mcp.js'));
  cpSync(join(PKGS, 'artgen-cli', 'templates'), join(dest, 'templates'), { recursive: true });
  // runtime sources (core + adapters), without tests and test kits
  const rt = join(PKGS, 'artgen-runtime', 'src');
  cpSync(rt, join(dest, 'runtime'), { recursive: true, filter: f => statSync(f).isDirectory() || (f.endsWith('.ts') && !/\.test\.ts$|[\\/](testkit|contract)\.ts$/.test(f)) });
}

/** The map and dungeon engines as one bundle (version: the mapgen line). */
const mapsBundle = dest => bundle(join(PKGS, 'artgen-cli', 'src', 'maps-bin.ts'), join(dest, 'artgen-maps.js'), MAPGEN_VERSION);

/** maps/: the map and dungeon engines as one bundle, with the wasm and fonts as separate files and a VERSION. */
async function mapsFolder(dest) {
  mkdirSync(dest, { recursive: true });
  await mapsBundle(dest);
  cpSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'), join(dest, 'resvg.wasm'));
  cpSync(join(PKGS, 'artgen-core', 'assets', 'fonts'), join(dest, 'fonts'), { recursive: true });
  writeFileSync(join(dest, 'VERSION'), MAPGEN_VERSION + '\n');
  writeFileSync(join(dest, 'package.json'), JSON.stringify({ name: 'artgen-maps', private: true, version: MAPGEN_VERSION, type: 'module' }, null, 2) + '\n');
}

/** A module's content folder (`content/<module>/{skills,agents,commands}`) into a layout; the commands get the `artgen-` prefix in the committed one. */
function moduleContent(module, claude, vars, prefix) {
  const dir = join(HERE, 'content', module);
  for (const kind of ['skills', 'agents', 'commands']) {
    if (existsSync(join(dir, kind))) copyContent(join(dir, kind), join(claude, kind), vars, kind === 'commands' ? n => prefix + n : undefined);
  }
}

/**
 * Build the committed layout module by module and report the files each one added (dist-relative, posix).
 * `ui: false` leaves the review UI out (tests that don't need it).
 */
async function committed(dist, { ui }) {
  const vc = LAYOUTS.committed, tools = join(dist, 'tools', 'artgen'), claude = join(dist, 'claude');
  mkdirSync(dist, { recursive: true });
  const files = {};
  const module = async (name, run) => {
    const before = new Set(walk(dist));
    await run();
    files[name] = walk(dist).filter(f => !before.has(f)).map(f => relative(dist, f).split(sep).join('/')).sort();
    const frag = join(HERE, 'content', name, 'claude-md.md');
    if (existsSync(frag)) {
      mkdirSync(join(dist, 'claude-md'), { recursive: true });
      writeFileSync(join(dist, 'claude-md', `${name}.md`), fill(readFileSync(frag, 'utf8'), vc));
    }
  };
  await module('core', () => core(tools));
  await module('art', async () => { await art(tools); moduleContent('art', claude, vc, 'artgen-'); });
  // the maps skills call the maps-only bundle, so a repo with only this module has everything they use
  await module('maps', async () => { await mapsBundle(tools); moduleContent('maps', claude, { ...vc, ARTGEN: 'node tools/artgen/artgen-maps.js' }, 'artgen-'); });
  if (ui) await module('ui', async () => { await buildUi(join(tools, 'ui')); moduleContent('ui', claude, vc, 'artgen-'); });
  await module('update-pr', () => {
    mkdirSync(join(dist, 'github', 'workflows'), { recursive: true });
    cpSync(join(HERE, 'content', 'update-pr', 'artgen-update.yml'), join(dist, 'github', 'workflows', 'artgen-update.yml'));
  });
  return files;
}

/** `modules.json`: for each module its version, summary, requirements and files; every file in exactly one module. */
function moduleIndex(files, dist) {
  const all = walk(dist).map(f => relative(dist, f).split(sep).join('/')).filter(f => !f.startsWith('claude-md/'));
  const owner = {}, dup = [];
  for (const [m, fs] of Object.entries(files)) for (const f of fs) { if (owner[f]) dup.push(f); owner[f] = m; }
  const orphans = all.filter(f => !owner[f]);
  if (dup.length || orphans.length) throw new Error(`every dist file belongs to exactly one module (twice: ${dup.join(', ') || 'none'}; none: ${orphans.join(', ') || 'none'})`);
  const modules = {};
  for (const [name, info] of Object.entries(MODULES)) {
    if (!files[name]) continue;
    modules[name] = { version: name === 'maps' ? MAPGEN_VERSION : VERSION, ...info, files: files[name] };
  }
  return { release: VERSION, modules };
}

export async function buildDist(out = join(HERE, 'out'), { ui = true } = {}) {
  rmSync(out, { recursive: true, force: true });

  // committed layout, one module at a time
  const dist = join(out, 'dist'), files = await committed(dist, { ui });
  writeFileSync(join(dist, 'modules.json'), JSON.stringify(moduleIndex(files, dist), null, 2) + '\n');
  writeFileSync(join(dist, 'packages.json'), JSON.stringify(packagesIndex(VERSION), null, 2) + '\n');

  // plugin layout (local `/plugin install` users): the art and maps content, the programs without the review UI
  const plugin = join(out, 'plugin'), vp = LAYOUTS.plugin;
  cpSync(join(dist, 'tools'), join(plugin, 'tools'), { recursive: true, filter: f => !/[\\/]tools[\\/]artgen[\\/]ui([\\/]|$)/.test(f) });
  for (const m of ['art', 'maps']) moduleContent(m, plugin, vp, '');
  const desc = 'Pixel and voxel game art pipeline: art direction, autonomous asset production, review, approval and atlas export, plus tabletop terrain, dungeon and settlement maps (artgen).';
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true });
  writeFileSync(join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'artgen', version: VERSION, description: desc }, null, 2) + '\n');
  writeFileSync(join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { artgen: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/tools/artgen/artgen-mcp.js'] } } }, null, 2) + '\n');
  mkdirSync(join(out, '.claude-plugin'), { recursive: true });
  writeFileSync(join(out, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: 'artgen', owner: { name: 'rstevenson1237' }, plugins: [{ name: 'artgen', source: './plugin', description: desc, version: VERSION }],
  }, null, 2) + '\n');

  // the maps-only folder, copied by consumers that need nothing else
  await mapsFolder(join(out, 'maps'));

  // installer package (what `npx github:…#artgen-dist` runs)
  cpSync(join(HERE, 'src', 'install.mjs'), join(out, 'install.mjs'));
  cpSync(join(HERE, 'CHANGELOG.md'), join(out, 'CHANGELOG.md'));
  writeFileSync(join(out, 'package.json'), JSON.stringify({
    name: 'artgen-dist', version: VERSION, description: 'artgen committed install: run `init`, `add`, `remove` or `update` in a game repo root, then commit.',
    type: 'module', bin: { 'artgen-dist': 'install.mjs' }, engines: { node: '>=20' }, license: 'MIT',
  }, null, 2) + '\n');
  cpSync(join(HERE, 'DIST-README.md'), join(out, 'README.md'));
  return { out, version: VERSION, files: walk(out).length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--out'), r = await buildDist(i > 0 ? process.argv[i + 1] : undefined, { ui: !process.argv.includes('--no-ui') });
  console.log(`artgen-dist ${r.version}: ${r.files} files in ${r.out}`);
  if (!existsSync(join(r.out, 'dist', 'tools', 'artgen', 'artgen.js'))) process.exit(1);
}
