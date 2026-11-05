/**
 * The floor as drawn, read from the layout (never derived a second time): which room or corridor owns a point, which owns
 * each cell, which units meet along a cell edge, and whether each door stands on a wall between two floors. `facts` and
 * `check` read it, so a consumer does not rebuild the floor to test a file.
 *
 * A built corridor's floor is its centre line stroked to its width, square at the ends and mitred at the bends (as the
 * renderer draws it); a natural passage's floor is its outline; a room's floor is its outline.
 */
import { sharedEdges, type P } from './geom.ts';
import { inPolygon, type CorridorGeom, type DoorGeom, type DungeonLayout } from './layout.ts';
import type { DungeonSpec } from './spec.ts';

/** Whether (x, y) is on a built corridor's floor: within half its width of a run, each run reaching half a width past its ends. */
export function inBand(pts: number[], width: number, x: number, y: number): boolean {
  const h = width / 2 + 1e-9;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay, L = Math.hypot(dx, dy);
    if (L < 1e-9) { if (Math.abs(x - ax) <= h && Math.abs(y - ay) <= h) return true; continue; }
    const ux = dx / L, uy = dy / L, t = (x - ax) * ux + (y - ay) * uy, d = Math.abs((x - ax) * uy - (y - ay) * ux);
    if (t >= -h && t <= L + h && d <= h) return true;
  }
  return false;
}

/** Whether (x, y) is on a corridor's floor. */
export const inCorridor = (c: CorridorGeom, x: number, y: number): boolean => (c.outline ? inPolygon(c.outline, x, y) : inBand(c.pts, c.width, x, y));

/** A unit of floor: a room (by its index in `rooms`) or a corridor (by its index in `corridors`). */
export type Owner = { room: number } | { corridor: number };

/** A unit's name in facts: `room:<id>` or `corridor:<index>`. */
export const ownerName = (spec: DungeonSpec, o: Owner): string => ('room' in o ? `room:${spec.rooms[o.room].id}` : `corridor:${o.corridor}`);

/** Every unit whose floor holds (x, y): rooms first, in file order, then corridors. Cellars and yards are not floor, unless `all`. */
export function ownersAt(l: DungeonLayout, x: number, y: number, all = false): Owner[] {
  const out: Owner[] = [];
  l.rooms.forEach((g, i) => { const f = g.room.fill ?? 'floor'; if ((all || f === 'floor' || f === 'building') && inPolygon(g.outline, x, y)) out.push({ room: i }); });
  l.corridors.forEach((c, i) => { if (inCorridor(c, x, y)) out.push({ corridor: i }); });
  return out;
}

const same = (a: Owner, b: Owner) => ('room' in a ? 'room' in b && a.room === b.room : 'corridor' in b && a.corridor === b.corridor);
const has = (xs: Owner[], o: Owner) => xs.some(x => same(x, o));

/** The owner of each cell (by its centre): an index into `owners` (rooms, then corridors), -1 for rock. */
export interface FloorGrid { cols: number; rows: number; owners: Owner[]; cells: Int32Array; /** Every unit at each cell, where more than one. */ shared: Map<number, number[]> }

export function floorGrid(spec: DungeonSpec, l: DungeonLayout): FloorGrid {
  const owners: Owner[] = [...l.rooms.map((_, i) => ({ room: i })), ...l.corridors.map((_, i) => ({ corridor: i }))];
  const R = l.rooms.length, cells = new Int32Array(spec.cols * spec.rows).fill(-1), shared = new Map<number, number[]>();
  for (let y = 0; y < spec.rows; y++) for (let x = 0; x < spec.cols; x++) {
    const at = ownersAt(l, x + 0.5, y + 0.5).map(o => ('room' in o ? o.room : R + o.corridor));
    if (!at.length) continue;
    cells[y * spec.cols + x] = at[0];
    if (at.length > 1) shared.set(y * spec.cols + x, at);
  }
  return { cols: spec.cols, rows: spec.rows, owners, cells, shared };
}

/** Each row of the grid as runs: owner index, cells, owner index, cells, … (-1 for rock). */
export function gridRows(g: FloorGrid): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < g.rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < g.cols; x++) {
      const v = g.cells[y * g.cols + x];
      if (row.length && row[row.length - 2] === v) row[row.length - 1]++;
      else row.push(v, 1);
    }
    rows.push(row);
  }
  return rows;
}

/** The pairs of units whose cells meet edge to edge, with how many cell edges they share (owner indices, a < b). */
export function adjacency(g: FloorGrid): { a: number; b: number; along: number }[] {
  const count = new Map<string, number>();
  const add = (p: number, q: number) => { if (p < 0 || q < 0 || p === q) return; const k = p < q ? `${p},${q}` : `${q},${p}`; count.set(k, (count.get(k) ?? 0) + 1); };
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const v = g.cells[y * g.cols + x];
    if (x + 1 < g.cols) add(v, g.cells[y * g.cols + x + 1]);
    if (y + 1 < g.rows) add(v, g.cells[(y + 1) * g.cols + x]);
  }
  return [...count].map(([k, along]) => { const [a, b] = k.split(',').map(Number); return { a, b, along }; }).sort((p, q) => p.a - q.a || p.b - q.b);
}

/** How far either side of a door its two floors are looked for (cells). */
export const DOOR_PROBE = 0.25;

/**
 * Where a door stands: `wall` (between the floor it leads from and a different floor it leads to), `open` (the floor runs on
 * through it: a door in open floor), `rock` (one side is rock), or `end` (at a corridor's point end: a dead end or the way off
 * the map). `behind` and `ahead` are the units either side of it.
 */
export interface DoorStand { on: 'wall' | 'open' | 'rock' | 'end'; behind: Owner[]; ahead: Owner[] }

