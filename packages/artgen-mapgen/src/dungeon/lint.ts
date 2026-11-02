/**
 * Drawing checks (`artgen dungeon check`): what a valid file can still get wrong once it is drawn. A room whose outline
 * crosses itself or has no area, rooms laid over each other, a corridor that runs through a room it does not join or
 * across another corridor, a door that is never drawn, a mark off the sheet or on a room's badge. Each finding has the
 * JSON path of the entry it is about and a severity: an `error` draws wrongly, a `warning` is most likely a mistake.
 */
import { overlaps, textBox, type Box } from 'artgen-primitives/lib/page.ts';
import { corridorBoundaries, doorStand } from './floor.ts';
import { roomLabelLayout } from './roomlabels.ts';
import { area2, lineLength, samples, segmentCross, selfCrossing, sharedEdges, type P } from './geom.ts';
import { inPolygon, layoutDungeon, type DungeonLayout, type RoomGeom } from './layout.ts';
import { corridorWallsOn, sharedWallsOn, type DungeonSpec, type Issue } from './spec.ts';

export type Severity = 'error' | 'warning';
/** A finding: where, what, how bad, and a stable `id` for its kind, so a consumer can raise chosen kinds to errors (`CHECK_IDS`). */
export interface Finding extends Issue { severity: Severity; id: CheckId }

/** Every kind of drawing finding, by id, with what it means. A message may be reworded; an id is not changed. */
export const CHECK_IDS = {
  'outline-crosses': 'a poly room\'s outline crosses itself',
  'zero-wall': 'a poly room repeats a corner (a zero-length wall)',
  'no-floor': 'a room has almost no floor',
  'off-sheet': 'a room, symbol or label lies off the sheet',
  'runs-off-sheet': 'a room runs past the sheet\'s edge',
  'rooms-overlap': 'two rooms are laid over each other',
  'rooms-merge': 'two floor rooms touch while shared walls are off, so their floors run together',
  'repeated-bend': 'a corridor\'s via repeats a bend',
  'never-leaves': 'a corridor never leaves a room it starts or ends at',
  'port-outside-room': 'a corridor end at a room starts outside that room, so it has no door and does not reach it',
  'reenters-room': 'a corridor leaves a room and runs back into it, drawing a passage over the rock between',
  'end-in-room': 'a corridor ends at a point inside a room',
  'no-length': 'a corridor has no length',
  'through-room': 'a corridor runs through a room it does not join',
  'corridors-cross': 'two corridors that share no room cross or run into each other with no junction',
  'corridor-along-wall': 'a corridor runs along a room\'s wall with no wall drawn between them, so the floors run together',
  'way-no-passage': 'a way the file states draws no passage: a connection between rooms that share no wall, or a corridor between rooms laid over each other',
  'wall-too-short': 'a shared wall is narrower than the opening in it',
  'connection-off-wall': 'a connection\'s point is not on the wall the rooms share',
  'door-off-wall': 'a door stands in open floor or on rock, not on a wall between two floors',
  'doors-stacked': 'two doors stand on each other',
  'mark-on-badge': 'a symbol lies under a room\'s number',
  'label-overlap': 'a label lies over another label',
} as const;
export type CheckId = keyof typeof CHECK_IDS;

/** A corridor, a symbol or a room smaller than this many square cells reads as nothing. */
const MIN_AREA = 0.5;
/** Label sizes in cells at the default 40 px a cell (the renderer's sizes without a page scale). */
const LABEL_CELLS = { area: 24 / 40, name: 15 / 40, note: 12 / 40 } as const;
const NUMBER_CELLS = 19 / 40;

/** A room's number badge in cells (where the renderer draws it), or null when it has none. */
export function badgeBox(g: RoomGeom): Box | null {
  if (g.number === undefined) return null;
  const fs = NUMBER_CELLS, bh = fs * 1.45, bw = Math.max(bh, String(g.number).length * fs * 0.62 + fs * 0.7);
  return { x: g.cx - bw / 2, y: g.cy - bh / 2, w: bw, h: bh };
}

