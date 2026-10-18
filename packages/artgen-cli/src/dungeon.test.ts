// `artgen dungeon`: a single room, a hand-built layout and a generated dungeon in a project; overlay, fit and render.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { main } from './cli.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
afterEach(() => vi.restoreAllMocks());

describe('artgen dungeon', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-dungeon-')), R = ['--root', root];
  const spec = (id: string) => JSON.parse(readFileSync(join(root, 'art', 'dungeons', id, 'dungeon.json'), 'utf8'));
  beforeAll(async () => { await run('init', ...R); });

  test('one room with exits', async () => {
    expect((await run('dungeon', 'new', 'cell', '--room', 'rect', '--room-size', '8x6', '--exits', 'n,e:secret,s:none', '--number', '20', ...R)).code).toBe(0);
    expect(spec('cell')).toMatchObject({ cols: 14, rows: 12, rooms: [{ id: 'r1', shape: 'rect', w: 8, h: 6, number: 20 }] });
    expect(spec('cell').corridors.map((c: { doors: unknown }) => c.doors)).toEqual([['door', null], ['secret', null], [null, null]]);
    await expect(run('dungeon', 'new', 'cell', ...R)).rejects.toThrow(/already exists/);
    await expect(run('dungeon', 'new', 'bad', '--room', 'rect', '--exits', 'up', ...R)).rejects.toThrow(/--exits/);
  });

  test('build by hand: rooms → links → doors → grid → style → overlay → fit', async () => {
    await run('dungeon', 'new', 'crypt', '--empty', '--size', '40x30', '--title', 'Crypt', ...R);
    expect(spec('crypt')).toMatchObject({ title: 'Crypt', rooms: [], corridors: [] });
    await run('dungeon', 'room', 'crypt', 'add', 'rect', '--at', '10,10', '--size', '6x4', '--label', 'Hall', ...R);
    await run('dungeon', 'room', 'crypt', 'add', 'circle', '--at', 'X11', '--size', '5x5', ...R);
    await run('dungeon', 'room', 'crypt', 'add', 'poly', '--points', '10,20,14,20,14,26,12,26,12,23,10,23', '--room-id', 'ell', ...R);
    expect(spec('crypt').rooms.map((r: { id: string; x: number; y: number }) => [r.id, r.x, r.y])).toEqual([['r1', 10, 10], ['r2', 23, 10], ['ell', 10, 20]]);
    await expect(run('dungeon', 'room', 'crypt', 'add', 'hex', '--at', '1,1', '--size', '2x2', ...R)).rejects.toThrow(/one of rect/);
    await run('dungeon', 'link', 'crypt', 'r1', 'r2', '--doors', 'door,locked', ...R);
    await run('dungeon', 'link', 'crypt', 'r1', 'ell', '--width', '2', ...R);
    await run('dungeon', 'link', 'crypt', 'r2', '30,0', ...R);
    expect(spec('crypt').corridors[2]).toEqual({ from: { room: 'r2' }, to: { at: [30, 0] } });
    await run('dungeon', 'door', 'crypt', '1', 'to', 'secret', ...R);
    expect(spec('crypt').corridors[1].doors).toEqual([null, 'secret']);
    await run('dungeon', 'unlink', 'crypt', '2', ...R);
    await run('dungeon', 'room', 'crypt', 'move', 'r2', '--at', '22,9', ...R);
    await run('dungeon', 'room', 'crypt', 'set', 'r2', '--shape', 'octagon', '--number', 'off', ...R);
    expect(spec('crypt').rooms[1]).toMatchObject({ x: 22, y: 9, shape: 'octagon', number: false });
    await run('dungeon', 'grid', 'crypt', '10', '--clip', 'all', ...R);
    expect(spec('crypt').grid).toEqual({ show: true, size: 2, sub: false, clip: 'all' });
    await run('dungeon', 'grid', 'crypt', '10+5', ...R);
    expect(spec('crypt').grid).toMatchObject({ size: 2, sub: true });
    await run('dungeon', 'style', 'crypt', '--hatch', 'full', '--compass', 'on', ...R);
    await run('dungeon', 'label', 'crypt', 'Bone pit', '--at', '12,12', '--kind', 'note', ...R);
    await run('dungeon', 'symbol', 'crypt', 'stairs', '--at', 'L12', '--angle', '90', ...R);
    await run('dungeon', 'symbol', 'crypt', 'pillar', '--at', '24,11', ...R);
    await expect(run('dungeon', 'symbol', 'crypt', 'dragon', '--at', '1,1', ...R)).rejects.toThrow(/unknown symbol/);
    await run('dungeon', 'overlay', 'crypt', 'rm', 'symbol', '1', ...R);
    expect(spec('crypt')).toMatchObject({ style: { hatch: 'full' }, compass: true, overlay: { labels: [{ text: 'Bone pit', kind: 'note' }], symbols: [{ kind: 'stairs', x: 11.5, y: 11.5, angle: 90 }] } });
    await run('dungeon', 'fit', 'crypt', '--margin', '2', ...R);
    expect(spec('crypt')).toMatchObject({ cols: 21, rows: 21, rooms: [{ x: 2, y: 3 }, { x: 14, y: 2 }, { x: 2, y: 13 }] });
    await run('dungeon', 'room', 'crypt', 'rm', 'r1', ...R);
    expect(spec('crypt')).toMatchObject({ rooms: [{ id: 'r2' }, { id: 'ell' }], corridors: [] });
    const list = await run('dungeon', 'list', '--json', ...R);
    expect(JSON.parse(list.out)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'crypt', rooms: 2, labels: 1, symbols: 1 })]));
  });

  test('generate, regenerate with new settings, render SVG + PNG; layers turn off', async () => {
    await run('dungeon', 'new', 'lair', '--seed', '3', '--rooms', '6', ...R);
    expect(spec('lair').rooms.length).toBeGreaterThanOrEqual(5);
    await run('dungeon', 'gen', 'lair', '--seed', '4', '--caves', '0.5', '--size', '30x24', ...R);
    expect(spec('lair')).toMatchObject({ seed: 4, cols: 30, rows: 24, gen: { caves: 0.5, rooms: 6 } });
    const r = JSON.parse((await run('dungeon', 'render', 'lair', '--ppu', '20', '--json', ...R)).out);
    expect(r.size).toEqual([600, 480]);
    const dir = join(root, 'art', 'dungeons', 'lair', 'out');
    for (const f of ['lair.svg', 'lair.png']) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(readFileSync(join(dir, 'lair.png')).subarray(1, 4).toString()).toBe('PNG');
    await run('dungeon', 'render', 'lair', '--format', 'svg', '--layers', 'grid=off,numbers', ...R);
    const svg = readFileSync(join(dir, 'lair.svg'), 'utf8');
    expect(svg).not.toContain('<g id="grid"'); expect(svg).not.toContain('<g id="numbers"'); expect(svg).toContain('<g id="floors"');
    await expect(run('dungeon', 'render', 'lair', '--layers', 'contours=off', ...R)).rejects.toThrow(/unknown layer/);
  }, 60_000);

  test('dungeon ids are names, never paths', async () => {
    await expect(run('dungeon', 'new', '../escape', ...R)).rejects.toThrow(/letters, digits/);
  });
});
