/**
 * Blocks (`blocks` in `dungeon.json`): one shape — a rectangle, an octagon, a circle, a hexagon or any polygon — split
 * into smaller rooms that share walls, with doors and openings between them (a keep's wing, a temple's cells, a
 * warren). Splitting writes plain rooms and connections, each with `origin: "block:<id>"`, so they can be moved,
 * renamed or removed like any other; splitting again (a new seed, another mode) replaces them where they stand.
 */
import { rng } from 'artgen-primitives/lib/rng.ts';
import { polygonArea, sharedEdges } from './geom.ts';
import { idSeed, roomOutline } from './layout.ts';
import { polyBox, withoutDangling, type Block, type Connection, type DungeonSpec, type Room } from './spec.ts';

type Rect = [number, number, number, number];

/** A flat-topped hexagon filling a w × h box. */
export function hexPoints(x: number, y: number, w: number, h: number): number[] {
  return [x + w / 4, y, x + (3 * w) / 4, y, x + w, y + h / 2, x + (3 * w) / 4, y + h, x + w / 4, y + h, x, y + h / 2];
}

/** The block's outline (as a room of its shape would be drawn). */
export function blockOutline(b: Block): number[] {
  return roomOutline({ id: b.id, shape: b.shape, x: b.x, y: b.y, w: b.w, h: b.h, ...(b.points && { points: b.points }) });
}

