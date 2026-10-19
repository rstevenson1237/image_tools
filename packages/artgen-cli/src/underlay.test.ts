// The ground under a dungeon, walls, towers and gates, and room fills (artgen A5), held to the `keep` and `keep-cellars`
// fixtures: the wall encloses every upper room, there are towers at every hull corner, two gates (the main one with two towers),
// the road reaches the main gate, the yard shows the underlay, and the cellars are dashed with no wall. Structure only, never pixels.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { dungeon, map } from 'artgen-core';
import { main } from './cli.ts';
import { readDungeon, readUnderlay, renderDungeonFiles } from './dungeon.ts';
import { readMap } from './map.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/setting-builder/', import.meta.url));
const F = (name: string, file: string) => join(FIXTURES, name, file);
const bytes = (f: string) => readFileSync(f);

async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [], log = vi.spyOn(console, 'log').mockImplementation((...a) => { out.push(a.join(' ')); });
  try { return { code: await main(args), out: out.join('\n') }; } finally { log.mockRestore(); }
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
/** The `<g id="…">…</g>` of a layer, nested groups included. */
function layer(svg: string, id: string): string | undefined {
  const start = svg.indexOf(`<g id="${id}"`);
  if (start < 0) return undefined;
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<g[\s>]|<\/g>/g)) { depth += m[0] === '</g>' ? -1 : 1; if (!depth) return svg.slice(start, start + m.index! + 4); }
  throw new Error(`layer ${id} is not closed`);
}

