/**
 * A level laid out from the bottom up (`dungeon layout --design d.json --nested`): top down, the design is a tree (the level,
 * its thematic blocks, each block's layouts, each layout's rooms); bottom up, each layout is laid out alone, small and fast,
 * and becomes one piece of the size it took; a block packs its pieces with a gap between them, places every room exactly
 * where its piece put it, keeps each piece's passages as drawn, and routes only the ways between pieces; the level does the
 * same with its blocks. Where a way between pieces finds no passage, the gap grows a lattice cell and the pieces are packed
 * and routed again. The size of everything comes out of the rooms.
 *
 * A way that leaves a piece is held to its edge while the piece is laid out: a small stand-in room on the far side of it,
 * which is dropped after, so the room it leaves from is not walled in by its neighbours.
 */
import { layoutGraph, type Graph, type GraphReport, type GraphRoom, type GraphWay } from './graph.ts';
import { expandDesign, type Design, type DesignBlock, type ExpandReport, type Layout } from './design.ts';
import type { DoorKind, DungeonSpec } from './spec.ts';

/** A piece of the level as laid out: its size (cells), each room's box in it, and the passages drawn in it. */
interface Piece {
  id: string; w: number; h: number;
  rooms: Map<string, { x: number; y: number; w: number; h: number; points?: number[]; /** Turned a quarter (or three): a hexagon's lie flips. */ turned?: boolean }>;
  vias: { a: string; b: string; via: number[]; ports?: [number, number, number, number]; doors: [DoorKind | null, DoorKind | null]; natural: boolean }[];
  /** For a way that leaves the piece (`a|b`, sorted), the bearing from the piece's centre to where it leaves. */
  exits: Map<string, number>;
}
/** What one piece's solve did: its kind, rooms, size, the gap its children were packed with, and the ways it left unrouted. */
export interface NestedStep { id: string; kind: 'layout' | 'block' | 'level' | 'room'; rooms: number; size: [number, number]; gap?: number; tries: number; left: string[]; seconds: number }
export interface NestedReport { steps: NestedStep[]; design: ExpandReport; final: GraphReport }

const idOf = (code: string) => code.replace(/[^\w-]+/g, '-');
/** Settings each part's graph takes from the level's. */
const SETTINGS = ['width', 'scale', 'pad', 'passages', 'spokes', 'clearance', 'detour', 'seed', 'tries', 'reach', 'style', 'legend', 'title', 'margin', 'fill'] as const;
const GROWS = 4, REROUTES = 3, PACKINGS = 3, LEAF_SEEDS = 6, REVISIONS = 2;

