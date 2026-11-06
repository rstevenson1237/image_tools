/**
 * Layouts and designs (docs/DUNGEON-DESIGN.md §4, §10): the third way to make a dungeon, after random rooms and blocks.
 *
 * A **layout** is a design pattern: named parts with roles (a hall, a row of cells, a ring hub), how many rooms each holds (a
 * number or a parameter), where each stands against another (`at`), how they are tied (passages or doors through a shared wall),
 * the sockets where it joins something else (a part, a bearing, a width), and the constraints that keep its shape (rooms on a
 * line, rooms mirrored about another). A **rigid** layout places its parts exactly, as one block.
 *
 * A **design** uses layouts, names the rooms each role holds (`bind`), adds rooms and ways of its own, and joins sockets to
 * sockets or rooms. `expandDesign` turns it into a graph for `layoutGraph`, checking that joined sockets face one another and
 * match in width, and growing a room whose walls are too short for the ways that leave it (a ring hub's size grows with its
 * passages). Sizes are cells, as the graph's; bearings degrees clockwise from north, or a compass point.
 */
import { off } from './router.ts';
import { GRAPH_SHAPES, type Graph, type GraphRoom, type GraphShape, type GraphWay } from './graph.ts';
import { DOOR_KINDS, type DoorKind } from './spec.ts';

/** A size: cells, a range (its middle is taken), or a parameter (`$name`, `$name*k`, `$name*k+c`). */
export type LayoutSize = number | [number, number] | string;
/** Which of a role's rooms: the first, the last, every one (the default), or the n-th (1-based). */
export type LayoutPick = 'first' | 'last' | 'each' | number;
/** A compass point or degrees clockwise from north. */
export type Bearing = number | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface LayoutParam { default: number; min?: number; max?: number; note?: string }
export interface LayoutPart {
  role: string;
  /** A graph shape, or `hall` (a rect that shows its name alone). Default rect. */
  shape?: GraphShape | 'hall';
  w: LayoutSize; h: LayoutSize;
  points?: number[];
  /** Rooms in the part (default 1): a number or a parameter. A design's `bind` may give the rooms instead. */
  count?: number | string;
  /** Where its rooms stand against another part: on that side of it (the ties between them keep that bearing); `touch` sets the room against it exactly (one room each); `hold` keeps the bearing as a rule. */
  at?: { part: string; side: Bearing; touch?: boolean; hold?: boolean };
  /** Rigid layouts: its box's top-left in the layout's frame (cells). */
  place?: { x: number; y: number };
  turns?: boolean;
  /** Not grown when its walls are short for its ways (default: grown). */
  grow?: boolean;
  /** The room the level is about (a note for the design; the layout does not act on it). */
  focal?: boolean;
  draw?: GraphRoom['draw']; symbols?: GraphRoom['symbols']; ring?: GraphRoom['ring'];
}
export interface LayoutTie {
  a: string; b: string;
  /** `passage` (a corridor between them) or `door` (a door through a wall they share). Unset: as the graph's `passages` share. */
  kind?: 'passage' | 'door';
  ofA?: LayoutPick; ofB?: LayoutPick;
  /** Rooms of one role in a chain: the bearing each keeps from the one before (and `loop` closes the chain). */
  side?: Bearing; loop?: boolean;
  /** A chain's bearing step by step (a spiral, a zigzag): the k-th from room k to room k+1; past its end, `side`. */
  sides?: Bearing[];
  doors?: [DoorKind | null, DoorKind | null]; style?: 'built' | 'natural'; hold?: boolean;
}
export interface LayoutSocket { name: string; part: string; of?: LayoutPick; bearing: Bearing; /** Cells (default the graph's passage width). */ width?: number; /** Keep the join's bearing as a rule (default true). */ hold?: boolean }
export type LayoutConstraint =
  | { line: string[]; along: 'ew' | 'ns' }
  | { mirror: [string, string]; about: string; along: 'ew' | 'ns' };
export interface Layout {
  id: string; name?: string; tags?: string[];
  /** Where it came from: written by hand, or abstracted from a drawn map (with the map and a note). Patterns hold topology and proportions, not the drawing. */
  source?: { kind: 'written' | 'drawn'; origin?: string; note?: string };
  params?: Record<string, LayoutParam>;
  parts: LayoutPart[]; ties?: LayoutTie[]; sockets?: LayoutSocket[]; constraints?: LayoutConstraint[];
  /** Parts placed exactly (`place`), moved as one block. */
  rigid?: boolean;
  /** Keep every `at` bearing as a rule. */
  hold?: boolean;
}

