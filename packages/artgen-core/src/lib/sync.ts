/**
 * Hand edits kept across regeneration (`artgen map sync`, `artgen dungeon sync`). A consumer that rebuilds a file from
 * its tables writes every entry it generates with an `origin`; a sync replaces the entries of that origin and keeps the
 * rest (the hand entries, those with no origin, and other origins') in order. Generated entries come first, so hand
 * edits apply after them.
 */

export interface Originated { origin?: string }

/** One finding of a sync: something the sync dropped, overrode or now finds beside a hand entry. Never resolved silently. */
export interface SyncConflict {
  kind: 'dropped' | 'overridden' | 'inside-room' | 'over-mark';
  /** The list the entry is in (`rooms`, `corridors`, `edits`, `labels`, …) and its index in the target file before the sync. */
  list: string;
  index: number;
  message: string;
  /** For `overridden`: the room, the field, the hand value (discarded) and the table's value (kept). */
  entry?: string; field?: string; hand?: unknown; table?: unknown;
}

export interface SyncReport {
  version: number;
  origin: string;
  /** Per list: entries of the origin removed from the target, entries the sync added, and entries of other origins kept. */
  lists: Record<string, { removed: number; added: number; kept: number }>;
  conflicts: SyncConflict[];
}

/** The entries of `list` that carry `origin`; an entry in `incoming` that does not is an error (the sync file is all one origin). */
export function checkIncoming(name: string, incoming: Originated[], origin: string): void {
  incoming.forEach((e, i) => {
    if (e.origin !== origin) throw new Error(`--from: ${name}[${i}] has ${e.origin === undefined ? 'no origin' : `origin ${JSON.stringify(e.origin)}`}, not ${JSON.stringify(origin)}: every entry in the file synced from carries the origin`);
  });
}

/**
 * The target's list with its entries of `origin` replaced by `incoming` (put where the first of them stood, among the
 * generated entries), and every entry with no origin after all the others. Returns what was removed.
 */
export function mergeList<T extends Originated>(name: string, target: T[], incoming: T[], origin: string): { list: T[]; removed: T[]; kept: number } {
  checkIncoming(name, incoming, origin);
  const generated: T[] = [], hand: T[] = [], removed: T[] = [];
  let placed = false;
  for (const e of target) {
    if (e.origin === origin) { removed.push(e); if (!placed) { generated.push(...incoming); placed = true; } }
    else if (e.origin !== undefined) generated.push(e);
    else hand.push(e);
  }
  if (!placed) generated.push(...incoming);
  return { list: [...generated, ...hand], removed, kept: target.length - removed.length };
}

/** Whether two marks (points) are closer than `d`. */
export const near = (a: { x: number; y: number }, b: { x: number; y: number }, d: number): boolean => Math.hypot(a.x - b.x, a.y - b.y) < d;
