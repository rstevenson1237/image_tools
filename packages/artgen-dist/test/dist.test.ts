// Install smoke test (SPEC §15, PLAN P2): build the distribution, install it into a scratch game repo, and run the
// CLI and MCP server from the committed files only (a session-equivalent run: no npm, no repo packages). Then
// `update`: version change shown, untouched files replaced, local edits kept unless --force, dropped files removed.
// Then the installer modules (docs/TOOLING-PLAN.md R3): core, art, maps, ui and update-pr installed, added and removed on their own.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { buildDist, MAPGEN_VERSION, sourceSha } from '../build.mjs';
import { install, remove, status } from '../src/install.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'artgen-dist-')), OUT = join(tmp, 'out'), GAME = join(tmp, 'game');
const node = (args: string[], input?: string) => spawnSync(process.execPath, args, { cwd: GAME, encoding: 'utf8', input, env: { ...process.env, NODE_PATH: '' } });
const quiet = { log: () => {} };
type Index = { release: string; modules: Record<string, { version: string; files: string[] }> };
/** Make a copy of the distribution look like a newer release: the release and module versions, and files it no longer ships. */
function release(dist: string, version: string, drop: string[] = []) {
  const f = join(dist, 'modules.json'), idx = JSON.parse(readFileSync(f, 'utf8')) as Index;
  idx.release = version;
  for (const [n, m] of Object.entries(idx.modules)) { if (n !== 'maps') m.version = version; m.files = m.files.filter(x => !drop.includes(x)); }
  writeFileSync(f, JSON.stringify(idx, null, 2));
  const p = join(dist, 'packages.json'), pk = JSON.parse(readFileSync(p, 'utf8'));
  pk.release = version;
  writeFileSync(p, JSON.stringify(pk, null, 2));
}

