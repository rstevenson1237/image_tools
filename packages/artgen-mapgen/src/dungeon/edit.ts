/**
 * Edits to a dungeon as plain objects (`{op: 'add_room', shape: 'rect', at: '3,3', w: 6, h: 4}`), the one vocabulary the
 * CLI's one-edit commands (`dungeon room add`, `dungeon link`, …), `dungeon edit --ops` and the MCP server's
 * `dungeon_edit` all turn into. Each edit changes the spec in place and returns a line saying what it did; a bad edit
 * throws, and the caller validates the result (see `settlement/edit.ts`, which does the same for settlements).
 */
import { applyBlock, blockRoomNear, hexPoints, removeBlock } from './blocks.ts';
import { fitDungeon } from './layout.ts';
import {
  DOOR_KINDS, SIDES, nextRoomId, parseDungeon, parsePoint, polyBox, removeCorridor, removeRoom,
  type Block, type Corridor, type CorridorEnd, type DoorKind, type DungeonSpec, type Exit, type MidDoor, type Ring, type Room, type RoomFill, type RoomShape, type Route, type Side, type SplitMode, type WallLine,
} from './spec.ts';

/** One edit (see the module comment); `op` names it, the rest are its fields. */
export type DungeonOp = { op: string } & Record<string, unknown>;

export const DUNGEON_OPS = ['add_room', 'move_room', 'set_room', 'remove_room', 'add_block', 'split_block', 'remove_block', 'link', 'unlink', 'connect', 'disconnect', 'door', 'add_ring', 'remove_ring', 'fit'] as const;

/** A room's top-left corner: `x,y` as given, or a cell name (`C4`) meaning that cell's corner. */
export function cornerPoint(at: string): [number, number] {
  const [x, y] = parsePoint(at);
  return /^\s*-?[\d.]+\s*,/.test(at) ? [x, y] : [Math.floor(x), Math.floor(y)];
}

/**
 * A corridor end: a room id in the dungeon (leaving by its `side` wall, `offset` cells along, when given), a corridor
 * (`corridor:<id>`, or an id no room has) for a junction, else a point.
 */
export function corridorEnd(m: DungeonSpec, ref: string, side?: string, offset?: number, port?: [number, number], near?: [number, number]): CorridorEnd {
  if (side !== undefined && !SIDES.includes(side as Side)) throw new Error(`--from-side / --to-side: ${SIDES.join(', ')}`);
  if (side !== undefined && port) throw new Error('a port or a side, not both');
  if (near && m.rooms.some(r => r.id === ref)) throw new Error(`a near point goes with a corridor end, and ${ref} is a room`);
  if (m.rooms.some(r => r.id === ref)) return { room: ref, ...(side && { side: side as Side }), ...(side && offset !== undefined && { offset }), ...(port && { port }) };
  if (side || port) throw new Error(`a side or a port goes with a room end, and ${ref} is not a room`);
  if (near && !(ref.startsWith('corridor:') || m.corridors.some(x => x.id === ref))) throw new Error('--from-near / --to-near: a point on a corridor end (corridor:<id>) to meet nearest');
  const c = ref.replace(/^corridor:/, '');
  if (ref.startsWith('corridor:') || m.corridors.some(x => x.id === c)) {
    if (!m.corridors.some(x => x.id === c)) throw new Error(`no corridor with id ${c} (give one an id: link … --id ${c})`);
    return { corridor: c, ...(near && { near }) };
  }
  return { at: parsePoint(ref) };
}

/** A door in a run: `{at, kind}`, or `9:double` (a distance along the corridor, then the kind) or `13,4:door` (the point nearest, then the kind). */
export function midDoor(v: unknown): MidDoor {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const d = v as { at?: unknown; kind?: unknown };
    return { at: typeof d.at === 'number' ? d.at : pt(d.at), kind: String(d.kind ?? 'door') as DoorKind };
  }
  const [place, kind = 'door'] = String(v).split(':').length > 1 ? [String(v).slice(0, String(v).lastIndexOf(':')), String(v).slice(String(v).lastIndexOf(':') + 1)] : [String(v)];
  if (!DOOR_KINDS.includes(kind as DoorKind)) throw new Error(`--mid-doors: <distance|x,y>:<kind>, the kind one of ${DOOR_KINDS.join(', ')}`);
  return { at: /^\s*-?[\d.]+\s*$/.test(place) ? +place : pt(place), kind: kind as DoorKind };
}

