/**
 * Settlement geometry: everything the renderer, the checks and the web tool's hit tests need, from the file alone.
 * Building outlines turned by their angle, road and water centre lines (smoothed where asked), wall lines with their
 * towers and gates, the bridges where roads cross water and the trees a wood or orchard scatters. A floor's plan reuses
 * the dungeon layout: its rooms and connections become a small dungeon, whose shared walls and doors are the floor's
 * partitions and inner doors.
 */
import { rng } from '../lib/rng.ts';
import { chaikin } from '../lib/trace.ts';
import { DEFAULTS as DUNGEON_DEFAULTS, type DungeonSpec } from '../dungeon/spec.ts';
import { idSeed, inPolygon, layoutDungeon, roomOutline, type RoomGeom } from '../dungeon/layout.ts';
import { edges, lineLength, nearestOnLine, sharedEdges, type P } from '../dungeon/geom.ts';
import { fixtureSize } from './fixtures.ts';
import {
  planFactor, roofOf, ROAD_WIDTH_FT, WALL_THICK_FT, WATER_LINES, WATER_WIDTH_FT,
  type Building, type Floor, type GateKind, type RoadKind, type SettlementSpec, type Tree, type WallKind, type WaterKind,
} from './spec.ts';

/** Feet a tree's crown is across, by kind. */
export const TREE_FT: Record<Tree['kind'], number> = { tree: 15, conifer: 12, bush: 5, rock: 4, boulder: 8, stump: 2, reeds: 4 };
/** Gate openings (feet) and the default tower (feet across). */
export const GATE_FT: Record<GateKind, number> = { gatehouse: 12, gate: 10, postern: 4, opening: 10 };
export const TOWER_FT = 20;

export interface BuildingGeom {
  building: Building; index: number;
  /** The outline in site cells, turned. */
  outline: number[];
  /** The wings (one rectangle for a plain building, two for an L or T), turned. */
  wings: number[][];
  cx: number; cy: number;
  number?: number;
}
export interface LineGeom { index: number; kind: string; pts: number[]; width: number; closed: boolean }
export interface WaterGeom extends LineGeom { kind: WaterKind; area: boolean }
export interface TowerGeom { x: number; y: number; shape: 'round' | 'square'; size: number; angle: number }
export interface GateGeom { kind: GateKind; x: number; y: number; angle: number; width: number; drawbridge: number; outward: P }
export interface WallGeom { index: number; kind: WallKind; pts: number[]; closed: boolean; thickness: number; towers: TowerGeom[]; gates: GateGeom[] }
export interface BridgeGeom { road: number; x0: number; y0: number; x1: number; y1: number; width: number }

export interface SettlementLayout {
  buildings: BuildingGeom[];
  roads: LineGeom[];
  water: WaterGeom[];
  walls: WallGeom[];
  bridges: BridgeGeom[];
  /** The trees woods and orchards scatter (not in the file). */
  areaTrees: Tree[];
}

const DEG = Math.PI / 180;

/** Turn x,y pairs by `angle` degrees about a point. */
export function rotatePts(pts: number[], angle: number, cx: number, cy: number): number[] {
  if (!angle) return pts.slice();
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG), out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) { const dx = pts[i] - cx, dy = pts[i + 1] - cy; out.push(cx + dx * c - dy * s, cy + dx * s + dy * c); }
  return out;
}

const rectPts = (x: number, y: number, w: number, h: number) => [x, y, x + w, y, x + w, y + h, x, y + h];

/** A building's wings before turning: [x, y, w, h] rectangles (an L is its left arm and bottom arm, a T its top bar and stem). */
export function buildingWings(b: Building): [number, number, number, number][] {
  const [ww, wh] = b.wing ?? [b.w / 2, b.h / 2];
  if (b.shape === 'L') return [[b.x, b.y, ww, b.h], [b.x + ww, b.y + b.h - wh, b.w - ww, wh]];
  if (b.shape === 'T') return [[b.x, b.y, b.w, wh], [b.x + (b.w - ww) / 2, b.y + wh, ww, b.h - wh]];
  return [[b.x, b.y, b.w, b.h]];
}