/** Rooms a corridor may pass through without comment: the ones it joins, and cellars and yards (drawn apart). */
const passable = (g: RoomGeom) => g.room.fill === 'cellar' || g.room.fill === 'yard';

/** A door's opening as a segment along its wall. */
const opening = (d: { x: number; y: number; angle: number; width: number }): [P, P] => {
  const a = (d.angle * Math.PI) / 180, tx = -Math.sin(a) * d.width / 2, ty = Math.cos(a) * d.width / 2;
  return [[d.x - tx, d.y - ty], [d.x + tx, d.y + ty]];
};
/** Whether two doors' openings overlap: along one wall line (parallel, within a wall's width, sharing some of their length), or crossing. Openings that only touch end to end, as at a room's corner, do not. */
function openingsMeet(a: { x: number; y: number; angle: number; width: number }, b: typeof a): boolean {
  const [p0, p1] = opening(a), [q0, q1] = opening(b), ux = (p1[0] - p0[0]) / a.width, uy = (p1[1] - p0[1]) / a.width;
  if (Math.abs(ux * (q1[1] - q0[1]) - uy * (q1[0] - q0[0])) < 1e-6 * b.width) {
    const off = Math.abs((q0[0] - p0[0]) * uy - (q0[1] - p0[1]) * ux);
    const t0 = (q0[0] - p0[0]) * ux + (q0[1] - p0[1]) * uy, t1 = (q1[0] - p0[0]) * ux + (q1[1] - p0[1]) * uy;
    return off < 0.3 && Math.min(a.width, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 0.1;
  }
  return !!segmentCross(p0, p1, q0, q1);
}

const reversedPts = (p: number[]) => { const out: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]); return out; };
/** How far along a polyline a point on it lies. */
function alongOf(pts: number[], x: number, y: number): number {
  let at = 0, best = Infinity, out = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1], dx = pts[i + 2] - ax, dy = pts[i + 3] - ay, L2 = dx * dx + dy * dy, len = Math.sqrt(L2);
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0, d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best - 1e-9) { best = d; out = at + t * len; }
    at += len;
  }
  return out;
}

