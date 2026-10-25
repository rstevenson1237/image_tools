/**
 * Settlement generator: from the kind and the `gen` settings, a seeded layout written straight into the file. In order:
 * the water (or the terrain map's rivers, lakes and sea when there is an underlay), the roads (through roads to a
 * centre, lanes and alleys, or a grid), the town wall with gates where the roads cross it and towers along it, the
 * castle, the buildings along the roads (special ones at the best spots), gardens, fields and a graveyard, trees and
 * props, and with `gen.interiors` every building's floors. Everything it writes has `origin: "gen"`; entries without
 * one (drawn by hand) are kept, and are kept clear of.
 */
import { rng } from '../lib/rng.ts';
import { chaikin, isolines, simplifyLine } from '../lib/trace.ts';
import { inPolygon } from '../dungeon/layout.ts';
import { nearestOnLine, polygonArea, segmentCross } from '../dungeon/geom.ts';
import { offsetRing } from '../dungeon/walls.ts';
import { TERRAINS, type MapSpec } from '../map/spec.ts';
import type { MapField } from '../map/generate.ts';
import { generateInterior, storiesOf } from './interior.ts';
import { footprint, layoutSettlement, roadWidth, rotatePts, wallThickness } from './layout.ts';
import { parseSettlement, type Area, type Building, type BuildingKind, type BuildingShape, type Fixture, type Gate, type Road, type RoadKind, type SettlementSpec, type SWall, type Tree, type Water } from './spec.ts';

const ORIGIN = 'gen';
type P = [number, number];
const r2 = (v: number) => Math.round(v * 100) / 100;
const flat = (pts: P[]) => pts.flatMap(([x, y]) => [r2(x), r2(y)]);

/** The ground a settlement stands on: what the terrain map says at a sheet point, or open dry ground. */
export interface Ground { water(x: number, y: number): boolean; slope(x: number, y: number): number; forest(x: number, y: number): boolean }

/** The terrain map under the sheet (`underlay`), sampled in sheet cells. */
export function groundFromMap(spec: SettlementSpec, field: MapField): Ground {
  const u = spec.underlay!, T = (t: string) => TERRAINS.indexOf(t as never);
  const at = (x: number, y: number) => {
    const mx = u.origin[0] + x * u.scale, my = u.origin[1] + y * u.scale, i = Math.floor(mx * field.res), j = Math.floor(my * field.res);
    return i < 0 || j < 0 || i >= field.w || j >= field.h ? -1 : j * field.w + i;
  };
  const elev = (x: number, y: number) => { const n = at(x, y); return n < 0 ? 0 : field.elevation[n]; };
  return {
    water: (x, y) => { const n = at(x, y); return n >= 0 && (field.terrain[n] === T('water') || field.terrain[n] === T('deep')); },
    slope: (x, y) => { const d = 1; return Math.hypot(elev(x + d, y) - elev(x - d, y), elev(x, y + d) - elev(x, y - d)) / (2 * d * u.scale); },
    forest: (x, y) => { const n = at(x, y); return n >= 0 && field.terrain[n] === T('forest'); },
  };
}

const FLAT: Ground = { water: () => false, slope: () => 0, forest: () => false };

/** Building sizes in feet: [frontage min, max, depth min, max]. */
const SIZE_FT: Record<BuildingKind, [number, number, number, number]> = {
  house: [20, 30, 15, 22], cottage: [15, 22, 12, 16], shop: [18, 25, 22, 30], inn: [40, 50, 30, 40], tavern: [30, 35, 25, 30], smithy: [25, 30, 20, 25],
  temple: [35, 45, 55, 70], chapel: [20, 25, 30, 35], hall: [50, 60, 30, 35], barn: [40, 50, 25, 30], stable: [40, 50, 15, 20], mill: [25, 30, 25, 30],
  warehouse: [40, 50, 25, 30], keep: [40, 50, 40, 50], tower: [20, 25, 20, 25], gatehouse: [30, 30, 20, 20], barracks: [50, 60, 20, 25], manor: [50, 60, 35, 45], ruin: [20, 30, 15, 20],
};
const SHAPE_OF: Partial<Record<BuildingKind, BuildingShape>> = { temple: 'T', manor: 'L', inn: 'L' };

const INN_A = ['Prancing', 'Drowned', 'Golden', 'Sleeping', 'Crooked', 'Laughing', 'Silver', 'Black', 'Wandering', 'Red', 'Jolly', 'Rusty'];
const INN_B = ['Pony', 'Rat', 'Goose', 'Giant', 'Lantern', 'Boar', 'Kettle', 'Stag', 'Friar', 'Dragon', 'Anchor', 'Crown'];

/** Occupancy at half a cell: what is taken (roads, buildings, walls, water) so new things keep clear. */
class Grid {
  readonly res = 2; readonly w: number; readonly h: number; readonly used: Uint8Array;
  constructor(cols: number, rows: number) { this.w = cols * 2; this.h = rows * 2; this.used = new Uint8Array(this.w * this.h); }
  private idx(x: number, y: number) { const i = Math.floor(x * this.res), j = Math.floor(y * this.res); return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i; }
  taken(x: number, y: number) { const n = this.idx(x, y); return n < 0 || this.used[n] > 0; }
  mark(x: number, y: number, v = 1) { const n = this.idx(x, y); if (n >= 0) this.used[n] = Math.max(this.used[n], v); }
  /** Mark (or test) a polygon, grown by `pad` cells. */
  poly(p: number[], pad: number, test: boolean): boolean {
    const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1), s = 1 / this.res;
    for (let y = Math.min(...ys) - pad; y <= Math.max(...ys) + pad; y += s) for (let x = Math.min(...xs) - pad; x <= Math.max(...xs) + pad; x += s) {
      const inside = inPolygon(p, x, y) || (pad > 0 && nearestOnLine([...p, p[0], p[1]], x, y).d <= pad);
      if (!inside) continue;
      if (test) { if (this.taken(x, y)) return true; } else this.mark(x, y);
    }
    return false;
  }
  line(pts: number[], half: number) {
    const s = 1 / this.res;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = Math.min(pts[i], pts[i + 2]) - half, x1 = Math.max(pts[i], pts[i + 2]) + half, y0 = Math.min(pts[i + 1], pts[i + 3]) - half, y1 = Math.max(pts[i + 1], pts[i + 3]) + half;
      for (let y = y0; y <= y1; y += s) for (let x = x0; x <= x1; x += s) if (nearestOnLine(pts.slice(i, i + 4), x, y).d <= half) this.mark(x, y);
    }
  }
}