beforeAll(async () => {
  await buildDist(OUT);
  mkdirSync(GAME);
  // an existing game repo: its own CLAUDE.md, another MCP server, and a CommonJS package.json
  writeFileSync(join(GAME, 'CLAUDE.md'), '# Swamp game\n\nGame rules here.\n');
  writeFileSync(join(GAME, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  writeFileSync(join(GAME, 'package.json'), JSON.stringify({ name: 'swamp', type: 'commonjs' }));
});

describe('artgen-dist', () => {
  test('build: committed layout, plugin layout, installer package', () => {
    for (const f of ['package.json', 'install.mjs', 'README.md', 'dist/claude-md/art.md', 'dist/claude-md/maps.md', 'dist/claude-md/ui.md', 'dist/modules.json', 'dist/packages.json', 'dist/github/workflows/artgen-update.yml', 'dist/tools/artgen/artgen-maps.js', 'dist/tools/artgen/ui/index.html', 'dist/claude/commands/artgen-ui.md', 'CHANGELOG.md', 'dist/tools/artgen/artgen.js', 'dist/tools/artgen/artgen-mcp.js',
      'dist/tools/artgen/resvg.wasm', 'dist/tools/artgen/VERSION', 'dist/tools/artgen/templates/topdown/character/base.js',
      'dist/claude/skills/artgen/SKILL.md', 'dist/claude/skills/art-direction/SKILL.md', 'dist/claude/agents/art-reviewer.md', 'dist/claude/agents/art-maker.md',
      'dist/claude/commands/artgen-init.md', 'dist/claude/commands/artgen-direction.md', 'dist/claude/skills/asset-production/SKILL.md',
      ...['brief', 'make', 'review', 'feedback', 'approve', 'export', 'restyle', 'map', 'dungeon', 'settlement'].map(c => `dist/claude/commands/artgen-${c}.md`),
      'dist/claude/skills/terrain-map/SKILL.md', 'plugin/skills/terrain-map/SKILL.md', 'plugin/commands/map.md',
      'dist/claude/skills/dungeon-map/SKILL.md', 'plugin/skills/dungeon-map/SKILL.md', 'plugin/commands/dungeon.md',
      'dist/claude/skills/settlement-map/SKILL.md', 'plugin/skills/settlement-map/SKILL.md', 'plugin/commands/settlement.md',
      'dist/tools/artgen/fonts/AlegreyaSans-Regular.ttf', 'dist/tools/artgen/fonts/OFL.txt', 'plugin/tools/artgen/fonts/AlegreyaSans-Bold.ttf',
      'dist/tools/artgen/templates/topdown/character-walk/base.js', 'plugin/commands/make.md',
      'dist/tools/artgen/runtime/index.ts', 'dist/tools/artgen/runtime/adapters/pixi.ts', 'dist/tools/artgen/runtime/adapters/three.ts',
      'plugin/.claude-plugin/plugin.json', 'plugin/.mcp.json', 'plugin/commands/direction.md', 'plugin/skills/artgen/SKILL.md', '.claude-plugin/marketplace.json'])
      expect(existsSync(join(OUT, f)), f).toBe(true);
    const skill = readFileSync(join(OUT, 'dist/claude/skills/art-direction/SKILL.md'), 'utf8');
    expect(skill).toMatch(/node tools\/artgen\/artgen\.js direction candidates/);
    expect(skill).not.toMatch(/\{\{/);
    expect(readFileSync(join(OUT, 'plugin/skills/artgen/SKILL.md'), 'utf8')).toMatch(/CLAUDE_PLUGIN_ROOT/);
    const prod = readFileSync(join(OUT, 'dist/claude/skills/asset-production/SKILL.md'), 'utf8');
    expect(prod).toMatch(/`\/artgen-make`/); expect(prod).not.toMatch(/\{\{/);
    expect(readFileSync(join(OUT, 'plugin/skills/asset-production/SKILL.md'), 'utf8')).toMatch(/`\/artgen:make`/);
    expect(JSON.parse(readFileSync(join(OUT, 'package.json'), 'utf8')).bin).toEqual({ 'artgen-dist': 'install.mjs' });
  });

  test('build: every file of dist/ is in exactly one module, and the modules hold what their name says', () => {
    const idx = JSON.parse(readFileSync(join(OUT, 'dist/modules.json'), 'utf8')) as { release: string; modules: Record<string, { version: string; files: string[]; requiresAny?: string[] }> };
    expect(Object.keys(idx.modules)).toEqual(['core', 'art', 'maps', 'ui', 'update-pr']);
    const all = idx.modules, owner = new Map<string, string>();
    for (const [m, { files }] of Object.entries(all)) for (const f of files) { expect(owner.has(f), `${f} in ${owner.get(f)} and ${m}`).toBe(false); owner.set(f, m); expect(existsSync(join(OUT, 'dist', f)), f).toBe(true); }
    const on = (m: string, f: string) => all[m].files.includes(f);
    expect(on('core', 'tools/artgen/VERSION') && on('core', 'tools/artgen/resvg.wasm') && on('core', 'tools/artgen/fonts/OFL.txt')).toBe(true);
    expect(on('art', 'tools/artgen/artgen.js') && on('art', 'tools/artgen/artgen-mcp.js') && on('art', 'claude/skills/art-direction/SKILL.md') && on('art', 'claude/agents/art-reviewer.md')).toBe(true);
    expect(on('maps', 'tools/artgen/artgen-maps.js') && on('maps', 'claude/skills/terrain-map/SKILL.md') && on('maps', 'claude/commands/artgen-settlement.md')).toBe(true);
    expect(all.ui.files).toEqual(expect.arrayContaining(['tools/artgen/ui/index.html', 'claude/commands/artgen-ui.md']));
    expect(all['update-pr'].files).toEqual(['github/workflows/artgen-update.yml']);
    expect(all.ui.requiresAny).toEqual(['art', 'maps']);
    // nothing of one module's content is in another's
    expect(all.maps.files.filter(f => /artgen\.js$|artgen-mcp|templates|runtime|art-direction|asset-production/.test(f))).toEqual([]);
    expect(all.art.files.filter(f => /terrain-map|dungeon-map|settlement-map|artgen-maps/.test(f))).toEqual([]);
    // the maps module has its own version line
    expect(all.maps.version).toBe(MAPGEN_VERSION);
    expect(all.art.version).toBe(idx.release);
    expect(readFileSync(join(OUT, 'maps/VERSION'), 'utf8').trim()).toBe(MAPGEN_VERSION);
    // the maps skills call the maps-only bundle; the art ones the full CLI
    expect(readFileSync(join(OUT, 'dist/claude/skills/terrain-map/SKILL.md'), 'utf8')).toMatch(/node tools\/artgen\/artgen-maps\.js map /);
    expect(readFileSync(join(OUT, 'dist/claude/skills/terrain-map/SKILL.md'), 'utf8')).not.toMatch(/node tools\/artgen\/artgen\.js/);
    expect(JSON.parse(readFileSync(join(OUT, 'dist/packages.json'), 'utf8')).packages['artgen-mapgen']).toEqual({ version: MAPGEN_VERSION, file: `artgen-mapgen-${MAPGEN_VERSION}.tgz` });
    // the review UI carries no OpenCV and no second copy of the rasteriser or the fonts (the core module has them)
    const ui = all.ui.files.filter(f => f.startsWith('tools/artgen/ui/'));
    expect(ui.filter(f => /\.(wasm|ttf)$/.test(f))).toEqual([]);
    expect(ui.reduce((n, f) => n + readFileSync(join(OUT, 'dist', f)).length, 0)).toBeLessThan(3 * 1024 * 1024);
  });

  test('init: files, .mcp.json merge, CLAUDE.md section, art/ scaffold, manifest', () => {
    const r = install(GAME, { dist: join(OUT, 'dist'), ...quiet });
    expect(r.from).toBeNull();
    expect(r.conflicts).toEqual([]);
    expect(JSON.parse(readFileSync(join(GAME, '.mcp.json'), 'utf8')).mcpServers).toEqual({ other: { command: 'x' }, artgen: { command: 'node', args: ['tools/artgen/artgen-mcp.js'] } });
    const md = readFileSync(join(GAME, 'CLAUDE.md'), 'utf8');
    expect(md.startsWith('# Swamp game\n\nGame rules here.\n\n<!-- artgen:begin')).toBe(true);
    expect(md).toMatch(/\/artgen-direction/);
    expect(existsSync(join(GAME, 'art', 'artgen.config.json'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(GAME, 'tools/artgen/MANIFEST.json'), 'utf8'));
    expect(manifest.version).toBe(readFileSync(join(OUT, 'dist/tools/artgen/VERSION'), 'utf8').trim());
    // a bare `init` installs what an install held before modules: core, art and maps (the review UI and the update workflow are opt-in)
    expect(manifest.modules).toEqual({ core: manifest.version, art: manifest.version, maps: MAPGEN_VERSION });
    expect(existsSync(join(GAME, 'tools/artgen/artgen-maps.js')) && existsSync(join(GAME, '.claude/skills/terrain-map/SKILL.md'))).toBe(true);
    expect(existsSync(join(GAME, 'tools/artgen/ui')) || existsSync(join(GAME, '.github'))).toBe(false);
    expect(md).toMatch(/## Art pipeline \(artgen\)[\s\S]*## Tabletop maps \(artgen\)/);
    expect(() => install(GAME, { dist: join(OUT, 'dist'), ...quiet })).toThrow(/already installed/);
  });

  test('session-equivalent W1 run from the committed files: candidates → tile → mix → lock', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    expect(cli('--version').trim()).toMatch(/^\d+\.\d+\.\d+/);
    cli('direction', 'candidates', '--pitch', 'Grim swamp roguelike with bog goblins', '--view', 'topdown');
    expect(cli('direction', 'tile')).toMatch(/style tile art\/candidates\/style-tile-r1\.png/);
    cli('finish', 'art/probes/character');
    cli('direction', 'mix', 'a', '--line', 'b');
    expect(cli('direction', 'lock', 'mix1')).toMatch(/locked grim-swamp-roguelike v1/);
    for (const f of ['art/direction.png', 'art/anchors/character.png', 'art/anchors/effect.png']) expect(existsSync(join(GAME, f))).toBe(true);
    cli('new', 'goblin', '--kind', 'character');
    expect(cli('render', 'art/assets/character/goblin')).toMatch(/gate pass/);
  });

  test('terrain map from the committed files: new → label → render (bundled fonts)', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    cli('map', 'new', 'isle', '--size', '10x8', '--seed', '3');
    cli('map', 'label', 'isle', 'Port Ash', '--at', '0303');
    expect(cli('map', 'render', 'isle', '--ppu', '12')).toMatch(/isle\.bw\.png/);
    for (const f of ['isle.color.svg', 'isle.color.png', 'isle.bw.svg', 'isle.bw.png']) expect(existsSync(join(GAME, 'art/maps/isle/out', f)), f).toBe(true);
  });

  test('dungeon from the committed files: single room → generated → label → render (bundled fonts)', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    cli('dungeon', 'new', 'cell', '--room', 'circle', '--room-size', '7x7', '--exits', 'n,s:secret');
    cli('dungeon', 'new', 'lair', '--rooms', '5', '--size', '24x18', '--seed', '3');
    cli('dungeon', 'label', 'lair', 'Ossuary', '--at', '5,5', '--kind', 'area');
    expect(cli('dungeon', 'render', 'lair', '--ppu', '12')).toMatch(/lair\.png/);
    for (const f of ['lair.svg', 'lair.png']) expect(existsSync(join(GAME, 'art/dungeons/lair/out', f)), f).toBe(true);
  });

  test('settlement from the committed files: generated village → a floor plan → render (bundled fonts)', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    cli('settlement', 'new', 'brook', '--kind', 'hamlet', '--seed', '3', '--title', 'Brook');
    cli('settlement', 'interior', 'brook', 'b1');
    expect(cli('settlement', 'render', 'brook', '--ppu', '6', '--theme', 'both')).toMatch(/brook\.bw\.png/);
    expect(cli('settlement', 'render', 'brook', '--building', 'b1', '--ppu', '16')).toMatch(/brook\.b1\.f0\.color\.png/);
    for (const f of ['brook.color.png', 'brook.bw.png', 'brook.b1.f0.color.png']) expect(existsSync(join(GAME, 'art/settlements/brook/out', f)), f).toBe(true);
  });

  test('session-equivalent W2 run from the committed files: brief → make → review/score → status → export (drafts)', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    cli('brief', 'add', 'wisp', '--kind', 'effect', '--object', 'will-o-wisp flame with orbiting sparks', '--anims', 'idle:4');
    cli('brief', 'add', 'leech', '--kind', 'creature', '--directions', '8', '--anims', 'walk:4');
    expect(cli('make')).toMatch(/next: wisp — review base\.v1/);
    expect(readFileSync(join(GAME, 'art/assets/creature/leech/base.v1.js'), 'utf8')).toMatch(/template: humanoid with facings/);
    cli('review', 'wisp'); cli('score', 'wisp', 'base.v1', '6', '--note', 'smoke');
    expect(cli('status')).toMatch(/wisp\s+in-pipeline\s+write-base base\.v2/);
    expect(cli('export', '--include-drafts')).toMatch(/nothing approved to export yet/);
  });

  test('session-equivalent W3 vendoring from the committed files: export --runtime copies the runtime + adapters, stamped', () => {
    const r = node(['tools/artgen/artgen.js', 'export', '--runtime', '--json']);
    expect(r.status, r.stderr).toBe(0);
    const rt = JSON.parse(r.stdout).runtime;
    expect(rt).toMatchObject({ dir: 'src/art/runtime', version: RUNTIME_VERSION, adapters: ['canvas2d'] });
    expect(rt.written).toEqual(expect.arrayContaining(['pack.ts', 'adapters/canvas2d.ts']));
    expect(existsSync(join(GAME, 'src/art/runtime/runtime.json'))).toBe(true);
    expect(existsSync(join(OUT, 'dist/tools/artgen/runtime/testkit.ts')) || existsSync(join(OUT, 'dist/tools/artgen/runtime/runtime.test.ts'))).toBe(false);
  });

  test('MCP server from the committed files: initialize, tools/list, a render with an image result', () => {
    const msgs = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'render', arguments: { asset: 'art/assets/character/goblin' } } },
    ];
    const r = node(['tools/artgen/artgen-mcp.js'], msgs.map(m => JSON.stringify(m)).join('\n') + '\n');
    const out = r.stdout.trim().split('\n').map(l => JSON.parse(l));
    expect(out.map(m => m.id)).toEqual([1, 2, 3]);
    expect(out[1].result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['make', 'approve', 'texture', 'fx', 'export', 'analytics', 'map_render', 'dungeon_render', 'settlement_render']));
    expect(out[2].result.content.map((c: { type: string }) => c.type)).toEqual(['text', 'image']);
  });

  test('update: version change, local edits kept unless --force, dropped files removed', () => {
    // a newer distribution: one changed skill, one dropped command, a bumped version
    const next = join(tmp, 'next');
    cpSync(join(OUT, 'dist'), next, { recursive: true });
    writeFileSync(join(next, 'tools/artgen/VERSION'), '9.9.9\n');
    release(next, '9.9.9', ['claude/commands/artgen-init.md']);
    writeFileSync(join(next, 'claude/skills/artgen/SKILL.md'), readFileSync(join(next, 'claude/skills/artgen/SKILL.md'), 'utf8') + '\nnew in 9.9.9\n');
    writeFileSync(join(next, 'claude/agents/art-reviewer.md'), 'changed upstream\n');
    rmSync(join(next, 'claude/commands/artgen-init.md'));
    // the user edited the reviewer agent locally
    writeFileSync(join(GAME, '.claude/agents/art-reviewer.md'), 'my reviewer\n');
    expect(status(GAME, { dist: next })).toMatchObject({ available: '9.9.9', edited: ['.claude/agents/art-reviewer.md'] });

    const r = install(GAME, { mode: 'update', dist: next, scaffold: false, ...quiet });
    expect(r.to).toBe('9.9.9');
    expect(r.written).toEqual(expect.arrayContaining(['.claude/skills/artgen/SKILL.md', 'tools/artgen/VERSION']));
    expect(r.kept).toEqual(['.claude/agents/art-reviewer.md']);
    expect(r.removed).toEqual(['.claude/commands/artgen-init.md']);
    expect(readFileSync(join(GAME, '.claude/agents/art-reviewer.md'), 'utf8')).toBe('my reviewer\n');
    expect(readFileSync(join(GAME, '.claude/skills/artgen/SKILL.md'), 'utf8')).toMatch(/new in 9\.9\.9/);
    expect(existsSync(join(GAME, '.claude/commands/artgen-init.md'))).toBe(false);
    // the kept file stays protected on the next update; --force replaces it
    expect(install(GAME, { mode: 'update', dist: next, scaffold: false, ...quiet }).kept).toEqual(['.claude/agents/art-reviewer.md']);
    const f = install(GAME, { mode: 'update', dist: next, scaffold: false, force: true, ...quiet });
    expect(f.written).toEqual(['.claude/agents/art-reviewer.md']);
    expect(readFileSync(join(GAME, '.claude/agents/art-reviewer.md'), 'utf8')).toBe('changed upstream\n');
    // art/ and the game's own files are never touched by update
    expect(readFileSync(join(GAME, 'art/direction.json'), 'utf8')).toMatch(/"status": "locked"/);
    expect(JSON.parse(readFileSync(join(GAME, '.mcp.json'), 'utf8')).mcpServers.other).toEqual({ command: 'x' });
  });

  test('installer CLI entry: status and dry run', () => {
    const r = node([join(OUT, 'install.mjs'), 'status']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/installed: 9\.9\.9/);
    const d = node([join(OUT, 'install.mjs'), 'update', '--dry-run']);
    expect(d.stdout).toMatch(/dry run/);
  });
});

