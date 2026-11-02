/**
 * A dungeon laid out to a brief (R9 D6b, `artgen dungeon layout`): these rooms, at these sizes, joined as this graph, inside
 * this footprint. The rooms are packed close in a square (or the footprint's polygon), touching where a door through the
 * shared wall will do and a passage apart where it will not, and kept only where the router (`router.ts`) fits a passage
 * for every way. The packing is annealed: a seed fixes it. Energy terms: overlap, touching, rooms facing across a gap, the
 * mix of doors and passages, clearance round round rooms, room labels side by side, and floor that rooms share where one is
 * no box; moves shift, set against a neighbour, swap, turn or mirror, and set a room into the corners another leaves empty.
 * A repair loop re-anneals round the ways that found no passage or walk too far out of their way.
 *
 * Units: as the router's, one lattice cell (the passage's width) is 10 units. The graph and the file it writes are in cells.
 * Ported from setting_builder's tools/pack.py, which it retires; the setting's own rules (which way a stair leads, how far a
 * detour may run) come in as numbers.
 */
import { rng } from 'artgen-primitives/lib/rng.ts';
import { CIRCLE, detours, Footprint, LATTICE, plan, raster, routePoints, type Pt, type Route } from './router.ts';
import { DOOR_KINDS, newDungeon, parseDungeon, type Connection, type Corridor, type DoorKind, type DungeonSpec, type Room } from './spec.ts';

const GRID = LATTICE;           // units a room's corner moves by
const DOOR = 10;                // units of wall facing wall that a straight lane needs
const STEPS_N = 60000;
const FAR = 120;                // units between joined rooms past which the packing is penalised
const OVER = 40, CORNER = 1, STRAIGHT = 1, ROUND = 3, CLOSE = 1, PULL = 0.00004, REPAIR = 6, LABELS = 8, PIN = 2;
const CONTACT = 0.25;           // taken off for each cell edge two floors share, where either is no box
const TURN_SHARE = 0.06, NEST = 0.06;
const LABEL_H = 15, NAME_H = 7;
const REPAIRS = 8, REPAIR_STEPS = 20000;

/** Room shapes the layout knows: drawn as the dungeon's `rect cave circle octagon hexagon poly`. */
export const GRAPH_SHAPES = ['rect', 'cave', 'round', 'octagon', 'hexagon', 'poly'] as const;
export type GraphShape = (typeof GRAPH_SHAPES)[number];

/** A room of the graph: its size in cells, its shape (a poly's points in cells from its box's centre), and how it may lie. */
export interface GraphRoom {
  id: string; w: number; h: number; shape?: GraphShape; points?: number[]; label?: string;
  /** May lie in any quarter turn or mirror of itself (default false). */
  turns?: boolean;
  /** Shows its name alone (no number): its label is shorter. */
  hall?: boolean;
  /** Set against another room: its centre `dx, dy` cells from that room's. */
  against?: { room: string; dx: number; dy: number };
  /** Must stand over this box (cells, from the footprint's top-left): a room another level's stair comes down into. */
  over?: { x: number; y: number; w: number; h: number };
}
/** A way of the graph: the two rooms, the bearing to keep from a to b, the wall it leaves a by, and how it is drawn. */
export interface GraphWay {
  a: string; b: string;
  /** Degrees clockwise from north: b lies this way from a. */
  bearing?: number;
  /** Degrees clockwise from north: the wall of a the way leaves by (its door within half a compass point of it). */
  wall?: number;
  /** The door at a's end and b's (a kind or null, an open way); a way through a shared wall takes the first that is set. */
  doors?: [DoorKind | null, DoorKind | null];
  /** `natural`: a rough-cut passage. */
  style?: 'built' | 'natural';
  label?: string;
}
export interface Graph {
  id?: string; title?: string; rooms: GraphRoom[]; ways: GraphWay[];
  /** The passage's width in cells, which is also the lattice rooms and passages lie on (default 2: 10 ft on a 5 ft grid). */
  width?: number;
  scale?: { perCell: number; unit: string };
  /** A square's side in cells, or a polygon (x,y cells) the rooms and passages stay on. Unset: the least square `fill` allows. */
  footprint?: number | number[];
  /** Polygons (x,y cells, in the footprint's frame) no room or passage may take. */
  keepOut?: number[][];
  /** The share of the ground rooms cover: [least, most] (default [0.35, 0.55]). */
  fill?: [number, number];
  /** The share of ways run as passages rather than doors through shared walls (default 0.35). */
  passages?: number;
  /** Cells a way may walk beyond the straight line between its rooms' centres (default none). */
  detour?: number;
  seed?: number;
  /** Packings tried at each side (default 12); the one whose ways walk least is kept. */
  tries?: number;
  /** Cells of margin round the footprint in the file it writes (default 2). */
  margin?: number;
  /** Lattice cells a passage keeps off rooms' walls but at its doors: 0 (the default; a wall is drawn where they touch) or 1. */
  clearance?: number;
}

/** What the layout did: the side tried, the share the rooms cover, the ways drawn each way, and any it could not route. */
export interface GraphReport {
  side: number; fill: number; passages: number; walls: number; corridorCells: number;
  left: string[]; detours: { a: string; b: string; extra: number }[]; tries: number; energy: number;
}