/** A road from a to b over the sheet, round water (crossing it only where it must) and up gentle slopes: A* on whole cells. */
function route(a: P, b: P, cols: number, rows: number, cost: (x: number, y: number) => number): P[] {
  const W = cols + 1, H = rows + 1, key = (x: number, y: number) => y * W + x, N = W * H;
  const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const ax = Math.max(0, Math.min(cols, Math.round(a[0]))), ay = Math.max(0, Math.min(rows, Math.round(a[1]))), bx = Math.max(0, Math.min(cols, Math.round(b[0]))), by = Math.max(0, Math.min(rows, Math.round(b[1])));
  const h = (x: number, y: number) => Math.hypot(x - bx, y - by);
  // a binary heap of [f, node]
  const heap: [number, number][] = [], push = (f: number, n: number) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[key(ax, ay)] = 0; push(h(ax, ay), key(ax, ay));
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [, n] = pop();
    if (done[n]) continue;
    done[n] = 1;
    const x = n % W, y = (n - x) / W;
    if (x === bx && y === by) break;
    for (const [dx, dy] of steps) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const m = key(nx, ny), c = g[n] + Math.hypot(dx, dy) * cost(nx, ny);
      if (c < g[m]) { g[m] = c; from[m] = n; push(c + h(nx, ny), m); }
    }
  }
  const out: P[] = [];
  for (let n = key(bx, by); n >= 0; n = from[n]) out.push([n % W, Math.floor(n / W)]);
  out.reverse();
  return out.length ? out : [a, b];
}

/** A routed line made calm: corners cut and straight runs kept to their ends. */
const calm = (pts: P[]): number[] => simplifyLine(chaikin({ pts: pts.flat(), closed: false }, 2), 0.35).pts.map(r2);

/** A point on the sheet's edge at an angle from the centre. */
function edgePoint(c: P, angle: number, cols: number, rows: number): P {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const t = Math.min(dx > 0 ? (cols - c[0]) / dx : dx < 0 ? -c[0] / dx : Infinity, dy > 0 ? (rows - c[1]) / dy : dy < 0 ? -c[1] / dy : Infinity);
  return [c[0] + dx * t, c[1] + dy * t];
}

/** A wobbly ring of `n` points round a centre (a lake, a town wall). */
function blob(c: P, rx: number, ry: number, n: number, wobble: number, rand: () => number): P[] {
  const out: P[] = [], a0 = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2, f = 1 + (rand() - 0.5) * wobble; out.push([c[0] + Math.cos(a) * rx * f, c[1] + Math.sin(a) * ry * f]); }
  return out;
}

/** Water from the map under the sheet: its rivers as lines, its lakes and sea as areas. */
function mapWater(spec: SettlementSpec, field: MapField): Water[] {
  const u = spec.underlay!, out: Water[] = [], toSheet = (mx: number, my: number): P => [(mx - u.origin[0]) / u.scale, (my - u.origin[1]) / u.scale];
  for (const r of field.rivers) {
    const pts: P[] = [];
    for (let i = 0; i < r.pts.length; i += 2) pts.push(toSheet(r.pts[i], r.pts[i + 1]));
    const inside = pts.map(([x, y]) => x > -2 && y > -2 && x < spec.cols + 2 && y < spec.rows + 2);
    // the stretch over the sheet, one point past each edge
    const first = inside.indexOf(true), last = inside.lastIndexOf(true);
    if (first < 0) continue;
    const run = pts.slice(Math.max(0, first - 1), last + 2), width = r.widths.reduce((s, v) => s + v, 0) / r.widths.length / u.scale;
    if (run.length >= 2) out.push({ kind: width > 3 ? 'river' : 'stream', points: flat(simplifyLine({ pts: run.flat(), closed: false }, 0.3).pts.reduce<P[]>((a, v, i, s) => (i % 2 ? a : [...a, [v, s[i + 1]]]), [])), width: r2(Math.max(0.6, width)), origin: ORIGIN });
  }
  // open water: trace the water mask over the sheet (one sample a cell, a dry border so every shore closes)
  const W = spec.cols + 3, H = spec.rows + 3, f = new Float32Array(W * H), g = groundFromMap(spec, field);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) f[j * W + i] = g.water(i - 1, j - 1) ? 1 : 0;
  for (const l of isolines(f, W, H, 0.5)) {
    if (!l.closed || l.pts.length < 8) continue;
    const pts = simplifyLine(l, 0.4).pts.map((v, i) => r2(Math.max(-1, Math.min(i % 2 ? spec.rows + 1 : spec.cols + 1, v - 0.5))));
    const area = polygonArea(pts);
    if (area < 4) continue;
    const touches = pts.some((v, i) => v <= -0.5 || v >= (i % 2 ? spec.rows : spec.cols) + 0.5);
    out.push({ kind: touches && area > spec.cols * spec.rows * 0.08 ? 'sea' : area > 60 ? 'lake' : 'pond', points: pts, origin: ORIGIN });
  }
  return out;
}