// maps/: the map and dungeon engines alone, copied as a folder into a consumer repo with no project and no install step
describe('maps/ (the maps-only bundle)', () => {
  const FIX = fileURLToPath(new URL('../../artgen-cli/fixtures/setting-builder/', import.meta.url));
  const consumer = join(tmp, 'consumer'), tools = join(consumer, 'tools', 'artgen'), bundle = join(tools, 'artgen-maps.js');
  const maps = (...args: string[]) => spawnSync(process.execPath, [bundle, ...args], { cwd: consumer, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  const ok = (...args: string[]) => { const r = maps(...args); expect(r.status, args.join(' ') + '\n' + r.stderr + r.stdout).toBe(0); return r.stdout; };

  beforeAll(() => {
    mkdirSync(consumer, { recursive: true });
    cpSync(join(OUT, 'maps'), tools, { recursive: true });
    rmSync(join(tools, 'resvg.wasm'));   // SVG needs no rasteriser
    rmSync(join(tools, 'fonts'), { recursive: true });
    for (const c of ['warren', 'keep', 'shrine-crypts', 'bad-file']) cpSync(join(FIX, c, 'dungeon.json'), join(consumer, `${c}.json`));
    cpSync(join(FIX, 'keep', 'map.json'), join(consumer, 'map.json'));   // keep's underlay
    cpSync(join(FIX, 'ravine', 'map.json'), join(consumer, 'ravine.json'));
    for (const c of ['frontier', 'frontier-unmet']) cpSync(join(FIX, c, 'map.json'), join(consumer, `${c}.json`));
  });

  test('build: the folder holds the bundle, resvg.wasm, fonts and VERSION, and none of the pixel-art pipeline', () => {
    for (const f of ['artgen-maps.js', 'resvg.wasm', 'VERSION', 'package.json', 'fonts/AlegreyaSans-Regular.ttf']) expect(existsSync(join(OUT, 'maps', f)), f).toBe(true);
    const size = (f: string) => readFileSync(f).length, js = readFileSync(join(OUT, 'maps', 'artgen-maps.js'), 'utf8');
    expect(size(join(OUT, 'maps', 'artgen-maps.js'))).toBeLessThan(size(join(OUT, 'dist/tools/artgen/artgen.js')) / 2);
    for (const marker of ['applyFinish', 'Scene3D', 'greedyMesh', 'validateDirection', 'encodeGIF']) expect(js, marker).not.toContain(marker);
    expect(readFileSync(join(OUT, 'maps', 'VERSION'), 'utf8')).toBe(readFileSync(join(OUT, 'dist/tools/artgen/VERSION'), 'utf8'));
  });

  test('--version prints the release and the commit it was built from; formats --json', () => {
    expect(ok('--version').trim()).toBe(`${readFileSync(join(OUT, 'maps', 'VERSION'), 'utf8').trim()} (${sourceSha()})`);
    expect(JSON.parse(ok('formats', '--json'))).toEqual({ map: 1, dungeon: 1, settlement: 1 });
  });

  test('check, fit and an SVG render of the fixtures from an empty folder, with no resvg.wasm and no fonts', () => {
    for (const c of ['warren', 'keep', 'shrine-crypts']) {
      expect(JSON.parse(ok('dungeon', 'check', '--file', `${c}.json`, '--json'))).toMatchObject({ ok: true, errors: [] });
      ok('dungeon', 'fit', '--file', `${c}.json`);
      ok('dungeon', 'render', '--file', `${c}.json`, '--format', 'svg');
      expect(readFileSync(join(consumer, `${c}.svg`), 'utf8')).toContain('<svg');
    }
    // keep stands on its underlay and inside its wall, from the maps-only bundle too, and `fit` keeps them registered
    const keep = readFileSync(join(consumer, 'keep.svg'), 'utf8');
    expect(keep).toContain('<g id="underlay"');
    expect(keep).toContain('<g id="enclosure"');
    ok('map', 'render', '--file', 'ravine.json', '--format', 'svg', '--theme', 'color');
    expect(readFileSync(join(consumer, 'ravine.color.svg'), 'utf8')).toContain('<svg');
    expect(existsSync(join(consumer, 'art'))).toBe(false);
  }, 120_000);

  test('map check from the bundle: the ravine and the frontier are met; frontier-unmet exits 1 and names C-ground alone', () => {
    expect(JSON.parse(ok('map', 'check', '--file', 'ravine.json', '--json'))).toMatchObject({ ok: true, unmet: [] });
    expect(JSON.parse(ok('map', 'check', '--file', 'frontier.json', '--json'))).toMatchObject({ ok: true, unmet: [] });
    const r = maps('map', 'check', '--file', 'frontier-unmet.json', '--json');
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: false, errors: [], unmet: ['C-ground'] });
  }, 120_000);

  test('a bad file exits non-zero and names its errors by JSON path', () => {
    const r = maps('dungeon', 'check', '--file', 'bad-file.json', '--json');
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).errors.map((e: { path: string }) => e.path)).toEqual(['rooms[4].w', 'corridors[5].to.room']);
  });

  test('PNG without resvg.wasm fails naming the file; with it beside the bundle PNG renders, without fonts', () => {
    const r = maps('dungeon', 'render', '--file', 'warren.json', '--format', 'png');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/resvg\.wasm/);
    cpSync(join(OUT, 'maps', 'resvg.wasm'), join(tools, 'resvg.wasm'));
    expect(maps('dungeon', 'render', '--file', 'warren.json', '--format', 'png', '--ppu', '8').status).toBe(0);
    expect(existsSync(join(consumer, 'warren.png'))).toBe(true);
  });

  test('other commands are not in the bundle', () => {
    const r = maps('render', 'art/assets/character/x');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/map, dungeon, settlement, formats, ui, report, upstream/);
  });
});

