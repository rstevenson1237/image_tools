// MCP server (SPEC §14): protocol handshake, tool listing, image results, errors as tool results, the art/ sandbox,
// and the stdio framing.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { beforeAll, describe, expect, test } from 'vitest';
import { initProject, writeCandidates } from 'artgen-cli';
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

  test('tools/list names the W1 and pipeline tools with input schemas', async () => {
    const r = (await handle({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, root))!.result as { tools: { name: string; inputSchema: { type: string } }[] };
    expect(r.tools.map(t => t.name)).toEqual(['direction_get', 'direction_tile', 'pass_status', 'render', 'review', 'conformance', 'score']);
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
});
