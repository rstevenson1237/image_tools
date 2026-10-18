/**
 * Dungeon map file (`art/dungeons/<id>/dungeon.json`): a TTRPG dungeon or lair as rooms, the corridors that join them
 * and an overlay of labels and symbols. The generator writes rooms and corridors straight into this file, so the file is
 * the whole map: the CLI, the MCP server and the web tool all read and write it, and every render comes from it.
 *
 * Coordinates are grid cells (x right, y down); by default one cell is 5 ft. A room's `x, y` is its top-left corner.
 */

export const ROOM_SHAPES = ['rect', 'circle', 'octagon', 'cave', 'poly'] as const;
export type RoomShape = (typeof ROOM_SHAPES)[number];

export const DOOR_KINDS = ['door', 'secret', 'locked', 'portcullis', 'arch'] as const;
export type DoorKind = (typeof DOOR_KINDS)[number];

export const DOOR_NAMES: Record<DoorKind, string> = {
  door: 'Door', secret: 'Secret door', locked: 'Locked door', portcullis: 'Portcullis / bars', arch: 'Archway',
};

export const ROUTES = ['auto', 'hv', 'vh', 'straight'] as const;
export type Route = (typeof ROUTES)[number];

export const HATCH_STYLES = ['band', 'full', 'none'] as const;
export type HatchStyle = (typeof HATCH_STYLES)[number];

export const LABEL_KINDS = ['name', 'note', 'area'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

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
}

/** A corridor end: a room (it starts at the room's centre) or a point (an exit stub, a dead end, or off the map). */
export type CorridorEnd = { room: string } | { at: [number, number] };

export interface Corridor {
  from: CorridorEnd;
  to: CorridorEnd;
  /** Width in cells (default 1). */
  width?: number;
  /** auto: straight when the rooms line up, else an elbow; hv: across then down; vh: down then across. */
  route?: Route;
  /** Bend points (x,y pairs) between the two ends; when set the corridor runs straight through them. */
  via?: number[];
  /** A door where the corridor leaves each end (null or unset: an open passage). */
  doors?: [DoorKind | null, DoorKind | null];
}

export interface DungeonLabel { text: string; x: number; y: number; kind: LabelKind; size?: number; angle?: number }
export interface DungeonSymbol { kind: string; x: number; y: number; scale?: number; angle?: number }

export interface DungeonSpec {
  id: string;
  version: 1;
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
  overlay: { labels: DungeonLabel[]; symbols: DungeonSymbol[] };
}

export const DEFAULTS: Omit<DungeonSpec, 'id' | 'seed' | 'version' | 'rooms' | 'corridors' | 'overlay'> = {
  cols: 40, rows: 30,
  gen: { rooms: 8, minSize: 3, maxSize: 8, caves: 0.15, round: 0.1, loops: 0.25, doors: 0.6, corridorWidth: 1, spacing: 2, entrance: true },
  grid: { show: true, size: 2, sub: true, clip: 'floor' },
  style: { hatch: 'band', band: 0.9, wall: 1 },
  scale: { perCell: 5, unit: 'ft' },
  numbers: true, scaleBar: true, compass: false,
};

export const MAX_SIDE = 160;

/** A new dungeon with the defaults; `over` replaces any top-level field or merges into gen/grid/style/scale. */
export function newDungeon(id: string, over: Partial<DungeonSpec> = {}): DungeonSpec {
  const d = structuredClone(DEFAULTS);
  return parseDungeon({
    ...d, ...over, id, version: 1, seed: over.seed ?? 1,
    gen: { ...d.gen, ...over.gen }, grid: { ...d.grid, ...over.grid }, style: { ...d.style, ...over.style }, scale: { ...d.scale, ...over.scale },
    rooms: over.rooms ?? [], corridors: over.corridors ?? [], overlay: over.overlay ?? { labels: [], symbols: [] },
  });
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nums = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);
const isPoint = (v: unknown): v is [number, number] => nums(v) && v.length === 2;