// installer modules (docs/TOOLING-PLAN.md R3): each installs, is added and is removed on its own
describe('modules', () => {
  const DIST = () => join(OUT, 'dist');
  const repo = (name: string, files: Record<string, string> = {}) => {
    const dir = join(tmp, name);
    mkdirSync(dir, { recursive: true });
    for (const [f, text] of Object.entries(files)) { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), text); }
    return dir;
  };
  const run = (cwd: string, args: string[]) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  const manifest = (dir: string) => JSON.parse(readFileSync(join(dir, 'tools/artgen/MANIFEST.json'), 'utf8'));
  const has = (dir: string, ...files: string[]) => files.map(f => existsSync(join(dir, f)));

  test('maps only: no art skills, agents, commands, CLI or MCP server; the map skills run from artgen-maps.js alone', () => {
    const dir = repo('maps-only');
    const r = install(dir, { dist: DIST(), modules: ['maps'], ...quiet });
    expect(Object.keys(r.modules)).toEqual(['core', 'maps']);
    expect(has(dir, 'tools/artgen/artgen-maps.js', 'tools/artgen/resvg.wasm', 'tools/artgen/fonts/OFL.txt', '.claude/skills/terrain-map/SKILL.md', '.claude/skills/settlement-map/SKILL.md', '.claude/commands/artgen-dungeon.md')).toEqual([true, true, true, true, true, true]);
    expect(has(dir, 'tools/artgen/artgen.js', 'tools/artgen/artgen-mcp.js', 'tools/artgen/templates', 'tools/artgen/runtime', '.claude/skills/artgen', '.claude/skills/art-direction', '.claude/agents', '.claude/commands/artgen-make.md', '.mcp.json', 'tools/artgen/ui', '.github')).toEqual(new Array(11).fill(false));
    const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(md).toMatch(/## Tabletop maps \(artgen\)/);
    expect(md).not.toMatch(/Art pipeline|art-direction|asset-production/);
    expect(JSON.parse(readFileSync(join(dir, 'art/artgen.config.json'), 'utf8'))).toEqual({});
    expect(manifest(dir).modules).toEqual({ core: manifest(dir).version, maps: MAPGEN_VERSION });
    // a terrain map by id, labelled and rendered to PNG with the bundled fonts, from the committed files only
    const maps = (...a: string[]) => { const x = run(dir, ['tools/artgen/artgen-maps.js', ...a]); expect(x.status, x.stderr + x.stdout).toBe(0); return x.stdout; };
    maps('map', 'new', 'isle', '--size', '10x8', '--seed', '3');
    maps('map', 'label', 'isle', 'Port Ash', '--at', '0303');
    expect(maps('map', 'render', 'isle', '--ppu', '12')).toMatch(/isle\.bw\.png/);
    expect(existsSync(join(dir, 'art/maps/isle/out/isle.color.png'))).toBe(true);
    expect(maps('--version').trim()).toBe(`${MAPGEN_VERSION} (${sourceSha()})`);
    // the skills' commands name the program that is there
    expect(readFileSync(join(dir, '.claude/skills/dungeon-map/SKILL.md'), 'utf8')).toMatch(/node tools\/artgen\/artgen-maps\.js dungeon /);
  });

  test('add art to a maps-only repo: the art files, the MCP server, the real config and a second CLAUDE.md section arrive; the maps stay', () => {
    const dir = repo('maps-then-art', { 'CLAUDE.md': '# Mine\n' });
    install(dir, { dist: DIST(), modules: ['maps'], ...quiet });
    const mapJson = readFileSync(join(dir, 'tools/artgen/artgen-maps.js'));
    const r = install(dir, { mode: 'add', dist: DIST(), modules: ['art'], ...quiet });
    expect(Object.keys(r.modules)).toEqual(['core', 'art', 'maps']);
    expect(r.hadModules).toEqual({ core: expect.any(String), maps: MAPGEN_VERSION });
    expect(has(dir, 'tools/artgen/artgen.js', 'tools/artgen/artgen-mcp.js', '.claude/skills/art-direction/SKILL.md', '.claude/agents/art-reviewer.md')).toEqual([true, true, true, true]);
    expect(readFileSync(join(dir, 'tools/artgen/artgen-maps.js')).equals(mapJson)).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8')).mcpServers.artgen).toEqual({ command: 'node', args: ['tools/artgen/artgen-mcp.js'] });
    expect(JSON.parse(readFileSync(join(dir, 'art/artgen.config.json'), 'utf8'))).not.toEqual({});
    expect(existsSync(join(dir, 'art/direction.json'))).toBe(true);
    const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(md.startsWith('# Mine\n')).toBe(true);
    expect(md.match(/<!-- artgen:begin/g)).toHaveLength(1);
    expect(md).toMatch(/## Art pipeline \(artgen\)[\s\S]*## Tabletop maps \(artgen\)/);
    expect(manifest(dir).modules.art).toBe(manifest(dir).version);
    expect(() => install(dir, { mode: 'add', dist: DIST(), modules: ['nope'], ...quiet })).toThrow(/no module nope/);
    expect(() => install(repo('never'), { mode: 'add', dist: DIST(), modules: ['art'], ...quiet })).toThrow(/not installed/);
  });

  test('remove: a module\'s untouched files go, an edited one stays; the MCP entry and the CLAUDE.md fragment follow', () => {
    const dir = repo('remove', { '.mcp.json': JSON.stringify({ mcpServers: { other: { command: 'x' } } }) });
    install(dir, { dist: DIST(), ...quiet });
    writeFileSync(join(dir, '.claude/skills/dungeon-map/SKILL.md'), readFileSync(join(dir, '.claude/skills/dungeon-map/SKILL.md'), 'utf8') + '\nMy house rule.\n');
    const r = remove(dir, ['maps'], { dist: DIST(), ...quiet });
    expect(r.kept).toEqual(['.claude/skills/dungeon-map/SKILL.md']);
    expect(has(dir, 'tools/artgen/artgen-maps.js', '.claude/skills/terrain-map', '.claude/skills/settlement-map', '.claude/commands/artgen-map.md')).toEqual([false, false, false, false]);
    expect(existsSync(join(dir, '.claude/skills/dungeon-map/SKILL.md'))).toBe(true);
    expect(has(dir, 'tools/artgen/artgen.js', '.claude/skills/artgen/SKILL.md', 'art/direction.json')).toEqual([true, true, true]);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).not.toMatch(/Tabletop maps/);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toMatch(/Art pipeline/);
    expect(Object.keys(manifest(dir).modules)).toEqual(['core', 'art']);
    expect(manifest(dir).files['.claude/skills/dungeon-map/SKILL.md']).toBeDefined();   // still ours until it goes
    // removing art takes the MCP entry (ours only) and the art section; core cannot go
    remove(dir, ['art'], { dist: DIST(), force: true, ...quiet });
    expect(JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8')).mcpServers).toEqual({ other: { command: 'x' } });
    // what stays is the core module's section (the feedback loop) and its commands
    const left = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    expect(left).not.toMatch(/Art pipeline|Tabletop maps/);
    expect(left).toMatch(/## Sending feedback back to artgen/);
    expect(has(dir, 'tools/artgen/artgen.js', '.claude/agents', '.claude/skills', '.claude/commands/artgen-report.md', '.claude/commands/artgen-upstream.md')).toEqual([false, false, false, true, true]);
    expect(has(dir, 'tools/artgen/VERSION', 'tools/artgen/MANIFEST.json')).toEqual([true, true]);
    expect(() => remove(dir, ['core'], { dist: DIST(), ...quiet })).toThrow(/core cannot be removed/);
    expect(() => remove(dir, ['ui'], { dist: DIST(), ...quiet })).toThrow(/not installed/);
  });

  test('ui needs art or maps; add ui brings the review UI, and removing the last of art and maps is refused while it is there', () => {
    expect(() => install(repo('ui-alone'), { dist: DIST(), modules: ['ui'], ...quiet })).toThrow(/ui needs art or maps/);
    const dir = repo('with-ui');
    install(dir, { dist: DIST(), modules: ['maps'], ...quiet });
    expect(has(dir, 'tools/artgen/ui/index.html')).toEqual([false]);
    install(dir, { mode: 'add', dist: DIST(), modules: ['ui'], ...quiet });
    expect(has(dir, 'tools/artgen/ui/index.html', '.claude/commands/artgen-ui.md')).toEqual([true, true]);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toMatch(/## Review in the browser \(artgen ui\)/);
    expect(() => remove(dir, ['maps'], { dist: DIST(), ...quiet })).toThrow(/ui needs art or maps/);
    remove(dir, ['ui'], { dist: DIST(), ...quiet });
    expect(has(dir, 'tools/artgen/ui', '.claude/commands/artgen-ui.md')).toEqual([false, false]);
  });

  test('artgen ui from the installed files: serves the UI, the rasteriser and fonts of the core module, and the repo\'s art/ behind the token', async () => {
    const dir = repo('ui-serve');
    install(dir, { dist: DIST(), modules: ['art', 'maps', 'ui'], ...quiet });
    const child = spawn(process.execPath, ['tools/artgen/artgen.js', 'ui', '--port', '0'], { cwd: dir, env: { ...process.env, NODE_PATH: '' } });
    try {
      const url = await new Promise<string>((ok, fail) => {
        let out = '';
        child.stdout.on('data', d => { out += d; const m = out.match(/artgen ui: (http:\/\/\S+)/); if (m) ok(m[1]); });
        child.once('exit', c => fail(new Error(`artgen ui exited ${c}`)));
        setTimeout(() => fail(new Error('no link printed')), 20_000);
      });
      const u = new URL(url), base = u.origin, token = u.searchParams.get('t')!, auth = { 'x-artgen-token': token };
      expect(await (await fetch(base + '/')).text()).toMatch(/<div id="app">/);
      expect((await fetch(base + '/resvg.wasm')).headers.get('content-type')).toBe('application/wasm');
      expect((await fetch(base + '/fonts/AlegreyaSans-Regular.ttf')).status).toBe(200);
      expect((await fetch(base + '/fonts/../artgen.js')).status).toBeGreaterThanOrEqual(400);
      expect((await fetch(base + '/api/list?dir=')).status).toBe(401);
      expect((await (await fetch(base + '/api/info', { headers: auth })).json() as { modules: string[] }).modules).toEqual(['core', 'art', 'maps', 'ui']);
      expect(await (await fetch(base + '/api/list?dir=', { headers: auth })).json()).toContain('artgen.config.json');
      await fetch(base + '/api/append?path=ledger.jsonl', { method: 'POST', headers: auth, body: '{"type":"note"}\n' });
      expect(readFileSync(join(dir, 'art/ledger.jsonl'), 'utf8')).toBe('{"type":"note"}\n');
    } finally { child.kill('SIGINT'); }
    // without the ui module the command says how to get it
    const bare = repo('ui-missing');
    install(bare, { dist: DIST(), modules: ['art'], ...quiet });
    const x = run(bare, ['tools/artgen/artgen.js', 'ui']);
    expect(x.status).toBe(1);
    expect(x.stderr).toMatch(/install the ui module/);
  });

  test('update-pr: the workflow is installed, kept when edited, and update --notes writes the pull request text', () => {
    const dir = repo('update-pr');
    install(dir, { dist: DIST(), modules: ['art', 'update-pr'], ...quiet });
    const wf = readFileSync(join(dir, '.github/workflows/artgen-update.yml'), 'utf8');
    expect(wf).toMatch(/schedule:/);
    expect(wf).toMatch(/update \$skip --notes/);
    expect(wf).toMatch(/--skip-workflows/);
    expect(wf).toMatch(/gh pr create/);
    // a newer release: one file changed, the workflow edited here
    const next = join(tmp, 'next-pr');
    cpSync(DIST(), next, { recursive: true });
    writeFileSync(join(tmp, 'CHANGELOG.md'), '# artgen changelog\n\n## 9.9.9 — 2030-01-01\n\n- the new thing\n\n## 0.11.0 — 2026-10-25\n\n- the old thing\n');
    writeFileSync(join(next, 'tools/artgen/VERSION'), '9.9.9\n');
    release(next, '9.9.9');
    writeFileSync(join(next, 'claude/skills/artgen/SKILL.md'), readFileSync(join(next, 'claude/skills/artgen/SKILL.md'), 'utf8') + '\nnew\n');
    writeFileSync(join(dir, '.github/workflows/artgen-update.yml'), wf + '# schedule changed here\n');
    const notes = join(tmp, 'notes.md');
    const r = install(dir, { mode: 'update', dist: next, scaffold: false, notes, ...quiet });
    expect(r.kept).toEqual(['.github/workflows/artgen-update.yml']);
    const text = readFileSync(notes, 'utf8');
    expect(text).toMatch(/^artgen \d+\.\d+\.\d+ → 9\.9\.9/);
    expect(text).toMatch(/Modules: .*art \d+\.\d+\.\d+ → 9\.9\.9/);
    expect(text).toMatch(/Kept because they were edited here[\s\S]*\.github\/workflows\/artgen-update\.yml/);
    expect(text).toMatch(/# Changelog\n\n## 9\.9\.9 — 2030-01-01\n\n- the new thing/);
    expect(text).not.toMatch(/the old thing/);
  });

  test('a file that was there before and is not artgen\'s is skipped, never recorded, never overwritten by update and never deleted by remove', () => {
    const own = '# my own map command\n';
    const dir = repo('conflict', { '.claude/commands/artgen-map.md': own });
    const r = install(dir, { dist: DIST(), ...quiet });
    expect(r.conflicts).toEqual(['.claude/commands/artgen-map.md']);
    expect(manifest(dir).files['.claude/commands/artgen-map.md']).toBeUndefined();
    expect(install(dir, { mode: 'update', dist: DIST(), scaffold: false, ...quiet }).conflicts).toEqual(['.claude/commands/artgen-map.md']);
    expect(status(dir, { dist: DIST() }).edited).toEqual([]);
    remove(dir, ['maps'], { dist: DIST(), ...quiet });
    expect(readFileSync(join(dir, '.claude/commands/artgen-map.md'), 'utf8')).toBe(own);
    expect(existsSync(join(dir, '.claude/skills/terrain-map'))).toBe(false);
  });

  test('add works when the manifest names a module this distribution no longer has', () => {
    const dir = repo('retired');
    install(dir, { dist: DIST(), modules: ['maps'], ...quiet });
    const m = manifest(dir);
    m.modules.retired = '1.0.0';
    writeFileSync(join(dir, 'tools/artgen/MANIFEST.json'), JSON.stringify(m));
    const r = install(dir, { mode: 'add', dist: DIST(), modules: ['ui'], scaffold: false, ...quiet });
    expect(Object.keys(r.modules)).toEqual(['core', 'maps', 'ui']);
  });

  test('update --skip-workflows leaves a changed workflow file alone (a token that may not push it); a plain update writes it', () => {
    const dir = repo('skip-wf');
    install(dir, { dist: DIST(), modules: ['art', 'update-pr'], ...quiet });
    const wf = '.github/workflows/artgen-update.yml', before = readFileSync(join(dir, wf), 'utf8'), hash = manifest(dir).files[wf];
    const next = join(tmp, 'next-wf');
    cpSync(DIST(), next, { recursive: true });
    writeFileSync(join(next, 'github/workflows/artgen-update.yml'), before + '# changed in the next release\n');
    writeFileSync(join(next, 'tools/artgen/VERSION'), '9.9.8\n');
    release(next, '9.9.8');
    const skipped = install(dir, { mode: 'update', dist: next, scaffold: false, skipWorkflows: true, ...quiet });
    expect(skipped.kept).toEqual([`${wf} (changed in this release; workflow files need a token that may push them)`]);
    expect(readFileSync(join(dir, wf), 'utf8')).toBe(before);
    expect(manifest(dir).files[wf]).toBe(hash);
    expect(manifest(dir).version).toBe('9.9.8');
    const written = install(dir, { mode: 'update', dist: next, scaffold: false, ...quiet });
    expect(written.written).toEqual([wf]);
    expect(readFileSync(join(dir, wf), 'utf8')).toMatch(/changed in the next release/);
  });

  test('update from before modules: a manifest with no modules counts as core, art and maps', () => {
    const dir = repo('legacy');
    install(dir, { dist: DIST(), ...quiet });
    const f = join(dir, 'tools/artgen/MANIFEST.json'), m = manifest(dir);
    delete m.modules;
    writeFileSync(f, JSON.stringify(m));
    const earlier = `${m.version} (before modules)`;
    expect(status(dir, { dist: DIST() }).modules).toMatchObject({ core: { installed: earlier }, art: { installed: earlier }, maps: { installed: earlier }, ui: { installed: null } });
    const r = install(dir, { mode: 'update', dist: DIST(), scaffold: false, ...quiet });
    expect(Object.keys(r.modules)).toEqual(['core', 'art', 'maps']);
    expect(r.written).toEqual([]);
    expect(manifest(dir).modules.maps).toBe(MAPGEN_VERSION);
  });

  test('update moves the library package URLs in package.json to the release, and only ours', () => {
    const base = 'https://github.com/rstevenson1237/image_tools/releases/download';
    const dir = repo('packages', {
      'package.json': JSON.stringify({ dependencies: {
        'artgen-mapgen': `${base}/artgen-v0.10.0/artgen-mapgen-0.9.0.tgz`, 'artgen-runtime': `${base}/artgen-v0.10.0/artgen-runtime-1.2.0.tgz`,
        other: 'https://github.com/someone/else/releases/download/artgen-v0.10.0/artgen-mapgen-0.9.0.tgz', left: '^1.0.0',
      } }, null, 2),
    });
    install(dir, { dist: DIST(), modules: ['maps'], ...quiet });
    expect(install(dir, { mode: 'update', dist: DIST(), scaffold: false, dryRun: true, ...quiet }).packages).toEqual(['artgen-mapgen', 'artgen-runtime']);
    expect(readFileSync(join(dir, 'package.json'), 'utf8')).toContain('artgen-v0.10.0');   // a dry run changes nothing
    const r = install(dir, { mode: 'update', dist: DIST(), scaffold: false, ...quiet });
    expect(r.packages).toEqual(['artgen-mapgen', 'artgen-runtime']);
    const deps = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).dependencies;
    const pk = JSON.parse(readFileSync(join(DIST(), 'packages.json'), 'utf8'));
    expect(deps['artgen-mapgen']).toBe(`${base}/artgen-v${pk.release}/artgen-mapgen-${MAPGEN_VERSION}.tgz`);
    expect(deps['artgen-runtime']).toBe(`${base}/artgen-v${pk.release}/${pk.packages['artgen-runtime'].file}`);
    expect(deps.other).toContain('someone/else');
    expect(deps.left).toBe('^1.0.0');
    expect(install(dir, { mode: 'update', dist: DIST(), scaffold: false, ...quiet }).packages).toEqual([]);
  });

  test('the installer CLI: init --with, add, remove, modules and status', () => {
    const dir = repo('cli');
    const inst = (...a: string[]) => run(dir, [join(OUT, 'install.mjs'), ...a]);
    expect(inst('modules').stdout).toMatch(/core .*\n.*art .*\(default\).*\n.*maps .*\n.*ui .*needs art or maps\n.*update-pr/);
    const bad = inst('init', '--with', 'ui');
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/needs art or maps/);
    expect(inst('init', '--with', 'maps', '--dry-run').stdout).toMatch(/dry run[\s\S]*modules: core .*, maps /);
    expect(existsSync(join(dir, 'tools'))).toBe(false);
    expect(inst('init', '--with', 'maps').status).toBe(0);
    const add = inst('add', 'update-pr', 'ui');
    expect(add.status, add.stderr).toBe(0);
    const st = inst('status').stdout;
    expect(st).toMatch(/maps\s+\S+\s+available/);
    expect(st).toMatch(/ui\s+\S+\s+available/);
    expect(inst('remove', 'ui,update-pr').status).toBe(0);
    expect(Object.keys(manifest(dir).modules)).toEqual(['core', 'maps']);
    expect(inst('remove').stderr).toMatch(/name the modules/);
    expect(inst('add').stderr).toMatch(/name the modules/);
  });
});
