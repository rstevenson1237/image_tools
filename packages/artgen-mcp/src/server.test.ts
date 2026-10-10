// MCP server (SPEC §14): protocol handshake, tool listing, image results, errors as tool results, the art/ sandbox,
// and the stdio framing.
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { beforeAll, describe, expect, test } from 'vitest';
import { addBrief, BENCH_ROOT, initProject, lock, writeCandidates } from 'artgen-cli';
import { assetPath, handle, serve, type RpcMessage } from './index.ts';

const root = mkdtempSync(join(tmpdir(), 'artgen-mcp-'));
let id = 0;
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }, root))!.result as { content: { type: string; text?: string; data?: string }[]; isError?: boolean };

beforeAll(() => {
  const { project } = initProject(root);
  writeCandidates(project, { pitch: 'iso dungeon crawler with skeleton knights', view: 'iso' });
});

describe('artgen MCP server', () => {
  test('initialize negotiates the protocol; notifications get no answer; unknown methods error', async () => {
    const r = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, root);
    expect(r!.result).toMatchObject({ protocolVersion: '2025-03-26', serverInfo: { name: 'artgen' }, capabilities: { tools: {} } });
    expect((await handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, root))!.result).toMatchObject({ protocolVersion: '2025-06-18' });
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, root)).toBeNull();
    expect((await handle({ jsonrpc: '2.0', id: 3, method: 'nope' }, root))!.error).toMatchObject({ code: -32601 });
  });

  test('tools/list names the full tool set (SPEC §14) with input schemas', async () => {
    const r = (await handle({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, root))!.result as { tools: { name: string; inputSchema: { type: string } }[] };
    expect(r.tools.map(t => t.name)).toEqual(['direction_get', 'direction_tile', 'pass_status', 'render', 'review', 'conformance', 'score', 'finish', 'make', 'status',
      'gallery', 'feedback', 'approve', 'texture', 'fx', 'export', 'restyle', 'analytics']);
    expect(r.tools.every(t => t.inputSchema.type === 'object')).toBe(true);
  });

  test('direction_get, direction_tile (image), render (image) with --direction for an unlocked project', async () => {
    expect(JSON.parse((await call('direction_get')).content[0].text!)).toMatchObject({ locked: null, candidates: ['a', 'b', 'c'] });
    const tile = await call('direction_tile', { candidates: ['a', 'b'] });
    expect(tile.content.map(c => c.type)).toEqual(['text', 'image']);
    expect(Buffer.from(tile.content[1].data!, 'base64').subarray(1, 4).toString()).toBe('PNG');
    const r = await call('render', { asset: 'art/probes/prop', direction: 'art/candidates/a.json' });
    expect(r.isError).toBeUndefined();
    expect(JSON.parse(r.content[0].text!)).toMatchObject({ version: 'base.v1', pass: true });
    expect(r.content[1].type).toBe('image');
  });

  test('errors come back as tool results; paths outside art/ are refused', async () => {
    const r = await call('pass_status', { asset: 'art/probes/prop' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/not locked yet/);
    expect((await call('render', { asset: '../../etc' })).content[0].text).toMatch(/outside art\//);
    expect(() => assetPath({ root, art: join(root, 'art') }, 'probes/tile')).not.toThrow();
    expect((await handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'x' } }, root))!.error).toMatchObject({ code: -32602 });
  });

  test('stdio framing: newline-delimited requests answered in order, parse errors reported', async () => {
    const input = new PassThrough(), output = new PassThrough(), lines: RpcMessage[] = [];
    output.on('data', (b: Buffer) => b.toString().split('\n').filter(Boolean).forEach(l => lines.push(JSON.parse(l))));
    const done = serve(input, output, root);
    input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"method":"tools/li');
    input.write('st"}\nnot json\n');
    input.end();
    await done;
    expect(lines.map(l => l.id)).toEqual([1, 2, null]);
    expect(lines[2].error).toMatchObject({ code: -32700 });
  });

  test('a benchmark asset renders and reviews under the benchmark direction (P7 acceptance, in-process)', async () => {
    // the bench layout: the asset's brief points at ../../reference/hero.png (artlab's final, shown on the sheet)
    cpSync(join(BENCH_ROOT, 'pipeline', 'hero'), join(root, 'art', 'assets', 'character', 'hero'), { recursive: true, filter: f => !f.includes('/out') });
    cpSync(join(BENCH_ROOT, 'reference', 'hero.png'), join(root, 'art', 'assets', 'reference', 'hero.png'));
    // a bare name finds art/assets/<kind>/<name> (no brief needed)
    const r = await call('render', { asset: 'hero', version: 'finish.v1', direction: 'benchmark' });
    expect(r.isError, r.content[0].text).toBeUndefined();
    expect(JSON.parse(r.content[0].text!)).toMatchObject({ version: 'finish.v1', pass: true });
    const rv = await call('review', { asset: 'assets/character/hero', version: 'finish.v1', direction: 'benchmark' });
    expect(rv.content.map(c => c.type), rv.content[0].text).toEqual(['text', 'image']);
    expect(JSON.parse(rv.content[0].text!).sheet).toBe('art/assets/character/hero/out/review-finish.v1.png');
  });

  test('quick looks: texture and fx write under art/sheets and return images; list modes', async () => {
    expect(JSON.parse((await call('texture', { list: true })).content[0].text!)).toContain('stone');
    const t = await call('texture', { material: 'stone', size: 16, direction: 'art/candidates/a.json' });
    expect(t.isError, t.content[0].text).toBeUndefined();
    expect(t.content.map(c => c.type)).toEqual(['text', 'image', 'image']);
    expect(JSON.parse(t.content[0].text!).files).toEqual(['art/sheets/textures/stone.png', 'art/sheets/textures/stone.n.png', 'art/sheets/textures/stone-3x3@4x.png']);
    expect(JSON.parse((await call('fx', { list: true })).content[0].text!).length).toBe(11);
    const f = await call('fx', { preset: 'sparks', size: 16, frames: 4, direction: 'art/candidates/a.json' });
    expect(f.isError, f.content[0].text).toBeUndefined();
    expect(existsSync(join(root, 'art/sheets/fx/sparks.gif'))).toBe(true);
    expect((await call('texture', { material: 'stone' })).content[0].text).toMatch(/no locked direction/);
  });
});

