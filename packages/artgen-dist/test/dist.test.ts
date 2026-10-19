// Install smoke test (SPEC §15, PLAN P2): build the distribution, install it into a scratch game repo, and run the
// CLI and MCP server from the committed files only (a session-equivalent run: no npm, no repo packages). Then
// `update`: version change shown, untouched files replaced, local edits kept unless --force, dropped files removed.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { buildDist, sourceSha } from '../build.mjs';
import { install, status } from '../src/install.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'artgen-dist-')), OUT = join(tmp, 'out'), GAME = join(tmp, 'game');
const node = (args: string[], input?: string) => spawnSync(process.execPath, args, { cwd: GAME, encoding: 'utf8', input, env: { ...process.env, NODE_PATH: '' } });
const quiet = { log: () => {} };

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
    for (const f of ['package.json', 'install.mjs', 'README.md', 'dist/claude-md.md', 'dist/tools/artgen/artgen.js', 'dist/tools/artgen/artgen-mcp.js',
      'dist/tools/artgen/resvg.wasm', 'dist/tools/artgen/VERSION', 'dist/tools/artgen/templates/topdown/character/base.js',
      'dist/claude/skills/artgen/SKILL.md', 'dist/claude/skills/art-direction/SKILL.md', 'dist/claude/agents/art-reviewer.md', 'dist/claude/agents/art-maker.md',
      'dist/claude/commands/artgen-init.md', 'dist/claude/commands/artgen-direction.md', 'dist/claude/skills/asset-production/SKILL.md',
      ...['brief', 'make', 'review', 'feedback', 'approve', 'export', 'restyle', 'map', 'dungeon'].map(c => `dist/claude/commands/artgen-${c}.md`),
      'dist/claude/skills/terrain-map/SKILL.md', 'plugin/skills/terrain-map/SKILL.md', 'plugin/commands/map.md',
      'dist/claude/skills/dungeon-map/SKILL.md', 'plugin/skills/dungeon-map/SKILL.md', 'plugin/commands/dungeon.md',
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

  test('init: files, .mcp.json merge, CLAUDE.md section, art/ scaffold, manifest', () => {
    const r = install(GAME, { dist: join(OUT, 'dist'), ...quiet });
    expect(r.from).toBeNull();
    expect(r.conflicts).toEqual([]);
    expect(JSON.parse(readFileSync(join(GAME, '.mcp.json'), 'utf8')).mcpServers).toEqual({ other: { command: 'x' }, artgen: { command: 'node', args: ['tools/artgen/artgen-mcp.js'] } });
    const md = readFileSync(join(GAME, 'CLAUDE.md'), 'utf8');
    expect(md.startsWith('# Swamp game\n\nGame rules here.\n\n<!-- artgen:begin')).toBe(true);
    expect(md).toMatch(/\/artgen-direction/);
    expect(existsSync(join(GAME, 'art', 'artgen.config.json'))).toBe(true);
    expect(JSON.parse(readFileSync(join(GAME, 'tools/artgen/MANIFEST.json'), 'utf8')).version).toBe(readFileSync(join(OUT, 'dist/tools/artgen/VERSION'), 'utf8').trim());
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
    expect(out[1].result.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['make', 'approve', 'texture', 'fx', 'export', 'analytics', 'map_render', 'dungeon_render']));
    expect(out[2].result.content.map((c: { type: string }) => c.type)).toEqual(['text', 'image']);
  });

  test('update: version change, local edits kept unless --force, dropped files removed', () => {
    // a newer distribution: one changed skill, one dropped command, a bumped version
    const next = join(tmp, 'next');
    cpSync(join(OUT, 'dist'), next, { recursive: true });
    writeFileSync(join(next, 'tools/artgen/VERSION'), '9.9.9\n');
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
    cpSync(join(FIX, 'ravine', 'map.json'), join(consumer, 'ravine.json'));
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
    expect(JSON.parse(ok('formats', '--json'))).toEqual({ map: 1, dungeon: 1 });
  });

  test('check, fit and an SVG render of the fixtures from an empty folder, with no resvg.wasm and no fonts', () => {
    for (const c of ['warren', 'keep', 'shrine-crypts']) {
      expect(JSON.parse(ok('dungeon', 'check', '--file', `${c}.json`, '--json'))).toMatchObject({ ok: true, errors: [] });
      ok('dungeon', 'fit', '--file', `${c}.json`);
      ok('dungeon', 'render', '--file', `${c}.json`, '--format', 'svg');
      expect(readFileSync(join(consumer, `${c}.svg`), 'utf8')).toContain('<svg');
    }
    ok('map', 'render', '--file', 'ravine.json', '--format', 'svg', '--theme', 'color');
    expect(readFileSync(join(consumer, 'ravine.color.svg'), 'utf8')).toContain('<svg');
    expect(existsSync(join(consumer, 'art'))).toBe(false);
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
    expect(r.stderr).toMatch(/map, dungeon and formats/);
  });
});
