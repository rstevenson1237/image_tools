/**
 * Drawing checks (`artgen dungeon check`): what a valid file can still get wrong once it is drawn. A room whose outline
 * crosses itself or has no area, rooms laid over each other, a corridor that runs through a room it does not join or
 * across another corridor, a door that is never drawn, a mark off the sheet or on a room's badge. Each finding has the
 * JSON path of the entry it is about and a severity: an `error` draws wrongly, a `warning` is most likely a mistake.
 */
import { overlaps, textBox, type Box } from '../lib/page.ts';
import { area2, lineLength, samples, segmentCross, selfCrossing, type P } from './geom.ts';
import { inPolygon, layoutDungeon, type DungeonLayout, type RoomGeom } from './layout.ts';
import type { DungeonSpec, Issue } from './spec.ts';

export type Severity = 'error' | 'warning';
export interface Finding extends Issue { severity: Severity }

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

export function lintDungeon(spec: DungeonSpec, l: DungeonLayout = layoutDungeon(spec)): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, path: string, message: string) => out.push({ severity, path, message });
  const offSheet = (x: number, y: number, pad = 0) => x < -pad || y < -pad || x > spec.cols + pad || y > spec.rows + pad;

  // rooms: outlines that cross themselves, have a zero-length edge or no area; rooms off the sheet; rooms on rooms
  l.rooms.forEach((g, i) => {
    const at = `rooms[${i}]`, p = g.outline;
    let crossed = false;
    if (g.room.shape === 'poly') {
      const pts = p.length / 2;
      for (let k = 0; k < pts; k++) {
        const j = (k + 1) % pts;
        if (Math.hypot(p[2 * j] - p[2 * k], p[2 * j + 1] - p[2 * k + 1]) < 1e-9) { add('warning', `${at}.points`, `corner ${j} repeats corner ${k} (a zero-length wall)`); break; }
      }
      const x = selfCrossing(p);
      if (x) { add('error', `${at}.points`, `the outline crosses itself (walls ${x[0]} and ${x[1]}); list the corners in order round the room`); crossed = true; }
    }
    if (!crossed && Math.abs(area2(p)) / 2 < MIN_AREA) add('error', at, `${g.room.id} has almost no floor (${(Math.abs(area2(p)) / 2).toFixed(2)} square cells)`);
    const r = g.room;
    if (r.x + r.w <= 0 || r.y + r.h <= 0 || r.x >= spec.cols || r.y >= spec.rows) add('warning', at, `${r.id} is off the sheet (0,0 to ${spec.cols},${spec.rows})`);
    else if (r.x < 0 || r.y < 0 || r.x + r.w > spec.cols || r.y + r.h > spec.rows) add('warning', at, `${r.id} runs off the sheet (0,0 to ${spec.cols},${spec.rows}); \`dungeon fit\` makes room`);
  });
  for (let a = 0; a < l.rooms.length; a++) for (let b = a + 1; b < l.rooms.length; b++) {
    const A = l.rooms[a], B = l.rooms[b];
    if ([A, B].some(g => g.room.fill === 'cellar')) continue;
    const x0 = Math.floor(Math.max(A.room.x, B.room.x)), x1 = Math.ceil(Math.min(A.room.x + A.room.w, B.room.x + B.room.w));
    const y0 = Math.floor(Math.max(A.room.y, B.room.y)), y1 = Math.ceil(Math.min(A.room.y + A.room.h, B.room.y + B.room.h));
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inPolygon(A.outline, x + 0.5, y + 0.5) && inPolygon(B.outline, x + 0.5, y + 0.5)) n++;
    if (n) add('warning', `rooms[${b}]`, `${B.room.id} lies over ${A.room.id} (${n} cell${n === 1 ? '' : 's'}); the wall between them is not drawn`);
  }

  // corridors
  const roomsOf = (i: number) => new Set([spec.corridors[i].from, spec.corridors[i].to].flatMap(e => ('room' in e ? [e.room] : [])));
  l.corridors.forEach((c, i) => {
    const sc = spec.corridors[i], at = `corridors[${i}]`, joins = roomsOf(i);
    const v = sc.via ?? [];
    for (let k = 2; k < v.length; k += 2) if (v[k] === v[k - 2] && v[k + 1] === v[k - 1]) { add('warning', `${at}.via`, `bend ${k / 2} repeats bend ${k / 2 - 1}`); break; }
    (['from', 'to'] as const).forEach((side, k) => {
      const e = sc[side];
      if ('room' in e && !c.ends[k]) add('warning', `${at}.${side}`, `the corridor never leaves ${e.room} (it ends inside it)${sc.doors?.[k] ? `, so its ${sc.doors[k]} is not drawn` : ''}`);
      if ('at' in e) {
        const inside = l.rooms.find(g => inPolygon(g.outline, e.at[0], e.at[1]));
        if (inside) add('warning', `${at}.${side}`, `ends at ${e.at.join(',')}, inside ${inside.room.id}; link to the room instead`);
      }
    });
    if (lineLength(c.pts) < 1e-9) add('warning', at, 'the corridor has no length (both ends at one point), so nothing is drawn');
    // through a third room: sample the centre line, outside the rooms it joins
    const hit = new Set<string>();
    for (const [x, y] of samples(c.pts, 0.25)) for (const g of l.rooms) {
      if (joins.has(g.room.id) || passable(g) || hit.has(g.room.id)) continue;
      if (inPolygon(g.outline, x, y)) hit.add(g.room.id);
    }
    for (const id of hit) add('warning', at, `runs through ${id}, which it does not join (set via or route, or link through ${id})`);
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
    if (found) add('warning', `corridors[${b}]`, `crosses corridor ${a} at ${found.map(v => v.toFixed(1)).join(',')} with no junction (the floors join there)`);
  }

  // marks: off the sheet, symbols on a badge, labels on labels
  const badges = spec.numbers ? l.rooms.flatMap(g => { const b = badgeBox(g); return b ? [{ g, b }] : []; }) : [];
  spec.overlay.symbols.forEach((s, i) => {
    const at = `overlay.symbols[${i}]`, z = (s.scale ?? 1) * 0.9, box: Box = { x: s.x - z / 2, y: s.y - z / 2, w: z, h: z };
    if (offSheet(s.x, s.y)) add('warning', at, `${s.kind} at ${s.x},${s.y} is off the sheet`);
    const on = badges.find(({ b }) => overlaps(box, b));
    if (on) add('warning', at, `${s.kind} at ${s.x},${s.y} is under room ${on.g.room.id}'s number; move the symbol`);
  });
  const labelBoxes = spec.overlay.labels.map(lb => {
    const size = LABEL_CELLS[lb.kind] * (lb.size ?? 1), text = lb.kind === 'area' ? lb.text.toUpperCase() : lb.text;
    return textBox(text, lb.x, lb.y + size * 0.35, size, { bold: lb.kind !== 'note', spacing: lb.kind === 'area' ? size * 0.16 : 0 });
  });
  spec.overlay.labels.forEach((lb, i) => {
    const at = `overlay.labels[${i}]`;
    if (offSheet(lb.x, lb.y)) add('warning', at, `"${lb.text}" at ${lb.x},${lb.y} is off the sheet`);
    const other = labelBoxes.findIndex((b, j) => j < i && !lb.angle && !spec.overlay.labels[j].angle && overlaps(labelBoxes[i], b));
    if (other >= 0) add('warning', at, `"${lb.text}" overlaps label ${other} "${spec.overlay.labels[other].text}"`);
  });
  return out;
}
