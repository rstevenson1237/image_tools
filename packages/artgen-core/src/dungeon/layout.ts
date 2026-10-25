/**
 * Dungeon geometry: each room's outline as a polygon, each corridor's centre line, and where its doors sit. The
 * renderer draws from this; the web tool uses it to find what was clicked.
 */
import { rng } from '../lib/rng.ts';
import { chaikin } from '../lib/trace.ts';
import { junctionPort, naturalOutline, portRoute, routeAround, sidePort, smoothLine, snap, tidy, type Port } from './corridors.ts';
import type { P } from './geom.ts';
import { corridorOrder, type Corridor, type DoorKind, type DungeonSpec, type Room } from './spec.ts';
import { layoutWalls } from './walls.ts';

export interface RoomGeom { room: Room; index: number; outline: number[]; cx: number; cy: number; number?: number }
/** Where a corridor leaves a room (on its outline), or its point end; the angle is the direction away from the room. `along` is how far the corridor runs inside the room to get there (cells; 0 at a point end). */
export interface EndGeom { x: number; y: number; angle: number; along: number }
/** A corridor's centre line and width, where it leaves each end, and for a natural passage the outline of its floor. */
export interface CorridorGeom { index: number; pts: number[]; width: number; ends: [EndGeom | null, EndGeom | null]; outline?: number[] }
export interface DoorGeom { kind: DoorKind; x: number; y: number; angle: number; width: number; corridor: number }
export interface DungeonLayout { rooms: RoomGeom[]; corridors: CorridorGeom[]; doors: DoorGeom[] }

/** Stable seed from a room id, so a cave keeps its outline when other rooms change. */
export const idSeed = (id: string) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

/** A room's outline as x,y pairs (cells), clockwise in screen space. */
export function roomOutline(r: Room): number[] {
  const { x, y, w, h } = r, cx = x + w / 2, cy = y + h / 2;
  if (r.shape === 'rect') return [x, y, x + w, y, x + w, y + h, x, y + h];
  if (r.shape === 'poly') return r.points!.slice();
  if (r.shape === 'octagon') {
    const c = Math.max(0.5, Math.round(Math.min(w, h) * 0.3 * 2) / 2);
    return [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
  }
  const n = r.shape === 'circle' ? 64 : 22, out: number[] = [];
  if (r.shape === 'circle') {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2); }
    return out;
  }
  // cave: a wobbly ring (a few low harmonics with seeded phases), rounded off
  const rand = rng(r.seed ?? idSeed(r.id)), ph = [rand(), rand(), rand(), rand()].map(v => v * Math.PI * 2), amp = [0.12, 0.08, 0.05];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = 0.84 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(5 * a + ph[2]) + 0.04 * (rand() - 0.5);
    out.push(cx + Math.cos(a) * (w / 2) * Math.min(1, f + 0.08), cy + Math.sin(a) * (h / 2) * Math.min(1, f + 0.08));
  }
  return chaikin({ pts: out, closed: true }, 2).pts;
}

export function inPolygon(p: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a polygon's nearest edge. */
function edgeDistance(p: number[], x: number, y: number): number {
  let d = Infinity;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const ax = p[j], ay = p[j + 1], bx = p[i], by = p[i + 1], L = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)) : 0;
    d = Math.min(d, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)));
  }
  return d;
}

/**
 * The point a corridor starts from, and the badge sits on: a room's centre, or for a poly room the half-cell point
 * deepest inside it (an L-shaped room's centre can sit on its wall or outside it).
 */
function roomAnchor(r: Room, outline: number[]): [number, number] {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (r.shape !== 'poly') return [cx, cy];
  let best: [number, number] = [cx, cy], score = -Infinity;
  for (let j = r.y + 0.5; j < r.y + r.h; j += 0.5) for (let i = r.x + 0.5; i < r.x + r.w; i += 0.5) {
    if (!inPolygon(outline, i, j)) continue;
    const s = Math.min(edgeDistance(outline, i, j), 1.5) - 0.01 * Math.hypot(i - cx, j - cy);
    if (s > score) { score = s; best = [i, j]; }
  }
  return best;
}


/** The core of a room a straight corridor can be sure to reach (round and cave rooms are narrower at the edges). */
function core(g: RoomGeom): [number, number, number, number] {
  const r = g.room, s = r.shape === 'rect' || r.shape === 'poly' ? 0 : 0.2;
  return [r.x + r.w * s, r.y + r.h * s, r.x + r.w * (1 - s), r.y + r.h * (1 - s)];
}