function endErrors(e: unknown, at: string, ids: Set<string>): string[] {
  if (!e || typeof e !== 'object') return [`${at}: {room: id} or {at: [x, y]}`];
  const o = e as Record<string, unknown>;
  if ('room' in o) return ids.has(o.room as string) ? [] : [`${at}.room: no room ${JSON.stringify(o.room)}`];
  if ('at' in o) return isPoint(o.at) ? [] : [`${at}.at: [x, y]`];
  return [`${at}: {room: id} or {at: [x, y]}`];
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
    if (![r?.x, r?.y].every(isNum) || !isNum(r?.w) || !isNum(r?.h) || r.w < 1 || r.h < 1) e.push(`${at}: x, y and w, h ≥ 1`);
    if (r?.shape === 'poly' && !(nums(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at}.points: at least 3 x,y pairs`);
    if (r?.label !== undefined && typeof r.label !== 'string') e.push(`${at}.label: text`);
    if (r?.number !== undefined && r.number !== false && !isNum(r.number)) e.push(`${at}.number: a number or false`);
  });
  (Array.isArray(m.corridors) ? m.corridors : (e.push('corridors: an array'), [])).forEach((c, i) => {
    const at = `corridors[${i}]`;
    e.push(...endErrors(c?.from, `${at}.from`, ids), ...endErrors(c?.to, `${at}.to`, ids));
    if (c?.width !== undefined && !(isNum(c.width) && c.width >= 0.5 && c.width <= 6)) e.push(`${at}.width: 0.5..6`);
    if (c?.route !== undefined && !ROUTES.includes(c.route)) e.push(`${at}.route: one of ${ROUTES.join(', ')}`);
    if (c?.via !== undefined && !(nums(c.via) && c.via.length % 2 === 0)) e.push(`${at}.via: x,y pairs`);
    if (c?.doors !== undefined && !(Array.isArray(c.doors) && c.doors.length === 2 && c.doors.every(d => d === null || DOOR_KINDS.includes(d))))
      e.push(`${at}.doors: [from, to], each null or one of ${DOOR_KINDS.join(', ')}`);
  });
  const o = m.overlay;
  if (!o || !Array.isArray(o.labels) || !Array.isArray(o.symbols)) e.push('overlay: { labels: [], symbols: [] }');
  else {
    o.labels.forEach((l, i) => { if (typeof l?.text !== 'string' || !isNum(l.x) || !isNum(l.y) || !LABEL_KINDS.includes(l.kind)) e.push(`overlay.labels[${i}]: text, x, y, kind (${LABEL_KINDS.join('|')})`); });
    o.symbols.forEach((s, i) => { if (typeof s?.kind !== 'string' || !isNum(s.x) || !isNum(s.y)) e.push(`overlay.symbols[${i}]: kind, x, y`); });
  }
  return e;
}

/** A poly room's bounding box from its points. */
export function polyBox(points: number[]): { x: number; y: number; w: number; h: number } {
  const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y) };
}

/** Fill missing fields from the defaults (older or hand-written files), then validate; throws on errors. */
export function parseDungeon(raw: unknown): DungeonSpec {
  const r = (raw ?? {}) as Partial<DungeonSpec>, d = DEFAULTS;
  const rooms = (Array.isArray(r.rooms) ? r.rooms : []).map(room => (room?.shape === 'poly' && Array.isArray(room.points) && room.points.length >= 6 && room.x === undefined ? { ...room, ...polyBox(room.points) } : room));
  const m = {
    ...structuredClone(d), ...r, version: 1,
    gen: { ...d.gen, ...r.gen }, grid: { ...d.grid, ...r.grid }, style: { ...d.style, ...r.style }, scale: { ...d.scale, ...r.scale },
    rooms, corridors: r.corridors ?? [], overlay: { labels: r.overlay?.labels ?? [], symbols: r.overlay?.symbols ?? [] },
  } as DungeonSpec;
  const errors = validateDungeon(m);
  if (errors.length) throw new Error(`invalid dungeon${typeof r.id === 'string' ? ` ${r.id}` : ''}:\n  ${errors.join('\n  ')}`);
  return m;
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

/** The next free room id (`r1`, `r2`, …). */
export function nextRoomId(spec: Pick<DungeonSpec, 'rooms'>): string {
  const used = new Set(spec.rooms.map(r => r.id));
  for (let n = spec.rooms.length + 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}
