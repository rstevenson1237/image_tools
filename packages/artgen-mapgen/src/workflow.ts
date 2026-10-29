/**
 * The workflow's view of the three map engines (docs/WORKFLOW.md §4): for a terrain map, a dungeon and a settlement, how to
 * parse, check and describe a file. The versions, review, approval and metrics are `artgen-workflow`'s; the engines supply this.
 * `check` gives the verdict of `map check`, `dungeon check` and `settlement check`: format errors and unmet requirements and
 * lint errors fail, lint warnings flag.
 */
import type { Check, DataSheet, Subject, SubjectKind } from 'artgen-workflow';
import * as dungeon from './dungeon/index.ts';
import * as map from './map/index.ts';
import * as settlement from './settlement/index.ts';

type Issue = { path: string; message: string };
type Opts = { exists?(relPath: string): boolean; symbols?: string[] };

const at = (i: Issue) => `${i.path || '(file)'}: ${i.message}`;
const formatChecks = (errors: Issue[]): Check[] => (errors.length ? errors.map(e => ({ id: 'format', status: 'fail' as const, detail: at(e) })) : [{ id: 'format', status: 'pass', detail: 'ok' }]);

/** Symbols on the sheet that the map direction's set for this kind leaves out. */
function symbolCheck(used: string[], allowed?: string[]): Check[] {
  if (!allowed?.length) return [];
  const bad = [...new Set(used.filter(k => !allowed.includes(k)))];
  return bad.length ? [{ id: 'symbols', status: 'flag', detail: `not in the map direction's symbol set: ${bad.join(', ')}` }] : [{ id: 'symbols', status: 'pass', detail: 'all in the map direction\'s symbol set' }];
}

function lintChecks(found: { path: string; message: string; severity: 'error' | 'warning'; rule?: string }[]): Check[] {
  return found.length ? found.map(f => ({ id: f.rule ? `lint:${f.rule}` : 'lint', status: f.severity === 'error' ? 'fail' as const : 'flag' as const, detail: at(f) })) : [{ id: 'lint', status: 'pass', detail: 'no findings' }];
}

/** The map file an `underlay` names must exist (its path is from the file's folder). Nothing is said when the caller can't look. */
function underlayCheck(raw: unknown, errors: Issue[], exists?: (p: string) => boolean): Check[] {
  const u = (raw as { underlay?: { map?: unknown } } | null)?.underlay;
  if (!exists || !u || typeof u.map !== 'string' || errors.some(e => e.path.startsWith('underlay'))) return [];
  return [exists(u.map) ? { id: 'underlay', status: 'pass', detail: u.map } : { id: 'underlay', status: 'fail', detail: `underlay.map: no such map file ${u.map}` }];
}

const size = (s: { cols: number; rows: number }) => `${s.cols}x${s.rows}`;
const scaleOf = (s: { scale: { perCell: number; unit: string } }) => `${s.scale.perCell} ${s.scale.unit} a cell`;
const mustOf = (checks: Check[]): DataSheet['must'] => {
  const m = checks.filter(c => c.id.startsWith('require:')).map(c => ({ text: c.detail, met: c.status === 'pass' }));
  return m.length ? m : undefined;
};
const verdict = (checks: Check[]): string => { const f = checks.filter(c => c.status === 'fail').length, w = checks.filter(c => c.status === 'flag').length; return f ? `${f} failing${w ? `, ${w} warnings` : ''}` : w ? `ok, ${w} warnings` : 'ok'; };

const mapSubject: Subject<map.MapSpec> = {
  kind: 'map', dir: 'maps', file: 'map.json',
  parse: raw => map.parseMap(raw),
  check(raw, o: Opts = {}) {
    const { errors } = map.checkMap(raw), out = formatChecks(errors);
    if (errors.length) return out;
    const spec = map.parseMap(raw);
    out.push(...map.checkRequirements(spec).map(r => ({ id: `require:${r.id}`, status: r.met ? 'pass' as const : 'fail' as const, detail: r.text })));
    return [...out, ...symbolCheck(spec.overlay.symbols.map(s => s.kind), o.symbols)];
  },
  sheet: (m, checks) => ({
    title: `${m.id} — terrain map`, subject: `map:${m.id}`,
    rows: [
      { label: 'Title', value: m.title ?? '-' }, { label: 'Size', value: `${size(m)} cells, ${scaleOf(m)}` }, { label: 'Preset', value: m.preset },
      { label: 'Grid', value: m.grid.type }, { label: 'Seed', value: String(m.seed) },
      { label: 'Contents', value: `${m.edits.length} edits, ${m.overlay.labels.length} labels, ${m.overlay.symbols.length} symbols` }, { label: 'Checks', value: verdict(checks) },
    ],
    must: mustOf(checks),
  }),
};