function route(a: RoomGeom | [number, number], b: RoomGeom | [number, number], width: number, how: string, rooms: RoomGeom[]): number[] {
  const pa: [number, number] = Array.isArray(a) ? a : [a.cx, a.cy], pb: [number, number] = Array.isArray(b) ? b : [b.cx, b.cy];
  if (how === 'straight') return [...pa, ...pb];
  if (how === 'auto' && !Array.isArray(a) && !Array.isArray(b)) {
    // rooms that line up get one straight corridor through the shared span
    const [ax0, ay0, ax1, ay1] = core(a), [bx0, by0, bx1, by1] = core(b);
    const lo = Math.max(ax0, bx0), hi = Math.min(ax1, bx1);
    if (hi - lo >= width + 1) { const x = Math.min(hi - width / 2, Math.max(lo + width / 2, snap((lo + hi) / 2, width))); return [x, pa[1], x, pb[1]]; }
    const lo2 = Math.max(ay0, by0), hi2 = Math.min(ay1, by1);
    if (hi2 - lo2 >= width + 1) { const y = Math.min(hi2 - width / 2, Math.max(lo2 + width / 2, snap((lo2 + hi2) / 2, width))); return [pa[0], y, pb[0], y]; }
  }
  const ax = Array.isArray(a) ? pa[0] : snap(pa[0], width), ay = Array.isArray(a) ? pa[1] : snap(pa[1], width);
  const bx = Array.isArray(b) ? pb[0] : snap(pb[0], width), by = Array.isArray(b) ? pb[1] : snap(pb[1], width);
  const hv = [ax, ay, bx, ay, bx, by], vh = [ax, ay, ax, by, bx, by];
  if (how === 'hv') return hv;
  if (how === 'vh') return vh;
  // auto: the elbow whose bend is not inside some other room (or across then down)
  const blocked = (x: number, y: number) => rooms.some(g => g !== a && g !== b && inPolygon(g.outline, x, y));
  return blocked(bx, ay) && !blocked(ax, by) ? vh : hv;
}

/** Where a path leaves a polygon it starts in: the point and the direction of travel there. */
function exitPoint(outline: number[], pts: number[]): EndGeom | null {
  let along = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    if (inPolygon(outline, x1, y1)) { along += Math.hypot(x1 - x0, y1 - y0); continue; }
    let lo = 0, hi = 1;
    if (!inPolygon(outline, x0, y0)) return null;
    for (let k = 0; k < 30; k++) { const t = (lo + hi) / 2; if (inPolygon(outline, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) lo = t; else hi = t; }
    return { x: x0 + (x1 - x0) * lo, y: y0 + (y1 - y0) * lo, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, along: along + Math.hypot(x1 - x0, y1 - y0) * lo };
  }
  return null;
}

const reversed = (p: number[]) => { const out: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]); return out; };

/** Where a path that ends at a point leaves it: the point, and the direction away along the path. */
const pointEnd = (path: number[]): EndGeom => ({ x: path[0], y: path[1], angle: (Math.atan2(path[1] - path[3], path[0] - path[2]) * 180) / Math.PI, along: 0 });

