/**
 * Settlement map file (`art/settlements/<id>/settlement.json`): a hamlet, village, town, city or castle laid out from
 * plain shapes for a referee to run play from. It holds roads, water, walls with towers and gates, buildings, areas
 * (fields, gardens, woods, squares), trees and props on the site, and each building's floors (rooms, doors, windows,
 * furniture) for the close-up plan. The generator writes straight into this file, so the file is the whole map: the
 * CLI, the MCP server and the web tool all read and write it, and every render comes from it.
 *
 * Site coordinates are cells (x right, y down); one cell is `scale.perCell` units (default 5 ft). A building's floors
 * use plan cells of `interior.perCell` (default 5 ft) measured from the footprint's top-left corner before it is turned
 * by `angle`; with a 10 ft site cell, one site cell is 2 × 2 plan cells.
 */
import { readFormat, type Migration } from 'artgen-primitives/format.ts';
import { DOOR_KINDS, hrefError, originError, polyBox, toIssue, type Connection, type DoorKind, type Issue, type Room, type Underlay } from '../dungeon/spec.ts';
import { ROOM_SHAPES } from '../dungeon/spec.ts';
import { FIXTURES } from './fixtures.ts';

export const SETTLEMENT_KINDS = ['hamlet', 'village', 'town', 'city', 'castle'] as const;
export type SettlementKind = (typeof SETTLEMENT_KINDS)[number];

export const GROUNDS = ['grass', 'dirt', 'sand', 'snow', 'stone'] as const;
export type Ground = (typeof GROUNDS)[number];

export const STREET_PLANS = ['organic', 'grid', 'radial'] as const;
export const GEN_WALLS = ['none', 'palisade', 'stone'] as const;
export const GEN_WATERS = ['none', 'river', 'lake', 'coast', 'moat'] as const;

/** Roads, widest first: a paved highway, a cobbled street, a dirt lane, a narrow alley, a footpath, a cart track (two ruts). */
export const ROAD_KINDS = ['highway', 'street', 'lane', 'alley', 'path', 'track'] as const;
export type RoadKind = (typeof ROAD_KINDS)[number];
/** Each road kind's default width, in feet. */
export const ROAD_WIDTH_FT: Record<RoadKind, number> = { highway: 20, street: 15, lane: 10, alley: 5, path: 3, track: 8 };

/** Water: lines with a width (`river stream canal moat`) or areas (`pond lake sea`). */
export const WATER_KINDS = ['river', 'stream', 'canal', 'moat', 'pond', 'lake', 'sea'] as const;
export type WaterKind = (typeof WATER_KINDS)[number];
export const WATER_LINES: readonly WaterKind[] = ['river', 'stream', 'canal', 'moat'];
export const WATER_WIDTH_FT: Record<WaterKind, number> = { river: 40, stream: 8, canal: 20, moat: 20, pond: 0, lake: 0, sea: 0 };

/**
 * Walls: a `curtain` (a castle's thick wall walk, crenellated), `stone` (a town wall), `palisade` (stakes), `fence`
 * (posts and rails), `hedge`, `drystone` (a field wall) and `ruined` (broken stone with gaps).
 */
export const WALL_KINDS = ['curtain', 'stone', 'palisade', 'fence', 'hedge', 'drystone', 'ruined'] as const;
export type WallKind = (typeof WALL_KINDS)[number];
export const WALL_THICK_FT: Record<WallKind, number> = { curtain: 10, stone: 6, palisade: 2, fence: 1, hedge: 4, drystone: 2, ruined: 6 };

export const TOWER_SHAPES = ['round', 'square'] as const;
/** A `gatehouse` (a block over the wall with a passage, portcullis and twin towers), a `gate` (doors in the wall), a `postern` (a narrow door) or an `opening` (a gap). */
export const GATE_KINDS = ['gatehouse', 'gate', 'postern', 'opening'] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export const BUILDING_KINDS = [
  'house', 'cottage', 'shop', 'inn', 'tavern', 'smithy', 'temple', 'chapel', 'hall', 'barn', 'stable', 'mill', 'warehouse',
  'keep', 'tower', 'gatehouse', 'barracks', 'manor', 'ruin',
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];
/** Footprints: a rectangle, an L or a T (two wings), a circle, an octagon or any polygon. */
export const BUILDING_SHAPES = ['rect', 'L', 'T', 'circle', 'octagon', 'poly'] as const;
export type BuildingShape = (typeof BUILDING_SHAPES)[number];
export const ROOFS = ['gable', 'hip', 'flat', 'battlement', 'cone', 'thatch', 'none'] as const;
export type Roof = (typeof ROOFS)[number];

