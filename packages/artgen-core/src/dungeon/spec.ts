/**
 * Dungeon map file (`art/dungeons/<id>/dungeon.json`): a TTRPG dungeon or lair as rooms, the corridors that join them
 * and an overlay of labels and symbols. The generator writes rooms and corridors straight into this file, so the file is
 * the whole map: the CLI, the MCP server and the web tool all read and write it, and every render comes from it.
 *
 * Coordinates are grid cells (x right, y down); by default one cell is 5 ft. A room's `x, y` is its top-left corner.
 */
import { readFormat, type Migration } from '../format.ts';

export const ROOM_SHAPES = ['rect', 'circle', 'octagon', 'cave', 'poly'] as const;
export type RoomShape = (typeof ROOM_SHAPES)[number];

export const DOOR_KINDS = ['door', 'secret', 'locked', 'portcullis', 'arch'] as const;
export type DoorKind = (typeof DOOR_KINDS)[number];

export const DOOR_NAMES: Record<DoorKind, string> = {
  door: 'Door', secret: 'Secret door', locked: 'Locked door', portcullis: 'Portcullis / bars', arch: 'Archway',
};

/** auto: straight when the rooms line up, else an elbow; hv / vh: across then down / down then across; straight: one line; around: along the grid, round the rooms in the way. */
export const ROUTES = ['auto', 'hv', 'vh', 'straight', 'around'] as const;
export type Route = (typeof ROUTES)[number];

/** A room's walls: north (top), east, south, west. */
export const SIDES = ['n', 'e', 's', 'w'] as const;
export type Side = (typeof SIDES)[number];

/** `built`: straight walls, the corridor's width all along; `natural`: a passage with rough, uneven walls (a cave tunnel). */
export const CORRIDOR_STYLES = ['built', 'natural'] as const;
export type CorridorStyle = (typeof CORRIDOR_STYLES)[number];
export const CURVES = ['none', 'smooth'] as const;
export type Curve = (typeof CURVES)[number];

export const HATCH_STYLES = ['band', 'full', 'none'] as const;
export type HatchStyle = (typeof HATCH_STYLES)[number];

