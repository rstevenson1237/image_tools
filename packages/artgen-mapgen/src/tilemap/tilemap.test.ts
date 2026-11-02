// Tile map exports (R7c): map files as cell grids, the tile sheet, and the Tiled and LDtk files written from them.
import { describe, expect, test } from 'vitest';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { decodePNG } from 'artgen-primitives/lib/png.ts';
import { NEIGHBOURS, autotileIndexOf, autotileMask, cellHash, neighbourMask, reduceCorners } from 'artgen-primitives/lib/autobits.ts';
import * as D from '../dungeon/index.ts';
import * as M from '../map/index.ts';
import * as S from '../settlement/index.ts';
import * as T from './index.ts';

const rooms = (): D.Room[] => [
  { id: 'hall', shape: 'rect', x: 2, y: 2, w: 6, h: 4, label: 'Hall' },
  { id: 'den', shape: 'rect', x: 14, y: 2, w: 4, h: 6 },
  { id: 'yard', shape: 'rect', x: 2, y: 10, w: 5, h: 4, fill: 'yard' },
];
const lair = () => D.newDungeon('lair', {
  cols: 22, rows: 16, rooms: rooms(), corridors: [{ from: { room: 'hall' }, to: { room: 'den' }, doors: ['door', null] }],
  overlay: { labels: [{ text: 'Way in', x: 4, y: 8, kind: 'note' }], symbols: [{ kind: 'statue', x: 5, y: 4 }] },
});
const cls = (g: T.TileGrid, x: number, y: number) => T.classAt(g, x, y)?.id;

/** A blob47 binding of plain-coloured tiles: tile i is coloured by its index, so a test can read back which tile a cell got. */
function blobBinding(cls: string, size = 8, variants = 1): T.TileBinding {
  const tiles = Array.from({ length: variants }, (_, v) => Array.from({ length: 47 }, (_, i) => new Grid(size, size).fill(0, 0, size, size, `#${(i * 5).toString(16).padStart(2, '0')}${(v * 40).toString(16).padStart(2, '0')}80`)));
  return { class: cls, source: 'test/blob', view: 'topdown', size: [size, size], autotile: 'blob47', tiles };
}

