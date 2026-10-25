/**
 * Building interiors from the footprint: each floor split into rooms that share walls (the dungeon's block split), a
 * door on the side facing the nearest road, windows along the outer walls, stairs at the same spot on every floor
 * they join, and furniture laid out by what each room is for (a house's hall gets a hearth, a table and benches; an
 * inn's taproom a bar, tables and stools; a temple's nave an altar and rows of pews). Seeded from the building's id,
 * so a building keeps its plan when others change; everything written carries `origin: "gen"`.
 */
import { rng } from '../lib/rng.ts';
import { idSeed, inPolygon, roomOutline } from '../dungeon/layout.ts';
import { nearestOnLine, polygonArea, sharedEdges } from '../dungeon/geom.ts';
import { splitBlock } from '../dungeon/blocks.ts';
import type { Block, Connection, Room } from '../dungeon/spec.ts';
import { FIXTURES } from './fixtures.ts';
import { buildingWings, layoutFloor, planOutline, planToSite, roadWidth } from './layout.ts';
import { planFactor, type Building, type BuildingKind, type Fixture, type Floor, type SettlementSpec } from './spec.ts';

const ORIGIN = 'gen';

/** What each floor's rooms are for, largest room first: ground floor, the floors above (the last repeats), and a cellar (or none). */
const ROLES: Record<BuildingKind, { ground: string[]; upper: string[][]; cellar?: string[]; min: number; single?: boolean; stories: number }> = {
  house: { ground: ['hall', 'store'], upper: [['bedroom', 'bedroom']], min: 3, stories: 1 },
  cottage: { ground: ['cottage'], upper: [], min: 3, single: true, stories: 1 },
  shop: { ground: ['shop', 'store'], upper: [['bedroom', 'bedroom']], min: 3, stories: 2 },
  inn: { ground: ['taproom', 'kitchen', 'store'], upper: [['guest', 'guest', 'guest', 'guest']], cellar: ['cellar'], min: 3, stories: 2 },
  tavern: { ground: ['taproom', 'kitchen', 'store'], upper: [], cellar: ['cellar'], min: 3, stories: 1 },
  smithy: { ground: ['forge', 'store'], upper: [], min: 3, stories: 1 },
  temple: { ground: ['nave', 'vestry', 'store'], upper: [], min: 4, stories: 1 },
  chapel: { ground: ['nave'], upper: [], min: 4, single: true, stories: 1 },
  hall: { ground: ['great-hall', 'kitchen', 'store'], upper: [], min: 4, stories: 1 },
  barn: { ground: ['barn'], upper: [], min: 4, single: true, stories: 1 },
  stable: { ground: ['stable'], upper: [], min: 4, single: true, stories: 1 },
  mill: { ground: ['mill', 'store'], upper: [['store']], min: 3, stories: 2 },
  warehouse: { ground: ['warehouse', 'warehouse'], upper: [], min: 4, stories: 1 },
  keep: { ground: ['store', 'guard', 'store'], upper: [['great-hall'], ['lord', 'chamber']], cellar: ['cellar'], min: 3, stories: 3 },
  tower: { ground: ['guard'], upper: [['armoury'], ['chamber']], min: 3, single: true, stories: 3 },
  gatehouse: { ground: ['guard'], upper: [['winch']], min: 3, single: true, stories: 2 },
  barracks: { ground: ['barracks', 'mess'], upper: [], min: 4, stories: 1 },
  manor: { ground: ['great-hall', 'kitchen', 'study', 'store'], upper: [['lord', 'bedroom', 'bedroom']], cellar: ['cellar'], min: 3, stories: 2 },
  ruin: { ground: ['ruin'], upper: [], min: 4, stories: 1 },
};

/** The number of storeys a kind usually has. */
export const storiesOf = (kind: BuildingKind): number => ROLES[kind].stories;