export interface DesignUse { id: string; layout: string; params?: Record<string, number> }
export interface DesignBind { use: string; role: string; rooms: (string | (Partial<GraphRoom> & { id: string }))[] }
export interface DesignJoin { from: string; to: string; kind?: 'passage' | 'door'; doors?: [DoorKind | null, DoorKind | null]; style?: 'built' | 'natural'; hold?: boolean }
/** A design: graph settings (all of a graph's but its rooms and ways), the layouts it uses, its own rooms and ways, and joins. */
export interface Design extends Omit<Graph, 'rooms' | 'ways'> {
  uses: DesignUse[]; bind?: DesignBind[]; joins?: DesignJoin[];
  rooms?: GraphRoom[]; ways?: GraphWay[];
  /** Layouts of its own, over the library's of the same id. */
  layouts?: Layout[];
}

/** What the expansion did: the rooms each use made, the sockets and whether each is joined, the rooms grown, and warnings. */
export interface ExpandReport {
  uses: { id: string; layout: string; rooms: string[] }[];
  sockets: { use: string; name: string; room: string; bearing: number; width: number; joined: boolean }[];
  grown: { room: string; from: [number, number]; to: [number, number]; ways: number }[];
  warnings: string[];
}

const COMPASS: Record<string, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
export const bearingOf = (b: Bearing): number => (typeof b === 'number' ? ((b % 360) + 360) % 360 : COMPASS[b]);
const isBearing = (b: unknown) => (typeof b === 'number' && Number.isFinite(b)) || (typeof b === 'string' && b in COMPASS);
const isPick = (p: unknown) => p === undefined || p === 'first' || p === 'last' || p === 'each' || (Number.isInteger(p) && (p as number) >= 1);
const SIZE_PARAM = /^\$([\w-]+)(?:\*(\d+(?:\.\d+)?))?(?:\+(-?\d+(?:\.\d+)?))?$/;

