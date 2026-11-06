/**
 * Corridors routed on a lattice (R9 D6a): each way between two rooms is a door through the wall they share, or a passage
 * of free lattice cells from a cell against one room's wall to a cell against the other's, bending where it likes.
 * A passage never runs through a room, never touches an unrelated way's passage, and may join and part from a passage
 * that leaves the same room, but never runs beside it. Its door stands on the wall between the room and the passage's
 * first cell: square across it where that wall runs along the lattice, else where the lattice line from that cell into
 * the room crosses the wall (so a passage meets a round or slanted wall square on). A way that names its wall (a bearing from the room's centre) leaves within half a compass point
 * of it, or where the room has no door there, by the nearest it has.
 *
 * Units: one lattice cell is `LATTICE` units, the passage's width (a 10 ft passage on a 5 ft grid: 2 dungeon cells).
 * The engine's dungeons are converted to and from these units by the callers (`layout.ts`, `graph.ts`).
 * Ported from setting_builder's tools/route.py (version 3), which it retires.
 */
import { inPolygon } from './layout.ts';

export const LATTICE = 10;
/** What a bend costs, in cells of path. */
export const TURN = 0.5;
/** Cells a passage runs straight before each further cell costs RUN_COST. */
const RUN = 4, RUN_COST = 0.2;
/** Taken off a cell another way from the same room already uses. */
const SHARE = 0.4;
/** The most a cell's noise adds, so equal routes differ. */
const WANDER = 0.45;
/** Degrees: half a compass point, how far a door may stand from its stated wall. */
const HALF = 11.25;
/** Sides of the polygon a round room is drawn as. */
export const CIRCLE = 64;

export type Cell = [number, number];
export type Pt = [number, number];
type SideName = 'n' | 'e' | 's' | 'w';
export const STEPS: Record<SideName, Cell> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const TURNED: Record<SideName, SideName> = { n: 's', s: 'n', e: 'w', w: 'e' };
const key = (c: Cell) => `${c[0]},${c[1]}`;
const unkey = (k: string): Cell => k.split(',').map(Number) as Cell;

/** Degrees clockwise from north of a displacement east and south. */
export const bearing = (dx: number, dy: number): number => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
/** Degrees between two bearings. */
export const off = (a: number, b: number): number => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);

function edge(p: Pt, a: Pt, b: Pt): number {
  const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * (b[0] - a[0]), p[1] - a[1] - t * (b[1] - a[1]));
}

const flat = (pts: Pt[]): number[] => pts.flatMap(p => p);
const holds = (poly: Pt[], x: number, y: number) => inPolygon(flat(poly), x, y);

/** The part of an outline from which every point of it can be seen: empty where none can. */
export function kernel(poly: Pt[]): Pt[] {
  const area = poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  let out = poly.slice();
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const side = (p: Pt) => ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)) * (area > 0 ? 1 : -1);
    const kept: Pt[] = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j], q = out[(j + 1) % out.length], sp = side(p), sq = side(q);
      if (sp >= -1e-9) kept.push(p);
      if ((sp >= -1e-9) !== (sq >= -1e-9)) { const t = sp / (sp - sq); kept.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    out = kept;
    if (out.length < 3) return [];
  }
  return out;
}

/** The lattice cells an outline reaches into, or with `whole`, those it holds entirely. */
export function raster(poly: Pt[], whole = false): Set<string> {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), e = 1e-3 * LATTICE, out = new Set<string>();
  for (let i = Math.floor(Math.min(...xs) / LATTICE); i < Math.ceil(Math.max(...xs) / LATTICE); i++)
    for (let j = Math.floor(Math.min(...ys) / LATTICE); j < Math.ceil(Math.max(...ys) / LATTICE); j++) {
      const marks: Pt[] = whole
        ? [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([u, v]) => [u * LATTICE + (u === i ? e : -e), v * LATTICE + (v === j ? e : -e)])
        : Array.from({ length: 16 }, (_, n) => [(i + ((n % 4) + 0.5) / 4) * LATTICE, (j + (Math.floor(n / 4) + 0.5) / 4) * LATTICE]);
      if (whole ? marks.every(p => holds(poly, p[0], p[1])) : marks.some(p => holds(poly, p[0], p[1]))) out.add(`${i},${j}`);
    }
  return out;
}

