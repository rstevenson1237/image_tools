/** `artgen map sync`: replace one origin's entries in a map file and keep the hand entries, reporting what that disturbs. */
import { mergeList, near, type SyncConflict, type SyncReport } from 'artgen-primitives/lib/sync.ts';
import { MAP_FORMAT, parseMap, type MapSpec } from './spec.ts';

/** Marks closer than this (map units) read as one over the other. */
export const MARK_DISTANCE = 0.75;

type Mark = { x: number; y: number; origin?: string; text?: string; kind?: string };
const markName = (m: Mark) => (m.text !== undefined ? `label "${m.text}"` : `symbol ${m.kind}`);

/** The target with its entries of `origin` replaced by those of `from` (a valid map file whose entries all carry it). Hand edits apply after the generated ones. */
export function syncMap(target: MapSpec, from: MapSpec, origin: string): { spec: MapSpec; report: SyncReport } {
  const conflicts: SyncConflict[] = [], lists: SyncReport['lists'] = {};
  const take = <T extends { origin?: string }>(name: string, a: T[], b: T[]) => {
    const r = mergeList(name, a, b, origin);
    lists[name] = { removed: r.removed.length, added: b.length, kept: r.kept };
    return r.list;
  };
  const edits = take('edits', target.edits, from.edits), require = take('require', target.require ?? [], from.require ?? []);
  const labels = take('labels', target.overlay.labels, from.overlay.labels), symbols = take('symbols', target.overlay.symbols, from.overlay.symbols);
  const spec = parseMap({ ...target, edits, ...((target.require?.length || from.require?.length) && { require }), overlay: { labels, symbols } });
  const oldMarks: Mark[] = [...target.overlay.labels, ...target.overlay.symbols], newMarks: Mark[] = [...spec.overlay.labels, ...spec.overlay.symbols], pre: Mark[] = [...labels, ...symbols];
  const over = (marks: Mark[], m: Mark) => marks.find(o => o !== m && near(o, m, MARK_DISTANCE));
  newMarks.forEach((m, i) => {
    if (m.origin !== undefined) return;
    const was = oldMarks.includes(pre[i]) ? pre[i] : undefined, hit = over(newMarks, m);
    if (hit && !(was && over(oldMarks, was)))
      conflicts.push({ kind: 'over-mark', list: m.text !== undefined ? 'labels' : 'symbols', index: oldMarks.indexOf(pre[i]), message: `hand ${markName(m)} at ${m.x},${m.y} is now over ${markName(hit)}` });
  });
  return { spec, report: { version: MAP_FORMAT, origin, lists, conflicts } };
}