/** Rooms and passages of a laid-out graph, in its own frame (cells), the box round them moved to start at 0, 0 on the lattice. */
function pieceOf(id: string, spec: DungeonSpec, report: GraphReport, g: Graph, keep: Set<string>, extent: Set<string> = keep): Piece {
  const width = g.width ?? 2, margin = g.margin ?? 2, [ox, oy] = report.origin, back = new Map(g.rooms.map(r => [idOf(r.id), r.id]));
  const fx = (v: number) => v - margin + ox, fy = (v: number) => v - margin + oy;
  const rooms = new Map<string, { x: number; y: number; w: number; h: number; points?: number[] }>(), extra: { x: number; y: number; w: number; h: number }[] = [];
  report.places.forEach((p, i) => {
    if (!keep.has(p.id)) { if (extent.has(p.id)) extra.push(p); return; }
    const r = spec.rooms[i];
    rooms.set(p.id, { x: p.x, y: p.y, w: p.w, h: p.h, ...(r.points && { points: r.points.map((v, k) => (k % 2 ? v - (r.y + r.h / 2) : v - (r.x + r.w / 2))) }) });
  });
  const vias: Piece['vias'] = [], lanes: number[][] = [];
  for (const c of spec.corridors) {
    if (!('room' in c.from) || !('room' in c.to)) continue;
    const a = back.get(c.from.room)!, b = back.get(c.to.room)!;
    if (!keep.has(a) || !keep.has(b)) {
      if (!extent.has(a) || !extent.has(b)) continue;
      // the lane from the room's door (its port) through the bends to the stand-in's
      const pts = [...(c.from.port ?? []), ...(c.via ?? []), ...(c.to.port ?? [])].map((v, k) => (k % 2 ? fy(v) : fx(v)));
      lanes.push(pts);
      continue;
    }
    const pa = c.from.port, pb = c.to.port, ports = pa && pb ? [fx(pa[0]), fy(pa[1]), fx(pb[0]), fy(pb[1])] as [number, number, number, number] : undefined;
    vias.push({ a, b, via: (c.via ?? []).map((v, k) => (k % 2 ? fy(v) : fx(v))), ...(ports && { ports }), doors: c.doors ?? [null, null], natural: c.style === 'natural' });
  }
  // the box round the rooms and passages, its corner on the lattice
  const xs: number[] = [], ys: number[] = [];
  for (const r of rooms.values()) xs.push(r.x, r.x + r.w), ys.push(r.y, r.y + r.h);
  // the box holds the ways out too (the stand-ins and the lanes to them), so a neighbour is not packed over them
  for (const r of extra) xs.push(r.x, r.x + r.w), ys.push(r.y, r.y + r.h);
  for (const v of [...vias.map(v => v.via), ...lanes]) for (let k = 0; k < v.length; k += 2) xs.push(v[k] - width / 2, v[k] + width / 2), ys.push(v[k + 1] - width / 2, v[k + 1] + width / 2);
  const x0 = Math.floor(Math.min(...xs) / width) * width, y0 = Math.floor(Math.min(...ys) / width) * width;
  const w = Math.ceil((Math.max(...xs) - x0) / width) * width, h = Math.ceil((Math.max(...ys) - y0) / width) * width;
  for (const r of rooms.values()) { r.x -= x0; r.y -= y0; }
  for (const v of vias) { v.via = v.via.map((u, k) => (k % 2 ? u - y0 : u - x0)); if (v.ports) v.ports = v.ports.map((u, k) => (k % 2 ? u - y0 : u - x0)) as [number, number, number, number]; }
  return { id, w, h, rooms, vias, exits: new Map() };
}

/**
 * The rooms of `need` that cannot reach the space outside their piece: the lattice cells round the piece's box, flooded
 * inward through every cell that no room and no passage of the piece takes. A room walled in by its neighbours (or with its
 * way out in a pocket between them) can be joined to nothing beyond the piece.
 */
function walledIn(p: Piece, need: Set<string>, width: number): string[] {
  const W = Math.ceil(p.w / width) + 2, H = Math.ceil(p.h / width) + 2, blocked = new Uint8Array(W * H), seen = new Uint8Array(W * H);
  const cell = (x: number, y: number) => (Math.floor(y / width) + 1) * W + Math.floor(x / width) + 1;
  for (const r of p.rooms.values()) for (let y = r.y; y < r.y + r.h - 1e-6; y += width) for (let x = r.x; x < r.x + r.w - 1e-6; x += width) blocked[cell(x, y)] = 1;
  for (const v of p.vias) for (let k = 0; k + 3 < v.via.length; k += 2) {
    const [ax, ay, bx, by] = v.via.slice(k, k + 4), n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (width / 2)));
    for (let t = 0; t <= n; t++) blocked[cell(ax + ((bx - ax) * t) / n, ay + ((by - ay) * t) / n)] = 1;
  }
  const stack: number[] = [];
  for (let i = 0; i < W; i++) stack.push(i, (H - 1) * W + i);
  for (let j = 0; j < H; j++) stack.push(j * W, j * W + W - 1);
  while (stack.length) {
    const k = stack.pop()!;
    if (k < 0 || k >= W * H || seen[k] || blocked[k]) continue;
    seen[k] = 1;
    const i = k % W;
    stack.push(k - W, k + W);
    if (i > 0) stack.push(k - 1);
    if (i < W - 1) stack.push(k + 1);
  }
  const out: string[] = [];
  for (const id of need) {
    const r = p.rooms.get(id);
    if (!r) continue;
    let open = false;
    for (let y = r.y; y < r.y + r.h - 1e-6 && !open; y += width) open = !!seen[cell(r.x - width, y)] || !!seen[cell(r.x + r.w, y)];
    for (let x = r.x; x < r.x + r.w - 1e-6 && !open; x += width) open = !!seen[cell(x, r.y - width)] || !!seen[cell(x, r.y + r.h)];
    if (!open) out.push(id);
  }
  return out;
}