/** Where a door of a room can stand: the free cell it opens on, the room's cell behind it, its side (none off the lattice), its point and bearing. */
export interface Slot { cell: Cell; inner: Cell; side: SideName | ''; point: Pt; bearing: number }

/** A room on the lattice: its box (units, top-left x, y) and outline, and whether its walls run along the lattice and its box is its floor. */
export class Footprint {
  readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly outline: Pt[]; readonly square: boolean; readonly anchor?: Pt;
  private _cells?: Set<string>; private _touched?: Set<string>; private _slots?: Slot[]; private _hub?: Pt | null;
  constructor(x: number, y: number, w: number, h: number, outline: Pt[], square: boolean, anchor?: Pt) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.outline = outline; this.square = square; this.anchor = anchor;
  }
  get centre(): Pt { return [this.x + this.w / 2, this.y + this.h / 2]; }
  holds(x: number, y: number): boolean {
    return this.square ? this.x < x && x < this.x + this.w && this.y < y && y < this.y + this.h : holds(this.outline, x, y);
  }
  /** First and last lattice column and row the box covers. */
  get span(): [number, number, number, number] {
    return [Math.floor(this.x / LATTICE + 1e-6), Math.floor(this.y / LATTICE + 1e-6), Math.ceil((this.x + this.w) / LATTICE - 1e-6) - 1, Math.ceil((this.y + this.h) / LATTICE - 1e-6) - 1];
  }
  /** The lattice cells of its floor: those whose centres it holds. */
  get cells(): Set<string> {
    if (!this._cells) {
      const [i0, j0, i1, j1] = this.span, out = new Set<string>();
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (this.square || this.holds((i + 0.5) * LATTICE, (j + 0.5) * LATTICE)) out.add(`${i},${j}`);
      this._cells = out;
    }
    return this._cells;
  }
  /** The lattice cells any of its floor reaches into, which no other room may. */
  get touched(): Set<string> {
    if (!this._touched) {
      if (this.square) this._touched = this.cells;
      else {
        const [i0, j0, i1, j1] = this.span, out = new Set(this.cells), marks = [0.125, 0.375, 0.625, 0.875];
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (marks.some(u => marks.some(v => this.holds((i + u) * LATTICE, (j + v) * LATTICE)))) out.add(`${i},${j}`);
        this._touched = out;
      }
    }
    return this._touched;
  }
  /** Whether a cell lies wholly on its floor. */
  full(c: Cell): boolean {
    if (!this.cells.has(key(c))) return false;
    if (this.square) return true;
    const e = 1e-3 * LATTICE;
    return [[0, 0], [1, 0], [0, 1], [1, 1]].every(([u, v]) => this.holds((c[0] + u) * LATTICE + (u ? -e : e), (c[1] + v) * LATTICE + (v ? -e : e)));
  }
  /** The point a way is drawn from to a door off the lattice: of the points that see every wall, the one clearest of the walls (to half a passage) and nearest the centre; null where none sees every wall. */
  get hub(): Pt | null {
    if (this._hub !== undefined) return this._hub;
    if (this.anchor) return (this._hub = this.anchor);
    if (this.square) return (this._hub = this.centre);
    const k = kernel(this.outline);
    if (!k.length) return (this._hub = null);
    const step = LATTICE / 4, c = this.centre, xs = k.map(p => p[0]), ys = k.map(p => p[1]), seen: Pt[] = [c];
    for (let i = 0; Math.min(...xs) + i * step <= Math.max(...xs) + 1e-9; i++) for (let j = 0; Math.min(...ys) + j * step <= Math.max(...ys) + 1e-9; j++) seen.push([Math.min(...xs) + i * step, Math.min(...ys) + j * step]);
    const ok = seen.filter(p => holds(k, p[0], p[1]) && this.holds(p[0], p[1]));
    if (!ok.length) return (this._hub = null);
    const clear = (p: Pt) => Math.min(LATTICE / 2, ...this.outline.map((a, i) => edge(p, a, this.outline[(i + 1) % this.outline.length])));
    let best = ok[0], bs = -Infinity;
    for (const p of ok) { const s = Math.round(clear(p) * 1e6) / 1e6 * 1e6 - Math.hypot(p[0] - c[0], p[1] - c[1]) * 1e-3; if (s > bs) { bs = s; best = p; } }
    return (this._hub = best);
  }
  /** Where the line from a point it holds to one it does not crosses its wall. */
  cross(inner: Pt, outer: Pt): Pt {
    let lo = 0, hi = 1;
    for (let k = 0; k < 30; k++) { const t = (lo + hi) / 2; if (this.holds(inner[0] + (outer[0] - inner[0]) * t, inner[1] + (outer[1] - inner[1]) * t)) lo = t; else hi = t; }
    return [inner[0] + (outer[0] - inner[0]) * lo, inner[1] + (outer[1] - inner[1]) * lo];
  }
  /** Every place a door of the room can stand, in a fixed order. */
  get slots(): Slot[] {
    if (this._slots) return this._slots;
    const out: Slot[] = [], seen = new Set<string>(), [cx, cy] = this.centre;
    for (const k of [...this.cells].sort()) {
      const [i, j] = unkey(k);
      for (const [s, [dx, dy]] of Object.entries(STEPS) as [SideName, Cell][]) {
        const f: Cell = [i + dx, j + dy];
        if (this.cells.has(key(f))) continue;
        const mid: Pt = [(i + 0.5 + dx / 2) * LATTICE, (j + 0.5 + dy / 2) * LATTICE];
        if (this.full([i, j]) && !this.holds(mid[0] + (dx * LATTICE) / 4, mid[1] + (dy * LATTICE) / 4)) {
          const p: Pt = this.square ? (s === 'n' ? [mid[0], this.y] : s === 's' ? [mid[0], this.y + this.h] : s === 'w' ? [this.x, mid[1]] : [this.x + this.w, mid[1]])
            : this.cross([(i + 0.5) * LATTICE, (j + 0.5) * LATTICE], [(f[0] + 0.5) * LATTICE, (f[1] + 0.5) * LATTICE]);
          out.push({ cell: f, inner: [i, j], side: s, point: p, bearing: bearing(p[0] - cx, p[1] - cy) });
        } else if (!seen.has(key(f))) {
          seen.add(key(f));
          // off the lattice the door stands where the passage's own line (the free cell's centre, square into the room) meets the wall,
          // so the passage arrives square on rather than slanting to the room's hub, and passages to cells side by side do not meet
          const p = this.cross([(i + 0.5) * LATTICE, (j + 0.5) * LATTICE], [(f[0] + 0.5) * LATTICE, (f[1] + 0.5) * LATTICE]);
          out.push({ cell: f, inner: [i, j], side: '', point: p, bearing: bearing(p[0] - cx, p[1] - cy) });
        }
      }
    }
    const rank = 'nswe';
    const order = (s: Slot): number[] => (s.side === 'n' || s.side === 's' ? [0, s.cell[0], rank.indexOf(s.side), s.cell[1]] : s.side ? [1, s.cell[1], rank.indexOf(s.side), s.cell[0]] : [2, s.bearing, 0, 0]);
    out.sort((a, b) => { const p = order(a), q = order(b); for (let n = 0; n < 4; n++) if (p[n] !== q[n]) return p[n] - q[n]; return 0; });
    return (this._slots = out);
  }
  /** The slots a way may leave by: all, those within half a compass point of the wall it names, or where none are, the nearest. */
  allowed(want?: number | null): Slot[] {
    if (want === undefined || want === null || !this.slots.length) return this.slots;
    const near = this.slots.filter(s => off(s.bearing, want) <= HALF + 1e-6);
    if (near.length) return near;
    const least = Math.min(...this.slots.map(s => off(s.bearing, want)));
    return this.slots.filter(s => off(s.bearing, want) <= least + 1e-6);
  }
}

