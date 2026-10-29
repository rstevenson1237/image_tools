/**
 * Seeded dungeon generator: places rooms without overlaps, joins them all (a minimum spanning tree over their centres,
 * plus a few loops), and hangs doors on the corridor ends. It writes plain rooms and corridors, so everything it makes
 * can be moved, relabelled or removed afterwards like a hand-placed room.
 */
import { rng } from 'artgen-primitives/lib/rng.ts';
import { applyBlock, blockRoomNear, hexPoints } from './blocks.ts';
import { sharedEdges } from './geom.ts';
import { roomOutline } from './layout.ts';
import { DOOR_KINDS, type Block, type Connection, type Corridor, type CorridorEnd, type DoorKind, type DungeonSpec, type Room, type RoomShape, type Side } from './spec.ts';

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
  if (spec.gen.layout === 'dense') return generateDense(spec);
  if (spec.gen.layout === 'blocks') return generateBlocks(spec);
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

  if (g.entrance && placed.length) corridors.unshift(entrance(spec, placed[0], placed[0].shape === 'cave' ? null : 'door'));
  out.rooms = placed;
  out.corridors = corridors;
  delete out.connections; delete out.blocks;
  return out;
}

/** The way in: from room `p` straight off the nearest edge of the map. */
function entrance(spec: DungeonSpec, p: Room, door: DoorKind | null): Corridor {
  const g = spec.gen, cx = p.x + p.w / 2, cy = p.y + p.h / 2, odd = Math.round(g.corridorWidth) % 2 === 1, s = (v: number) => (odd ? Math.floor(v) + 0.5 : Math.round(v));
  const d = [[cy, 'n'], [spec.rows - cy, 's'], [cx, 'w'], [spec.cols - cx, 'e']] as const;
  const side = d.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
  const at: [number, number] = side === 'n' ? [s(cx), -1] : side === 's' ? [s(cx), spec.rows + 1] : side === 'w' ? [-1, s(cy)] : [spec.cols + 1, s(cy)];
  const via = side === 'n' || side === 's' ? [at[0], cy] : [cx, at[1]];
  return { from: { room: p.id }, to: { at }, via, width: g.corridorWidth, doors: [door, null] };
}

/** A door kind for a connection or corridor end: a door (by weight) for a share `doors` of them, else an opening. */
function doorOrOpen(r: () => number, doors: number): DoorKind | 'open' {
  if (r() >= doors) return 'open';
  let t = r() * 100;
  for (const k of DOOR_KINDS) { t -= DOOR_WEIGHTS[k]; if (t < 0) return k; }
  return 'door';
}

/** Rooms in reading order (rows of rooms, then left to right), named r1, r2, …. */
function readingOrder(rooms: Room[]): void {
  rooms.sort((a, b) => Math.floor(a.y / 6) - Math.floor(b.y / 6) || a.x - b.x);
  rooms.forEach((p, i) => { p.id = `r${i + 1}`; });
}

/** Join the rooms that share a wall a door wide: a spanning tree (random), then a share `loops` of the rest. */
function joinTouching(rooms: Room[], r: () => number, loops: number, doors: number): Connection[] {
  const outlines = rooms.map(roomOutline), pairs: [number, number][] = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
    if (sharedEdges(outlines[i], outlines[j]).some(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= 2 - 1e-6)) pairs.push([i, j]);
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  const group = rooms.map((_, i) => i), find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  return pairs.flatMap(([i, j]) => {
    const tree = find(i) !== find(j);
    if (tree) group[find(i)] = find(j);
    if (!tree && r() >= loops * 0.6) return [];
    const kind = doorOrOpen(r, doors);
    return [{ a: rooms[i].id, b: rooms[j].id, ...(kind !== 'door' && { kind }) } as Connection];
  });
}

/**
 * `gen.layout: dense`: rooms packed side by side, sharing walls, joined through them by doors and openings rather than
 * corridors (a warren, a keep's floor). Each room after the first is set against one already placed, the best fit of a
 * few tries (the most wall shared); `gen.density` is the share of the sheet to fill (default 0.5).
 */
