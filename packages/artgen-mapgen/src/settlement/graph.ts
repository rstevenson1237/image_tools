/**
 * A settlement laid out to a graph (R8, `artgen settlement layout`): these buildings, at these sizes, lining these streets,
 * held at these distances and bearings from one another, inside a wall with these gates. Where `dungeon layout` packs
 * rooms close and routes a passage between two of them, a settlement's street is a line that runs past many buildings,
 * and the space between buildings is a target, not what packing leaves.
 *
 * The solver works on street lines. Each street is a chain of points, one for each building it runs past (in order) and
 * one at each end; a building on a street stands beside its point, on its side, its front to the street and a setback
 * from its edge, turned with it. Buildings on no street stand free. The annealer moves street points, free buildings and
 * gates; its energy weighs buildings closer than the least gap, buildings across a street, the gap to each building's
 * nearest neighbour against the target, the distance and bearing given between two buildings, how sharply a street
 * turns, streets that cross, a street's end on the street it joins, and each gate standing out at its bearing. The wall
 * is drawn last, round what stands inside it, and each gate set where its street meets the wall; a road leaves each gate
 * to the sheet's edge.
 *
 * Units: cells of `scale.perCell` (default 5 ft), x right and y down; bearings are degrees clockwise from north.
 */
import { rng } from 'artgen-primitives/lib/rng.ts';
import { segmentCross, type P } from '../dungeon/geom.ts';
import {
  AREA_KINDS, BUILDING_KINDS, BUILDING_SHAPES, GATE_KINDS, GROUNDS, ROAD_KINDS, ROAD_WIDTH_FT, SETTLEMENT_KINDS, WALL_KINDS, WALL_THICK_FT,
  newSettlement, parseSettlement,
  type AreaKind, type Building, type BuildingKind, type BuildingShape, type GateKind, type Ground, type Road, type RoadKind, type SettlementKind, type SettlementSpec,
  type SWall, type Towers, type WallKind,
} from './spec.ts';

// ---- the graph ---------------------------------------------------------------------------------------------------------

/** Building fields a graph passes through to the file as given (see `Building`). */
export const BUILDING_DRAW_KEYS = ['roof', 'stories', 'href', 'wing', 'number', 'points'] as const;
export type BuildingDraw = Partial<Pick<Building, (typeof BUILDING_DRAW_KEYS)[number]>>;

/** A building (or an open area: a market, square, yard…) of the graph: its size in cells, before it is turned. */
export interface GraphBuilding {
  id: string;
  /** Cells along its front (the side that faces a street), and back from it. */
  w: number; h: number;
  /** A building kind, or an area kind (`market`, `square`, `yard`, `garden`…) drawn as open ground (default `house`). */
  kind?: BuildingKind | AreaKind;
  shape?: BuildingShape;
  label?: string;
  /** May stand with its long side to the street (or, free, a quarter turn): the solver picks (default false). */
  turns?: boolean;
  /** Stands exactly here, its box's top-left corner (cells, in the graph's frame), turned by `angle`. Not moved. */
  at?: { x: number; y: number };
  /** With `at`: degrees clockwise. */
  angle?: number;
  /** Stands outside the wall (the wall is drawn round the rest). */
  outside?: boolean;
  /** Its own target gap to its nearest neighbour (cells), in place of the graph's `spacing.gap`. */
  gap?: number;
  /** Fields written into its entry of the file as given. */
  draw?: BuildingDraw;
}

/** Where a street begins or ends: at a gate, on another street (a junction), or at a building's front. */
export type StreetEnd = { gate: string } | { street: string } | { building: string };

/** A building a street runs past, and which side of it (left or right, walking from its start). */
export type StreetStop = string | { id: string; side?: 'left' | 'right' };

export interface GraphStreet {
  id?: string;
  kind?: RoadKind;
  /** Cells (default: the kind's width). */
  width?: number;
  /** The buildings it runs past, in order from its start. A building lines one street (the first that names it); a later street that names it runs past its front. */
  past: StreetStop[];
  from?: StreetEnd;
  to?: StreetEnd;
  label?: string;
}

export interface GraphGate {
  id: string;
  kind?: GateKind;
  /** Degrees clockwise from north: the side of the settlement it stands on. */
  bearing: number;
  label?: string;
  /** The road that leaves it for the sheet's edge (default a `highway`, unlabelled); false for none. */
  road?: { kind?: RoadKind; label?: string } | false;
}

/** A target between two buildings: their centres `distance` cells apart, b on `bearing` from a. */
export interface GraphTie {
  a: string; b: string;
  distance?: number;
  bearing?: number;
  /** Weigh it ten times as hard. */
  hold?: boolean;
}

export interface SettlementGraph {
  id?: string; title?: string;
  kind?: SettlementKind;
  ground?: Ground;
  scale?: { perCell: number; unit: string };
  buildings: GraphBuilding[];
  streets?: GraphStreet[];
  gates?: GraphGate[];
  ties?: GraphTie[];
  /** The wall round the buildings (not those `outside`): its kind, cells between it and the nearest building, towers, and its shape. Default: a `stone` wall when there are gates, none when not; false for none. */
  wall?: { kind?: WallKind; gap?: number; towers?: Towers; shape?: 'hull' | 'box' } | false;
  /** gap: the target between a building and its nearest neighbour (cells, default 2); least: closer than this is a fault (default 1); setback: from a street's edge to the buildings that line it (default 1). */
  spacing?: { gap?: number; least?: number; setback?: number };
  /** The most degrees a street turns at one building (default 25). */
  bend?: number;
  /** A square's side in cells, or a polygon (x,y cells, the graph's frame) everything stays on. */
  footprint?: number | number[];
  /** Cells of sheet round what is drawn (default 6). */
  margin?: number;
  seed?: number;
  /** Layouts tried from the seed on (default 4); the lowest energy is kept. */
  tries?: number;
  /** Annealing steps a try (default: by size). */
  steps?: number;
}

/** What the layout did: each building's place, the gaps, each tie against its target, each street, and what is left wrong. */
export interface SettlementGraphReport {
  seed: number; tries: number; energy: number;
  /** The energy by term (clear, spacing, street, bend, pass, ends, join, cross, ties, gates, footprint, pull): what the layout still pays for. */
  terms: Record<string, number>;
  /** Where the graph frame's 0,0 lies on the sheet (cells). */
  origin: [number, number];
  places: { id: string; x: number; y: number; cx: number; cy: number; angle: number; street?: string }[];
  /** Each building's gap to its nearest neighbour: the median, the least, and the target. */
  spacing: { median: number; least: number; target: number };
  ties: { a: string; b: string; distance?: number; want?: number; bearing?: number; wantBearing?: number; off: number }[];
  streets: { id: string; length: number; buildings: number; turn: number }[];
  /** Ties more than a quarter off their distance or 45° off their bearing; buildings closer than the least gap; buildings across a street. */
  faults: string[];
}

const DEFAULT_GAP = 2, DEFAULT_LEAST = 1, DEFAULT_SETBACK = 1, DEFAULT_BEND = 25, DEFAULT_MARGIN = 6, DEFAULT_WALL_GAP = 3;
const DEG = Math.PI / 180;
const r1 = (v: number) => Math.round(v * 10) / 10;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const AREA_SET = new Set<string>(AREA_KINDS);
const stopId = (s: StreetStop) => (typeof s === 'string' ? s : s.id);
const stopSide = (s: StreetStop) => (typeof s === 'string' ? undefined : s.side);

// ---- checking ----------------------------------------------------------------------------------------------------------