/** A way as routed: a door through the wall the rooms share, or a passage of lattice cells from door to door. */
export interface Route {
  a: string; b: string; kind: 'wall' | 'path';
  sideA: SideName | ''; sideB: SideName | ''; doorA: Pt; doorB: Pt;
  cells: Cell[];
  /** Units from one room's centre to the other's, by the way. */
  length: number;
  bearingA: number; bearingB: number;
  /** The slots it leaves and enters by (paths). */
  slotA?: Slot; slotB?: Slot;
}

/** The way's corners from door to door. */
export function routePoints(r: Route): Pt[] {
  if (r.kind === 'wall') return [r.doorA, r.doorB];
  const pts: Pt[] = [r.doorA, ...r.cells.map(([i, j]) => [(i + 0.5) * LATTICE, (j + 0.5) * LATTICE] as Pt), r.doorB], keep = [pts[0]];
  for (let n = 1; n + 1 < pts.length; n++) {
    const [p, q, s] = [pts[n - 1], pts[n], pts[n + 1]];
    if (Math.abs((q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0])) > 1e-6) keep.push(q);
  }
  return [...keep, pts[pts.length - 1]];
}

/** Where two rect rooms touch along a wall a door fits: their sides, the door point mid-way along it, the stretch's ends. */
function boxWall(p: Footprint, q: Footprint): [SideName, SideName, Pt, number, number] | null {
  for (const [ap, aq, sp, sq] of [[p.x + p.w, q.x, 'e', 'w'], [q.x + q.w, p.x, 'w', 'e']] as const) {
    const lo = Math.max(p.y, q.y), hi = Math.min(p.y + p.h, q.y + q.h);
    if (Math.abs(ap - aq) < 1e-6 && hi - lo >= LATTICE) return [sp, sq, [ap, (lo + hi) / 2], lo, hi];
  }
  for (const [ap, aq, sp, sq] of [[p.y + p.h, q.y, 's', 'n'], [q.y + q.h, p.y, 'n', 's']] as const) {
    const lo = Math.max(p.x, q.x), hi = Math.min(p.x + p.w, q.x + q.w);
    if (Math.abs(ap - aq) < 1e-6 && hi - lo >= LATTICE) return [sp, sq, [(lo + hi) / 2, ap], lo, hi];
  }
  return null;
}