/** A building's outline before turning, in site cells. */
export function footprint(b: Building): number[] {
  const { x, y, w, h } = b, [ww, wh] = b.wing ?? [w / 2, h / 2];
  if (b.shape === 'L') return [x, y, x + ww, y, x + ww, y + h - wh, x + w, y + h - wh, x + w, y + h, x, y + h];
  if (b.shape === 'T') { const sx = x + (w - ww) / 2; return [x, y, x + w, y, x + w, y + wh, sx + ww, y + wh, sx + ww, y + h, sx, y + h, sx, y + wh, x, y + wh]; }
  if (b.shape === 'rect') return rectPts(x, y, w, h);
  return roomOutline({ id: b.id, shape: b.shape, x, y, w, h, ...(b.points && { points: b.points }) });
}

/** Site cells to the building's own unturned frame and back. */
export const buildingCentre = (b: Building): P => [b.x + b.w / 2, b.y + b.h / 2];

/** A point in the building's plan (plan cells from its top-left corner, unturned) on the site. */
export function planToSite(spec: SettlementSpec, b: Building, px: number, py: number): P {
  const f = planFactor(spec), [cx, cy] = buildingCentre(b), r = rotatePts([b.x + px / f, b.y + py / f], b.angle ?? 0, cx, cy);
  return [r[0], r[1]];
}

/** A site point in the building's plan cells. */
export function siteToPlan(spec: SettlementSpec, b: Building, x: number, y: number): P {
  const f = planFactor(spec), [cx, cy] = buildingCentre(b), r = rotatePts([x, y], -(b.angle ?? 0), cx, cy);
  return [(r[0] - b.x) * f, (r[1] - b.y) * f];
}

/** A building's outline in its plan cells (from its top-left corner, unturned). */
export function planOutline(spec: SettlementSpec, b: Building): number[] {
  const f = planFactor(spec);
  return footprint(b).map((v, i) => (v - (i % 2 ? b.y : b.x)) * f);
}

/** A road's width in cells. */
export const roadWidth = (spec: SettlementSpec, r: { kind: RoadKind; width?: number }) => r.width ?? Math.max(0.3, ROAD_WIDTH_FT[r.kind] / spec.scale.perCell);
export const waterWidth = (spec: SettlementSpec, w: { kind: WaterKind; width?: number }) => w.width ?? Math.max(0.3, WATER_WIDTH_FT[w.kind] / spec.scale.perCell);
export const wallThickness = (spec: SettlementSpec, w: { kind: WallKind; thickness?: number }) => w.thickness ?? Math.max(0.2, WALL_THICK_FT[w.kind] / spec.scale.perCell);

const closedLine = (p: number[]) => p.length >= 6 && Math.abs(p[0] - p[p.length - 2]) < 1e-9 && Math.abs(p[1] - p[p.length - 1]) < 1e-9;
const smooth = (p: number[], closed: boolean, passes = 3) => chaikin({ pts: p, closed }, passes).pts;

/** The point on a polyline nearest `at`, and the direction of its segment there (degrees). */
export function snapToLine(pts: number[], closed: boolean, at: P): { x: number; y: number; angle: number; along: number } {
  const ring = closed ? [...pts, pts[0], pts[1]] : pts, n = nearestOnLine(ring, at[0], at[1]), i = n.seg * 2;
  return { x: n.x, y: n.y, angle: Math.atan2(ring[i + 3] - ring[i + 1], ring[i + 2] - ring[i]) / DEG, along: n.along };
}

/** Points every `step` along a polyline with the direction there, starting `start` in. */
function along(pts: number[], step: number, start = 0): { x: number; y: number; angle: number }[] {
  const out: { x: number; y: number; angle: number }[] = [];
  let carry = start;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], len = Math.hypot(dx, dy);
    if (!len) continue;
    let t = carry;
    for (; t <= len + 1e-9; t += step) out.push({ x: pts[i] + (dx * t) / len, y: pts[i + 1] + (dy * t) / len, angle: Math.atan2(dy, dx) / DEG });
    carry = t - len;
  }
  return out;
}

/** The centroid of a ring (its vertex average, enough to tell the inside from the outside of a wall). */
const centroid = (p: number[]): P => { let x = 0, y = 0; for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; } return [(2 * x) / p.length, (2 * y) / p.length]; };