describe('tile grids', () => {
  test('a dungeon: floors under rooms and corridors, walls round them, the door cell, yards, and objects', () => {
    const g = T.dungeonTiles(lair());
    expect([g.source, g.cols, g.rows, g.grid, g.cell]).toEqual(['dungeon', 22, 16, 'square', { size: 5, unit: 'ft' }]);
    expect(g.classes.map(c => c.id)).toEqual(['floor', 'wall', 'door', 'yard']);
    expect(cls(g, 2, 2)).toBe('floor');                 // the hall's corner cell
    expect(cls(g, 7, 5)).toBe('floor');
    expect(cls(g, 1, 1)).toBe('wall');                  // diagonal to the hall
    expect(cls(g, 3, 11)).toBe('yard');
    expect(cls(g, 0, 15)).toBeUndefined();              // rock far from everything
    expect([2, 3, 4, 5, 6].map(y => cls(g, 11, y))).toContain('floor'); // the corridor between them
    expect(T.classCounts(g).door).toBe(1);
    expect(T.classAt(g, 1, 1)?.solid).toBe(true);
    // every floor cell has no empty neighbour: a wall closes it in
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (cls(g, x, y) === 'floor')
      for (const [dx, dy] of NEIGHBOURS) expect(cls(g, x + dx, y + dy), `${x},${y} → ${x + dx},${y + dy}`).toBeDefined();
    const by = (t: string) => g.objects.filter(o => o.type === t);
    expect(by('room').map(o => [o.name, o.props.number, o.polygon!.length])).toEqual([['Hall', 1, 8], ['den', 2, 8], ['yard', 3, 8]]);
    expect(by('room')[0]).toMatchObject({ x: 2, y: 2, polygon: [0, 0, 6, 0, 6, 4, 0, 4] });
    expect(by('door')).toHaveLength(1);
    expect(by('corridor')[0].polyline!.length).toBeGreaterThanOrEqual(4);
    expect(by('label')[0]).toMatchObject({ text: 'Way in', x: 4, y: 8, props: { kind: 'note' } });
    expect(by('symbol')[0]).toMatchObject({ name: 'statue', x: 5, y: 4 });
  });

  test('a terrain map: the commonest terrain per cell, square or hex, with rivers and roads as polylines', () => {
    const m = M.newMap('vale', 'local', { seed: 3, cols: 20, rows: 14, grid: { type: 'square', size: 2, coords: false } });
    m.edits.push({ op: 'road', points: [1, 1, 18, 12] });
    const field = M.generateMap(m), g = T.mapTiles(m, field);
    expect([g.cols, g.rows, g.grid, g.cell.size]).toEqual([10, 7, 'square', 2 * m.scale.perCell]);
    expect(g.classes.map(c => c.id)).toEqual([...M.TERRAINS]);
    expect(Object.values(T.classCounts(g)).reduce((a, b) => a + b)).toBe(70);
    // a cell's class is the most common terrain among its samples
    const count = new Map<number, number>();
    for (let j = 0; j < 2 * field.res; j++) for (let i = 0; i < 2 * field.res; i++) { const t = field.terrain[j * field.w + i]; count.set(t, (count.get(t) ?? 0) + 1); }
    const top = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    expect(cls(g, 0, 0)).toBe(M.TERRAINS[top]);
    const road = g.objects.find(o => o.type === 'road')!;
    expect(road.x).toBeCloseTo(field.roads[0].pts[0] / 2, 3);
    expect(T.mapTiles(m, field, { cell: 1 }).cols).toBe(20);
    const hex = M.newMap('hx', 'regional', { seed: 3, cols: 30, rows: 20, grid: { type: 'hex', size: 2, coords: true } }), hg = T.mapTiles(hex);
    const h = T.hexLayout(hex);
    expect([hg.grid, hg.cols, hg.rows]).toEqual(['hex', h.cols, h.rows]);
    expect(h.centre(1, 0)).toEqual([h.R + 1.5 * h.R, 2]);   // odd columns half a hex down
    expect(M.gridGeometry(hex).cells.length).toBeLessThanOrEqual(hg.cols * hg.rows);
  });

  test('a settlement: buildings over roads over water over areas over the ground', () => {
    const s = S.newSettlement('ford', 'hamlet', {
      cols: 30, rows: 20, ground: 'grass',
      roads: [{ kind: 'street', points: [0, 10, 30, 10] }],
      water: [{ kind: 'pond', points: [20, 2, 26, 2, 26, 6, 20, 6] }],
      areas: [{ kind: 'field', points: [2, 13, 10, 13, 10, 19, 2, 19] }],
      buildings: [{ id: 'inn', kind: 'inn', shape: 'rect', x: 4, y: 3, w: 6, h: 4, label: 'The Ford' }],
      walls: [], trees: [{ kind: 'tree', x: 15, y: 16 }],
    });
    const g = T.settlementTiles(s);
    expect([cls(g, 5, 4), cls(g, 15, 10), cls(g, 22, 4), cls(g, 5, 15), cls(g, 15, 2)]).toEqual(['building', 'road', 'water', 'area-field', 'ground']);
    expect(g.classes.find(c => c.id === 'building')!.solid).toBe(true);
    expect(g.objects.find(o => o.type === 'building')).toMatchObject({ name: 'The Ford', props: { id: 'inn', kind: 'inn', number: 1 } });
    expect(g.objects.find(o => o.type === 'tree')).toMatchObject({ x: 15, y: 16 });
  });
});

