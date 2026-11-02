/**
 * Tiled export (R7c, docs/TILEMAPS.md §5): a tile grid as a Tiled map (`.tmj` JSON or `.tmx` XML, format 1.10) with its
 * tileset in its own file (`.tsj` / `.tsx`). The map has one tile layer (`ground`) and an object group per object layer;
 * the tileset gives each tile its class and `solid` as properties, and each autotile set a wang set, so Tiled's terrain
 * brush paints with the same tiles the export resolved. Orthogonal, isometric (2:1 diamonds) and staggered hexagonal
 * (flat-top, odd columns down) maps, from the view module's orientation.
 */
import { BLOB47, N, NE, E, SE, S, SW, W, NW, autotileMask } from 'artgen-primitives/lib/autobits.ts';
import type { PropValue, TileGrid, TileObject } from './grid.ts';
import type { TileSheet } from './tileset.ts';

export const TILED_VERSION = '1.10';
export const TILED_APP = '1.10.2';
export type TiledOrientation = 'orthogonal' | 'isometric' | 'hexagonal';

interface TiledProperty { name: string; type: 'string' | 'int' | 'float' | 'bool'; value: PropValue }
const props = (o: Record<string, PropValue>): TiledProperty[] =>
  Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string', value }));

export interface TiledOptions {
  orientation: TiledOrientation;
  /** The tileset file the map points at (`<id>.tsj` / `.tsx`) and the image the tileset points at (`<id>-tiles.png`). */
  tilesetFile: string;
  image: string;
  /** Tile ids per cell (−1 empty), from `resolveTiles`. */
  tiles: Int32Array;
  /** Extra map properties (`view`, `generator`…). */
  properties?: Record<string, PropValue>;
}