/** What is wrong with a graph, each with its path; empty when it can be laid out. */
export function validateSettlementGraph(g: SettlementGraph): string[] {
  const e: string[] = [];
  if (!g || typeof g !== 'object') return ['graph: an object'];
  if (g.kind !== undefined && !SETTLEMENT_KINDS.includes(g.kind)) e.push(`kind: one of ${SETTLEMENT_KINDS.join(', ')}`);
  if (g.ground !== undefined && !GROUNDS.includes(g.ground)) e.push(`ground: one of ${GROUNDS.join(', ')}`);
  if (!Array.isArray(g.buildings) || !g.buildings.length) { e.push('buildings: at least one'); return e; }
  const ids = new Set<string>();
  g.buildings.forEach((b, i) => {
    const at = `buildings[${i}]`;
    if (typeof b?.id !== 'string' || !/^[\w.-]+$/.test(b.id)) e.push(`${at}.id: letters, digits, ., - and _`);
    else if (ids.has(b.id)) e.push(`${at}.id: ${b.id} is used twice`); else ids.add(b.id);
    for (const k of ['w', 'h'] as const) if (!isNum(b?.[k]) || b[k] < 0.5) e.push(`${at}.${k}: cells, at least 0.5`);
    if (b?.kind !== undefined && !(BUILDING_KINDS as readonly string[]).includes(b.kind) && !AREA_SET.has(b.kind)) e.push(`${at}.kind: a building kind or an area kind`);
    if (b?.shape !== undefined && !BUILDING_SHAPES.includes(b.shape)) e.push(`${at}.shape: one of ${BUILDING_SHAPES.join(', ')}`);
    if (b?.at !== undefined && !(isNum(b.at.x) && isNum(b.at.y))) e.push(`${at}.at: {x, y} cells`);
    if (b?.gap !== undefined && !(isNum(b.gap) && b.gap >= 0)) e.push(`${at}.gap: cells, 0 or more`);
    if (b?.draw !== undefined) for (const k of Object.keys(b.draw)) if (!(BUILDING_DRAW_KEYS as readonly string[]).includes(k)) e.push(`${at}.draw.${k}: not a field the graph passes through (${BUILDING_DRAW_KEYS.join(', ')})`);
  });
  const gates = new Set<string>();
  (g.gates ?? []).forEach((gt, i) => {
    const at = `gates[${i}]`;
    if (typeof gt?.id !== 'string' || !gt.id) e.push(`${at}.id: text`); else if (gates.has(gt.id)) e.push(`${at}.id: ${gt.id} is used twice`); else gates.add(gt.id);
    if (!isNum(gt?.bearing)) e.push(`${at}.bearing: degrees clockwise from north`);
    if (gt?.kind !== undefined && !GATE_KINDS.includes(gt.kind)) e.push(`${at}.kind: one of ${GATE_KINDS.join(', ')}`);
    if (gt?.road && gt.road.kind !== undefined && !ROAD_KINDS.includes(gt.road.kind)) e.push(`${at}.road.kind: one of ${ROAD_KINDS.join(', ')}`);
  });
  if (g.wall === false && gates.size) e.push('wall: false, but there are gates (a gate stands in a wall)');
  if (g.wall && g.wall.kind !== undefined && !WALL_KINDS.includes(g.wall.kind)) e.push(`wall.kind: one of ${WALL_KINDS.join(', ')}`);
  const streets = new Map<string, number>(), streetIds = (g.streets ?? []).map((s, i) => s?.id ?? `s${i + 1}`);
  streetIds.forEach((id, i) => { if (streets.has(id)) e.push(`streets[${i}].id: ${id} is used twice`); streets.set(id, i); });
  const gateUsed = new Map<string, number>();
  (g.streets ?? []).forEach((s, i) => {
    const at = `streets[${i}]`;
    if (!Array.isArray(s?.past)) { e.push(`${at}.past: the buildings it runs past, in order`); return; }
    if (s.kind !== undefined && !ROAD_KINDS.includes(s.kind)) e.push(`${at}.kind: one of ${ROAD_KINDS.join(', ')}`);
    if (s.width !== undefined && !(isNum(s.width) && s.width > 0)) e.push(`${at}.width: cells, above 0`);
    const seen = new Set<string>();
    s.past.forEach((st, j) => {
      const id = stopId(st);
      if (!ids.has(id)) e.push(`${at}.past[${j}]: no building ${JSON.stringify(id)}`);
      if (seen.has(id)) e.push(`${at}.past[${j}]: ${id} is named twice`); seen.add(id);
      const side = stopSide(st);
      if (side !== undefined && side !== 'left' && side !== 'right') e.push(`${at}.past[${j}].side: left or right`);
    });
    for (const k of ['from', 'to'] as const) {
      const end = s[k];
      if (end === undefined) continue;
      if ('gate' in end) { if (!gates.has(end.gate)) e.push(`${at}.${k}.gate: no gate ${JSON.stringify(end.gate)}`); else if (gateUsed.has(end.gate)) e.push(`${at}.${k}.gate: ${end.gate} already ends streets[${gateUsed.get(end.gate)}]`); else gateUsed.set(end.gate, i); }
      else if ('street' in end) { if (!streets.has(end.street)) e.push(`${at}.${k}.street: no street ${JSON.stringify(end.street)}`); else if (streets.get(end.street) === i) e.push(`${at}.${k}.street: a street cannot end on itself`); }
      else if ('building' in end) { if (!ids.has(end.building)) e.push(`${at}.${k}.building: no building ${JSON.stringify(end.building)}`); }
      else e.push(`${at}.${k}: {gate}, {street} or {building}`);
    }
    if (!s.past.length && !(s.from && s.to)) e.push(`${at}: a street that runs past no building needs both ends`);
  });
  // a street ends on another only once that one is placed: no cycles of street ends
  const deps = (i: number) => [g.streets![i].from, g.streets![i].to].flatMap(end => (end && 'street' in end && streets.has(end.street) ? [streets.get(end.street)!] : []));
  const state = new Map<number, number>();
  const cyc = (i: number): boolean => { if (state.get(i) === 1) return true; if (state.get(i) === 2) return false; state.set(i, 1); const r = deps(i).some(cyc); state.set(i, 2); return r; };
  (g.streets ?? []).forEach((_, i) => { if (Array.isArray(g.streets![i]?.past) && cyc(i)) e.push(`streets[${i}]: its ends lead round to itself through other streets' ends`); });
  (g.ties ?? []).forEach((t, i) => {
    const at = `ties[${i}]`;
    for (const k of ['a', 'b'] as const) if (!ids.has(t?.[k])) e.push(`${at}.${k}: no building ${JSON.stringify(t?.[k])}`);
    if (t?.distance !== undefined && !(isNum(t.distance) && t.distance > 0)) e.push(`${at}.distance: cells, above 0`);
    if (t?.bearing !== undefined && !isNum(t.bearing)) e.push(`${at}.bearing: degrees clockwise from north`);
    if (t && t.distance === undefined && t.bearing === undefined) e.push(`${at}: a distance, a bearing or both`);
  });
  const sp = g.spacing ?? {};
  for (const k of ['gap', 'least', 'setback'] as const) if (sp[k] !== undefined && !(isNum(sp[k]) && sp[k]! >= 0)) e.push(`spacing.${k}: cells, 0 or more`);
  if (g.bend !== undefined && !(isNum(g.bend) && g.bend >= 0 && g.bend <= 90)) e.push('bend: degrees, 0 to 90');
  if (g.footprint !== undefined && !(isNum(g.footprint) && g.footprint > 0) && !(Array.isArray(g.footprint) && g.footprint.length >= 6 && g.footprint.length % 2 === 0 && g.footprint.every(isNum))) e.push('footprint: a side in cells, or a polygon x,y,…');
  return e;
}

// ---- geometry ----------------------------------------------------------------------------------------------------------

/** A building's oriented box: its centre, half-sizes, and the cos and sin of its angle. */
interface Box { cx: number; cy: number; hw: number; hh: number; c: number; s: number; r: number }
const boxOf = (cx: number, cy: number, w: number, h: number, angle: number): Box => {
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG);
  return { cx, cy, hw: w / 2, hh: h / 2, c, s, r: Math.hypot(w, h) / 2 };
};
const corners = (b: Box): P[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [b.cx + u * b.hw * b.c - v * b.hh * b.s, b.cy + u * b.hw * b.s + v * b.hh * b.c] as P);