function wallGeom(spec: SettlementSpec, index: number, water: WaterGeom[]): WallGeom {
  const w = spec.walls[index], closed = !!w.closed, pts = w.points.slice(), thickness = wallThickness(spec, w);
  const t = w.towers, size = t?.size ?? Math.max(1, TOWER_FT / spec.scale.perCell), shape = t?.shape ?? 'round';
  const towers: TowerGeom[] = [];
  const nVert = pts.length / 2, segAngle = (i: number) => { const j = closed ? (i + 1) % nVert : Math.min(i + 1, nVert - 1), k = j === i ? i - 1 : i; const a = j === i ? [pts[2 * k], pts[2 * k + 1], pts[2 * i], pts[2 * i + 1]] : [pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1]]; return Math.atan2(a[3] - a[1], a[2] - a[0]) / DEG; };
  if (t) {
    const verts = t.at === undefined || t.at === 'corners' ? (t.every && t.at === undefined ? [] : Array.from({ length: nVert }, (_, i) => i)) : t.at.filter(i => i >= 0 && i < nVert);
    for (const i of verts) towers.push({ x: pts[2 * i], y: pts[2 * i + 1], shape, size, angle: segAngle(i) });
    if (t.every) {
      const ring = closed ? [...pts, pts[0], pts[1]] : pts, total = lineLength(ring), n = Math.max(1, Math.round(total / t.every));
      for (const p of along(ring, total / n, 0)) if (!towers.some(q => Math.hypot(q.x - p.x, q.y - p.y) < size * 1.2)) towers.push({ x: p.x, y: p.y, shape, size, angle: p.angle });
    }
  }
  const [mx, my] = closed ? centroid(pts) : [NaN, NaN];
  const gates: GateGeom[] = (w.gates ?? []).map(g => {
    const s = snapToLine(pts, closed, g.at), width = g.width ?? Math.max(0.6, GATE_FT[g.kind] / spec.scale.perCell);
    let nx = -Math.sin(s.angle * DEG), ny = Math.cos(s.angle * DEG);
    if (closed && (s.x - mx) * nx + (s.y - my) * ny < 0) { nx = -nx; ny = -ny; }
    // a drawbridge spans the moat out from the gate (or two cells when there is none near)
    let span = 0;
    if (g.drawbridge) {
      span = 2;
      for (const m of water) if (!m.area) { const d = nearestOnLine(m.pts, s.x + nx * (thickness / 2 + m.width / 2), s.y + ny * (thickness / 2 + m.width / 2)); if (d.d < m.width) span = Math.max(span, d.d + m.width + thickness / 2 + 0.5); }
    }
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, drawbridge: span, outward: [nx, ny] as P };
  });
  // twin towers flank a gatehouse; towers that fall in an opening go
  const kept = towers.filter(tw => !gates.some(g => g.kind !== 'postern' && Math.hypot(tw.x - g.x, tw.y - g.y) < g.width / 2 + tw.size * 0.4));
  for (const g of gates) if (g.kind === 'gatehouse') {
    const dx = Math.cos(g.angle * DEG), dy = Math.sin(g.angle * DEG), off = g.width / 2 + size / 2;
    for (const sg of [-1, 1]) kept.push({ x: g.x + sg * off * dx + g.outward[0] * size * 0.25, y: g.y + sg * off * dy + g.outward[1] * size * 0.25, shape, size, angle: g.angle });
  }
  return { index, kind: w.kind, pts, closed, thickness, towers: kept, gates };
}

/** Whether a site point is in water (on a river's ribbon or inside a pond, lake or sea). */
export function inWater(water: WaterGeom[], x: number, y: number, pad = 0): boolean {
  return water.some(w => (w.area ? inPolygon(w.pts, x, y) : nearestOnLine(w.closed ? [...w.pts, w.pts[0], w.pts[1]] : w.pts, x, y).d < w.width / 2 + pad));
}

function bridgesOf(roads: LineGeom[], water: WaterGeom[]): BridgeGeom[] {
  const out: BridgeGeom[] = [];
  for (const r of roads) {
    const step = 0.2, pts = along(r.pts, step);
    let run: typeof pts = [];
    const flush = () => {
      if (run.length) {
        const a = run[0], b = run[run.length - 1], len = Math.hypot(b.x - a.x, b.y - a.y) || step, ux = (b.x - a.x) / len || Math.cos(a.angle * DEG), uy = (b.y - a.y) / len || Math.sin(a.angle * DEG), ext = 0.5;
        out.push({ road: r.index, x0: a.x - ux * ext, y0: a.y - uy * ext, x1: b.x + ux * ext, y1: b.y + uy * ext, width: r.width + 0.3 });
      }
      run = [];
    };
    for (const p of pts) { if (inWater(water, p.x, p.y)) run.push(p); else flush(); }
    flush();
  }
  return out;
}

