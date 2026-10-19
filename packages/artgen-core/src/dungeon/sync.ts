/** `artgen dungeon sync`: replace one origin's entries in a dungeon file and keep the hand entries, reporting what that disturbs. */
import { mergeList, near, type SyncConflict, type SyncReport } from '../lib/sync.ts';
import { inPolygon, layoutDungeon } from './layout.ts';
import { DUNGEON_FORMAT, parseDungeon, type DungeonSpec, type Room } from './spec.ts';

/** Marks closer than this (cells) read as one over the other. */
export const MARK_DISTANCE = 0.75;

type Mark = { x: number; y: number; origin?: string; text?: string; kind?: string };
const markName = (m: Mark) => (m.text !== undefined ? `label "${m.text}"` : `symbol ${m.kind}`);

const insideRoom = (rooms: ReturnType<typeof layoutDungeon>['rooms'], m: Mark) => rooms.find(g => inPolygon(g.outline, m.x, m.y))?.room.id;
const overMark = (marks: Mark[], m: Mark) => marks.find(o => o !== m && near(o, m, MARK_DISTANCE));

/** The target with its entries of `origin` replaced by those of `from` (a valid dungeon file whose entries all carry it). */
export function syncDungeon(target: DungeonSpec, from: DungeonSpec, origin: string): { spec: DungeonSpec; report: SyncReport } {
  const conflicts: SyncConflict[] = [], lists: SyncReport['lists'] = {};
  const take = <T extends { origin?: string }>(name: string, a: T[], b: T[]) => {
    const r = mergeList(name, a, b, origin);
    lists[name] = { removed: r.removed.length, added: b.length, kept: r.kept };
    return r;
  };
  const rooms = take('rooms', target.rooms, from.rooms);
  // a hand edit of a field of a generated room: the table's value wins, and the hand value is reported
  for (const old of rooms.removed) {
    const now = from.rooms.find(r => r.id === old.id);
    if (!now || !old.hand?.length) continue;
    old.hand.forEach(field => {
      const hand = (old as unknown as Record<string, unknown>)[field], table = (now as unknown as Record<string, unknown>)[field];
      if (JSON.stringify(hand) !== JSON.stringify(table))
        conflicts.push({ kind: 'overridden', list: 'rooms', index: target.rooms.indexOf(old), entry: old.id, field, hand, table, message: `${old.id}.${field}: the hand value ${JSON.stringify(hand)} is replaced by the table's ${JSON.stringify(table)}` });
    });
  }
  const corridors = take('corridors', target.corridors, from.corridors), walls = take('walls', target.walls ?? [], from.walls ?? []);
  const labels = take('labels', target.overlay.labels, from.overlay.labels), symbols = take('symbols', target.overlay.symbols, from.overlay.symbols);
  const ids = new Set(rooms.list.map((r: Room) => r.id));
  // a kept entry that refers to a room the sync removed is dropped
  const dropped = <T extends { origin?: string }>(name: string, list: T[], source: T[], refs: (e: T) => string[]) =>
    list.filter(e => {
      const missing = refs(e).find(id => !ids.has(id));
      if (missing === undefined || e.origin === origin) return true;
      conflicts.push({ kind: 'dropped', list: name, index: source.indexOf(e), message: `${name}[${source.indexOf(e)}] is dropped: it refers to ${missing}, which the sync removed` });
      return false;
    });
  const end = (e: { room: string } | { at: [number, number] }) => ('room' in e ? [e.room] : []);
  const keptCorridors = dropped('corridors', corridors.list, target.corridors, c => [...end(c.from), ...end(c.to)]);
  const keptWalls = dropped('walls', walls.list, target.walls ?? [], w => [...(w.rooms ?? []), ...(w.gates ?? []).flatMap(g => (g.room ? [g.room] : []))]);
  const spec = parseDungeon({
    ...target, rooms: rooms.list, corridors: keptCorridors, ...((target.walls?.length || from.walls?.length) && { walls: keptWalls }),
    overlay: { labels: labels.list, symbols: symbols.list },
  });
  // hand marks that now sit inside a room, or over another mark, where they did not before
  const before = layoutDungeon(target).rooms, after = layoutDungeon(spec).rooms;
  const oldMarks: Mark[] = [...target.overlay.labels, ...target.overlay.symbols], newMarks: Mark[] = [...spec.overlay.labels, ...spec.overlay.symbols], pre: Mark[] = [...labels.list, ...symbols.list];
  newMarks.forEach((m, i) => {
    if (m.origin !== undefined) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : undefined, room = insideRoom(after, m);
    if (room !== undefined && !(was && insideRoom(before, was) !== undefined))
      conflicts.push({ kind: 'inside-room', list: m.text !== undefined ? 'labels' : 'symbols', index: oldMarks.indexOf(pre[i]), message: `hand ${markName(m)} at ${m.x},${m.y} is now inside room ${room}` });
    const over = overMark(newMarks, m);
    if (over && !(was && overMark(oldMarks, was)))
      conflicts.push({ kind: 'over-mark', list: m.text !== undefined ? 'labels' : 'symbols', index: oldMarks.indexOf(pre[i]), message: `hand ${markName(m)} at ${m.x},${m.y} is now over ${markName(over)}` });
  });
  return { spec, report: { version: DUNGEON_FORMAT, origin, lists, conflicts } };
}