/** The gap between two boxes along the axis that separates them most (negative: they overlap by that much). */
function boxGap(a: Box, b: Box): number {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  let best = -Infinity;
  for (const [ux, uy] of [[a.c, a.s], [-a.s, a.c], [b.c, b.s], [-b.s, b.c]]) {
    const ra = a.hw * Math.abs(a.c * ux + a.s * uy) + a.hh * Math.abs(-a.s * ux + a.c * uy);
    const rb = b.hw * Math.abs(b.c * ux + b.s * uy) + b.hh * Math.abs(-b.s * ux + b.c * uy);
    const g = Math.abs(dx * ux + dy * uy) - ra - rb;
    if (g > best) best = g;
  }
  return best;
}

/** The distance from a segment to a box (0 when the segment touches or crosses it). */
function segBoxDist(b: Box, p: P, q: P): number {
  // into the box's own frame
  const loc = (x: number, y: number): P => { const dx = x - b.cx, dy = y - b.cy; return [dx * b.c + dy * b.s, -dx * b.s + dy * b.c]; };
  const [ax, ay] = loc(p[0], p[1]), [bx, by] = loc(q[0], q[1]);
  // does the segment meet the box? (Liang–Barsky)
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const clip = (pp: number, qq: number) => { if (pp === 0) return qq >= 0; const t = qq / pp; if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  if (clip(-dx, ax + b.hw) && clip(dx, b.hw - ax) && clip(-dy, ay + b.hh) && clip(dy, b.hh - ay) && t0 <= t1) return 0;
  const ptBox = (x: number, y: number) => Math.hypot(Math.max(Math.abs(x) - b.hw, 0), Math.max(Math.abs(y) - b.hh, 0));
  const ptSeg = (x: number, y: number) => { const L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0; return Math.hypot(ax + dx * t - x, ay + dy * t - y); };
  return Math.min(ptBox(ax, ay), ptBox(bx, by), ptSeg(-b.hw, -b.hh), ptSeg(b.hw, -b.hh), ptSeg(b.hw, b.hh), ptSeg(-b.hw, b.hh));
}

const nearestOn = (pts: P[], x: number, y: number): { x: number; y: number; d: number } => {
  let best = { x: pts[0][0], y: pts[0][1], d: Infinity };
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0, px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { x: px, y: py, d };
  }
  return best;
};

/** The convex hull of points (clockwise in screen space). */
function hull(pts: P[]): P[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [], up: P[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Bearing (degrees clockwise from north) as a unit vector, y down. */
const dirOf = (bearing: number): P => [Math.sin(bearing * DEG), -Math.cos(bearing * DEG)];
const bearingOf = (dx: number, dy: number) => ((Math.atan2(dx, -dy) / DEG) + 360) % 360;
const angleDiff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

function inPoly(poly: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- the model -----------------------------------------------------------------------------------------------------------

interface MBuilding {
  g: GraphBuilding; i: number; area: boolean; gap: number;
  /** Placed by: a street (its index and the point), fixed, or free. */
  street?: number; node?: number;
  fixed: boolean;
  /** Free or fixed: centre and angle. */
  x: number; y: number; angle: number;
  /** On a street: +1 right, -1 left; whether the side may change. */
  side: number; sideFixed: boolean;
  /** Its long side to the street (front h, depth w) / a free building turned a quarter. */
  turned: boolean;
}
interface MStreet {
  id: string; i: number; s: GraphStreet; width: number;
  /** Points: [start, one per building it runs past, end]; x,y pairs. */
  pts: P[];
  /** For each building point: the building it runs past, and whether it lines it (owns) or only passes its front. */
  stops: { b: number; owns: boolean }[];
  gateFrom?: number; gateTo?: number;
  /** The building it starts at and the one it ends at (-1: none): its end segment there keeps no clearance from it. */
  endB: [number, number];
}
interface MGate { g: GraphGate; i: number; x: number; y: number; street?: number }

interface Model {
  bs: MBuilding[]; ss: MStreet[]; gates: MGate[]; ties: { a: number; b: number; t: GraphTie }[];
  least: number; setback: number; bend: number; wallGap: number; walled: boolean;
  footprint?: number[];
  order: number[];
}

/** The building's box as the model stands. */
function placeOf(m: Model, b: MBuilding): Box {
  const g = b.g;
  if (b.street === undefined) {
    const turned = b.turned ? 90 : 0;
    return boxOf(b.x, b.y, g.w, g.h, b.angle + turned);
  }
  const st = m.ss[b.street], j = b.node!, pts = st.pts;
  const prev = pts[j - 1], next = pts[j + 1], [px, py] = pts[j];
  let tx = next[0] - prev[0], ty = next[1] - prev[1];
  const L = Math.hypot(tx, ty) || 1;
  tx /= L; ty /= L;
  const nx = -ty, ny = tx;           // the right of the street, walking from its start (y down)
  const front = b.turned ? g.h : g.w, depth = b.turned ? g.w : g.h;
  const off = st.width / 2 + m.setback + depth / 2;
  const angle = Math.atan2(ty, tx) / DEG;
  return boxOf(px + b.side * nx * off, py + b.side * ny * off, front, depth, angle);
}

// ---- energy --------------------------------------------------------------------------------------------------------------

const W = { CLEAR: 60, STREET: 60, NEAR_IN: 4, NEAR_OUT: 1.5, TIE: 30, BEAR: 6, HOLD: 10, BEND: 0.03, SMOOTH: 0.0006, CROSS: 40, JOIN: 30, PASS: 20, GATE: 8, GATE_SIDE: 0.4, END: 0.3, FOOT: 60, PULL: 2e-5 };

interface Eval { total: number; boxes: Box[]; nearest: number[] }

function energy(m: Model, terms?: Record<string, number>): Eval {
  const boxes = m.bs.map(b => placeOf(m, b));
  let E = 0;
  const add = (k: string, v: number) => { if (terms) terms[k] = (terms[k] ?? 0) + v; return v; };
  const n = boxes.length, nearest = new Array<number>(n).fill(Infinity), bound = new Array<number>(n).fill(Infinity);
  // a bound on each one's nearest gap from the centres alone (the gap is at most the centres' distance less the inner half-sizes)
  const inner = boxes.map(b => Math.min(b.hw, b.hh)), dist: number[] = new Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.hypot(boxes[i].cx - boxes[j].cx, boxes[i].cy - boxes[j].cy), ub = d - inner[i] - inner[j];
    dist[i * n + j] = d;
    if (ub < bound[i]) bound[i] = ub;
    if (ub < bound[j]) bound[j] = ub;
  }
  // buildings against buildings: the least gap, and each one's nearest neighbour
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = boxes[i], b = boxes[j], d = dist[i * n + j];
    if (d - a.r - b.r > Math.max(bound[i], bound[j], m.least)) continue;
    const g = boxGap(a, b);
    if (g < nearest[i]) nearest[i] = g;
    if (g < nearest[j]) nearest[j] = g;
    if (g < m.least) { const v = m.least - g; E += add('clear', W.CLEAR * v * v); }
  }
  for (let i = 0; i < n; i++) {
    const b = m.bs[i];
    if (b.fixed || nearest[i] === Infinity) continue;
    const gap = b.gap, g = nearest[i], s = Math.max(gap, 1);
    if (g < gap && g >= m.least) E += add('spacing', W.NEAR_IN * ((gap - g) / s) ** 2);
    // a building held by a distance is placed by it; the others keep near their neighbours
    else if (g > gap && !m.ties.some(t => (t.a === i || t.b === i) && t.t.distance !== undefined)) { const v = (g - gap) / s; E += add('spacing', W.NEAR_OUT * (v < 3 ? v * v : 6 * v - 9)); }
  }
  // buildings against streets
  for (const st of m.ss) {
    const want = st.width / 2 + m.setback * 0.75;
    for (let i = 0; i < n; i++) {
      const bx = boxes[i], minWant = m.bs[i].area ? st.width / 2 : want;
      for (let k = 0; k + 1 < st.pts.length; k++) {
        if ((k === 0 && st.endB[0] === i) || (k === st.pts.length - 2 && st.endB[1] === i)) continue;
        const p = st.pts[k], q = st.pts[k + 1];
        // a cheap reject: the segment's box against the building's circle
        if (Math.min(p[0], q[0]) - bx.cx > bx.r + minWant || bx.cx - Math.max(p[0], q[0]) > bx.r + minWant || Math.min(p[1], q[1]) - bx.cy > bx.r + minWant || bx.cy - Math.max(p[1], q[1]) > bx.r + minWant) continue;
        const d = segBoxDist(bx, p, q);
        if (d < minWant) { const v = minWant - d; E += add('street', W.STREET * v * v); }
      }
    }
    // how sharply it turns
    for (let k = 1; k + 1 < st.pts.length; k++) {
      const [ax, ay] = st.pts[k - 1], [bx, by] = st.pts[k], [cx, cy] = st.pts[k + 1];
      const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx);
      let t = Math.abs(a2 - a1) / DEG; if (t > 180) t = 360 - t;
      E += add('bend', W.SMOOTH * t * t);
      if (t > m.bend) E += add('bend', W.BEND * (t - m.bend) ** 2);
    }
    // a building it only runs past: its point stands at the building's front
    st.stops.forEach((sp, k) => {
      if (sp.owns) return;
      const d = segBoxDist(boxes[sp.b], st.pts[k + 1], st.pts[k + 1]), v = d - (st.width / 2 + m.setback);
      E += add('pass', W.PASS * v * v);
    });
    // free ends keep short
    for (const k of [0, st.pts.length - 1]) {
      const end = k === 0 ? st.s.from : st.s.to;
      if (end) continue;
      const o = st.pts[k === 0 ? 1 : k - 1];
      E += add('ends', W.END * Math.hypot(st.pts[k][0] - o[0], st.pts[k][1] - o[1]));
    }
    // an end on a street or at a building
    for (const [k, end] of [[0, st.s.from], [st.pts.length - 1, st.s.to]] as const) {
      if (!end) continue;
      const [x, y] = st.pts[k];
      if ('street' in end) { const o = m.ss.find(s => s.id === end.street)!; const d = nearestOn(o.pts, x, y).d; E += add('join', W.JOIN * d * d); }
      else if ('building' in end) { const bi = m.bs.findIndex(b => b.g.id === end.building), d = segBoxDist(boxes[bi], [x, y], [x, y]), v = d - m.setback; E += add('pass', W.PASS * v * v); }
    }
  }
  // streets that cross (not at the end where one joins the other)
  for (const _ of streetCrossings(m)) E += add('cross', W.CROSS);
  // ties
  for (const { a, b, t } of m.ties) {
    const A = boxes[a], B = boxes[b], dx = B.cx - A.cx, dy = B.cy - A.cy, d = Math.hypot(dx, dy), w = t.hold ? W.HOLD : 1;
    if (t.distance !== undefined) E += add('ties', w * W.TIE * ((d - t.distance) / t.distance) ** 2);
    if (t.bearing !== undefined && d > 0.01) E += add('ties', w * W.BEAR * (1 - Math.cos((bearingOf(dx, dy) - t.bearing) * DEG)));
  }
  // gates: out past what stands inside, at their bearing
  if (m.gates.length) {
    const inside = m.bs.map((b, i) => (b.g.outside ? -1 : i)).filter(i => i >= 0);
    const cx = inside.reduce((s, i) => s + boxes[i].cx, 0) / Math.max(inside.length, 1), cy = inside.reduce((s, i) => s + boxes[i].cy, 0) / Math.max(inside.length, 1);
    for (const gt of m.gates) {
      const [ux, uy] = dirOf(gt.g.bearing);
      let far = -Infinity;
      for (const i of inside) for (const [x, y] of corners(boxes[i])) far = Math.max(far, (x - cx) * ux + (y - cy) * uy);
      const along = (gt.x - cx) * ux + (gt.y - cy) * uy, side = -(gt.x - cx) * uy + (gt.y - cy) * ux, want = far + m.wallGap;
      E += add('gates', W.GATE * (along - want) ** 2 + W.GATE_SIDE * side * side / Math.max(1, want));
    }
  }
  // the footprint
  if (m.footprint) for (const bx of boxes) for (const [x, y] of corners(bx)) if (!inPoly(m.footprint, x, y)) { const v = 1 + nearestOn(polyPts(m.footprint, true), x, y).d; E += add('footprint', W.FOOT * v * v); }
  // a faint pull to the middle, so nothing drifts
  for (const bx of boxes) E += add('pull', W.PULL * (bx.cx * bx.cx + bx.cy * bx.cy));
  return { total: E, boxes, nearest };
}
/** Each pair of segments where two streets cross, as the streets' indices (not where one ends on the other, at that end). */
function* streetCrossings(m: Model): Generator<[number, number]> {
  const joinEnd = (S: MStreet, T: MStreet, k: number) => (k === 0 && S.s.from && 'street' in S.s.from && S.s.from.street === T.id) || (k === S.pts.length - 2 && S.s.to && 'street' in S.s.to && S.s.to.street === T.id);
  for (let a = 0; a < m.ss.length; a++) for (let b = a + 1; b < m.ss.length; b++) {
    const A = m.ss[a], B = m.ss[b];
    for (let i = 0; i + 1 < A.pts.length; i++) for (let j = 0; j + 1 < B.pts.length; j++) {
      if (joinEnd(A, B, i) || joinEnd(B, A, j)) continue;
      if (segmentCross(A.pts[i], A.pts[i + 1], B.pts[j], B.pts[j + 1])) yield [a, b];
    }
  }
}
const polyPts = (p: number[], close = false): P[] => { const o: P[] = []; for (let i = 0; i + 1 < p.length; i += 2) o.push([p[i], p[i + 1]]); if (close && o.length) o.push(o[0]); return o; };