/** Trees spread over the woods and orchards, from each area's id (or index) so they stay put when other things change. */
function areaTrees(spec: SettlementSpec): Tree[] {
  const out: Tree[] = [], per = spec.scale.perCell;
  spec.areas.forEach((a, i) => {
    if (a.kind !== 'wood' && a.kind !== 'orchard') return;
    const xs = a.points.filter((_, j) => j % 2 === 0), ys = a.points.filter((_, j) => j % 2 === 1);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), rand = rng(idSeed(a.id ?? `area-${i}`));
    if (a.kind === 'orchard') {
      const gap = Math.max(1, 18 / per);
      for (let y = y0 + gap / 2; y < y1; y += gap) for (let x = x0 + gap / 2; x < x1; x += gap) if (inPolygon(a.points, x, y)) out.push({ kind: 'tree', x, y, size: (11 / per) * (0.85 + rand() * 0.3) });
      return;
    }
    // a wood: crowns on a jittered grid, now and then a conifer, fewer where the grid would be very fine
    const crown = TREE_FT.tree / per, gap = Math.max(0.8, crown * 0.8), cap = 3000;
    for (let y = y0 + gap / 2; y < y1 && out.length < cap; y += gap) for (let x = x0 + gap / 2; x < x1 && out.length < cap; x += gap) {
      const px = x + (rand() - 0.5) * gap * 0.8, py = y + (rand() - 0.5) * gap * 0.8;
      if (inPolygon(a.points, px, py)) out.push({ kind: rand() < 0.25 ? 'conifer' : 'tree', x: px, y: py, size: crown * (0.75 + rand() * 0.5) });
    }
  });
  return out;
}

export function layoutSettlement(spec: SettlementSpec): SettlementLayout {
  let auto = 0;
  const buildings: BuildingGeom[] = spec.buildings.map((b, index) => {
    const [cx, cy] = buildingCentre(b), a = b.angle ?? 0;
    const number = b.number === false ? undefined : b.number ?? ++auto;
    if (typeof b.number === 'number') auto = Math.max(auto, b.number);
    return { building: b, index, outline: rotatePts(footprint(b), a, cx, cy), wings: buildingWings(b).map(([x, y, w, h]) => rotatePts(rectPts(x, y, w, h), a, cx, cy)), cx, cy, number };
  });
  const roads: LineGeom[] = spec.roads.map((r, index) => ({ index, kind: r.kind, pts: r.curve === 'smooth' ? smooth(r.points, false) : r.points.slice(), width: roadWidth(spec, r), closed: false }));
  const water: WaterGeom[] = spec.water.map((w, index) => {
    const area = !WATER_LINES.includes(w.kind), closed = area || closedLine(w.points);
    const raw = closed && !area ? w.points.slice(0, -2) : w.points;
    const pts = w.kind === 'canal' || w.kind === 'moat' ? raw.slice() : smooth(raw, closed, area ? 3 : 2);
    return { index, kind: w.kind, pts, width: area ? 0 : waterWidth(spec, w), closed, area };
  });
  const walls = spec.walls.map((_, i) => wallGeom(spec, i, water));
  return { buildings, roads, water, walls, bridges: bridgesOf(roads, water), areaTrees: areaTrees(spec) };
}

/** The building under a site point (the last drawn, so the topmost), if any. */
export function buildingAt(l: SettlementLayout, x: number, y: number): BuildingGeom | undefined {
  for (let i = l.buildings.length - 1; i >= 0; i--) if (inPolygon(l.buildings[i].outline, x, y)) return l.buildings[i];
  return undefined;
}

// ---- floors ---------------------------------------------------------------------------------------------------------