/** Room names written on the plan. */
const ROOM_NAMES: Record<string, string> = {
  hall: 'Hall', store: 'Store', bedroom: 'Bedroom', cottage: 'Living room', shop: 'Shop', taproom: 'Taproom', kitchen: 'Kitchen', guest: 'Guest room',
  cellar: 'Cellar', forge: 'Forge', nave: 'Nave', vestry: 'Vestry', 'great-hall': 'Great hall', barn: 'Barn', stable: 'Stalls', mill: 'Mill room',
  warehouse: 'Warehouse', guard: 'Guard room', lord: "Lord's chamber", chamber: 'Chamber', armoury: 'Armoury', winch: 'Winch room', barracks: 'Barracks',
  mess: 'Mess', study: 'Study', ruin: 'Ruin',
};

type Where = 'wall' | 'far' | 'centre' | 'corner' | 'free' | 'rows' | 'feast' | 'under';
/** What goes in each room: [fixture kind, where, how many (default 1), chance (default 1)]. */
const FURNISH: Record<string, [string, Where, number?, number?][]> = {
  hall: [['fireplace', 'wall'], ['table', 'centre'], ['bench', 'wall'], ['chest', 'wall'], ['shelf', 'wall', 1, 0.6]],
  cottage: [['hearth', 'centre'], ['bed', 'wall'], ['table', 'wall'], ['stool', 'free', 2], ['chest', 'wall'], ['barrel', 'corner', 1, 0.6]],
  bedroom: [['bed', 'wall', 1], ['bed', 'wall', 1, 0.4], ['chest', 'wall'], ['wardrobe', 'wall', 1, 0.5]],
  store: [['barrel', 'corner', 2], ['crate', 'corner', 2], ['sacks', 'wall'], ['shelf', 'wall', 1, 0.6]],
  shop: [['counter', 'centre'], ['shelf', 'wall', 2], ['chest', 'wall'], ['crate', 'corner', 1, 0.6]],
  taproom: [['bar', 'far'], ['fireplace', 'wall'], ['table', 'free'], ['round-table', 'free', 2], ['stool', 'free', 3], ['bench', 'wall', 1, 0.6]],
  kitchen: [['oven', 'wall'], ['table', 'centre'], ['barrel', 'corner'], ['shelf', 'wall'], ['cauldron', 'free', 1, 0.6]],
  guest: [['bed', 'wall'], ['chest', 'wall'], ['stool', 'free', 1, 0.5]],
  cellar: [['barrel', 'wall', 4], ['crate', 'corner', 2], ['sacks', 'wall', 1, 0.7]],
  forge: [['forge', 'wall'], ['anvil', 'centre'], ['trough', 'wall'], ['weapon-rack', 'wall'], ['barrel', 'corner', 1, 0.6]],
  nave: [['altar', 'far'], ['pew', 'rows', 8], ['statue', 'corner', 2, 0.6]],
  vestry: [['chest', 'wall'], ['shelf', 'wall'], ['table', 'centre', 1, 0.6]],
  'great-hall': [['throne', 'far'], ['long-table', 'feast'], ['fireplace', 'wall'], ['rug', 'under', 1, 0.5]],
  barn: [['haystack', 'corner', 2], ['sacks', 'wall', 2], ['crate', 'corner'], ['cart', 'free', 1, 0.6]],
  stable: [['trough', 'wall', 2], ['haystack', 'corner'], ['sacks', 'wall']],
  mill: [['millstone', 'centre'], ['sacks', 'wall', 3], ['crate', 'corner']],
  warehouse: [['crate', 'corner', 4], ['barrel', 'wall', 3], ['sacks', 'wall', 2]],
  guard: [['table', 'centre'], ['stool', 'free', 2], ['weapon-rack', 'wall'], ['chest', 'wall'], ['bunk', 'wall', 1, 0.6]],
  barracks: [['bunk', 'rows', 8], ['chest', 'wall', 2], ['weapon-rack', 'wall']],
  mess: [['long-table', 'feast'], ['fireplace', 'wall'], ['barrel', 'corner']],
  lord: [['double-bed', 'wall'], ['wardrobe', 'wall'], ['chest', 'wall'], ['desk', 'wall'], ['rug', 'under'], ['bath', 'free', 1, 0.5]],
  chamber: [['bed', 'wall'], ['chest', 'wall'], ['desk', 'wall', 1, 0.6]],
  study: [['desk', 'wall'], ['bookcase', 'wall', 2], ['chair', 'free'], ['rug', 'under', 1, 0.6]],
  armoury: [['weapon-rack', 'wall', 3], ['chest', 'wall', 2], ['crate', 'corner']],
  winch: [['cauldron', 'centre'], ['weapon-rack', 'wall'], ['crate', 'corner']],
  ruin: [['crate', 'free', 1, 0.3]],
};

