/** What the map, dungeon and settlement operations share: flag readers, output helpers, the overlay edit and the sync text. Never imports the pixel-art pipeline. */
import { readFileSync } from 'node:fs';
import { parseCrop, parseFit, type Crop, type Fit, type SyncReport } from 'artgen-core/maps';
import { numbers as numberList } from '../map.ts';
import { p, type Content, type Ctx, type Param } from './registry.ts';
import type { Project } from '../projectfs.ts';

export type Inp = Record<string, any>;

export const text = (v: unknown): Content => ({ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) });
export const pngFile = (f: string): Content => ({ type: 'image', data: readFileSync(f).toString('base64'), mimeType: 'image/png' });

/** A `--json` result of a map, dungeon or settlement command with the `version` of the format it reports on (a list becomes `{ version, items }`). */
export const withVersion = (data: unknown, version: number): unknown =>
  data && typeof data === 'object' && !Array.isArray(data) ? { version, ...data } : { version, items: data };

/** The project an operation works in: none in path mode (`--file`), else the context's. */
export const projectOf = (i: Inp, ctx: Ctx): Project | null => (i.path ? null : ctx.project());
/** A map, dungeon or settlement: the file named by `--file`, else its id. */
export const refOf = (i: Inp): string | { file: string } => (i.path ? { file: i.path } : i.id);

/** `numbers(v, '--points')` for a value that may be missing. */
export const needPoints = (v: number[] | undefined, flag: string): number[] => { if (!v) numberList(undefined, flag); return v!; };
/** A flag given as text, as a number (`--width 2`). */
export const numFlag = (v: unknown, flag: string): number | undefined => { if (v === undefined) return undefined; if (!Number.isFinite(+(v as string))) throw new Error(`${flag}: a number`); return +(v as string); };

/** `--crop` and `--fit` from the command line; `cell` is the units in one grid cell (for a crop given in cells). */
export function viewOf(i: Inp, cell: () => number): { crop?: Crop; fit?: Fit } {
  return { ...(i.crop !== undefined && { crop: parseCrop(i.crop, cell()) }), ...(i.fit !== undefined && { fit: parseFit(i.fit) }) };
}

/** `--page-scale n`: output pixels per millimetre on the page (`--fit` sets it from the box). */
export const pageScaleOf = (v: unknown): number | undefined => { if (v === undefined) return undefined; if (!(+(v as string) > 0)) throw new Error('--page-scale: output pixels per millimetre, above 0'); return +(v as string); };

/** `--origin tables`: who wrote an entry (none: a hand entry). */
export const originOf = (v: unknown): { origin: string } | undefined => { if (v === undefined) return undefined; if (!v) throw new Error('--origin: a non-empty name'); return { origin: v as string }; };

/** Print a sync's result: what was replaced and every conflict. */
export function syncText(file: string, r: SyncReport): string {
  const lists = Object.entries(r.lists).filter(([, c]) => c.removed || c.added).map(([n, c]) => `${n}: ${c.removed} of ${r.origin} replaced by ${c.added}`);
  return [`${file}: synced origin ${r.origin}${lists.length ? ` (${lists.join('; ')})` : ' (nothing of that origin on either side)'}`, `${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}${r.conflicts.length ? ':' : ''}`, ...r.conflicts.map(c => `  ${c.kind}: ${c.message}`)].join('\n');
}

/** Layer switches: a `grid=off,labels=off` string from the command line, or the object MCP sends. */
export const layersOf = <L extends string>(v: unknown, parse: (s: string | undefined) => Partial<Record<L, boolean>> | undefined): Partial<Record<L, boolean>> | undefined =>
  (typeof v === 'string' ? parse(v) : (v as Partial<Record<L, boolean>> | undefined));

/** `--number 7` / `--number off` → a room number, false to hide it, or undefined when unset (an MCP number passes through). */
export function roomNumber(v: unknown, onOff: (s: string) => boolean | undefined): number | false | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  if (v === false) return false;
  if (onOff(v as string) === false && !/^\d/.test(v as string)) return false;
  if (!Number.isFinite(+(v as string))) throw new Error('--number: a number or off');
  return +(v as string);
}