// ---- rooms -----------------------------------------------------------------------------------------------------------

/** A room's outline in units from its box's centre: a round room its box's ellipse; an octagon cutting its corners so a square one is regular; a hexagon flat north and south; a poly its points (clockwise). */
function outlineOf(shape: GraphShape, w: number, h: number, points?: Pt[]): Pt[] {
  const a = w / 2, b = h / 2;
  if (shape === 'round') return Array.from({ length: CIRCLE }, (_, i) => [a * Math.cos((2 * Math.PI * i) / CIRCLE), b * Math.sin((2 * Math.PI * i) / CIRCLE)] as Pt);
  if (shape === 'octagon') { const c = Math.min(w, h) / (2 + Math.SQRT2); return [[-a + c, -b], [a - c, -b], [a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c]]; }
  if (shape === 'hexagon') return [[-a / 2, -b], [a / 2, -b], [a, 0], [a / 2, b], [-a / 2, b], [-a, 0]];
  if (shape === 'poly' && points?.length) {
    const area = points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
    return area > 0 ? points : points.slice().reverse();
  }
  return [[-a, -b], [a, -b], [a, b], [-a, b]];
}

const isSquare = (shape: GraphShape) => shape === 'rect' || shape === 'cave';
const footprintAt = (shape: GraphShape, x: number, y: number, w: number, h: number, pts?: Pt[]) =>
  new Footprint(x, y, w, h, outlineOf(shape, w, h, pts).map(([u, v]) => [x + w / 2 + u, y + h / 2 + v] as Pt), isSquare(shape));

/** A form's floor cells as numbers (`cellKey`), and as a list of [u, v] for walking them. */
interface Form { w: number; h: number; pts?: Pt[]; floor: Set<number>; cells: [number, number][]; holes: [number, number][] }
/** A lattice cell near a form's own corner as one number (forms are well under 512 cells a side). */
const cellKey = (u: number, v: number) => (u + 512) * 2048 + (v + 512);
interface PRoom { code: string; w: number; h: number; shape: GraphShape; points?: Pt[]; hall: boolean; turns: boolean }