/** `door,none` / `secret` → the door pair (a single kind is used at both ends). */
export function doorPair(v: string | undefined): [DoorKind | null, DoorKind | null] | undefined {
  if (v === undefined) return undefined;
  const parts = v.split(',').map(s => s.trim()), kind = (s: string | undefined) => {
    if (!s || s === 'none' || s === 'open') return null;
    if (!DOOR_KINDS.includes(s as DoorKind)) throw new Error(`--doors: none or one of ${DOOR_KINDS.join(', ')}`);
    return s as DoorKind;
  };
  return [kind(parts[0]), kind(parts.length > 1 ? parts[1] : parts[0])];
}

/** `10` / `5` / `10+5` / `none` (in feet, at 5 ft a cell) → grid settings. */
export function gridMode(m: DungeonSpec, mode: string): DungeonSpec['grid'] {
  const per = m.scale.perCell, g = { ...m.grid };
  if (mode === 'none' || mode === 'off') return { ...g, show: false };
  const parts = mode.split('+').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('grid: 10, 5, 10+5 or none (feet; or the map\'s unit)');
  return { ...g, show: true, size: parts[0] / per, sub: parts.length > 1 };
}

const pt = (v: unknown): [number, number] => (Array.isArray(v) ? [Number(v[0]), Number(v[1])] : parsePoint(String(v)));
const corner = (v: unknown): [number, number] => (Array.isArray(v) ? pt(v) : cornerPoint(String(v)));
const numbers = (v: unknown): number[] => (v as unknown[]).map(Number);

function room(m: DungeonSpec, id: unknown): Room {
  const r = m.rooms.find(x => x.id === id);
  if (!r) throw new Error(`no room ${String(id)} (have: ${m.rooms.map(x => x.id).join(', ') || 'none'})`);
  return r;
}
function corridor(m: DungeonSpec, i: unknown): Corridor {
  const c = m.corridors[Number(i)];
  if (!c) throw new Error(`no corridor ${String(i)} (0..${m.corridors.length - 1})`);
  return c;
}
/** A hand change to an entry of some origin is recorded, so a sync can report the hand value it replaces. */
function handEdit(r: Room, fields: string[]): void {
  if (r.origin) r.hand = [...new Set([...(r.hand ?? []), ...fields])];
}
/** Put `spec` in `m`'s place (the same object, so a caller holding it sees the change). */
function replace(m: DungeonSpec, spec: DungeonSpec): void {
  for (const k of Object.keys(m)) delete (m as unknown as Record<string, unknown>)[k];
  Object.assign(m, spec);
}

/**
 * The two ends of a link as the file will hold them: a block id stands for its room nearest the other end (the block's
 * rooms are ordinary rooms). Ends that are not block ids come back as given.
 */
export function linkEnds(m: DungeonSpec, a: unknown, b: unknown): [unknown, unknown] {
  const isBlock = (v: unknown) => typeof v === 'string' && !!m.blocks?.some(x => x.id === v) && !m.rooms.some(r => r.id === v);
  const centre = (v: unknown): [number, number] => {
    const r = typeof v === 'string' ? m.rooms.find(x => x.id === v) : undefined;
    if (r) return [r.x + r.w / 2, r.y + r.h / 2];
    try { return pt(v); } catch { return [m.cols / 2, m.rows / 2]; }
  };
  let [ea, eb] = [a, b];
  if (isBlock(ea)) ea = blockRoomNear(m, ea as string, ...(isBlock(eb) ? [m.cols / 2, m.rows / 2] as [number, number] : centre(eb))) ?? ea;
  if (isBlock(eb)) eb = blockRoomNear(m, eb as string, ...centre(ea)) ?? eb;
  return [ea, eb];
}

/** An octagon's `cut`, a hexagon's `orient` and a room's `exits` from an edit (null removes one). */
function roomExtras(r: Room, o: DungeonOp): void {
  if (o.cut === null) delete r.cut; else if (typeof o.cut === 'number') r.cut = o.cut;
  if (o.orient === null) delete r.orient; else if (o.orient === 'flat' || o.orient === 'pointy') r.orient = o.orient;
  if (o.exits === null) delete r.exits; else if (Array.isArray(o.exits)) r.exits = o.exits as Room['exits'];
}

/** A room's `labelAt` from an edit: a side (n, s, w, e, c) or an offset (dx,dy cells). */
const labelAt = (v: unknown): NonNullable<Room['labelAt']> => (typeof v === 'string' && ['c', 'n', 's', 'w', 'e'].includes(v) ? v as 'c' : pt(v));