describe('the tile sheet', () => {
  test('flat tiles per class in the cell\'s shape: squares, 2:1 diamonds and flat-top hexagons', () => {
    const g = T.dungeonTiles(lair());
    const sq = T.buildSheet(g, { name: 's' });
    expect([sq.tileW, sq.tileH, sq.tiles.length, sq.tiles.every(t => t.flat)]).toEqual([16, 16, 4, true]);
    const tile = (sh: T.TileSheet, i: number) => sh.image.crop((i % sh.columns) * sh.imageW, Math.floor(i / sh.columns) * sh.imageH, sh.imageW, sh.imageH);
    expect(tile(sq, 0).get(0, 0)).toBe(g.classes[0].color);
    const di = T.buildSheet(g, { name: 'd', shape: 'diamond' });
    expect([di.tileW, di.tileH]).toEqual([32, 16]);
    expect([tile(di, 0).get(0, 0), tile(di, 0).get(16, 8)]).toEqual([null, g.classes[0].color]);
    const hx = T.flatTile('hex', 16, T.hexHeight(16), '#ff0000');
    expect([hx.h, hx.get(0, 7), hx.get(1, 0), hx.get(4, 0), hx.get(8, 7)]).toEqual([14, '#ff0000', null, '#ff0000', '#ff0000']);
  });

  test('autotiles resolve from the same-class neighbours with the runtime\'s rule; variants by cellHash', () => {
    const g = T.dungeonTiles(lair()), b = blobBinding('floor', 8, 2), sheet = T.buildSheet(g, { name: 's', bindings: [b] });
    expect(sheet.tiles.length).toBe(2 * 47 + 3);
    expect(sheet.bindings).toEqual([{ class: 'floor', source: 'test/blob', autotile: 'blob47', variants: 2 }]);
    const ids = T.resolveTiles(g, sheet);
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const id = ids[y * g.cols + x];
      if (cls(g, x, y) !== 'floor') { expect(id < 0 || !sheet.tiles[id].autotile).toBe(true); continue; }
      const same = (nx: number, ny: number) => nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || cls(g, nx, ny) === 'floor';
      const t = sheet.tiles[id];
      expect(t.index).toBe(autotileIndexOf('blob47', neighbourMask(x, y, same)));
      expect(t.variant).toBe(cellHash(x, y, 2));
    }
    expect(() => T.buildSheet(g, { name: 's', bindings: [{ ...b, class: 'lava' }] })).toThrow('no class "lava"');
    expect(() => T.buildSheet(g, { name: 's', bindings: [b, { ...blobBinding('wall', 16), source: 'x/wide' }] })).toThrow('different widths');
  });

  test('the preview draws each cell\'s tile where Tiled draws it', () => {
    const g = T.dungeonTiles(lair()), sheet = T.buildSheet(g, { name: 's', bindings: [blobBinding('floor')] }), ids = T.resolveTiles(g, sheet);
    const pv = T.previewTiles(g, sheet, ids);
    expect([pv.w, pv.h]).toEqual([22 * 8, 16 * 8]);
    const id = ids[2 * g.cols + 2], t = sheet.tiles[id];
    expect(pv.get(2 * 8 + 3, 2 * 8 + 3)).toBe(`#${(t.index * 5).toString(16).padStart(2, '0')}0080`);
  });
});

