// MCP transcript (R2 step 1): one call of each of R1's tools on a temp project (a copy of examples/iso-dungeon/art), with
// the content types, the text and, for an image, its size and a hash of its bytes, compared to
// __golden__/mcp-transcript.txt. It froze the tools' behaviour before the operation registry generated them; the refactor
// only adds entries. UPDATE_GOLDEN=1 rewrites the file (R2's own commits never do). The second test checks the schemas
// against tools-r1.json: every R1 tool is still there with at least its arguments and the same required list.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { handle } from './index.ts';

const GOLDEN = new URL('./__golden__/mcp-transcript.txt', import.meta.url).pathname;
const EXAMPLE = new URL('../../../examples/iso-dungeon/art', import.meta.url).pathname;
let root = '';
let id = 0;

type Item = { type: string; text?: string; data?: string; mimeType?: string };
const norm = (s: string) => s.split(root).join('<root>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<ts>').replace(/"wallMs": \d+/g, '"wallMs": <ms>');

/** One tools/call, as lines: what was asked, then each content item (an image as its size and a hash of its bytes). */
async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const r = (await handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }, root))!.result as { content: Item[]; isError?: boolean };
  const lines = [`### ${name} ${norm(JSON.stringify(args))}${r.isError ? ' (isError)' : ''}`];
  for (const c of r.content) {
    if (c.type === 'text') lines.push(`text: ${norm(c.text!)}`);
    else {
      const png = Buffer.from(c.data!, 'base64');
      lines.push(`${c.type} ${c.mimeType}: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)} sha256:${createHash('sha256').update(png).digest('hex').slice(0, 16)}`);
    }
  }
  return lines.join('\n') + '\n';
}

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'artgen-mcp-transcript-')));
  cpSync(EXAMPLE, join(root, 'art'), { recursive: true });
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