/** Where two rooms meet along a square wall a door fits: their sides and the door point, else null. Unnamed, the door stands mid-way along the longest stretch. */
export function sharedWall(p: Footprint, q: Footprint, wantP?: number | null, wantQ?: number | null): [SideName, SideName, Pt] | null {
  const boxed = p.square && q.square ? boxWall(p, q) : null, named = (wantP ?? null) !== null || (wantQ ?? null) !== null;
  if (p.square && q.square && (boxed === null || !named)) return boxed && [boxed[0], boxed[1], boxed[2]];
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  const theirs = new Set(q.allowed(wantQ).filter(s => s.side).map(s => `${key(s.inner)}|${s.side}|${r6(s.point[0])},${r6(s.point[1])}`));
  const meet = p.allowed(wantP).filter(s => s.side && theirs.has(`${key(s.cell)}|${TURNED[s.side as SideName]}|${r6(s.point[0])},${r6(s.point[1])}`)
    && (!boxed || (s.side === boxed[0] && boxed[3] + LATTICE / 2 - 1e-6 <= s.point[s.side === 'e' || s.side === 'w' ? 1 : 0] && s.point[s.side === 'e' || s.side === 'w' ? 1 : 0] <= boxed[4] - LATTICE / 2 + 1e-6)));
  if (!meet.length) return null;
  if (!named) {
    const sorted = meet.slice().sort((a, b) => (a.side < b.side ? -1 : a.side > b.side ? 1 : 0) || (a.side === 'n' || a.side === 's' ? a.point[1] - b.point[1] || a.point[0] - b.point[0] : a.point[0] - b.point[0] || a.point[1] - b.point[1]));
    const runs: Slot[][] = [];
    for (const s of sorted) {
      const last = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null;
      if (last && last.side === s.side && Math.hypot(last.point[0] - s.point[0], last.point[1] - s.point[1]) <= LATTICE + 1e-6 && (s.side === 'n' || s.side === 's' ? last.point[1] === s.point[1] : last.point[0] === s.point[0])) runs[runs.length - 1].push(s);
      else runs.push([s]);
    }
    const run = runs.reduce((a, b) => (b.length > a.length ? b : a));
    return [run[0].side as SideName, TURNED[run[0].side as SideName], [(run[0].point[0] + run[run.length - 1].point[0]) / 2, (run[0].point[1] + run[run.length - 1].point[1]) / 2]];
  }
  const qc = q.centre;
  const cost = (s: Slot) => (wantP != null ? off(s.bearing, wantP) : 0) + (wantQ != null ? off(bearing(s.point[0] - qc[0], s.point[1] - qc[1]), wantQ) : 0);
  const best = meet.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  return [best.side as SideName, TURNED[best.side as SideName], best.point];
}