/** One corridor's geometry: its centre line from end to end, where it leaves each room, and a natural passage's floor. */
function corridorGeom(c: Corridor, index: number, rooms: RoomGeom[], byId: Map<string, RoomGeom>, lineOf: Map<string, number[]>, spec: DungeonSpec): CorridorGeom {
  const width = c.width ?? 1, how = c.route ?? 'auto';
  const simple = (e: Corridor['from']) => 'at' in e || ('room' in e && e.side === undefined);
  let pts: number[];
  if (simple(c.from) && simple(c.to)) {
    // rooms by their centres and points: the plain routes, as they always were
    const end = (e: Corridor['from']): RoomGeom | [number, number] => ('room' in e ? byId.get(e.room)! : (e as { at: [number, number] }).at);
    const a = end(c.from), b = end(c.to), pa: P = Array.isArray(a) ? a : [a.cx, a.cy], pb: P = Array.isArray(b) ? b : [b.cx, b.cy];
    pts = c.via?.length ? [...pa, ...c.via, ...pb]
      : how === 'around' ? around(pa, pb, a, b, width, rooms, spec) ?? route(a, b, width, 'auto', rooms)
      : route(a, b, width, how, rooms);
  } else {
    const port = (e: Corridor['from'], other: P): Port => {
      if ('room' in e) { const g = byId.get(e.room)!; return e.side ? sidePort(g, e.side, e.offset, width) : { p: [g.cx, g.cy], room: g }; }
      if ('at' in e) return { p: e.at };
      return junctionPort(lineOf.get(e.corridor) ?? [0, 0, 0, 0], e.near ?? other);
    };
    // a junction end looks toward the other end: lay the other end out first
    const guess = (e: Corridor['from']): P => ('room' in e ? [byId.get(e.room)!.cx, byId.get(e.room)!.cy] : 'at' in e ? e.at : e.near ?? [spec.cols / 2, spec.rows / 2]);
    const b0 = 'corridor' in c.to ? null : port(c.to, guess(c.from)), a = port(c.from, b0 ? b0.stub ?? b0.p : guess(c.to)), b = b0 ?? port(c.to, a.stub ?? a.p);
    const A = a.stub ?? a.p, B = b.stub ?? b.p;
    const mid = c.via?.length ? [...A, ...c.via, ...B]
      : how === 'straight' ? [...A, ...B]
      : how === 'around' ? around(A, B, a.room ?? A, b.room ?? B, width, rooms, spec) ?? portRoute(a, b, width)
      : how === 'hv' ? [...A, B[0], A[1], ...B] : how === 'vh' ? [...A, A[0], B[1], ...B]
      : portRoute(a, b, width);
    pts = tidy([...a.p, ...mid, ...b.p]);
  }
  if (c.curve === 'smooth') pts = smoothLine(pts);
  const ends = ([[c.from, pts], [c.to, reversed(pts)]] as const).map(([e, path]) => ('room' in e ? exitPoint(byId.get(e.room)!.outline, path) : pointEnd(path))) as [EndGeom | null, EndGeom | null];
  const outline = c.style === 'natural' ? naturalOutline(pts, width, c.seed ?? idSeed(c.id ?? `corridor-${index}`)) : undefined;
  return { index, pts, width, ends, ...(outline?.length && { outline }) };
}

/** An `around` route between two ends (rooms or points), clear of every other room; null when there is none. */
function around(A: P, B: P, a: RoomGeom | P, b: RoomGeom | P, width: number, rooms: RoomGeom[], spec: DungeonSpec): number[] | null {
  const avoid = rooms.filter(g => g !== a && g !== b && g.room.fill !== 'cellar' && g.room.fill !== 'yard' && !inPolygon(g.outline, A[0], A[1]) && !inPolygon(g.outline, B[0], B[1]));
  return routeAround(A, B, width, avoid, spec.cols, spec.rows);
}

export function layoutDungeon(spec: DungeonSpec): DungeonLayout {
  let auto = 0;
  const rooms: RoomGeom[] = spec.rooms.map((room, index) => {
    const outline = roomOutline(room), [cx, cy] = roomAnchor(room, outline);
    const number = room.number === false ? undefined : room.number ?? ++auto;
    if (typeof room.number === 'number') auto = Math.max(auto, room.number);
    return { room, index, outline, cx, cy, number };
  });
  const byId = new Map(rooms.map(g => [g.room.id, g]));
  const geoms: CorridorGeom[] = new Array(spec.corridors.length), lineOf = new Map<string, number[]>();
  // corridors that join others are laid out after them (a file with a ring of joins does not validate)
  for (const index of corridorOrder(spec.corridors) ?? spec.corridors.map((_, i) => i)) {
    const c = spec.corridors[index];
    geoms[index] = corridorGeom(c, index, rooms, byId, lineOf, spec);
    if (c.id) lineOf.set(c.id, geoms[index].pts);
  }
  const corridors = geoms, doors: DoorGeom[] = [];
  corridors.forEach((g, index) => g.ends.forEach((p, i) => { const kind = spec.corridors[index].doors?.[i]; if (p && kind) doors.push({ kind, x: p.x, y: p.y, angle: p.angle, width: g.width, corridor: index }); }));
  return { rooms, corridors, doors };
}