// ---- building the model --------------------------------------------------------------------------------------------------

function buildModel(g: SettlementGraph, rand: () => number): Model {
  const sp = g.spacing ?? {}, gap = sp.gap ?? DEFAULT_GAP, perCell = g.scale?.perCell ?? 5;
  const byId = new Map(g.buildings.map((b, i) => [b.id, i]));
  const bs: MBuilding[] = g.buildings.map((b, i) => {
    const fixed = !!b.at;
    return {
      g: b, i, area: AREA_SET.has(b.kind ?? 'house'), gap: b.gap ?? gap, fixed,
      x: fixed ? b.at!.x + b.w / 2 : 0, y: fixed ? b.at!.y + b.h / 2 : 0, angle: fixed ? b.angle ?? 0 : 0,
      side: 1, sideFixed: false, turned: false,
    };
  });
  const gates: MGate[] = (g.gates ?? []).map((gt, i) => ({ g: gt, i, x: 0, y: 0 }));
  const gateIdx = new Map(gates.map(x => [x.g.id, x.i]));
  const ss: MStreet[] = (g.streets ?? []).map((s, i) => {
    const width = s.width ?? ROAD_WIDTH_FT[s.kind ?? 'street'] / perCell;
    const stops = s.past.map(st => {
      const b = bs[byId.get(stopId(st))!];
      const owns = !b.fixed && b.street === undefined;
      if (owns) {
        b.street = i;
        const side = stopSide(st);
        if (side) { b.side = side === 'right' ? 1 : -1; b.sideFixed = true; }
      }
      return { b: b.i, owns };
    });
    const endAt = (e?: StreetEnd) => (e && 'building' in e ? byId.get(e.building)! : -1);
    const st: MStreet = { id: s.id ?? `s${i + 1}`, i, s, width, pts: [], stops, endB: [endAt(s.from), endAt(s.to)] };
    if (s.from && 'gate' in s.from) { st.gateFrom = gateIdx.get(s.from.gate); gates[st.gateFrom!].street = i; }
    if (s.to && 'gate' in s.to) { st.gateTo = gateIdx.get(s.to.gate); gates[st.gateTo!].street = i; }
    return st;
  });
  // sides: alternate along each street, unless given
  for (const st of ss) {
    let k = 0;
    for (const sp2 of st.stops) { const b = bs[sp2.b]; if (sp2.owns && b.street === st.i) { b.node = st.stops.indexOf(sp2) + 1; if (!b.sideFixed) b.side = k % 2 ? -1 : 1; k++; } }
  }
  const footprint = g.footprint === undefined ? undefined : typeof g.footprint === 'number' ? [0, 0, g.footprint, 0, g.footprint, g.footprint, 0, g.footprint] : g.footprint;
  const ties = (g.ties ?? []).map(t => ({ a: byId.get(t.a)!, b: byId.get(t.b)!, t }));
  const walled = g.wall !== false && (g.wall !== undefined || gates.length > 0);
  // streets in the order their ends need: one that ends on another after it
  const order: number[] = [], done = new Set<number>();
  const visit = (i: number) => {
    if (done.has(i)) return; done.add(i);
    for (const end of [ss[i].s.from, ss[i].s.to]) if (end && 'street' in end) visit(ss.findIndex(s => s.id === end.street));
    order.push(i);
  };
  ss.forEach((_, i) => visit(i));
  const m: Model = { bs, ss, gates, ties, least: sp.least ?? DEFAULT_LEAST, setback: sp.setback ?? DEFAULT_SETBACK, bend: g.bend ?? DEFAULT_BEND, wallGap: (g.wall ? g.wall.gap : undefined) ?? DEFAULT_WALL_GAP, walled, footprint, order };
  seedPlaces(m, gap, rand);
  return m;
}