function generateDense(spec: DungeonSpec): DungeonSpec {
  const g = spec.gen, r = rng(spec.seed * 7919 + 17), out = structuredClone(spec), int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const placed: Room[] = [], target = (g.density ?? 0.5) * spec.cols * spec.rows;
  const fits = (x: number, y: number, w: number, h: number) => x >= 1 && y >= 1 && x + w <= spec.cols - 1 && y + h <= spec.rows - 1
    && placed.every(p => x >= p.x + p.w || p.x >= x + w || y >= p.y + p.h || p.y >= y + h);
  const touch = (x: number, y: number, w: number, h: number) => placed.reduce((n, p) => {
    const vx = Math.min(x + w, p.x + p.w) - Math.max(x, p.x), vy = Math.min(y + h, p.y + p.h) - Math.max(y, p.y);
    return n + ((x === p.x + p.w || p.x === x + w) && vy > 0 ? vy : 0) + ((y === p.y + p.h || p.y === y + h) && vx > 0 ? vx : 0);
  }, 0);
  const w0 = int(g.minSize, g.maxSize), h0 = int(g.minSize, g.maxSize);
  if (w0 <= spec.cols - 2 && h0 <= spec.rows - 2) placed.push({ id: '', shape: 'rect', x: Math.floor((spec.cols - w0) / 2), y: Math.floor((spec.rows - h0) / 2), w: w0, h: h0 });
  for (let tries = 0; placed.length && placed.length < g.rooms && tries < g.rooms * 60; tries++) {
    if (placed.reduce((n, p) => n + p.w * p.h, 0) >= target) break;
    let best: Room | null = null, bestScore = -1;
    for (let k = 0; k < 8; k++) {
      const p = placed[Math.floor(r() * placed.length)], w = int(g.minSize, g.maxSize), h = int(g.minSize, g.maxSize), side = Math.floor(r() * 4);
      // against one of p's walls, overlapping it by at least two cells (room for a door)
      const x = side === 1 ? p.x + p.w : side === 3 ? p.x - w : int(p.x - w + 2, p.x + p.w - 2);
      const y = side === 2 ? p.y + p.h : side === 0 ? p.y - h : int(p.y - h + 2, p.y + p.h - 2);
      if (!fits(x, y, w, h)) continue;
      const score = touch(x, y, w, h) + r() * 0.5;
      if (score > bestScore) { bestScore = score; best = { id: '', shape: 'rect', x, y, w, h }; }
    }
    if (best) placed.push(best);
  }
  readingOrder(placed);
  out.rooms = placed;
  out.connections = joinTouching(placed, r, g.loops, g.doors);
  if (!out.connections.length) delete out.connections;
  out.corridors = g.entrance && placed.length ? [entrance(spec, edgeRoom(spec, placed), 'door')] : [];
  delete out.blocks;
  return out;
}

/** The room nearest an edge of the map (the way in starts there). */
function edgeRoom(spec: DungeonSpec, rooms: Room[]): Room {
  const gap = (p: Room) => Math.min(p.x, p.y, spec.cols - p.x - p.w, spec.rows - p.y - p.h);
  return rooms.reduce((m, p) => (gap(p) < gap(m) ? p : m));
}

/**
 * `gen.layout: blocks`: a few blocks (rectangles, and with `gen.round` an octagon or hexagon now and then), each split
 * into rooms that share walls, joined block to block by corridors round the others. About five rooms to a block.
 */