type Rect = { x: number; y: number; w: number; h: number };
const boxOf = (f: { x: number; y: number }, w: number, h: number, angle: number): Rect => {
  const turned = Math.abs(Math.round(angle / 90)) % 2 === 1, bw = turned ? h : w, bh = turned ? w : h;
  return { x: f.x - bw / 2, y: f.y - bh / 2, w: bw, h: bh };
};
const hits = (a: Rect, b: Rect, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The side of the footprint (n, e, s, w) facing the nearest road, or `s` when there is none. */
export function frontSide(spec: SettlementSpec, b: Building): 'n' | 'e' | 's' | 'w' {
  const f = planFactor(spec), W = b.w * f, H = b.h * f;
  const mids: ['n' | 'e' | 's' | 'w', number, number][] = [['n', W / 2, 0], ['e', W, H / 2], ['s', W / 2, H], ['w', 0, H / 2]];
  let best: 'n' | 'e' | 's' | 'w' = 's', bd = Infinity;
  for (const [side, px, py] of mids) {
    const [x, y] = planToSite(spec, b, px, py);
    for (const r of spec.roads) { if (r.kind === 'path' || r.kind === 'track') continue; const d = nearestOnLine(r.points, x, y).d - roadWidth(spec, r) / 2; if (d < bd) { bd = d; best = side; } }
  }
  return best;
}

/** Rooms for one floor: each wing split (or kept whole), joined where wings meet. */
function splitFloor(spec: SettlementSpec, b: Building, level: number, min: number, single: boolean, rand: () => number): { rooms: Room[]; connections: Connection[] } {
  const f = planFactor(spec), tag = level < 0 ? `c${-level}` : `f${level}`;
  const blocks: Block[] = [];
  if (b.shape === 'rect' || b.shape === 'L' || b.shape === 'T') buildingWings(b).forEach(([x, y, w, h], i) => blocks.push({ id: `${tag}${'abc'[i]}`, shape: 'rect', x: (x - b.x) * f, y: (y - b.y) * f, w: w * f, h: h * f, split: { mode: 'bsp', min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 }));
  else if (b.shape === 'poly') { const o = planOutline(spec, b), xs = o.filter((_, i) => i % 2 === 0), ys = o.filter((_, i) => i % 2 === 1); blocks.push({ id: `${tag}a`, shape: 'poly', points: o, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), split: { mode: 'bsp', min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 }); }
  else blocks.push({ id: `${tag}a`, shape: b.shape, x: 0, y: 0, w: b.w * f, h: b.h * f, split: { mode: 'bsp', min, seed: Math.floor(rand() * 1e9) }, doors: 0.25 });
  const rooms: Room[] = [], connections: Connection[] = [], wingRooms: Room[][] = [];
  for (const bl of blocks) {
    const whole = single || bl.w * bl.h < min * min * 2.2;
    const part = whole
      ? { rooms: [bl.shape === 'rect' ? { id: `${bl.id}-1`, shape: 'rect' as const, x: bl.x, y: bl.y, w: bl.w, h: bl.h } : { id: `${bl.id}-1`, shape: bl.shape === 'poly' ? 'poly' as const : bl.shape as Room['shape'], x: bl.x, y: bl.y, w: bl.w, h: bl.h, ...(bl.points && { points: bl.points }) }], connections: [] }
      : splitBlock(bl);
    wingRooms.push(part.rooms);
    rooms.push(...part.rooms);
    connections.push(...part.connections.map(c => ({ a: c.a, b: c.b, ...(c.kind && c.kind !== 'secret' && { kind: c.kind }) })));
  }
  // wings meet: one door between the pair of rooms with the longest shared wall
  for (let i = 1; i < wingRooms.length; i++) {
    let best: [Room, Room, number] | null = null;
    for (const a of wingRooms[0]) for (const c of wingRooms[i]) {
      const len = sharedEdges(roomOutline(a), roomOutline(c)).reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      if (len >= 1 && (!best || len > best[2])) best = [a, c, len];
    }
    if (best) connections.push({ a: best[0].id, b: best[1].id });
  }
  return { rooms: rooms.map(r => ({ ...r, x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h), origin: ORIGIN })), connections: connections.map(c => ({ ...c, origin: ORIGIN })) };
}

interface Placer { fixtures: Fixture[]; boxes: Rect[]; keepOut: { x: number; y: number }[] }

/** Try to put a fixture in a room; true when it found a spot. */
function place(pl: Placer, room: Room, outline: number[], kind: string, where: Where, rand: () => number, per: number, farFrom: { x: number; y: number } | null, size?: [number, number]): boolean {
  const fx = FIXTURES[kind];
  if (!fx) return false;
  let [fw, fh] = size ?? [fx.ft[0] / per, fx.ft[1] / per];
  const { x, y, w, h } = room, inset = 0.12;
  const cands: { x: number; y: number; angle: number }[] = [];
  const along = (n: number) => Array.from({ length: n }, () => 0.15 + rand() * 0.7);
  // a wall fixture lies with its long side on the wall; its back on the wall, `angle` turning its drawing to face in
  const wall = (side: 'n' | 's' | 'e' | 'w', t: number) => {
    if (side === 'n') return { x: x + w * t, y: y + inset + fh / 2, angle: 0 };
    if (side === 's') return { x: x + w * t, y: y + h - inset - fh / 2, angle: 180 };
    if (side === 'w') return { x: x + inset + fh / 2, y: y + h * t, angle: 270 };
    return { x: x + w - inset - fh / 2, y: y + h * t, angle: 90 };
  };
  const sides: ('n' | 's' | 'e' | 'w')[] = ['n', 's', 'e', 'w'];
  if (where === 'far' && farFrom) {
    // the wall farthest from the door, at its middle
    const far = sides.map(s => { const p = wall(s, 0.5); return { s, d: Math.hypot(p.x - farFrom.x, p.y - farFrom.y) }; }).sort((p, q) => q.d - p.d);
    for (const { s } of far) cands.push(wall(s, 0.5), ...along(3).map(t => wall(s, t)));
  } else if (where === 'wall' || where === 'far') for (const s of sides.sort(() => rand() - 0.5)) cands.push(...along(4).map(t => wall(s, t)));
  else if (where === 'corner') for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]].sort(() => rand() - 0.5)) cands.push({ x: x + inset + fw / 2 + cx * (w - 2 * inset - fw), y: y + inset + fh / 2 + cy * (h - 2 * inset - fh), angle: 0 });
  else if (where === 'centre' || where === 'under') { const turn = h > w * 1.2 ? 90 : 0; cands.push({ x: x + w / 2, y: y + h / 2, angle: turn }, ...Array.from({ length: 6 }, () => ({ x: x + w / 2 + (rand() - 0.5) * w * 0.3, y: y + h / 2 + (rand() - 0.5) * h * 0.3, angle: turn }))); }
  else for (let i = 0; i < 24; i++) cands.push({ x: x + 0.4 + rand() * (w - 0.8), y: y + 0.4 + rand() * (h - 0.8), angle: rand() < 0.5 ? 0 : 90 });
  for (const c of cands) {
    const bx = boxOf(c, fw, fh, c.angle), corners = [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]];
    if (!corners.every(([px, py]) => inPolygon(outline, px + (px < c.x ? 0.02 : -0.02), py + (py < c.y ? 0.02 : -0.02)))) continue;
    if (where !== 'under' && pl.boxes.some(o => hits(o, bx, 0.12))) continue;
    if (pl.keepOut.some(k => k.x > bx.x - 0.7 && k.x < bx.x + bx.w + 0.7 && k.y > bx.y - 0.7 && k.y < bx.y + bx.h + 0.7)) continue;
    pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), ...(size && { w: r2(fw), h: r2(fh) }), ...(c.angle && { angle: c.angle }), origin: ORIGIN });
    if (where !== 'under') pl.boxes.push(bx);
    return true;
  }
  return false;
}

