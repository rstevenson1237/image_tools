// Symbols, and sizes against the page (artgen A6, A7): the new symbols are listed, drawn and in the legend; with a page
// scale (`--fit`, `--page-scale`) labels, symbols and strokes are set in points and millimetres on the page, labels are kept
// off one another, and without one every existing file renders as it did. Checked on the SVG's structure, on the fixtures.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { readDungeon } from './dungeon.ts';
import { readMap, renderMapFiles } from './map.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/setting-builder/', import.meta.url));
const F = (name: string, file: string) => join(FIXTURES, name, file);

async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
}

/** Points on the page for a length in the SVG's own units: the SVG is `width` mm across its viewBox. */
function pageScale(svg: string): { pt: (units: number) => number; mm: (units: number) => number } {
  const w = svg.match(/<svg [^>]*width="([\d.]+)mm"/)![1], vb = svg.match(/<svg [^>]*viewBox="([^"]+)"/)![1].split(' ').map(Number);
  const mmPerUnit = +w / vb[2];
  return { mm: u => u * mmPerUnit, pt: u => (u * mmPerUnit * 72) / 25.4 };
}

/** Each text of a layer (halo copies dropped): its anchor, font size in SVG units, and text. */
function texts(svg: string, id: string): { x: number; y: number; size: number; text: string }[] {
  const start = svg.indexOf(`<g id="${id}"`), end = svg.indexOf('</g>', start);
  const out: { x: number; y: number; size: number; text: string }[] = [];
  for (const m of svg.slice(start, end).matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)" font-size="([\d.]+)"[^>]* fill="(?!none)[^"]*"[^>]*>([^<]*)<\/text>/g))
    out.push({ x: +m[1], y: +m[2], size: +m[3], text: m[4] });
  return out;
}

/** An estimate of each label's box on the page, as the placer reckons it. */
const boxOf = (t: { x: number; y: number; size: number; text: string }) => ({ x: t.x - (t.text.length * t.size * 0.62) / 2, y: t.y - t.size * 1.1, w: t.text.length * t.size * 0.62, h: t.size * 1.15 });
const touch = (a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the new symbols', () => {
  test('are listed in `map symbols` and `dungeon symbols`', async () => {
    const m = JSON.parse((await cli('map', 'symbols', '--json')).out).items, d = JSON.parse((await cli('dungeon', 'symbols', '--json')).out).items;
    expect(m).toEqual(expect.arrayContaining(['cave-mouth', 'gate']));
    expect(d).toEqual(expect.arrayContaining(['stairs-up', 'stairs-down', 'curtain', 'dais', 'stairs', 'gate']));
  });

  test('a map symbol takes an angle; `map symbol --angle --origin` writes both', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'artgen-sym-')), file = join(dir, 'm.json');
    await cli('map', 'new', '--file', file, '--preset', 'local', '--size', '20x20');
    await cli('map', 'symbol', '--file', file, 'cave-mouth', '--at', '5,5', '--angle', '180', '--origin', 'tables');
    expect(readMap(null, { file }).overlay.symbols).toEqual([{ kind: 'cave-mouth', x: 5, y: 5, angle: 180, origin: 'tables' }]);
    const svg = map.renderMapSvg(readMap(null, { file }), {});
    expect(svg).toMatch(/<g id="symbols"><g transform="translate\(200 200\) rotate\(180\) scale\(/);
    expect(map.renderMapSvg(readMap(null, { file }), { layers: { legend: true } })).toContain('>Cave mouth<');
  });

  test('every new symbol is drawn, and a symbol the legend knows is in it when used', () => {
    const spec = dungeon.newDungeon('s', { legend: true, rooms: [{ id: 'r1', shape: 'rect', x: 2, y: 2, w: 8, h: 6 }] });
    spec.overlay.symbols = ['stairs-up', 'stairs-down', 'curtain', 'dais', 'gate'].map((kind, i) => ({ kind, x: 3 + i, y: 4, angle: 90 }));
    const svg = dungeon.renderDungeonSvg(spec, {}), key = svg.slice(svg.indexOf('<g id="legend"'));
    for (const name of ['Stairs up', 'Stairs down', 'Curtain', 'Dais', 'Gate']) expect(key).toContain(`>${name}<`);
    expect(dungeon.renderDungeonSvg({ ...spec, legend: undefined }, {})).not.toContain('<g id="legend"');
  });

  test('stairs up and stairs down differ in the SVG, and each turns to its angle', () => {
    expect(dungeon.SYMBOLS['stairs-up'].svg).not.toBe(dungeon.SYMBOLS['stairs-down'].svg);
    const spec = readDungeon(null, { file: F('shrine-crypts', 'dungeon.json') }), svg = dungeon.renderDungeonSvg(spec, {}), g = svg.slice(svg.indexOf('<g id="symbols"'));
    const sym = spec.overlay.symbols;
    expect(sym.map(s => [s.kind, s.angle])).toEqual([['stairs-up', 180], ['stairs-down', 90]]);
    expect(g).toMatch(/rotate\(180\)[^>]*>.*?<g transform="translate\([\d.-]+ [\d.-]+\) rotate\(90\)/s);
    expect(g).toContain(dungeon.SYMBOLS['stairs-up'].svg.replaceAll('{ink}', '#000000').replaceAll('{fill}', '#ffffff'));
    expect(g).toContain(dungeon.SYMBOLS['stairs-down'].svg.replaceAll('{ink}', '#000000').replaceAll('{fill}', '#ffffff'));
  });

  test('keep: the dais is in the legend', () => {
    const spec = readDungeon(null, { file: F('keep', 'dungeon.json') }), svg = dungeon.renderDungeonSvg(spec, {});
    expect(spec.overlay.symbols.map(s => s.kind)).toEqual(['dais']);
    expect(svg.slice(svg.indexOf('<g id="legend"'))).toContain('>Dais<');
  });
});

