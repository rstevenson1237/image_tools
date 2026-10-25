/**
 * Facts read back from a dungeon (`artgen dungeon facts`): the layout a validator checks and a writer cites, stated as
 * numbers: each room's box, the corridors between them, where they leave the map, which rooms overlap and which no
 * corridor reaches.
 *
 * Everything is in cells and in the map's own scale unit (`scale.unit`). Positions, lengths and distances are rounded
 * to {@link RULES}.position cells, and a scale-unit value is the rounded cell value times `scale.perCell`, to the same
 * step. The same file gives the same facts; changing a rule changes what a consumer reads, so it is a format change
 * (see `format.ts`).
 */
import { roundTo } from '../lib/round.ts';
import { inPolygon, layoutDungeon, type DungeonLayout } from './layout.ts';
import { wallFacts, type WallFacts } from './walls.ts';
import type { CorridorEnd, DoorKind, DungeonSpec } from './spec.ts';

export const RULES = {
  /** Positions, lengths and distances in cells. */
  position: 0.1,
} as const;

export type Point = [number, number];
export type Edge = 'n' | 'e' | 's' | 'w';
/** A length in cells and in the map's scale unit. */
export interface Length { map: number; scale: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface Boxed { cells: Box; scale: Box }

export interface RoomDoor {
  kind: DoorKind;
  /** Where it sits on the room's outline; null when the corridor never leaves the room (rooms laid over each other), so no door is drawn. */
  at: Point | null;
  corridor: number;
  /** The room at the other end of the corridor; null when it ends at a point. */
  to: string | null;
}

export interface RoomFacts {
  id: string;
  /** The number on the badge; null when it is hidden. */
  number: number | null;
  label: string | null;
  shape: string;
  box: Boxed;
  doors: RoomDoor[];
}

export interface CorridorFacts {
  index: number;
  from: CorridorEnd;
  to: CorridorEnd;
  width: number;
  /** The door at each end (null: an open passage). */
  doors: [DoorKind | null, DoorKind | null];
  /** Its run between the two ends: outside the rooms it joins, from the edge of one to the edge of the other. */
  length: Length;
  /** Where it joins another corridor (a `{corridor: id}` end): the corridor's index and the point; absent when it joins none. */
  joins?: { corridor: number; at: Point }[];
}

export interface ExitFacts {
  corridor: number;
  /** Which end of the corridor is the point. */
  end: 'from' | 'to';
  at: Point;
  /** The room it leaves from; null when the corridor has a point at both ends. */
  room: string | null;
  door: DoorKind | null;
  /** The nearest edge of the map. */
  edge: Edge;
  /** How far the point is from that edge; negative when it lies beyond it. */
  distance: Length;
  /** The note at the map's edge and its link, when the end has an `exit`. */
  text?: string;
  href?: string;
}

export interface OverlapFacts {
  rooms: [string, string];
  /** The cells (their top-left corners, in reading order) whose centres lie in both rooms. */
  cells: Point[];
  count: number;
  box: Boxed;
}

export interface DungeonFacts {
  version: number;
  id: string;
  size: { cols: number; rows: number };
  unit: { map: 'cell'; scale: string };
  rules: typeof RULES;
  rooms: RoomFacts[];
  corridors: CorridorFacts[];
  exits: ExitFacts[];
  overlaps: OverlapFacts[];
  /** Rooms no corridor starts or ends at. */
  unreached: string[];
  /** Each wall's corners, towers and gates and the rooms it encloses (only when the file has `walls`). */
  walls?: WallFacts[];
}

export function dungeonFacts(spec: DungeonSpec, layout: DungeonLayout = layoutDungeon(spec)): DungeonFacts {
  const per = spec.scale.perCell, rnd = (v: number) => roundTo(v, RULES.position);
  const length = (cells: number): Length => { const m = rnd(cells); return { map: m, scale: rnd(m * per) }; };
  const pt = (x: number, y: number): Point => [rnd(x), rnd(y)];
  const box = (b: Box): Boxed => {
    const c = { x: rnd(b.x), y: rnd(b.y), w: rnd(b.w), h: rnd(b.h) };
    return { cells: c, scale: { x: rnd(c.x * per), y: rnd(c.y * per), w: rnd(c.w * per), h: rnd(c.h * per) } };
  };
  const roomOf = (e: CorridorEnd) => ('room' in e ? e.room : null);
  const ends = (['from', 'to'] as const);

  const rooms: RoomFacts[] = layout.rooms.map(g => ({
    id: g.room.id, number: g.number ?? null, label: g.room.label ?? null, shape: g.room.shape, box: box(g.room), doors: [],
  }));
  const byId = new Map(rooms.map(r => [r.id, r]));

  const corridors: CorridorFacts[] = [], exits: ExitFacts[] = [], reached = new Set<string>();
  spec.corridors.forEach((c, index) => {
    const geom = layout.corridors[index], doors = [c.doors?.[0] ?? null, c.doors?.[1] ?? null] as [DoorKind | null, DoorKind | null];
    let run = 0;
    for (let i = 2; i < geom.pts.length; i += 2) run += Math.hypot(geom.pts[i] - geom.pts[i - 2], geom.pts[i + 1] - geom.pts[i - 1]);
    run = Math.max(0, run - (geom.ends[0]?.along ?? 0) - (geom.ends[1]?.along ?? 0));
    const joins = ends.flatMap((side, k) => { const e = c[side]; if (!('corridor' in e)) return []; const j = spec.corridors.findIndex(x => x.id === e.corridor), p = geom.ends[k]; return j >= 0 && p ? [{ corridor: j, at: pt(p.x, p.y) }] : []; });
    corridors.push({ index, from: c.from, to: c.to, width: geom.width, doors, length: length(run), ...(joins.length && { joins }) });
    ends.forEach((side, k) => {
      const e = c[side], p = geom.ends[k], other = roomOf(c[ends[1 - k]]);
      if ('room' in e) {
        reached.add(e.room);
        if (doors[k]) byId.get(e.room)?.doors.push({ kind: doors[k]!, at: p ? pt(p.x, p.y) : null, corridor: index, to: other });
      } else if ('at' in e) {
        const [x, y] = e.at, dist: [Edge, number][] = [['n', y], ['e', spec.cols - x], ['s', spec.rows - y], ['w', x]];
        const [edge, d] = dist.reduce((a, b) => (b[1] < a[1] ? b : a));
        exits.push({ corridor: index, end: side, at: pt(x, y), room: other, door: doors[k], edge, distance: length(d), ...(e.exit && { text: e.exit.text }), ...(e.exit?.href && { href: e.exit.href }) });
      }
    });
  });

  const overlaps: OverlapFacts[] = [];
  for (let a = 0; a < layout.rooms.length; a++) for (let b = a + 1; b < layout.rooms.length; b++) {
    const A = layout.rooms[a], B = layout.rooms[b], cells: Point[] = [];
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) cells.push([x, y]);
    if (!cells.length) continue;
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]), bx = Math.min(...xs), by = Math.min(...ys);
    overlaps.push({ rooms: [A.room.id, B.room.id], cells, count: cells.length, box: box({ x: bx, y: by, w: Math.max(...xs) + 1 - bx, h: Math.max(...ys) + 1 - by }) });
  }

  return {
    version: spec.version, id: spec.id, size: { cols: spec.cols, rows: spec.rows }, unit: { map: 'cell', scale: spec.scale.unit }, rules: RULES,
    rooms, corridors, exits, overlaps, unreached: rooms.filter(r => !reached.has(r.id)).map(r => r.id),
    ...(spec.walls?.length && { walls: wallFacts(spec, layout) }),
  };
}
