/**
 * `route: "maze"` (R9 D6a): a dungeon's maze corridors routed on the lattice by `router.ts`, in file order, each seeing the
 * ones before it, round the rooms, off the other corridors, inside `bounds` and off `areas`. The lattice is the corridor's
 * width; a corridor leaves its room by its `side`, near its `port`, or by the door nearest the other room. Passages from one
 * room may join and part but never run beside each other. Where `style.sharedWalls` draws walls along corridors (the default)
 * a passage may run against a room's wall; otherwise it keeps a lattice cell off every wall but at its own doors.
 */
import { inBand } from './floor.ts';
import type { CorridorGeom, RoomGeom } from './layout.ts';
import { bearing as bearingOf, Footprint, LATTICE, raster, Router, type Pt, type Route } from './router.ts';
import { corridorWallsOn, corridorWidth, type Corridor, type CorridorEnd, type DungeonSpec, type Side } from './spec.ts';

const SIDE_BEARING: Record<Side, number> = { n: 0, e: 90, s: 180, w: 270 };

/** A maze corridor's points in cells, from inside its first room to inside its last, or null where no passage fits. */
export type MazeResult = Map<number, number[] | null>;

const isMaze = (c: Corridor) => c.route === 'maze' && 'room' in c.from && 'room' in c.to;

/** Route every maze corridor of the file; `others` are the corridors already laid out, which the passages keep off. */
export function routeMazes(spec: DungeonSpec, rooms: RoomGeom[], others: Map<number, CorridorGeom>): MazeResult {
  const out: MazeResult = new Map(), byWidth = new Map<number, number[]>();
  spec.corridors.forEach((c, i) => { if (isMaze(c)) { const w = corridorWidth(c, spec); byWidth.set(w, [...(byWidth.get(w) ?? []), i]); } });
  for (const [width, list] of byWidth) {
    const f = LATTICE / width, U = (p: Pt): Pt => [p[0] * f, p[1] * f];
    const prints = new Map(rooms.filter(g => (g.room.fill ?? 'floor') !== 'yard').map(g => {
      const r = g.room, square = r.shape === 'rect' || r.shape === 'cave';
      const outline: Pt[] = [];
      for (let k = 0; k < g.outline.length; k += 2) outline.push(U([g.outline[k], g.outline[k + 1]]));
      return [r.id, new Footprint(r.x * f, r.y * f, r.w * f, r.h * f, outline, square, U([g.cx, g.cy]))] as const;
    }));
    // the ground: the sheet, inside the bounds, off the areas
    const sheet: Pt[] = [[0, 0], [spec.cols * f, 0], [spec.cols * f, spec.rows * f], [0, spec.rows * f]];
    const ground = raster(sheet, true);
    if (spec.bounds) { const b = raster(toPts(spec.bounds, f), true); for (const k of [...ground]) if (!b.has(k)) ground.delete(k); }
    for (const a of spec.areas ?? []) for (const k of raster(toPts(a.points, f))) ground.delete(k);
    // the cells other corridors take, with the rooms they join (a passage from one of those rooms may meet them)
    const taken = new Map<string, string[]>();
    for (const [i, g] of others) {
      const c = spec.corridors[i], ends = [c.from, c.to].flatMap(e => ('room' in e ? [e.room] : []));
      const xs: number[] = [], ys: number[] = [];
      for (let k = 0; k < g.pts.length; k += 2) { xs.push(g.pts[k] * f); ys.push(g.pts[k + 1] * f); }
      if (!xs.length) continue;
      for (let ci = Math.floor((Math.min(...xs) - LATTICE) / LATTICE); ci <= Math.ceil((Math.max(...xs) + LATTICE) / LATTICE); ci++)
        for (let cj = Math.floor((Math.min(...ys) - LATTICE) / LATTICE); cj <= Math.ceil((Math.max(...ys) + LATTICE) / LATTICE); cj++)
          if (inBand(g.pts, g.width, ((ci + 0.5) * LATTICE) / f, ((cj + 0.5) * LATTICE) / f)) taken.set(`${ci},${cj}`, ends);
    }
    const first = spec.corridors[list[0]].maze ?? {};
    const router = new Router(prints, { seed: first.seed ?? spec.seed, ground, taken, clearance: first.clearance ?? (corridorWallsOn(spec) ? 0 : 1), ...(first.bend !== undefined && { bend: first.bend }), margin: 4 });
    for (const i of list) {
      const c = spec.corridors[i], a = (c.from as { room: string }).room, b = (c.to as { room: string }).room;
      const r = router.add(a, b, want(c.from, prints.get(a), f), want(c.to, prints.get(b), f));
      // rooms that touch take a door through their shared wall, which a corridor cannot draw: a connection does
      out.set(i, r && r.kind === 'path' ? toCells(r, prints, f) : null);
    }
  }
  return out;
}

const toPts = (v: number[], f: number): Pt[] => { const p: Pt[] = []; for (let i = 0; i + 1 < v.length; i += 2) p.push([v[i] * f, v[i + 1] * f]); return p; };

/** The wall an end names, as a bearing from its room's centre: its side, the bearing of its port, or none. */
function want(e: CorridorEnd, fp: Footprint | undefined, f: number): number | null {
  if (!('room' in e) || !fp) return null;
  if (e.side) return SIDE_BEARING[e.side];
  if (e.port) { const [cx, cy] = fp.centre; return bearingOf(e.port[0] * f - cx, e.port[1] * f - cy); }
  return null;
}

/** A route as the corridor's points in cells: from inside the first room, through the lattice cells, to inside the last. */
function toCells(r: Route, prints: Map<string, Footprint>, f: number): number[] {
  const inner = (room: string, slot: Route['slotA']): Pt => {
    const fp = prints.get(room)!;
    return slot && slot.side ? [(slot.inner[0] + 0.5) * LATTICE, (slot.inner[1] + 0.5) * LATTICE] : fp.hub ?? fp.centre;
  };
  const pts: Pt[] = [inner(r.a, r.slotA), ...r.cells.map(([i, j]) => [(i + 0.5) * LATTICE, (j + 0.5) * LATTICE] as Pt), inner(r.b, r.slotB)];
  return pts.flatMap(([x, y]) => [Math.round((x / f) * 1e6) / 1e6, Math.round((y / f) * 1e6) / 1e6]);
}