export interface RouterOptions {
  seed?: number;
  /** Lattice cells kept round the rooms' boxes (where the plan may route). */
  margin?: number;
  /** The cells a passage may take, where the level bounds them. */
  ground?: Set<string> | null;
  /** Cells a passage keeps off every room's wall but at its own doors: 1 forbids running along a wall (no wall drawn there), 0 allows it. */
  clearance?: number;
  /** What a bend costs (default TURN). */
  bend?: number;
  /** Cells taken already (by corridors laid out another way), each with the rooms its corridor joins. */
  taken?: Map<string, string[]>;
}

/** Routes ways between the rooms one at a time, each seeing the passages before it. */
export class Router {
  readonly lo: Cell; readonly hi: Cell;
  readonly solid = new Map<string, string>();
  readonly against = new Map<string, Set<string>>();
  readonly used = new Map<string, Set<number>>();
  readonly doors = new Set<string>();
  readonly routes: Route[] = [];
  readonly ends: [string, string][] = [];
  private readonly seed: number; private readonly ground: Set<string> | null; private readonly clearance: number; private readonly bend: number;
  private readonly taken: Map<string, string[]>;

  readonly rooms: Map<string, Footprint>;
  constructor(rooms: Map<string, Footprint>, o: RouterOptions = {}) {
    this.rooms = rooms;
    this.seed = o.seed ?? 1; this.ground = o.ground ?? null; this.clearance = o.clearance ?? 1; this.bend = o.bend ?? TURN; this.taken = o.taken ?? new Map();
    const margin = o.margin ?? 2, spans = [...rooms.values()].map(r => r.span);
    this.lo = [Math.min(...spans.map(s => s[0])) - margin, Math.min(...spans.map(s => s[1])) - margin];
    this.hi = [Math.max(...spans.map(s => s[2])) + margin, Math.max(...spans.map(s => s[3])) + margin];
    for (const [code, r] of rooms) for (const c of r.cells) this.solid.set(c, code);
    for (const [c, code] of this.solid) {
      const [i, j] = unkey(c);
      for (const [dx, dy] of Object.values(STEPS)) { const n = `${i + dx},${j + dy}`; if (!this.solid.has(n)) { if (!this.against.has(n)) this.against.set(n, new Set()); this.against.get(n)!.add(code); } }
    }
    for (const [code, r] of rooms) for (const c of r.touched) if (!r.cells.has(c) && !this.solid.has(c)) { if (!this.against.has(c)) this.against.set(c, new Set()); this.against.get(c)!.add(code); }
  }