/** The bounding box of everything drawn (rooms, corridor points, overlay), in cells. */
export function contentBox(spec: DungeonSpec, l = layoutDungeon(spec)): [number, number, number, number] | null {
  const xs: number[] = [], ys: number[] = [];
  const add = (p: number[], pad = 0) => { for (let i = 0; i < p.length; i += 2) { xs.push(p[i] - pad, p[i] + pad); ys.push(p[i + 1] - pad, p[i + 1] + pad); } };
  for (const g of l.rooms) add(g.outline);
  for (const c of l.corridors) add(c.outline ?? c.pts, c.outline ? 0 : c.width / 2);
  for (const o of [...spec.overlay.labels, ...spec.overlay.symbols]) add([o.x, o.y], 0.5);
  for (const w of layoutWalls(spec, l)) { add(w.ring, w.thickness / 2); for (const t of w.towers) add([t.x, t.y], t.size / 2); }
  if (!xs.length) return null;
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Move everything so the content sits `margin` cells from the edges, and size the map to fit (whole cells). */
export function fitDungeon(spec: DungeonSpec, margin = 2): DungeonSpec {
  const box = contentBox(spec);
  if (!box) return spec;
  const dx = Math.round(margin - box[0]), dy = Math.round(margin - box[1]);
  const mv = (p: number[]) => p.map((v, i) => v + (i % 2 ? dy : dx));
  const out = structuredClone(spec);
  for (const r of out.rooms) { r.x += dx; r.y += dy; if (r.points) r.points = mv(r.points); }
  for (const c of out.corridors) {
    for (const e of [c.from, c.to]) { if ('at' in e) e.at = [e.at[0] + dx, e.at[1] + dy]; if ('corridor' in e && e.near) e.near = [e.near[0] + dx, e.near[1] + dy]; }
    if (c.via) c.via = mv(c.via);
  }
  for (const o of [...out.overlay.labels, ...out.overlay.symbols]) { o.x += dx; o.y += dy; }
  // the walls and the underlay move with the rooms: a wall's own line and its gates, and the map unit at the corner
  for (const w of out.walls ?? []) { if (w.poly) w.poly = mv(w.poly); for (const g of w.gates ?? []) g.at = [g.at[0] + dx, g.at[1] + dy]; }
  if (out.underlay) out.underlay.origin = [out.underlay.origin[0] - dx * out.underlay.scale, out.underlay.origin[1] - dy * out.underlay.scale];
  out.cols = Math.max(4, Math.ceil(box[2] + dx + margin));
  out.rows = Math.max(4, Math.ceil(box[3] + dy + margin));
  return out;
}

/** The points of a path from `from` to `to` along its length (the cut ends interpolated). */
function stretch(path: number[], from: number, to: number): number[] {
  const out: number[] = [];
  let at = 0;
  const point = (i: number, t: number) => [path[i] + (path[i + 2] - path[i]) * t, path[i + 1] + (path[i + 3] - path[i + 1]) * t];
  for (let i = 0; i + 3 < path.length; i += 2) {
    const len = Math.hypot(path[i + 2] - path[i], path[i + 3] - path[i + 1]);
    if (len > 0 && at + len > from && at < to) {
      out.push(...point(i, Math.max(0, (from - at) / len)), ...point(i, Math.min(1, (to - at) / len)));
    }
    at += len;
  }
  return out;
}

/** A room by its id, else by its label (`F.3 Hall` → `F.3`, or the whole label). */
function findRoom(l: DungeonLayout, ref: string): RoomGeom {
  const hits = [(g: RoomGeom) => g.room.id === ref, (g: RoomGeom) => g.room.label === ref, (g: RoomGeom) => g.room.label?.split(/\s+/)[0] === ref]
    .map(test => l.rooms.filter(test)).find(h => h.length);
  if (!hits) throw new Error(`--room: no room ${ref} (ids: ${l.rooms.map(g => g.room.id).join(', ')}; labels: ${l.rooms.flatMap(g => g.room.label ? [g.room.label.split(/\s+/)[0]] : []).join(', ')})`);
  if (hits.length > 1) throw new Error(`--room: ${ref} names ${hits.length} rooms (${hits.map(g => g.room.id).join(', ')}); use an id`);
  return hits[0];
}

/**
 * The window (x, y, w, h in cells) round the rooms `ids` (ids or label codes): each room, its doors and the first `margin` cells of every
 * corridor that leaves it, and half a cell of wall round the lot.
 */
export function roomCrop(spec: DungeonSpec, ids: string[], margin = 2, l = layoutDungeon(spec)): [number, number, number, number] {
  if (!ids.length) throw new Error('--room: at least one room id');
  const xs: number[] = [], ys: number[] = [];
  const add = (p: number[], pad: number) => { for (let i = 0; i < p.length; i += 2) { xs.push(p[i] - pad, p[i] + pad); ys.push(p[i + 1] - pad, p[i + 1] + pad); } };
  for (const ref of ids) {
    const g = findRoom(l, ref), id = g.room.id;
    add(g.outline, 0.5);
    spec.corridors.forEach((sc, i) => {
      const c = l.corridors[i];
      ([sc.from, sc.to] as const).forEach((e, end) => {
        const x = c.ends[end];
        if (!('room' in e) || e.room !== id || !x) return;
        add(stretch(end === 0 ? c.pts : reversed(c.pts), x.along, x.along + margin), c.width / 2 + 0.5);
      });
    });
  }
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}