/** A first place for everything: free buildings spread round the middle (or at their ties' targets), streets laid straight from their start. */
function seedPlaces(m: Model, gap: number, rand: () => number): void {
  const area = m.bs.reduce((s, b) => s + (b.g.w + b.gap) * (b.g.h + b.gap), 0);
  const tieFar = Math.max(0, ...m.ties.map(t => t.t.distance ?? 0));
  const R = Math.max(Math.sqrt(area / Math.PI) * 1.2, tieFar * 0.6, 6);
  const fixed = m.bs.filter(b => b.fixed);
  const [mx, my] = fixed.length ? [fixed.reduce((s, b) => s + b.x, 0) / fixed.length, fixed.reduce((s, b) => s + b.y, 0) / fixed.length] : [0, 0];
  // free buildings: at a tie's target from one already placed, else round the middle; those tied only to buildings on a
  // street wait until the streets are laid
  const placed = new Set(m.bs.filter(b => b.fixed).map(b => b.i));
  const free = m.bs.filter(b => !b.fixed && b.street === undefined);
  const onStreet = (i: number) => m.bs[i].street !== undefined;
  const centre = (i: number): P => { const b = m.bs[i]; if (b.street === undefined) return [b.x, b.y]; const bx = placeOf(m, b); return [bx.cx, bx.cy]; };
  const placeFree = (b: MBuilding, streetsLaid: boolean): boolean => {
    const t = m.ties.find(t => { const o = t.a === b.i ? t.b : t.b === b.i ? t.a : -1; return o >= 0 && (placed.has(o) || (streetsLaid && onStreet(o))); });
    if (!t) return false;
    const oi = t.a === b.i ? t.b : t.a, o = m.bs[oi], [ox, oy] = centre(oi), sign = t.a === b.i ? -1 : 1;
    const d = t.t.distance ?? (b.g.w + o.g.w) / 2 + gap * 2;
    const at = (bearing: number) => { const [ux, uy] = dirOf(bearing); b.x = ox + sign * ux * d; b.y = oy + sign * uy * d; };
    if (t.t.bearing !== undefined) at(t.t.bearing);
    else if (!streetsLaid) at(rand() * 360);
    else {
      // with the streets laid, the bearing round its partner that sits best (off the streets and the other buildings)
      const turn = rand() * 360;
      let best = Infinity, pick = turn;
      for (let k = 0; k < 12; k++) { at(turn + k * 30); const e = energy(m).total; if (e < best) { best = e; pick = turn + k * 30; } }
      at(pick);
    }
    if (b.g.turns && rand() < 0.5) b.turned = true;
    placed.add(b.i);
    return true;
  };
  const scatter = (b: MBuilding) => { const a = rand() * 2 * Math.PI, r = R * Math.sqrt(rand()) * 0.8; b.x = mx + Math.cos(a) * r; b.y = my + Math.sin(a) * r; if (b.g.turns && rand() < 0.5) b.turned = true; placed.add(b.i); };
  for (let pass = 0; pass < free.length; pass++) if (!free.some(b => !placed.has(b.i) && placeFree(b, false))) break;
  for (const b of free) if (!placed.has(b.i) && !m.ties.some(t => (t.a === b.i && onStreet(t.b)) || (t.b === b.i && onStreet(t.a)))) scatter(b);
  // gates: out at their bearing
  for (const gt of m.gates) { const [ux, uy] = dirOf(gt.g.bearing); gt.x = mx + ux * (R + m.wallGap); gt.y = my + uy * (R + m.wallGap); }
  // streets, in order
  for (const si of m.order) {
    const st = m.ss[si], s = st.s;
    let start: P, heading: number;
    const fronts = st.stops.map(sp => { const b = m.bs[sp.b]; return sp.owns ? (b.turned ? b.g.h : b.g.w) : 0; });
    const total = fronts.reduce((a, f) => a + f / 2 + gap, 0) + gap * 2;
    const toMiddle = (x: number, y: number) => Math.atan2(my - y, mx - x);
    if (st.gateFrom !== undefined) { const gt = m.gates[st.gateFrom]; start = [gt.x, gt.y]; heading = toMiddle(gt.x, gt.y); }
    else if (s.from && 'street' in s.from) {
      const o = m.ss.find(x => x.id === (s.from as { street: string }).street)!, k = 1 + Math.floor(rand() * Math.max(1, o.pts.length - 2));
      const a = o.pts[Math.min(k, o.pts.length - 1)], bb = o.pts[Math.max(0, k - 1)];
      start = [a[0], a[1]]; heading = Math.atan2(a[1] - bb[1], a[0] - bb[0]) + (rand() < 0.5 ? 1 : -1) * Math.PI / 2;
    } else if (s.from && 'building' in s.from) { const b = m.bs.find(x => x.g.id === (s.from as { building: string }).building)!; start = [b.x, b.y + b.g.h / 2 + m.setback]; heading = rand() * 2 * Math.PI; }
    else if (st.gateTo !== undefined) { const gt = m.gates[st.gateTo], [ux, uy] = dirOf(gt.g.bearing + 180); start = [gt.x + ux * total, gt.y + uy * total]; heading = Math.atan2(gt.y - start[1], gt.x - start[0]); }
    else { const a = rand() * 2 * Math.PI; start = [mx + Math.cos(a) * R * 0.7, my + Math.sin(a) * R * 0.7]; heading = toMiddle(start[0], start[1]); }
    // toward where the ties want its buildings, when they say
    const wants: P[] = [], wantOf = new Map<number, P[]>();
    for (const sp of st.stops) {
      if (!sp.owns) continue;
      for (const t of m.ties) {
        if (t.t.distance === undefined || t.t.bearing === undefined) continue;
        const other = t.a === sp.b ? t.b : t.b === sp.b ? t.a : -1;
        if (other < 0 || !(m.bs[other].fixed || (m.bs[other].street === undefined && placed.has(other)))) continue;
        const o = m.bs[other], [ux, uy] = dirOf(t.t.bearing), sign = t.a === sp.b ? -1 : 1;
        const w: P = [o.x + sign * ux * t.t.distance, o.y + sign * uy * t.t.distance];
        wants.push(w);
        wantOf.set(sp.b, [...(wantOf.get(sp.b) ?? []), w]);
      }
    }
    if (wants.length && st.gateFrom === undefined) {
      const wx = wants.reduce((a, p) => a + p[0], 0) / wants.length, wy = wants.reduce((a, p) => a + p[1], 0) / wants.length;
      if (Math.hypot(wx - start[0], wy - start[1]) > 1) heading = Math.atan2(wy - start[1], wx - start[0]);
    }
    const hx = Math.cos(heading), hy = Math.sin(heading);
    const pts: P[] = [start];
    let along = gap * 2;
    st.stops.forEach((sp, k) => {
      const f = fronts[k];
      along += k ? Math.max(f, fronts[k - 1]) / 2 + gap : f / 2;
      if (!sp.owns) { const b = m.bs[sp.b]; pts.push([b.x - hx * (b.g.h / 2 + st.width), b.y - hy * (b.g.h / 2 + st.width)]); return; }
      // a building whose ties say where it stands: its point there; the rest follow on from it
      const w = wantOf.get(sp.b);
      if (w) {
        const [wx, wy] = [w.reduce((a, p) => a + p[0], 0) / w.length, w.reduce((a, p) => a + p[1], 0) / w.length];
        along = Math.max(along, (wx - start[0]) * hx + (wy - start[1]) * hy);
        pts.push([wx, wy]);
        return;
      }
      pts.push([start[0] + hx * along, start[1] + hy * along]);
    });
    const last = pts[pts.length - 1];
    pts.push([last[0] + hx * (fronts[fronts.length - 1] ?? 0) / 2 + hx * gap * 2, last[1] + hy * (fronts[fronts.length - 1] ?? 0) / 2 + hy * gap * 2]);
    if (st.gateTo !== undefined) { const gt = m.gates[st.gateTo]; pts[pts.length - 1] = [gt.x, gt.y]; }
    st.pts = pts;
  }
  // the rest of the free buildings, now the streets are laid
  for (let pass = 0; pass < free.length; pass++) if (!free.some(b => !placed.has(b.i) && placeFree(b, true))) break;
  for (const b of free) if (!placed.has(b.i)) scatter(b);
}