/** A room's `number` from an edit: a number, a key such as `15a`, or false (null clears it). */
const roomNumber = (v: unknown): number | string | false | null | undefined => (v === null ? null : v === false ? false : typeof v === 'number' ? v : typeof v === 'string' && v ? (Number.isFinite(+v) ? +v : v) : undefined);
/** `edge`, `edge_sides` and `partition` of a room from an edit (null removes one). */
function roomEdging(r: Room, o: DungeonOp): void {
  if (o.edge === null || o.edge === 'none' || o.edge === '') { delete r.edge; delete r.edgeSides; } else if (o.edge === 'wavy') r.edge = 'wavy';
  else if (o.edge !== undefined) throw new Error('edge: wavy (or none)');
  if (o.edge_sides === null) delete r.edgeSides;
  else if (o.edge_sides !== undefined) {
    const sides = (Array.isArray(o.edge_sides) ? o.edge_sides : String(o.edge_sides).split(',')).map(x => String(x).trim()).filter(Boolean);
    if (!sides.length || !sides.every(x => SIDES.includes(x as Side))) throw new Error(`edge_sides: a list of ${SIDES.join(', ')}`);
    r.edgeSides = sides as Side[];
  }
  if (o.partition === null) delete r.partition; else if (typeof o.partition === 'number') r.partition = o.partition;
}

const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

