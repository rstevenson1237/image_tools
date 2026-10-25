/**
 * Seeded dungeon generator: places rooms without overlaps, joins them all (a minimum spanning tree over their centres,
 * plus a few loops), and hangs doors on the corridor ends. It writes plain rooms and corridors, so everything it makes
 * can be moved, relabelled or removed afterwards like a hand-placed room.
 */
import { rng } from '../lib/rng.ts';
import { DOOR_KINDS, type Corridor, type DoorKind, type DungeonSpec, type Room, type RoomShape } from './spec.ts';

const DOOR_WEIGHTS: Record<DoorKind, number> = { door: 70, secret: 8, locked: 10, portcullis: 6, arch: 6 };

/** A single room centred on a map just big enough for it and its exits, which run off the map's edges. */
export function singleRoom(spec: DungeonSpec, o: { shape: RoomShape; w: number; h: number; exits?: { side: 'n' | 'e' | 's' | 'w'; door?: DoorKind | null; at?: number; text?: string }[]; label?: string; number?: number | false; margin?: number }): DungeonSpec {
  const m = o.margin ?? 3, out = structuredClone(spec);
  const room: Room = { id: 'r1', shape: o.shape, x: m, y: m, w: o.w, h: o.h, ...(o.label && { label: o.label }), ...(o.number !== undefined && { number: o.number }) };
  out.cols = o.w + 2 * m; out.rows = o.h + 2 * m;
  out.rooms = [room];
  out.corridors = (o.exits ?? []).map(e => {
    const w = spec.gen.corridorWidth, odd = Math.round(w) % 2 === 1;
    // along the wall: the given offset from the room's top / left edge, else the middle (on the grid)
    const mid = (len: number) => (e.at !== undefined ? e.at : odd ? Math.floor(len / 2) + 0.5 : Math.round(len / 2));
    const at: [number, number] = e.side === 'n' ? [m + mid(o.w), -1] : e.side === 's' ? [m + mid(o.w), out.rows + 1] : e.side === 'w' ? [-1, m + mid(o.h)] : [out.cols + 1, m + mid(o.h)];
    const via = e.side === 'n' || e.side === 's' ? [at[0], m + o.h / 2] : [m + o.w / 2, at[1]];
    return { from: { room: 'r1' }, to: { at, ...(e.text && { exit: { text: e.text } }) }, via, width: w, doors: [e.door === undefined ? 'door' : e.door, null] } as Corridor;
  });
  return out;
}

/** Fill `rooms` and `corridors` from the generator settings and seed (replacing what was there; the overlay stays). */
export function generateDungeon(spec: DungeonSpec): DungeonSpec {
  const g = spec.gen, r = rng(spec.seed * 7919 + 13), out = structuredClone(spec);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const placed: Room[] = [];
  const free = (x: number, y: number, w: number, h: number) => placed.every(p =>
    x >= p.x + p.w + g.spacing || p.x >= x + w + g.spacing || y >= p.y + p.h + g.spacing || p.y >= y + h + g.spacing);
  for (let n = 0; n < g.rooms; n++) {
    const roll = r(), shape: RoomShape = roll < g.caves ? 'cave' : roll < g.caves + g.round ? (r() < 0.5 ? 'circle' : 'octagon') : 'rect';
    for (let tries = 0; tries < 400; tries++) {
      let w = int(g.minSize, g.maxSize), h = int(g.minSize, g.maxSize);
      if (shape === 'circle' || shape === 'octagon') { w = h = Math.max(w, 4); if (w % 2 === 0) { w++; h++; } }
      if (shape === 'cave') { w = Math.max(w + 2, 5); h = Math.max(h + 1, 4); }
      if (w > spec.cols - 2 || h > spec.rows - 2) continue;
      const x = int(1, spec.cols - w - 1), y = int(1, spec.rows - h - 1);
      if (!free(x, y, w, h)) continue;
      placed.push({ id: '', shape, x, y, w, h });
      break;
    }
  }
  // number in reading order: by rows of rooms, then left to right
  placed.sort((a, b) => Math.floor(a.y / 6) - Math.floor(b.y / 6) || a.x - b.x);
  placed.forEach((p, i) => { p.id = `r${i + 1}`; });
  const c = (p: Room) => [p.x + p.w / 2, p.y + p.h / 2];
  const dist = (a: Room, b: Room) => Math.hypot(c(a)[0] - c(b)[0], c(a)[1] - c(b)[1]);

  // minimum spanning tree (Prim) so every room is reachable, then loops between near neighbours
  const links: [number, number][] = [], inTree = new Set<number>(placed.length ? [0] : []);
  while (inTree.size < placed.length) {
    let best: [number, number] = [0, 0], bd = Infinity;
    for (const i of inTree) for (let j = 0; j < placed.length; j++) if (!inTree.has(j) && dist(placed[i], placed[j]) < bd) { bd = dist(placed[i], placed[j]); best = [i, j]; }
    links.push(best); inTree.add(best[1]);
  }
  const has = (i: number, j: number) => links.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  const extra = Math.round(g.loops * placed.length * 0.5);
  const cands = placed.flatMap((p, i) => placed.map((q, j) => [i, j, dist(p, q)] as const).filter(([, j]) => j > i))
    .filter(([i, j]) => !has(i, j)).sort((a, b) => a[2] - b[2]).slice(0, placed.length * 2);
  for (const [i, j] of cands) { if (links.length >= placed.length - 1 + extra) break; if (r() < 0.6) links.push([i, j]); }

  const door = (room: Room): DoorKind | null => {
    if (room.shape === 'cave' || r() >= g.doors) return null;
    let t = r() * 100;
    for (const k of DOOR_KINDS) { t -= DOOR_WEIGHTS[k]; if (t < 0) return k; }
    return 'door';
  };
  const corridors: Corridor[] = links.map(([i, j]) => ({ from: { room: placed[i].id }, to: { room: placed[j].id }, width: g.corridorWidth, doors: [door(placed[i]), door(placed[j])] }));

  if (g.entrance && placed.length) {
    // the way in: from the first room straight off the nearest edge
    const p = placed[0], [cx, cy] = c(p), odd = Math.round(g.corridorWidth) % 2 === 1, s = (v: number) => (odd ? Math.floor(v) + 0.5 : Math.round(v));
    const d = [[cy, 'n'], [spec.rows - cy, 's'], [cx, 'w'], [spec.cols - cx, 'e']] as const;
    const side = d.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
    const at: [number, number] = side === 'n' ? [s(cx), -1] : side === 's' ? [s(cx), spec.rows + 1] : side === 'w' ? [-1, s(cy)] : [spec.cols + 1, s(cy)];
    const via = side === 'n' || side === 's' ? [at[0], cy] : [cx, at[1]];
    corridors.unshift({ from: { room: p.id }, to: { at }, via, width: g.corridorWidth, doors: [p.shape === 'cave' ? null : 'door', null] });
  }
  out.rooms = placed;
  out.corridors = corridors;
  return out;
}