export interface OpeningGeom { kind: string; x: number; y: number; angle: number; width: number }
export interface FixtureGeom { index: number; kind: string; x: number; y: number; w: number; h: number; angle: number; label?: string }
export interface FloorLayout {
  /** The footprint in plan cells, from its top-left corner (unturned). */
  outline: number[];
  /** The footprint's box in plan cells. */
  w: number; h: number;
  rooms: RoomGeom[];
  /** Inner walls: shared walls with their openings cut out, and the edges of rooms that stand free (x0,y0,x1,y1). */
  partitions: number[][];
  /** Doors between rooms, at the middle of the opening; `angle` runs along the wall. */
  inner: OpeningGeom[];
  /** Doors and windows in the outer wall; `angle` runs along the wall. */
  doors: OpeningGeom[];
  windows: OpeningGeom[];
  fixtures: FixtureGeom[];
}

/** A floor as a small dungeon: its rooms (floor rooms), connections and nothing else, sized to hold them. */
export function floorAsDungeon(floor: Floor, w: number, h: number): DungeonSpec {
  const d = structuredClone(DUNGEON_DEFAULTS);
  return {
    ...d, id: 'floor', version: 1, seed: 1, cols: Math.max(4, Math.ceil(w)), rows: Math.max(4, Math.ceil(h)),
    style: { ...d.style, hatch: 'none', sharedWalls: true },
    rooms: floor.rooms.map(r => ({ ...r, fill: 'floor' as const })), corridors: [], connections: floor.connections ?? [], overlay: { labels: [], symbols: [] },
  };
}

/** The parts of segment a→b not covered by any of `covers` (collinear segments), as segments. */
function uncovered(a: P, b: P, covers: [P, P][]): [P, P][] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1e-9) return [];
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, t = (p: P) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
  const cut = covers.map(([p, q]) => [Math.min(t(p), t(q)), Math.max(t(p), t(q))]).sort((p, q) => p[0] - q[0]);
  const out: [P, P][] = [];
  let from = 0;
  for (const [c0, c1] of [...cut, [L, L]]) {
    if (c0 > from + 1e-6) out.push([[a[0] + ux * from, a[1] + uy * from], [a[0] + ux * Math.min(c0, L), a[1] + uy * Math.min(c0, L)]]);
    from = Math.max(from, c1);
    if (from >= L) break;
  }
  return out;
}

/** An opening snapped onto the outline: the point on its nearest edge and the edge's direction. */
function onOutline(outline: number[], at: P): { x: number; y: number; angle: number } {
  const s = snapToLine(outline, true, at);
  return { x: s.x, y: s.y, angle: s.angle };
}

export function layoutFloor(spec: SettlementSpec, b: Building, floor: Floor): FloorLayout {
  const outline = planOutline(spec, b), f = planFactor(spec), w = b.w * f, h = b.h * f;
  const dl = layoutDungeon(floorAsDungeon(floor, w, h));
  const partitions = dl.partitions.slice();
  // a room edge on neither the outer wall nor another room's wall stands free: it is a wall too
  const outerEdges = dl.rooms.map(g => sharedEdges(g.outline, outline));
  dl.rooms.forEach((g, i) => {
    const covers: [P, P][] = [...outerEdges[i]];
    dl.rooms.forEach((o, j) => { if (j !== i) covers.push(...sharedEdges(g.outline, o.outline)); });
    for (const [a, c] of edges(g.outline)) {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, off = (p: P) => Math.abs((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])) / L;
      for (const [p, q] of uncovered(a, c, covers.filter(([p0, p1]) => off(p0) < 1e-6 && off(p1) < 1e-6))) partitions.push([p[0], p[1], q[0], q[1]]);
    }
  });
  const inner = dl.connections.filter(c => c.wall).map(c => ({ kind: c.kind, x: c.x, y: c.y, angle: c.angle + 90, width: c.width }));
  const doors = (floor.doors ?? []).map(d => ({ kind: d.kind ?? 'door', width: d.width ?? 1, ...onOutline(outline, d.at) }));
  const windows = (floor.windows ?? []).map(d => ({ kind: 'window', width: d.width ?? 1, ...onOutline(outline, d.at) }));
  const fixtures = (floor.fixtures ?? []).map((x, index) => { const [fw, fh] = fixtureSize(x, spec.interior.perCell); return { index, kind: x.kind, x: x.x, y: x.y, w: fw, h: fh, angle: x.angle ?? 0, ...(x.label !== undefined && { label: x.label }) }; });
  return { outline, w, h, rooms: dl.rooms, partitions, inner, doors, windows, fixtures };
}

/** The roof a building is drawn with (its own, else its kind's). */
export { roofOf };
