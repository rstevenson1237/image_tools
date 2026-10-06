// Install smoke test (SPEC §15, PLAN P2): build the distribution, install it into a scratch game repo, and run the
// CLI and MCP server from the committed files only (a session-equivalent run: no npm, no repo packages). Then
// `update`: version change shown, untouched files replaced, local edits kept unless --force, dropped files removed.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildDist } from '../build.mjs';
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
      'dist/claude/skills/artgen/SKILL.md', 'dist/claude/skills/art-direction/SKILL.md', 'dist/claude/agents/art-reviewer.md',
      'dist/claude/commands/artgen-init.md', 'dist/claude/commands/artgen-direction.md', 'dist/claude/skills/asset-production/SKILL.md',
      ...['brief', 'make', 'review', 'feedback', 'approve', 'export', 'restyle'].map(c => `dist/claude/commands/artgen-${c}.md`),
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

  test('session-equivalent W2 run from the committed files: brief → make → review/score → status → export (drafts)', () => {
    const cli = (...a: string[]) => { const r = node(['tools/artgen/artgen.js', ...a]); expect(r.status, r.stderr + r.stdout).toBe(0); return r.stdout; };
    cli('brief', 'add', 'wisp', '--kind', 'effect', '--anims', 'idle:4');
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
    expect(rt).toMatchObject({ dir: 'src/art/runtime', version: '1.0.0', adapters: ['canvas2d'] });
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
    expect(out[1].result.tools.length).toBeGreaterThanOrEqual(8);
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