function generateBlocks(spec: DungeonSpec): DungeonSpec {
  const g = spec.gen, r = rng(spec.seed * 7919 + 19), int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const n = Math.max(1, Math.min(6, Math.round(g.rooms / 5))), side = Math.round(Math.sqrt(Math.max(1, g.rooms / n)) * (g.minSize + g.maxSize) / 2);
  const gap = Math.max(2, g.spacing + g.corridorWidth + 1), boxes: [number, number, number, number][] = [];
  for (let k = 0; k < n; k++) for (let tries = 0; tries < 300; tries++) {
    const w = Math.min(spec.cols - 4, int(Math.round(side * 0.75), Math.round(side * 1.3))), h = Math.min(spec.rows - 4, int(Math.round(side * 0.6), Math.round(side * 1.1)));
    if (w < g.minSize * 2 || h < g.minSize) break;
    const x = int(2, spec.cols - w - 2), y = int(2, spec.rows - h - 2);
    if (boxes.some(b => !(x >= b[0] + b[2] + gap || b[0] >= x + w + gap || y >= b[1] + b[3] + gap || b[1] >= y + h + gap))) continue;
    boxes.push([x, y, w, h]); break;
  }
  let out: DungeonSpec = { ...structuredClone(spec), rooms: [], corridors: [], blocks: [] };
  delete out.connections;
  boxes.sort((a, b) => Math.floor(a[1] / 6) - Math.floor(b[1] / 6) || a[0] - b[0]);
  boxes.forEach(([x, y, w, h], k) => {
    const id = `b${k + 1}`, split = { mode: 'bsp' as const, min: g.minSize, seed: int(1, 1e6) }, roll = r();
    out.blocks!.push(roll < g.round / 2 ? { id, shape: 'poly', points: hexPoints(x, y, w, h), x, y, w, h, split, doors: g.loops }
      : roll < g.round ? { id, shape: 'octagon', x, y, w, h, split, doors: g.loops } : { id, shape: 'rect', x, y, w, h, split, doors: g.loops });
  });
  for (const b of out.blocks!) out = applyBlock(out, b.id).spec;
  if (!out.blocks!.length) delete out.blocks;
  // blocks joined by a spanning tree over their centres, room to nearest room, round whatever is in the way
  const bs = out.blocks ?? [], c = (b: Block) => [b.x + b.w / 2, b.y + b.h / 2], inTree = new Set(bs.length ? [0] : []), links: [number, number][] = [];
  while (inTree.size < bs.length) {
    let best: [number, number] = [0, 0], bd = Infinity;
    for (const i of inTree) for (let j = 0; j < bs.length; j++) if (!inTree.has(j)) { const d = Math.hypot(c(bs[i])[0] - c(bs[j])[0], c(bs[i])[1] - c(bs[j])[1]); if (d < bd) { bd = d; best = [i, j]; } }
    links.push(best); inTree.add(best[1]);
  }
  // each link leaves a block by the wall facing the other block, from a room on that outer wall
  const facing = (from: Block, to: Block): Side => {
    const dx = c(to)[0] - c(from)[0], dy = c(to)[1] - c(from)[1];
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n');
  };
  const port = (b: Block, other: Block): CorridorEnd => {
    const side = facing(b, other), own = out.rooms.filter(r => r.origin === `block:${b.id}` && r.shape === 'rect');
    const edge = (r: Room) => (side === 'e' ? r.x + r.w === Math.ceil(b.x + b.w) : side === 'w' ? r.x === Math.floor(b.x) : side === 's' ? r.y + r.h === Math.ceil(b.y + b.h) : r.y === Math.floor(b.y));
    const on = own.filter(edge), o = c(other), d = (r: Room) => Math.hypot(r.x + r.w / 2 - o[0], r.y + r.h / 2 - o[1]);
    if (!on.length) return { room: blockRoomNear(out, b.id, o[0], o[1])! };
    return { room: on.reduce((m, r) => (d(r) < d(m) ? r : m)).id, side };
  };
  out.corridors = links.map(([i, j]) => ({ from: port(bs[i], bs[j]), to: port(bs[j], bs[i]), route: 'around' as const, width: g.corridorWidth, doors: ['door', 'door'] as [DoorKind, DoorKind] }));
  if (g.entrance && out.rooms.length) out.corridors.unshift(entrance(spec, edgeRoom(spec, out.rooms), 'door'));
  return out;
}