describe('ravine on the page', () => {
  const spec = readMap(null, { file: F('ravine', 'map.json') });
  const windows: [number, number, number, number][] = [[0, 0, 16, 23], [0, 30, 16, 23], [0, 72, 16, 23], [0, 108, 16, 23], [0, 140, 16, 23]];

  test('the cave mouths face across the gorge: west-wall mouths east, east-wall ones west', () => {
    const mouths = spec.overlay.symbols.filter(s => s.kind === 'cave-mouth');
    expect(mouths).toHaveLength(7);
    for (const s of mouths) {
      if (s.x <= 4.5) expect(s.angle, `x ${s.x}`).toBe(0);
      else if (s.x >= 11.5) expect(s.angle, `x ${s.x}`).toBe(180);
    }
    expect(mouths.filter(s => s.angle === 0)).toHaveLength(3);
    expect(mouths.filter(s => s.angle === 180)).toHaveLength(3);
  });

  test.each(windows)('--fit 180x260mm on the window %i,%i,%i,%i: every place label is 7 pt or more, none overlap, none is left unplaced', async (...crop) => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-page-ravine-'));
    const r = await renderMapFiles(null, { file: F('ravine', 'map.json') }, { fit: { w: 180, h: 260, unit: 'mm' }, crop: crop as [number, number, number, number], themes: ['color'], formats: ['svg'], out });
    expect(r.pageScale).toBeGreaterThan(0);
    expect(r.unplaced).toEqual([]);
    const svg = readFileSync(join(out, 'map.color.svg'), 'utf8'), { pt } = pageScale(svg), labels = texts(svg, 'labels');
    expect(labels.length).toBeGreaterThan(0);
    for (const t of labels) expect(pt(t.size), t.text).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) expect(touch(boxOf(labels[i]), boxOf(labels[j])), `${labels[i].text} / ${labels[j].text}`).toBe(false);
  });

  test('a place label is 9 pt by default and `size` is a multiple of it', () => {
    const base = map.newMap('p', 'local', { cols: 20, rows: 20, overlay: { labels: [{ text: 'A', x: 5, y: 5, kind: 'place' }, { text: 'B', x: 15, y: 15, kind: 'place', size: 2 }, { text: 'n', x: 5, y: 15, kind: 'note' }], symbols: [] } });
    const svg = map.renderMapSvg(base, { ppu: 20, pageScale: 96 / 25.4, unit: 'mm' }), sizes = texts(svg, 'labels').map(t => t.size * 0.75);
    [9, 18, 7].forEach((pt, i) => expect(sizes[i]).toBeCloseTo(pt, 1));
  });
});

describe('frontier on the page', () => {
  test('--fit 260x180mm: the region labels are 9 pt or more and the castle mark is 5 mm', async () => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-page-frontier-'));
    const r = await renderMapFiles(null, { file: F('frontier', 'map.json') }, { fit: { w: 260, h: 180, unit: 'mm' }, themes: ['color'], formats: ['svg'], out });
    expect(r.unplaced).toEqual([]);
    const svg = readFileSync(join(out, 'map.color.svg'), 'utf8'), { pt, mm } = pageScale(svg);
    for (const t of texts(svg, 'labels')) expect(pt(t.size), t.text).toBeGreaterThanOrEqual(9 - 1e-6);
    const castle = svg.slice(svg.indexOf('<g id="symbols"')).match(/scale\(([\d.]+)\)/)![1];
    expect(mm(+castle * 20)).toBeCloseTo(5, 1);
  }, 60_000);

  test('the label A is moved off its castle', () => {
    const spec = readMap(null, { file: F('frontier', 'map.json') }), at = map.mapLabelLayout(spec, 10, 96 / 25.4).at, a = spec.overlay.labels.findIndex(l => l.text === 'A');
    expect(Math.hypot(at[a].x / 10 - spec.overlay.labels[a].x, at[a].y / 10 - spec.overlay.labels[a].y)).toBeGreaterThan(0.3);
  });
});

