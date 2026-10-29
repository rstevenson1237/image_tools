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
    expect(r.tools.map(t => t.name)).toEqual(['direction_get', 'direction_tile', 'pass_status', 'render', 'review', 'conformance', 'score', 'finish', 'make', 'brief_lint', 'status',
      'gallery', 'feedback', 'approve', 'texture', 'fx', 'export', 'restyle', 'analytics', 'map_list', 'map_get', 'map_new', 'map_update', 'map_edit', 'map_overlay', 'map_render', 'map_facts', 'map_check',
      'dungeon_list', 'dungeon_get', 'dungeon_new', 'dungeon_update', 'dungeon_generate', 'dungeon_edit', 'dungeon_check', 'dungeon_overlay', 'dungeon_render', 'dungeon_facts',
      'settlement_list', 'settlement_get', 'settlement_new', 'settlement_update', 'settlement_generate', 'settlement_edit', 'settlement_check', 'settlement_facts', 'settlement_render', 'formats']);
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

  test('terrain maps: new, update, edit, overlay, render (image); map ids cannot leave art/maps', async () => {
    expect((await call('map_new', { id: 'isle', preset: 'regional', cols: 12, rows: 10, seed: 4, grid: 'square' })).isError).toBeUndefined();
    await call('map_update', { id: 'isle', gen: { land: 'island', sea: 0.45 }, title: 'Isle' });
    await call('map_edit', { id: 'isle', ops: [{ op: 'paint', terrain: 'forest', shape: { circle: [6, 5, 2] } }, { op: 'road', points: [1, 1, 8, 8] }] });
    expect(JSON.parse((await call('map_edit', { id: 'isle', undo: 1 })).content[0].text!)).toMatchObject({ edits: 1 });
    expect((await call('map_edit', { id: 'isle', ops: [{ op: 'paint', terrain: 'lava', shape: { circle: [1, 1, 1] } }] })).isError).toBe(true);
    await call('map_overlay', { id: 'isle', add_labels: [{ text: 'Port Ash', at: 'C4', kind: 'place' }], add_symbols: [{ kind: 'port', x: 3, y: 3 }, { kind: 'cave', at: '5,5' }] });
    await call('map_overlay', { id: 'isle', remove_symbols: [0] });
    const got = JSON.parse((await call('map_get', { id: 'isle' })).content[1].text!);
    expect(got).toMatchObject({ title: 'Isle', gen: { land: 'island', sea: 0.45 }, edits: [{ op: 'paint' }], overlay: { labels: [{ text: 'Port Ash', x: 2.5, y: 3.5 }], symbols: [{ kind: 'cave' }] } });
    expect(JSON.parse((await call('map_list')).content[0].text!).maps).toEqual([expect.objectContaining({ id: 'isle' })]);
    const r = await call('map_render', { id: 'isle', theme: 'both' });
    expect(r.content.map(c => c.type)).toEqual(['text', 'image', 'image']);
    expect(JSON.parse(r.content[0].text!).files).toEqual(['art/maps/isle/out/isle.color.svg', 'art/maps/isle/out/isle.color.png', 'art/maps/isle/out/isle.bw.svg', 'art/maps/isle/out/isle.bw.png']);
    expect(existsSync(join(root, 'art/maps/isle/out/isle.bw.png'))).toBe(true);
    expect((await call('map_new', { id: '../../etc' })).isError).toBe(true);
    expect((await call('map_get', { id: '../isle' })).isError).toBe(true);
  }, 60_000);

  test('dungeons: one room, edit, overlay, generate, render (image); ids cannot leave art/dungeons', async () => {
    expect((await call('dungeon_new', { id: 'cell', mode: 'room', shape: 'rect', w: 6, h: 6, number: 20, exits: [{ side: 'n' }, { side: 'e', door: 'secret' }] })).isError).toBeUndefined();
    expect(JSON.parse((await call('dungeon_get', { id: 'cell' })).content[1].text!)).toMatchObject({ cols: 12, rows: 12, rooms: [{ id: 'r1', number: 20 }], corridors: [{ doors: ['door', null] }, { doors: ['secret', null] }] });
    await call('dungeon_new', { id: 'crypt', mode: 'empty', cols: 30, rows: 20 });
    await call('dungeon_edit', { id: 'crypt', ops: [
      { op: 'add_room', shape: 'rect', at: '3,3', w: 6, h: 4, label: 'Hall' },
      { op: 'add_room', shape: 'cave', at: [16, 4], w: 8, h: 6 },
      { op: 'link', from: 'r1', to: 'r2', doors: ['door', null] },
      { op: 'link', from: 'r2', to: [29, 15] },
      { op: 'door', index: 1, end: 'from', kind: 'portcullis' },
      { op: 'fit', margin: 2 },
    ] });
    expect((await call('dungeon_edit', { id: 'crypt', ops: [{ op: 'move_room', room: 'nope', at: '1,1' }] })).isError).toBe(true);
    await call('dungeon_update', { id: 'crypt', grid_mode: '10+5', style: { hatch: 'full' }, title: 'Crypt' });
    await call('dungeon_overlay', { id: 'crypt', add_labels: [{ text: 'Bones', at: 'C4', kind: 'note' }], add_symbols: [{ kind: 'stairs', x: 4, y: 4, angle: 90 }, { kind: 'pillar', at: '5,5' }] });
    await call('dungeon_overlay', { id: 'crypt', remove_symbols: [1] });
    expect((await call('dungeon_overlay', { id: 'crypt', add_symbols: [{ kind: 'dragon', x: 1, y: 1 }] })).isError).toBe(true);
    const got = JSON.parse((await call('dungeon_get', { id: 'crypt' })).content[1].text!);
    expect(got).toMatchObject({ title: 'Crypt', grid: { show: true, size: 2, sub: true }, style: { hatch: 'full' }, rooms: [{ id: 'r1', x: 2, y: 2, label: 'Hall' }, { id: 'r2', shape: 'cave' }], corridors: [{ doors: ['door', null] }, { doors: ['portcullis', null] }], overlay: { labels: [{ text: 'Bones', x: 2.5, y: 3.5 }], symbols: [{ kind: 'stairs', angle: 90 }] } });
    await call('dungeon_edit', { id: 'crypt', ops: [{ op: 'add_block', shape: 'hex', at: [3, 12], w: 12, h: 8, split: 'grid', min: 4, id: 'hx' }, { op: 'split_block', id: 'hx', seed: 4 }] });
    const blk = JSON.parse((await call('dungeon_get', { id: 'crypt' })).content[1].text!);
    expect(blk.blocks).toEqual([expect.objectContaining({ id: 'hx', shape: 'poly', split: { mode: 'grid', min: 4, seed: 4 } })]);
    expect(blk.rooms.filter((r: { origin?: string }) => r.origin === 'block:hx').length).toBeGreaterThan(1);
    await call('dungeon_edit', { id: 'crypt', ops: [{ op: 'remove_block', id: 'hx' }] });
    expect(JSON.parse((await call('dungeon_get', { id: 'crypt' })).content[1].text!).blocks).toBeUndefined();
    const chk = JSON.parse((await call('dungeon_check', { id: 'crypt' })).content[0].text!);
    expect(chk).toMatchObject({ ok: true, errors: [] });
    expect(chk.warnings).toEqual(expect.any(Array));
    await call('dungeon_update', { id: 'crypt', grid_size: 15, sub_grid: false });
    expect(JSON.parse((await call('dungeon_get', { id: 'crypt' })).content[1].text!).grid).toMatchObject({ show: true, size: 3, sub: false });
    expect((await call('dungeon_update', { id: 'crypt', grid_size: 12 })).isError).toBe(true);
    await call('dungeon_generate', { id: 'crypt', seed: 3, gen: { rooms: 5 }, cols: 30, rows: 24 });
    expect(JSON.parse((await call('dungeon_get', { id: 'crypt' })).content[1].text!).overlay.labels).toHaveLength(1);
    expect(JSON.parse((await call('dungeon_list')).content[0].text!).dungeons.map((d: { id: string }) => d.id).sort()).toEqual(['cell', 'crypt']);
    const r = await call('dungeon_render', { id: 'crypt' });
    expect(r.content.map(c => c.type)).toEqual(['text', 'image']);
    expect(JSON.parse(r.content[0].text!).files).toEqual(['art/dungeons/crypt/out/crypt.svg', 'art/dungeons/crypt/out/crypt.png']);
    expect((await call('dungeon_new', { id: '../../etc' })).isError).toBe(true);
    expect((await call('dungeon_get', { id: '../crypt' })).isError).toBe(true);
  }, 60_000);

  test('settlements: generate, edit by hand, a floor plan, check, facts and render (image); ids cannot leave art/settlements', async () => {
    expect((await call('settlement_new', { id: 'mill', kind: 'hamlet', seed: 4 })).isError).toBeUndefined();
    const hamlet = JSON.parse((await call('settlement_get', { id: 'mill' })).content[1].text!);
    expect(hamlet).toMatchObject({ kind: 'hamlet', seed: 4 });
    expect(hamlet.buildings.length).toBeGreaterThan(2);
    await call('settlement_new', { id: 'ford', mode: 'empty', cols: 30, rows: 24 });
    const edit = await call('settlement_edit', { id: 'ford', ops: [
      { op: 'road.add', kind: 'lane', points: [0, 12, 30, 12] },
      { op: 'building.add', kind: 'smithy', x: 4, y: 4, w: 6, h: 5, id: 'smith' },
      { op: 'interior', id: 'smith' },
      { op: 'wall.add', kind: 'fence', points: [2, 2, 12, 2, 12, 10] },
      { op: 'tree.add', kind: 'tree', x: 20, y: 4 },
      { op: 'prop.add', kind: 'well', x: 16, y: 16 },
      { op: 'label', text: 'Ford', x: 15, y: 20, kind: 'area' },
    ] });
    expect(edit.isError).toBeUndefined();
    expect(edit.content[0].text).toMatch(/laid out smith/);
    expect((await call('settlement_edit', { id: 'ford', ops: [{ op: 'building.move', id: 'nope', x: 1, y: 1 }] })).isError).toBe(true);
    await call('settlement_update', { id: 'ford', title: 'The Ford', legend: true });
    const got = JSON.parse((await call('settlement_get', { id: 'ford' })).content[1].text!);
    expect(got).toMatchObject({ title: 'The Ford', legend: true, roads: [{ kind: 'lane' }], buildings: [{ id: 'smith', kind: 'smithy' }], trees: [{ kind: 'tree' }], props: [{ kind: 'well' }] });
    expect(got.buildings[0].floors[0].fixtures.some((f: { kind: string }) => f.kind === 'forge')).toBe(true);
    expect(JSON.parse((await call('settlement_check', { id: 'ford' })).content[0].text!)).toMatchObject({ ok: true, errors: [] });
    expect(JSON.parse((await call('settlement_facts', { id: 'ford' })).content[0].text!).counts.buildings).toEqual({ smithy: 1 });
    const plan = await call('settlement_render', { id: 'ford', building: 'smith' });
    expect(plan.content.map(c => c.type)).toEqual(['text', 'image']);
    expect(JSON.parse(plan.content[0].text!).files).toEqual(['art/settlements/ford/out/ford.smith.f0.color.svg', 'art/settlements/ford/out/ford.smith.f0.color.png']);
    const site = await call('settlement_render', { id: 'ford', theme: 'both' });
    expect(site.content.map(c => c.type)).toEqual(['text', 'image', 'image']);
    await call('settlement_generate', { id: 'mill', seed: 9, gen: { interiors: true } });
    expect(JSON.parse((await call('settlement_get', { id: 'mill' })).content[1].text!).buildings.every((b: { floors?: unknown[] }) => b.floors?.length)).toBe(true);
    expect(JSON.parse((await call('settlement_list')).content[0].text!).settlements.map((d: { id: string }) => d.id).sort()).toEqual(['ford', 'mill']);
    expect((await call('settlement_new', { id: '../../etc' })).isError).toBe(true);
    expect((await call('settlement_get', { id: '../ford' })).isError).toBe(true);
  }, 60_000);
});