export function doorStand(spec: DungeonSpec, l: DungeonLayout, d: DoorGeom): DoorStand {
  const a = (d.angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  // every room counts here: a door may lead out of a cellar or a yard
  const behind = ownersAt(l, d.x - ux * DOOR_PROBE, d.y - uy * DOOR_PROBE, true), ahead = ownersAt(l, d.x + ux * DOOR_PROBE, d.y + uy * DOOR_PROBE, true);
  let from: Owner = { room: -1 }, to: Owner = { room: -1 };
  // a door in the run (`midDoors`) stands in the corridor's own floor: that is where it was put
  if (d.mid) return { on: 'open', behind, ahead };
  if (d.connection !== undefined) {
    const c = l.connections[d.connection], ia = l.rooms.findIndex(g => g.room.id === c.a), ib = l.rooms.findIndex(g => g.room.id === c.b);
    from = { room: ia }; to = { room: ib };
  } else {
    // a corridor's door stands at the end it leaves a room by: that room behind it, the corridor ahead
    const sc = spec.corridors[d.corridor], g = l.corridors[d.corridor];
    const k = g.ends.findIndex(e => e && Math.abs(e.x - d.x) < 1e-9 && Math.abs(e.y - d.y) < 1e-9);
    const end = sc[k === 1 ? 'to' : 'from'];
    if ('at' in end) return { on: 'end', behind, ahead };
    from = 'room' in end ? { room: l.rooms.findIndex(r => r.room.id === end.room) } : { corridor: spec.corridors.findIndex(c => c.id === end.corridor) };
    to = { corridor: d.corridor };
  }
  if (!behind.length || !ahead.length) return { on: 'rock', behind, ahead };
  const leaves = has(behind, from) && !has(ahead, from);
  const enters = 'room' in to ? has(ahead, to) && !has(behind, to) : has(ahead, to);
  // any other floor on both sides (a room the door stands inside) runs on through it; a corridor's own floor reaches back past its door
  const through = behind.some(o => has(ahead, o) && !same(o, to));
  return { on: leaves && enters && !through ? 'wall' : 'open', behind, ahead };
}

/** A built corridor's floor as polygons: each run a rectangle its width wide, reaching half a width past its ends (the square ends and mitred bends). */
export function corridorPieces(c: CorridorGeom): number[][] {
  if (c.outline) return [c.outline];
  const h = c.width / 2, out: number[][] = [];
  for (let i = 0; i + 3 < c.pts.length; i += 2) {
    const ax = c.pts[i], ay = c.pts[i + 1], dx = c.pts[i + 2] - ax, dy = c.pts[i + 3] - ay, L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const ux = dx / L, uy = dy / L, nx = -uy * h, ny = ux * h, x0 = ax - ux * h, y0 = ay - uy * h, x1 = ax + dx + ux * h, y1 = ay + dy + uy * h;
    out.push([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny]);
  }
  return out;
}

/** Where two different units' floors meet along a line: `a`'s floor on one side, `b`'s on the other, and nothing else on either. */
export interface Boundary { a: Owner; b: Owner; seg: [P, P] }

const STEP = 0.125;

/** The stretches of `seg` along which only `a` lies on one side and only `b` on the other (a door, a third floor or an overlap breaks it). */
function apart(l: DungeonLayout, a: Owner, b: Owner, seg: [P, P]): [P, P][] {
  const [p, q] = seg, L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (L < 1e-6) return [];
  const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, nx = -uy * 0.05, ny = ux * 0.05;
  const ok = (t: number) => {
    const x = p[0] + ux * t, y = p[1] + uy * t, s1 = ownersAt(l, x + nx, y + ny), s2 = ownersAt(l, x - nx, y - ny);
    const only = (s: Owner[], o: Owner) => s.length === 1 && same(s[0], o);
    return (only(s1, a) && only(s2, b)) || (only(s1, b) && only(s2, a));
  };
  const n = Math.max(1, Math.ceil(L / STEP)), out: [P, P][] = [];
  let start = -1;
  for (let k = 0; k <= n; k++) {
    const t = Math.min(L, (k + 0.5) * (L / n)), good = k < n && ok(t);
    if (good && start < 0) start = k;
    if (!good && start >= 0) {
      const t0 = start * (L / n), t1 = k * (L / n);
      out.push([[p[0] + ux * t0, p[1] + uy * t0], [p[0] + ux * t1, p[1] + uy * t1]]);
      start = -1;
    }
  }
  return out;
}

/**
 * Where a corridor's floor meets a room's floor or another corridor's along a line (touching, not overlapping): the walls
 * `style.sharedWalls: true` draws there. Floors that overlap (a corridor into its room, two corridors sharing cells) have no
 * boundary there, so an opening is left wherever a corridor runs into a floor.
 */
export function corridorBoundaries(l: DungeonLayout): Boundary[] {
  const out: Boundary[] = [], pieces = l.corridors.map(corridorPieces);
  const floors = l.rooms.filter(g => (g.room.fill ?? 'floor') === 'floor');
  const meet = (a: Owner, b: Owner, pa: number[], pb: number[]) => { for (const seg of sharedEdges(pa, pb)) for (const s of apart(l, a, b, seg)) out.push({ a, b, seg: s }); };
  l.corridors.forEach((c, i) => {
    if (c.outline) return;
    for (const g of floors) for (const piece of pieces[i]) meet({ room: g.index }, { corridor: i }, g.outline, piece);
    for (let j = i + 1; j < l.corridors.length; j++) if (!l.corridors[j].outline) for (const pa of pieces[i]) for (const pb of pieces[j]) meet({ corridor: i }, { corridor: j }, pa, pb);
  });
  return out;
}