export function lintDungeon(spec: DungeonSpec, l: DungeonLayout = layoutDungeon(spec)): Finding[] {
  const out: Finding[] = [];
  const add = (id: CheckId, severity: Severity, path: string, message: string) => out.push({ severity, path, message, id });
  const offSheet = (x: number, y: number, pad = 0) => x < -pad || y < -pad || x > spec.cols + pad || y > spec.rows + pad;

  // rooms: outlines that cross themselves, have a zero-length edge or no area; rooms off the sheet; rooms on rooms
  l.rooms.forEach((g, i) => {
    const at = `rooms[${i}]`, p = g.outline;
    let crossed = false;
    if (g.room.shape === 'poly') {
      const pts = p.length / 2;
      for (let k = 0; k < pts; k++) {
        const j = (k + 1) % pts;
        if (Math.hypot(p[2 * j] - p[2 * k], p[2 * j + 1] - p[2 * k + 1]) < 1e-9) { add('zero-wall', 'warning', `${at}.points`, `corner ${j} repeats corner ${k} (a zero-length wall)`); break; }
      }
      const x = selfCrossing(p);
      if (x) { add('outline-crosses', 'error', `${at}.points`, `the outline crosses itself (walls ${x[0]} and ${x[1]}); list the corners in order round the room`); crossed = true; }
    }
    if (!crossed && Math.abs(area2(p)) / 2 < MIN_AREA) add('no-floor', 'error', at, `${g.room.id} has almost no floor (${(Math.abs(area2(p)) / 2).toFixed(2)} square cells)`);
    const r = g.room;
    if (r.x + r.w <= 0 || r.y + r.h <= 0 || r.x >= spec.cols || r.y >= spec.rows) add('off-sheet', 'warning', at, `${r.id} is off the sheet (0,0 to ${spec.cols},${spec.rows})`);
    else if (r.x < 0 || r.y < 0 || r.x + r.w > spec.cols || r.y + r.h > spec.rows) add('runs-off-sheet', 'warning', at, `${r.id} runs off the sheet (0,0 to ${spec.cols},${spec.rows}); \`dungeon fit\` makes room`);
  });
  for (let a = 0; a < l.rooms.length; a++) for (let b = a + 1; b < l.rooms.length; b++) {
    const A = l.rooms[a], B = l.rooms[b];
    if ([A, B].some(g => g.room.fill === 'cellar')) continue;
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) n++;
    if (n) add('rooms-overlap', 'warning', `rooms[${b}]`, `${B.room.id} lies over ${A.room.id} (${n} cell${n === 1 ? '' : 's'}); the wall between them is not drawn`);
  }

  // floor rooms that touch run together as one floor when no wall is drawn between them
  if (!sharedWallsOn(spec)) {
    const floors = l.rooms.filter(g => (g.room.fill ?? 'floor') === 'floor');
    for (let a = 0; a < floors.length; a++) for (let b = a + 1; b < floors.length; b++) {
      const A = floors[a], B = floors[b], along = sharedEdges(A.outline, B.outline).reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      if (along > 1e-6) add('rooms-merge', 'warning', `rooms[${B.index}]`, `${B.room.id} touches ${A.room.id} along ${along.toFixed(1)} cells and shared walls are off, so their floors run together; leave style.sharedWalls unset (or true)`);
    }
  }

  // corridors
  const roomsOf = (i: number) => new Set([spec.corridors[i].from, spec.corridors[i].to].flatMap(e => ('room' in e ? [e.room] : [])));
  l.corridors.forEach((c, i) => {
    const sc = spec.corridors[i], at = `corridors[${i}]`, joins = roomsOf(i);
    const v = sc.via ?? [];
    for (let k = 2; k < v.length; k += 2) if (v[k] === v[k - 2] && v[k + 1] === v[k - 1]) { add('repeated-bend', 'warning', `${at}.via`, `bend ${k / 2} repeats bend ${k / 2 - 1}`); break; }
    (['from', 'to'] as const).forEach((side, k) => {
      const e = sc[side];
      if ('room' in e && !c.ends[k]) {
        // the end's first point: inside the room, the corridor never gets out; outside it, it never reaches the room
        const g = l.rooms.find(r => r.room.id === e.room), n = c.pts.length, [x, y] = k === 0 ? [c.pts[0], c.pts[1]] : [c.pts[n - 2], c.pts[n - 1]];
        if (g && !inPolygon(g.outline, x, y)) add('port-outside-room', 'warning', `${at}.${side}`, `starts at ${x.toFixed(1)},${y.toFixed(1)}, outside ${e.room}, so it never reaches ${e.room}${sc.doors?.[k] ? ` and its ${sc.doors[k]} is not drawn` : ''}; start it from a point inside the room (via) or on its wall`);
        else add('never-leaves', 'warning', `${at}.${side}`, `the corridor never leaves ${e.room} (it ends inside it)${sc.doors?.[k] ? `, so its ${sc.doors[k]} is not drawn` : ''}`);
      }
      if ('at' in e) {
        const inside = l.rooms.find(g => inPolygon(g.outline, e.at[0], e.at[1]));
        if (inside) add('end-in-room', 'warning', `${at}.${side}`, `ends at ${e.at.join(',')}, inside ${inside.room.id}; link to the room instead`);
      }
    });
    if (lineLength(c.pts) < 1e-9) add('no-length', 'warning', at, 'the corridor has no length (both ends at one point), so nothing is drawn');
    else if ('room' in sc.from && 'room' in sc.to && c.ends[0] && c.ends[1] && Math.hypot(c.ends[0].x - c.ends[1].x, c.ends[0].y - c.ends[1].y) < 0.05)
      add('way-no-passage', 'warning', at, `${sc.from.room} and ${sc.to.room} touch where it runs, so it draws no passage${sharedWallsOn(spec) ? ' and no opening in their wall' : ''}; join them with a connection`);
    // through a third room: sample the centre line, outside the rooms it joins
    const hit = new Set<string>();
    for (const [x, y] of samples(c.pts, 0.25)) for (const g of l.rooms) {
      if (joins.has(g.room.id) || passable(g) || hit.has(g.room.id)) continue;
      if (inPolygon(g.outline, x, y)) hit.add(g.room.id);
    }
    for (const id of hit) add('through-room', 'warning', at, `runs through ${id}, which it does not join (set via or route, or link through ${id})`);
    // out of a room it joins and back in (a port in one arm of an L run to the other): its run between the two exits is over rock
    ([sc.from, sc.to] as const).forEach((e, k) => {
      const ex = c.ends[k], g = 'room' in e ? l.rooms.find(r => r.room.id === e.room) : undefined;
      if (!ex || !g) return;
      const path = k === 0 ? c.pts : reversedPts(c.pts), far = lineLength(path) - (c.ends[1 - k]?.along ?? 0);
      // before its door, over rock it treats as the room; after it, back into the room
      const back = samples(path, 0.25).some(([x, y]) => { const d = alongOf(path, x, y), inside = inPolygon(g.outline, x, y); return (d < ex.along - 0.25 && !inside) || (d > ex.along + 0.5 && d < far - 0.5 && inside); });
      if (back) add('reenters-room', 'warning', `${at}.${k ? 'to' : 'from'}`, `leaves ${g.room.id} and runs back into it, over the rock between; start it from a point that sees the wall it leaves by (via), or from a point on that wall`);
    });
  });
  // corridors that cross with no junction (outside every room)
  const joined = (a: number, b: number) => [spec.corridors[a].from, spec.corridors[a].to].some(e => 'corridor' in e && e.corridor === spec.corridors[b].id)
    || [spec.corridors[b].from, spec.corridors[b].to].some(e => 'corridor' in e && e.corridor === spec.corridors[a].id);
  for (let a = 0; a < l.corridors.length; a++) for (let b = a + 1; b < l.corridors.length; b++) {
    if (joined(a, b)) continue;
    const A = l.corridors[a].pts, B = l.corridors[b].pts;
    let found: P | null = null;
    for (let i = 0; i + 3 < A.length && !found; i += 2) for (let j = 0; j + 3 < B.length && !found; j += 2) {
      const x = segmentCross([A[i], A[i + 1]], [A[i + 2], A[i + 3]], [B[j], B[j + 1]], [B[j + 2], B[j + 3]]);
      if (x && !l.rooms.some(g => inPolygon(g.outline, x[0], x[1]))) found = x;
    }
    if (found) add('corridors-cross', 'warning', `corridors[${b}]`, `crosses corridor ${a} at ${found.map(v => v.toFixed(1)).join(',')} with no junction (the floors join there)`);
  }

  // a corridor's floor against a room's wall: with no wall drawn between them, the two floors run together
  const along = new Map<string, number>();
  for (const b of corridorWallsOn(spec) ? [] : corridorBoundaries(l)) {
    if (!('room' in b.a) || !('corridor' in b.b)) continue;
    const k = `${b.b.corridor},${b.a.room}`;
    along.set(k, (along.get(k) ?? 0) + Math.hypot(b.seg[1][0] - b.seg[0][0], b.seg[1][1] - b.seg[0][1]));
  }
  for (const [k, n] of along) {
    const [ci, ri] = k.split(',').map(Number);
    add('corridor-along-wall', 'warning', `corridors[${ci}]`, `runs along ${l.rooms[ri].room.id}'s wall for ${n.toFixed(1)} cells with no wall drawn between them, so the floors run together; style.sharedWalls: true draws one`);
  }

  // doors: each stands on a wall between two floors, and on no other door
  const doorPath = (d: (typeof l.doors)[number]) => (d.connection !== undefined ? `connections[${d.connection}]` : `corridors[${d.corridor}].doors`);
  l.doors.forEach((d, i) => {
    const s = doorStand(spec, l, d);
    if (s.on === 'open' || s.on === 'rock') add('door-off-wall', 'warning', doorPath(d), `the ${d.kind} at ${d.x.toFixed(1)},${d.y.toFixed(1)} stands ${s.on === 'open' ? 'in open floor' : 'on rock'}, not on a wall between two floors`);
    const on = l.doors.findIndex((e, j) => j < i && openingsMeet(e, d));
    if (on >= 0) add('doors-stacked', 'warning', doorPath(d), `the ${d.kind} at ${d.x.toFixed(1)},${d.y.toFixed(1)} stands on the ${l.doors[on].kind} of ${doorPath(l.doors[on])}`);
  });

  // connections: the two rooms must share a wall long enough for the opening
  l.connections.forEach((c, i) => {
    const at = `connections[${i}]`;
    if (!c.wall) { add('way-no-passage', 'warning', at, `${c.a} and ${c.b} share no wall, so the ${c.kind === 'open' ? 'opening' : c.kind} is not drawn; move one room against the other, or link them with a corridor`); return; }
    const len = Math.hypot(c.wall[1][0] - c.wall[0][0], c.wall[1][1] - c.wall[0][1]);
    if (len < c.width - 1e-6) add('wall-too-short', 'warning', at, `the wall ${c.a} and ${c.b} share is ${len.toFixed(1)} cells, narrower than the ${c.width}-cell ${c.kind === 'open' ? 'opening' : c.kind}`);
    const sc = spec.connections![i];
    if (sc.at && Math.hypot(sc.at[0] - c.x, sc.at[1] - c.y) > 0.75) add('connection-off-wall', 'warning', `${at}.at`, `${sc.at.join(',')} is not on the wall ${c.a} and ${c.b} share; the ${c.kind === 'open' ? 'opening' : c.kind} is at ${c.x.toFixed(1)},${c.y.toFixed(1)}`);
  });

  // marks: off the sheet, symbols on a badge, labels on labels
  // the rooms' labels where they are drawn: one that found no clear spot lies on a symbol (reported with the symbol) or on another room's label
  const placed = roomLabelLayout(spec, l), badges = placed.flatMap(r => (r.badge ? [{ g: l.rooms[r.room], b: r.badge }] : []));
  const block = (r: (typeof placed)[number]): Box[] => [r.badge, r.name].filter((b): b is Box => !!b);
  placed.forEach((r, i) => {
    if (r.placed) return;
    const other = placed.find((q, j) => j < i && block(q).some(b => block(r).some(c => overlaps(b, c))));
    if (other) add('label-overlap', 'warning', `rooms[${r.room}]`, `${l.rooms[r.room].room.id}'s label lies over ${l.rooms[other.room].room.id}'s and has no clear spot by its walls; set rooms[${r.room}].labelAt or move a room`);
  });
  spec.overlay.symbols.forEach((s, i) => {
    const at = `overlay.symbols[${i}]`, z = (s.scale ?? 1) * 0.9, box: Box = { x: s.x - z / 2, y: s.y - z / 2, w: z, h: z };
    if (offSheet(s.x, s.y)) add('off-sheet', 'warning', at, `${s.kind} at ${s.x},${s.y} is off the sheet`);
    const on = badges.find(({ b }) => overlaps(box, b));
    if (on) add('mark-on-badge', 'warning', at, `${s.kind} at ${s.x},${s.y} is under room ${on.g.room.id}'s number; move the symbol`);
  });
  const labelBoxes = spec.overlay.labels.map(lb => {
    const size = LABEL_CELLS[lb.kind] * (lb.size ?? 1), text = lb.kind === 'area' ? lb.text.toUpperCase() : lb.text;
    return textBox(text, lb.x, lb.y + size * 0.35, size, { bold: lb.kind !== 'note', spacing: lb.kind === 'area' ? size * 0.16 : 0 });
  });
  spec.overlay.labels.forEach((lb, i) => {
    const at = `overlay.labels[${i}]`;
    if (offSheet(lb.x, lb.y)) add('off-sheet', 'warning', at, `"${lb.text}" at ${lb.x},${lb.y} is off the sheet`);
    const other = labelBoxes.findIndex((b, j) => j < i && !lb.angle && !spec.overlay.labels[j].angle && overlaps(labelBoxes[i], b));
    if (other >= 0) add('label-overlap', 'warning', at, `"${lb.text}" overlaps label ${other} "${spec.overlay.labels[other].text}"`);
  });
  return out;
}
