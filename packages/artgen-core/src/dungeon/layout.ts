/**
 * Dungeon geometry: each room's outline as a polygon, each corridor's centre line, and where its doors sit. The
 * renderer draws from this; the web tool uses it to find what was clicked.
 */
import { rng } from '../lib/rng.ts';
import { chaikin } from '../lib/trace.ts';
import type { CorridorEnd, DoorKind, DungeonSpec, Room } from './spec.ts';

export interface RoomGeom { room: Room; index: number; outline: number[]; cx: number; cy: number; number?: number }
/** Where a corridor leaves a room (on its outline), or its point end; the angle is the direction away from the room. `along` is how far the corridor runs inside the room to get there (cells; 0 at a point end). */
export interface EndGeom { x: number; y: number; angle: number; along: number }
export interface CorridorGeom { index: number; pts: number[]; width: number; ends: [EndGeom | null, EndGeom | null] }
export interface DoorGeom { kind: DoorKind; x: number; y: number; angle: number; width: number; corridor: number }
export interface DungeonLayout { rooms: RoomGeom[]; corridors: CorridorGeom[]; doors: DoorGeom[] }

/** Stable seed from a room id, so a cave keeps its outline when other rooms change. */
const idSeed = (id: string) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

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

/** A centre line on the grid: odd widths run down the middle of a row of cells, even widths along a grid line. */
const snap = (v: number, w: number) => (Math.round(w) % 2 ? Math.floor(v) + 0.5 : Math.round(v));

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

export function layoutDungeon(spec: DungeonSpec): DungeonLayout {
  let auto = 0;
  const rooms: RoomGeom[] = spec.rooms.map((room, index) => {
    const outline = roomOutline(room), [cx, cy] = roomAnchor(room, outline);
    const number = room.number === false ? undefined : room.number ?? ++auto;
    if (typeof room.number === 'number') auto = Math.max(auto, room.number);
    return { room, index, outline, cx, cy, number };
  });
  const byId = new Map(rooms.map(g => [g.room.id, g]));
  const end = (e: CorridorEnd): RoomGeom | [number, number] => ('room' in e ? byId.get(e.room)! : e.at);
  const corridors: CorridorGeom[] = [], doors: DoorGeom[] = [];
  spec.corridors.forEach((c, index) => {
    const width = c.width ?? 1, a = end(c.from), b = end(c.to);
    const pts = c.via?.length
      ? [...(Array.isArray(a) ? a : [a.cx, a.cy]), ...c.via, ...(Array.isArray(b) ? b : [b.cx, b.cy])]
      : route(a, b, width, c.route ?? 'auto', rooms);
    const ends = ([[a, pts], [b, reversed(pts)]] as const).map(([e, path]) =>
      Array.isArray(e) ? { x: e[0], y: e[1], angle: (Math.atan2(path[1] - path[3], path[0] - path[2]) * 180) / Math.PI, along: 0 } : exitPoint(e.outline, path)) as [EndGeom | null, EndGeom | null];
    corridors.push({ index, pts, width, ends });
    ends.forEach((p, i) => { const kind = c.doors?.[i]; if (p && kind) doors.push({ kind, x: p.x, y: p.y, angle: p.angle, width, corridor: index }); });
  });
  return { rooms, corridors, doors };
}

/** The bounding box of everything drawn (rooms, corridor points, overlay), in cells. */
export function contentBox(spec: DungeonSpec, l = layoutDungeon(spec)): [number, number, number, number] | null {
  const xs: number[] = [], ys: number[] = [];
  const add = (p: number[], pad = 0) => { for (let i = 0; i < p.length; i += 2) { xs.push(p[i] - pad, p[i] + pad); ys.push(p[i + 1] - pad, p[i + 1] + pad); } };
  for (const g of l.rooms) add(g.outline);
  for (const c of l.corridors) add(c.pts, c.width / 2);
  for (const o of [...spec.overlay.labels, ...spec.overlay.symbols]) add([o.x, o.y], 0.5);
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
    for (const e of [c.from, c.to]) if ('at' in e) e.at = [e.at[0] + dx, e.at[1] + dy];
    if (c.via) c.via = mv(c.via);
  }
  for (const o of [...out.overlay.labels, ...out.overlay.symbols]) { o.x += dx; o.y += dy; }
  out.cols = Math.max(4, Math.ceil(box[2] + dx + margin));
  out.rows = Math.max(4, Math.ceil(box[3] + dy + margin));
  return out;
}