/**
 * A piece turned `k` quarter turns clockwise, after a mirror east to west when `mirror`: every room's box and outline, every
 * passage and its doors, and the bearings of its ways out turn with it.
 */
function turnPiece(p: Piece, k: number, mirror: boolean): Piece {
  if (!k && !mirror) return p;
  let w = p.w, h = p.h;
  // a point in the piece, and a size, through the mirror and the turns
  const steps = (x: number, y: number): [number, number] => {
    let X = mirror ? p.w - x : x, Y = y, W = p.w, H = p.h;
    for (let i = 0; i < k; i++) { [X, Y] = [H - Y, X]; [W, H] = [H, W]; }
    return [X, Y];
  };
  const rel = (x: number, y: number): [number, number] => { let X = mirror ? -x : x, Y = y; for (let i = 0; i < k; i++) [X, Y] = [-Y, X]; return [X, Y]; };
  for (let i = 0; i < k; i++) [w, h] = [h, w];
  const pts = (v: number[]) => { const out: number[] = []; for (let i = 0; i + 1 < v.length; i += 2) out.push(...steps(v[i], v[i + 1])); return out; };
  const rooms = new Map([...p.rooms].map(([id, r]) => {
    const [ax, ay] = steps(r.x, r.y), [bx, by] = steps(r.x + r.w, r.y + r.h);
    const points = r.points ? (() => { const o: number[] = []; for (let i = 0; i + 1 < r.points!.length; i += 2) o.push(...rel(r.points![i], r.points![i + 1])); return o; })() : undefined;
    return [id, { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), ...(points && { points }), turned: (!!r.turned) !== (k % 2 === 1) }];
  }));
  const vias = p.vias.map(v => ({ ...v, via: pts(v.via), ...(v.ports && { ports: pts(v.ports) as [number, number, number, number] }) }));
  const exits = new Map([...p.exits].map(([key, b]) => [key, ((mirror ? 360 - b : b) + 90 * k) % 360]));
  return { id: p.id, w, h, rooms, vias, exits };
}

/** Degrees clockwise from north of a displacement east and south. */
const bearingTo = (dx: number, dy: number) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
/** The mean of two bearings. */
const meanBearing = (a: number, b: number) => (bearingTo(Math.sin((a * Math.PI) / 180) + Math.sin((b * Math.PI) / 180), -(Math.cos((a * Math.PI) / 180) + Math.cos((b * Math.PI) / 180))) + 360) % 360;
const keyOf = (a: string, b: string) => [a, b].sort().join('|');

/**
 * Lay a design out from the bottom up: each layout alone, then each block of its layouts (and rooms, and blocks), then the
 * level of its blocks, each placing its pieces and routing only the ways between them, the gap between pieces growing where
 * a way finds no passage. The design's `footprint`, `origin`, pins (`over`) and places (`at`) are not used: the size comes
 * out of the rooms.
 */
