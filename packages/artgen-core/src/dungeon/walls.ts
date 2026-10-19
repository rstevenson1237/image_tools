/**
 * Walls, towers and gates (`walls` in `dungeon.json`): the enclosure round a fort or town plan. A wall follows the
 * convex hull of its rooms' footprints plus an inset, or a polygon as given; towers stand at its corners (or at listed
 * vertices) and a gate has a tower each side, a postern none. This is geometry only: the renderer draws it, and
 * `dungeon facts` reads it back.
 */
import { roundTo } from '../lib/round.ts';
import { inPolygon, type DungeonLayout } from './layout.ts';
import type { DungeonSpec, GateKind, Wall } from './spec.ts';

export const WALL_DEFAULTS = { thickness: 1, inset: 1, towerSize: 3, gateWidth: 2, posternWidth: 1 } as const;

export interface TowerGeom { x: number; y: number; shape: 'round' | 'square'; size: number; source: 'corner' | 'gate'; vertex?: number }
export interface GateGeom {
  kind: GateKind; x: number; y: number;
  /** The wall's direction at the gate, in degrees (the gate symbol's angle). */
  angle: number;
  width: number; room?: string;
  /** The towers standing beside it: two for a gate, none for a postern. */
  towers: TowerGeom[];
}
export interface WallGeom {
  index: number; id?: string; thickness: number;
  /** The wall's line as a closed ring (x,y pairs, cells). */
  ring: number[];
  towers: TowerGeom[];
  gates: GateGeom[];
  /** For each room the wall names (every room for a polygon wall): whether its whole footprint is inside the wall's line. */
  enclosed: { room: string; inside: boolean }[];
}

type P = [number, number];

/** The convex hull of points (x,y pairs), as a ring with no collinear points. */
export function convexHull(pts: number[]): P[] {
  const ps: P[] = [];
  for (let i = 0; i < pts.length; i += 2) ps.push([pts[i], pts[i + 1]]);
  ps.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const uniq = ps.filter((p, i) => !i || p[0] !== ps[i - 1][0] || p[1] !== ps[i - 1][1]);
  if (uniq.length < 3) return uniq;
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P[]) => {
    const h: P[] = [];
    for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); }
    h.pop();
    return h;
  };
  return [...half(uniq), ...half([...uniq].reverse())];
}

const area2 = (r: P[]) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);

/** A ring moved out by `d` at every edge (mitred corners). */
export function offsetRing(ring: P[], d: number): P[] {
  if (!d || ring.length < 3) return ring;
  const sign = area2(ring) > 0 ? 1 : -1, n = ring.length;
  const normal = (a: P, b: P): P => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [(sign * dy) / l, (-sign * dx) / l]; };
  return ring.map((p, i) => {
    const a = normal(ring[(i + n - 1) % n], p), b = normal(p, ring[(i + 1) % n]), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k] as P;
  });
}

/** The point on a ring nearest `at`, and the direction of its edge in degrees. */
export function snapToRing(ring: P[], at: P): { x: number; y: number; angle: number } {
  let best = { x: ring[0][0], y: ring[0][1], angle: 0 }, bd = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / L)) : 0, x = a[0] + t * dx, y = a[1] + t * dy, d = Math.hypot(at[0] - x, at[1] - y);
    if (d < bd) { bd = d; best = { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI }; }
  });
  return best;
}

/** One wall's geometry. */
function wallGeom(w: Wall, index: number, l: DungeonLayout): WallGeom {
  const byId = new Map(l.rooms.map(g => [g.room.id, g]));
  let ring: P[];
  if (w.poly) ring = Array.from({ length: w.poly.length / 2 }, (_, i) => [w.poly![2 * i], w.poly![2 * i + 1]] as P);
  else ring = offsetRing(convexHull((w.rooms ?? []).flatMap(id => byId.get(id)?.outline ?? [])), w.inset ?? WALL_DEFAULTS.inset);
  const thickness = w.thickness ?? WALL_DEFAULTS.thickness, tw = w.towers, size = tw?.size ?? WALL_DEFAULTS.towerSize, shape = tw?.shape ?? 'round';
  const towers: TowerGeom[] = [];
  if (tw) {
    const at = tw.at ?? 'corners', verts = at === 'corners' ? ring.map((_, i) => i) : at.filter(i => i >= 0 && i < ring.length);
    for (const i of verts) towers.push({ x: ring[i][0], y: ring[i][1], shape, size, source: 'corner', vertex: i });
  }
  const gates: GateGeom[] = (w.gates ?? []).map(g => {
    const s = snapToRing(ring, g.at), width = g.width ?? (g.kind === 'postern' ? WALL_DEFAULTS.posternWidth : WALL_DEFAULTS.gateWidth);
    const dx = Math.cos((s.angle * Math.PI) / 180), dy = Math.sin((s.angle * Math.PI) / 180), off = width / 2 + size / 2;
    const side = g.kind === 'gate' ? [-1, 1].map(sg => ({ x: s.x + sg * off * dx, y: s.y + sg * off * dy, shape, size, source: 'gate' as const })) : [];
    towers.push(...side);
    return { kind: g.kind, x: s.x, y: s.y, angle: s.angle, width, ...(g.room !== undefined && { room: g.room }), towers: side };
  });
  const ids = w.rooms ?? l.rooms.map(g => g.room.id);
  const enclosed = ids.map(room => {
    const g = byId.get(room), flat = ring.flat();
    return { room, inside: !!g && g.outline.every((_, i) => i % 2 || inPolygon(flat, g.outline[i], g.outline[i + 1]) || onRing(ring, g.outline[i], g.outline[i + 1])) };
  });
  return { index, ...(w.id !== undefined && { id: w.id }), thickness, ring: ring.flat(), towers, gates, enclosed };
}

const onRing = (ring: P[], x: number, y: number) => { const s = snapToRing(ring, [x, y]); return Math.hypot(s.x - x, s.y - y) < 1e-6; };

/** The geometry of every wall in the file, in order. */
export function layoutWalls(spec: DungeonSpec, l: DungeonLayout): WallGeom[] {
  return (spec.walls ?? []).map((w, i) => wallGeom(w, i, l));
}

const r1 = (v: number) => roundTo(v, 0.1);

/** Walls as numbers (`dungeon facts`): corners, towers, gates and which rooms each encloses. Positions in cells, to 0.1. */
export interface WallFacts {
  index: number; id: string | null; thickness: number;
  /** The wall's corners, in order. */
  corners: [number, number][];
  towers: { at: [number, number]; shape: 'round' | 'square'; size: number; source: 'corner' | 'gate'; vertex: number | null }[];
  gates: { kind: GateKind; at: [number, number]; angle: number; width: number; room: string | null; towers: number }[];
  enclosed: { room: string; inside: boolean }[];
}

export function wallFacts(spec: DungeonSpec, l: DungeonLayout): WallFacts[] {
  return layoutWalls(spec, l).map(w => ({
    index: w.index, id: w.id ?? null, thickness: w.thickness,
    corners: Array.from({ length: w.ring.length / 2 }, (_, i) => [r1(w.ring[2 * i]), r1(w.ring[2 * i + 1])] as [number, number]),
    towers: w.towers.map(t => ({ at: [r1(t.x), r1(t.y)], shape: t.shape, size: t.size, source: t.source, vertex: t.vertex ?? null })),
    gates: w.gates.map(g => ({ kind: g.kind, at: [r1(g.x), r1(g.y)], angle: Math.round(g.angle), width: g.width, room: g.room ?? null, towers: g.towers.length })),
    enclosed: w.enclosed,
  }));
}
