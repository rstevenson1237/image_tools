// `artgen map`: create, generate, edit, overlay and render a terrain map in a project, both themes, SVG and PNG.
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

describe('artgen map', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-map-')), R = ['--root', root], file = join(root, 'art', 'maps', 'vale', 'map.json');
  const spec = () => JSON.parse(readFileSync(file, 'utf8'));
  beforeAll(async () => { await run('init', ...R); });

  test('new → gen → edit → undo → grid → label/symbol → overlay rm', async () => {
    expect((await run('map', 'new', 'vale', '--preset', 'local', '--size', '20x14', '--seed', '9', '--title', 'Vale', ...R)).code).toBe(0);
    expect(spec()).toMatchObject({ id: 'vale', preset: 'local', cols: 20, rows: 14, seed: 9, title: 'Vale', grid: { type: 'square' } });
    await expect(run('map', 'new', 'vale', ...R)).rejects.toThrow(/already exists/);
    await run('map', 'gen', 'vale', '--sea', '0.2', '--rivers', '2', '--interval', '10', ...R);
    expect(spec()).toMatchObject({ gen: { sea: 0.2, rivers: 2 }, topo: { interval: 10 } });
    await run('map', 'edit', 'vale', 'paint', '--terrain', 'forest', '--circle', '5,5,3', ...R);
    await run('map', 'edit', 'vale', 'elevate', '--amount', '-0.3', '--stroke', '1,1,10,10', '--width', '2', ...R);
    await run('map', 'edit', 'vale', 'road', '--points', '0,7,20,7', ...R);
    expect(spec().edits.map((e: { op: string }) => e.op)).toEqual(['paint', 'elevate', 'road']);
    expect(spec().edits[1]).toMatchObject({ amount: -0.3, shape: { stroke: [1, 1, 10, 10], width: 2 } });
    await run('map', 'edit', 'vale', 'undo', ...R);
    expect(spec().edits).toHaveLength(2);
    await expect(run('map', 'edit', 'vale', 'paint', '--terrain', 'lava', '--circle', '1,1,1', ...R)).rejects.toThrow(/--terrain/);
    await run('map', 'grid', 'vale', 'hex', '--coords', 'on', ...R);
    await run('map', 'label', 'vale', 'Ashford', '--at', '0203', '--kind', 'place', ...R);
    await run('map', 'symbol', 'vale', 'castle', '--at', '4,4', ...R);
    await run('map', 'symbol', 'vale', 'town', '--at', '6,6', ...R);
    await expect(run('map', 'symbol', 'vale', 'dragon', '--at', '1,1', ...R)).rejects.toThrow(/unknown symbol/);
    await run('map', 'overlay', 'vale', 'rm', 'symbol', '0', ...R);
    expect(spec()).toMatchObject({ grid: { type: 'hex', coords: true }, overlay: { labels: [{ text: 'Ashford', kind: 'place' }], symbols: [{ kind: 'town', x: 6, y: 6 }] } });
    expect(spec().overlay.labels[0].x).toBeCloseTo(1 / Math.sqrt(3) + 1.5 / Math.sqrt(3));
    const list = await run('map', 'list', '--json', ...R);
    expect(JSON.parse(list.out)).toEqual([expect.objectContaining({ id: 'vale', size: '20x14', edits: 2, labels: 1, symbols: 1 })]);
  });

  test('render writes SVG and PNG in both themes; layers turn off', async () => {
    const r = await run('map', 'render', 'vale', '--ppu', '20', '--json', ...R), out = JSON.parse(r.out);
    expect(out.size).toEqual([400, 280]);
    const dir = join(root, 'art', 'maps', 'vale', 'out');
    for (const f of ['vale.color.svg', 'vale.color.png', 'vale.bw.svg', 'vale.bw.png']) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(readFileSync(join(dir, 'vale.color.png')).subarray(1, 4).toString()).toBe('PNG');
    await run('map', 'render', 'vale', '--theme', 'bw', '--format', 'svg', '--layers', 'grid=off,labels', ...R);
    const svg = readFileSync(join(dir, 'vale.bw.svg'), 'utf8');
    expect(svg).not.toContain('<g id="grid"'); expect(svg).not.toContain('<g id="labels"'); expect(svg).toContain('<g id="symbols"');
  }, 60_000);

  test('map ids are names, never paths', async () => {
    await expect(run('map', 'new', '../escape', ...R)).rejects.toThrow(/letters, digits/);
  });
});