/** What is wrong with a layout, as messages (empty when it can be used). */
export function validateLayout(l: Layout): string[] {
  const e: string[] = [];
  if (!l || typeof l.id !== 'string' || !/^[\w-]+$/.test(l.id)) return ['id: letters, digits, - and _'];
  const at = (k: string) => `layout ${l.id}: ${k}`, roles = new Set<string>(), params = l.params ?? {};
  for (const [k, p] of Object.entries(params)) if (!(typeof p?.default === 'number' && (p.min === undefined || p.default >= p.min) && (p.max === undefined || p.default <= p.max))) e.push(at(`params.${k}: {default, min?, max?}, the default inside`));
  const size = (v: unknown, k: string) => {
    if (typeof v === 'number') { if (!(v > 0)) e.push(at(`${k}: cells, above 0`)); return; }
    if (Array.isArray(v)) { if (!(v.length === 2 && v[0] > 0 && v[0] <= v[1])) e.push(at(`${k}: [least, most] cells`)); return; }
    const m = typeof v === 'string' ? v.match(SIZE_PARAM) : null;
    if (!m) e.push(at(`${k}: cells, [least, most], or $param (with *k and +c)`)); else if (!(m[1] in params)) e.push(at(`${k}: no parameter ${m[1]}`));
  };
  if (!Array.isArray(l.parts) || !l.parts.length) e.push(at('parts: at least one'));
  (l.parts ?? []).forEach((p, i) => {
    const k = `parts[${i}]`;
    if (typeof p?.role !== 'string' || !/^[\w-]+$/.test(p.role)) e.push(at(`${k}.role: letters, digits, - and _`)); else if (roles.has(p.role)) e.push(at(`${k}.role: ${p.role} is used twice`)); else roles.add(p.role);
    if (p?.shape !== undefined && p.shape !== 'hall' && !GRAPH_SHAPES.includes(p.shape)) e.push(at(`${k}.shape: hall, ${GRAPH_SHAPES.join(', ')}`));
    size(p?.w, `${k}.w`); size(p?.h, `${k}.h`);
    if (p?.count !== undefined && !(Number.isInteger(p.count) && (p.count as number) >= 1) && !(typeof p.count === 'string' && SIZE_PARAM.test(p.count) && p.count.slice(1).split(/[*+]/)[0] in params)) e.push(at(`${k}.count: a whole number, or $param`));
    if (l.rigid && !(typeof p?.place?.x === 'number' && typeof p.place.y === 'number')) e.push(at(`${k}.place: a rigid layout places every part ({x, y})`));
    if (l.rigid && p?.count !== undefined && p.count !== 1) e.push(at(`${k}.count: a rigid layout's parts hold one room each`));
  });
  (l.parts ?? []).forEach((p, i) => {
    if (!p?.at) return;
    if (!roles.has(p.at.part)) e.push(at(`parts[${i}].at.part: no part ${p.at.part}`));
    if (!isBearing(p.at.side)) e.push(at(`parts[${i}].at.side: a compass point or degrees`));
  });
  (l.ties ?? []).forEach((t, i) => {
    for (const k of ['a', 'b'] as const) if (!roles.has(t?.[k])) e.push(at(`ties[${i}].${k}: no part ${JSON.stringify(t?.[k])}`));
    if (t?.kind !== undefined && t.kind !== 'passage' && t.kind !== 'door') e.push(at(`ties[${i}].kind: passage or door`));
    if (!isPick(t?.ofA) || !isPick(t?.ofB)) e.push(at(`ties[${i}].ofA/ofB: first, last, each or n`));
    if (t?.side !== undefined && !isBearing(t.side)) e.push(at(`ties[${i}].side: a compass point or degrees`));
    if (t?.sides !== undefined && !(Array.isArray(t.sides) && t.sides.every(isBearing))) e.push(at(`ties[${i}].sides: compass points or degrees`));
    if (t?.doors !== undefined && !(Array.isArray(t.doors) && t.doors.length === 2 && t.doors.every(d => d === null || DOOR_KINDS.includes(d)))) e.push(at(`ties[${i}].doors: [kind|null, kind|null]`));
  });
  const names = new Set<string>();
  (l.sockets ?? []).forEach((s, i) => {
    if (typeof s?.name !== 'string' || !/^[\w-]+$/.test(s.name)) e.push(at(`sockets[${i}].name: letters, digits, - and _`)); else if (names.has(s.name)) e.push(at(`sockets[${i}].name: ${s.name} is used twice`)); else names.add(s.name);
    if (!roles.has(s?.part)) e.push(at(`sockets[${i}].part: no part ${JSON.stringify(s?.part)}`));
    if (!isBearing(s?.bearing)) e.push(at(`sockets[${i}].bearing: a compass point or degrees`));
    if (!isPick(s?.of)) e.push(at(`sockets[${i}].of: first, last, each or n`));
  });
  (l.constraints ?? []).forEach((c, i) => {
    const rs = 'line' in c ? c.line : 'mirror' in c ? [...c.mirror, c.about] : null;
    if (!rs) { e.push(at(`constraints[${i}]: {line, along} or {mirror, about, along}`)); return; }
    for (const r of rs) if (!roles.has(r)) e.push(at(`constraints[${i}]: no part ${JSON.stringify(r)}`));
    if (c.along !== 'ew' && c.along !== 'ns') e.push(at(`constraints[${i}].along: ew or ns`));
  });
  return e;
}

/** Pick rooms of a role. */
function picked(rooms: string[], p: LayoutPick | undefined): string[] {
  if (p === undefined || p === 'each') return rooms;
  if (p === 'first') return rooms.slice(0, 1);
  if (p === 'last') return rooms.slice(-1);
  return rooms[p - 1] !== undefined ? [rooms[p - 1]] : [];
}

/** The ways one room's walls hold, about: one door for each two passage widths of wall. */
function capacity(r: GraphRoom, width: number): number {
  const shape = r.shape ?? 'rect';
  const perimeter = shape === 'round' ? (Math.PI * (r.w + r.h)) / 2 : shape === 'octagon' ? 2 * (r.w + r.h) * 0.83 : shape === 'hexagon' ? 2 * (r.w + r.h) * 0.8 : 2 * (r.w + r.h);
  return Math.floor(perimeter / (2 * width));
}

/**
 * A design as a graph for `layoutGraph`: each use's rooms (named by `bind`, else `<use>.<role>` and `<use>.<role>.<n>`), its
 * ties as ways (bearing from `at` or a chain's `side`), its constraints as lines and mirrors, and the joins as ways that leave
 * each socket by its wall. `library` is the layouts to draw on (the bundled set, the project's); the design's own win. Throws
 * with every problem when the design cannot be expanded.
 */