/** Rows of a fixture across the room's long axis, two to a row with an aisle down the middle (pews, bunks). */
function rows(pl: Placer, room: Room, kind: string, n: number, per: number, door: { x: number; y: number } | null): void {
  const fx = FIXTURES[kind], long = room.w >= room.h, L = long ? room.w : room.h, S = long ? room.h : room.w, aisle = 1;
  const len = Math.min(fx.ft[0] / per, (S - aisle - 0.4) / 2), depth = fx.ft[1] / per, step = depth + (kind === 'bunk' ? 0.6 : 0.5);
  if (len < 0.6) return;
  // start at the door's end, stop short of the far wall (the altar)
  const fromStart = !door || (long ? Math.abs(door.x - room.x) < Math.abs(door.x - room.x - room.w) : Math.abs(door.y - room.y) < Math.abs(door.y - room.y - room.h));
  let placed = 0;
  for (let t = 1.2 + depth / 2; t < L - 2.2 && placed < n; t += step) {
    const a = fromStart ? t : L - t;
    for (const sg of [-1, 1]) {
      const off = aisle / 2 + len / 2, c = long ? { x: room.x + a, y: room.y + room.h / 2 + sg * off } : { x: room.x + room.w / 2 + sg * off, y: room.y + a };
      const angle = long ? 90 : 0, bx = boxOf(c, len, depth, angle);
      if (pl.boxes.some(o => hits(o, bx, 0.05)) || pl.keepOut.some(k => k.x > bx.x - 0.6 && k.x < bx.x + bx.w + 0.6 && k.y > bx.y - 0.6 && k.y < bx.y + bx.h + 0.6)) continue;
      pl.fixtures.push({ kind, x: r2(c.x), y: r2(c.y), w: r2(len), h: r2(depth), ...(angle && { angle }), origin: ORIGIN });
      pl.boxes.push(bx);
      placed++;
    }
  }
}