describe('keep: walls, towers, gates, fills and the underlay', () => {
  const file = F('keep', 'dungeon.json'), spec = readDungeon(null, { file }), facts = dungeon.dungeonFacts(spec);
  const wall = facts.walls![0], byLabel = (code: string) => spec.rooms.find(r => r.label?.startsWith(`${code} `))!;

  test('is the upper level only: A.1 to A.11, A.8 a yard and the rest buildings, with an underlay, one wall and the legend', () => {
    expect(spec.rooms.map(r => r.label!.split(' ')[0])).toEqual(Array.from({ length: 11 }, (_, i) => `A.${i + 1}`));
    expect(spec.rooms.map(r => [r.label!.split(' ')[0], r.fill])).toEqual(spec.rooms.map(r => [r.label!.split(' ')[0], r.label!.startsWith('A.8 ') ? 'yard' : 'building']));
    expect(spec.underlay).toMatchObject({ map: 'map.json', origin: [4, 8], scale: 0.5 });
    expect(spec.walls).toHaveLength(1);
    expect(spec.legend).toBe(true);
    expect(spec.style.hatch).toBe('none');
  });

  test('the wall encloses every upper room', () => {
    expect(wall.enclosed).toHaveLength(11);
    expect(wall.enclosed.every(e => e.inside)).toBe(true);
    expect(facts.rooms.map(r => r.id)).toEqual(wall.enclosed.map(e => e.room));
  });

  test('there is a tower at every hull corner, and the gate adds two', () => {
    const hull = dungeon.convexHull(spec.rooms.flatMap(r => [r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h]));
    expect(wall.corners).toHaveLength(hull.length);
    const corners = wall.towers.filter(t => t.source === 'corner');
    expect(corners).toHaveLength(wall.corners.length);
    corners.forEach((t, i) => expect(t.at).toEqual(wall.corners[i]));
    expect(wall.towers.filter(t => t.source === 'gate')).toHaveLength(2);
    expect(wall.towers.every(t => t.shape === 'round')).toBe(true);
  });

  test('two gates: the main one at A.1 with two towers, the postern at A.2 with none', () => {
    expect(wall.gates.map(g => [g.kind, g.room, g.towers])).toEqual([['gate', 'r1', 2], ['postern', 'r2', 0]]);
    const a1 = byLabel('A.1'), a2 = byLabel('A.2'), [main, postern] = wall.gates;
    expect(main.at[0]).toBeLessThan(a1.x);                       // on the wall, outside the gatehouse
    expect(main.at[1]).toBeGreaterThanOrEqual(a1.y); expect(main.at[1]).toBeLessThanOrEqual(a1.y + a1.h);
    expect(postern.at[1]).toBeLessThan(a2.y);
    expect(postern.at[0]).toBeGreaterThanOrEqual(a2.x); expect(postern.at[0]).toBeLessThanOrEqual(a2.x + a2.w);
  });

  test('the road reaches the main gate, and runs on to A.1', () => {
    const sheet = readMap(null, { file: F('keep', spec.underlay!.map) }), field = map.generateMap(sheet);
    expect(sheet).toMatchObject({ cols: 66, rows: 54, scale: { perCell: 10, unit: 'ft' } });
    const u = spec.underlay!, toSheet = (cx: number, cy: number): [number, number] => [u.origin[0] + cx * u.scale, u.origin[1] + cy * u.scale];
    const gate = toSheet(...wall.gates[0].at), a1 = byLabel('A.1'), centre = toSheet(a1.x + a1.w / 2, a1.y + a1.h / 2);
    expect(field.roads).toHaveLength(1);
    const pts = field.roads[0].pts, end: [number, number] = [pts[pts.length - 2], pts[pts.length - 1]];
    const nearest = Math.min(...Array.from({ length: pts.length / 2 }, (_, i) => Math.hypot(pts[2 * i] - gate[0], pts[2 * i + 1] - gate[1])));
    expect(nearest).toBeLessThan(0.75);
    expect(Math.hypot(end[0] - centre[0], end[1] - centre[1])).toBeLessThan(3.5);
  });

  test('renders: the underlay under the rooms, the wall, towers and gates over them, A.8 left open to the underlay', () => {
    const under = readUnderlay(null, { file }, spec)!, svg = dungeon.renderDungeonSvg(spec, { underlay: under }), order = ['underlay', 'buildings', 'enclosure', 'symbols', 'legend'].map(id => svg.indexOf(`<g id="${id}"`));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(svg.match(/<svg /g)!.length).toBe(2);                   // the page and the map nested in it
    expect(svg).not.toContain('id="legend" ');                     // the dungeon's own legend only, none of the map's
    const buildings = layer(svg, 'buildings')!;
    expect(buildings.match(/<path d="M[^"]*Z" fill="#dcdcdc"/g)).toHaveLength(10);   // ten buildings, no yard
    const yard = byLabel('A.8');
    expect(buildings).not.toContain(`M${yard.x * 40} ${yard.y * 40}`);
    expect(layer(svg, 'enclosure')!.match(/<circle /g)).toHaveLength(8 + 2);          // every corner and the gate's two
    expect(layer(svg, 'enclosure')).toContain('mask="url(#gates-0)"');
    expect(svg).toContain('<mask id="gates-0"');
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size, 'every id is used once').toBe(ids.length);
  });

  test('with hatching off the underlay shows between the buildings, and the underlay layer can be turned off', () => {
    const under = readUnderlay(null, { file }, spec)!;
    expect(dungeon.renderDungeonSvg(spec, { underlay: under, layers: { underlay: false } })).not.toContain('<g id="underlay"');
    expect(dungeon.renderDungeonSvg(spec, { underlay: under })).toContain('<g id="u-terrain"');
    // the map's own legend, title, compass and scale bar are off; the dungeon's title is kept
    const svg = dungeon.renderDungeonSvg(spec, { underlay: under }), nested = layer(svg, 'underlay')!;
    for (const id of ['u-legend', 'u-scale', 'u-compass', 'u-title']) expect(nested).not.toContain(`<g id="${id}"`);
    expect(svg).toContain('A Roadsend Keep');
  });

  test('`fit` moves the walls, gates and underlay with the rooms: every point keeps its place on the sheet', () => {
    const moved = structuredClone(spec);
    for (const r of moved.rooms) { r.x += 7; r.y += 5; }
    moved.walls![0].gates!.forEach(g => { g.at = [g.at[0] + 7, g.at[1] + 5]; });
    moved.underlay!.origin = [moved.underlay!.origin[0] - 7 * 0.5, moved.underlay!.origin[1] - 5 * 0.5];
    const fitted = dungeon.fitDungeon(moved, 2), u = fitted.underlay!, sheet = (s: dungeon.DungeonSpec, at: number[]) => [s.underlay!.origin[0] + at[0] * s.underlay!.scale, s.underlay!.origin[1] + at[1] * s.underlay!.scale];
    const was = dungeon.dungeonFacts(spec).walls![0].gates.map(g => sheet(spec, g.at)), now = dungeon.dungeonFacts(fitted).walls![0].gates.map(g => sheet(fitted, g.at));
    now.forEach((p, i) => { expect(p[0]).toBeCloseTo(was[i][0], 0); expect(p[1]).toBeCloseTo(was[i][1], 0); });
    expect(u.scale).toBe(0.5);
    const box = dungeon.contentBox(fitted)!;
    expect(box[0]).toBeGreaterThanOrEqual(1.5);       // the wall and its towers are inside the margin, not cut off by the sheet
    expect(fitted.cols).toBeGreaterThanOrEqual(Math.ceil(box[2]));
  });

  test('renders to SVG and PNG, the same twice', async () => {
    const a = mkdtempSync(join(tmpdir(), 'artgen-keep-a-')), b = mkdtempSync(join(tmpdir(), 'artgen-keep-b-'));
    await renderDungeonFiles(null, { file }, { out: a, ppu: 10 });
    await renderDungeonFiles(null, { file }, { out: b, ppu: 10 });
    for (const f of ['svg', 'png']) expect(bytes(join(a, `dungeon.${f}`)).equals(bytes(join(b, `dungeon.${f}`)))).toBe(true);
  }, 120_000);

  test('facts read back from the CLI: the wall, the towers and the gates, in text and in JSON', async () => {
    const j = JSON.parse((await cli('dungeon', 'facts', '--file', file, '--json')).out), t = (await cli('dungeon', 'facts', '--file', file)).out;
    expect(j.walls[0].gates).toHaveLength(2);
    expect(t).toContain('encloses every room');
    expect(t).toMatch(/gate at [\d.]+,[\d.]+ .*2 towers, opens into r1/);
    expect(t).toMatch(/postern at .*0 towers, opens into r2/);
  });

  test('`check` reports a missing underlay map, and a bad wall', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'artgen-keep-check-')), f = join(dir, 'd.json'), bad = JSON.parse(readFileSync(file, 'utf8'));
    bad.walls[0].gates[0].kind = 'door'; bad.walls[0].rooms.push('r99');
    await import('node:fs').then(fs => fs.writeFileSync(f, JSON.stringify(bad)));
    const r = await cli('dungeon', 'check', '--file', f, '--json'), j = JSON.parse(r.out);
    expect(r.code).toBe(1);
    expect(j.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['walls[0].rooms', 'walls[0].gates[0].kind']));
    bad.walls = undefined; bad.rooms = bad.rooms.slice(0, 2);
    await import('node:fs').then(fs => fs.writeFileSync(f, JSON.stringify(bad)));
    const j2 = JSON.parse((await cli('dungeon', 'check', '--file', f, '--json')).out);
    expect(j2.errors).toEqual([{ path: 'underlay.map', message: 'no such map file map.json' }]);
  });
});