/** Apply one edit; returns what it did. */
export function editDungeon(m: DungeonSpec, o: DungeonOp): string {
  switch (o.op) {
    case 'add_room': {
      const shape = o.shape as RoomShape, id = typeof o.id === 'string' ? o.id : nextRoomId(m);
      const r: Room = shape === 'poly'
        ? { id, shape, points: numbers(o.points), ...polyBox(numbers(o.points)) }
        : { id, shape, ...(([x, y]) => ({ x, y }))(corner(o.at ?? [o.x, o.y])), w: Number(o.w), h: Number(o.h) };
      if (typeof o.label === 'string') r.label = o.label;
      { const n = roomNumber(o.number); if (n !== undefined && n !== null) r.number = n; }
      if (typeof o.fill === 'string' && o.fill) r.fill = o.fill as RoomFill;
      if (o.anchor !== undefined && o.anchor !== null) r.anchor = pt(o.anchor);
      if (o.label_at !== undefined && o.label_at !== null && o.label_at !== '') r.labelAt = labelAt(o.label_at);
      roomExtras(r, o);
      roomEdging(r, o);
      if (typeof o.href === 'string' && o.href) r.href = o.href;
      if (typeof o.origin === 'string' && o.origin) r.origin = o.origin;
      m.rooms.push(r);
      return `added ${shape} room ${id}`;
    }
    case 'move_room': {
      const r = room(m, o.room), [x, y] = corner(o.at ?? [o.x, o.y]), dx = x - r.x, dy = y - r.y;
      r.x = x; r.y = y;
      handEdit(r, ['x', 'y']);
      if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
      return `moved ${r.id} to ${x},${y}`;
    }
    case 'set_room': {
      const r = room(m, o.room);
      if (typeof o.shape === 'string') { r.shape = o.shape as RoomShape; if (r.shape !== 'poly') delete r.points; }
      const size: string[] = [];
      if (typeof o.w === 'number') { r.w = o.w; size.push('w'); }
      if (typeof o.h === 'number') { r.h = o.h; size.push('h'); }
      if (size.length) handEdit(r, size);
      if (typeof o.shape === 'string') handEdit(r, ['shape']);
      if (typeof o.label === 'string') { if (o.label) r.label = o.label; else delete r.label; handEdit(r, ['label']); }
      { const n = roomNumber(o.number); if (n === null) delete r.number; else if (n !== undefined) r.number = n; }
      if (typeof o.fill === 'string' && o.fill) { if (o.fill === 'floor') delete r.fill; else r.fill = o.fill as RoomFill; handEdit(r, ['fill']); }
      if (typeof o.href === 'string') { if (o.href) r.href = o.href; else delete r.href; }
      if (o.anchor === null || o.anchor === '') delete r.anchor; else if (o.anchor !== undefined) r.anchor = pt(o.anchor);
      if (o.label_at === null || o.label_at === '') delete r.labelAt; else if (o.label_at !== undefined) r.labelAt = labelAt(o.label_at);
      roomExtras(r, o);
      roomEdging(r, o);
      return `changed ${r.id}`;
    }
    case 'remove_room': {
      const r = room(m, o.room), n = removeRoom(m, r.id);
      return `removed ${r.id} and ${n} corridors`;
    }
    case 'link': {
      const [from, to] = linkEnds(m, o.from, o.to);
      const end = (v: unknown, side?: unknown, offset?: unknown, port?: unknown, near?: unknown): CorridorEnd => {
        if (v && typeof v === 'object' && !Array.isArray(v)) return v as CorridorEnd;
        if (typeof v === 'string') return corridorEnd(m, v, typeof side === 'string' ? side : undefined, typeof offset === 'number' ? offset : undefined, port === undefined || port === null ? undefined : pt(port), near === undefined || near === null ? undefined : pt(near));
        return { at: pt(v) };
      };
      const exit = o.exit && typeof o.exit === 'object' ? o.exit as Exit : undefined, a = end(from, o.from_side, o.from_offset, o.from_port, o.from_near), b = end(to, o.to_side, o.to_offset, o.to_port, o.to_near);
      m.corridors.push({
        ...(typeof o.id === 'string' && { id: o.id }),
        from: a, to: exit && 'at' in b ? { ...b, exit } : b,
        ...(typeof o.width === 'number' && { width: o.width }), ...(typeof o.span === 'number' && { span: o.span }), ...(typeof o.route === 'string' && { route: o.route as Route }),
        ...(Array.isArray(o.via) && { via: numbers(o.via) }), ...(Array.isArray(o.doors) && { doors: o.doors as [DoorKind | null, DoorKind | null] }),
        ...(Array.isArray(o.mid_doors) && o.mid_doors.length && { midDoors: o.mid_doors.map(midDoor) }),
        ...(o.curve === 'smooth' && { curve: 'smooth' as const }), ...(o.style === 'natural' && { style: 'natural' as const }), ...(typeof o.seed === 'number' && { seed: o.seed }),
        ...(typeof o.origin === 'string' && o.origin && { origin: o.origin }),
      });
      return `corridor ${m.corridors.length - 1}: ${show(from)} → ${show(to)}`;
    }
    case 'unlink': { corridor(m, o.index); removeCorridor(m, Number(o.index)); return `${m.corridors.length} corridors`; }
    case 'add_block': case 'split_block': {
      let id = String(o.id ?? '');
      const split = { mode: (o.split ?? 'bsp') as SplitMode, ...(typeof o.min === 'number' && { min: o.min }), ...(o.cuts && typeof o.cuts === 'object' ? { cuts: o.cuts as { x?: number[]; y?: number[] } } : {}), ...(typeof o.seed === 'number' && { seed: o.seed }) };
      if (o.op === 'add_block') {
        const used = new Set((m.blocks ?? []).map(b => b.id));
        if (!id) for (let n = 1; ; n++) if (!used.has(`b${n}`)) { id = `b${n}`; break; }
        const shape = String(o.shape ?? 'rect');
        let b: Block;
        if (shape === 'poly') { const points = numbers(o.points); b = { id, shape: 'poly', points, ...polyBox(points), split }; }
        else {
          const [x, y] = corner(o.at ?? [o.x, o.y]), w = Number(o.w), h = Number(o.h);
          b = shape === 'hex' ? { id, shape: 'poly', points: hexPoints(x, y, w, h), x, y, w, h, split } : { id, shape: shape as Block['shape'], x, y, w, h, split };
        }
        if (typeof o.doors === 'number') b.doors = o.doors;
        (m.blocks ??= []).push(b);
      } else {
        const b = m.blocks?.find(x => x.id === id);
        if (!b) throw new Error(`no block ${id}`);
        // another layout: a new seed unless one is given (reseed: false keeps the block's own)
        const seed = typeof o.seed === 'number' ? o.seed : o.reseed === false ? b.split.seed : Math.floor(Math.random() * 1e6);
        b.split = { ...b.split, ...(o.split !== undefined && { mode: split.mode }), ...(split.min !== undefined && { min: split.min }), ...(split.cuts && { cuts: split.cuts }), ...(seed !== undefined && { seed }) };
        if (typeof o.doors === 'number') b.doors = o.doors;
      }
      const r = applyBlock(parseDungeon(m), id);
      replace(m, r.spec);
      const made = r.spec.rooms.filter(x => x.origin === `block:${id}`).length;
      return [`block ${id}: ${made} rooms, ${(r.spec.connections ?? []).filter(c => c.origin === `block:${id}`).length} connections`, ...r.dropped.map(d => `  dropped ${d}`)].join('\n');
    }
    case 'remove_block': {
      const id = String(o.id);
      if (!m.blocks?.some(x => x.id === id)) throw new Error(`no block ${id}`);
      removeBlock(m, id);
      return `removed block ${id} and its rooms`;
    }
    case 'connect': {
      (m.connections ??= []).push({
        a: String(o.a), b: String(o.b), ...(o.at !== undefined && { at: pt(o.at) }), ...(typeof o.kind === 'string' && o.kind !== 'door' && { kind: o.kind as DoorKind | 'open' }),
        ...(typeof o.width === 'number' && { width: o.width }), ...(typeof o.span === 'number' && { span: o.span }),
        ...(typeof o.weight === 'number' && { weight: o.weight }), ...(typeof o.line === 'string' && o.line !== 'solid' && { line: o.line as WallLine }),
        ...(typeof o.origin === 'string' && o.origin && { origin: o.origin }),
      });
      return `connection ${m.connections.length - 1}: ${String(o.a)} ↔ ${String(o.b)}`;
    }
    case 'disconnect': {
      if (!m.connections?.[Number(o.index)]) throw new Error(`no connection ${String(o.index)} (0..${(m.connections?.length ?? 0) - 1})`);
      m.connections.splice(Number(o.index), 1);
      if (!m.connections.length) delete m.connections;
      return `${m.connections?.length ?? 0} connections`;
    }
    case 'door': {
      // `at`: a door in the run (a distance along the corridor, or a point); with no kind, the doors in the run at that place are removed
      if (o.at !== undefined) {
        const c = corridor(m, o.index), place = typeof o.at === 'number' ? o.at : pt(o.at), kind = (o.kind ?? null) as DoorKind | null;
        if (kind !== null && !DOOR_KINDS.includes(kind)) throw new Error(`door kind: one of ${DOOR_KINDS.join(', ')}`);
        const same = (a: MidDoor['at']) => typeof a === 'number' && typeof place === 'number' ? Math.abs(a - place) < 1e-9 : Array.isArray(a) && Array.isArray(place) && a[0] === place[0] && a[1] === place[1];
        c.midDoors = (c.midDoors ?? []).filter(d => !same(d.at));
        if (kind) c.midDoors.push({ at: place, kind });
        if (!c.midDoors.length) delete c.midDoors;
        return `door in the run of corridor ${String(o.index)} at ${show(o.at)}: ${kind ?? 'none'}`;
      }
      const c = corridor(m, o.index), d = c.doors ?? [null, null], kind = (o.kind ?? null) as DoorKind | null;
      c.doors = o.end === 'to' ? [d[0], kind] : [kind, d[1]];
      return `door at the ${o.end === 'to' ? 'end' : 'start'} of corridor ${String(o.index)}: ${kind ?? 'none'}`;
    }
    case 'add_ring': {
      // a line over the rock with no floor: a circle (at, r) or a poly (points)
      const shape = String(o.shape ?? (o.points ? 'poly' : 'circle'));
      if (shape !== 'circle' && shape !== 'poly') throw new Error('ring: circle or poly');
      const ring: Ring = shape === 'circle' ? { shape, at: pt(o.at), r: Number(o.r) } : { shape, points: numbers(o.points) };
      if (o.line === 'solid' || o.line === 'dashed') ring.line = o.line;
      if (typeof o.width === 'number') ring.width = o.width;
      if (Array.isArray(o.dash)) ring.dash = numbers(o.dash) as [number, number];
      if (typeof o.id === 'string' && o.id) ring.id = o.id;
      if (typeof o.origin === 'string' && o.origin) ring.origin = o.origin;
      (m.rings ??= []).push(ring);
      return `ring ${m.rings.length - 1}: ${shape}`;
    }
    case 'remove_ring': {
      if (!m.rings?.[Number(o.index)]) throw new Error(`no ring ${String(o.index)} (0..${(m.rings?.length ?? 0) - 1})`);
      m.rings.splice(Number(o.index), 1);
      if (!m.rings.length) delete m.rings;
      return `${m.rings?.length ?? 0} rings`;
    }
    case 'fit': { replace(m, fitDungeon(parseDungeon(m), typeof o.margin === 'number' ? o.margin : 2)); return `fitted to ${m.cols}×${m.rows} cells`; }
  }
  throw new Error(`unknown op ${String(o.op)} (${DUNGEON_OPS.join(', ')})`);
}
