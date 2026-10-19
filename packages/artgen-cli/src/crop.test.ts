// `--crop`, `--room` and `--fit` on `map render` and `dungeon render` (artgen A4): a crop is a window on the full render,
// so every sheet layer inside it is the full render's own drawing, and the furniture sits inside the window. Checked on
// the SVG's structure, on the setting_builder fixtures.
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { readDungeon } from './dungeon.ts';
import { readMap } from './map.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/setting-builder/', import.meta.url));

/** A fixture's input file copied into a bare folder, to run `--file` commands on. */
function bare(name: string, kind: 'map' | 'dungeon'): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), `artgen-crop-${name}-`)), file = join(dir, `${kind}.json`);
  cpSync(join(FIXTURES, name, `${kind}.json`), file);
  return { dir, file };
}
async function cli(...args: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [], err: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  const error = vi.spyOn(console, 'error').mockImplementation((...a) => { err.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n'), err: err.join('\n') }; } finally { log.mockRestore(); error.mockRestore(); }
}
/** The `<g id="…">…</g>` of a layer, nested groups included (undefined when the layer is not there). */
function layer(svg: string, id: string): string | undefined {
  const start = svg.indexOf(`<g id="${id}"`);
  if (start < 0) return undefined;
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<g[\s>]|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (!depth) return svg.slice(start, start + m.index! + 4);
  }
  throw new Error(`layer ${id} is not closed`);
}
const viewBox = (svg: string) => svg.match(/<svg [^>]*viewBox="([^"]+)"/)![1].split(' ').map(Number);
const attr = (svg: string, name: string) => svg.match(new RegExp(`<svg [^>]*${name}="([^"]+)"`))![1];
/** The box rect a furniture layer opens with, as [x, y, right, bottom]. */
const box = (g: string): number[] => {
  const m = g.match(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/)!;
  return [+m[1], +m[2], +m[1] + +m[3], +m[2] + +m[4]];
};
const inside = (b: number[], f: number[]) => b[0] >= f[0] - 0.01 && b[1] >= f[1] - 0.01 && b[2] <= f[0] + f[2] + 0.01 && b[3] <= f[1] + f[3] + 0.01;