/** Each way the room may lie, as drawn first; each differs. */
function forms(r: PRoom): Form[] {
  const out: Form[] = [], seen = new Set<string>();
  for (let k = 0; k < (r.turns ? 4 : 1); k++) for (const mirror of r.turns ? [false, true] : [false]) {
    let pts = r.points;
    if (pts) { pts = mirror ? pts.map(([x, y]) => [-x, y] as Pt) : pts; for (let n = 0; n < k; n++) pts = pts.map(([x, y]) => [-y, x] as Pt); }
    const [w, h] = k % 2 === 0 ? [r.w, r.h] : [r.h, r.w], id = `${w},${h},${pts ? pts.map(p => p.map(v => Math.round(v * 1e6)).join(':')).sort().join(';') : ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const f = footprintAt(r.shape, 0, 0, w, h, pts), [i0, j0, i1, j1] = f.span, holes: [number, number][] = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!f.touched.has(`${i},${j}`)) holes.push([i, j]);
    const cells = [...f.touched].map(k => k.split(',').map(Number) as [number, number]);
    out.push({ w, h, pts, floor: new Set(cells.map(([u, v]) => cellKey(u, v))), cells, holes });
  }
  return out;
}

/** A compass bearing as a unit vector east and south. */
const compass = (b: number): Pt => [Math.sin((b * Math.PI) / 180), -Math.cos((b * Math.PI) / 180)];
/** A stable share in 0..99 for a pair of codes (whether the way is a passage). */
const share = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return h % 100; };

// ---- the packer ------------------------------------------------------------------------------------------------------

class Packer {
  rooms: PRoom[]; side: number; ground: Set<string> | null; ix: Map<string, number>; round: boolean[]; lies: Form[][]; boxed: boolean[];
  o: number[]; w: number[]; h: number[]; pts: (Pt[] | undefined)[]; floor: Set<number>[]; fcells: [number, number][][];
  edges = new Map<string, Pt | null>(); passage = new Set<string>(); pins = new Map<number, [number, number, number, number]>();
  near: number[][]; trouble = new Map<string, 'door' | 'lane'>(); rand: () => number; x: number[]; y: number[];
  /** Per pair i * n + j (i < j): joined (1), a passage (2), the bearing to keep, and the repair it needs (1 door, 2 lane). */
  link: Uint8Array; keepDir: (Pt | null)[]; fix: Uint8Array; codeLen: number[];
  glue = new Map<number, [number, number, number]>(); free: number[]; carrying: Set<number>; turners: number[]; notched: number[];

  constructor(rooms: PRoom[], ways: [string, string, number | null][], side: number, seed: number, passages: number, pins: Map<string, [number, number, number, number]>, glue: Map<string, [string, number, number]>, ground: Set<string> | null) {
    this.rooms = rooms; this.side = side; this.ground = ground;
    this.ix = new Map(rooms.map((r, i) => [r.code, i]));
    this.round = rooms.map(r => r.shape === 'round');
    this.lies = rooms.map(forms);
    this.boxed = rooms.map(r => isSquare(r.shape));
    const n = rooms.length;
    this.o = new Array(n).fill(0); this.w = new Array(n).fill(0); this.h = new Array(n).fill(0); this.pts = new Array(n).fill(undefined); this.floor = new Array(n).fill(new Set()); this.fcells = new Array(n).fill([]);
    for (let i = 0; i < n; i++) this.lie(i, 0);
    for (const [a, b, br] of ways) {
      let i = this.ix.get(a)!, j = this.ix.get(b)!, v = br === null ? null : compass(br);
      if (i > j) { [i, j] = [j, i]; if (v) v = [-v[0], -v[1]]; }
      this.edges.set(`${i},${j}`, v);
    }
    for (const k of this.edges.keys()) { const [i, j] = k.split(',').map(Number); if (share(`${rooms[i].code}-${rooms[j].code}`) < passages * 100) this.passage.add(k); }
    this.link = new Uint8Array(n * n); this.keepDir = new Array(n * n).fill(null); this.fix = new Uint8Array(n * n); this.codeLen = rooms.map(r => r.code.length);
    for (const [k, v] of this.edges) { const [i, j] = k.split(',').map(Number); this.link[i * n + j] = this.passage.has(k) ? 2 : 1; this.keepDir[i * n + j] = v; }
    for (const [c, p] of pins) if (this.ix.has(c)) this.pins.set(this.ix.get(c)!, p);
    this.near = rooms.map((_, i) => rooms.map((__, j) => j).filter(j => this.edges.has(`${Math.min(i, j)},${Math.max(i, j)}`)));
    this.rand = rng(seed >>> 0 || 1);
    this.x = new Array(n).fill(0); this.y = new Array(n).fill(0);
    for (const [c, [a, dx, dy]] of glue) if (this.ix.has(c) && this.ix.has(a)) this.glue.set(this.ix.get(c)!, [this.ix.get(a)!, dx, dy]);
    this.free = rooms.map((_, i) => i).filter(i => !this.glue.has(i));
    this.carrying = new Set([...this.glue.values()].map(g => g[0]));
    this.turners = this.free.filter(i => this.lies[i].length > 1 && !this.carrying.has(i));
    this.notched = rooms.map((_, i) => i).filter(i => this.lies[i].some(f => f.holes.length));
  }
  randint(a: number, b: number) { return a + Math.floor(this.rand() * (b - a + 1)); }
  choice<T>(xs: T[]): T { return xs[Math.floor(this.rand() * xs.length)]; }

  lie(i: number, k: number) { this.o[i] = k; const f = this.lies[i][k]; this.w[i] = f.w; this.h[i] = f.h; this.pts[i] = f.pts; this.floor[i] = f.floor; this.fcells[i] = f.cells; }
  follow() { for (let n = 0; n < this.glue.size; n++) for (const [i, [j, dx, dy]] of this.glue) { this.x[i] = this.x[j] + dx; this.y[i] = this.y[j] + dy; } }
  snap(i: number, x: number, y: number): [number, number] {
    return [Math.round((x - this.w[i] / 2) / GRID) * GRID + this.w[i] / 2, Math.round((y - this.h[i] / 2) / GRID) * GRID + this.h[i] / 2];
  }
  box(i: number, x = this.x[i], y = this.y[i]): [number, number, number, number] { return [x - this.w[i] / 2, y - this.h[i] / 2, x + this.w[i] / 2, y + this.h[i] / 2]; }
  gaps(i: number, j: number, xi?: number, yi?: number): [number, number] { const a = this.box(i, xi, yi), b = this.box(j); return [Math.max(b[0] - a[2], a[0] - b[2]), Math.max(b[1] - a[3], a[1] - b[3])]; }
  face(i: number, j: number, xi?: number, yi?: number): [string, number] | null {
    const a = this.box(i, xi, yi), b = this.box(j), sx = Math.max(b[0] - a[2], a[0] - b[2]), sy = Math.max(b[1] - a[3], a[1] - b[3]);
    let best: [string, number] | null = null;
    if (sx >= 0 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) >= DOOR) best = ['x', sx];
    if (sy >= 0 && Math.min(a[2], b[2]) - Math.max(a[0], b[0]) >= DOOR && (!best || sy < best[1])) best = ['y', sy];
    return best;
  }
  offsets(i: number, j: number, xi?: number, yi?: number): [number, number] { const a = this.box(i, xi, yi), b = this.box(j); return [Math.round((b[0] - a[0]) / GRID), Math.round((b[1] - a[1]) / GRID)]; }
  shared(i: number, j: number, xi?: number, yi?: number): number {
    const [di, dj] = this.offsets(i, j, xi, yi), theirs = this.floor[j];
    let n = 0;
    for (const [u, v] of this.fcells[i]) if (theirs.has(cellKey(u - di, v - dj))) n++;
    return n;
  }
  contact(i: number, j: number, xi?: number, yi?: number): number {
    const [di, dj] = this.offsets(i, j, xi, yi), theirs = this.floor[j];
    let n = 0;
    for (const [u, v] of this.fcells[i]) { const k = cellKey(u - di, v - dj); if (theirs.has(k + 2048)) n++; if (theirs.has(k - 2048)) n++; if (theirs.has(k + 1)) n++; if (theirs.has(k - 1)) n++; }
    return n;
  }
  /** Mark the way between i and j as needing a door (1) or a lane (2) on the next anneal. */
  setFix(i: number, j: number, mode: 'door' | 'lane') { const n = this.w.length, k = Math.min(i, j) * n + Math.max(i, j); this.fix[k] = mode === 'door' ? 1 : 2; this.trouble.set(`${Math.min(i, j)},${Math.max(i, j)}`, mode); }
  pair(i: number, j: number, xi?: number, yi?: number): number {
    const X = xi ?? this.x[i], Y = yi ?? this.y[i], hw = this.w[i] / 2, hh = this.h[i] / 2, jw = this.w[j] / 2, jh = this.h[j] / 2;
    const sx = Math.max(this.x[j] - jw - (X + hw), X - hw - (this.x[j] + jw)), sy = Math.max(this.y[j] - jh - (Y + hh), Y - hh - (this.y[j] + jh));
    if (sx < 0 && sy < 0) {
      if (this.boxed[i] && this.boxed[j]) return OVER * (1 + Math.min(-sx, -sy) / GRID);
      const n = this.shared(i, j, xi, yi);
      if (n) return OVER * (1 + Math.sqrt(n));
    }
    const touching = sx <= 0 && sy <= 0 && !(this.boxed[i] && this.boxed[j]) ? this.contact(i, j, xi, yi) : 0;
    const lw = 5 * ((0.8 * (this.codeLen[i] + this.codeLen[j])) / 2 + 1);
    const lh = ((this.rooms[i].hall ? NAME_H : LABEL_H) + (this.rooms[j].hall ? NAME_H : LABEL_H)) / 2;
    const e = -CONTACT * touching + this.pairCost(i, j, sx, sy, xi, yi, touching);
    if (Math.abs(this.x[j] - X) < lw && Math.abs(this.y[j] - Y) < lh) return LABELS + e;
    return e;
  }
  pairCost(i: number, j: number, sx: number, sy: number, xi?: number, yi?: number, touching = 0): number {
    const n = this.w.length, k = Math.min(i, j) * n + Math.max(i, j), link = this.link[k];
    if (!link) return 0;
    const gap = Math.max(sx, sy, 0), f = this.face(i, j, xi, yi) ?? (touching ? ['set in', 0] : null);
    let e: number;
    if (link === 2) { e = gap < 2 * GRID ? CLOSE : 0; e += f && gap > 0 ? STRAIGHT : 0; e += Math.hypot(Math.max(sx, 0), Math.max(sy, 0)) / 60; }
    else e = f ? gap / 80 : CORNER + gap / 80 + Math.hypot(Math.max(sx, 0), Math.max(sy, 0)) / 60;
    if ((this.round[i] || this.round[j]) && gap < GRID) e += ROUND;
    if (gap > FAR) e += (3 * (gap - FAR)) / GRID;
    const want = this.keepDir[k];
    if (want) {
      const s = i < j ? 1 : -1, dx = (this.x[j] - (xi ?? this.x[i])) * s, dy = (this.y[j] - (yi ?? this.y[i])) * s;
      e += 1.2 * (1 - (dx * want[0] + dy * want[1]) / (Math.hypot(dx, dy) || 1));
    }
    const mode = this.fix[k];
    if ((mode === 1 && !(f && gap === 0)) || (mode === 2 && !(f && 2 * GRID <= gap && gap <= 4 * GRID))) e += REPAIR;
    return e;
  }
  inside(i: number, x?: number, y?: number): number {
    const a = this.box(i, x, y);
    let e = 0;
    if (this.ground) {
      const di = Math.round(a[0] / GRID), dj = Math.round(a[1] / GRID);
      for (const [u, v] of this.fcells[i]) if (!this.ground.has(`${u + di},${v + dj}`)) e += OVER;
    }
    for (const [lo, hi] of [[a[0], a[2]], [a[1], a[3]]]) { if (lo < 0) e += OVER * (-lo / GRID + 1); if (hi > this.side) e += OVER * ((hi - this.side) / GRID + 1); }
    return e;
  }
  pin(i: number, x?: number, y?: number): number {
    const p = this.pins.get(i);
    return p ? (PIN * Math.hypot((x ?? this.x[i]) - p[0], (y ?? this.y[i]) - p[1])) / GRID : 0;
  }
  over(): boolean { for (const [i, [tx, ty, w, h]] of this.pins) if (!(Math.abs(this.x[i] - tx) < (this.w[i] + w) / 2 && Math.abs(this.y[i] - ty) < (this.h[i] + h) / 2)) return false; return true; }
  local(i: number, x?: number, y?: number): number {
    const cx = (x ?? this.x[i]) - this.side / 2, cy = (y ?? this.y[i]) - this.side / 2;
    let e = this.inside(i, x, y) + this.pin(i, x, y) + (PULL * (cx * cx + cy * cy)) / GRID ** 2 * 100;
    for (let j = 0; j < this.w.length; j++) if (j !== i) e += this.pair(i, j, x, y);
    return e;
  }
  total(): number {
    const n = this.w.length;
    let e = 0;
    for (let i = 0; i < n; i++) e += this.inside(i) + this.pin(i) + (PULL * 100 * ((this.x[i] - this.side / 2) ** 2 + (this.y[i] - this.side / 2) ** 2)) / GRID ** 2;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e += this.pair(i, j);
    return e;
  }
  /** Rooms in order of the ways, each against the one before it. */
  place() {
    const n = this.w.length, order = [0];
    for (let k = 0; k < order.length; k++) for (const j of this.near[order[k]]) if (!order.includes(j)) order.push(j);
    for (let i = 0; i < n; i++) if (!order.includes(i)) order.push(i);
    [this.x[order[0]], this.y[order[0]]] = this.snap(order[0], this.side / 2, this.side / 2);
    for (let k = 1; k < order.length; k++) {
      const i = order[k], placed = order.slice(0, k), anchors = this.near[i].filter(j => placed.includes(j));
      [this.x[i], this.y[i]] = this.against(i, this.choice(anchors.length ? anchors : placed));
    }
    this.follow();
  }
  /** A spot for room i against room j, on a side and at an offset chosen at random. */
  against(i: number, j: number): [number, number] {
    const side = this.choice(['n', 'e', 's', 'w']), gap = this.choice([0, 0, GRID, 2 * GRID]), sign = side === 'n' || side === 'w' ? -1 : 1;
    const slide = (a: number, b: number) => Math.max(0, Math.floor((a + b) / 2) - DOOR);
    if (side === 'n' || side === 's') {
      const y = this.y[j] + sign * ((this.h[j] + this.h[i]) / 2 + gap), s = slide(this.w[j], this.w[i]);
      return this.snap(i, this.x[j] + this.randint(-s, s), y);
    }
    const x = this.x[j] + sign * ((this.w[j] + this.w[i]) / 2 + gap), s = slide(this.h[j], this.h[i]);
    return this.snap(i, x, this.y[j] + this.randint(-s, s));
  }
  anneal(steps = STEPS_N, t0 = 3, again = false): number {
    const n = this.w.length, t1 = 0.04, accept = (d: number, t: number) => d <= 0 || this.rand() < Math.exp(-d / t);
    if (!again) this.place();
    let cur = this.total(), best = cur, bestAt: [number[], number[], number[]] = [this.x.slice(), this.y.slice(), this.o.slice()];
    const keep = () => { if (cur < best - 1e-9) { best = cur; bestAt = [this.x.slice(), this.y.slice(), this.o.slice()]; } };
    for (let s = 0; s < steps; s++) {
      const t = t0 * (t1 / t0) ** (s / steps);
      if (this.turners.length && this.rand() < TURN_SHARE) {
        const i = this.choice(this.turners), old = [this.o[i], this.x[i], this.y[i]], before = this.local(i);
        this.lie(i, this.choice(this.lies[i].map((_, k) => k).filter(k => k !== old[0])));
        [this.x[i], this.y[i]] = this.snap(i, old[1], old[2]);
        const after = this.local(i);
        if (accept(after - before, t)) { cur += after - before; keep(); } else { this.lie(i, old[0]); this.x[i] = old[1]; this.y[i] = old[2]; }
        continue;
      }
      const i = this.glue.size ? this.choice(this.free) : Math.floor(this.rand() * n);
      let nx = 0, ny = 0, r: number;
      if (this.notched.length && this.rand() < NEST) {
        const j = this.choice(this.notched), holes = this.lies[j][this.o[j]].holes;
        if (j === i || this.carrying.has(i) || !holes.length) continue;
        const [hi, hj] = this.choice(holes), ci = Math.floor(this.rand() * Math.max(1, Math.round(this.w[i] / GRID))), cj = Math.floor(this.rand() * Math.max(1, Math.round(this.h[i] / GRID)));
        [nx, ny] = this.snap(i, this.x[j] - this.w[j] / 2 + (hi - ci) * GRID + this.w[i] / 2, this.y[j] - this.h[j] / 2 + (hj - cj) * GRID + this.h[i] / 2);
        r = 1;
      } else r = this.rand();
      if (r < 0.55) { const reach = Math.max(GRID, Math.floor(50 * (1 - s / steps))); [nx, ny] = this.snap(i, this.x[i] + this.randint(-reach, reach), this.y[i] + this.randint(-reach, reach)); }
      else if (r < 0.9 && this.near[i].length) [nx, ny] = this.against(i, this.choice(this.near[i]));
      else if (r < 1) {
        const j = Math.floor(this.rand() * n);
        if (j === i || (this.glue.size && (this.glue.has(i) || this.glue.has(j) || this.carrying.has(i) || this.carrying.has(j)))) continue;
        const before = this.local(i) + this.local(j) - this.pair(i, j), old = [this.x[i], this.y[i], this.x[j], this.y[j]];
        [this.x[i], this.y[i]] = this.snap(i, old[2], old[3]); [this.x[j], this.y[j]] = this.snap(j, old[0], old[1]);
        const after = this.local(i) + this.local(j) - this.pair(i, j);
        if (accept(after - before, t)) cur += after - before; else { this.x[i] = old[0]; this.y[i] = old[1]; this.x[j] = old[2]; this.y[j] = old[3]; }
        continue;
      }
      if (this.carrying.has(i)) {
        const old: [number[], number[]] = [this.x.slice(), this.y.slice()], before = this.total();
        this.x[i] = nx; this.y[i] = ny; this.follow();
        const after = this.total();
        if (accept(after - before, t)) cur += after - before; else { this.x = old[0]; this.y = old[1]; }
      } else {
        const before = this.local(i), after = this.local(i, nx, ny);
        if (accept(after - before, t)) { this.x[i] = nx; this.y[i] = ny; cur += after - before; }
      }
      keep();
    }
    this.x = bestAt[0].slice(); this.y = bestAt[1].slice();
    bestAt[2].forEach((k, i) => this.lie(i, k));
    return this.total();
  }
  /** Whether no two rooms overlap and every room lies in the square. */
  clear(): boolean {
    const n = this.w.length;
    for (let i = 0; i < n; i++) if (this.inside(i) !== 0) return false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!(Math.max(...this.gaps(i, j)) >= 0 || (!(this.boxed[i] && this.boxed[j]) && !this.shared(i, j)))) return false;
    return true;
  }
  rects(): Map<string, Footprint> {
    return new Map(this.rooms.map((r, i) => [r.code, footprintAt(r.shape, this.x[i] - this.w[i] / 2, this.y[i] - this.h[i] / 2, this.w[i], this.h[i], this.pts[i])]));
  }
}

/** Sides to try, from where the rooms cover the most of the square `fill` allows to where they cover the least. */
function squares(rooms: PRoom[], fill: [number, number]): number[] {
  const area = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const base = Math.max(Math.ceil(Math.sqrt(area / fill[1]) / GRID) * GRID, Math.max(...rooms.map(r => Math.max(r.w, r.h))) + 2 * GRID);
  const top = Math.max(base, Math.floor(Math.sqrt(area / fill[0]) / GRID) * GRID), out: number[] = [];
  for (let s = base; s <= top; s += GRID) out.push(s);
  return out;
}

interface Attempt { ok: boolean; score: [number, number] | null; energy: number; x: number[]; y: number[]; o: number[] }

/** One packing from one seed, re-annealed round the ways that found no passage or walk more than `detour` out of their way. */
function attempt(rooms: PRoom[], ways: [string, string, number | null][], side: number, seed: number, passages: number, pins: Map<string, [number, number, number, number]>, glue: Map<string, [string, number, number]>, walls: Map<string, number>, detour: number | null, ground: Set<string> | null, clearance: number): Attempt {
  const p = new Packer(rooms, ways, side, seed, passages, pins, glue, ground);
  p.anneal();
  const pairs = ways.map(([a, b]) => [a, b] as [string, string]);
  let best: Attempt | null = null;
  for (let n = 0; n < REPAIRS; n++) {
    const rects = p.rects(), { routes, left } = plan(rects, pairs, { walls, ground, seed: 1, clearance });
    const far = left.length ? [] : detours(routes, rects, detour);
    if (!left.length && p.clear() && p.over()) {
      const score: [number, number] = [far.length, routes.reduce((s, r) => s + r.length, 0)];
      if (!best || score[0] < best.score![0] || (score[0] === best.score![0] && score[1] < best.score![1])) best = { ok: true, score, energy: p.total(), x: p.x.slice(), y: p.y.slice(), o: p.o.slice() };
      if (!far.length) break;
    }
    for (const name of [...left, ...far.map(([r]) => `${r.a} to ${r.b}`)]) {
      const [a, b] = name.split(' to ').map(c => p.ix.get(c)!), k = `${Math.min(a, b)},${Math.max(a, b)}`;
      p.setFix(a, b, p.round[a] || p.round[b] || p.trouble.get(k) === 'door' ? 'lane' : 'door');
    }
    p.anneal(REPAIR_STEPS, 1, true);
  }
  return best ?? { ok: false, score: null, energy: p.total(), x: p.x, y: p.y, o: p.o };
}

const poly2 = (v: number[]): Pt[] => { const out: Pt[] = []; for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]); return out; };

/** What is wrong with a graph, as messages (empty when it can be laid out). */
export function validateGraph(g: Graph): string[] {
  const e: string[] = [], ids = new Set<string>();
  if (!g || !Array.isArray(g.rooms) || !g.rooms.length) return ['rooms: at least one room'];
  g.rooms.forEach((r, i) => {
    const at = `rooms[${i}]`;
    if (typeof r?.id !== 'string' || !/^[\w.-]+$/.test(r.id)) e.push(`${at}.id: letters, digits, ., - and _`);
    else if (ids.has(r.id)) e.push(`${at}.id: ${r.id} is used twice`); else ids.add(r.id);
    for (const k of ['w', 'h'] as const) if (!(typeof r?.[k] === 'number' && r[k] > 0)) e.push(`${at}.${k}: cells, above 0`);
    if (r?.shape !== undefined && !GRAPH_SHAPES.includes(r.shape)) e.push(`${at}.shape: ${GRAPH_SHAPES.join(', ')}`);
    if (r?.shape === 'poly' && !(Array.isArray(r.points) && r.points.length >= 6 && r.points.length % 2 === 0)) e.push(`${at}.points: at least 3 x,y pairs, cells from the box's centre`);
  });
  g.rooms.forEach((r, i) => { if (r.against && !ids.has(r.against.room)) e.push(`rooms[${i}].against.room: no room ${r.against.room}`); });
  (Array.isArray(g.ways) ? g.ways : (e.push('ways: an array'), [])).forEach((w, i) => {
    for (const k of ['a', 'b'] as const) if (!ids.has(w?.[k])) e.push(`ways[${i}].${k}: no room ${JSON.stringify(w?.[k])}`);
    if (w?.a === w?.b) e.push(`ways[${i}]: a way joins two rooms`);
    if (w?.doors !== undefined && !(Array.isArray(w.doors) && w.doors.length === 2 && w.doors.every(d => d === null || DOOR_KINDS.includes(d)))) e.push(`ways[${i}].doors: [kind|null, kind|null]`);
  });
  if (g.footprint !== undefined && !(typeof g.footprint === 'number' && g.footprint > 0) && !(Array.isArray(g.footprint) && g.footprint.length >= 6 && g.footprint.length % 2 === 0)) e.push('footprint: a square\'s side in cells, or a polygon of x,y cells');
  if (g.fill !== undefined && !(Array.isArray(g.fill) && g.fill.length === 2 && g.fill[0] > 0 && g.fill[0] <= g.fill[1] && g.fill[1] < 1)) e.push('fill: [least, most], shares of the ground (0..1)');
  if (g.passages !== undefined && !(g.passages >= 0 && g.passages <= 1)) e.push('passages: a share, 0..1');
  if (g.width !== undefined && !(g.width >= 1 && g.width <= 6)) e.push('width: cells, 1..6');
  if (g.clearance !== undefined && g.clearance !== 0 && g.clearance !== 1) e.push('clearance: 0 or 1');
  return e;
}