// ---- annealing -----------------------------------------------------------------------------------------------------------

type Undo = () => void;

function anneal(m: Model, steps: number, rand: () => number): number {
  const movable: { kind: 'b' | 'p' | 'g' | 'side' | 'turn' | 'street' | 'spin' | 'jump' | 'smooth'; i: number; j?: number }[] = [];
  for (const b of m.bs) {
    if (b.fixed) continue;
    if (b.street === undefined) {
      movable.push({ kind: 'b', i: b.i }, { kind: 'b', i: b.i });
      // a building held by a distance may jump to another spot at that distance (past a street that walls it in)
      if (m.ties.some(t => (t.a === b.i || t.b === b.i) && t.t.distance !== undefined)) movable.push({ kind: 'jump', i: b.i });
    }
    else if (!b.sideFixed) movable.push({ kind: 'side', i: b.i });
    if (b.g.turns) movable.push({ kind: 'turn', i: b.i });
  }
  for (const st of m.ss) {
    st.pts.forEach((_, j) => { if ((j === 0 && st.gateFrom !== undefined) || (j === st.pts.length - 1 && st.gateTo !== undefined)) return; movable.push({ kind: 'p', i: st.i, j }, { kind: 'p', i: st.i, j }); });
    movable.push({ kind: 'street', i: st.i }, { kind: 'spin', i: st.i });
    // a point set back toward the line through its neighbours: takes a kink out of a street
    for (let j = 1; j + 1 < st.pts.length; j++) movable.push({ kind: 'smooth', i: st.i, j });
  }
  for (const gt of m.gates) movable.push({ kind: 'g', i: gt.i });
  if (!movable.length) return energy(m).total;
  const spanOf = () => {
    const xs = m.bs.map(b => placeOf(m, b)), lo = Math.min(...xs.map(b => b.cx - b.r)), hi = Math.max(...xs.map(b => b.cx + b.r)), lo2 = Math.min(...xs.map(b => b.cy - b.r)), hi2 = Math.max(...xs.map(b => b.cy + b.r));
    return Math.max(hi - lo, hi2 - lo2, 10);
  };
  const s0 = spanOf() / 5, s1 = 0.15, T0 = 6, T1 = 0.004;
  let E = energy(m).total, bestE = E;
  let best = snapshot(m);
  const gauss = () => { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
  for (let k = 0; k < steps; k++) {
    const f = k / steps, T = T0 * (T1 / T0) ** f, step = s0 * (s1 / s0) ** f;
    const mv = movable[Math.floor(rand() * movable.length)];
    let undo: Undo;
    if (mv.kind === 'jump') {
      const b = m.bs[mv.i], ox = b.x, oy = b.y, ties = m.ties.filter(t => (t.a === b.i || t.b === b.i) && t.t.distance !== undefined), t = ties[Math.floor(rand() * ties.length)];
      const oi = t.a === b.i ? t.b : t.a, o = placeOf(m, m.bs[oi]), sign = t.a === b.i ? -1 : 1;
      const [ux, uy] = dirOf(t.t.bearing !== undefined ? t.t.bearing + gauss() * 20 : rand() * 360);
      b.x = o.cx + sign * ux * t.t.distance!; b.y = o.cy + sign * uy * t.t.distance!;
      undo = () => { b.x = ox; b.y = oy; };
    } else if (mv.kind === 'smooth') {
      const pts = m.ss[mv.i].pts, p = pts[mv.j!], a = pts[mv.j! - 1], c = pts[mv.j! + 1], ox = p[0], oy = p[1], f = 0.3 + 0.7 * rand();
      p[0] += ((a[0] + c[0]) / 2 - p[0]) * f; p[1] += ((a[1] + c[1]) / 2 - p[1]) * f;
      undo = () => { p[0] = ox; p[1] = oy; };
    } else if (mv.kind === 'b') { const b = m.bs[mv.i], ox = b.x, oy = b.y; b.x += gauss() * step; b.y += gauss() * step; undo = () => { b.x = ox; b.y = oy; }; }
    else if (mv.kind === 'g') { const gt = m.gates[mv.i], ox = gt.x, oy = gt.y; gt.x += gauss() * step; gt.y += gauss() * step; const st = gt.street !== undefined ? m.ss[gt.street] : undefined; const set = () => { if (st) { if (st.gateFrom === gt.i) st.pts[0] = [gt.x, gt.y]; if (st.gateTo === gt.i) st.pts[st.pts.length - 1] = [gt.x, gt.y]; } }; set(); undo = () => { gt.x = ox; gt.y = oy; set(); }; }
    else if (mv.kind === 'p') { const p = m.ss[mv.i].pts[mv.j!], ox = p[0], oy = p[1]; p[0] += gauss() * step; p[1] += gauss() * step; undo = () => { p[0] = ox; p[1] = oy; }; }
    else if (mv.kind === 'side') { const b = m.bs[mv.i]; b.side = -b.side; undo = () => { b.side = -b.side; }; }
    else if (mv.kind === 'turn') { const b = m.bs[mv.i]; b.turned = !b.turned; undo = () => { b.turned = !b.turned; }; }
    else {
      const st = m.ss[mv.i], old = st.pts.map(p => [p[0], p[1]] as P);
      const keep = (j: number) => (j === 0 && st.gateFrom !== undefined) || (j === st.pts.length - 1 && st.gateTo !== undefined);
      if (mv.kind === 'street') { const dx = gauss() * step, dy = gauss() * step; st.pts.forEach((p, j) => { if (!keep(j)) { p[0] += dx; p[1] += dy; } }); }
      else {
        // about the end that is held (a gate, a street or a building it starts or ends at), else its middle
        const piv = st.pts[st.s.from ? 0 : st.s.to ? st.pts.length - 1 : Math.floor(st.pts.length / 2)], a = gauss() * 0.25 * (step / s0 + 0.1), c = Math.cos(a), s = Math.sin(a), [px, py] = [piv[0], piv[1]];
        st.pts.forEach((p, j) => { if (keep(j)) return; const dx = p[0] - px, dy = p[1] - py; p[0] = px + dx * c - dy * s; p[1] = py + dx * s + dy * c; });
      }
      undo = () => { st.pts.forEach((p, j) => { p[0] = old[j][0]; p[1] = old[j][1]; }); };
    }
    const E2 = energy(m).total;
    if (E2 <= E || rand() < Math.exp((E - E2) / T)) { E = E2; if (E < bestE) { bestE = E; best = snapshot(m); } }
    else undo();
  }
  restore(m, best);
  return bestE;
}

interface Snap { bs: [number, number, number, number, boolean][]; ss: P[][]; gs: P[] }
const snapshot = (m: Model): Snap => ({ bs: m.bs.map(b => [b.x, b.y, b.angle, b.side, b.turned]), ss: m.ss.map(s => s.pts.map(p => [p[0], p[1]] as P)), gs: m.gates.map(g => [g.x, g.y]) });
function restore(m: Model, s: Snap): void {
  m.bs.forEach((b, i) => { [b.x, b.y, b.angle, b.side, b.turned] = s.bs[i]; });
  m.ss.forEach((st, i) => { st.pts = s.ss[i].map(p => [p[0], p[1]] as P); });
  m.gates.forEach((g, i) => { [g.x, g.y] = s.gs[i]; });
}

// ---- the file ------------------------------------------------------------------------------------------------------------

/** Where a segment from inside to outside a closed polygon crosses it (the first crossing from `a`). */
function crossing(poly: P[], a: P, b: P): P | null {
  let best: P | null = null, bt = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], d = poly[(i + 1) % poly.length];
    const x = segmentCross(a, b, c, d);
    if (x) { const t = Math.hypot(x[0] - a[0], x[1] - a[1]); if (t < bt) { bt = t; best = x; } }
  }
  return best;
}