describe('keep-cellars', () => {
  const file = F('keep-cellars', 'dungeon.json'), spec = readDungeon(null, { file });

  test('A.12 and A.13 are cellars over the same underlay, with no wall', () => {
    expect(spec.rooms.map(r => [r.label!.split(' ')[0], r.fill])).toEqual([['A.12', 'cellar'], ['A.13', 'cellar']]);
    expect(spec.walls).toBeUndefined();
    const keep = readDungeon(null, { file: F('keep', 'dungeon.json') });
    expect(spec.underlay).toMatchObject({ origin: keep.underlay!.origin, scale: keep.underlay!.scale });
    expect(readFileSync(F('keep-cellars', spec.underlay!.map))).toEqual(readFileSync(F('keep', 'map.json')));
    expect([spec.cols, spec.rows]).toEqual([keep.cols, keep.rows]);
  });

  test('both are drawn dashed, above the symbols and under the numbers, and nothing encloses them', () => {
    const svg = dungeon.renderDungeonSvg(spec, { underlay: readUnderlay(null, { file }, spec)! }), cellars = layer(svg, 'cellars')!;
    expect(cellars.match(/<path /g)).toHaveLength(2);
    expect(cellars).toContain('stroke-dasharray');
    expect(svg).not.toContain('<g id="enclosure"');
    expect(svg).not.toContain('<g id="buildings"');
    expect(svg.indexOf('<g id="cellars"')).toBeGreaterThan(svg.indexOf('<g id="floors"'));
    expect(svg.indexOf('<g id="cellars"')).toBeLessThan(svg.indexOf('<g id="numbers"'));
  });
});