  /** A cell's noise, from the plan's own corner, so a shifted plan routes alike. */
  noise(c: Cell): number {
    const i = c[0] - this.lo[0], j = c[1] - this.lo[1];
    const h = ((Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(this.seed, 83492791)) >>> 0) % 1000;
    return (h / 1000) * WANDER;
  }
  inside(c: Cell): boolean { return this.lo[0] <= c[0] && c[0] <= this.hi[0] && this.lo[1] <= c[1] && c[1] <= this.hi[1]; }
  /** Whether routes i and j leave a room in common, so may run together. */
  related(i: number, j: number): boolean { return this.ends[i].some(x => this.ends[j].includes(x)); }
  doorway(room: string, want?: number | null): Slot[] {
    return this.rooms.get(room)!.allowed(want).filter(s => this.inside(s.cell) && !this.solid.has(key(s.cell)) && !this.doors.has(`${room}|${key(s.cell)}`));
  }
  free(c: Cell, me: number): boolean {
    const k = key(c);
    if (this.solid.has(k) || !this.inside(c) || (this.ground && !this.ground.has(k))) return false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = `${c[0] + dx},${c[1] + dy}`;
      for (const u of this.used.get(n) ?? []) if (!this.related(u, me)) return false;
      const t = this.taken.get(n);
      if (t && !t.some(x => this.ends[me].includes(x))) return false;
    }
    return true;
  }
  /** Whether a step from cell c (null at a door) to n runs beside another way's passage from the same room, rather than joining or leaving it. */
  beside(c: Cell | null, n: Cell, me: number): boolean {
    const at = (x: Cell) => this.used.get(key(x)) ?? new Set<number>();
    const touches = (cell: Cell, u: number, but: Cell | null) => Object.values(STEPS).some(([dx, dy]) => { const x: Cell = [cell[0] + dx, cell[1] + dy]; return !(but && x[0] === but[0] && x[1] === but[1]) && at(x).has(u); });
    const near = new Set<number>();
    for (const [dx, dy] of Object.values(STEPS)) for (const u of at([n[0] + dx, n[1] + dy])) near.add(u);
    for (const u of near) if (u !== me && !at(n).has(u) && touches(n, u, c) && (c === null || at(c).has(u) || touches(c, u, n))) return true;
    return false;
  }
  /** Whether a passage cell keeps clear of walls: with clearance, none but at a door of its own rooms. */
  private clearOf(n: Cell, ok: Set<string>): boolean {
    if (this.clearance <= 0) return true;
    const a = this.against.get(key(n));
    return !a || [...a].every(r => ok.has(r));
  }

  /** Routes a to b, leaving each by its named wall where it names one; null where no passage fits. */
  add(a: string, b: string, wantA?: number | null, wantB?: number | null): Route | null {
    const me = this.routes.length;
    this.ends.push([a, b]);
    const ra = this.rooms.get(a)!, rb = this.rooms.get(b)!, wall = sharedWall(ra, rb, wantA, wantB);
    if (wall) {
      const p = wall[2];
      const r: Route = { a, b, kind: 'wall', sideA: wall[0], sideB: wall[1], doorA: p, doorB: p, cells: [], length: 0, bearingA: bearing(p[0] - ra.centre[0], p[1] - ra.centre[1]), bearingB: bearing(p[0] - rb.centre[0], p[1] - rb.centre[1]) };
      r.length = this.measure(r);
      this.routes.push(r);
      return r;
    }
    const path = this.search(a, b, me, wantA, wantB);
    if (!path) { this.ends.pop(); return null; }
    const [cells, sa, sb] = path;
    const r: Route = { a, b, kind: 'path', sideA: sa.side, sideB: sb.side, doorA: sa.point, doorB: sb.point, cells, length: 0, bearingA: sa.bearing, bearingB: sb.bearing, slotA: sa, slotB: sb };
    r.length = this.measure(r);
    for (const c of cells) { const k = key(c); if (!this.used.has(k)) this.used.set(k, new Set()); this.used.get(k)!.add(me); }
    this.doors.add(`${a}|${key(cells[0])}`); this.doors.add(`${b}|${key(cells[cells.length - 1])}`);
    this.routes.push(r);
    return r;
  }

  measure(r: Route): number {
    const pts = [this.rooms.get(r.a)!.centre, ...routePoints(r), this.rooms.get(r.b)!.centre];
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return s;
  }

  search(a: string, b: string, me: number, wantA?: number | null, wantB?: number | null): [Cell[], Slot, Slot] | null {
    const goals = new Map<string, Slot>();
    for (const s of this.doorway(b, wantB)) if (!goals.has(key(s.cell))) goals.set(key(s.cell), s);
    const starts = this.doorway(a, wantA);
    if (!goals.size || !starts.length) return null;
    const rb = this.rooms.get(b)!, tx = rb.x / LATTICE + rb.w / LATTICE / 2, ty = rb.y / LATTICE + rb.h / LATTICE / 2;
    const h = (c: Cell) => Math.max(0, Math.abs(c[0] + 0.5 - tx) + Math.abs(c[1] + 0.5 - ty) - (rb.w + rb.h) / LATTICE / 2);
    const heap: [number, number, number, string][] = [], best = new Map<string, number>(), back = new Map<string, [string | null, Slot | null]>();
    let tie = 0;
    const push = (item: [number, number, number, string]) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i) { const p = (i - 1) >> 1; if (heap[p][0] < heap[i][0] || (heap[p][0] === heap[i][0] && heap[p][1] <= heap[i][1])) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          const less = (x: number, y: number) => heap[x][0] < heap[y][0] || (heap[x][0] === heap[y][0] && heap[x][1] < heap[y][1]);
          if (l < heap.length && less(l, m)) m = l;
          if (r < heap.length && less(r, m)) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    const st = (c: Cell, d: string, run: number) => `${c[0]},${c[1]},${d},${run}`;
    const ownAtGoal = new Set([a, b]);
    // without clearance a passage may run along a wall, but never into another room's floor off the lattice
    const intrudes = (n: Cell, ok: Set<string>) => [...(this.against.get(key(n)) ?? [])].some(r => !ok.has(r) && this.rooms.get(r)!.touched.has(key(n)));
    for (const slot of starts) {
      const c = slot.cell, atGoal = goals.has(key(c));
      if (!this.free(c, me) || this.beside(null, c, me)) continue;
      const ag = this.against.get(key(c));
      if (this.clearance > 0 ? ag && ![...ag].every(r => r === a || (atGoal && r === b)) : intrudes(c, atGoal ? ownAtGoal : new Set([a]))) continue;
      const s = st(c, '', 0), cost = 1 + this.noise(c);
      if (best.has(s) && best.get(s)! <= cost) continue;
      best.set(s, cost); back.set(s, [null, slot]);
      push([cost + h(c), tie++, cost, s]);
    }
    while (heap.length) {
      const [, , cost, s] = pop();
      if (cost > (best.get(s) ?? 1e9) + 1e-9) continue;
      const parts = s.split(','), c: Cell = [+parts[0], +parts[1]], d = parts[2] as SideName | '', run = +parts[3];
      if (goals.has(key(c))) {
        const cells: Cell[] = [];
        let entry: Slot | null = null;
        for (let x: string | null = s; x;) { const q = x.split(','); cells.push([+q[0], +q[1]]); const link: [string | null, Slot | null] = back.get(x)!; if (link[0] === null) entry = link[1]; x = link[0]; }
        return [cells.reverse(), entry!, goals.get(key(c))!];
      }
      for (const [nd, [dx, dy]] of Object.entries(STEPS) as [SideName, Cell][]) {
        const n: Cell = [c[0] + dx, c[1] + dy];
        if ((d && nd === TURNED[d as SideName]) || !this.free(n, me) || this.beside(c, n, me)) continue;
        const atGoal = goals.has(key(n));
        if (!this.clearOf(n, atGoal ? ownAtGoal : new Set<string>())) continue;
        if (this.clearance <= 0 && intrudes(n, atGoal ? ownAtGoal : new Set<string>())) continue;
        let step = 1 + this.noise(n);
        if (this.used.get(key(n))?.size) step -= SHARE;
        if (d && nd !== d) step += this.bend;
        const r = nd === d ? run + 1 : 1;
        if (r > RUN) step += RUN_COST;
        const ns = st(n, nd, Math.min(r, RUN + 1)), nc = cost + step;
        if (nc < (best.get(ns) ?? 1e9) - 1e-9) { best.set(ns, nc); back.set(ns, [s, null]); push([nc + h(n), tie++, nc, ns]); }
      }
    }
    return null;
  }
}