export const LABEL_KINDS = ['name', 'note', 'area'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

/** What a room is: `floor` (a dungeon room), `building` (roofed, a plain tone, thin walls), `yard` (open ground, no walls, the underlay showing through) or `cellar` (a dashed outline, drawn above everything else). */
export const ROOM_FILLS = ['floor', 'building', 'yard', 'cellar'] as const;
export type RoomFill = (typeof ROOM_FILLS)[number];

export const WALL_TOWER_SHAPES = ['round', 'square'] as const;
export const GATE_KINDS = ['gate', 'postern'] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export interface Room {
  id: string;
  shape: RoomShape;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Outline for `poly` rooms (x,y pairs, cells); x/y/w/h are then its bounding box. */
  points?: number[];
  /** Outline seed for `cave` rooms (defaults to one derived from the room id). */
  seed?: number;
  /** A name written in the room. */
  label?: string;
  /** The number on the room's badge; `false` hides it. Unset rooms are numbered in file order. */
  number?: number | false;
  /** What the room is (default `floor`). */
  fill?: RoomFill;
  /** A link from the room's number and name (see {@link hrefError} for what is allowed). */
  href?: string;
  /** Who wrote the entry; none means a hand entry (see `sync`). Optional, so the format version is unchanged. */
  origin?: string;
  /** The fields a hand edit changed on an entry of some origin (`["x"]`); a sync reports them when it takes the origin's value back. */
  hand?: string[];
}

/**
 * A corridor end: a room, a point, or another corridor.
 * - `{room}`: from the room's centre; with `side` it leaves through that wall instead, `offset` cells along it from the
 *   room's top or left edge (default: the middle), so several corridors can leave one room by different walls.
 * - `{at: [x, y]}`: a point (an exit stub, a dead end, or off the map). With `exit`, the corridor fades to white over
 *   its last `fade` cells before the point (or the sheet's edge, if the point is past it) and a boxed note there says
 *   where it leads (`text`, a link with `href`).
 * - `{corridor: id}`: a junction on that corridor's centre line, the point nearest the other end (or `near`), so
 *   corridors meet in a T or a cross.
 */
export type CorridorEnd = { room: string; side?: Side; offset?: number } | { at: [number, number]; exit?: Exit } | { corridor: string; near?: [number, number] };

/** Where an exit leads: the note at the map's edge, an optional link, and the cells the corridor fades over (default 3). */
export interface Exit { text: string; href?: string; fade?: number }

export interface Corridor {
  /** A name other corridors can join (`{corridor: id}`); indexes move when corridors are removed, ids do not. */
  id?: string;
  from: CorridorEnd;
  to: CorridorEnd;
  /** Width in cells (default 1). */
  width?: number;
  /** auto: straight when the rooms line up, else an elbow; hv: across then down; vh: down then across. */
  route?: Route;
  /** Bend points (x,y pairs) between the two ends; when set the corridor runs straight through them. */
  via?: number[];
  /** `smooth`: a curve through the ends and bends instead of straight runs (default `none`). */
  curve?: Curve;
  /** `natural`: rough, uneven walls (default `built`). */
  style?: CorridorStyle;
  /** The seed of a natural corridor's walls (default: from its id or index). */
  seed?: number;
  /** A door where the corridor leaves each end (null or unset: an open passage). */
  doors?: [DoorKind | null, DoorKind | null];
  origin?: string;
}

/** A label; `href` makes it a link (see {@link hrefError}). */
/**
 * A door, or an opening, in the wall two rooms share: rooms that touch are joined directly, with no corridor. `at` is a
 * point on the shared wall (default: the middle of its longest stretch), `width` the opening in cells (default 1) and
 * `kind` a door kind or `open` (a gap in the wall). Rooms that touch and have no connection keep the wall between them.
 */
export interface Connection { a: string; b: string; at?: [number, number]; kind?: DoorKind | 'open'; width?: number; origin?: string }

export interface DungeonLabel { text: string; x: number; y: number; kind: LabelKind; size?: number; angle?: number; href?: string; origin?: string }
export interface DungeonSymbol { kind: string; x: number; y: number; scale?: number; angle?: number; origin?: string }

/**
 * The ground under the rooms: a map file's terrain, contours and roads, cropped to the dungeon's extent. `map` is the
 * map file's path (from this file's folder), `origin` the map unit at the dungeon's top-left corner, and `scale` the
 * map units in one dungeon cell (a 5 ft cell on a 10 ft sheet: 0.5). The map's own legend, title, compass and scale bar
 * are not drawn.
 */
export interface Underlay { map: string; origin: [number, number]; scale: number; theme?: 'color' | 'bw' }

/** Towers on a wall: `round` or `square`, `size` cells across (default 3), at the hull's corners or at the listed vertex indices. */
export interface WallTowers { shape: (typeof WALL_TOWER_SHAPES)[number]; size?: number; at?: 'corners' | number[] }
/** A gate or postern: a point near the wall (snapped onto it), the room it opens into and its width in cells (default 2, a postern 1). A gate has a tower each side, a postern none. */
export interface WallGate { at: [number, number]; kind: GateKind; room?: string; width?: number }
/** An enclosing wall: round the hull of `rooms` plus `inset` cells (default 1), or along `poly` as given. */
export interface Wall { id?: string; rooms?: string[]; poly?: number[]; thickness?: number; inset?: number; towers?: WallTowers; gates?: WallGate[]; origin?: string }


export interface DungeonSpec {
  id: string;
  version: typeof DUNGEON_FORMAT;
  cols: number;
  rows: number;
  seed: number;
  title?: string;
  gen: {
    rooms: number;
    minSize: number;
    maxSize: number;
    /** Share of irregular cave rooms (0..1). */
    caves: number;
    /** Share of round and octagonal rooms (0..1). */
    round: number;
    /** Extra links beyond the ones that join every room (0..1: none to many loops). */
    loops: number;
    /** Share of corridor ends with a door (0..1). */
    doors: number;
    corridorWidth: number;
    /** Empty cells kept between rooms. */
    spacing: number;
    /** A corridor from the first room off the nearest edge of the map. */
    entrance: boolean;
  };
  /** Grid lines every `size` cells (2 = 10 ft), with fainter lines at every cell when `sub`; on the floor or everywhere. */
  grid: { show: boolean; size: number; sub: boolean; clip: 'floor' | 'all' };
  /** Rock around the rooms: a band of hatching along the walls, hatching everywhere, or plain paper. */
  style: { hatch: HatchStyle; band: number; wall: number };
  scale: { perCell: number; unit: string };
  numbers: boolean;
  scaleBar: boolean;
  compass: boolean;
  rooms: Room[];
  corridors: Corridor[];
  /** Optional: doors and openings in the walls rooms share (see {@link Connection}). */
  connections?: Connection[];
  overlay: { labels: DungeonLabel[]; symbols: DungeonSymbol[] };
  /** Optional: the ground under the rooms (see {@link Underlay}). */
  underlay?: Underlay;
  /** Optional: walls, towers and gates (see {@link Wall}). */
  walls?: Wall[];
  /** A key of the symbols used, in the corner (default off). */
  legend?: boolean;
  /**
   * Where the title, scale bar, compass and legend go: `over` the map in its corners (the default), `outside` in a band
   * below or right of the map, or `auto`: in the band only when the corner would cover a room, corridor or mark.
   */
  furniture?: { place: 'over' | 'outside' | 'auto'; side?: 'bottom' | 'right' };
}

export const DEFAULTS: Omit<DungeonSpec, 'id' | 'seed' | 'version' | 'rooms' | 'corridors' | 'overlay'> = {
  cols: 40, rows: 30,
  gen: { rooms: 8, minSize: 3, maxSize: 8, caves: 0.15, round: 0.1, loops: 0.25, doors: 0.6, corridorWidth: 1, spacing: 2, entrance: true },
  grid: { show: true, size: 2, sub: true, clip: 'floor' },
  style: { hatch: 'band', band: 0.9, wall: 1 },
  scale: { perCell: 5, unit: 'ft' },
  numbers: true, scaleBar: true, compass: false,
};

/** The dungeon file format (`format.ts` says what bumps it). */
export const DUNGEON_FORMAT = 1;

const MIGRATIONS: Record<number, Migration> = {};

export const MAX_SIDE = 160;

/** A new dungeon with the defaults; `over` replaces any top-level field or merges into gen/grid/style/scale. */
export function newDungeon(id: string, over: Partial<DungeonSpec> = {}): DungeonSpec {
  const d = structuredClone(DEFAULTS);
  return parseDungeon({
    ...d, ...over, id, version: DUNGEON_FORMAT, seed: over.seed ?? 1,
    gen: { ...d.gen, ...over.gen }, grid: { ...d.grid, ...over.grid }, style: { ...d.style, ...over.style }, scale: { ...d.scale, ...over.scale },
    rooms: over.rooms ?? [], corridors: over.corridors ?? [], overlay: over.overlay ?? { labels: [], symbols: [] },
  });
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nums = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);
const isPoint = (v: unknown): v is [number, number] => nums(v) && v.length === 2;

function endErrors(e: unknown, at: string, ids: Set<string>, corridorIds: Set<string>): string[] {
  const shape = `${at}: {room: id}, {at: [x, y]} or {corridor: id}`;
  if (!e || typeof e !== 'object') return [shape];
  const o = e as Record<string, unknown>, out: string[] = [];
  if ('room' in o) {
    if (!ids.has(o.room as string)) out.push(`${at}.room: no room ${JSON.stringify(o.room)}`);
    if (o.side !== undefined && !SIDES.includes(o.side as Side)) out.push(`${at}.side: ${SIDES.join(', ')}`);
    if (o.offset !== undefined && !(isNum(o.offset) && o.offset >= 0)) out.push(`${at}.offset: cells along the wall, 0 or more`);
    if (o.offset !== undefined && o.side === undefined) out.push(`${at}.offset: goes with side`);
    return out;
  }
  if ('at' in o) {
    if (!isPoint(o.at)) out.push(`${at}.at: [x, y]`);
    const x = o.exit as Partial<Exit> | undefined;
    if (x !== undefined) {
      if (!x || typeof x !== 'object' || typeof x.text !== 'string') out.push(`${at}.exit: {text, href?, fade?}`);
      else {
        if (x.href !== undefined && hrefError(x.href)) out.push(`${at}.exit.href: ${hrefError(x.href)}`);
        if (x.fade !== undefined && !(isNum(x.fade) && x.fade >= 0 && x.fade <= 20)) out.push(`${at}.exit.fade: cells, 0..20`);
      }
    }
    return out;
  }
  if ('corridor' in o) {
    if (typeof o.corridor !== 'string' || !corridorIds.has(o.corridor)) out.push(`${at}.corridor: no corridor with id ${JSON.stringify(o.corridor)}`);
    if (o.near !== undefined && !isPoint(o.near)) out.push(`${at}.near: [x, y]`);
    return out;
  }
  return [shape];
}

/** The corridors each corridor joins (`{corridor: id}` ends), by index. */
export function corridorDeps(corridors: Corridor[]): number[][] {
  const byId = new Map(corridors.flatMap((c, i) => (typeof c?.id === 'string' ? [[c.id, i] as const] : [])));
  return corridors.map(c => [c?.from, c?.to].flatMap(e => (e && typeof e === 'object' && 'corridor' in e && byId.has(e.corridor) ? [byId.get(e.corridor)!] : [])));
}

/** Corridor indexes in an order where each comes after the corridors it joins; null when they join in a ring. */
export function corridorOrder(corridors: Corridor[]): number[] | null {
  const deps = corridorDeps(corridors), state = corridors.map(() => 0), out: number[] = [];
  const visit = (i: number): boolean => {
    if (state[i] === 2) return true;
    if (state[i] === 1) return false;
    state[i] = 1;
    for (const d of deps[i]) if (!visit(d)) return false;
    state[i] = 2; out.push(i);
    return true;
  };
  for (let i = 0; i < corridors.length; i++) if (!visit(i)) return null;
  return out;
}

/**
 * What is wrong with a link, or null when it is fine: an `http:` or `https:` address, a path relative to the map (another
 * page or map: `level-2.svg#M.14`) or an `#anchor`. Other schemes (`javascript:`, `data:`, `file:`) are refused, so a
 * map can be opened without running anything.
 */
export function hrefError(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return 'a link: http(s)://…, a relative path or #anchor';
  if (/[\s<>"'`]|[\u0000-\u001f]/.test(v)) return 'a link with no spaces, quotes or angle brackets';
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return `http(s) links only, not ${scheme}:`;
  if (v.startsWith('//')) return 'a full http(s):// address, not one starting //';
  return null;
}

/** `origin`, when an entry has one, is a non-empty string. */
export function originError(entry: unknown, at: string, e: string[]): void {
  const v = (entry as { origin?: unknown } | null)?.origin;
  if (v !== undefined && (typeof v !== 'string' || !v)) e.push(`${at}.origin: a non-empty string`);
}

function enclosureErrors(m: Partial<DungeonSpec>, ids: Set<string>): string[] {
  const e: string[] = [];
  if (m.legend !== undefined && typeof m.legend !== 'boolean') e.push('legend: true or false');
  const f = m.furniture;
  if (f !== undefined && (!f || typeof f !== 'object' || !['over', 'outside', 'auto'].includes(f.place) || (f.side !== undefined && !['bottom', 'right'].includes(f.side))))
    e.push('furniture: {place: over|outside|auto, side?: bottom|right}');
  const u = m.underlay;
  if (u !== undefined) {
    if (!u || typeof u !== 'object' || typeof u.map !== 'string' || !u.map) e.push('underlay.map: the map file\'s path');
    else {
      if (!isPoint(u.origin)) e.push('underlay.origin: [x, y] in map units');
      if (!isNum(u.scale) || u.scale <= 0) e.push('underlay.scale: map units in one cell, above 0');
      if (u.theme !== undefined && u.theme !== 'color' && u.theme !== 'bw') e.push('underlay.theme: color or bw');
    }
  }
  const walls = m.walls;
  if (walls === undefined) return e;
  if (!Array.isArray(walls)) return [...e, 'walls: an array'];
  walls.forEach((w, i) => {
    const at = `walls[${i}]`;
    if (!w || typeof w !== 'object') { e.push(`${at}: an object`); return; }
    if (w.rooms !== undefined) {
      if (!Array.isArray(w.rooms) || !w.rooms.length) e.push(`${at}.rooms: room ids`);
      else for (const r of w.rooms) if (!ids.has(r)) e.push(`${at}.rooms: no room ${JSON.stringify(r)}`);
    }
    if (w.poly !== undefined && !(nums(w.poly) && w.poly.length >= 6 && w.poly.length % 2 === 0)) e.push(`${at}.poly: at least 3 x,y pairs`);
    if (w.rooms === undefined && w.poly === undefined) e.push(`${at}: rooms (ids) or poly`);
    if (w.thickness !== undefined && !(isNum(w.thickness) && w.thickness > 0 && w.thickness <= 4)) e.push(`${at}.thickness: cells, above 0 and at most 4`);
    if (w.inset !== undefined && !(isNum(w.inset) && w.inset >= 0)) e.push(`${at}.inset: cells, 0 or more`);
    const t = w.towers;
    if (t !== undefined) {
      if (!t || !WALL_TOWER_SHAPES.includes(t.shape)) e.push(`${at}.towers.shape: ${WALL_TOWER_SHAPES.join(' or ')}`);
      if (t?.size !== undefined && !(isNum(t.size) && t.size > 0)) e.push(`${at}.towers.size: cells, above 0`);
      if (t?.at !== undefined && t.at !== 'corners' && !(nums(t.at) && t.at.every(Number.isInteger))) e.push(`${at}.towers.at: "corners" or vertex indices`);
    }
    (w.gates === undefined ? [] : Array.isArray(w.gates) ? w.gates : (e.push(`${at}.gates: an array`), [])).forEach((g, j) => {
      const ga = `${at}.gates[${j}]`;
      if (!isPoint(g?.at)) e.push(`${ga}.at: [x, y] in cells`);
      if (!GATE_KINDS.includes(g?.kind)) e.push(`${ga}.kind: ${GATE_KINDS.join(' or ')}`);
      if (g?.room !== undefined && !ids.has(g.room)) e.push(`${ga}.room: no room ${JSON.stringify(g.room)}`);
      if (g?.width !== undefined && !(isNum(g.width) && g.width > 0)) e.push(`${ga}.width: cells, above 0`);
    });
    originError(w, at, e);
  });
  return e;
}

/** Every problem with a dungeon file, as readable messages (empty when it is valid). */
export function validateDungeon(raw: unknown): string[] {
  const e: string[] = [];
  if (!raw || typeof raw !== 'object') return ['dungeon: expected an object'];
  const m = raw as Partial<DungeonSpec>;
  if (typeof m.id !== 'string' || !/^[\w-]+$/.test(m.id)) e.push('id: letters, digits, - and _ only');
  for (const k of ['cols', 'rows'] as const) if (!isNum(m[k]) || m[k]! < 4 || m[k]! > MAX_SIDE || !Number.isInteger(m[k])) e.push(`${k}: an integer from 4 to ${MAX_SIDE}`);
  if (!isNum(m.seed)) e.push('seed: a number');
  const g = m.gen;
  if (!g) e.push('gen: required');
  else {
    for (const [k, lo, hi] of [['rooms', 1, 80], ['minSize', 1, 40], ['maxSize', 1, 40], ['caves', 0, 1], ['round', 0, 1], ['loops', 0, 1], ['doors', 0, 1], ['corridorWidth', 1, 6], ['spacing', 0, 10]] as const)
      if (!isNum(g[k]) || g[k] < lo || g[k] > hi) e.push(`gen.${k}: ${lo}..${hi}`);
    if (isNum(g.minSize) && isNum(g.maxSize) && g.minSize > g.maxSize) e.push('gen.minSize: at most maxSize');
    if (typeof g.entrance !== 'boolean') e.push('gen.entrance: true or false');
  }
  if (!m.grid || typeof m.grid.show !== 'boolean' || !isNum(m.grid.size) || m.grid.size < 0.5 || typeof m.grid.sub !== 'boolean' || !['floor', 'all'].includes(m.grid.clip))
    e.push('grid: show, size ≥ 0.5 (cells), sub (true|false), clip floor|all');
  if (!m.style || !HATCH_STYLES.includes(m.style.hatch) || !isNum(m.style.band) || m.style.band < 0 || m.style.band > 6 || !isNum(m.style.wall) || m.style.wall < 0.2 || m.style.wall > 4)
    e.push(`style: hatch ${HATCH_STYLES.join('|')}, band 0..6, wall 0.2..4`);
  if (!m.scale || !isNum(m.scale.perCell) || typeof m.scale.unit !== 'string') e.push('scale: perCell (number) and unit');
  const ids = new Set<string>();
  (Array.isArray(m.rooms) ? m.rooms : (e.push('rooms: an array'), [])).forEach((r, i) => {
    const at = `rooms[${i}]`;
    if (typeof r?.id !== 'string' || !/^[\w-]+$/.test(r.id)) e.push(`${at}.id: letters, digits, - and _ only`);
    else if (ids.has(r.id)) e.push(`${at}.id: ${r.id} is used twice`);
    else ids.add(r.id);
    if (!ROOM_SHAPES.includes(r?.shape)) e.push(`${at}.shape: one of ${ROOM_SHAPES.join(', ')}`);
    for (const k of ['x', 'y'] as const) if (!isNum(r?.[k])) e.push(`${at}.${k}: a number (cells)`);
    for (const k of ['w', 'h'] as const) if (!isNum(r?.[k]) || r[k] < 1) e.push(`${at}.${k}: at least 1 cell`);
    if (r?.shape === 'poly' && !(nums(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at}.points: at least 3 x,y pairs`);
    if (r?.label !== undefined && typeof r.label !== 'string') e.push(`${at}.label: text`);
    if (r?.number !== undefined && r.number !== false && !isNum(r.number)) e.push(`${at}.number: a number or false`);
    if (r?.fill !== undefined && !ROOM_FILLS.includes(r.fill)) e.push(`${at}.fill: one of ${ROOM_FILLS.join(', ')}`);
    if (r?.href !== undefined && hrefError(r.href)) e.push(`${at}.href: ${hrefError(r.href)}`);
    if (r?.hand !== undefined && !(Array.isArray(r.hand) && r.hand.every(f => typeof f === 'string'))) e.push(`${at}.hand: field names`);
    originError(r, at, e);
  });
  const corridorIds = new Set<string>();
  (Array.isArray(m.corridors) ? m.corridors : []).forEach((c, i) => {
    if (c?.id === undefined) return;
    if (typeof c.id !== 'string' || !/^[\w-]+$/.test(c.id)) e.push(`corridors[${i}].id: letters, digits, - and _ only`);
    else if (corridorIds.has(c.id)) e.push(`corridors[${i}].id: ${c.id} is used twice`);
    else corridorIds.add(c.id);
  });
  (Array.isArray(m.corridors) ? m.corridors : (e.push('corridors: an array'), [])).forEach((c, i) => {
    const at = `corridors[${i}]`;
    e.push(...endErrors(c?.from, `${at}.from`, ids, corridorIds), ...endErrors(c?.to, `${at}.to`, ids, corridorIds));
    for (const side of ['from', 'to'] as const) { const x = c?.[side] as { corridor?: unknown } | undefined; if (x && x.corridor !== undefined && x.corridor === c?.id) e.push(`${at}.${side}.corridor: a corridor cannot join itself`); }
    if (c?.curve !== undefined && !CURVES.includes(c.curve)) e.push(`${at}.curve: ${CURVES.join(' or ')}`);
    if (c?.style !== undefined && !CORRIDOR_STYLES.includes(c.style)) e.push(`${at}.style: ${CORRIDOR_STYLES.join(' or ')}`);
    if (c?.seed !== undefined && !isNum(c.seed)) e.push(`${at}.seed: a number`);
    if (c?.width !== undefined && !(isNum(c.width) && c.width >= 0.5 && c.width <= 6)) e.push(`${at}.width: 0.5..6`);
    if (c?.route !== undefined && !ROUTES.includes(c.route)) e.push(`${at}.route: one of ${ROUTES.join(', ')}`);
    if (c?.via !== undefined && !(nums(c.via) && c.via.length % 2 === 0)) e.push(`${at}.via: x,y pairs`);
    if (c?.doors !== undefined && !(Array.isArray(c.doors) && c.doors.length === 2 && c.doors.every(d => d === null || DOOR_KINDS.includes(d))))
      e.push(`${at}.doors: [from, to], each null or one of ${DOOR_KINDS.join(', ')}`);
    originError(c, at, e);
  });
  if (m.connections !== undefined) {
    if (!Array.isArray(m.connections)) e.push('connections: an array');
    else m.connections.forEach((c, i) => {
      const at = `connections[${i}]`;
      if (!c || typeof c !== 'object') { e.push(`${at}: {a, b, at?, kind?, width?}`); return; }
      for (const k of ['a', 'b'] as const) if (!ids.has(c[k])) e.push(`${at}.${k}: no room ${JSON.stringify(c[k])}`);
      if (c.a === c.b) e.push(`${at}: a room cannot connect to itself`);
      if (c.at !== undefined && !isPoint(c.at)) e.push(`${at}.at: [x, y]`);
      if (c.kind !== undefined && c.kind !== 'open' && !DOOR_KINDS.includes(c.kind)) e.push(`${at}.kind: open or one of ${DOOR_KINDS.join(', ')}`);
      if (c.width !== undefined && !(isNum(c.width) && c.width >= 0.5 && c.width <= 20)) e.push(`${at}.width: 0.5..20`);
      originError(c, at, e);
    });
  }
  if (Array.isArray(m.corridors) && !e.some(x => x.startsWith('corridors')) && !corridorOrder(m.corridors)) e.push('corridors: corridors join each other in a ring ({corridor: id} ends); one must end at a room or a point');
  e.push(...enclosureErrors(m, ids));
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

/** A poly room's bounding box from its points. */
export function polyBox(points: number[]): { x: number; y: number; w: number; h: number } {
  const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y) };
}

/** Fill the defaults into a file already read at the current format. */
function withDefaults(r: Partial<DungeonSpec>): DungeonSpec {
  const d = DEFAULTS;
  const rooms = (Array.isArray(r.rooms) ? r.rooms : []).map(room => (room?.shape === 'poly' && Array.isArray(room.points) && room.points.length >= 6 && room.x === undefined ? { ...room, ...polyBox(room.points) } : room));
  const m = {
    ...structuredClone(d), ...r, version: DUNGEON_FORMAT,
    gen: { ...d.gen, ...r.gen }, grid: { ...d.grid, ...r.grid }, style: { ...d.style, ...r.style }, scale: { ...d.scale, ...r.scale },
    rooms, corridors: r.corridors ?? [], overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] },
  } as DungeonSpec;
  return m;
}

/** Fill missing fields from the defaults (older or hand-written files), then validate; throws on errors. */
export function parseDungeon(raw: unknown): DungeonSpec {
  const r = readFormat(raw, 'dungeon', DUNGEON_FORMAT, MIGRATIONS) as Partial<DungeonSpec>, m = withDefaults(r);
  const errors = validateDungeon(m);
  if (errors.length) throw new Error(`invalid dungeon${typeof r.id === 'string' ? ` ${r.id}` : ''}:\n  ${errors.join('\n  ')}`);
  return m;
}

/** A problem in a file: where (a JSON path, empty for the file as a whole) and what. */
export interface Issue { path: string; message: string }

/** A `path: message` string from a validator as an {@link Issue}. */
export const toIssue = (s: string): Issue => {
  const i = s.indexOf(': ');
  return i < 0 ? { path: '', message: s } : { path: s.slice(0, i), message: s.slice(i + 2) };
};

/** Every problem with a dungeon file as written by a consumer (not yet filled with defaults), each with its JSON path. */
export function checkDungeon(raw: unknown): { version: number | null; errors: Issue[] } {
  let r: Partial<DungeonSpec>;
  try { r = readFormat(raw, 'dungeon', DUNGEON_FORMAT, MIGRATIONS) as Partial<DungeonSpec>; } catch (err) {
    const v = (raw as { version?: unknown } | null)?.version;
    return { version: typeof v === 'number' ? v : null, errors: [{ path: 'version', message: (err as Error).message }] };
  }
  return { version: DUNGEON_FORMAT, errors: validateDungeon(withDefaults(r)).map(toIssue) };
}

/** Common scale units for the grid's dimension (any text is allowed; these are offered first). */
export const SCALE_UNITS = ['ft', 'm', 'yd', 'mi', 'km'] as const;

/**
 * Grid settings from a grid size in the map's own unit (`10` ft), whether to show the sub-grid (a line at every cell)
 * and whether to show the grid at all. The size must be a whole number of cells (`scale.perCell` units each); the
 * sub-grid only shows when the grid is more than one cell.
 */
export function gridFromUnits(spec: Pick<DungeonSpec, 'grid' | 'scale'>, o: { size?: number; sub?: boolean; show?: boolean }): DungeonSpec['grid'] {
  const per = spec.scale.perCell, g = { ...spec.grid };
  if (o.show !== undefined) g.show = o.show;
  if (o.size !== undefined) {
    const cells = o.size / per;
    if (!(Number.isFinite(cells) && cells >= 1 && Math.abs(cells - Math.round(cells)) < 1e-9))
      throw new Error(`grid size: a whole number of squares (1 square = ${per} ${spec.scale.unit}), so ${per}, ${2 * per}, ${3 * per} …`);
    g.size = Math.round(cells);
    g.show = o.show ?? true;
  }
  if (o.sub !== undefined) g.sub = o.sub;
  return g;
}

/** The grid as size in the map's unit, the unit, and whether the sub-grid shows (false when the grid is one cell). */
export function gridInUnits(spec: Pick<DungeonSpec, 'grid' | 'scale'>): { show: boolean; size: number; unit: string; sub: boolean; subSize: number } {
  const per = spec.scale.perCell;
  return { show: spec.grid.show, size: spec.grid.size * per, unit: spec.scale.unit, sub: spec.grid.sub && spec.grid.size > 1, subSize: per };
}

/** `x,y` in cells, or a cell name (`C4`, also `cell:C4`) to that cell's centre. */
export function parsePoint(at: string): [number, number] {
  const xy = at.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
  if (xy) return [+xy[1], +xy[2]];
  const sq = at.replace(/^cell:/i, '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (sq) {
    const c = [...sq[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1, r = +sq[2] - 1;
    return [c + 0.5, r + 0.5];
  }
  throw new Error(`${at}: expected x,y (cells) or a cell name (C4)`);
}

/** Corridors left once every corridor that joins a missing one is gone (in place of `list`, whose dropped entries are counted). */
function withoutDangling(list: Corridor[]): Corridor[] {
  for (;;) {
    const ids = new Set(list.flatMap(c => (c.id ? [c.id] : [])));
    const next = list.filter(c => ![c.from, c.to].some(e => 'corridor' in e && !ids.has(e.corridor)));
    if (next.length === list.length) return next;
    list = next;
  }
}

/** Remove a room, its connections, the corridors that start or end at it and the corridors that join those (in place); the count of corridors removed. */
export function removeRoom(m: DungeonSpec, id: string): number {
  const before = m.corridors.length;
  m.rooms = m.rooms.filter(r => r.id !== id);
  if (m.connections) m.connections = m.connections.filter(c => c.a !== id && c.b !== id);
  m.corridors = withoutDangling(m.corridors.filter(c => ![c.from, c.to].some(e => 'room' in e && e.room === id)));
  return before - m.corridors.length;
}

/** Remove corridor `index` and the corridors that join it (in place); the count removed. */
export function removeCorridor(m: DungeonSpec, index: number): number {
  const before = m.corridors.length;
  m.corridors = withoutDangling(m.corridors.filter((_, i) => i !== index));
  return before - m.corridors.length;
}

/** The next free corridor id (`c1`, `c2`, …). */
export function nextCorridorId(spec: Pick<DungeonSpec, 'corridors'>): string {
  const used = new Set(spec.corridors.flatMap(c => (c.id ? [c.id] : [])));
  for (let n = 1; ; n++) if (!used.has(`c${n}`)) return `c${n}`;
}

/** The next free room id (`r1`, `r2`, …). */
export function nextRoomId(spec: Pick<DungeonSpec, 'rooms'>): string {
  const used = new Set(spec.rooms.map(r => r.id));
  for (let n = spec.rooms.length + 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}