describe('room fills and walls without an underlay', () => {
  test('a yard has no walls and no fill, a building a roof tone with a ridge, a cellar a dashed outline', () => {
    const spec = dungeon.newDungeon('f', { cols: 30, rows: 20, rooms: [
      { id: 'a', shape: 'rect', x: 2, y: 2, w: 6, h: 4, fill: 'building' }, { id: 'b', shape: 'rect', x: 10, y: 2, w: 6, h: 4, fill: 'yard' },
      { id: 'c', shape: 'rect', x: 2, y: 9, w: 6, h: 4, fill: 'cellar' }, { id: 'd', shape: 'rect', x: 10, y: 9, w: 6, h: 4 },
    ] });
    const svg = dungeon.renderDungeonSvg(spec, {});
    expect(layer(svg, 'buildings')!.match(/<path /g)).toHaveLength(2);        // the roof and its ridge
    expect(layer(svg, 'cellars')!.match(/<path /g)).toHaveLength(1);
    const floor = layer(svg, 'floors')!;
    expect(floor.match(/<path d="M/g)).toHaveLength(2);                       // only the floor room's outline, as walls and as floor
    expect(floor).toContain('M400 360');
    expect(floor).not.toContain('M80 80');
    expect(floor).not.toContain('M400 80');
  });

  test('a wall by `poly` runs as given, `inset` pushes the hull out, and a gate snaps onto the wall', () => {
    const rooms = [{ id: 'a', shape: 'rect' as const, x: 10, y: 10, w: 6, h: 6 }];
    const spec = dungeon.newDungeon('w', { cols: 40, rows: 30, rooms, walls: [
      { id: 'hull', rooms: ['a'], inset: 2, towers: { shape: 'square', size: 2 }, gates: [{ at: [14, 7], kind: 'gate', room: 'a', width: 2 }] },
      { id: 'poly', poly: [1, 1, 30, 1, 30, 20, 1, 20] },
    ] });
    const walls = dungeon.layoutWalls(spec, dungeon.layoutDungeon(spec));
    expect(walls[0].ring).toEqual([8, 8, 18, 8, 18, 18, 8, 18]);
    expect(walls[0].gates[0]).toMatchObject({ x: 14, y: 8, angle: 0, width: 2 });
    expect(walls[0].towers.filter(t => t.source === 'gate').map(t => [t.x, t.y])).toEqual([[12, 8], [16, 8]]);
    expect(walls[1].ring).toEqual([1, 1, 30, 1, 30, 20, 1, 20]);
    expect(walls[1].enclosed).toEqual([{ room: 'a', inside: true }]);
    expect(dungeon.renderDungeonSvg(spec, {})).toContain('<rect x="');
  });

  test('no underlay map given: the underlay is not drawn and nothing else changes', () => {
    const spec = readDungeon(null, { file: F('keep', 'dungeon.json') }), svg = dungeon.renderDungeonSvg(spec, {});
    expect(svg).not.toContain('<g id="underlay"');
    expect(svg).toContain('<g id="enclosure"');
  });
});

describe('what already renders, renders as before', () => {
  test('the first drawing of the Keep, a generated dungeon and the generated maps render byte for byte as they did (hashes from before A5 to A8)', () => {
    const flat = readDungeon(null, { file: F('keep-flat', 'dungeon.json') });
    expect(hash(dungeon.renderDungeonSvg(flat, {}))).toBe('6b61723bc99aaf70463a26ba9ba7b5af70a50efecfa5d8a6ca8e9816963f927d');
    expect(hash(dungeon.renderDungeonSvg(flat, { ppu: 12, crop: [0, 0, 50, 40] }))).toBe('65ad5f50314aafc03154c0c0b88b5741ed8ef99a66d9aeaa46a57b21d04d749b');
    expect(hash(dungeon.renderDungeonSvg(dungeon.generateDungeon(dungeon.newDungeon('g', { seed: 7 })), {}))).toBe('f1611f3817177e27831e629114ada16093f8aa861995bf594cfa5b324c1773e1');
    const local = map.newMap('m', 'local', { seed: 3, cols: 24, rows: 16, overlay: { labels: [{ text: 'Camp', x: 6, y: 6, kind: 'place' }], symbols: [{ kind: 'tower', x: 8, y: 8 }] } });
    expect(hash(map.renderMapSvg(local, {}))).toBe('d69693072c9381924a3cd94e0223a0dd40f82940e12626121b3ec2f545d14050');
    expect(hash(map.renderMapSvg(local, { theme: 'bw', ppu: 20 }))).toBe('a1bdde79509a1668831307cf74fadffde54fa43f76a6f3bce7905d1e513c26fe');
    expect(hash(map.renderMapSvg(map.newMap('r', 'regional', { seed: 5, cols: 24, rows: 18 }), {}))).toBe('dbb340fcabb93f6c6c84985cad7999a0e38472d23edd8f180e27a34541233e87');
  }, 60_000);

  test('every dungeon fixture still parses, and none of the new layers appears in one that does not use them', () => {
    for (const name of ['warren', 'shrine-crypts', 'keep-flat']) {
      const svg = dungeon.renderDungeonSvg(readDungeon(null, { file: F(name, 'dungeon.json') }), {});
      for (const id of ['underlay', 'buildings', 'enclosure', 'cellars', 'legend']) expect(svg, `${name} ${id}`).not.toContain(`<g id="${id}"`);
    }
  });
});