describe('ravine: --crop and --fit', () => {
  const spec: map.MapSpec = readMap(null, { file: join(FIXTURES, 'ravine', 'map.json') });
  const ppu = 40, crop: [number, number, number, number] = [0, 127, 16, 46];   // E.2 stands at y 150
  const full = map.renderMapSvg(spec, { ppu }), cut = map.renderMapSvg(spec, { ppu, crop });

  test('the crop is a window on the full render: every sheet layer is the full render\'s own, the window is the viewBox', () => {
    expect(viewBox(cut)).toEqual([0, 127 * ppu, 16 * ppu, 46 * ppu]);
    expect([attr(cut, 'width'), attr(cut, 'height')]).toEqual(['640', '1840']);
    expect(cut).toContain(`<clipPath id="map-clip"><rect x="0" y="${127 * ppu}" width="640" height="1840"/>`);
    const sheet = ['terrain', 'rivers', 'roads', 'contours', 'symbols', 'labels'].filter(id => layer(full, id));
    expect(sheet).toEqual(expect.arrayContaining(['terrain', 'rivers', 'roads', 'symbols', 'labels']));
    for (const id of sheet) expect(layer(cut, id), id).toBe(layer(full, id));
    expect(cut).toContain(spec.overlay.labels.find(l => l.text.startsWith('E.2 '))!.text);
  });

  test('the legend and scale bar sit inside the window, and the scale bar reads in yards', () => {
    const frame = viewBox(cut);
    for (const id of ['legend', 'scale']) expect(inside(box(layer(cut, id)!), frame), id).toBe(true);
    expect(layer(full, 'legend')).not.toBe(layer(cut, 'legend'));
    expect(layer(cut, 'scale')).toMatch(/\d+ yd</);
    expect(layer(cut, 'scale')).toContain('1 square = 10 yd');
  });

  test('a crop that is the whole sheet changes nothing', () => {
    expect(map.renderMapSvg(spec, { ppu, crop: [0, 0, 16, 184] })).toBe(full);
  });

  test('map render --crop writes the window and --json reports the crop and the ppu', async () => {
    const { dir, file } = bare('ravine', 'map');
    const r = await cli('map', 'render', '--file', file, '--theme', 'color', '--format', 'both', '--crop', '0,127,16,46', '--ppu', '20', '--json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ version: 1, crop: [0, 127, 16, 46], ppu: 20, size: [320, 920], svg: { width: 320, height: 920, unit: 'px' } });
    const svg = readFileSync(join(dir, 'map.color.svg'), 'utf8');
    expect(viewBox(svg)).toEqual([0, 2540, 320, 920]);
    const png = readFileSync(join(dir, 'map.color.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([320, 920]);
  }, 120_000);

  test('--fit 180x260mm whole: the long side fits and the SVG is 260 mm tall', async () => {
    const { dir, file } = bare('ravine', 'map');
    const r = JSON.parse((await cli('map', 'render', '--file', file, '--theme', 'color', '--format', 'svg', '--fit', '180x260mm', '--json')).out);
    expect(r.crop).toEqual([0, 0, 16, 184]);
    expect(r.ppu).toBeCloseTo((260 * 96) / 25.4 / 184, 6);
    expect(r.svg).toEqual({ width: 22.61, height: 260, unit: 'mm' });
    const svg = readFileSync(join(dir, 'map.color.svg'), 'utf8');
    expect(attr(svg, 'height')).toBe('260mm');
    expect(parseFloat(attr(svg, 'width'))).toBeLessThanOrEqual(180);
    expect(viewBox(svg)).toEqual([0, 0, +(16 * r.ppu).toFixed(3), +(184 * r.ppu).toFixed(3)]);
  });

  test('--fit applies to the crop, and a crop in grid cells is the same window on a one-unit grid', async () => {
    const { file } = bare('ravine', 'map');
    const a = JSON.parse((await cli('map', 'render', '--file', file, '--format', 'svg', '--crop', '0,127,16,46', '--fit', '100x400px', '--json')).out);
    expect(a.ppu).toBe(100 / 16);
    expect(a.size).toEqual([100, 288]);
    const b = JSON.parse((await cli('map', 'render', '--file', file, '--format', 'svg', '--crop', '0,127,16,46cells', '--fit', '100x400px', '--json')).out);
    expect(b.crop).toEqual(a.crop);
  });

  test('bad flags are refused', async () => {
    const { file } = bare('ravine', 'map');
    await expect(cli('map', 'render', '--file', file, '--fit', '100x100px', '--ppu', '10')).rejects.toThrow(/--fit and --ppu/);
    await expect(cli('map', 'render', '--file', file, '--crop', '0,500,16,10')).rejects.toThrow(/outside the sheet/);
    await expect(cli('map', 'render', '--file', file, '--crop', '1,2,3')).rejects.toThrow(/--crop/);
  });
});

describe('warren: --room F.3 --margin 2', () => {
  const spec: dungeon.DungeonSpec = readDungeon(null, { file: join(FIXTURES, 'warren', 'dungeon.json') });
  const layout = dungeon.layoutDungeon(spec), win = dungeon.roomCrop(spec, ['F.3'], 2, layout);
  const holds = (pts: number[]) => pts.every((v, i) => (i % 2 ? v >= win[1] && v <= win[1] + win[3] : v >= win[0] && v <= win[0] + win[2]));
  const room = (code: string) => layout.rooms.find(g => g.room.label?.startsWith(`${code} `))!;

  test('the crop holds F.3, the doors to F.4 and F.5 and the start of the corridor to F.2, and no other room whole', () => {
    expect(holds(room('F.3').outline)).toBe(true);
    const toward = (code: string) => spec.corridors.findIndex(c => 'room' in c.from && 'room' in c.to && c.from.room === room('F.3').room.id && c.to.room === room(code).room.id);
    for (const code of ['F.4', 'F.5']) {
      const doors = layout.doors.filter(d => d.corridor === toward(code));
      expect(doors, code).toHaveLength(1);
      expect(holds([doors[0].x, doors[0].y]), `door to ${code}`).toBe(true);
    }
    // the corridor from F.2 comes in from the east: its first two cells outside F.3 are in the window
    const c = layout.corridors[spec.corridors.findIndex(x => 'room' in x.from && 'room' in x.to && x.from.room === room('F.2').room.id && x.to.room === room('F.3').room.id)];
    const out = c.ends[1]!, head = [out.x + Math.cos((out.angle * Math.PI) / 180) * 2, out.y + Math.sin((out.angle * Math.PI) / 180) * 2];
    expect(holds([out.x, out.y, ...head])).toBe(true);
    for (const g of layout.rooms) if (g !== room('F.3')) expect(holds(g.outline), g.room.label).toBe(false);
  });

  test('is the full render clipped to the window: sheet layers are identical, furniture is inside the window', () => {
    const full = dungeon.renderDungeonSvg(spec), cut = dungeon.renderDungeonSvg(spec, { crop: win });
    const k = 40, frame = [win[0] * k, win[1] * k, win[2] * k, win[3] * k];
    expect(viewBox(cut)).toEqual(frame.map(v => +v.toFixed(3)));
    const sheet = ['rock', 'floors', 'grid', 'doors', 'symbols', 'numbers', 'room-labels', 'labels'].filter(id => layer(full, id));
    expect(sheet).toEqual(expect.arrayContaining(['floors', 'grid', 'doors', 'numbers', 'room-labels']));
    for (const id of sheet) expect(layer(cut, id), id).toBe(layer(full, id));
    // grid names and the numbers stay the sheet's: F.3 is still drawn as room 3
    expect(layer(cut, 'numbers')).toContain('>3</text>');
    if (layer(cut, 'scale')) expect(inside(box(layer(cut, 'scale')!), frame)).toBe(true);
  });

  test('dungeon render --room F.3 --margin 2 reports the window in cells and the ppu', async () => {
    const { dir, file } = bare('warren', 'dungeon');
    const r = JSON.parse((await cli('dungeon', 'render', '--file', file, '--format', 'svg', '--room', 'F.3', '--margin', '2', '--ppu', '30', '--json')).out);
    expect(r).toMatchObject({ version: 1, ppu: 30 });
    expect(r.crop).toEqual(win.map(v => +v.toFixed(3)));
    expect(viewBox(readFileSync(join(dir, 'dungeon.svg'), 'utf8'))).toEqual(win.map(v => +(v * 30).toFixed(3)));
  });

  test('a bigger margin is a bigger window; a room id works as well as its label code', () => {
    const wide = dungeon.roomCrop(spec, ['F.3'], 4, layout);
    expect(wide[2] * wide[3]).toBeGreaterThan(win[2] * win[3]);
    expect(dungeon.roomCrop(spec, [room('F.3').room.id], 2, layout)).toEqual(win);
  });

  test('--fit on the whole sheet: the width fits and the SVG is 180 mm wide', async () => {
    const { dir, file } = bare('warren', 'dungeon');
    const r = JSON.parse((await cli('dungeon', 'render', '--file', file, '--format', 'svg', '--fit', '180x260mm', '--json')).out);
    expect(r.svg).toMatchObject({ width: 180, unit: 'mm' });
    expect(r.svg.height).toBeLessThan(260);
    expect(attr(readFileSync(join(dir, 'dungeon.svg'), 'utf8'), 'width')).toBe('180mm');
  });

  test('bad flags are refused', async () => {
    const { file } = bare('warren', 'dungeon');
    await expect(cli('dungeon', 'render', '--file', file, '--room', 'F.9')).rejects.toThrow(/--room: no room F\.9/);
    await expect(cli('dungeon', 'render', '--file', file, '--room', 'F.3', '--crop', '0,0,5,5')).rejects.toThrow(/--crop and --room/);
    await expect(cli('dungeon', 'render', '--file', file, '--margin', '2')).rejects.toThrow(/--margin goes with --room/);
    await expect(cli('dungeon', 'render', '--file', file, '--fit', '10x10mm', '--ppu', '5')).rejects.toThrow(/--fit and --ppu/);
  });
});

describe('keep: --room A.9 --room A.13', () => {
  test('one crop round both rooms', async () => {
    const spec = readDungeon(null, { file: join(FIXTURES, 'keep', 'dungeon.json') }), layout = dungeon.layoutDungeon(spec);
    const { dir, file } = bare('keep', 'dungeon');
    const r = JSON.parse((await cli('dungeon', 'render', '--file', file, '--format', 'svg', '--room', 'A.9', '--room', 'A.13', '--ppu', '10', '--json')).out);
    const [x, y, w, h] = r.crop as number[];
    for (const code of ['A.9', 'A.13']) {
      const g = layout.rooms.find(q => q.room.label?.startsWith(`${code} `))!;
      for (let i = 0; i < g.outline.length; i += 2) {
        expect(g.outline[i], code).toBeGreaterThanOrEqual(x);
        expect(g.outline[i], code).toBeLessThanOrEqual(x + w);
        expect(g.outline[i + 1], code).toBeGreaterThanOrEqual(y);
        expect(g.outline[i + 1], code).toBeLessThanOrEqual(y + h);
      }
    }
    // one window: the whole sheet's other rooms (the gate, the inn) are not in it
    expect(w).toBeLessThan(spec.cols);
    expect(viewBox(readFileSync(join(dir, 'dungeon.svg'), 'utf8'))).toEqual([x * 10, y * 10, w * 10, h * 10].map(v => +v.toFixed(3)));
  });

  test('--room names a room that is not there', () => {
    const spec = readDungeon(null, { file: join(FIXTURES, 'keep', 'dungeon.json') });
    expect(() => dungeon.roomCrop(spec, ['A.99'])).toThrow(/no room A\.99/);
    expect(() => dungeon.roomCrop(spec, [])).toThrow(/at least one room/);
  });
});