/** The ray from `p` along a unit vector to the sheet's edge. */
function toEdge(p: P, u: P, cols: number, rows: number): P {
  let t = Infinity;
  if (u[0] > 1e-9) t = Math.min(t, (cols - p[0]) / u[0]); if (u[0] < -1e-9) t = Math.min(t, -p[0] / u[0]);
  if (u[1] > 1e-9) t = Math.min(t, (rows - p[1]) / u[1]); if (u[1] < -1e-9) t = Math.min(t, -p[1] / u[1]);
  return Number.isFinite(t) ? [p[0] + u[0] * t, p[1] + u[1] * t] : p;
}

/** The wall's outline round what stands inside: the hull of the buildings' corners grown by the gap (or their box). */
function wallOutline(boxes: Box[], gap: number, shape: 'hull' | 'box'): P[] {
  const pts = boxes.flatMap(corners);
  if (shape === 'box') {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs) - gap, y0 = Math.min(...ys) - gap, x1 = Math.max(...xs) + gap, y1 = Math.max(...ys) + gap;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  const grown: P[] = [];
  for (const [x, y] of pts) for (let k = 0; k < 8; k++) grown.push([x + gap * Math.cos((k * Math.PI) / 4), y + gap * Math.sin((k * Math.PI) / 4)]);
  // drop points that barely bend the line
  const h = hull(grown), out: P[] = [];
  for (let i = 0; i < h.length; i++) {
    const a = out.length ? out[out.length - 1] : h[h.length - 1], b = h[i], c = h[(i + 1) % h.length];
    const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    const turn = Math.min(t, 2 * Math.PI - t);
    if (turn > 8 * DEG && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) out.push(b);
  }
  return out.length >= 3 ? out : h;
}