describe('sizes without a page scale', () => {
  test('are as they were: the ravine and the frontier render the same with and without the code path (no pageScale leaves ppu in charge)', () => {
    for (const name of ['ravine', 'frontier']) {
      const spec = readMap(null, { file: F(name, 'map.json') }), a = map.renderMapSvg(spec, { ppu: 12 }), b = map.renderMapSvg(spec, { ppu: 12, pageScale: undefined });
      expect(a).toBe(b);
      expect(map.mapLabelLayout(spec, 12).unplaced).toEqual([]);
    }
    const spec = readDungeon(null, { file: F('warren', 'dungeon.json') });
    expect(dungeon.renderDungeonSvg(spec, {})).toBe(dungeon.renderDungeonSvg(spec, { pageScale: undefined }));
    expect(dungeon.renderDungeonSvg(spec, {})).not.toContain('id="legend"');
  }, 60_000);

  test('--page-scale sets the sizes and a bad one is refused', async () => {
    const out = mkdtempSync(join(tmpdir(), 'artgen-page-ps-'));
    const r = JSON.parse((await cli('map', 'render', '--file', F('frontier', 'map.json'), '--format', 'svg', '--theme', 'color', '--ppu', '4', '--page-scale', '3.78', '--out', out, '--json')).out);
    expect(r.pageScale).toBe(3.78);
    await expect(cli('map', 'render', '--file', F('frontier', 'map.json'), '--page-scale', '0')).rejects.toThrow(/--page-scale/);
  }, 60_000);
});

describe('dungeon on the page', () => {
  test('at three page sizes room numbers are 8 pt, place and note labels 9 and 7 pt, and symbols 5 mm', () => {
    const spec = dungeon.newDungeon('pg', {
      cols: 30, rows: 20, rooms: [{ id: 'r1', shape: 'rect', x: 2, y: 2, w: 10, h: 8 }],
      overlay: { labels: [{ text: 'Hall', x: 20, y: 5, kind: 'name' }, { text: 'a note', x: 20, y: 12, kind: 'note' }], symbols: [{ kind: 'pillar', x: 25, y: 15 }] },
    });
    for (const [w, h] of [[100, 70], [180, 120], [297, 210]]) {
      const ppu = Math.min((w * 96) / 25.4 / spec.cols, (h * 96) / 25.4 / spec.rows), svg = dungeon.renderDungeonSvg(spec, { ppu, pageScale: 96 / 25.4, unit: 'mm' }), { pt, mm } = pageScale(svg);
      expect(pt(texts(svg, 'numbers')[0].size), `${w}x${h}`).toBeCloseTo(8, 1);
      texts(svg, 'labels').forEach((t, i) => expect(pt(t.size)).toBeCloseTo([9, 7][i], 1));
      const scale = +svg.slice(svg.indexOf('<g id="symbols"')).match(/scale\(([\d.]+)\)/)![1];
      expect(mm(scale * 20)).toBeCloseTo(5, 1);
    }
  });

  test('a label over a symbol is moved off it, and one with no room is reported', () => {
    const spec = dungeon.newDungeon('pg2', { cols: 30, rows: 20, overlay: { labels: [{ text: 'Hall', x: 20, y: 5, kind: 'name' }], symbols: [{ kind: 'pillar', x: 20, y: 5 }] } });
    const lay = dungeon.dungeonLabelLayout(spec, 20, 96 / 25.4);
    expect(lay.unplaced).toEqual([]);
    expect(lay.at[0]).not.toEqual({ x: 400, y: 100 });
    const tight = dungeon.newDungeon('pg3', { cols: 4, rows: 4, overlay: { labels: [{ text: 'A very long label that fits nowhere', x: 2, y: 2, kind: 'name' }], symbols: [] } });
    expect(dungeon.dungeonLabelLayout(tight, 10, 96 / 25.4).unplaced).toEqual([{ index: 0, text: 'A very long label that fits nowhere' }]);
  });
});