export const AREA_KINDS = ['field', 'garden', 'orchard', 'wood', 'scrub', 'marsh', 'graveyard', 'market', 'square', 'yard', 'paddock', 'rubble'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const TREE_KINDS = ['tree', 'conifer', 'bush', 'rock', 'boulder', 'stump', 'reeds'] as const;
export type TreeKind = (typeof TREE_KINDS)[number];

export const LABEL_KINDS = ['name', 'note', 'area', 'street'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export const CURVES = ['none', 'smooth'] as const;

export interface Origin { origin?: string }

export interface Road extends Origin { id?: string; kind: RoadKind; points: number[]; width?: number; curve?: (typeof CURVES)[number]; label?: string }
export interface Water extends Origin { id?: string; kind: WaterKind; points: number[]; width?: number }

export interface Towers { shape: (typeof TOWER_SHAPES)[number]; size?: number; at?: 'corners' | number[]; every?: number }
export interface Gate { at: [number, number]; kind: GateKind; width?: number; drawbridge?: boolean; label?: string }
/** A wall along `points` (x,y pairs), round to the first point when `closed`. `thickness` in cells (default: by kind). */
export interface SWall extends Origin { id?: string; kind: WallKind; points: number[]; closed?: boolean; thickness?: number; towers?: Towers; gates?: Gate[] }

/** A door in a floor's outer wall: a point near it (snapped onto it), a dungeon door kind or `open`, a width in plan cells (default 1). */
export interface OuterDoor { at: [number, number]; kind?: DoorKind | 'open'; width?: number }
export interface Window { at: [number, number]; width?: number }
/** Furniture or a fixture: its kind (see `fixtures.ts`), centre and size in cells (default: the kind's size), turned by `angle`. */
export interface Fixture extends Origin { kind: string; x: number; y: number; w?: number; h?: number; angle?: number; label?: string }

/** One storey: `level` 0 is the ground floor, 1 the one above, -1 a cellar. */
export interface Floor extends Origin {
  level: number;
  name?: string;
  rooms: Room[];
  connections?: Connection[];
  doors?: OuterDoor[];
  windows?: Window[];
  fixtures?: Fixture[];
}

export interface Building extends Origin {
  id: string;
  kind: BuildingKind;
  shape: BuildingShape;
  x: number; y: number; w: number; h: number;
  /** Outline for `poly` (x,y pairs, site cells, before turning); x/y/w/h are then its box. */
  points?: number[];
  /** For `L` and `T`: the wing's size in cells as [w, h] (default: half the box). */
  wing?: [number, number];
  /** Degrees clockwise about the box's centre. */
  angle?: number;
  roof?: Roof;
  stories?: number;
  label?: string;
  number?: number | false;
  href?: string;
  floors?: Floor[];
}

export interface Area extends Origin { id?: string; kind: AreaKind; points: number[]; label?: string }
export interface Tree extends Origin { kind: TreeKind; x: number; y: number; size?: number }

export interface SettlementLabel extends Origin { text: string; x: number; y: number; kind: LabelKind; size?: number; angle?: number; href?: string }
export interface SettlementSymbol extends Origin { kind: string; x: number; y: number; scale?: number; angle?: number }

export interface SettlementSpec {
  id: string;
  version: typeof SETTLEMENT_FORMAT;
  kind: SettlementKind;
  cols: number;
  rows: number;
  seed: number;
  title?: string;
  ground: Ground;
  gen: {
    /** About how many buildings (the castle's own count apart). */
    buildings: number;
    /** How tightly buildings pack along the roads (0..1). */
    density: number;
    streets: (typeof STREET_PLANS)[number];
    wall: (typeof GEN_WALLS)[number];
    water: (typeof GEN_WATERS)[number];
    /** Trees in the free ground (0..1). */
    trees: number;
    /** Fields and paddocks outside the core (0..1). */
    fields: number;
    market: boolean;
    castle: boolean;
    /** Lay out every building's floors too. */
    interiors: boolean;
  };
  grid: { show: boolean; size: number; sub: boolean };
  scale: { perCell: number; unit: string };
  /** The plan cell of the building floors (default 5 ft). */
  interior: { perCell: number };
  numbers: boolean;
  scaleBar: boolean;
  compass: boolean;
  legend?: boolean;
  furniture?: { place: 'over' | 'outside' | 'auto'; side?: 'bottom' | 'right' };
  roads: Road[];
  water: Water[];
  walls: SWall[];
  buildings: Building[];
  areas: Area[];
  trees: Tree[];
  /** Site fixtures: wells, carts, stalls, statues (the same kinds as furniture). */
  props: Fixture[];
  underlay?: Underlay;
  overlay: { labels: SettlementLabel[]; symbols: SettlementSymbol[] };
}

/** The settlement file format (`format.ts` says what bumps it). */
export const SETTLEMENT_FORMAT = 1;
const MIGRATIONS: Record<number, Migration> = {};
export const MAX_SIDE = 240;

export const KIND_DEFAULTS: Record<SettlementKind, { cols: number; rows: number; perCell: number; buildings: number; wall: SettlementSpec['gen']['wall']; castle: boolean; market: boolean }> = {
  hamlet: { cols: 50, rows: 40, perCell: 5, buildings: 7, wall: 'none', castle: false, market: false },
  village: { cols: 80, rows: 60, perCell: 5, buildings: 22, wall: 'none', castle: false, market: true },
  town: { cols: 110, rows: 90, perCell: 10, buildings: 70, wall: 'stone', castle: false, market: true },
  city: { cols: 160, rows: 130, perCell: 10, buildings: 160, wall: 'stone', castle: true, market: true },
  castle: { cols: 84, rows: 72, perCell: 5, buildings: 8, wall: 'none', castle: true, market: false },
};

export const DEFAULTS: Omit<SettlementSpec, 'id' | 'seed' | 'version' | 'kind' | 'roads' | 'water' | 'walls' | 'buildings' | 'areas' | 'trees' | 'props' | 'overlay'> = {
  cols: 80, rows: 60, ground: 'grass',
  gen: { buildings: 22, density: 0.6, streets: 'organic', wall: 'none', water: 'river', trees: 0.4, fields: 0.5, market: true, castle: false, interiors: false },
  grid: { show: true, size: 2, sub: false },
  scale: { perCell: 5, unit: 'ft' },
  interior: { perCell: 5 },
  numbers: true, scaleBar: true, compass: true,
};

/** A new settlement of a kind, with that kind's size and generator settings; `over` replaces any top-level field or merges into gen/grid/scale. */
export function newSettlement(id: string, kind: SettlementKind = 'village', over: Partial<SettlementSpec> = {}): SettlementSpec {
  const d = structuredClone(DEFAULTS), k = KIND_DEFAULTS[kind];
  const grid = { ...d.grid, size: k.perCell === 10 ? 1 : 2 };
  return parseSettlement({
    ...d, cols: k.cols, rows: k.rows, ...over, id, kind, version: SETTLEMENT_FORMAT, seed: over.seed ?? 1,
    gen: { ...d.gen, buildings: k.buildings, wall: k.wall, castle: k.castle, market: k.market, ...(kind === 'castle' && { water: 'moat' as const, fields: 0.2 }), ...over.gen },
    grid: { ...grid, ...over.grid }, scale: { ...d.scale, perCell: k.perCell, ...over.scale }, interior: { ...d.interior, ...over.interior },
    roads: over.roads ?? [], water: over.water ?? [], walls: over.walls ?? [], buildings: over.buildings ?? [], areas: over.areas ?? [],
    trees: over.trees ?? [], props: over.props ?? [], overlay: over.overlay ?? { labels: [], symbols: [] },
  });
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nums = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);
const isPoint = (v: unknown): v is [number, number] => nums(v) && v.length === 2;
const idOk = (v: unknown) => typeof v === 'string' && /^[\w-]+$/.test(v);
const pairs = (v: unknown, min: number) => nums(v) && v.length >= min * 2 && v.length % 2 === 0;

function list<T>(v: T[] | undefined, at: string, e: string[]): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { e.push(`${at}: an array`); return []; }
  return v;
}

function uniqueIds(items: { id?: unknown }[], at: string, e: string[], required = false): Set<string> {
  const seen = new Set<string>();
  items.forEach((x, i) => {
    if (x?.id === undefined) { if (required) e.push(`${at}[${i}].id: letters, digits, - and _ only`); return; }
    if (!idOk(x.id)) e.push(`${at}[${i}].id: letters, digits, - and _ only`);
    else if (seen.has(x.id as string)) e.push(`${at}[${i}].id: ${x.id} is used twice`);
    else seen.add(x.id as string);
  });
  return seen;
}

function fixtureErrors(f: Fixture, at: string, e: string[]): void {
  if (!f || typeof f !== 'object') { e.push(`${at}: {kind, x, y}`); return; }
  if (typeof f.kind !== 'string' || !FIXTURES[f.kind]) e.push(`${at}.kind: one of the fixture kinds (artgen settlement fixtures)`);
  for (const k of ['x', 'y'] as const) if (!isNum(f[k])) e.push(`${at}.${k}: a number (cells)`);
  for (const k of ['w', 'h'] as const) if (f[k] !== undefined && !(isNum(f[k]) && f[k]! > 0)) e.push(`${at}.${k}: cells, above 0`);
  if (f.angle !== undefined && !isNum(f.angle)) e.push(`${at}.angle: degrees`);
  if (f.label !== undefined && typeof f.label !== 'string') e.push(`${at}.label: text`);
  originError(f, at, e);
}

function floorErrors(fl: Floor, at: string, e: string[]): void {
  if (!fl || typeof fl !== 'object') { e.push(`${at}: {level, rooms}`); return; }
  if (!isNum(fl.level) || !Number.isInteger(fl.level)) e.push(`${at}.level: a whole number (0 ground, 1 above, -1 cellar)`);
  if (fl.name !== undefined && typeof fl.name !== 'string') e.push(`${at}.name: text`);
  const rooms = list(fl.rooms, `${at}.rooms`, e), ids = uniqueIds(rooms, `${at}.rooms`, e, true);
  if (fl.rooms === undefined) e.push(`${at}.rooms: an array`);
  rooms.forEach((r, i) => {
    const ra = `${at}.rooms[${i}]`;
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${ra}.shape: one of ${ROOM_SHAPES.join(', ')}`);
    for (const k of ['x', 'y'] as const) if (!isNum(r?.[k])) e.push(`${ra}.${k}: a number (plan cells)`);
    for (const k of ['w', 'h'] as const) if (!isNum(r?.[k]) || r[k] < 0.5) e.push(`${ra}.${k}: at least half a cell`);
    if (r?.shape === 'poly' && !pairs(r.points, 3)) e.push(`${ra}.points: at least 3 x,y pairs`);
    if (r?.label !== undefined && typeof r.label !== 'string') e.push(`${ra}.label: text`);
    if (r?.number !== undefined && r.number !== false && !isNum(r.number)) e.push(`${ra}.number: a number or false`);
    originError(r, ra, e);
  });
  list(fl.connections, `${at}.connections`, e).forEach((c, i) => {
    const ca = `${at}.connections[${i}]`;
    if (!c || typeof c !== 'object') { e.push(`${ca}: {a, b, kind?}`); return; }
    for (const k of ['a', 'b'] as const) if (!ids.has(c[k])) e.push(`${ca}.${k}: no room ${JSON.stringify(c[k])}`);
    if (c.a === c.b) e.push(`${ca}: a room cannot connect to itself`);
    if (c.at !== undefined && !isPoint(c.at)) e.push(`${ca}.at: [x, y]`);
    if (c.kind !== undefined && c.kind !== 'open' && !DOOR_KINDS.includes(c.kind)) e.push(`${ca}.kind: open or one of ${DOOR_KINDS.join(', ')}`);
    if (c.width !== undefined && !(isNum(c.width) && c.width >= 0.5 && c.width <= 20)) e.push(`${ca}.width: 0.5..20`);
  });
  list(fl.doors, `${at}.doors`, e).forEach((d, i) => {
    const da = `${at}.doors[${i}]`;
    if (!isPoint(d?.at)) e.push(`${da}.at: [x, y] in plan cells`);
    if (d?.kind !== undefined && d.kind !== 'open' && !DOOR_KINDS.includes(d.kind)) e.push(`${da}.kind: open or one of ${DOOR_KINDS.join(', ')}`);
    if (d?.width !== undefined && !(isNum(d.width) && d.width > 0)) e.push(`${da}.width: cells, above 0`);
  });
  list(fl.windows, `${at}.windows`, e).forEach((w, i) => {
    if (!isPoint(w?.at)) e.push(`${at}.windows[${i}].at: [x, y] in plan cells`);
    if (w?.width !== undefined && !(isNum(w.width) && w.width > 0)) e.push(`${at}.windows[${i}].width: cells, above 0`);
  });
  list(fl.fixtures, `${at}.fixtures`, e).forEach((f, i) => fixtureErrors(f, `${at}.fixtures[${i}]`, e));
  originError(fl, at, e);
}

/** Every problem with a settlement file, as readable messages (empty when it is valid). */
export function validateSettlement(raw: unknown): string[] {
  const e: string[] = [];
  if (!raw || typeof raw !== 'object') return ['settlement: expected an object'];
  const m = raw as Partial<SettlementSpec>;
  if (!idOk(m.id)) e.push('id: letters, digits, - and _ only');
  if (!SETTLEMENT_KINDS.includes(m.kind!)) e.push(`kind: one of ${SETTLEMENT_KINDS.join(', ')}`);
  for (const k of ['cols', 'rows'] as const) if (!isNum(m[k]) || m[k]! < 4 || m[k]! > MAX_SIDE || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE}`);
  if (!isNum(m.seed)) e.push('seed: a number');
  if (m.title !== undefined && typeof m.title !== 'string') e.push('title: text');
  if (!GROUNDS.includes(m.ground!)) e.push(`ground: one of ${GROUNDS.join(', ')}`);
  const g = m.gen;
  if (!g || typeof g !== 'object') e.push('gen: required');
  else {
    if (!isNum(g.buildings) || g.buildings < 0 || g.buildings > 600) e.push('gen.buildings: 0..600');
    for (const k of ['density', 'trees', 'fields'] as const) if (!isNum(g[k]) || g[k] < 0 || g[k] > 1) e.push(`gen.${k}: 0..1`);
    if (!STREET_PLANS.includes(g.streets)) e.push(`gen.streets: ${STREET_PLANS.join(', ')}`);
    if (!GEN_WALLS.includes(g.wall)) e.push(`gen.wall: ${GEN_WALLS.join(', ')}`);
    if (!GEN_WATERS.includes(g.water)) e.push(`gen.water: ${GEN_WATERS.join(', ')}`);
    for (const k of ['market', 'castle', 'interiors'] as const) if (typeof g[k] !== 'boolean') e.push(`gen.${k}: true or false`);
  }
  if (!m.grid || typeof m.grid.show !== 'boolean' || !isNum(m.grid.size) || m.grid.size < 0.5 || typeof m.grid.sub !== 'boolean') e.push('grid: show, size ≥ 0.5 (cells), sub (true|false)');
  if (!m.scale || !isNum(m.scale.perCell) || m.scale.perCell <= 0 || typeof m.scale.unit !== 'string') e.push('scale: perCell (above 0) and unit');
  if (!m.interior || !isNum(m.interior.perCell) || m.interior.perCell <= 0) e.push('interior.perCell: plan cell size, above 0');
  for (const k of ['numbers', 'scaleBar', 'compass'] as const) if (typeof m[k] !== 'boolean') e.push(`${k}: true or false`);
  if (m.legend !== undefined && typeof m.legend !== 'boolean') e.push('legend: true or false');
  const f = m.furniture;
  if (f !== undefined && (!f || typeof f !== 'object' || !['over', 'outside', 'auto'].includes(f.place) || (f.side !== undefined && !['bottom', 'right'].includes(f.side))))
    e.push('furniture: {place: over|outside|auto, side?: bottom|right}');

  const roads = list(m.roads, 'roads', e);
  uniqueIds(roads, 'roads', e);
  roads.forEach((r, i) => {
    const at = `roads[${i}]`;
    if (!ROAD_KINDS.includes(r?.kind)) e.push(`${at}.kind: one of ${ROAD_KINDS.join(', ')}`);
    if (!pairs(r?.points, 2)) e.push(`${at}.points: at least 2 x,y pairs`);
    if (r?.width !== undefined && !(isNum(r.width) && r.width > 0 && r.width <= 20)) e.push(`${at}.width: cells, above 0 and at most 20`);
    if (r?.curve !== undefined && !CURVES.includes(r.curve)) e.push(`${at}.curve: ${CURVES.join(' or ')}`);
    if (r?.label !== undefined && typeof r.label !== 'string') e.push(`${at}.label: text`);
    originError(r, at, e);
  });
  const water = list(m.water, 'water', e);
  uniqueIds(water, 'water', e);
  water.forEach((w, i) => {
    const at = `water[${i}]`;
    if (!WATER_KINDS.includes(w?.kind)) e.push(`${at}.kind: one of ${WATER_KINDS.join(', ')}`);
    else if (!pairs(w?.points, WATER_LINES.includes(w.kind) ? 2 : 3)) e.push(`${at}.points: at least ${WATER_LINES.includes(w.kind) ? 2 : 3} x,y pairs`);
    if (w?.width !== undefined && !(isNum(w.width) && w.width > 0 && w.width <= 60)) e.push(`${at}.width: cells, above 0 and at most 60`);
    originError(w, at, e);
  });
  const walls = list(m.walls, 'walls', e);
  uniqueIds(walls, 'walls', e);
  walls.forEach((w, i) => {
    const at = `walls[${i}]`;
    if (!w || typeof w !== 'object') { e.push(`${at}: {kind, points}`); return; }
    if (!WALL_KINDS.includes(w.kind)) e.push(`${at}.kind: one of ${WALL_KINDS.join(', ')}`);
    if (!pairs(w.points, 2)) e.push(`${at}.points: at least 2 x,y pairs`);
    if (w.closed !== undefined && typeof w.closed !== 'boolean') e.push(`${at}.closed: true or false`);
    if (w.closed && nums(w.points) && w.points.length < 6) e.push(`${at}.closed: a closed wall needs 3 points or more`);
    if (w.thickness !== undefined && !(isNum(w.thickness) && w.thickness > 0 && w.thickness <= 6)) e.push(`${at}.thickness: cells, above 0 and at most 6`);
    const t = w.towers;
    if (t !== undefined) {
      if (!t || !TOWER_SHAPES.includes(t.shape)) e.push(`${at}.towers.shape: ${TOWER_SHAPES.join(' or ')}`);
      if (t?.size !== undefined && !(isNum(t.size) && t.size > 0)) e.push(`${at}.towers.size: cells, above 0`);
      if (t?.at !== undefined && t.at !== 'corners' && !(nums(t.at) && t.at.every(Number.isInteger))) e.push(`${at}.towers.at: "corners" or vertex indices`);
      if (t?.every !== undefined && !(isNum(t.every) && t.every >= 2)) e.push(`${at}.towers.every: cells between towers, 2 or more`);
    }
    list(w.gates, `${at}.gates`, e).forEach((gt, j) => {
      const ga = `${at}.gates[${j}]`;
      if (!isPoint(gt?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS.includes(gt?.kind)) e.push(`${ga}.kind: one of ${GATE_KINDS.join(', ')}`);
      if (gt?.width !== undefined && !(isNum(gt.width) && gt.width > 0)) e.push(`${ga}.width: cells, above 0`);
      if (gt?.drawbridge !== undefined && typeof gt.drawbridge !== 'boolean') e.push(`${ga}.drawbridge: true or false`);
    });
    originError(w, at, e);
  });
  const buildings = list(m.buildings, 'buildings', e);
  if (m.buildings === undefined) e.push('buildings: an array');
  uniqueIds(buildings, 'buildings', e, true);
  buildings.forEach((b, i) => {
    const at = `buildings[${i}]`;
    if (!b || typeof b !== 'object') { e.push(`${at}: {id, kind, shape, x, y, w, h}`); return; }
    if (!BUILDING_KINDS.includes(b.kind)) e.push(`${at}.kind: one of ${BUILDING_KINDS.join(', ')}`);
    if (!BUILDING_SHAPES.includes(b.shape)) e.push(`${at}.shape: one of ${BUILDING_SHAPES.join(', ')}`);
    for (const k of ['x', 'y'] as const) if (!isNum(b[k])) e.push(`${at}.${k}: a number (cells)`);
    for (const k of ['w', 'h'] as const) if (!isNum(b[k]) || b[k] < 0.5) e.push(`${at}.${k}: at least half a cell`);
    if (b.shape === 'poly' && !pairs(b.points, 3)) e.push(`${at}.points: at least 3 x,y pairs`);
    if (b.wing !== undefined && !(isPoint(b.wing) && b.wing[0] > 0 && b.wing[1] > 0 && b.wing[0] < b.w && b.wing[1] < b.h)) e.push(`${at}.wing: [w, h], each above 0 and less than the box`);
    if (b.angle !== undefined && !isNum(b.angle)) e.push(`${at}.angle: degrees`);
    if (b.roof !== undefined && !ROOFS.includes(b.roof)) e.push(`${at}.roof: one of ${ROOFS.join(', ')}`);
    if (b.stories !== undefined && !(Number.isInteger(b.stories) && b.stories >= 1 && b.stories <= 12)) e.push(`${at}.stories: 1..12`);
    if (b.label !== undefined && typeof b.label !== 'string') e.push(`${at}.label: text`);
    if (b.number !== undefined && b.number !== false && !isNum(b.number)) e.push(`${at}.number: a number or false`);
    if (b.href !== undefined && hrefError(b.href)) e.push(`${at}.href: ${hrefError(b.href)}`);
    const floors = list(b.floors, `${at}.floors`, e), levels = new Set<number>();
    floors.forEach((fl, j) => {
      floorErrors(fl, `${at}.floors[${j}]`, e);
      if (isNum(fl?.level)) { if (levels.has(fl.level)) e.push(`${at}.floors[${j}].level: level ${fl.level} is used twice`); levels.add(fl.level); }
    });
    originError(b, at, e);
  });
  const areas = list(m.areas, 'areas', e);
  uniqueIds(areas, 'areas', e);
  areas.forEach((a, i) => {
    const at = `areas[${i}]`;
    if (!AREA_KINDS.includes(a?.kind)) e.push(`${at}.kind: one of ${AREA_KINDS.join(', ')}`);
    if (!pairs(a?.points, 3)) e.push(`${at}.points: at least 3 x,y pairs`);
    if (a?.label !== undefined && typeof a.label !== 'string') e.push(`${at}.label: text`);
    originError(a, at, e);
  });
  list(m.trees, 'trees', e).forEach((t, i) => {
    const at = `trees[${i}]`;
    if (!TREE_KINDS.includes(t?.kind)) e.push(`${at}.kind: one of ${TREE_KINDS.join(', ')}`);
    for (const k of ['x', 'y'] as const) if (!isNum(t?.[k])) e.push(`${at}.${k}: a number (cells)`);
    if (t?.size !== undefined && !(isNum(t.size) && t.size > 0)) e.push(`${at}.size: cells across, above 0`);
    originError(t, at, e);
  });
  list(m.props, 'props', e).forEach((p, i) => fixtureErrors(p, `props[${i}]`, e));
  const u = m.underlay;
  if (u !== undefined) {
    if (!u || typeof u !== 'object' || typeof u.map !== 'string' || !u.map) e.push('underlay.map: the map file\'s path');
    else {
      if (!isPoint(u.origin)) e.push('underlay.origin: [x, y] in map units');
      if (!isNum(u.scale) || u.scale <= 0) e.push('underlay.scale: map units in one cell, above 0');
      if (u.theme !== undefined && u.theme !== 'color' && u.theme !== 'bw') e.push('underlay.theme: color or bw');
    }
  }
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push('overlay: { labels: [], symbols: [] }');
  else {
    o.labels.forEach((l, i) => {
      if (typeof l?.text !== 'string' || !isNum(l.x) || !isNum(l.y) || !LABEL_KINDS.includes(l.kind)) { e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS.join('|')})`); return; }
      if (l.href !== undefined && hrefError(l.href)) e.push(`overlay.labels[${i}].href: ${hrefError(l.href)}`);
      originError(l, `overlay.labels[${i}]`, e);
    });
    o.symbols.forEach((s, i) => { if (typeof s?.kind !== 'string' || !isNum(s.x) || !isNum(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`); else originError(s, `overlay.symbols[${i}]`, e); });
  }
  return e;
}

/** Fill the defaults into a file already read at the current format. */
function withDefaults(r: Partial<SettlementSpec>): SettlementSpec {
  const d = DEFAULTS;
  const box = <T extends { shape: string; points?: number[]; x?: number }>(x: T): T => (x?.shape === 'poly' && Array.isArray(x.points) && x.points.length >= 6 && x.x === undefined ? { ...x, ...polyBox(x.points) } : x);
  const buildings = (Array.isArray(r.buildings) ? r.buildings : []).map(b => {
    const bb = box(b);
    return Array.isArray(bb?.floors) ? { ...bb, floors: bb.floors.map(fl => (fl && Array.isArray(fl.rooms) ? { ...fl, rooms: fl.rooms.map(box) } : fl)) } : bb;
  });
  return {
    ...structuredClone(d), ...r, kind: r.kind ?? 'village', version: SETTLEMENT_FORMAT,
    gen: { ...d.gen, ...r.gen }, grid: { ...d.grid, ...r.grid }, scale: { ...d.scale, ...r.scale }, interior: { ...d.interior, ...r.interior },
    roads: r.roads ?? [], water: r.water ?? [], walls: r.walls ?? [], buildings, areas: r.areas ?? [], trees: r.trees ?? [], props: r.props ?? [],
    overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] },
  } as SettlementSpec;
}