describe('Tiled', () => {
  const g = T.dungeonTiles(lair());

  test('a map with one tile layer and an object group per layer; objects in pixels', () => {
    const r = T.exportTilemap(g, { to: ['tiled'], bindings: [blobBinding('floor')] });
    expect(r.files.map(f => f.name)).toEqual(['lair-tiles.png', 'lair-preview.png', 'lair.tmj', 'lair.tsj']);
    const map = JSON.parse(r.files[2].data as string), ts = JSON.parse(r.files[3].data as string);
    expect(map).toMatchObject({ type: 'map', orientation: 'orthogonal', width: 22, height: 16, tilewidth: 8, tileheight: 8, infinite: false, tilesets: [{ firstgid: 1, source: 'lair.tsj' }] });
    expect(map.layers.map((l: any) => l.name)).toEqual(['ground', 'rooms', 'corridors', 'doors', 'labels', 'symbols']);
    expect(map.layers[0].data).toEqual(Array.from(r.tiles, t => t + 1));
    expect(map.layers[1].objects[0]).toMatchObject({ id: 1, name: 'Hall', type: 'room', x: 16, y: 16, polygon: [{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 32 }, { x: 0, y: 32 }] });
    expect(map.layers[1].objects[0].properties).toContainEqual({ name: 'number', type: 'int', value: 1 });
    expect(map.layers.at(-1).objects[0]).toMatchObject({ point: true, x: 40, y: 32 });
    expect(map.nextobjectid).toBe(g.objects.length + 1);
    expect(map.properties).toContainEqual({ name: 'view', type: 'string', value: 'topdown' });
    // the tileset: the image's size, each tile's class, and the blob as a mixed wang set whose ids follow the masks
    const png = decodePNG(r.files[0].data as Uint8Array);
    expect([ts.imagewidth, ts.imageheight, ts.tilecount]).toEqual([png.w, png.h, 50]);
    expect(ts.tiles[0]).toMatchObject({ id: 0, type: 'floor', properties: expect.arrayContaining([{ name: 'class', type: 'string', value: 'floor' }, { name: 'autotile', type: 'string', value: 'blob47' }]) });
    expect(ts.tiles.find((t: any) => t.type === 'wall').properties).toContainEqual({ name: 'solid', type: 'bool', value: true });
    const ws = ts.wangsets[0];
    expect([ws.type, ws.wangtiles.length, ws.colors.length]).toEqual(['mixed', 47, 2]);
    expect(ws.wangtiles[0].wangid).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    expect(ws.wangtiles[46].wangid).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    // Tiled's brush takes the tile whose wang id matches the neighbours: for every mask that is the runtime's tile
    for (let m = 0; m < 256; m++) {
      const want = [1, 2, 4, 8, 16, 32, 64, 128].map(b => (m & b ? 1 : 2)), r2 = reduceCorners(m);
      const exact = ws.wangtiles.find((w: any) => w.wangid.every((c: number, i: number) => c === T.wangId('blob47', r2)[i]));
      expect(exact.tileid).toBe(autotileIndexOf('blob47', m));
      expect(want.filter((_, i) => i % 2 === 0)).toEqual(T.wangId('blob47', r2).filter((_, i) => i % 2 === 0));
    }
    expect(T.wangId('wang16', autotileMask('wang16', 5))).toEqual([1, 0, 2, 0, 1, 0, 2, 0]);
  });

  test('XML: the same map and tileset as .tmx / .tsx', () => {
    const r = T.exportTilemap(g, { to: ['tiled'], xml: true });
    const tmx = r.files.find(f => f.name === 'lair.tmx')!.data as string, tsx = r.files.find(f => f.name === 'lair.tsx')!.data as string;
    expect(tmx).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="22" height="16" tilewidth="16" tileheight="16" infinite="0"/);
    expect(tmx).toContain('<tileset firstgid="1" source="lair.tsx"/>');
    expect(tmx).toContain('<data encoding="csv">');
    expect(tmx.match(/<data encoding="csv">\n([\s\S]*?)\n<\/data>/)![1].split(',').map(Number)).toEqual(Array.from(r.tiles, t => t + 1));
    expect(tmx).toContain('<polygon points="0,0 96,0 96,64 0,64"/>');
    expect(tmx).toContain('<text pixelsize="12" wrap="1" halign="center" valign="center">Way in</text>');
    expect(tsx).toContain('<image source="lair-tiles.png"');
    expect(tsx).toContain('<property name="solid" type="bool" value="true"/>');
  });

  test('iso maps: Tiled\'s isometric orientation, objects in tile-height units; hex maps staggered', () => {
    const r = T.exportTilemap(g, { to: ['tiled'], view: 'iso' }), map = JSON.parse(r.files[2].data as string);
    expect([map.orientation, map.tilewidth, map.tileheight]).toEqual(['isometric', 32, 16]);
    expect(map.layers[1].objects[0]).toMatchObject({ x: 32, y: 32 });
    expect(JSON.parse(r.files[3].data as string).grid).toEqual({ orientation: 'isometric', width: 32, height: 16 });
    expect(() => T.exportTilemap(g, { to: ['ldtk'], view: 'iso' })).toThrow('LDtk has square grids only');
    const hex = T.mapTiles(M.newMap('hx', 'regional', { seed: 1, cols: 20, rows: 12, grid: { type: 'hex', size: 2, coords: true } }));
    const h = T.exportTilemap(hex), hm = JSON.parse(h.files[2].data as string);
    expect(h.files.map(f => f.name)).toEqual(['hx-tiles.png', 'hx-preview.png', 'hx.tmj', 'hx.tsj']);
    expect(hm).toMatchObject({ orientation: 'hexagonal', staggeraxis: 'x', staggerindex: 'odd', hexsidelength: 8, tilewidth: 16, tileheight: 14 });
    expect(() => T.exportTilemap(hex, { view: 'iso' })).toThrow('hex map is drawn flat');
  });

  test('the view\'s tile-shape check refuses tiles that do not fit its cell', () => {
    const b = blobBinding('floor', 8);
    expect(() => T.exportTilemap(g, { view: 'iso', bindings: [{ ...b, size: [16, 6] }] })).toThrow('tile-shape: test/blob for floor: an iso tile is at least half as tall as it is wide (16×6 px)');
    expect(() => T.exportTilemap(g, { view: 'side', bindings: [{ ...b, size: [8, 4] }] })).toThrow('a side tile is at least as tall as it is wide');
    expect(T.exportTilemap(g, { view: 'iso', bindings: [b] }).checks[0].status).toBe('pass');   // a block taller than its diamond
    expect(T.exportTilemap(g, { bindings: [b] }).checks).toEqual([{ id: 'tile-shape', class: 'floor', source: 'test/blob', status: 'pass', detail: '8×8 px fits the topdown cell' }]);
    expect(() => T.exportTilemap(g, { view: 'free' })).toThrow('no tile maps for the free view');
    expect(() => T.exportTilemap(g, { bindings: [b, { ...b, class: 'wall', view: 'iso' }] })).toThrow('different views');
  });
});