export function expandDesign(d: Design, library: Layout[] = []): { graph: Graph; report: ExpandReport } {
  const problems: string[] = [], warnings: string[] = [], report: ExpandReport = { uses: [], sockets: [], grown: [], warnings };
  const width = d.width ?? 2, byId = new Map<string, Layout>();
  for (const l of [...library, ...(d.layouts ?? [])]) byId.set(l.id, l);
  const rooms: GraphRoom[] = (d.rooms ?? []).map(r => ({ ...r })), ways: GraphWay[] = (d.ways ?? []).map(w => ({ ...w }));
  const lines: NonNullable<Graph['lines']> = [...(d.lines ?? [])], mirrors: NonNullable<Graph['mirrors']> = [...(d.mirrors ?? [])];
  const sockets = new Map<string, { room: string; bearing: number; width: number; hold: boolean }>(), uses = new Set<string>();
  const ids = new Set(rooms.map(r => r.id)), fixedSize = new Set<string>();
  const addRoom = (r: GraphRoom) => { if (ids.has(r.id)) problems.push(`room ${r.id} is made twice`); ids.add(r.id); rooms.push(r); };
  if (!Array.isArray(d.uses)) problems.push('uses: an array of {id, layout, params?}');

  for (const u of d.uses ?? []) {
    if (typeof u?.id !== 'string' || !/^[\w-]+$/.test(u.id)) { problems.push(`uses: an id of letters, digits, - and _ (${JSON.stringify(u?.id)})`); continue; }
    if (uses.has(u.id)) { problems.push(`uses: ${u.id} is used twice`); continue; }
    uses.add(u.id);
    const l = byId.get(u.layout);
    if (!l) { problems.push(`uses ${u.id}: no layout ${JSON.stringify(u.layout)} (the bundled ones: ${library.map(x => x.id).join(', ')})`); continue; }
    const errs = validateLayout(l);
    if (errs.length) { problems.push(...errs); continue; }
    // the parameters: the layout's defaults, the use's values, each kept to its range
    const params: Record<string, number> = {};
    for (const [k, p] of Object.entries(l.params ?? {})) {
      const v = u.params?.[k] ?? p.default;
      if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max)) problems.push(`uses ${u.id}: ${k} ${v} is outside ${p.min ?? '…'}..${p.max ?? '…'}`);
      params[k] = v;
    }
    for (const k of Object.keys(u.params ?? {})) if (!(k in params)) problems.push(`uses ${u.id}: layout ${l.id} has no parameter ${k}`);
    const value = (v: LayoutSize | number | string): number => {
      if (typeof v === 'number') return v;
      if (Array.isArray(v)) return Math.round((v[0] + v[1]) / 2);
      const m = v.match(SIZE_PARAM)!;
      return params[m[1]] * (m[2] ? +m[2] : 1) + (m[3] ? +m[3] : 0);
    };
    // each part's rooms: bound ones by name (with what the binding sets), else named after the use and role
    const roomsOf = new Map<string, string[]>(), size = new Map<string, [number, number]>(), made: string[] = [];
    for (const p of l.parts) {
      const bound = (d.bind ?? []).filter(b => b.use === u.id && b.role === p.role).flatMap(b => b.rooms);
      const count = p.count === undefined ? (bound.length || 1) : Math.round(value(p.count));
      if (bound.length && bound.length !== count) problems.push(`bind ${u.id}.${p.role}: ${bound.length} rooms for a part of ${count}`);
      const n = bound.length || count, w = value(p.w), h = value(p.h);
      size.set(p.role, [w, h]);
      const list: string[] = [];
      for (let k = 0; k < n; k++) {
        const b = bound[k], over = typeof b === 'object' ? b : {}, id = typeof b === 'string' ? b : b?.id ?? (n === 1 ? `${u.id}.${p.role}` : `${u.id}.${p.role}.${k + 1}`);
        // a room no binding names is a placeholder: drawn unlabelled (its id is long), so it is named by binding it
        const room: GraphRoom = {
          id, w, h, ...(typeof b !== 'string' && !b?.id && { label: '' }), ...(p.shape && p.shape !== 'hall' && { shape: p.shape }), ...(p.shape === 'hall' && { hall: true }), ...(p.points && { points: p.points }),
          ...(p.turns && !l.rigid && { turns: true }), ...(p.draw && { draw: p.draw }), ...(p.symbols && { symbols: p.symbols }), ...(p.ring && { ring: p.ring }), ...over,
        };
        addRoom(room);
        if (p.grow === false) fixedSize.add(id);
        list.push(id); made.push(id);
      }
      roomsOf.set(p.role, list);
    }
    report.uses.push({ id: u.id, layout: l.id, rooms: made });
    // a rigid layout: every room set against the first, at the offset between their places
    if (l.rigid) {
      const [first, ...rest] = l.parts, a = roomsOf.get(first.role)![0], [aw, ah] = size.get(first.role)!;
      const ac: [number, number] = [first.place!.x + aw / 2, first.place!.y + ah / 2];
      for (const p of rest) {
        const [w, h] = size.get(p.role)!, r = rooms.find(x => x.id === roomsOf.get(p.role)![0])!;
        r.against = { room: a, dx: p.place!.x + w / 2 - ac[0], dy: p.place!.y + h / 2 - ac[1] };
      }
    }
    // ties: chains within a role, else the picked rooms of each side, each pair once
    const partOf = new Map(l.parts.map(p => [p.role, p]));
    for (const t of l.ties ?? []) {
      const A = roomsOf.get(t.a)!, B = roomsOf.get(t.b)!, run = t.kind === undefined ? undefined : t.kind === 'passage' ? 'passage' as const : 'wall' as const;
      const extra = { ...(run && { run }), ...(t.doors && { doors: t.doors }), ...(t.style && { style: t.style }) };
      if (t.a === t.b) {
        const chain = A.map((x, k) => [x, A[k + 1]] as const).filter(([, y]) => y !== undefined) as [string, string][];
        if (t.loop && A.length > 2) chain.push([A[A.length - 1], A[0]]);
        chain.forEach(([x, y], k) => {
          const side = t.sides?.[k] ?? t.side;
          ways.push({ a: x, b: y, ...extra, ...(side !== undefined && { bearing: bearingOf(side) }), ...((t.hold ?? l.hold) && side !== undefined && { hold: true }) });
        });
        continue;
      }
      // a bearing from `at`: the part that stands on a side of the other keeps that bearing from it
      // (a row of several rooms on a side keeps to it by its line, not by a bearing from the other's centre, which would pull
      // the row's ends off the wall they share)
      const pa = partOf.get(t.a)!, pb = partOf.get(t.b)!, row = (p: LayoutPart) => roomsOf.get(p.role)!.length > 1 && bearingOf(p.at!.side) % 90 === 0;
      const bearing = pb.at?.part === t.a && !row(pb) ? bearingOf(pb.at.side) : pa.at?.part === t.b && !row(pa) ? (bearingOf(pa.at.side) + 180) % 360 : undefined;
      const hold = t.hold ?? (pb.at?.part === t.a ? pb.at.hold : pa.at?.part === t.b ? pa.at.hold : undefined) ?? l.hold;
      for (const x of picked(A, t.ofA)) for (const y of picked(B, t.ofB)) ways.push({ a: x, b: y, ...extra, ...(bearing !== undefined && { bearing }), ...(hold && bearing !== undefined && { hold: true }) });
    }
    // `touch`: a room set against the one it stands beside, its box against that one's side
    for (const p of l.parts) {
      if (!p.at?.touch || l.rigid) continue;
      const mine = roomsOf.get(p.role)!, theirs = roomsOf.get(p.at.part)!;
      if (mine.length !== 1 || theirs.length !== 1) { warnings.push(`uses ${u.id}: ${p.role} touches ${p.at.part} only with one room each; it keeps the bearing instead`); continue; }
      const [w, h] = size.get(p.role)!, [W, H] = size.get(p.at.part)!, rad = (bearingOf(p.at.side) * Math.PI) / 180, sx = Math.round(Math.sin(rad)), sy = Math.round(-Math.cos(rad));
      // beside a side, its box lines up with that side's top or left edge (centred, an odd difference in size would leave its
      // corner off the lattice); at a corner, against both
      rooms.find(x => x.id === mine[0])!.against = { room: theirs[0], dx: sx ? (sx * (w + W)) / 2 : (w - W) / 2, dy: sy ? (sy * (h + H)) / 2 : (h - H) / 2 };
    }
    // rooms of a counted part that stand on one side of another stand in a row along it
    for (const p of l.parts) {
      const mine = roomsOf.get(p.role)!;
      if (!p.at || mine.length < 2) continue;
      const b = bearingOf(p.at.side);
      if (b % 90 === 0) lines.push({ rooms: mine, along: b % 180 === 0 ? 'ew' : 'ns' });
    }
    for (const c of l.constraints ?? []) {
      if ('line' in c) lines.push({ rooms: c.line.flatMap(r => roomsOf.get(r)!), along: c.along });
      else {
        const [A, B] = c.mirror.map(r => roomsOf.get(r)!), about = roomsOf.get(c.about)!;
        if (A.length !== B.length || about.length !== 1) { warnings.push(`uses ${u.id}: a mirror pairs parts of one size about a part of one room`); continue; }
        A.forEach((x, k) => mirrors.push({ a: x, b: B[k], about: about[0], along: c.along }));
      }
    }
    for (const s of l.sockets ?? []) {
      const room = picked(roomsOf.get(s.part)!, s.of ?? 'first')[0];
      if (!room) { problems.push(`uses ${u.id}: socket ${s.name} picks no room of ${s.part}`); continue; }
      const sk = { room, bearing: bearingOf(s.bearing), width: s.width ?? width, hold: s.hold ?? true };
      sockets.set(`${u.id}.${s.name}`, sk);
      if (sk.width !== width) warnings.push(`socket ${u.id}.${s.name} is ${sk.width} cells wide; passages are drawn ${width} (the graph's width)`);
    }
  }
  for (const b of d.bind ?? []) if (!uses.has(b.use)) problems.push(`bind: no use ${b.use}`);

  // joins: a socket leaves its room by its wall and keeps its bearing; two sockets must face each other and match in width
  const joined = new Set<string>();
  for (const [i, j] of (d.joins ?? []).entries()) {
    const end = (v: string) => sockets.get(v) ?? (ids.has(v) ? { room: v } : null);
    const A = end(j?.from), B = end(j?.to);
    if (!A) problems.push(`joins[${i}].from: no socket or room ${JSON.stringify(j?.from)}`);
    if (!B) problems.push(`joins[${i}].to: no socket or room ${JSON.stringify(j?.to)}`);
    if (!A || !B) continue;
    const sa = 'bearing' in A ? A : null, sb = 'bearing' in B ? B : null;
    if (sa && sb) {
      if (off(sa.bearing, (sb.bearing + 180) % 360) > 45) problems.push(`joins[${i}]: ${j.from} faces ${sa.bearing}° and ${j.to} ${sb.bearing}°; joined sockets face one another`);
      if (sa.width !== sb.width) problems.push(`joins[${i}]: ${j.from} is ${sa.width} cells wide and ${j.to} ${sb.width}`);
    }
    if (sa) joined.add(j.from);
    if (sb) joined.add(j.to);
    const bearing = sa ? sa.bearing : sb ? (sb.bearing + 180) % 360 : undefined, hold = j.hold ?? ((sa?.hold ?? false) || (sb?.hold ?? false));
    ways.push({
      a: A.room, b: B.room, ...(bearing !== undefined && { bearing }), ...(hold && bearing !== undefined && { hold: true }), ...(sa && { wall: sa.bearing }), ...(sb && { wallB: sb.bearing }),
      ...(j.kind && { run: j.kind === 'passage' ? 'passage' as const : 'wall' as const }), ...(j.doors && { doors: j.doors }), ...(j.style && { style: j.style }),
    });
  }
  for (const [k, s] of sockets) report.sockets.push({ use: k.split('.')[0], name: k.slice(k.indexOf('.') + 1), room: s.room, bearing: s.bearing, width: s.width, joined: joined.has(k) });
  if (problems.length) throw new Error(`invalid design:\n  ${problems.join('\n  ')}`);

  // a room whose walls are short for its ways grows a passage's width at a time (a ring hub with eight ways needs room for them)
  const degree = new Map<string, Set<string>>();
  for (const w of ways) for (const [x, y] of [[w.a, w.b], [w.b, w.a]]) degree.set(x, (degree.get(x) ?? new Set()).add(y));
  for (const r of rooms) {
    const n = degree.get(r.id)?.size ?? 0;
    if (capacity(r, width) >= n || r.shape === 'poly') continue;
    if (fixedSize.has(r.id) || r.at || r.against) { warnings.push(`${r.id}: ${n} ways leave a ${r.w}×${r.h} room, more than its walls hold well`); continue; }
    const from: [number, number] = [r.w, r.h];
    while (capacity(r, width) < n) { r.w += width; r.h += width; }
    report.grown.push({ room: r.id, from, to: [r.w, r.h], ways: n });
  }

  const graph: Graph = { ...d, rooms, ways, ...(lines.length && { lines }), ...(mirrors.length && { mirrors }) };
  for (const k of ['uses', 'bind', 'joins', 'layouts'] as const) delete (graph as unknown as Record<string, unknown>)[k];
  return { graph, report };
}