/** A cell-space point in the map's pixel space (Tiled's object coordinates). */
export function objectPixels(sheet: TileSheet, orientation: TiledOrientation): (x: number, y: number) => [number, number] {
  if (orientation === 'isometric') return (x, y) => [x * sheet.tileH, y * sheet.tileH]; // Tiled keeps iso objects in tile-height units on both axes
  if (orientation === 'hexagonal') return (x, y) => [(x - 0.5) * 0.75 * sheet.tileW + sheet.tileW / 2, y * sheet.tileH];
  return (x, y) => [x * sheet.tileW, y * sheet.tileH];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function tiledObject(o: TileObject, id: number, at: (x: number, y: number) => [number, number]): Record<string, unknown> {
  const [x, y] = at(o.x, o.y), origin = at(0, 0);
  const rel = (pts: number[]) => { const out: { x: number; y: number }[] = []; for (let i = 0; i < pts.length; i += 2) { const [px, py] = at(pts[i], pts[i + 1]); out.push({ x: r2(px - origin[0]), y: r2(py - origin[1]) }); } return out; };
  const base: Record<string, unknown> = { id, name: o.name ?? '', type: o.type, x: r2(x), y: r2(y), width: 0, height: 0, rotation: o.angle ?? 0, visible: true };
  if (o.polygon) base.polygon = rel(o.polygon);
  else if (o.polyline) base.polyline = rel(o.polyline);
  else if (o.text !== undefined) {
    // a text box centred on the label's point, about 7 px a letter
    const w = Math.max(16, o.text.length * 7), h = 16;
    Object.assign(base, { x: r2(x - w / 2), y: r2(y - h / 2), width: w, height: h, text: { text: o.text, wrap: true, halign: 'center', valign: 'center', pixelsize: 12 } });
  } else if (o.w !== undefined && o.h !== undefined) { const [ex, ey] = at(o.x + o.w, o.y + o.h); Object.assign(base, { width: r2(ex - x), height: r2(ey - y) }); }
  else base.point = true;
  const p = props(o.props);
  if (p.length) base.properties = p;
  return base;
}

/** The map (`.tmj`) as JSON data. */
export function tiledMap(g: TileGrid, sheet: TileSheet, o: TiledOptions): Record<string, unknown> {
  if (o.tiles.length !== g.cols * g.rows) throw new Error('tiles: one per cell');
  if (o.orientation === 'hexagonal' && sheet.shape !== 'hex') throw new Error('a hexagonal map needs hex tiles');
  if (o.orientation === 'isometric' && sheet.shape !== 'diamond') throw new Error('an isometric map needs diamond tiles');
  const at = objectPixels(sheet, o.orientation);
  let layerId = 1, objectId = 1;
  const layers: Record<string, unknown>[] = [{
    id: layerId++, name: 'ground', type: 'tilelayer', x: 0, y: 0, width: g.cols, height: g.rows, opacity: 1, visible: true,
    data: Array.from(o.tiles, t => (t < 0 ? 0 : t + 1)),
  }];
  const groups = [...new Set(g.objects.map(x => x.layer))];
  for (const name of groups) layers.push({
    id: layerId++, name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true,
    objects: g.objects.filter(x => x.layer === name).map(x => tiledObject(x, objectId++, at)),
  });
  return {
    type: 'map', version: TILED_VERSION, tiledversion: TILED_APP, orientation: o.orientation, renderorder: 'right-down',
    width: g.cols, height: g.rows, tilewidth: sheet.tileW, tileheight: sheet.tileH, infinite: false,
    ...(o.orientation === 'hexagonal' && { hexsidelength: Math.round(sheet.tileW / 2), staggeraxis: 'x', staggerindex: 'odd' }),
    nextlayerid: layerId, nextobjectid: objectId, compressionlevel: -1,
    properties: props({ source: g.source, id: g.id, ...(g.title && { title: g.title }), format: g.format, cellSize: g.cell.size, cellUnit: g.cell.unit, ...o.properties }),
    tilesets: [{ firstgid: 1, source: o.tilesetFile }],
    layers,
  };
}

/** Tiled wang id of a mask: [top, top-right, right, bottom-right, bottom, bottom-left, left, top-left], 1 = the class, 2 = the other ground. */
export function wangId(layout: 'wang16' | 'blob47', mask: number): number[] {
  const bits = [N, NE, E, SE, S, SW, W, NW];
  return bits.map((b, i) => (layout === 'wang16' && i % 2 ? 0 : mask & b ? 1 : 2));
}

/** The tileset (`.tsj`) as JSON data: tile classes and `solid`, the bindings, and a wang set per autotile set. */
export function tiledTileset(g: TileGrid, sheet: TileSheet, o: { image: string }): Record<string, unknown> {
  const solid = new Map(g.classes.map(c => [c.id, !!c.solid]));
  const tiles = sheet.tiles.map(t => ({
    id: t.id, type: t.class,
    properties: props({ class: t.class, solid: solid.get(t.class)!, ...(t.variant && { variant: t.variant }), ...(t.autotile && { autotile: t.autotile, index: t.index }), ...(t.flat && { placeholder: true }) }),
  }));
  const wangsets = sheet.bindings.filter(b => b.autotile).map(b => {
    const layout = b.autotile!, cls = g.classes.find(c => c.id === b.class)!, mine = sheet.tiles.filter(t => t.class === b.class);
    const full = mine.find(t => t.index === (layout === 'blob47' ? BLOB47.length - 1 : 15))!;
    const isolated = mine.find(t => t.index === 0)!;
    return {
      name: b.class, type: layout === 'blob47' ? 'mixed' : 'edge', tile: full.id,
      colors: [
        { name: cls.name, color: cls.color, tile: full.id, probability: 1 },
        { name: 'other', color: '#808080', tile: isolated.id, probability: 1 },
      ],
      wangtiles: mine.map(t => ({ tileid: t.id, wangid: wangId(layout, autotileMask(layout, t.index)) })),
    };
  });
  const rows = Math.ceil(sheet.tiles.length / sheet.columns);
  return {
    type: 'tileset', version: TILED_VERSION, tiledversion: TILED_APP, name: sheet.name,
    tilewidth: sheet.imageW, tileheight: sheet.imageH, tilecount: sheet.tiles.length, columns: sheet.columns, margin: 0, spacing: 0,
    image: o.image, imagewidth: sheet.columns * sheet.imageW, imageheight: rows * sheet.imageH,
    ...(sheet.shape === 'diamond' && { grid: { orientation: 'isometric', width: sheet.tileW, height: sheet.tileH } }),
    properties: props({ generator: 'artgen', ...Object.fromEntries(sheet.bindings.map(b => [`bind.${b.class}`, b.source])) }),
    tiles,
    ...(wangsets.length && { wangsets }),
  };
}

// ---- XML (.tmx / .tsx) ----------------------------------------------------------------------------------------------

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
function propsXml(p: TiledProperty[] | undefined, pad: string): string {
  if (!p?.length) return '';
  return `${pad}<properties>\n${p.map(x => `${pad} <property${attrs({ name: x.name, type: x.type === 'string' ? undefined : x.type, value: x.type === 'bool' ? String(x.value) : x.value })}/>`).join('\n')}\n${pad}</properties>\n`;
}

/** The `.tmx` text of a map made by {@link tiledMap} (pointing at the `.tsx` tileset). */
export function tmx(map: Record<string, any>): string {
  const head = attrs({
    version: map.version, tiledversion: map.tiledversion, orientation: map.orientation, renderorder: map.renderorder, width: map.width, height: map.height,
    tilewidth: map.tilewidth, tileheight: map.tileheight, infinite: 0, hexsidelength: map.hexsidelength, staggeraxis: map.staggeraxis, staggerindex: map.staggerindex,
    nextlayerid: map.nextlayerid, nextobjectid: map.nextobjectid,
  });
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n<map${head}>\n${propsXml(map.properties, ' ')}`;
  for (const t of map.tilesets) s += ` <tileset firstgid="${t.firstgid}" source="${esc(t.source)}"/>\n`;
  for (const l of map.layers) {
    if (l.type === 'tilelayer') {
      const rows: string[] = [];
      for (let y = 0; y < l.height; y++) rows.push(l.data.slice(y * l.width, (y + 1) * l.width).join(','));
      s += ` <layer${attrs({ id: l.id, name: l.name, width: l.width, height: l.height })}>\n  <data encoding="csv">\n${rows.join(',\n')}\n</data>\n </layer>\n`;
    } else {
      s += ` <objectgroup${attrs({ id: l.id, name: l.name })}>\n`;
      for (const o of l.objects) {
        const a = attrs({ id: o.id, name: o.name || undefined, type: o.type, x: o.x, y: o.y, width: o.width || undefined, height: o.height || undefined, rotation: o.rotation || undefined });
        const inner = propsXml(o.properties, '   ')
          + (o.polygon ? `   <polygon points="${o.polygon.map((p: any) => `${p.x},${p.y}`).join(' ')}"/>\n` : '')
          + (o.polyline ? `   <polyline points="${o.polyline.map((p: any) => `${p.x},${p.y}`).join(' ')}"/>\n` : '')
          + (o.point ? '   <point/>\n' : '')
          + (o.text ? `   <text${attrs({ pixelsize: o.text.pixelsize, wrap: 1, halign: o.text.halign, valign: o.text.valign })}>${esc(o.text.text)}</text>\n` : '');
        s += inner ? `  <object${a}>\n${inner}  </object>\n` : `  <object${a}/>\n`;
      }
      s += ' </objectgroup>\n';
    }
  }
  return s + '</map>\n';
}

/** The `.tsx` text of a tileset made by {@link tiledTileset}. */
export function tsx(ts: Record<string, any>): string {
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n<tileset${attrs({ version: ts.version, tiledversion: ts.tiledversion, name: ts.name, tilewidth: ts.tilewidth, tileheight: ts.tileheight, tilecount: ts.tilecount, columns: ts.columns })}>\n`;
  if (ts.grid) s += ` <grid${attrs({ orientation: ts.grid.orientation, width: ts.grid.width, height: ts.grid.height })}/>\n`;
  s += propsXml(ts.properties, ' ');
  s += ` <image${attrs({ source: ts.image, width: ts.imagewidth, height: ts.imageheight })}/>\n`;
  for (const t of ts.tiles) s += ` <tile${attrs({ id: t.id, type: t.type })}>\n${propsXml(t.properties, '  ')} </tile>\n`;
  if (ts.wangsets) {
    s += ' <wangsets>\n';
    for (const w of ts.wangsets) {
      s += `  <wangset${attrs({ name: w.name, type: w.type, tile: w.tile })}>\n`;
      for (const c of w.colors) s += `   <wangcolor${attrs({ name: c.name, color: c.color, tile: c.tile, probability: c.probability })}/>\n`;
      for (const t of w.wangtiles) s += `   <wangtile tileid="${t.tileid}" wangid="${t.wangid.join(',')}"/>\n`;
      s += '  </wangset>\n';
    }
    s += ' </wangsets>\n';
  }
  return s + '</tileset>\n';
}