/** A polygon cut to a rectangle (Sutherland-Hodgman: the rectangle is convex, so any outline, concave too, cuts cleanly). */
export function clipToRect(poly: number[], [x0, y0, x1, y1]: Rect): number[] {
  let pts: [number, number][] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push([poly[i], poly[i + 1]]);
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [p => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [p => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [p => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [p => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  for (const [inside, cut] of edges) {
    const out: [number, number][] = [];
    pts.forEach((p, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(p)) { if (!inside(prev)) out.push(cut(prev, p)); out.push(p); }
      else if (inside(prev)) out.push(cut(prev, p));
    });
    pts = out;
    if (!pts.length) return [];
  }
  // tidy: round off float noise and drop repeated and straight-through corners
  const r = (v: number) => Math.round(v * 1e6) / 1e6, flat: [number, number][] = [];
  for (const p of pts.map(([x, y]) => [r(x), r(y)] as [number, number])) if (!flat.length || flat[flat.length - 1][0] !== p[0] || flat[flat.length - 1][1] !== p[1]) flat.push(p);
  if (flat.length > 1 && flat[0][0] === flat[flat.length - 1][0] && flat[0][1] === flat[flat.length - 1][1]) flat.pop();
  const keep = flat.filter((p, i) => {
    const a = flat[(i + flat.length - 1) % flat.length], b = flat[(i + 1) % flat.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
  return keep.length >= 3 ? keep.flat() : [];
}

/** The block's box cut into rectangles on whole cells, by its split mode. */
function pieces(b: Block, rand: () => number): Rect[] {
  const x0 = Math.floor(b.x), y0 = Math.floor(b.y), x1 = Math.ceil(b.x + b.w), y1 = Math.ceil(b.y + b.h);
  const min = Math.max(1, b.split.min ?? 3), mode = b.split.mode;
  const along = (lo: number, hi: number, cuts: number[] | undefined, n: number) => {
    const at = cuts?.length ? cuts.filter(c => c > lo && c < hi).sort((p, q) => p - q) : Array.from({ length: n - 1 }, (_, i) => Math.round(lo + ((hi - lo) * (i + 1)) / n));
    return [lo, ...at, hi];
  };
  if (mode === 'rows' || mode === 'cols' || mode === 'grid' || mode === 'cuts') {
    // cuts: only along the lines given (an axis with none stays whole)
    const xs = mode === 'rows' || (mode === 'cuts' && !b.split.cuts?.x?.length) ? [x0, x1] : along(x0, x1, b.split.cuts?.x, Math.max(1, Math.floor((x1 - x0) / min)));
    const ys = mode === 'cols' || (mode === 'cuts' && !b.split.cuts?.y?.length) ? [y0, y1] : along(y0, y1, b.split.cuts?.y, Math.max(1, Math.floor((y1 - y0) / min)));
    const out: Rect[] = [];
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) out.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]);
    return out;
  }
  // bsp: cut the longer side at a random whole cell, at least `min` from each end, until pieces are small enough
  const out: Rect[] = [], cut = (r: Rect, depth: number): void => {
    const w = r[2] - r[0], h = r[3] - r[1], big = w * h > min * min * 4;
    if ((w < 2 * min && h < 2 * min) || (!big && depth > 1 && rand() < 0.35)) { out.push(r); return; }
    const vertical = w < 2 * min ? false : h < 2 * min ? true : w / h > 1.25 ? true : h / w > 1.25 ? false : rand() < 0.5;
    const len = vertical ? w : h, at = (vertical ? r[0] : r[1]) + min + Math.floor(rand() * (len - 2 * min + 1));
    if (vertical) { cut([r[0], r[1], at, r[3]], depth + 1); cut([at, r[1], r[2], r[3]], depth + 1); }
    else { cut([r[0], r[1], r[2], at], depth + 1); cut([r[0], at, r[2], r[3]], depth + 1); }
  };
  cut([x0, y0, x1, y1], 0);
  return out;
}

/** A block split into rooms (`<id>-1`, `<id>-2`, …) and the connections between them, all with origin `block:<id>`. */
export function splitBlock(b: Block): { rooms: Room[]; connections: Connection[] } {
  const rand = rng(b.split.seed ?? idSeed(b.id)), outline = blockOutline(b), origin = `block:${b.id}`, min = Math.max(1, b.split.min ?? 3);
  // a piece the outline leaves too small (a corner of a hexagon or circle) joins a neighbour it shares a whole side
  // with (their union is still a rectangle); one with no such neighbour is left as rock
  const small = Math.max(2, min * min * 0.35), area = (r: Rect) => { const c = clipToRect(outline, r); return c.length ? polygonArea(c) : 0; };
  let rects = pieces(b, rand).filter(r => area(r) > 1e-6);
  for (let merged = true; merged;) {
    merged = false;
    for (const r of rects) {
      if (area(r) >= small) continue;
      const side = rects.filter(n => n !== r && ((n[1] === r[1] && n[3] === r[3] && (n[2] === r[0] || n[0] === r[2])) || (n[0] === r[0] && n[2] === r[2] && (n[3] === r[1] || n[1] === r[3]))));
      if (!side.length) continue;
      const n = side.reduce((m, x) => (area(x) > area(m) ? x : m)), u: Rect = [Math.min(r[0], n[0]), Math.min(r[1], n[1]), Math.max(r[2], n[2]), Math.max(r[3], n[3])];
      rects = [...rects.filter(x => x !== r && x !== n), u];
      merged = true;
      break;
    }
  }
  rects.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const rooms: Room[] = [];
  for (const r of rects) {
    const clip = clipToRect(outline, r);
    if (!clip.length || polygonArea(clip) < small) continue;
    const id = `${b.id}-${rooms.length + 1}`, whole = Math.abs(polygonArea(clip) - (r[2] - r[0]) * (r[3] - r[1])) < 1e-6;
    rooms.push(whole ? { id, shape: 'rect', x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1], origin } : { id, shape: 'poly', points: clip, ...polyBox(clip), origin });
  }
  // the rooms that share a wall a cell or more long, joined by a spanning tree and then a share of the rest
  const outlines = rooms.map(r => roomOutline(r)), pairs: [number, number][] = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++)
    if (sharedEdges(outlines[i], outlines[j]).some(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= 1 - 1e-6)) pairs.push([i, j]);
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  const group = rooms.map((_, i) => i), find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  const tree = new Set<number>(), extra = b.doors ?? 0.25;
  pairs.forEach(([i, j], k) => { if (find(i) !== find(j)) { group[find(i)] = find(j); tree.add(k); } });
  const used = pairs.filter((_, k) => tree.has(k) || rand() < extra);
  const kind = (): Connection['kind'] => { const t = rand(); return t < 0.12 ? 'open' : t < 0.2 ? 'secret' : undefined; };
  const connections = used.map(([i, j]) => { const k = kind(); return { a: rooms[i].id, b: rooms[j].id, ...(k && { kind: k }), origin } as Connection; });
  return { rooms, connections };
}

/**
 * The dungeon with block `id` split again: the rooms and connections of its origin replaced where the first of them
 * stood (new ones at the end), every other entry left as it was. Corridors and connections that ended at a room the
 * split no longer makes are dropped, and reported.
 */
export function applyBlock(spec: DungeonSpec, id: string): { spec: DungeonSpec; dropped: string[] } {
  const b = spec.blocks?.find(x => x.id === id);
  if (!b) throw new Error(`no block ${id} (have: ${(spec.blocks ?? []).map(x => x.id).join(', ') || 'none'})`);
  const origin = `block:${id}`, made = splitBlock(b), out = structuredClone(spec);
  const replace = <T extends { origin?: string }>(list: T[], fresh: T[]): T[] => {
    const at = list.findIndex(e => e.origin === origin), rest = list.filter(e => e.origin !== origin);
    const pos = at < 0 ? rest.length : list.slice(0, at).filter(e => e.origin !== origin).length;
    return [...rest.slice(0, pos), ...fresh, ...rest.slice(pos)];
  };
  out.rooms = replace(out.rooms, made.rooms);
  const ids = new Set(out.rooms.map(r => r.id)), dropped: string[] = [];
  const conns = replace(out.connections ?? [], made.connections).filter(c => {
    if (ids.has(c.a) && ids.has(c.b)) return true;
    dropped.push(`connection ${c.a} ↔ ${c.b}: ${ids.has(c.a) ? c.b : c.a} is gone`);
    return false;
  });
  if (conns.length) out.connections = conns; else delete out.connections;
  const kept = out.corridors.filter(c => {
    const gone = [c.from, c.to].find(e => 'room' in e && !ids.has(e.room)) as { room: string } | undefined;
    if (gone) dropped.push(`corridor ${'room' in c.from ? c.from.room : 'from a point'} → ${'room' in c.to ? c.to.room : 'a point'}: ${gone.room} is gone`);
    return !gone;
  });
  out.corridors = withoutDangling(kept);
  if (out.corridors.length < kept.length) dropped.push(`${kept.length - out.corridors.length} corridor(s) that joined those`);
  return { spec: out, dropped };
}

/** Remove a block, its rooms and connections, and the corridors to those rooms (in place). */
export function removeBlock(spec: DungeonSpec, id: string): void {
  const origin = `block:${id}`, gone = new Set(spec.rooms.filter(r => r.origin === origin).map(r => r.id));
  spec.blocks = (spec.blocks ?? []).filter(b => b.id !== id);
  if (!spec.blocks.length) delete spec.blocks;
  spec.rooms = spec.rooms.filter(r => !gone.has(r.id));
  if (spec.connections) { spec.connections = spec.connections.filter(c => !gone.has(c.a) && !gone.has(c.b)); if (!spec.connections.length) delete spec.connections; }
  spec.corridors = withoutDangling(spec.corridors.filter(c => ![c.from, c.to].some(e => 'room' in e && gone.has(e.room))));
}

/** The block's room nearest a point (a corridor to the block runs to it). */
export function blockRoomNear(spec: DungeonSpec, id: string, x: number, y: number): string | null {
  const own = spec.rooms.filter(r => r.origin === `block:${id}`);
  if (!own.length) return null;
  return own.reduce((m, r) => (Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) < Math.hypot(m.x + m.w / 2 - x, m.y + m.h / 2 - y) ? r : m)).id;
}