/** Each way that walks more than `limit` units beyond the straight line between its rooms' centres, with how far beyond. */
export function detours(routes: Route[], rooms: Map<string, Footprint>, limit: number | null | undefined): [Route, number][] {
  if (limit === null || limit === undefined) return [];
  return routes.map(r => { const a = rooms.get(r.a)!.centre, b = rooms.get(r.b)!.centre; return [r, r.length - Math.hypot(a[0] - b[0], a[1] - b[1])] as [Route, number]; }).filter(([, x]) => x > limit);
}

/** The ways routed shortest first, each end by the wall `walls` names for it (`a|b` → bearing at a): the routes, and the ways no passage fitted. */
export function plan(rooms: Map<string, Footprint>, ways: [string, string][], o: RouterOptions & { walls?: Map<string, number> } = {}): { routes: Route[]; left: string[] } {
  const walls = o.walls ?? new Map<string, number>(), num = (c: string) => { const m = c.match(/(\d+)\D*$/); return m ? +m[1] : 0; };
  const pairs = [...new Map(ways.map(w => { const p = [...w].sort((x, y) => num(x) - num(y) || (x < y ? -1 : 1)) as [string, string]; return [p.join('|'), p]; })).values()];
  const dist = (p: [string, string]) => Math.round(Math.hypot(rooms.get(p[0])!.x - rooms.get(p[1])!.x, rooms.get(p[0])!.y - rooms.get(p[1])!.y));
  pairs.sort((p, q) => dist(p) - dist(q) || (p.join('|') < q.join('|') ? -1 : 1));
  const router = new Router(rooms, o), left: string[] = [];
  for (const [a, b] of pairs) if (!router.add(a, b, walls.get(`${a}|${b}`), walls.get(`${b}|${a}`))) left.push(`${a} to ${b}`);
  return { routes: router.routes, left };
}