// ---- parameters every map-like operation takes
/** The map's id: a positional on the command line, a name (never a path) on MCP. `required` is today's message. */
export const idParam = (what: string, required: string): Param => p.str(what, { positional: true, required });
/** `--file <path>` in place of the id: no project needed. */
export const pathParam = (kind: string): Param => p.str(`the ${kind} file by path, in place of the id (needs no project; renders go beside the file or to --out)`, { flag: '--file', mcp: false });

/** The listing in a result of the overlay edit: `0. place "Port Ash" at 2.5,3.5`. */
export const overlayLines = (m: { overlay: { labels: { kind: string; text: string; x: number; y: number }[]; symbols: { kind: string; x: number; y: number }[] } }) =>
  ({ labels: m.overlay.labels.map((l, i) => `${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`), symbols: m.overlay.symbols.map((s, i) => `${i}. ${s.kind} at ${s.x},${s.y}`) });

/** Remove overlay items by index (from the highest down); an index that is not there is an error. */
export function dropItems<T>(list: T[], idx: unknown): void {
  if (Array.isArray(idx)) for (const i of [...(idx as number[])].sort((x, y) => y - x)) { if (!list[i]) throw new Error(`no overlay item ${i}`); list.splice(i, 1); }
}

/**
 * The overlay edit of `map overlay` and `dungeon overlay`: the command line's `rm label|symbol <i>` and `clear [labels|symbols]`,
 * then MCP's remove / clear / add lists (also flags on the command line). A bare call is an error on the command line.
 */
export function overlayEdit(m: { overlay: { labels: unknown[]; symbols: unknown[] } }, i: Inp, o: { name: string; strict: boolean; addLabel(l: Inp): void; addSymbol(s: Inp): void }): void {
  const usage = `${o.name} overlay <id> rm label|symbol <index> | clear [labels|symbols]`;
  if (i.action !== undefined) {
    if (i.action === 'rm') {
      const list = i.which === 'label' ? m.overlay.labels : i.which === 'symbol' ? m.overlay.symbols : null, n = Number(i.index);
      if (!list || !Number.isInteger(n) || n < 0 || n >= list.length) throw new Error(`${o.name} overlay <id> rm label|symbol <index> (labels 0..${m.overlay.labels.length - 1}, symbols 0..${m.overlay.symbols.length - 1})`);
      list.splice(n, 1);
    } else if (i.action === 'clear') {
      if (!i.which || i.which === 'labels') m.overlay.labels = [];
      if (!i.which || i.which === 'symbols') m.overlay.symbols = [];
    } else throw new Error(usage);
  } else if (o.strict && !['add_labels', 'add_symbols', 'remove_labels', 'remove_symbols', 'clear'].some(k => i[k] !== undefined)) throw new Error(usage);
  if (i.clear === 'labels' || i.clear === 'all') m.overlay.labels = [];
  if (i.clear === 'symbols' || i.clear === 'all') m.overlay.symbols = [];
  dropItems(m.overlay.labels, i.remove_labels); dropItems(m.overlay.symbols, i.remove_symbols);
  for (const l of (i.add_labels as Inp[] | undefined) ?? []) o.addLabel(l);
  for (const s of (i.add_symbols as Inp[] | undefined) ?? []) o.addSymbol(s);
}

/** The params of an overlay operation: the command line's `rm` / `clear` words and the lists MCP sends. */
export const overlayParams = (kinds: string): Record<string, Param> => ({
  action: p.str('rm | clear (the command line)', { positional: true, mcp: false }),
  which: p.str(`label | symbol (rm), or ${kinds} (clear)`, { positional: true, mcp: false }),
  index: p.str('the item to remove (rm)', { positional: true, mcp: false }),
  add_labels: p.json({ type: 'array', items: { type: 'object' } }, 'labels to add, as a JSON list (see the MCP tool for the fields)'),
  add_symbols: p.json({ type: 'array', items: { type: 'object' } }, 'symbols to add, as a JSON list'),
  remove_labels: p.list('number', 'indices of labels to remove', { schema: { type: 'array', items: { type: 'number' } } }),
  remove_symbols: p.list('number', 'indices of symbols to remove', { schema: { type: 'array', items: { type: 'number' } } }),
  clear: p.str('labels | symbols | all'),
});
