/**
 * LDtk export (R7c, docs/TILEMAPS.md §6): a tile grid as an LDtk project (`.ldtk`, JSON 1.5.3) with one level. Three
 * layers, top first: `Objects` (an entity per object type, its properties as fields and its outline as a point path),
 * `Tiles` (the tiles the export resolved, from the shared tile sheet) and `Classes` (an IntGrid, one value per class, so a
 * game reads walls and floors without the tiles). LDtk grids are square, so isometric and hex maps go to Tiled only.
 *
 * Ids: LDtk wants unique `uid`s (numbers) and `iid`s (UUIDs). Both come from the map's id and the thing's place, so the
 * same map exports byte for byte the same.
 */
import type { PropValue, TileGrid, TileObject } from './grid.ts';
import type { TileSheet } from './tileset.ts';

export const LDTK_VERSION = '1.5.3';

/** A UUID-shaped id from a string (FNV-1a over four lanes): stable across exports. */
export function stableIid(key: string): string {
  const lanes = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((h, k) => {
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i) ^ (k * 131), 0x01000193) >>> 0;
    return (h >>> 0).toString(16).padStart(8, '0');
  }).join('');
  return `${lanes.slice(0, 8)}-${lanes.slice(8, 12)}-4${lanes.slice(13, 16)}-${((parseInt(lanes[16], 16) & 3) | 8).toString(16)}${lanes.slice(17, 20)}-${lanes.slice(20, 32)}`;
}

/** An LDtk identifier: a letter or `_` first, then letters, digits and `_`. */
export function ldtkIdent(s: string): string {
  const t = s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const u = t ? t[0].toUpperCase() + t.slice(1) : 'X';
  return /^[A-Za-z_]/.test(u) ? u : `_${u}`;
}

type FieldKind = 'Int' | 'Float' | 'String' | 'Bool' | 'Array<Point>';
const FIELD_TYPE: Record<FieldKind, string> = { Int: 'F_Int', Float: 'F_Float', String: 'F_String', Bool: 'F_Bool', 'Array<Point>': 'F_Point' };
const kindOf = (v: PropValue): FieldKind => (typeof v === 'boolean' ? 'Bool' : typeof v === 'number' ? (Number.isInteger(v) ? 'Int' : 'Float') : 'String');

function fieldDef(identifier: string, kind: FieldKind, uid: number): Record<string, unknown> {
  const isArray = kind === 'Array<Point>';
  return {
    identifier, doc: null, __type: kind, uid, type: FIELD_TYPE[kind], isArray, canBeNull: true, arrayMinLength: null, arrayMaxLength: null,
    editorDisplayMode: isArray ? 'PointPath' : 'Hidden', editorDisplayScale: 1, editorDisplayPos: 'Above', editorLinkStyle: 'StraightArrow',
    editorDisplayColor: null, editorAlwaysShow: false, editorShowInWorld: true, editorCutLongValues: true, editorTextSuffix: null, editorTextPrefix: null,
    useForSmartColor: false, exportToToc: false, searchable: false, min: null, max: null, regex: null, acceptFileTypes: null, defaultOverride: null,
    textLanguageMode: null, symmetricalRef: false, autoChainRef: true, allowOutOfLevelRef: true, allowedRefs: 'OnlySame', allowedRefsEntityUid: null,
    allowedRefTags: [], tilesetUid: null,
  };
}

function fieldInstance(identifier: string, kind: FieldKind, defUid: number, value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return { __identifier: identifier, __type: kind, __value: null, __tile: null, defUid, realEditorValues: [] };
  if (kind === 'String' && typeof value !== 'string') value = String(value);   // a property whose objects disagree on its type
  const real = kind === 'Array<Point>'
    ? (value as { cx: number; cy: number }[]).map(p => ({ id: 'V_String', params: [`${p.cx},${p.cy}`] }))
    : [{ id: kind === 'Int' ? 'V_Int' : kind === 'Float' ? 'V_Float' : kind === 'Bool' ? 'V_Bool' : 'V_String', params: [value] }];
  return { __identifier: identifier, __type: kind, __value: value, __tile: null, defUid, realEditorValues: real };
}

const outlineOf = (o: TileObject) => o.polygon ?? o.polyline;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface LdtkOptions {
  /** The tile sheet's path from the `.ldtk` file. */
  image: string;
  /** Tile ids per cell (−1 empty), from `resolveTiles`. */
  tiles: Int32Array;
}