function writeFile(m: Model, g: SettlementGraph, energyTotal: number, seed: number, tries: number): { spec: SettlementSpec; report: SettlementGraphReport } {
  const terms: Record<string, number> = {}, { boxes, nearest } = energy(m, terms);
  const perCell = g.scale?.perCell ?? 5, unit = g.scale?.unit ?? 'ft';
  // street ends on other streets snap onto them
  for (const si of m.order) {
    const st = m.ss[si];
    for (const [k, end] of [[0, st.s.from], [st.pts.length - 1, st.s.to]] as const) {
      if (end && 'street' in end) { const o = m.ss.find(s => s.id === end.street)!, q = nearestOn(o.pts, st.pts[k][0], st.pts[k][1]); st.pts[k] = [q.x, q.y]; }
    }
  }
  // the wall, and each gate where its street meets it
  const inside = m.bs.filter(b => !b.g.outside).map(b => boxes[b.i]);
  const wallKind: WallKind = (g.wall && g.wall.kind) || 'stone';
  const thick = WALL_THICK_FT[wallKind] / perCell;
  const outline = m.walled && inside.length ? wallOutline(inside, m.wallGap + thick / 2, (g.wall && g.wall.shape) || 'hull') : null;
  const gatePts: P[] = m.gates.map(gt => {
    if (!outline) return [gt.x, gt.y];
    const st = gt.street !== undefined ? m.ss[gt.street] : undefined;
    if (st) {
      const atStart = st.gateFrom === gt.i, inner = atStart ? st.pts[1] : st.pts[st.pts.length - 2];
      const [ux, uy] = dirOf(gt.g.bearing), far: P = [inner[0] + (gt.x - inner[0]) * 4 + ux * 50, inner[1] + (gt.y - inner[1]) * 4 + uy * 50];
      const x = crossing(outline, inner, [gt.x, gt.y]) ?? crossing(outline, inner, far);
      if (x) { if (atStart) st.pts[0] = x; else st.pts[st.pts.length - 1] = x; return x; }
    }
    const cx = inside.reduce((s, b) => s + b.cx, 0) / inside.length, cy = inside.reduce((s, b) => s + b.cy, 0) / inside.length, [ux, uy] = dirOf(gt.g.bearing);
    return crossing(outline, [cx, cy], [cx + ux * 1e4, cy + uy * 1e4]) ?? [gt.x, gt.y];
  });
  // a street's free end stays inside the wall: cut where it leaves, a setback short of it
  if (outline) for (const st of m.ss) {
    for (const [k, end, inner] of [[0, st.s.from, 1], [st.pts.length - 1, st.s.to, st.pts.length - 2]] as const) {
      if (end) continue;
      const p = st.pts[k], q = st.pts[inner], x = crossing(outline, q, p);
      if (!x) continue;
      const d = Math.hypot(x[0] - q[0], x[1] - q[1]), back = Math.min(d, thick / 2 + m.setback + 0.5);
      st.pts[k] = d > 1e-6 ? [x[0] + (q[0] - x[0]) * back / d, x[1] + (q[1] - x[1]) * back / d] : q;
    }
  }
  // the sheet: everything drawn, a margin round it
  const margin = g.margin ?? DEFAULT_MARGIN;
  const all: P[] = [...boxes.flatMap(corners), ...m.ss.flatMap(s => s.pts), ...(outline ?? []), ...gatePts];
  const x0 = Math.min(...all.map(p => p[0])) - margin, y0 = Math.min(...all.map(p => p[1])) - margin;
  const x1 = Math.max(...all.map(p => p[0])) + margin, y1 = Math.max(...all.map(p => p[1])) + margin;
  const ox = Math.floor(x0), oy = Math.floor(y0), cols = Math.ceil(x1 - ox), rows = Math.ceil(y1 - oy);
  const sx = (x: number) => r1(x - ox), sy = (y: number) => r1(y - oy);
  const flat = (pts: P[]) => pts.flatMap(([x, y]) => [sx(x), sy(y)]);
  const kind = g.kind ?? 'village';
  const spec = newSettlement(g.id ?? 'settlement', kind, {
    seed, cols: Math.min(cols, 240), rows: Math.min(rows, 240), ...(g.title && { title: g.title }), ground: g.ground ?? 'grass',
    scale: { perCell, unit }, numbers: false,
  });
  spec.gen = { ...spec.gen, buildings: m.bs.filter(b => !b.area).length, wall: m.walled ? (wallKind === 'palisade' ? 'palisade' : 'stone') : 'none', water: 'none', market: m.bs.some(b => b.g.kind === 'market') };
  // streets
  spec.roads = m.ss.map((st): Road => {
    const turns = st.pts.some((_, k) => k > 0 && k + 1 < st.pts.length && angleDiff(bearingOf(st.pts[k][0] - st.pts[k - 1][0], st.pts[k][1] - st.pts[k - 1][1]), bearingOf(st.pts[k + 1][0] - st.pts[k][0], st.pts[k + 1][1] - st.pts[k][1])) > 4);
    return { id: st.id.replace(/[^\w-]+/g, '-'), kind: st.s.kind ?? 'street', points: flat(st.pts), ...(st.s.width !== undefined && { width: st.s.width }), ...(turns && { curve: 'smooth' as const }), ...(st.s.label && { label: st.s.label }), origin: 'graph' };
  });
  // roads out of the gates
  m.gates.forEach((gt, i) => {
    if (gt.g.road === false) return;
    const p: P = [gatePts[i][0] - ox, gatePts[i][1] - oy], u = dirOf(gt.g.bearing), e = toEdge(p, u, spec.cols, spec.rows);
    if (Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.5) return;
    spec.roads.push({ id: `${gt.g.id.replace(/[^\w-]+/g, '-')}-road`, kind: gt.g.road?.kind ?? 'highway', points: [r1(p[0]), r1(p[1]), r1(e[0]), r1(e[1])], ...(gt.g.road?.label && { label: gt.g.road.label }), origin: 'graph' });
  });
  // the wall
  if (outline) {
    const wall: SWall = { id: 'wall', kind: wallKind, points: flat(outline), closed: true, origin: 'graph', ...(g.wall && g.wall.towers && { towers: g.wall.towers }) };
    wall.gates = m.gates.map((gt, i) => ({ at: [sx(gatePts[i][0]), sy(gatePts[i][1])] as [number, number], kind: gt.g.kind ?? 'gate', ...(gt.g.label && { label: gt.g.label }) }));
    spec.walls = [wall];
  }
  // buildings and open areas
  const places: SettlementGraphReport['places'] = [];
  m.bs.forEach((b, i) => {
    const bx = boxes[i], w = bx.hw * 2, h = bx.hh * 2;
    let angle = Math.atan2(bx.s, bx.c) / DEG;
    // a turn of 180° draws the same box: keep the angle in (-90, 90]
    while (angle > 90) angle -= 180; while (angle <= -90) angle += 180;
    angle = r1(angle);
    const label = b.g.label ?? b.g.id;
    places.push({ id: b.g.id, x: r1(bx.cx - w / 2), y: r1(bx.cy - h / 2), cx: r1(bx.cx), cy: r1(bx.cy), angle, ...(b.street !== undefined && { street: m.ss[b.street].id }) });
    if (b.area) {
      spec.areas.push({ id: b.g.id.replace(/[^\w-]+/g, '-'), kind: b.g.kind as AreaKind, points: flat(corners(bx)), label, origin: 'graph' });
      return;
    }
    spec.buildings.push({
      id: b.g.id.replace(/[^\w-]+/g, '-'), kind: (b.g.kind as BuildingKind) ?? 'house', shape: b.g.shape ?? 'rect',
      x: sx(bx.cx - w / 2), y: sy(bx.cy - h / 2), w: r1(w), h: r1(h), ...(angle && { angle }), label, ...b.g.draw, origin: 'graph',
    });
  });
  for (const gt of m.gates) if (gt.g.label) { const i = gt.i; spec.overlay.labels.push({ text: gt.g.label, x: sx(gatePts[i][0]), y: sy(gatePts[i][1] - 2), kind: 'note', origin: 'graph' }); }
  // the report
  const gaps = m.bs.map((_, i) => nearest[i]).filter(Number.isFinite).sort((a, b) => a - b);
  const faults: string[] = [];
  const tiesOut = m.ties.map(({ a, b, t }) => {
    const A = boxes[a], B = boxes[b], dx = B.cx - A.cx, dy = B.cy - A.cy, d = Math.hypot(dx, dy), br = bearingOf(dx, dy);
    const offD = t.distance !== undefined ? Math.abs(d - t.distance) / t.distance : 0, offB = t.bearing !== undefined ? angleDiff(br, t.bearing) : 0;
    if (offD > 0.25) faults.push(`${t.a} to ${t.b} is ${r1(d)} cells apart, against ${t.distance}`);
    if (offB > 45) faults.push(`${t.b} lies at ${Math.round(br)}° from ${t.a}, against ${t.bearing}°`);
    return { a: t.a, b: t.b, ...(t.distance !== undefined && { distance: r1(d), want: t.distance }), ...(t.bearing !== undefined && { bearing: Math.round(br), wantBearing: t.bearing }), off: Math.round(Math.max(offD, offB / 180) * 100) / 100 };
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const gg = boxGap(boxes[i], boxes[j]);
    if (gg < m.least - 0.05) faults.push(`${m.bs[i].g.id} and ${m.bs[j].g.id} are ${r1(Math.max(gg, 0))} cells apart${gg < 0 ? ' (they overlap)' : ''}, against the least ${m.least}`);
  }
  for (const st of m.ss) for (let i = 0; i < boxes.length; i++) {
    if (m.bs[i].area) continue;
    for (let k = 0; k + 1 < st.pts.length; k++) if (!((k === 0 && st.endB[0] === i) || (k === st.pts.length - 2 && st.endB[1] === i)) && segBoxDist(boxes[i], st.pts[k], st.pts[k + 1]) < st.width / 2 - 0.05) { faults.push(`${m.bs[i].g.id} stands across street ${st.id}`); break; }
  }
  const crossed = new Map<string, number>();
  for (const [a, b] of streetCrossings(m)) { const k = `${m.ss[a].id} and ${m.ss[b].id}`; crossed.set(k, (crossed.get(k) ?? 0) + 1); }
  for (const [k, n] of crossed) faults.push(`streets ${k} cross${n > 1 ? ` ${n} times` : ''}`);
  for (const st of m.ss) for (let k = 1; k + 1 < st.pts.length; k++) {
    const t = angleDiff(bearingOf(st.pts[k][0] - st.pts[k - 1][0], st.pts[k][1] - st.pts[k - 1][1]), bearingOf(st.pts[k + 1][0] - st.pts[k][0], st.pts[k + 1][1] - st.pts[k][1]));
    if (t > m.bend + 10) faults.push(`street ${st.id} turns ${Math.round(t)}° at ${st.stops[k - 1] ? m.bs[st.stops[k - 1].b].g.id : 'its end'}, past its bend of ${m.bend}°`);
  }
  const streets = m.ss.map(st => {
    let len = 0, turn = 0;
    for (let k = 0; k + 1 < st.pts.length; k++) len += Math.hypot(st.pts[k + 1][0] - st.pts[k][0], st.pts[k + 1][1] - st.pts[k][1]);
    for (let k = 1; k + 1 < st.pts.length; k++) turn = Math.max(turn, angleDiff(bearingOf(st.pts[k][0] - st.pts[k - 1][0], st.pts[k][1] - st.pts[k - 1][1]), bearingOf(st.pts[k + 1][0] - st.pts[k][0], st.pts[k + 1][1] - st.pts[k][1])));
    return { id: st.id, length: r1(len), buildings: st.stops.length, turn: Math.round(turn) };
  });
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const report: SettlementGraphReport = {
    seed, tries, energy: Math.round(energyTotal * 100) / 100, terms: Object.fromEntries(Object.entries(terms).filter(([, v]) => v >= 0.01).map(([k, v]) => [k, Math.round(v * 100) / 100])), origin: [-ox, -oy], places,
    spacing: { median: r1(median), least: r1(gaps[0] ?? 0), target: g.spacing?.gap ?? DEFAULT_GAP }, ties: tiesOut, streets, faults,
  };
  if (cols > 240 || rows > 240) faults.push(`the sheet would be ${cols}×${rows} cells, over 240: it is cut to 240 (use larger cells: scale.perCell)`);
  return { spec: parseSettlement(spec), report };
}

/**
 * Lay a settlement out to a graph: `tries` layouts from the seed on, each annealed, the lowest energy kept and written as a
 * settlement file (origin `graph` on everything it wrote), with a report of what it did.
 */
export function layoutSettlementGraph(g: SettlementGraph): { spec: SettlementSpec; report: SettlementGraphReport } {
  const errors = validateSettlementGraph(g);
  if (errors.length) throw new Error(`invalid settlement graph:\n  ${errors.join('\n  ')}`);
  const seed = g.seed ?? 1, tries = Math.max(1, Math.floor(g.tries ?? 4));
  const n = g.buildings.length + (g.streets ?? []).reduce((s, x) => s + x.past.length + 2, 0) + (g.gates?.length ?? 0);
  const steps = g.steps ?? Math.min(60000, Math.max(8000, n * 300));
  let best: { m: Model; e: number } | null = null;
  for (let t = 0; t < tries; t++) {
    const rand = rng(seed * 7919 + t * 104729 + 13);
    const m = buildModel(g, rand), e = anneal(m, steps, rand);
    if (!best || e < best.e) best = { m, e };
  }
  return writeFile(best!.m, g, best!.e, seed, tries);
}