test('MCP transcript', async () => {
  const out: string[] = [];
  const c = async (name: string, args: Record<string, unknown> = {}) => { out.push(await call(name, args)); };

  // ---- pixel-art tools, on the locked example project
  await c('direction_get');
  await c('direction_get', { candidate: 'a' });
  await c('pass_status', { asset: 'barrel' });
  await c('render', { asset: 'barrel' });
  await c('render', { asset: 'barrel', version: 'base.v1', scale: 2 });
  await c('review', { asset: 'barrel', detail: 'low' });
  await c('conformance', { asset: 'barrel' });
  await c('brief_lint');
  await c('status');
  await c('status', { ids: ['hero', 'barrel'] });
  await c('gallery');
  await c('texture', { list: true });
  await c('texture', { material: 'stone', size: 16, seed: 3 });
  await c('fx', { list: true });
  await c('fx', { preset: 'sparks', size: 16, frames: 4, seed: 3 });
  await c('analytics');
  await c('direction_tile', { candidates: ['a', 'b'] });
  await c('make', { ids: ['barrel'] });
  await c('finish', { asset: 'barrel' });
  await c('score', { asset: 'barrel', version: 'finish.v2', score: 6.5, note: 'transcript', reviewer: 'transcript' });
  await c('feedback', { id: 'hero', route: 'finish', note: 'a pixel off' });
  await c('approve', { id: 'barrel', user_approved: false });
  await c('approve', { id: 'barrel', user_approved: true, note: 'transcript' });
  await c('export', { include_drafts: true });
  await c('restyle');
  await c('pass_status', { asset: '../../etc' });
  await c('render', { asset: 'nope' });

  // ---- terrain maps
  await c('map_list');
  await c('map_new', { id: 'isle', preset: 'regional', cols: 14, rows: 10, seed: 4, grid: 'square', title: 'Isle' });
  await c('map_new', { id: 'bluff', preset: 'local', cols: 12, rows: 10, seed: 5 });
  await c('map_new', { id: 'isle' });
  await c('map_new', { id: '../../etc' });
  await c('map_update', { id: 'isle', seed: 6, gen: { land: 'island', sea: 0.4 }, topo: { interval: 100 }, grid: { coords: true }, scale: { perCell: 10, unit: 'yd' }, title: 'Isle 2', legend: false, scale_bar: true, compass: false });
  await c('map_edit', { id: 'isle', ops: [{ op: 'paint', terrain: 'forest', shape: { circle: [6, 5, 2] } }, { op: 'road', points: [1, 1, 8, 8] }, { op: 'elevate', amount: 0.3, shape: { poly: [2, 2, 6, 2, 6, 6] } }, { op: 'river', points: [1, 1, 8, 9], width: 1, delta: false }] });
  await c('map_edit', { id: 'isle', undo: 1 });
  await c('map_edit', { id: 'isle', undo: 99 });
  await c('map_edit', { id: 'isle', ops: [{ op: 'paint', terrain: 'lava', shape: { circle: [1, 1, 1] } }] });
  await c('map_overlay', { id: 'isle', add_labels: [{ text: 'Port Ash', at: 'C4', kind: 'place', size: 1.2, angle: 10, href: 'http://example.com/ash' }, { text: 'The Deep', x: 2, y: 2, kind: 'water' }], add_symbols: [{ kind: 'port', x: 3, y: 3, scale: 1.5 }, { kind: 'cave', at: '5,5' }] });
  await c('map_overlay', { id: 'isle', remove_symbols: [0], remove_labels: [1] });
  await c('map_overlay', { id: 'isle', add_symbols: [{ kind: 'dragon', x: 1, y: 1 }] });
  await c('map_overlay', { id: 'isle', remove_labels: [9] });
  await c('map_overlay', { id: 'isle', clear: 'all' });
  await c('map_overlay', { id: 'isle', add_labels: [{ text: 'Port Ash', at: 'C4' }] });
  await c('map_get', { id: 'isle' });
  await c('map_get', { id: '../isle' });
  await c('map_get', { id: 'nope' });
  await c('map_render', { id: 'isle', theme: 'both', layers: { grid: false } });
  await c('map_render', { id: 'isle', ppu: 6 });
  await c('map_render', { id: 'bluff', theme: 'bw', ppu: 5 });
  await c('map_list');

  // ---- dungeons
  await c('dungeon_list');
  await c('dungeon_new', { id: 'cell', mode: 'room', shape: 'rect', w: 6, h: 6, number: 20, label: 'Cell', seed: 3, exits: [{ side: 'n' }, { side: 'e', door: 'secret' }, { side: 's', door: null, text: 'To the caves' }] });
  await c('dungeon_new', { id: 'crypt', mode: 'empty', cols: 30, rows: 20, seed: 7, title: 'Crypt' });
  await c('dungeon_new', { id: 'vault', cols: 40, rows: 30, seed: 11, gen: { rooms: 6, layout: 'dense', density: 0.6 } });
  await c('dungeon_new', { id: 'vault' });
  await c('dungeon_new', { id: '../../etc' });
  await c('dungeon_edit', { id: 'crypt', ops: [
    { op: 'add_room', shape: 'rect', at: '3,3', w: 6, h: 4, label: 'Hall', number: 1, href: 'http://example.com/hall' },
    { op: 'add_room', shape: 'cave', at: [16, 4], w: 8, h: 6, number: false },
    { op: 'add_room', shape: 'poly', points: [3, 12, 9, 12, 6, 17], id: 'tri' },
    { op: 'set_room', room: 'r1', label: 'Great Hall', w: 7, number: 2, href: '' },
    { op: 'move_room', room: 'tri', at: 'C9' },
    { op: 'link', from: 'r1', to: 'r2', doors: ['door', null], route: 'hv', width: 2 },
    { op: 'link', from: 'r2', to: [29, 15], exit: { text: 'To the caves', fade: 3 }, id: 'out1', curve: 'smooth', style: 'natural', seed: 3 },
    { op: 'link', from: 'r1', to: 'corridor:out1', from_side: 'e', from_offset: 1 },
    { op: 'door', index: 1, end: 'from', kind: 'portcullis' },
    { op: 'unlink', index: 2 },
    { op: 'remove_room', room: 'tri' },
    { op: 'fit', margin: 2 },
  ] });
  await c('dungeon_edit', { id: 'crypt', ops: [{ op: 'add_block', shape: 'hex', at: [3, 12], w: 12, h: 8, split: 'grid', min: 4, id: 'hx', doors: 0.25 }, { op: 'split_block', id: 'hx', seed: 4 }] });
  await c('dungeon_edit', { id: 'crypt', ops: [{ op: 'connect', a: 'hx-2', b: 'hx-1', kind: 'arch' }, { op: 'disconnect', index: 0 }] });
  await c('dungeon_edit', { id: 'crypt', ops: [{ op: 'remove_block', id: 'hx' }] });
  await c('dungeon_edit', { id: 'crypt', ops: [{ op: 'move_room', room: 'nope', at: '1,1' }] });
  await c('dungeon_edit', { id: 'crypt', ops: [{ op: 'sing' }] });
  await c('dungeon_update', { id: 'crypt', grid_mode: '10+5', style: { hatch: 'full' }, title: 'The Crypt', numbers: true, scale_bar: true, compass: false, furniture: { place: 'outside', side: 'right' } });
  await c('dungeon_update', { id: 'crypt', grid_size: 15, sub_grid: false, grid_unit: 'ft', show_grid: true });
  await c('dungeon_update', { id: 'crypt', grid_size: 12 });
  await c('dungeon_overlay', { id: 'crypt', add_labels: [{ text: 'Bones', at: 'C4', kind: 'note', size: 1.2, angle: 10, href: '#bones' }], add_symbols: [{ kind: 'stairs', x: 4, y: 4, angle: 90 }, { kind: 'pillar', at: '5,5', scale: 1.5 }] });
  await c('dungeon_overlay', { id: 'crypt', remove_symbols: [1] });
  await c('dungeon_overlay', { id: 'crypt', add_symbols: [{ kind: 'dragon', x: 1, y: 1 }] });
  await c('dungeon_overlay', { id: 'crypt', clear: 'labels' });
  await c('dungeon_generate', { id: 'vault', seed: 3, gen: { rooms: 5 }, cols: 30, rows: 24 });
  await c('dungeon_check', { id: 'crypt' });
  await c('dungeon_check', { id: 'vault' });
  await c('dungeon_get', { id: 'crypt' });
  await c('dungeon_get', { id: '../crypt' });
  await c('dungeon_render', { id: 'crypt' });
  await c('dungeon_render', { id: 'cell', ppu: 6, layers: { grid: false } });
  await c('dungeon_list');

  // ---- settlements
  await c('settlement_list');
  await c('settlement_new', { id: 'mill', kind: 'hamlet', seed: 4 });
  await c('settlement_new', { id: 'ford', mode: 'empty', cols: 30, rows: 24, seed: 2, title: 'The Ford' });
  await c('settlement_new', { id: 'onmap', kind: 'village', seed: 3, cols: 40, rows: 30, map: 'isle', at: [2, 2], gen: { buildings: 8 } });
  await c('settlement_new', { id: 'ford' });
  await c('settlement_new', { id: '../../etc' });
  await c('settlement_edit', { id: 'ford', ops: [
    { op: 'road.add', kind: 'lane', points: [0, 12, 30, 12], width: 2, curve: 'smooth', label: 'Mill Lane' },
    { op: 'building.add', kind: 'smithy', x: 4, y: 4, w: 6, h: 5, id: 'smith', shape: 'L', wing: [3, 2], roof: 'gable', stories: 2, label: 'Smithy' },
    { op: 'interior', id: 'smith', seed: 3 },
    { op: 'wall.add', kind: 'fence', points: [2, 2, 12, 2, 12, 10] },
    { op: 'tree.add', kind: 'tree', x: 20, y: 4 },
    { op: 'prop.add', kind: 'well', x: 16, y: 16 },
    { op: 'water.add', kind: 'river', points: [0, 20, 30, 20], width: 3 },
    { op: 'area.add', kind: 'field', points: [20, 12, 28, 12, 28, 18, 20, 18] },
    { op: 'label', text: 'Ford', x: 15, y: 20, kind: 'area' },
    { op: 'symbol', kind: 'well', x: 10, y: 10 },
  ] });
  await c('settlement_edit', { id: 'ford', ops: [{ op: 'building.move', id: 'nope', x: 1, y: 1 }] });
  await c('settlement_update', { id: 'ford', title: 'Ford Town', ground: 'sand', legend: true, numbers: true, scale_bar: true, compass: false, grid_size: 10, plan_cell: 5, furniture: { place: 'outside' }, scale: { unit: 'ft' } });
  await c('settlement_update', { id: 'ford', underlay: null });
  await c('settlement_generate', { id: 'mill', seed: 9, kind: 'village', gen: { interiors: true }, cols: 50, rows: 40 });
  await c('settlement_check', { id: 'ford' });
  await c('settlement_facts', { id: 'ford' });
  await c('settlement_get', { id: 'ford' });
  await c('settlement_get', { id: 'ford', file: false });
  await c('settlement_get', { id: '../ford' });
  await c('settlement_render', { id: 'ford', building: 'smith' });
  await c('settlement_render', { id: 'ford', theme: 'both', buildings: 'outline' });
  await c('settlement_render', { id: 'ford', ppu: 6 });
  await c('settlement_render', { id: 'mill', plans: true, ppu: 4 });
  await c('settlement_list');

  const text = out.join('\n');
  if (process.env.UPDATE_GOLDEN) { mkdirSync(dirname(GOLDEN), { recursive: true }); writeFileSync(GOLDEN, text); }
  expect(text).toBe(readFileSync(GOLDEN, 'utf8'));
}, 300_000);

test('every R1 tool is still a tool, with at least its arguments and the same required list', async () => {
  const snap = JSON.parse(readFileSync(new URL('./tools-r1.json', import.meta.url), 'utf8')) as { tools: { name: string; properties: string[]; required: string[] }[] };
  const now = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))!.result as { tools: { name: string; inputSchema: { properties: Record<string, unknown>; required?: string[] } }[] };
  const byName = new Map(now.tools.map(t => [t.name, t]));
  for (const t of snap.tools) {
    const cur = byName.get(t.name);
    expect(cur, `${t.name} is gone`).toBeDefined();
    expect(Object.keys(cur!.inputSchema.properties), t.name).toEqual(expect.arrayContaining(t.properties));
    expect(cur!.inputSchema.required ?? [], t.name).toEqual(t.required);
  }
  // and R1's order is kept among them
  expect(now.tools.map(t => t.name).filter(n => snap.tools.some(t => t.name === n))).toEqual(snap.tools.map(t => t.name));
});