/** The project as JSON data. */
export function ldtkProject(g: TileGrid, sheet: TileSheet, o: LdtkOptions): Record<string, unknown> {
  if (g.grid !== 'square' || sheet.shape !== 'square') throw new Error('LDtk has square grids only: export an isometric or hex map to Tiled');
  if (sheet.imageW !== sheet.tileW || sheet.imageH !== sheet.tileH || sheet.tileW !== sheet.tileH) throw new Error(`LDtk tiles are square cells (these are ${sheet.imageW}×${sheet.imageH} px)`);
  if (o.tiles.length !== g.cols * g.rows) throw new Error('tiles: one per cell');
  const G = sheet.tileW, key = `${g.source}:${g.id}`;
  let uid = 1;
  const next = () => uid++;
  const levelUid = next(), tilesetUid = next(), objectsUid = next(), tilesUid = next(), classesUid = next();
  const rows = Math.ceil(sheet.tiles.length / sheet.columns), solid = new Set(g.classes.filter(c => c.solid).map(c => c.id));
  const tileset = {
    __cWid: sheet.columns, __cHei: rows, identifier: ldtkIdent(sheet.name), uid: tilesetUid, relPath: o.image, embedAtlas: null,
    pxWid: sheet.columns * G, pxHei: rows * G, tileGridSize: G, spacing: 0, padding: 0, tags: [], tagsSourceEnumUid: null, enumTags: [],
    customData: sheet.tiles.map(t => ({ tileId: t.id, data: JSON.stringify({ class: t.class, ...(solid.has(t.class) && { solid: true }), ...(t.variant && { variant: t.variant }), ...(t.autotile && { autotile: t.autotile, index: t.index }), ...(t.flat && { placeholder: true }) }) })),
    savedSelections: [], cachedPixelData: null,
  };

  // one entity per object type; a field per property (the type its values share, else String) and the outline as a point path
  const types = [...new Set(g.objects.map(x => x.type))];
  const entities = types.map((type, k) => {
    const mine = g.objects.filter(x => x.type === type), fields = new Map<string, FieldKind>();
    fields.set('name', 'String');
    if (mine.some(x => x.text !== undefined)) fields.set('text', 'String');
    if (mine.some(x => x.angle)) fields.set('angle', 'Float');
    for (const x of mine) for (const [name, v] of Object.entries(x.props)) {
      const was = fields.get(name), now = kindOf(v);
      fields.set(name, !was || was === now ? now : was === 'Int' && now === 'Float' ? 'Float' : was === 'Float' && now === 'Int' ? 'Float' : 'String');
    }
    if (mine.some(outlineOf)) { fields.set('outline', 'String'); fields.set('points', 'Array<Point>'); }
    const defs = [...fields].map(([name, kind]) => ({ name, kind, uid: next() }));
    const hue = (k * 137.5) % 360, color = hsl(hue, 0.55, 0.5);
    return {
      type, defs, def: {
        identifier: ldtkIdent(type), uid: next(), tags: [mine[0].layer], exportToToc: false, allowOutOfBounds: true, doc: null,
        width: G, height: G, resizableX: true, resizableY: true, minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, keepAspectRatio: false,
        tileOpacity: 1, fillOpacity: 0.08, lineOpacity: 1, hollow: true, color, renderMode: 'Rectangle', showName: true, tilesetId: null, tileRenderMode: 'FitInside',
        tileRect: null, uiTileRect: null, nineSliceBorders: [], maxCount: 0, limitScope: 'PerLevel', limitBehavior: 'MoveLastOne', pivotX: 0, pivotY: 0,
        fieldDefs: defs.map(d => fieldDef(d.name, d.kind, d.uid)),
      },
    };
  });

  const layerDef = (identifier: string, type: 'Entities' | 'Tiles' | 'IntGrid', uidL: number, extra: Record<string, unknown> = {}) => ({
    __type: type, identifier, type, uid: uidL, doc: null, uiColor: null, gridSize: G, guideGridWid: 0, guideGridHei: 0, displayOpacity: 1, inactiveOpacity: 0.6,
    hideInList: false, hideFieldsWhenInactive: true, canSelectWhenInactive: true, renderInWorldView: true, pxOffsetX: 0, pxOffsetY: 0, parallaxFactorX: 0,
    parallaxFactorY: 0, parallaxScaling: true, requiredTags: [], excludedTags: [], autoTilesKilledByOtherLayerUid: null, uiFilterTags: [], useAsyncRender: false,
    intGridValues: [], intGridValuesGroups: [], autoRuleGroups: [], autoSourceLayerDefUid: null, tilesetDefUid: null, tilePivotX: 0, tilePivotY: 0, biomeFieldUid: null,
    ...extra,
  });
  const layers = [
    layerDef('Objects', 'Entities', objectsUid),
    layerDef('Tiles', 'Tiles', tilesUid, { tilesetDefUid: tilesetUid }),
    layerDef('Classes', 'IntGrid', classesUid, { intGridValues: g.classes.map((c, i) => ({ value: i + 1, identifier: ldtkIdent(c.id), color: c.color, tile: null, groupUid: 0 })) }),
  ];

  const levelIid = stableIid(`${key}:level`), worldIid = stableIid(`${key}:world`);
  const instance = (identifier: string, type: string, defUid: number, extra: Record<string, unknown>) => ({
    __cHei: g.rows, __cWid: g.cols, __gridSize: G, __identifier: identifier, __opacity: 1, __pxTotalOffsetX: 0, __pxTotalOffsetY: 0, __tilesetDefUid: null,
    __tilesetRelPath: null, __type: type, autoLayerTiles: [], entityInstances: [], gridTiles: [], iid: stableIid(`${key}:layer:${identifier}`), intGridCsv: [],
    layerDefUid: defUid, levelId: levelUid, optionalRules: [], overrideTilesetUid: null, pxOffsetX: 0, pxOffsetY: 0, seed: 0, visible: true, ...extra,
  });
  const entityInstances = g.objects.map((x, n) => {
    const e = entities.find(t => t.type === x.type)!, pts = outlineOf(x);
    const abs = pts ? pts.map((v, i) => v + (i % 2 ? x.y : x.x)) : [x.x, x.y];
    const xs = abs.filter((_, i) => i % 2 === 0), ys = abs.filter((_, i) => i % 2 === 1);
    const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    // a shape spans its box, a box its size; a point is one cell
    const px = [Math.round(bx * G), Math.round(by * G)], size = (v: number | undefined) => (v ? Math.max(1, Math.round(v * G)) : G);
    const width = size(pts ? bw : x.w), height = size(pts ? bh : x.h);
    const values: Record<string, unknown> = { name: x.name ?? null, text: x.text, angle: x.angle, ...x.props };
    if (pts) {
      values.outline = Array.from({ length: abs.length / 2 }, (_, i) => `${r2(abs[2 * i])},${r2(abs[2 * i + 1])}`).join(' ');
      values.points = Array.from({ length: abs.length / 2 }, (_, i) => ({ cx: Math.max(0, Math.min(g.cols - 1, Math.floor(abs[2 * i]))), cy: Math.max(0, Math.min(g.rows - 1, Math.floor(abs[2 * i + 1]))) }));
    }
    return {
      __identifier: e.def.identifier, __grid: [Math.floor(px[0] / G), Math.floor(px[1] / G)], __pivot: [0, 0], __tags: e.def.tags, __tile: null, __smartColor: e.def.color,
      __worldX: px[0], __worldY: px[1], iid: stableIid(`${key}:entity:${n}`), width, height,
      defUid: e.def.uid, px, fieldInstances: e.defs.map(d => fieldInstance(d.name, d.kind, d.uid, values[d.name])),
    };
  });
  const gridTiles: Record<string, unknown>[] = [];
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const t = o.tiles[y * g.cols + x];
    if (t < 0) continue;
    gridTiles.push({ px: [x * G, y * G], src: [(t % sheet.columns) * G, Math.floor(t / sheet.columns) * G], f: 0, t, d: [y * g.cols + x], a: 1 });
  }
  const level = {
    identifier: ldtkIdent(g.id), iid: levelIid, uid: levelUid, worldX: 0, worldY: 0, worldDepth: 0, pxWid: g.cols * G, pxHei: g.rows * G,
    __bgColor: '#1E1E24', bgColor: null, useAutoIdentifier: false, bgRelPath: null, bgPos: null, bgPivotX: 0.5, bgPivotY: 0.5, __smartColor: '#ADADB5',
    __bgPos: null, externalRelPath: null, fieldInstances: [], __neighbours: [],
    layerInstances: [
      instance('Objects', 'Entities', objectsUid, { entityInstances }),
      instance('Tiles', 'Tiles', tilesUid, { __tilesetDefUid: tilesetUid, __tilesetRelPath: o.image, gridTiles }),
      instance('Classes', 'IntGrid', classesUid, { intGridCsv: Array.from(g.cells) }),
    ],
  };
  return {
    __header__: { fileType: 'LDtk Project JSON', app: 'LDtk', doc: 'https://ldtk.io/json', schema: 'https://ldtk.io/files/JSON_SCHEMA.json', appAuthor: 'Sebastien Benard', appVersion: LDTK_VERSION, url: 'https://ldtk.io' },
    iid: stableIid(`${key}:project`), jsonVersion: LDTK_VERSION, appBuildId: 0, nextUid: uid, identifierStyle: 'Capitalize', toc: [], worldLayout: 'Free',
    worldGridWidth: g.cols * G, worldGridHeight: g.rows * G, defaultLevelWidth: g.cols * G, defaultLevelHeight: g.rows * G, defaultPivotX: 0, defaultPivotY: 0,
    defaultGridSize: G, defaultEntityWidth: G, defaultEntityHeight: G, bgColor: '#40465B', defaultLevelBgColor: '#1E1E24', minifyJson: false, externalLevels: false,
    exportTiled: false, simplifiedExport: false, imageExportMode: 'None', exportLevelBg: true, pngFilePattern: null, backupOnSave: false, backupLimit: 10, backupRelPath: null,
    levelNamePattern: 'Level_%idx', tutorialDesc: null, customCommands: [], flags: [], dummyWorldIid: worldIid,
    defs: { layers, entities: entities.map(e => e.def), tilesets: [tileset], enums: [], externalEnums: [], levelFields: [] },
    levels: [level], worlds: [],
  };
}

function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