/**
 * Lay a graph out: the dungeon file (format 2) with the rooms placed, a connection for each way through a shared wall and a
 * corridor for each passage (its ends on the rooms' walls, its bends the lattice cells it takes), the footprint as `bounds`
 * and the keep-out polygons as rock `areas`. Throws when the graph is invalid or no packing fits every way.
 */
export function layoutGraph(g: Graph): { spec: DungeonSpec; report: GraphReport } {
  const errors = validateGraph(g);
  if (errors.length) throw new Error(`invalid graph:\n  ${errors.join('\n  ')}`);
  const cell = g.width ?? 2, f = LATTICE / cell, u = (v: number) => v * f, c = (v: number) => Math.round((v / f) * 1e6) / 1e6;
  const rooms: PRoom[] = g.rooms.map(r => ({ code: r.id, w: u(r.w), h: u(r.h), shape: r.shape ?? 'rect', points: r.points ? poly2(r.points).map(([x, y]) => [u(x), u(y)] as Pt) : undefined, hall: !!r.hall, turns: !!r.turns }));
  const ways: [string, string, number | null][] = [], seen = new Set<string>();
  for (const w of g.ways) { const k = [w.a, w.b].sort().join('|'); if (seen.has(k)) continue; seen.add(k); ways.push([w.a, w.b, w.bearing ?? null]); }
  const walls = new Map<string, number>();
  for (const w of g.ways) if (w.wall !== undefined) walls.set(`${w.a}|${w.b}`, w.wall);
  const glue = new Map<string, [string, number, number]>(g.rooms.filter(r => r.against).map(r => [r.id, [r.against!.room, u(r.against!.dx), u(r.against!.dy)]]));
  const pins = new Map<string, [number, number, number, number]>(g.rooms.filter(r => r.over).map(r => [r.id, [u(r.over!.x + r.over!.w / 2), u(r.over!.y + r.over!.h / 2), u(r.over!.w), u(r.over!.h)]]));
  const clearance = g.clearance ?? 0, fill = g.fill ?? [0.35, 0.55], passages = g.passages ?? 0.35, detour = g.detour === undefined ? null : u(g.detour), tries = g.tries ?? 12, seed = g.seed ?? 1;
  // the ground: a polygon footprint's cells (its frame from its box's corner), less the keep-out polygons
  const poly = Array.isArray(g.footprint) ? poly2(g.footprint).map(([x, y]) => [u(x), u(y)] as Pt) : null;
  const ox = poly ? Math.min(...poly.map(p => p[0])) : 0, oy = poly ? Math.min(...poly.map(p => p[1])) : 0;
  const shift = (p: Pt[]) => p.map(([x, y]) => [x - ox, y - oy] as Pt), shape = poly ? shift(poly) : null;
  const keep = (g.keepOut ?? []).map(k => shift(poly2(k).map(([x, y]) => [u(x), u(y)] as Pt)));
  const groundOf = (side: number): Set<string> | null => {
    if (!shape && !keep.length) return null;
    const cells = raster(shape ?? [[0, 0], [side, 0], [side, side], [0, side]], true);
    for (const k of keep) for (const x of raster(k)) cells.delete(x);
    return cells;
  };
  const sides = typeof g.footprint === 'number' ? [Math.ceil(u(g.footprint) / GRID) * GRID] : shape ? [Math.ceil(Math.max(...shape.flat()) / GRID) * GRID] : squares(rooms, fill);
  let chosen: { side: number; run: Attempt; ground: Set<string> | null } | null = null;
  for (const side of sides) {
    const ground = groundOf(side), runs: Attempt[] = [];
    for (let k = 0; k < tries; k++) { const r = attempt(rooms, ways, side, seed * 1000 + k, passages, pins, glue, walls, detour, ground, clearance); if (r.ok) runs.push(r); }
    if (runs.length) {
      const run = runs.reduce((a, b) => (b.score![0] < a.score![0] || (b.score![0] === a.score![0] && (b.score![1] < a.score![1] || (b.score![1] === a.score![1] && b.energy < a.energy))) ? b : a));
      chosen = { side, run, ground };
      break;
    }
  }
  if (!chosen) throw new Error(`no packing of ${rooms.length} rooms left room for every passage at a side of ${sides.map(c).join(', ')} cells; try another seed, a larger footprint or fewer passages`);
  const { side, run, ground } = chosen;
  const p = new Packer(rooms, ways, side, seed, passages, pins, glue, ground);
  p.x = run.x; p.y = run.y; run.o.forEach((k, i) => p.lie(i, k));
  const rects = p.rects(), { routes, left } = plan(rects, ways.map(([a, b]) => [a, b]), { walls, ground, seed: 1, clearance });

  // the file, in cells, with the footprint `margin` cells in from the sheet's edge
  const margin = g.margin ?? 2, X = (v: number) => c(v) + margin;
  const idOf = (code: string) => code.replace(/[^\w-]+/g, '-');
  const out: Room[] = g.rooms.map((gr, i) => {
    const r = rooms[i], shapeOf = { rect: 'rect', cave: 'cave', round: 'circle', octagon: 'octagon', hexagon: 'hexagon', poly: 'poly' } as const;
    const room: Room = { id: idOf(r.code), shape: shapeOf[r.shape], x: X(p.x[i] - p.w[i] / 2), y: X(p.y[i] - p.h[i] / 2), w: c(p.w[i]), h: c(p.h[i]), ...(gr.label !== undefined ? { label: gr.label } : { label: r.code }), origin: 'layout' };
    if (r.shape === 'octagon') room.cut = 1 / (2 + Math.SQRT2);
    if (r.shape === 'poly') room.points = outlineOf('poly', p.w[i], p.h[i], p.pts[i]).flatMap(([x, y]) => [X(p.x[i] + x), X(p.y[i] + y)]);
    return room;
  });
  const wayOf = (a: string, b: string) => g.ways.find(w => (w.a === a && w.b === b) || (w.a === b && w.b === a))!;
  const doorsOf = (r: Route): [DoorKind | null, DoorKind | null] => { const w = wayOf(r.a, r.b), d = w.doors ?? ['door', null]; return w.a === r.a ? d : [d[1], d[0]]; };
  const connections: Connection[] = [], corridors: Corridor[] = [];
  for (const r of routes) {
    const [da, db] = doorsOf(r);
    if (r.kind === 'wall') { connections.push({ a: idOf(r.a), b: idOf(r.b), at: [X(r.doorA[0]), X(r.doorA[1])], kind: da ?? db ?? 'open', origin: 'layout' }); continue; }
    const pts = routePoints(r);
    corridors.push({
      from: { room: idOf(r.a), port: [X(r.doorA[0]), X(r.doorA[1])] }, to: { room: idOf(r.b), port: [X(r.doorB[0]), X(r.doorB[1])] },
      via: pts.slice(1, -1).flatMap(([x, y]) => [X(x), X(y)]), width: cell, doors: [da, db], ...(wayOf(r.a, r.b).style === 'natural' && { style: 'natural' as const }), origin: 'layout',
    });
  }
  const frame = (shape ?? [[0, 0], [side, 0], [side, side], [0, side]]).flatMap(([x, y]) => [X(x), X(y)]);
  const spec = parseDungeon({
    ...newDungeon(g.id ?? 'layout', { seed, cols: Math.ceil(c(side)) + 2 * margin, rows: Math.ceil(c(side)) + 2 * margin, ...(g.title && { title: g.title }), ...(g.scale && { scale: g.scale }) }),
    numbers: false, rooms: out, corridors, connections,
    grid: { show: true, size: cell, sub: true, clip: 'floor' }, style: { hatch: 'full', band: 0.9, wall: 1.5, sharedWalls: true },
    bounds: frame, ...(keep.length && { areas: keep.map(k => ({ points: k.flatMap(([x, y]) => [X(x), X(y)]), kind: 'rock' as const, origin: 'layout' })) }),
    furniture: { place: 'outside' },
  });
  const area = rooms.reduce((s, r) => s + r.w * r.h, 0), groundArea = ground ? ground.size * GRID * GRID : side * side;
  return {
    spec,
    report: {
      side: c(side), fill: Math.round((area / groundArea) * 1000) / 1000, passages: routes.filter(r => r.kind === 'path').length, walls: routes.filter(r => r.kind === 'wall').length,
      corridorCells: routes.reduce((s, r) => s + r.cells.length, 0), left, detours: detours(routes, rects, detour).map(([r, x]) => ({ a: r.a, b: r.b, extra: c(x) })), tries, energy: run.energy,
    },
  };
}