/** A long table down the middle of the room with a bench each side. */
function feast(pl: Placer, room: Room, kind: string, per: number): void {
  const long = room.w >= room.h, L = (long ? room.w : room.h) * 0.6, d = FIXTURES[kind].ft[1] / per, b = FIXTURES.bench.ft[1] / per, c = { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  if (L < 1.5 || (long ? room.h : room.w) < d + 2 * b + 1) return;
  const angle = long ? 0 : 90, items: [string, number, number, number][] = [[kind, 0, L, d], ['bench', -(d / 2 + b / 2 + 0.15), L * 0.9, b], ['bench', d / 2 + b / 2 + 0.15, L * 0.9, b]];
  for (const [k, off, w, h] of items) {
    const p = long ? { x: c.x, y: c.y + off } : { x: c.x + off, y: c.y }, bx = boxOf(p, w, h, angle);
    if (pl.boxes.some(o => hits(o, bx, 0.05))) continue;
    pl.fixtures.push({ kind: k, x: r2(p.x), y: r2(p.y), w: r2(w), h: r2(h), ...(angle && { angle }), origin: ORIGIN });
    pl.boxes.push(bx);
  }
}

/** The windows along the outer wall: one every few cells, clear of corners and doors (arrow slits on towers and keeps). */
function windowsFor(outline: number[], doors: { x: number; y: number }[], kind: BuildingKind): { at: [number, number]; width?: number }[] {
  const narrow = kind === 'keep' || kind === 'tower' || kind === 'gatehouse' || kind === 'barracks', none = kind === 'barn' || kind === 'ruin' || kind === 'warehouse';
  if (none) return [];
  const out: { at: [number, number]; width?: number }[] = [], gap = narrow ? 4 : 3, width = narrow ? 0.4 : kind === 'temple' || kind === 'chapel' ? 1.4 : 1;
  for (let i = 0, j = outline.length - 2; i < outline.length; j = i, i += 2) {
    const ax = outline[j], ay = outline[j + 1], bx = outline[i], by = outline[i + 1], L = Math.hypot(bx - ax, by - ay);
    if (L < 2.4) continue;
    const n = Math.max(1, Math.floor((L - 1) / gap)), step = L / (n + 1);
    for (let k = 1; k <= n; k++) {
      const t = step * k, x = ax + ((bx - ax) * t) / L, y = ay + ((by - ay) * t) / L;
      if (t < 1 || L - t < 1 || doors.some(d => Math.hypot(d.x - x, d.y - y) < 1.6)) continue;
      out.push({ at: [r2(x), r2(y)], ...(width !== 1 && { width }) });
    }
  }
  return out;
}

/** A door on a side: the middle of the longest stretch of outline along it, on a whole or half cell. */
function doorOn(outline: number[], side: 'n' | 'e' | 's' | 'w', W: number, H: number): [number, number] {
  let best: [number, number] = side === 'n' ? [W / 2, 0] : side === 's' ? [W / 2, H] : side === 'w' ? [0, H / 2] : [W, H / 2], len = 0;
  for (let i = 0, j = outline.length - 2; i < outline.length; j = i, i += 2) {
    const ax = outline[j], ay = outline[j + 1], bx = outline[i], by = outline[i + 1], L = Math.hypot(bx - ax, by - ay);
    const horizontal = Math.abs(ay - by) < 1e-6, vertical = Math.abs(ax - bx) < 1e-6;
    const facing = side === 'n' || side === 's' ? horizontal : vertical;
    if (!facing || L < 1) continue;
    // the stretch must be on the outside of that side: the one furthest out wins ties
    const out = side === 'n' ? -ay : side === 's' ? ay : side === 'w' ? -ax : ax, score = L + out * 0.01;
    if (score > len) { len = score; best = horizontal ? [Math.round(((ax + bx) / 2) * 2) / 2, ay] : [ax, Math.round(((ay + by) / 2) * 2) / 2]; }
  }
  return best;
}

/** The floors of a building, laid out from its footprint and kind. */
export function generateInterior(spec: SettlementSpec, b: Building, o: { seed?: number; stories?: number } = {}): Floor[] {
  const R = ROLES[b.kind], rand = rng(o.seed ?? idSeed(`${b.id}:${b.kind}`)), f = planFactor(spec), per = spec.interior.perCell;
  const W = b.w * f, H = b.h * f, outline = planOutline(spec, b), stories = Math.max(1, o.stories ?? b.stories ?? R.stories);
  const roundish = b.shape === 'circle' || b.shape === 'octagon';
  const levels: number[] = [...(R.cellar && W * H >= 30 ? [-1] : []), ...Array.from({ length: stories }, (_, i) => i)];
  const front = frontSide(spec, b), entry = doorOn(outline, front, W, H);
  const back = W * H > 60 && rand() < 0.5 ? doorOn(outline, ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[front], W, H) : null;
  // the stairs: one spot on every floor, near a corner of the plan away from the entry
  const spiral = roundish || b.kind === 'tower' || b.kind === 'keep' || b.kind === 'gatehouse';
  const sw = spiral ? FIXTURES['spiral-stairs'].ft[0] / per : FIXTURES.stairs.ft[0] / per, sd = spiral ? sw : FIXTURES.stairs.ft[1] / per;
  let stair: { x: number; y: number; angle: number } | null = null;
  if (levels.length > 1) {
    const cands: { x: number; y: number; angle: number }[] = [];
    for (const [cx, cy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) {
      const x = spiral ? W * cx : cx < 0.5 ? 0.15 + sw / 2 : W - 0.15 - sw / 2, y = spiral ? H * cy : cy < 0.5 ? 0.15 + sd / 2 : H - 0.15 - sd / 2;
      cands.push({ x: r2(x), y: r2(y), angle: 0 });
    }
    cands.sort((p, q) => Math.hypot(q.x - entry[0], q.y - entry[1]) - Math.hypot(p.x - entry[0], p.y - entry[1]));
    stair = cands.find(c => { const bx = boxOf(c, sw, sd, 0); return [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x, bx.y + bx.h], [bx.x + bx.w, bx.y + bx.h]].every(([px, py]) => inPolygon(outline, px, py)); }) ?? null;
  }
  const floors: Floor[] = [];
  for (const level of levels) {
    const roles = level < 0 ? R.cellar! : level === 0 ? R.ground : R.upper[Math.min(level - 1, R.upper.length - 1)] ?? ['store'];
    const single = !!R.single || roles.length === 1 || level < 0;
    const { rooms, connections } = splitFloor(spec, b, level, Math.max(2, R.min - (level > 0 ? 0.5 : 0)), single, rand);
    const fl: Floor = { level, rooms, connections, origin: ORIGIN };
    if (level === 0) fl.doors = [{ at: entry }, ...(back ? [{ at: back }] : [])];
    fl.windows = level < 0 ? [] : windowsFor(outline, level === 0 ? [{ x: entry[0], y: entry[1] }, ...(back ? [{ x: back[0], y: back[1] }] : [])] : [], b.kind);
    if (!fl.windows.length) delete fl.windows;
    // the door points every fixture keeps clear of
    const lay = layoutFloor(spec, b, fl);
    const pl: Placer = { fixtures: [], boxes: [], keepOut: [...lay.inner, ...lay.doors].map(d => ({ x: d.x, y: d.y })) };
    if (stair) {
      const up = levels.includes(level + 1), down = levels.includes(level - 1);
      // a cellar's stairs climb; above ground they climb when there is a floor above, else they go down
      const kind = spiral ? 'spiral-stairs' : level < 0 || up ? 'stairs-up' : 'stairs-down';
      if (up || down) { pl.fixtures.push({ kind, x: stair.x, y: stair.y, origin: ORIGIN }); pl.boxes.push(boxOf(stair, sw, sd, 0)); }
    }
    // largest room first takes the first role
    const order = rooms.map((r, i) => ({ r, i, a: polygonArea(roomOutline(r)) })).sort((p, q) => q.a - p.a);
    order.forEach(({ r }, n) => {
      const role = roles[n] ?? (level > 0 ? 'bedroom' : 'store'), out = roomOutline(r);
      const doorNear = lay.doors.concat(lay.inner).filter(d => d.x >= r.x - 0.1 && d.x <= r.x + r.w + 0.1 && d.y >= r.y - 0.1 && d.y <= r.y + r.h + 0.1)[0] ?? null;
      if (ROOM_NAMES[role] && r.w * r.h >= 6) r.label = ROOM_NAMES[role];
      for (const [kind, where, count = 1, chance = 1] of FURNISH[role] ?? []) {
        if (rand() > chance) continue;
        if (where === 'rows') rows(pl, r, kind, count, per, doorNear);
        else if (where === 'feast') feast(pl, r, kind, per);
        else for (let c = 0; c < count; c++) place(pl, r, out, kind, where, rand, per, doorNear);
      }
    });
    // a rug goes under the rest: draw it first
    fl.fixtures = [...pl.fixtures.filter(x => x.kind === 'rug'), ...pl.fixtures.filter(x => x.kind !== 'rug')];
    if (level === levels[levels.length - 1] && level === 0 && !fl.fixtures.length) delete fl.fixtures;
    floors.push(fl);
  }
  return floors;
}

/** The settlement with building `id`'s floors laid out afresh (its hand-drawn floors replaced too). */
export function withInterior(spec: SettlementSpec, id: string, o: { seed?: number; stories?: number } = {}): SettlementSpec {
  const b = spec.buildings.find(x => x.id === id);
  if (!b) throw new Error(`no building ${id}`);
  const floors = generateInterior(spec, b, o);
  return { ...spec, buildings: spec.buildings.map(x => (x.id === id ? { ...x, floors, ...(o.stories !== undefined && { stories: o.stories }) } : x)) };
}