/** Fill missing fields from the defaults (older or hand-written files), then validate; throws on errors. */
export function parseSettlement(raw: unknown): SettlementSpec {
  const r = readFormat(raw, 'settlement', SETTLEMENT_FORMAT, MIGRATIONS) as Partial<SettlementSpec>, m = withDefaults(r);
  const errors = validateSettlement(m);
  if (errors.length) throw new Error(`invalid settlement${typeof r.id === 'string' ? ` ${r.id}` : ''}:\n  ${errors.join('\n  ')}`);
  return m;
}

/** Every problem with a settlement file as written by a consumer (not yet filled with defaults), each with its JSON path. */
export function checkSettlement(raw: unknown): { version: number | null; errors: Issue[] } {
  let r: Partial<SettlementSpec>;
  try { r = readFormat(raw, 'settlement', SETTLEMENT_FORMAT, MIGRATIONS) as Partial<SettlementSpec>; } catch (err) {
    const v = (raw as { version?: unknown } | null)?.version;
    return { version: typeof v === 'number' ? v : null, errors: [{ path: 'version', message: (err as Error).message }] };
  }
  return { version: SETTLEMENT_FORMAT, errors: validateSettlement(withDefaults(r)).map(toIssue) };
}

/** The next free id with a prefix (`b1`, `b2`, …) among items that may have ids. */
export function nextId(items: { id?: string }[], prefix: string): string {
  const used = new Set(items.flatMap(x => (x.id ? [x.id] : [])));
  for (let n = 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

/** Plan cells in one site cell. */
export const planFactor = (spec: Pick<SettlementSpec, 'scale' | 'interior'>): number => spec.scale.perCell / spec.interior.perCell;

/** Feet (or the sheet's unit) as site cells. */
export const unitsToCells = (spec: Pick<SettlementSpec, 'scale'>, v: number): number => v / spec.scale.perCell;

/** A building's default roof, by kind. */
export function roofOf(b: Pick<Building, 'kind' | 'shape' | 'roof'>): Roof {
  if (b.roof) return b.roof;
  if (b.kind === 'ruin') return 'none';
  if (b.kind === 'keep' || b.kind === 'gatehouse' || b.kind === 'barracks') return 'battlement';
  if (b.kind === 'tower') return b.shape === 'circle' || b.shape === 'octagon' ? 'cone' : 'battlement';
  if (b.shape === 'circle' || b.shape === 'octagon') return 'cone';
  if (b.kind === 'cottage' || b.kind === 'barn') return 'thatch';
  if (b.kind === 'temple' || b.kind === 'hall' || b.kind === 'manor') return 'hip';
  return 'gable';
}

/** A building's floor at a level, if it has one. */
export const floorAt = (b: Building, level: number): Floor | undefined => b.floors?.find(f => f.level === level);

/** The floor drawn when a building is shown cut away on the site: the ground floor, else the lowest above ground, else the lowest. */
export function groundFloor(b: Building): Floor | undefined {
  const fl = [...(b.floors ?? [])].sort((p, q) => p.level - q.level);
  return fl.find(f => f.level === 0) ?? fl.find(f => f.level > 0) ?? fl[0];
}

/** A floor's name: its own, else by level. */
export const floorName = (f: Pick<Floor, 'level' | 'name'>): string => f.name ?? (f.level === 0 ? 'Ground floor' : f.level < 0 ? (f.level === -1 ? 'Cellar' : `Cellar ${-f.level}`) : f.level === 1 ? 'Upper floor' : `Floor ${f.level}`);

/** Remove a building by id (in place); whether it was there. */
export function removeBuilding(m: SettlementSpec, id: string): boolean {
  const n = m.buildings.length;
  m.buildings = m.buildings.filter(b => b.id !== id);
  return m.buildings.length !== n;
}