const dungeonSubject: Subject<dungeon.DungeonSpec> = {
  kind: 'dungeon', dir: 'dungeons', file: 'dungeon.json',
  parse: raw => dungeon.parseDungeon(raw),
  check(raw, o: Opts = {}) {
    const { errors } = dungeon.checkDungeon(raw), out = formatChecks(errors);
    if (!errors.length) {
      const spec = dungeon.parseDungeon(raw);
      out.push(...lintChecks(dungeon.lintDungeon(spec)), ...symbolCheck(spec.overlay.symbols.map(s => s.kind), o.symbols));
    }
    return [...out, ...underlayCheck(raw, errors, o.exists)];
  },
  sheet: (d, checks) => ({
    title: `${d.id} — dungeon`, subject: `dungeon:${d.id}`,
    rows: [
      { label: 'Title', value: d.title ?? '-' }, { label: 'Size', value: `${size(d)} cells, ${scaleOf(d)}` }, { label: 'Seed', value: String(d.seed) },
      { label: 'Layout', value: `${d.rooms.length} rooms, ${d.corridors.length} corridors` }, { label: 'Contents', value: `${d.overlay.labels.length} labels, ${d.overlay.symbols.length} symbols` },
      { label: 'Checks', value: verdict(checks) },
    ],
  }),
};

const settlementSubject: Subject<settlement.SettlementSpec> = {
  kind: 'settlement', dir: 'settlements', file: 'settlement.json',
  parse: raw => settlement.parseSettlement(raw),
  check(raw, o: Opts = {}) {
    const { errors } = settlement.checkSettlement(raw), out = formatChecks(errors);
    if (!errors.length) {
      const spec = settlement.parseSettlement(raw);
      out.push(...lintChecks(settlement.lintSettlement(spec)), ...symbolCheck(spec.overlay.symbols.map(s => s.kind), o.symbols));
    }
    return [...out, ...underlayCheck(raw, errors, o.exists)];
  },
  sheet: (s, checks) => ({
    title: `${s.id} — ${s.kind}`, subject: `settlement:${s.id}`,
    rows: [
      { label: 'Title', value: s.title ?? '-' }, { label: 'Kind', value: s.kind }, { label: 'Size', value: `${size(s)} cells, ${scaleOf(s)}` }, { label: 'Seed', value: String(s.seed) },
      { label: 'Buildings', value: `${s.buildings.length}, ${s.buildings.filter(b => b.floors?.length).length} with floor plans` },
      { label: 'Site', value: `${s.roads.length} roads, ${s.walls.length} walls, ${s.water.length} water, ${s.trees.length} trees` },
      { label: 'Contents', value: `${s.overlay.labels.length} labels, ${s.overlay.symbols.length} symbols` }, { label: 'Checks', value: verdict(checks) },
    ],
  }),
};

/** The three engines as subjects. */
export const SUBJECTS: Record<SubjectKind, Subject<any>> = { map: mapSubject, dungeon: dungeonSubject, settlement: settlementSubject };

/** Check a file's text: a file that isn't JSON fails `format`; else the subject's own checks. */
export function checkSource(kind: SubjectKind, text: string, o: Opts = {}): Check[] {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return [{ id: 'format', status: 'fail', detail: `(file): not JSON: ${(e as Error).message}` }]; }
  return SUBJECTS[kind].check(raw, o);
}

/** The file's format version and size in cells (for choosing a render scale), from its text; null when it isn't a subject file. */
export function sizeOf(text: string): { cols: number; rows: number } | null {
  try { const r = JSON.parse(text); return Number.isFinite(r?.cols) && Number.isFinite(r?.rows) ? { cols: r.cols, rows: r.rows } : null; } catch { return null; }
}

/** Anything that fails blocks approval. */
export const blocking = (checks: Check[]): Check[] => checks.filter(c => c.status === 'fail');