describe('artgen MCP server on a locked project (W2 tools)', () => {
  const proj = mkdtempSync(join(tmpdir(), 'artgen-mcp-w2-'));
  const call2 = async (name: string, args: Record<string, unknown> = {}) =>
    (await handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }, proj))!.result as { content: { type: string; text?: string }[]; isError?: boolean };

  beforeAll(async () => {
    const { project } = initProject(proj);
    writeCandidates(project, { pitch: 'grim swamp roguelike with bog goblins', view: 'topdown' });
    await lock(project, 'a');
    for (const id of ['goblin', 'crate', 'reed']) addBrief(project, { id, kind: id === 'goblin' ? 'character' : 'prop' });
  }, 60_000);

  test('make with parallel: one maker packet per asset, capped, the rest queued', async () => {
    const r = await call2('make', { parallel: 2 });
    expect(r.isError, r.content[0].text).toBeUndefined();
    const m = JSON.parse(r.content[0].text!);
    expect(m.scaffolded).toHaveLength(3);
    expect(m.work.makers.map((x: { id: string }) => x.id)).toEqual(['goblin', 'crate']);
    expect(m.work.makers[0]).toMatchObject({ role: 'maker', owns: 'art/assets/character/goblin', writes: ['art/assets/character/goblin/base.v1.js'] });
    expect(m.work.queued.map((x: { id: string }) => x.id)).toEqual(['reed']);
    expect(m.work.main).toEqual([]);
  });

  test('brief ids resolve inside art/; finish writes the next finish file; approve needs the user', async () => {
    expect(assetPath({ root: proj, art: join(proj, 'art') }, 'crate')).toBe(join(proj, 'art/assets/prop/crate'));
    const f = await call2('finish', { asset: 'crate' });
    expect(JSON.parse(f.content[0].text!)).toEqual({ file: 'art/assets/prop/crate/finish.v1.js', base: 'base.v1' });
    expect(readFileSync(join(proj, 'art/assets/prop/crate/finish.v1.js'), 'utf8')).toMatch(/base = 'base\.v1'/);
    const a = await call2('approve', { id: 'crate', user_approved: false });
    expect(a.isError).toBe(true);
    expect(a.content[0].text).toMatch(/only the user approves/);
    expect((await call2('approve', { id: 'crate', user_approved: true })).content[0].text).toMatch(/crate is in-pipeline/);
  });

  test('feedback on an unfinished asset is refused; analytics and gallery answer on an empty pipeline', async () => {
    expect((await call2('feedback', { id: 'goblin', route: 'base', note: 'bigger ears' })).content[0].text).toMatch(/feedback applies to finished assets/);
    expect((await call2('analytics')).content[0].text).toMatch(/pipeline analytics/);
    expect((await call2('gallery')).content[0].text).toMatch(/no finished assets/);
    expect(JSON.parse((await call2('export', { include_drafts: true })).content[0].text!).packs).toEqual([]);
  });
});