export function layoutNested(d: Design, library: Layout[] = []): { spec: DungeonSpec; report: NestedReport } {
  const { graph: g, report: design } = expandDesign(d, library);
  const width = g.width ?? 2, settings: Partial<Graph> = Object.fromEntries(SETTINGS.filter(k => g[k] !== undefined).map(k => [k, g[k]]));
  const roomById = new Map(g.rooms.map(r => [r.id, r])), steps: NestedStep[] = [];
  const useRooms = new Map(design.uses.map(u => [u.id, u.rooms]));
  // the tree: a block's rooms are its uses' rooms, its own, and its blocks'; the level holds what no block does
  type Node = { id: string; kind: NestedStep['kind']; rooms?: string[]; children: Node[] };
  const claimed = new Set<string>();
  const leaf = (u: string): Node => { const rs = useRooms.get(u); if (!rs) throw new Error(`blocks: no use ${u}`); rs.forEach(r => claimed.add(r)); return { id: u, kind: 'layout', rooms: rs, children: [] }; };
  const single = (r: string): Node => { if (!roomById.has(r)) throw new Error(`blocks: no room ${r}`); claimed.add(r); return { id: r, kind: 'room', rooms: [r], children: [] }; };
  const block = (b: DesignBlock): Node => ({ id: b.id, kind: 'block', children: [...(b.blocks ?? []).map(block), ...(b.uses ?? []).map(leaf), ...(b.rooms ?? []).map(single)] });
  const top: Node = { id: g.id ?? 'level', kind: 'level', children: (d.blocks ?? []).map(block) };
  for (const u of design.uses) if (!u.rooms.some(r => claimed.has(r))) top.children.push(leaf(u.id));
  for (const r of g.rooms) if (!claimed.has(r.id)) top.children.push(single(r.id));
  // in the level and in each block, a room that stands alone joins the layout beside it that it shares most ways with (the
  // smaller on a tie, and through rooms that joined one before it), so each part is a few pieces; one that joins none stays
  const attach = (n: Node) => {
    n.children.forEach(attach);
    const layouts = n.children.filter(c => c.kind === 'layout'), owner = new Map<string, Node>();
    for (const c of layouts) for (const r of c.rooms!) owner.set(r, c);
    for (let moved = true; moved;) {
      moved = false;
      for (const c of n.children) {
        if (c.kind !== 'room') continue;
        const r = c.rooms![0], votes = new Map<Node, number>();
        for (const w of g.ways) { const o = w.a === r ? w.b : w.b === r ? w.a : null, to = o ? owner.get(o) : undefined; if (to) votes.set(to, (votes.get(to) ?? 0) + 1); }
        const pick = [...votes].sort((x, y) => y[1] - x[1] || x[0].rooms!.length - y[0].rooms!.length)[0];
        if (!pick) continue;
        pick[0].rooms = [...pick[0].rooms!, r]; owner.set(r, pick[0]); c.kind = 'joined' as NestedStep['kind']; moved = true;
      }
    }
    n.children = n.children.filter(c => (c.kind as string) !== 'joined');
  };
  attach(top);
  const membersOf = (n: Node): string[] => n.rooms ?? n.children.flatMap(membersOf);
  const wayOf = (a: string, b: string) => g.ways.find(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));

  /** A layout alone: its rooms, the ways between them, and a stand-in beyond each way that leaves it. */
  const solveLeaf = (n: Node): Piece => {
    const mine = new Set(n.rooms!), t0 = Date.now();
    if (mine.size === 1) {
      const r = roomById.get(n.rooms![0])!;
      return { id: n.id, w: Math.ceil(r.w / width) * width, h: Math.ceil(r.h / width) * width, rooms: new Map([[r.id, { x: 0, y: 0, w: r.w, h: r.h }]]), vias: [], exits: new Map() };
    }
    const rooms: GraphRoom[] = n.rooms!.map(id => { const { at: _a, over: _o, ...r } = roomById.get(id)!; return r; });
    const ways: GraphWay[] = g.ways.filter(w => mine.has(w.a) && mine.has(w.b)).map(w => ({ ...w }));
    let k = 0;
    const standFor = new Map<string, string>();
    for (const w of g.ways) {
      const inA = mine.has(w.a), inB = mine.has(w.b);
      if (inA === inB) continue;
      const room = inA ? w.a : w.b, stand = `__out${++k}`, bearing = w.bearing === undefined ? undefined : inA ? w.bearing : (w.bearing + 180) % 360;
      rooms.push({ id: stand, w: width, h: width, label: '' });
      standFor.set(stand, keyOf(w.a, w.b));
      ways.push({ a: room, b: stand, run: 'passage', ...(bearing !== undefined && { bearing }), ...((inA ? w.wall : w.wallB) !== undefined && { wall: inA ? w.wall : w.wallB }) });
    }
    // a room whose way out finds no passage would be walled in by its own piece: such a layout is laid out again from other
    // seeds, and the one that leaves fewest ways (its ways out first) is kept
    // the shape the layout keeps: its lines and mirrors, among its own rooms
    const lines = (g.lines ?? []).map(l => ({ ...l, rooms: l.rooms.filter(r => mine.has(r)) })).filter(l => l.rooms.length >= 2);
    const mirrors = (g.mirrors ?? []).filter(m => mine.has(m.a) && mine.has(m.b) && mine.has(m.about));
    const sub: Graph = { ...settings, id: n.id, rooms, ways, partial: true, ...(lines.length && { lines }), ...(mirrors.length && { mirrors }) }, leaving = new Set([...standFor.values()].flatMap(k => k.split('|')).filter(r => mine.has(r)));
    const tryLeaf = (seed?: number) => {
      const r = layoutGraph(seed === undefined ? sub : { ...sub, seed }), piece = pieceOf(n.id, r.spec, r.report, sub, mine, new Set(rooms.map(x => x.id)));
      return { ...r, piece, closed: walledIn(piece, leaving, width) };
    };
    // rooms walled in first, then ways left
    // a layout laid out again (its ways at the level found no passage) starts from seeds it has not tried
    const v = variant.get(n.id) ?? 0, seedOf = (k: number) => (k === 0 && v === 0 ? undefined : (g.seed ?? 1) + 7919 * (k + v * LEAF_SEEDS));
    let run = tryLeaf(seedOf(0));
    for (let k = 1; k < LEAF_SEEDS && (run.closed.length || run.report.left.length); k++) {
      const next = tryLeaf(seedOf(k));
      if (next.closed.length < run.closed.length || (next.closed.length === run.closed.length && next.report.left.length < run.report.left.length)) run = next;
    }
    const { report } = run, out = (x: string) => x.replace(/ to __out\d+$/, ' (its way out of the piece)').replace(/^__out\d+ to /, '');
    steps.push({ id: n.id, kind: 'layout', rooms: mine.size, size: [0, 0], tries: report.routed, left: [...report.left.map(out), ...run.closed.map(r => `${r} (walled in: no way out of the piece)`)], seconds: (Date.now() - t0) / 1000 });
    const piece = run.piece;
    // each way out leaves towards its stand-in
    const box = (id: string) => report.places.find(p => p.id === id)!, xs = [...piece.rooms.keys()].map(box);
    const cx = (Math.min(...xs.map(p => p.x)) + Math.max(...xs.map(p => p.x + p.w))) / 2, cy = (Math.min(...xs.map(p => p.y)) + Math.max(...xs.map(p => p.y + p.h))) / 2;
    for (const [stand, key] of standFor) { const p = box(stand); piece.exits.set(key, bearingTo(p.cx - cx, p.cy - cy)); }
    steps[steps.length - 1].size = [piece.w, piece.h];
    return piece;
  };

  /** A block (or the level): its pieces packed with a gap, every room placed, the pieces' passages kept, the ways between them routed. */
  const solve = (n: Node): Piece => {
    if (n.kind === 'layout' || n.kind === 'room') return solveLeaf(n);
    // where ways between pieces stay unrouted, the layouts that hold their rooms are laid out again, and the pieces packed again
    let kept: ReturnType<typeof assemble> = null;
    for (let round = 0; round <= REVISIONS; round++) {
      const got = assemble(n, round === 0 ? undefined : kept!.pieces);
      if (got && (!kept || got.best.left.length < kept.best.left.length)) kept = got;
      if (!kept || !kept.best.left.length || round === REVISIONS) break;
      const stuck = new Set(kept.best.left.flatMap(x => x.split(' to ')));
      const leaves = (m: Node): Node[] => (m.kind === 'layout' ? [m] : m.children.flatMap(leaves));
      const redo = leaves(n).filter(l => l.rooms!.some(r => stuck.has(r)));
      if (!redo.length) break;
      for (const l of redo) variant.set(l.id, (variant.get(l.id) ?? 0) + 1);
      // the children that hold a layout laid out again are solved again; the rest keep their pieces
      lastRedo.set(n.id, new Set(n.children.filter(c => leaves(c).some(l => redo.includes(l))).map(c => c.id)));
    }
    if (!kept) throw new Error(`nested layout: ${n.id}'s pieces could not be packed`);
    const { best, t0 } = kept;
    steps.push({ id: n.id, kind: n.kind, rooms: membersOf(n).length, size: [best.piece.w, best.piece.h], gap: best.gap, tries: 1, left: best.left, seconds: (Date.now() - t0) / 1000 });
    if (n.kind === 'level') finalSpec = { spec: best.spec, report: best.report };
    return best.piece;
  };
  /** One packing of a node's pieces, grown until its ways route: its pieces (solved, or kept from before) and the best result. */
  const assemble = (n: Node, before?: Map<string, Piece>): { pieces: Map<string, Piece>; best: { piece: Piece; left: string[]; gap: number; spec: DungeonSpec; report: GraphReport }; t0: number } | null => {
    const t0 = Date.now(), redo = lastRedo.get(n.id);
    const pieces = n.children.map(c => (before?.has(c.id) && !redo?.has(c.id) ? before.get(c.id)! : solve(c))), owner = new Map<string, Piece>();
    for (const p of pieces) for (const r of p.rooms.keys()) owner.set(r, p);
    const cross = g.ways.filter(w => owner.has(w.a) && owner.has(w.b) && owner.get(w.a) !== owner.get(w.b));
    /** The bearing from a piece's centre to one of its rooms (none when the room is the piece). */
    const toward = (p: Piece, room: string): number | undefined => { const r = p.rooms.get(room)!, dx = r.x + r.w / 2 - p.w / 2, dy = r.y + r.h / 2 - p.h / 2; return Math.hypot(dx, dy) < width ? undefined : bearingTo(dx, dy); };
    const mine = new Set(owner.keys());
    let best: { piece: Piece; left: string[]; gap: number; spec: DungeonSpec; report: GraphReport } | null = null;
    const gaps: [number, number][] = [];
    for (let grow = 0, gap = Math.max(width, Math.ceil((g.pad ?? 0) / width) * width); grow <= GROWS; grow++, gap += width) for (let k = 0; k < PACKINGS; k++) gaps.push([grow, gap]);
    for (let t = 0; t < gaps.length; t++) {
      const [grow, gap] = gaps[t], packSeed = (g.seed ?? 1) * 100 + t;
      /** The pieces as boxes, packed with the gap between them: the ways between them as ways between boxes, on their exits' bearings. */
      const pack = (pcs: Piece[]): GraphReport | null => {
        const own = new Map<string, Piece>();
        for (const p of pcs) for (const r of p.rooms.keys()) own.set(r, p);
        const boxes: GraphRoom[] = pcs.map(p => ({ id: `__piece_${p.id}`, w: p.w, h: p.h, label: '' }));
        const seen = new Set<string>(), up: GraphWay[] = [];
        for (const w of cross) {
          const pa = own.get(w.a)!, pb = own.get(w.b)!, a = `__piece_${pa.id}`, b = `__piece_${pb.id}`, key = [a, b].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          // the two pieces lie the way their ways out face: from a's exit, and back along b's
          const ea = pa.exits.get(keyOf(w.a, w.b)) ?? toward(pa, w.a), eb = pb.exits.get(keyOf(w.a, w.b)) ?? toward(pb, w.b);
          const bearing = ea !== undefined && eb !== undefined ? meanBearing(ea, (eb + 180) % 360) : ea ?? (eb !== undefined ? (eb + 180) % 360 : w.bearing);
          up.push({ a, b, run: 'passage', ...(bearing !== undefined && { bearing }) });
        }
        const top = n.kind === 'level' && g.footprint !== undefined && grow === 0;
        try { return layoutGraph({ ...settings, id: `${n.id}-pieces`, rooms: boxes, ways: up, pad: gap / 2, partial: true, seed: packSeed, ...(top && { footprint: g.footprint }) }).report; }
        catch { return null; }
      };
      let pcs = pieces, packed = pack(pcs);
      if (!packed) continue;
      // each piece turned (and mirrored) the way that points its ways out at the pieces they join, then packed again
      const centre = new Map(packed.places.map(p => [p.id.slice('__piece_'.length), [p.cx, p.cy] as [number, number]]));
      let turnedAny = false;
      pcs = pcs.map(p => {
        const toward2: [string, number][] = [];
        for (const w of cross) {
          const inA = p.rooms.has(w.a), inB = p.rooms.has(w.b);
          if (inA === inB) continue;
          const other = pieces.find(q => q.rooms.has(inA ? w.b : w.a))!, [cx, cy] = centre.get(p.id)!, [ox2, oy2] = centre.get(other.id)!;
          toward2.push([keyOf(w.a, w.b), bearingTo(ox2 - cx, oy2 - cy)]);
        }
        if (!toward2.length) return p;
        let bestP = p, bestS = -Infinity;
        for (const mirror of [false, true]) for (let k = 0; k < 4; k++) {
          const q = turnPiece(p, k, mirror), on = (v: number) => Math.abs(v / width - Math.round(v / width)) < 1e-6;
          // a room an odd number of cells across would leave the lattice: such a lie is not taken
          if (![...q.rooms.values()].every(r => on(r.x) && on(r.y))) continue;
          let sc = 0;
          for (const [key, want] of toward2) { const e = q.exits.get(key) ?? (() => { const r = [...q.rooms].find(([id]) => key.split('|').includes(id))![1]; return bearingTo(r.x + r.w / 2 - q.w / 2, r.y + r.h / 2 - q.h / 2); })(); sc += Math.cos(((e - want) * Math.PI) / 180); }
          if (sc > bestS + 1e-6) { bestS = sc; bestP = q; }
        }
        if (bestP !== p) turnedAny = true;
        return bestP;
      });
      if (turnedAny) { const again = pack(pcs); if (!again) continue; packed = again; }
      // every room where its piece put it, on a frame that starts a gap out from the pieces
      const at = new Map(packed.places.map(p => [p.id.slice('__piece_'.length), p]));
      const xs = packed.places.map(p => p.x), ys = packed.places.map(p => p.y);
      const ox = Math.floor((Math.min(...xs) - gap) / width) * width, oy = Math.floor((Math.min(...ys) - gap) / width) * width;
      const side = Math.ceil((Math.max(...packed.places.map(p => Math.max(p.x + p.w - ox, p.y + p.h - oy))) + gap) / width) * width;
      const rooms: GraphRoom[] = [], ways: GraphWay[] = [], given = new Set<string>();
      for (const p of pcs) {
        const pl = at.get(p.id)!;
        for (const [id, r] of p.rooms) {
          const { against: _g, over: _o, turns: _t, ...base } = roomById.get(id)!;
          // a hexagon turned a quarter lies the other way
          const draw = r.turned && base.shape === 'hexagon' ? { ...base.draw, orient: (base.draw?.orient === 'pointy' ? 'flat' : 'pointy') as 'flat' | 'pointy' } : base.draw;
          rooms.push({ ...base, ...(draw && { draw }), w: r.w, h: r.h, ...(r.points && { points: r.points }), at: { x: pl.x + r.x, y: pl.y + r.y } });
        }
        for (const v of p.vias) {
          given.add([v.a, v.b].sort().join('|'));
          const w = wayOf(v.a, v.b);
          ways.push({ ...(w?.draw && { draw: w.draw }), a: v.a, b: v.b, via: v.via.map((u, k) => u + (k % 2 ? pl.y : pl.x)), ...(v.ports && { ports: v.ports.map((u, k) => u + (k % 2 ? pl.y : pl.x)) as [number, number, number, number] }), doors: v.doors, ...(v.natural && { style: 'natural' as const }) });
        }
      }
      for (const w of g.ways) if (mine.has(w.a) && mine.has(w.b) && !given.has([w.a, w.b].sort().join('|'))) { const { via: _v, ...rest } = w; ways.push(rest); }
      // every room is placed, so routing again is cheap: the ways that found no passage go first, a few times over
      let out: { spec: DungeonSpec; report: GraphReport } | null = null, first: [string, string][] = [];
      for (let again = 0; again <= REROUTES; again++) {
        let next: { spec: DungeonSpec; report: GraphReport };
        // after the first try, a way that still finds no passage may cross another, as a crossroads
        try { next = layoutGraph({ ...settings, spokes: true, id: n.id, rooms, ways, footprint: side, origin: [ox, oy], partial: true, tries: 1, ...(first.length && { routeFirst: first }), ...(again >= 1 && { crossings: true }) }); }
        catch { break; }
        if (!out || next.report.left.length < out.report.left.length) out = next;
        if (!next.report.left.length) break;
        first = [...next.report.left.map(x => x.split(' to ') as [string, string]), ...first.filter(f => !next.report.left.includes(f.join(' to ')))];
      }
      if (!out) continue;
      const left = out.report.left, piece = pieceOf(n.id, out.spec, out.report, { ...settings, rooms, ways, margin: g.margin }, mine);
      if (!best || left.length < best.left.length) best = { piece, left, gap, spec: out.spec, report: out.report };
      if (!left.length) break;
    }
    if (!best) return null;
    return { pieces: new Map(n.children.map((c, i) => [c.id, pieces[i]])), best, t0 };
  };
  let finalSpec: { spec: DungeonSpec; report: GraphReport } | null = null;
  const variant = new Map<string, number>(), lastRedo = new Map<string, Set<string>>();
  solve(top);
  const f = finalSpec as { spec: DungeonSpec; report: GraphReport } | null;
  if (!f) throw new Error('nested layout: nothing laid out');
  return { spec: f.spec, report: { steps, design, final: f.report } };
}