describe('LDtk', () => {
  test('a project with one level: entities, the resolved tiles and the class IntGrid; stable ids', () => {
    const g = T.dungeonTiles(lair()), r = T.exportTilemap(g, { to: ['ldtk'], bindings: [blobBinding('floor', 16)] });
    expect(r.files.map(f => f.name)).toEqual(['lair-tiles.png', 'lair-preview.png', 'lair.ldtk']);
    const p = JSON.parse(r.files[2].data as string);
    expect(p).toMatchObject({ jsonVersion: '1.5.3', defaultGridSize: 16, worlds: [], externalLevels: false });
    expect(p.defs.layers.map((l: any) => [l.identifier, l.type])).toEqual([['Objects', 'Entities'], ['Tiles', 'Tiles'], ['Classes', 'IntGrid']]);
    expect(p.defs.layers[2].intGridValues.map((v: any) => [v.value, v.identifier])).toEqual([[1, 'Floor'], [2, 'Wall'], [3, 'Door'], [4, 'Yard']]);
    expect(p.defs.entities.map((e: any) => e.identifier)).toEqual(['Room', 'Corridor', 'Door', 'Label', 'Symbol']);
    const [objects, tiles, classes] = p.levels[0].layerInstances;
    expect(classes.intGridCsv).toEqual(Array.from(g.cells));
    expect(tiles.gridTiles.length).toBe(Array.from(r.tiles).filter(t => t >= 0).length);
    const first = tiles.gridTiles[0], cols = r.sheet.columns;
    expect(first.src).toEqual([(first.t % cols) * 16, Math.floor(first.t / cols) * 16]);
    expect(r.tiles[first.px[1] / 16 * g.cols + first.px[0] / 16]).toBe(first.t);
    const hall = objects.entityInstances[0];
    expect(hall).toMatchObject({ __identifier: 'Room', px: [32, 32], width: 96, height: 64 });
    expect(hall.fieldInstances.find((f: any) => f.__identifier === 'name').__value).toBe('Hall');
    expect(hall.fieldInstances.find((f: any) => f.__identifier === 'points').__value).toEqual([{ cx: 2, cy: 2 }, { cx: 8, cy: 2 }, { cx: 8, cy: 6 }, { cx: 2, cy: 6 }]);
    // uids are unique and below nextUid; iids are UUID-shaped and unique; the same map exports the same bytes
    const uids = [p.levels[0].uid, ...p.defs.layers.map((l: any) => l.uid), ...p.defs.tilesets.map((t: any) => t.uid), ...p.defs.entities.flatMap((e: any) => [e.uid, ...e.fieldDefs.map((f: any) => f.uid)])];
    expect(new Set(uids).size).toBe(uids.length);
    expect(Math.max(...uids)).toBeLessThan(p.nextUid);
    const iids = [p.iid, p.levels[0].iid, ...p.levels[0].layerInstances.map((l: any) => l.iid), ...objects.entityInstances.map((e: any) => e.iid)];
    expect(new Set(iids).size).toBe(iids.length);
    for (const i of iids) expect(i).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(T.exportTilemap(g, { to: ['ldtk'], bindings: [blobBinding('floor', 16)] }).files[2].data).toBe(r.files[2].data);
    expect(T.ldtkIdent('area-field')).toBe('Area_field');
    expect(T.ldtkIdent('3d')).toBe('_3d');
  });

  test('a property whose objects disagree on its type: Int and Float make Float, anything else String', () => {
    const g = T.dungeonTiles(lair());
    g.objects = [
      { layer: 'marks', type: 'mark', x: 1, y: 1, props: { level: 1, size: 2, tag: 'a' } },
      { layer: 'marks', type: 'mark', x: 2, y: 2, props: { level: 'deep', size: 2.5, tag: true } },
    ];
    const p = JSON.parse(T.exportTilemap(g, { to: ['ldtk'] }).files[2].data as string);
    const defs = Object.fromEntries(p.defs.entities[0].fieldDefs.map((f: any) => [f.identifier, f.__type]));
    expect(defs).toMatchObject({ name: 'String', level: 'String', size: 'Float', tag: 'String' });
    const values = p.levels[0].layerInstances[0].entityInstances.map((e: any) => Object.fromEntries(e.fieldInstances.map((f: any) => [f.__identifier, f.__value])));
    expect(values).toEqual([{ name: null, level: '1', size: 2, tag: 'a' }, { name: null, level: 'deep', size: 2.5, tag: 'true' }]);
  });
});
