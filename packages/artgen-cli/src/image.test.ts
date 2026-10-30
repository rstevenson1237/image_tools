// The image tools on the command line (R5b): trace, slice, quantize, map trace, trace-base and cut. The algorithms are held to OpenCV in
// artgen-imagekit; these tests are about what the commands do with files, maps and assets.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { decodePNG, encodePNG, Grid } from 'artgen-core';
import { main } from './cli.ts';
import { mapsMain } from './maps-cli.ts';
import { readMap } from './map.ts';

const run = async (...args: string[]) => {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
};
const json = async (...args: string[]) => JSON.parse((await run(...args, '--json')).out);
afterEach(() => vi.restoreAllMocks());

/** A dark disc with a bright hole on white, with a small speck: the sketch of a lake island. */
function sketch(file: string, w = 64, h = 64): void {
  const g = new Grid(w, h);
  g.fill(0, 0, w, h, '#ffffff');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - w / 2, y - h / 2), hole = Math.hypot(x - w / 2 - 6, y - h / 2 + 4);
    if (d < w * 0.38 && hole > 7) g.set(x, y, '#202020');
  }
  g.fill(2, 2, 2, 2, '#202020');
  writeFileSync(file, encodePNG(g));
}

describe('the image tools on the command line', () => {
  const root = mkdtempSync(join(tmpdir(), 'artgen-image-')), R = ['--root', root], at = (...p: string[]) => join(root, ...p);
  beforeAll(async () => {
    mkdirSync(at('refs'), { recursive: true });
    sketch(at('refs', 'island.png'));
    await run('init', ...R);
    await run('direction', 'candidates', '--pitch', 'Damp crypt crawler: knights, barrels and torchlight.', ...R);
    await run('direction', 'lock', 'a', ...R);
  }, 60_000);

  test('trace writes an SVG with the island and its hole, and says so', async () => {
    const r = await json('trace', at('refs', 'island.png'), ...R);
    expect(r).toMatchObject({ shapes: 1, holes: 1, width: 64, height: 64 });
    const svg = readFileSync(at('refs', 'island.svg'), 'utf8');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg.match(/ Z/g)).toHaveLength(2);
    const loose = await json('trace', at('refs', 'island.png'), '--min-area', '0', '--out', at('refs', 'all.svg'), ...R);
    expect(loose.shapes).toBe(2);
    await expect(run('trace', at('refs', 'nope.png'))).rejects.toThrow('not found');
    await expect(run('trace', at('refs', 'island.png'), '--fill', 'red', ...R)).rejects.toThrow('--fill: a colour like #rrggbb');
    await expect(run('trace', at('refs', 'island.png'), '--background', '#fff', ...R)).rejects.toThrow('--background: a colour like #rrggbb');
    await expect(run('trace', at('refs', 'island.png'), '--threshold', '400')).rejects.toThrow('--threshold');
  });

  test('slice cuts a grid and loose sprites into files with a slices.json', async () => {
    const g = new Grid(32, 16);
    g.fill(2, 2, 4, 4, '#ff0000'); g.fill(18, 3, 6, 5, '#00ff00');
    writeFileSync(at('refs', 'sheet.png'), encodePNG(g));
    const grid = await json('slice', at('refs', 'sheet.png'), '--cols', '2', '--rows', '1', ...R);
    expect(grid.cells).toHaveLength(2);
    expect(decodePNG(new Uint8Array(readFileSync(join(grid.dir, grid.cells[1].file))))).toMatchObject({ w: 16, h: 16 });
    expect(JSON.parse(readFileSync(join(grid.dir, 'slices.json'), 'utf8')).cells[1]).toMatchObject({ x: 16, col: 1 });
    const auto = await json('slice', at('refs', 'sheet.png'), '--auto', '--out', at('refs', 'loose'), ...R);
    expect(auto.cells.map((c: { x: number; y: number; w: number; h: number }) => [c.x, c.y, c.w, c.h])).toEqual([[2, 2, 4, 4], [18, 3, 6, 5]]);
    await expect(run('slice', at('refs', 'sheet.png'), ...R)).rejects.toThrow('give the columns and rows');
    await expect(run('slice', at('refs', 'sheet.png'), '--auto', '--cols', '2', ...R)).rejects.toThrow('--auto finds the sprites itself');
  });

  test('quantize snaps to a list, a file or the picture\'s own colours, and saves the palette', async () => {
    const r = await json('quantize', at('refs', 'island.png'), '--palette', '#000000,#ffffff', '--save', at('refs', 'bw.gpl'), ...R);
    const g = decodePNG(new Uint8Array(readFileSync(r.out)));
    expect(new Set([...Array(g.w * g.h).keys()].map(i => g.get(i % g.w, Math.floor(i / g.w))))).toEqual(new Set(['#000000', '#ffffff']));
    expect(readFileSync(at('refs', 'bw.gpl'), 'utf8')).toContain('GIMP Palette');
    const own = await json('quantize', at('refs', 'island.png'), '--palette', at('refs', 'bw.gpl'), '--n', '2', '--out', at('refs', 'own.png'), ...R);
    expect(own.colors).toEqual(['#000000', '#ffffff']);
    // three-digit colours work, a file wins over a list that looks like one, and the extension's case does not matter
    expect((await json('quantize', at('refs', 'island.png'), '--palette', '#000,#fff', '--out', at('refs', 'short.png'), ...R)).colors).toEqual(['#000000', '#ffffff']);
    writeFileSync(at('refs', 'bada55'), '112233\n445566\n');
    expect((await json('quantize', at('refs', 'island.png'), '--palette', at('refs', 'bada55'), '--out', at('refs', 'file.png'), ...R)).colors).toEqual(['#112233', '#445566']);
    writeFileSync(at('refs', 'REF.PNG'), readFileSync(at('refs', 'island.png')));
    expect((await json('quantize', at('refs', 'island.png'), '--palette', at('refs', 'REF.PNG'), '--n', '2', '--out', at('refs', 'upper.png'), ...R)).colors).toHaveLength(2);
    await expect(run('quantize', at('refs', 'island.png'), '--palette', at('refs', 'missing.hex'), ...R)).rejects.toThrow('not found');
  });

  test('map trace paints the island as land and its hole as water, and --replace swaps its own earlier edits', async () => {
    await run('map', 'new', 'isle', ...R);
    const r = await json('map', 'trace', 'isle', at('refs', 'island.png'), '--origin', 'sketch', ...R);
    expect(r).toMatchObject({ added: 2, removed: 0 });
    const m = readMap(null, { file: at('art', 'maps', 'isle', 'map.json') });
    expect(m.edits.map(e => e.op === 'paint' && e.terrain)).toEqual(['grass', 'water']);
    const poly = (m.edits[0] as { shape: { poly: number[] } }).shape.poly;
    // the sketch is 64 px on the map's cells: scaled to fit and centred; the island's leftmost pixel (8, a disc of radius 24 about 32) is drawn through its centre
    const scale = Math.min(m.cols / 64, m.rows / 64), left = (m.cols - 64 * scale) / 2 + (8 + 0.5) * scale;
    expect(Math.min(...poly.filter((_, k) => k % 2 === 0))).toBeCloseTo(left, 1);
    expect(Math.min(...poly.filter((_, k) => k % 2 === 0))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...poly.filter((_, k) => k % 2 === 1))).toBeLessThanOrEqual(m.rows);
    await run('map', 'edit', 'isle', 'paint', '--terrain', 'rock', '--circle', '3,3,2', ...R);
    const again = await json('map', 'trace', 'isle', at('refs', 'island.png'), '--origin', 'sketch', '--replace', '--terrain', 'forest', ...R);
    expect(again).toMatchObject({ added: 2, removed: 2 });
    expect(readMap(null, { file: at('art', 'maps', 'isle', 'map.json') }).edits.map(e => e.op === 'paint' && e.terrain)).toEqual(['rock', 'forest', 'water']);
    expect((await run('map', 'check', 'isle', ...R)).code).toBe(0);
  });

  test('the maps-only bundle has the image tools too', async () => {
    const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
    try { expect(await mapsMain(['trace', at('refs', 'island.png'), '--out', at('refs', 'maps-only.svg'), '--json'])).toBe(0); } finally { log.mockRestore(); }
    expect(existsSync(at('refs', 'maps-only.svg'))).toBe(true);
  });

  test('trace-base turns the sketch into the asset\'s next base, which renders and passes the gate', async () => {
    await run('brief', 'add', 'islet', '--kind', 'prop', '--notes', 'a rocky islet with a pool', ...R);
    await run('new', 'islet', '--kind', 'prop', ...R);
    const r = await json('trace-base', 'islet', at('refs', 'island.png'), ...R);
    expect(r).toMatchObject({ version: 'base.v2', trace: { shapes: 1, holes: 1 } });
    const src = readFileSync(r.file, 'utf8');
    expect(src).toContain(`pal.${r.mat}`);
    expect(src).toContain("fillRule: 'evenodd'");
    const rendered = await json('render', 'islet', '--version', 'base.v2', ...R);
    expect(rendered.checks.filter((c: { status: string }) => c.status === 'fail')).toEqual([]);
    expect(rendered.pass).toBe(true);
    // a picture's name reaches only a comment and a quoted string of the file, safely
    writeFileSync(at('refs', "it's a 'name'.png"), readFileSync(at('refs', 'island.png')));
    const odd = await json('trace-base', 'islet', at('refs', "it's a 'name'.png"), ...R);
    expect(readFileSync(odd.file, 'utf8')).toContain('notes: "traced silhouette of it_s a _name_.png"');
    expect((await json('render', 'islet', '--version', odd.version, ...R)).pass).toBe(true);
    const again = await json('trace-base', 'islet', at('refs', 'island.png'), '--anchor', 'bottom', '--mat', r.mat, ...R);
    expect(again.version).toBe('base.v4');
    await expect(run('trace-base', 'islet', at('refs', 'island.png'), '--mat', 'unobtainium', ...R)).rejects.toThrow('--mat unobtainium: one of');
    await expect(run('trace-base', 'islet', at('refs', 'island.png'), '--margin', '40', ...R)).rejects.toThrow('leaves no room');
  });

  test('cut makes a token from an approved asset, refuses an unapproved one, and cuts a picture', async () => {
    await expect(run('cut', 'islet', ...R)).rejects.toThrow('cut tokens from approved assets');
    const t = await json('cut', 'islet', '--version', 'base.v2', '--scale', '2', '--square', ...R);
    expect(t.out).toBe(at('art', 'tokens', 'islet.png'));
    const png = decodePNG(new Uint8Array(readFileSync(t.out)));
    expect(png.w).toBe(png.h);
    expect(png.w).toBe(t.width);
    const flat = await json('cut', 'islet', '--version', 'base.v2', '--fill', 'flat', '--color', '#00ff00', '--padding', '0', '--out', at('refs', 'sil.png'), ...R);
    const sil = decodePNG(new Uint8Array(readFileSync(flat.out)));
    const colors = new Set<string>();
    for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) { const c = sil.get(x, y); if (c) colors.add(c); }
    expect([...colors]).toEqual(['#00ff00']);
    const pic = await json('cut', at('refs', 'island.png'), '--padding', '0', '--out', at('refs', 'cut.png'), ...R);
    expect(pic).toMatchObject({ fill: 'art' });
    expect(pic.width).toBeLessThan(64);
    await expect(run('cut', 'islet', '--version', 'base.v2', '--state', 'dance', ...R)).rejects.toThrow('no cell dance/');
    await expect(run('cut', at('refs', 'isle.png'), ...R)).rejects.toThrow('isle.png: not found');
    await expect(run('cut', 'islet', '--fill', 'paint', ...R)).rejects.toThrow('--fill: art, flat');
    await expect(run('cut', 'islet', '--scale', '500', ...R)).rejects.toThrow('--scale');
  });
});