/** Woods from the map's forest under the sheet. */
function mapWoods(spec: SettlementSpec, ground: Ground): Area[] {
  const W = spec.cols + 3, H = spec.rows + 3, f = new Float32Array(W * H), out: Area[] = [];
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) f[j * W + i] = ground.forest(i - 1, j - 1) ? 1 : 0;
  for (const l of isolines(f, W, H, 0.5)) {
    if (!l.closed) continue;
    const pts = simplifyLine(l, 0.5).pts.map((v, i) => r2(Math.max(0, Math.min(i % 2 ? spec.rows : spec.cols, v - 0.5))));
    if (pts.length >= 6 && polygonArea(pts) > 12) out.push({ kind: 'wood', points: pts, origin: ORIGIN });
  }
  return out;
}

/** Where a polyline crosses a ring: the points and the crossing segment's index on the line. */
function crossings(line: number[], ringPts: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i + 3 < line.length; i += 2) for (let j = 0; j < ringPts.length; j++) {
    const c = segmentCross([line[i], line[i + 1]], [line[i + 2], line[i + 3]], ringPts[j], ringPts[(j + 1) % ringPts.length]);
    if (c) out.push(c);
  }
  return out;
}

/** The settlement laid out afresh from its seed and settings (entries drawn by hand are kept). */
export function generateSettlement(spec: SettlementSpec, ctx: { map?: MapSpec; field?: MapField } = {}): SettlementSpec {
  const s = structuredClone(spec), g = s.gen, rand = rng(s.seed * 7919 + 29), cols = s.cols, rows = s.rows, per = s.scale.perCell, ft = (v: number) => v / per;
  const hand = <T extends { origin?: string }>(xs: T[]) => xs.filter(x => x.origin !== ORIGIN);
  s.roads = hand(s.roads); s.water = hand(s.water); s.walls = hand(s.walls); s.buildings = hand(s.buildings); s.areas = hand(s.areas); s.trees = hand(s.trees); s.props = hand(s.props);
  s.overlay = { labels: s.overlay.labels.filter(l => l.origin !== ORIGIN), symbols: s.overlay.symbols.filter(x => x.origin !== ORIGIN) };
  const ground = s.underlay && ctx.field ? groundFromMap(s, ctx.field) : FLAT;
  const big = s.kind === 'town' || s.kind === 'city', castleOnly = s.kind === 'castle';

  // ---- water
  if (s.underlay && ctx.field) { s.water.push(...mapWater(s, ctx.field)); s.areas.push(...mapWoods(s, ground)); }
  else if (g.water === 'river') {
    const vertical = rand() < 0.5, n = 7, pts: P[] = [], off = (vertical ? cols : rows) * (0.62 + rand() * 0.2);
    for (let i = 0; i <= n; i++) { const t = i / n, wob = Math.sin(t * Math.PI * (1.5 + rand()) + rand() * 6) * (vertical ? cols : rows) * 0.06; pts.push(vertical ? [off + wob, -1 + t * (rows + 2)] : [-1 + t * (cols + 2), off + wob]); }
    const width = ft(s.kind === 'hamlet' ? 10 : s.kind === 'village' ? 25 : 45);
    s.water.push({ kind: s.kind === 'hamlet' ? 'stream' : 'river', points: flat(pts), width: r2(width), origin: ORIGIN });
  } else if (g.water === 'lake') {
    const c: P = [cols * (rand() < 0.5 ? 0.2 : 0.8), rows * (rand() < 0.5 ? 0.22 : 0.78)];
    s.water.push({ kind: 'lake', points: flat(blob(c, cols * 0.14, rows * 0.14, 10, 0.4, rand)), origin: ORIGIN });
  } else if (g.water === 'coast') {
    const side = Math.floor(rand() * 4), depth = 0.16 + rand() * 0.06, pts: P[] = [], n = 10;
    for (let i = 0; i <= n; i++) { const t = i / n, w = (Math.sin(t * 7 + rand() * 3) * 0.03 + depth); pts.push(side === 0 ? [t * cols, rows * w] : side === 1 ? [cols * (1 - w), t * rows] : side === 2 ? [t * cols, rows * (1 - w)] : [cols * w, t * rows]); }
    const corner: P[] = side === 0 ? [[cols + 1, -1], [-1, -1]] : side === 1 ? [[cols + 1, rows + 1], [cols + 1, -1]] : side === 2 ? [[cols + 1, rows + 1], [-1, rows + 1]] : [[-1, rows + 1], [-1, -1]];
    const ring = side === 0 || side === 3 ? [...pts, ...(side === 0 ? corner : corner.reverse())] : [...pts, ...corner];
    s.water.push({ kind: 'sea', points: flat(ring), origin: ORIGIN });
  }
  let lay = layoutSettlement(s);
  const wet = (x: number, y: number, pad = 0) => ground.water(x, y) || lay.water.some(w => (w.area ? inPolygon(w.pts, x, y) || (pad > 0 && nearestOnLine([...w.pts, w.pts[0], w.pts[1]], x, y).d < pad) : nearestOnLine(w.pts, x, y).d < w.width / 2 + pad));

  // ---- the centre: dry, near the middle
  let C: P = [cols * (0.42 + rand() * 0.16), rows * (0.42 + rand() * 0.16)];
  for (let r = 0; r < Math.max(cols, rows) && wet(C[0], C[1], 4); r += 1) C = [C[0] + (rand() - 0.5) * r * 0.8, C[1] + (rand() - 0.5) * r * 0.8].map((v, i) => Math.max(4, Math.min((i ? rows : cols) - 4, v))) as P;
  const occ = new Grid(cols, rows);
  for (let y = 0.25; y < rows; y += 0.5) for (let x = 0.25; x < cols; x += 0.5) if (wet(x, y, 0.3)) occ.mark(x, y);
  for (const b of s.buildings) occ.poly(rotatePts(footprint(b), b.angle ?? 0, b.x + b.w / 2, b.y + b.h / 2), 0.3, false);

  const roadCost = (x: number, y: number) => (wet(x, y) ? 14 : 1) + ground.slope(x, y) * 40 + (x <= 0 || y <= 0 || x >= cols || y >= rows ? 3 : 0);
  const addRoad = (kind: RoadKind, pts: number[], label?: string): Road => { const r: Road = { kind, points: pts, curve: 'smooth', ...(label && { label }), origin: ORIGIN }; s.roads.push(r); occ.line(pts, roadWidth(s, r) / 2 + 0.2); return r; };

  // ---- the core: how far the buildings reach from the centre
  const lotFt = big ? 25 * 30 : 30 * 40, coreR = Math.max(ft(60), Math.sqrt((g.buildings * ft(Math.sqrt(lotFt)) ** 2) / (Math.PI * (0.25 + g.density * 0.35))));
  const Rcore = Math.min(coreR, Math.min(cols, rows) * 0.42);

  // ---- through roads
  const through: Road[] = [];
  const nThrough = castleOnly ? 1 : s.kind === 'hamlet' ? 1 : s.kind === 'village' ? 2 : big ? 4 : 2;
  const a0 = rand() * Math.PI * 2;
  for (let i = 0; i < nThrough; i++) {
    const a = a0 + (i * Math.PI * 2) / nThrough + (rand() - 0.5) * 0.5, e = edgePoint(C, a, cols, rows);
    const kind: RoadKind = big ? 'highway' : castleOnly ? 'lane' : 'street';
    through.push(addRoad(kind, calm(route(e, C, cols, rows, roadCost))));
  }
  // a hamlet's single road runs on through the other side
  if (s.kind === 'hamlet' || s.kind === 'village') { const e = edgePoint(C, a0 + Math.PI + (rand() - 0.5) * 0.6, cols, rows); through.push(addRoad(s.kind === 'hamlet' ? 'lane' : 'street', calm(route(C, e, cols, rows, roadCost)))); }

  // ---- the market square
  if (g.market && !castleOnly) {
    const half = ft(big ? 45 : 30);
    const sq: P[] = [[C[0] - half, C[1] - half * 0.75], [C[0] + half, C[1] - half * 0.75], [C[0] + half, C[1] + half * 0.75], [C[0] - half, C[1] + half * 0.75]];
    s.areas.push({ kind: big ? 'market' : 'square', points: flat(sq), label: big ? 'Market' : undefined, origin: ORIGIN });
    occ.poly(flat(sq), 0.2, false);
    s.props.push({ kind: big ? 'fountain' : 'well', x: r2(C[0]), y: r2(C[1]), origin: ORIGIN });
    if (big) for (let i = 0; i < 4; i++) s.props.push({ kind: 'stall', x: r2(C[0] + (i % 2 ? 1 : -1) * half * 0.6), y: r2(C[1] + (i < 2 ? -1 : 1) * half * 0.45), angle: i < 2 ? 0 : 180, origin: ORIGIN });
  } else if (!castleOnly) s.props.push({ kind: 'well', x: r2(C[0] + ft(12)), y: r2(C[1] + ft(12)), origin: ORIGIN });

  // ---- the town wall
  let wallRing: P[] | null = null;
  if (g.wall !== 'none' && !castleOnly) {
    let ring = blob(C, Rcore + ft(25), (Rcore + ft(25)) * (0.8 + rand() * 0.3), big ? 12 : 9, 0.18, rand);
    ring = ring.map(([x, y]) => { let p: P = [x, y]; for (let k = 0; k < 20 && (wet(p[0], p[1], 1) || p[0] < 2 || p[1] < 2 || p[0] > cols - 2 || p[1] > rows - 2); k++) p = [p[0] + (C[0] - p[0]) * 0.1, p[1] + (C[1] - p[1]) * 0.1]; return p; });
    wallRing = ring;
    const kind = g.wall === 'stone' ? 'stone' : 'palisade', gates: Gate[] = [];
    for (const r of through) for (const c of crossings(r.points, ring)) if (!gates.some(q => Math.hypot(q.at[0] - c[0], q.at[1] - c[1]) < 4)) gates.push({ at: [r2(c[0]), r2(c[1])], kind: kind === 'stone' ? 'gatehouse' : 'gate', ...(g.water === 'moat' && { drawbridge: true }) });
    const w: SWall = { kind, points: flat(ring), closed: true, ...(kind === 'stone' ? { towers: { shape: rand() < 0.5 ? 'round' : 'square', at: 'corners' as const } } : {}), gates, origin: ORIGIN };
    s.walls.push(w);
    occ.line([...w.points, w.points[0], w.points[1]], wallThickness(s, w) / 2 + ft(8));
    if (g.water === 'moat') s.water.push({ kind: 'moat', points: flat([...offsetRing(ring, wallThickness(s, w) / 2 + ft(14)), offsetRing(ring, wallThickness(s, w) / 2 + ft(14))[0]]), width: r2(ft(18)), origin: ORIGIN });
  }

  // ---- side streets
  if (!castleOnly) {
    const lanes = s.kind === 'hamlet' ? 1 : s.kind === 'village' ? 3 : s.kind === 'city' ? 18 : big ? 10 : 4, sideKind: RoadKind = big ? 'street' : 'lane';
    if (g.streets === 'grid' && big) {
      const step = ft(140);
      for (let x = C[0] - Rcore; x <= C[0] + Rcore; x += step) addRoad('street', [r2(x), r2(C[1] - Rcore), r2(x), r2(C[1] + Rcore)]).curve = 'none';
      for (let y = C[1] - Rcore; y <= C[1] + Rcore; y += step) addRoad('street', [r2(C[0] - Rcore), r2(y), r2(C[0] + Rcore), r2(y)]).curve = 'none';
    } else {
      if (g.streets === 'radial' && big) addRoad('street', flat([...blob(C, Rcore * 0.55, Rcore * 0.55, 14, 0.1, rand), blob(C, Rcore * 0.55, Rcore * 0.55, 14, 0.1, rng(0))[0]]));
      for (let i = 0, tries = 0; i < lanes && tries < lanes * 8; tries++) {
        // branch off a road point inside the core, across the road, and end inside the core
        const pool = s.roads.flatMap(r => (r.kind === 'path' || r.kind === 'track' ? [] : Array.from({ length: r.points.length / 2 - 1 }, (_, j) => [r.points[2 * j], r.points[2 * j + 1], r.points[2 * j + 2], r.points[2 * j + 3]]))).filter(q => Math.hypot(q[0] - C[0], q[1] - C[1]) < Rcore * 0.85);
        if (!pool.length) break;
        const [sx, sy, nx, ny] = pool[Math.floor(rand() * pool.length)], a = Math.atan2(ny - sy, nx - sx) + (rand() < 0.5 ? 1 : -1) * Math.PI / 2 + (rand() - 0.5) * 0.5;
        const len = Rcore * (0.35 + rand() * 0.45);
        let end: P = [sx + Math.cos(a) * len, sy + Math.sin(a) * len];
        for (let k = 0; k < 12 && (Math.hypot(end[0] - C[0], end[1] - C[1]) > Rcore * 0.95 || (wallRing && !inPolygon(flat(wallRing), end[0], end[1]))); k++) end = [end[0] + (sx - end[0]) * 0.15, end[1] + (sy - end[1]) * 0.15];
        end = [Math.max(1, Math.min(cols - 1, end[0])), Math.max(1, Math.min(rows - 1, end[1]))];
        if (wet(end[0], end[1], 1) || Math.hypot(end[0] - sx, end[1] - sy) < Rcore * 0.2) continue;
        const pts = calm(route([sx, sy], end, cols, rows, roadCost));
        // a lane that mostly runs along a street already there adds nothing: skip it
        const along: P[] = [];
        for (let j = 2; j < pts.length; j += 2) along.push([pts[j], pts[j + 1]]);
        const doubled = along.filter(([x, y]) => s.roads.some(r => nearestOnLine(r.points, x, y).d < roadWidth(s, r) / 2 + ft(20))).length;
        if (along.length && doubled > along.length * 0.4) continue;
        addRoad(i >= lanes * 0.6 && big ? 'alley' : sideKind, pts);
        i++;
      }
    }
  }

  // ---- the castle
  const castleRect = (cx: number, cy: number, w: number, h: number): P[] => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  const put = (kind: BuildingKind, cx: number, cy: number, w: number, h: number, extra: Partial<Building> = {}): Building => {
    const b: Building = { id: '', kind, shape: SHAPE_OF[kind] && kind !== 'inn' ? SHAPE_OF[kind]! : 'rect', x: r2(cx - w / 2), y: r2(cy - h / 2), w: r2(w), h: r2(h), stories: storiesOf(kind), origin: ORIGIN, ...extra };
    s.buildings.push(b);
    occ.poly(rotatePts(footprint(b), b.angle ?? 0, cx, cy), 0.2, false);
    return b;
  };
  /** A building at the best free spot of `cands` (each with the side it backs onto), its long side along that wall. */
  const fit = (kind: BuildingKind, long: number, short: number, cands: { p: P; vertical: boolean }[], extra: Partial<Building> = {}): Building | null => {
    for (const { p, vertical } of cands) {
      const w = vertical ? short : long, h = vertical ? long : short, box = flat(castleRect(p[0], p[1], w, h));
      if (box.some((v, i) => v < 0.5 || v > (i % 2 ? rows : cols) - 0.5) || occ.poly(box, ft(2), true)) continue;
      return put(kind, p[0], p[1], w, h, extra);
    }
    return null;
  };
  /** Spots along the inside of a rectangle's walls, `inset` in, nearest `near` first (or farthest, with `far`). */
  const alongWalls = (cc: P, cw: number, ch: number, inset: number, near: P, far = false) => {
    const out: { p: P; vertical: boolean; d: number }[] = [], step = ft(5);
    for (let t = -0.5; t <= 0.5; t += step / Math.max(cw, ch)) {
      out.push({ p: [cc[0] + t * cw, cc[1] - ch / 2 + inset], vertical: false, d: 0 }, { p: [cc[0] + t * cw, cc[1] + ch / 2 - inset], vertical: false, d: 0 });
      out.push({ p: [cc[0] - cw / 2 + inset, cc[1] + t * ch], vertical: true, d: 0 }, { p: [cc[0] + cw / 2 - inset, cc[1] + t * ch], vertical: true, d: 0 });
    }
    for (const o of out) o.d = Math.hypot(o.p[0] - near[0], o.p[1] - near[1]) * (far ? -1 : 1);
    return out.sort((a, b) => a.d - b.d);
  };
  if (g.castle) {
    const cw = ft(castleOnly ? 150 : 130), ch = ft(castleOnly ? 120 : 110);
    // a castle on its own sits in the middle; with a town, at the edge of the core
    const dir = a0 + Math.PI / nThrough;
    const cc: P = castleOnly ? C : [Math.max(cw / 2 + 4, Math.min(cols - cw / 2 - 4, C[0] + Math.cos(dir) * Rcore * 0.75)), Math.max(ch / 2 + 4, Math.min(rows - ch / 2 - 4, C[1] + Math.sin(dir) * Rcore * 0.75))];
    const inner = castleRect(cc[0], cc[1], cw, ch), road = through[0], gateAt = crossings(road.points, inner)[0] ?? [cc[0], cc[1] + ch / 2];
    const tower = ft(28), curtain: SWall = { kind: 'curtain', points: flat(inner), closed: true, towers: { shape: rand() < 0.6 ? 'round' : 'square', at: 'corners', size: r2(tower) }, gates: [{ at: [r2(gateAt[0]), r2(gateAt[1])], kind: 'gatehouse', ...((castleOnly || g.water === 'moat') && { drawbridge: true }) }], origin: ORIGIN };
    s.walls.push(curtain);
    s.buildings = s.buildings.filter(b => b.origin !== ORIGIN || !inPolygon(flat(inner), b.x + b.w / 2, b.y + b.h / 2));
    // the wall, its corner towers and the gatehouse are taken; then the buildings go round the bailey
    occ.line([...flat(inner), inner[0][0], inner[0][1]], wallThickness(s, curtain) / 2 + ft(2));
    for (const [x, y] of inner) occ.poly(flat(castleRect(x, y, tower * 1.1, tower * 1.1)), 0, false);
    occ.poly(flat(castleRect(gateAt[0], gateAt[1], ft(70), ft(70))), 0, false);
    const back: P = [cc[0] - (gateAt[0] - cc[0]), cc[1] - (gateAt[1] - cc[1])], inset = (d: number) => wallThickness(s, curtain) / 2 + ft(9) + d / 2;
    const keep = fit('keep', ft(45), ft(45), alongWalls(cc, cw, ch, inset(ft(45)), back).map(o => ({ ...o, p: [o.p[0] + (cc[0] - o.p[0]) * 0.25, o.p[1] + (cc[1] - o.p[1]) * 0.25] as P })), { label: 'Keep', roof: 'battlement' });
    const k0: P = keep ? [keep.x + keep.w / 2, keep.y + keep.h / 2] : cc;
    fit('hall', ft(55), ft(30), alongWalls(cc, cw, ch, inset(ft(30)), k0), { label: 'Great hall' });
    fit('chapel', ft(32), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), k0, true).filter(o => Math.hypot(o.p[0] - gateAt[0], o.p[1] - gateAt[1]) > ft(50)), { label: 'Chapel' });
    fit('barracks', ft(40), ft(22), alongWalls(cc, cw, ch, inset(ft(22)), gateAt), {});
    s.props.push({ kind: 'well', x: r2(cc[0] + (gateAt[0] - cc[0]) * 0.3), y: r2(cc[1] + (gateAt[1] - cc[1]) * 0.3), origin: ORIGIN });
    occ.poly(flat(inner), ft(6), false);
    if (castleOnly) {
      const outer = blob(cc, Math.min(cw * 1.2, cc[0] - 3, cols - cc[0] - 3), Math.min(ch * 1.3, cc[1] - 3, rows - cc[1] - 3), 10, 0.1, rand);
      const og = crossings(road.points, outer)[0];
      s.walls.push({ kind: 'stone', points: flat(outer), closed: true, towers: { shape: 'round', at: 'corners' }, gates: og ? [{ at: [r2(og[0]), r2(og[1])], kind: 'gatehouse' }] : [], origin: ORIGIN });
      occ.line([...flat(outer), outer[0][0], outer[0][1]], ft(14));
      if (og) occ.poly(flat(castleRect(og[0], og[1], ft(60), ft(60))), 0, false);
      if (g.water === 'moat') {
        const m = offsetRing(inner, wallThickness(s, curtain) / 2 + ft(16));
        s.water.push({ kind: 'moat', points: flat([...m, m[0]]), width: r2(ft(20)), origin: ORIGIN });
        occ.line(flat([...m, m[0]]), ft(14));
      }
      // the outer bailey: stables, a barn and a smithy against the outer wall, wherever there is room
      const ring: { p: P; vertical: boolean }[] = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2, d = 0.86 + rand() * 0.1;
        ring.push({ p: [cc[0] + Math.cos(a) * cw * d, cc[1] + Math.sin(a) * ch * d], vertical: Math.abs(Math.cos(a)) > 0.7 });
      }
      for (const [kind, l, sh, extra] of [['stable', 45, 15, { label: 'Stables' }], ['barn', 40, 28, {}], ['smithy', 25, 22, {}]] as const) fit(kind, ft(l), ft(sh), ring.sort(() => rand() - 0.5), extra);
    }
  }

  // ---- buildings along the roads
  lay = layoutSettlement(s);
  const quota = Math.max(0, Math.round(g.buildings));
  let placed = s.buildings.filter(b => b.origin === ORIGIN && !['keep', 'hall', 'chapel', 'barracks'].includes(b.kind)).length;
  const specials: BuildingKind[] = castleOnly ? [] : s.kind === 'hamlet' ? ['barn'] : s.kind === 'village' ? ['inn', 'temple', 'smithy', 'mill', 'barn', 'tavern'] : ['temple', 'inn', 'inn', 'tavern', 'smithy', 'smithy', 'hall', 'manor', 'warehouse', 'warehouse', 'mill', 'stable', 'chapel', 'tavern'];
  const queue: BuildingKind[] = [...specials], later: BuildingKind[] = [], tries: Partial<Record<BuildingKind, number>> = {};
  const fill = (): BuildingKind => (big ? (rand() < 0.55 ? 'house' : 'shop') : s.kind === 'hamlet' ? (rand() < 0.6 ? 'cottage' : 'house') : rand() < 0.4 ? 'cottage' : 'house');
  // frontage spots: both sides of every road but paths and tracks, nearest the centre first
  const spots: { x: number; y: number; angle: number; nx: number; ny: number; off: number; d: number; road: RoadKind }[] = [];
  for (const r of lay.roads) {
    if (r.kind === 'path' || r.kind === 'track') continue;
    for (let i = 0; i + 3 < r.pts.length; i += 2) {
      const x0 = r.pts[i], y0 = r.pts[i + 1], x1 = r.pts[i + 2], y1 = r.pts[i + 3], len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.01) continue;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len, step = ft(big ? 14 : 20) * (1.3 - g.density * 0.5);
      for (let t = 0; t < len; t += step) for (const sg of [-1, 1]) {
        const x = x0 + ux * t, y = y0 + uy * t;
        spots.push({ x, y, angle: (Math.atan2(uy, ux) * 180) / Math.PI, nx: -uy * sg, ny: ux * sg, off: r.width / 2 + ft(big ? 3 : 6) + rand() * ft(4), d: Math.hypot(x - C[0], y - C[1]) + rand() * ft(30), road: r.kind as RoadKind });
      }
    }
  }
  spots.sort((p, q) => p.d - q.d);
  const reach = wallRing ? null : Rcore * 1.35;
  const named = (b: Building) => {
    if (b.kind === 'inn' || b.kind === 'tavern') b.label = `The ${INN_A[Math.floor(rand() * INN_A.length)]} ${INN_B[Math.floor(rand() * INN_B.length)]}`;
    else if (b.kind === 'temple') b.label = 'Temple';
  };
  const nearWater = (x: number, y: number) => lay.water.some(w => (w.area ? nearestOnLine([...w.pts, w.pts[0], w.pts[1]], x, y).d < ft(25) : nearestOnLine(w.pts, x, y).d < w.width / 2 + ft(25)));
  // a special that does not fit goes to the back of the queue, and after a while waits for the infill below
  const retry = (k: BuildingKind) => { if (specials.includes(k)) ((tries[k] = (tries[k] ?? 0) + 1) < 25 ? queue : later).push(k); };
  for (const sp of spots) {
    if (placed >= quota) break;
    if (wallRing && !inPolygon(flat(wallRing), sp.x, sp.y) && placed < quota * 0.8) continue;
    if (reach && sp.d > reach * 1.15) continue;
    // the next special first; when it has no room here (or a mill has no water), an ordinary building
    const first = queue.length ? queue.shift()! : null, kinds = first && !(first === 'mill' && !nearWater(sp.x, sp.y)) ? [first, fill()] : [fill()];
    if (first && kinds.length === 1) retry(first);
    let b: Building | null = null, kind: BuildingKind = kinds[0], fw = 0, dh = 0;
    for (const k of kinds) {
      const [f0, f1, d0, d1] = SIZE_FT[k];
      fw = ft(f0 + rand() * (f1 - f0)); dh = ft(d0 + rand() * (d1 - d0));
      const cx = sp.x + sp.nx * (sp.off + dh / 2), cy = sp.y + sp.ny * (sp.off + dh / 2);
      const shape: BuildingShape = SHAPE_OF[k] ?? (k === 'house' && rand() < 0.15 ? 'L' : 'rect');
      const c: Building = { id: '', kind: k, shape, x: r2(cx - fw / 2), y: r2(cy - dh / 2), w: r2(fw), h: r2(dh), angle: r2(sp.angle), stories: k === 'house' || k === 'shop' ? (big ? 2 : rand() < 0.3 ? 2 : 1) : storiesOf(k), origin: ORIGIN };
      // an L or T turns its wing (the stem of a temple) toward the road
      if (shape === 'T' || shape === 'L') { const facing = sp.nx * -Math.sin((sp.angle * Math.PI) / 180) + sp.ny * Math.cos((sp.angle * Math.PI) / 180); if (facing < 0) c.angle = r2(sp.angle + 180); }
      const out = rotatePts(footprint(c), c.angle ?? 0, cx, cy);
      if (out.some((v, i) => v < 0.5 || v > (i % 2 ? rows : cols) - 0.5) || occ.poly(out, ft(2 + (1 - g.density) * 6), true)) { if (k === first) retry(k); continue; }
      occ.poly(out, ft(1), false);
      b = c; kind = k;
      break;
    }
    if (!b) continue;
    s.buildings.push(b);
    placed++;
    named(b);
    // a garden or yard behind a village house; a graveyard behind the temple
    const behind = (depth: number, kindA: Area['kind']) => {
      const bx = sp.x + sp.nx * (sp.off + dh + 0.3), by = sp.y + sp.ny * (sp.off + dh + 0.3), ux = Math.cos((sp.angle * Math.PI) / 180), uy = Math.sin((sp.angle * Math.PI) / 180), hw = fw / 2;
      const poly: P[] = [[bx - ux * hw, by - uy * hw], [bx + ux * hw, by + uy * hw], [bx + ux * hw + sp.nx * depth, by + uy * hw + sp.ny * depth], [bx - ux * hw + sp.nx * depth, by - uy * hw + sp.ny * depth]];
      if (poly.some(([x, y]) => x < 0 || y < 0 || x > cols || y > rows) || occ.poly(flat(poly), 0, true)) return;
      occ.poly(flat(poly), 0.2, false);
      s.areas.push({ kind: kindA, points: flat(poly), origin: ORIGIN });
    };
    if (kind === 'temple') behind(ft(40), 'graveyard');
    else if (!big && (kind === 'house' || kind === 'cottage') && rand() < 0.6) behind(ft(15 + rand() * 20), 'garden');
    else if (kind === 'smithy' || kind === 'inn') behind(ft(20), 'yard');
  }

  // ---- infill: a town packs the blocks behind its street fronts, each building squared to the nearest street
  // (and any special building the street fronts had no room for still gets a spot near a street)
  queue.push(...later);
  if (big || queue.length) {
    for (let n = 0; n < quota * 40 && (placed < quota || queue.length) && (big || queue.length); n++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * Rcore * (big ? 1 : 1.3), x = C[0] + Math.cos(a) * d, y = C[1] + Math.sin(a) * d;
      if ((wallRing && !inPolygon(flat(wallRing), x, y)) || occ.taken(x, y)) continue;
      let best = { d: Infinity, angle: 0 };
      for (const r of lay.roads) { if (r.kind === 'path' || r.kind === 'track') continue; const n = nearestOnLine(r.pts, x, y); if (n.d < best.d) { const i = n.seg * 2; best = { d: n.d, angle: (Math.atan2(r.pts[i + 3] - r.pts[i + 1], r.pts[i + 2] - r.pts[i]) * 180) / Math.PI }; } }
      if (best.d > ft(160)) continue;
      const kind = queue.length && (n % 2 === 0 || !big) ? queue[0] : big && placed < quota ? fill() : null;
      if (!kind) continue;
      const [f0, f1, d0, d1] = SIZE_FT[kind], fw = ft(f0 + rand() * (f1 - f0)), dh = ft(d0 + rand() * (d1 - d0));
      const b: Building = { id: '', kind, shape: SHAPE_OF[kind] ?? 'rect', x: r2(x - fw / 2), y: r2(y - dh / 2), w: r2(fw), h: r2(dh), angle: r2(best.angle), stories: kind === 'house' || kind === 'shop' ? 2 : storiesOf(kind), origin: ORIGIN };
      const out = rotatePts(footprint(b), b.angle!, x, y);
      if (out.some((v, i) => v < 0.5 || v > (i % 2 ? rows : cols) - 0.5) || occ.poly(out, ft(3), true)) continue;
      occ.poly(out, ft(1), false);
      s.buildings.push(b);
      placed++;
      if (kind === queue[0]) { queue.shift(); named(b); }
    }
  }

  // ---- fields and paddocks outside the core
  const fieldCount = Math.round(g.fields * (castleOnly ? 3 : big ? 6 : 8));
  for (let i = 0, tries = 0; i < fieldCount && tries < fieldCount * 30; tries++) {
    const a = rand() * Math.PI * 2, d = Rcore * (1.3 + rand() * 1.2), cx = C[0] + Math.cos(a) * d, cy = C[1] + Math.sin(a) * d;
    const w = ft(60 + rand() * 120), h = ft(40 + rand() * 80), ang = rand() * 40 - 20;
    const poly = rotatePts([cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2], ang, cx, cy);
    if (poly.some((v, j) => v < 0 || v > (j % 2 ? rows : cols)) || occ.poly(poly, 0.5, true)) continue;
    occ.poly(poly, 0.3, false);
    const kindA: Area['kind'] = rand() < 0.65 ? 'field' : rand() < 0.5 ? 'paddock' : 'orchard';
    s.areas.push({ kind: kindA, points: poly.map(r2), origin: ORIGIN });
    i++;
  }
  // a wood in the emptiest corner when the settlement is leafy (and the map gave none)
  if (g.trees > 0.35 && !s.areas.some(a => a.kind === 'wood')) {
    const corners: P[] = [[0, 0], [cols, 0], [0, rows], [cols, rows]].sort((p, q) => Math.hypot(q[0] - C[0], q[1] - C[1]) - Math.hypot(p[0] - C[0], p[1] - C[1])) as P[];
    for (const cn of corners) {
      const c: P = [cn[0] ? cols - cols * 0.12 : cols * 0.12, cn[1] ? rows - rows * 0.12 : rows * 0.12], ring = blob(c, cols * 0.13, rows * 0.13, 9, 0.35, rand).map(([x, y]) => [Math.max(0, Math.min(cols, x)), Math.max(0, Math.min(rows, y))] as P);
      if (occ.poly(flat(ring), 0, true)) continue;
      occ.poly(flat(ring), 0, false);
      s.areas.push({ kind: 'wood', points: flat(ring), origin: ORIGIN });
      break;
    }
  }

  // ---- trees and props in the open ground
  const treeN = Math.round(g.trees * cols * rows * 0.012), sizes = { tree: ft(15), conifer: ft(12), bush: ft(5) };
  for (let i = 0, tries = 0; i < treeN && tries < treeN * 6; tries++) {
    const x = rand() * cols, y = rand() * rows;
    if (occ.taken(x, y) || s.areas.some(a => a.kind !== 'paddock' && a.kind !== 'garden' && inPolygon(a.points, x, y))) continue;
    const t = rand(), kind: Tree['kind'] = ground.forest(x, y) || t < 0.62 ? 'tree' : t < 0.78 ? 'conifer' : t < 0.95 ? 'bush' : 'boulder';
    const size = kind === 'boulder' ? ft(8) : sizes[kind as keyof typeof sizes] * (0.8 + rand() * 0.4);
    s.trees.push({ kind, x: r2(x), y: r2(y), size: r2(size), origin: ORIGIN });
    occ.mark(x, y);
    i++;
  }
  for (const b of s.buildings) {
    if (b.origin !== ORIGIN) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, side = rotatePts([cx + b.w / 2 + ft(5), cy], b.angle ?? 0, cx, cy);
    const prop: Fixture | null = b.kind === 'barn' ? { kind: 'haystack', x: side[0], y: side[1] } : b.kind === 'stable' ? { kind: 'trough', x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : b.kind === 'inn' ? { kind: 'cart', x: side[0], y: side[1], angle: b.angle ?? 0 } : b.kind === 'smithy' ? { kind: 'woodpile', x: side[0], y: side[1], angle: (b.angle ?? 0) + 90 } : null;
    if (prop && !occ.taken(prop.x, prop.y)) { s.props.push({ ...prop, x: r2(prop.x), y: r2(prop.y), ...(prop.angle !== undefined && { angle: r2(prop.angle) }), origin: ORIGIN }); occ.mark(prop.x, prop.y); }
  }

  // ---- ids, in reading order of the generated ones, after the hand ones
  const used = new Set(s.buildings.filter(b => b.origin !== ORIGIN).map(b => b.id));
  let n = 0;
  for (const b of s.buildings) if (b.origin === ORIGIN) { do n++; while (used.has(`b${n}`)); b.id = `b${n}`; used.add(b.id); }
  if (g.interiors) for (const b of s.buildings) if (b.origin === ORIGIN) b.floors = generateInterior(s, b);
  return parseSettlement(s);
}

/** Feet in one of a unit (unknown units count as feet). */
export const feetIn = (unit: string): number => ({ ft: 1, yd: 3, m: 3.28084, mi: 5280, km: 3280.84 } as Record<string, number>)[unit] ?? 1;

/** A new settlement over part of a terrain map: the sheet starts at `origin` (map units), one cell is `scale` map units, then generated. */
export function settlementFromMap(spec: SettlementSpec, mapPath: string, map: MapSpec, field: MapField, origin: [number, number]): SettlementSpec {
  const scale = Math.round(((spec.scale.perCell * feetIn(spec.scale.unit)) / (map.scale.perCell * feetIn(map.scale.unit))) * 1e4) / 1e4;
  const s = { ...spec, underlay: { map: mapPath, origin, scale } };
  return generateSettlement(s, { map, field });
}
