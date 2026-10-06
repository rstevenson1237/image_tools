/**
 * Briefs (`art/briefs.yaml`, SPEC §5.1): the asset list for W2. Core parses, validates and edits the YAML text;
 * the CLI and the UI's project store do the file I/O. Edits go through the YAML document so comments survive.
 */
import { isMap, isSeq, parseDocument, stringify, type Document, type YAMLMap, YAMLSeq } from 'yaml';
import { VIEWS, type Size, type View } from '../direction.ts';
import type { Brief } from '../render.ts';

export const BRIEF_KINDS = ['character', 'creature', 'prop', 'tile', 'tileset', 'texture', 'effect', 'viewmodel', 'ui-icon'] as const;
/** Importance tier (D19): hero assets may get more passes, filler fewer (`budget.tiers` in artgen.config.json). */
export const IMPORTANCE = ['hero', 'standard', 'filler'] as const;
export type Importance = (typeof IMPORTANCE)[number];

export interface BriefEntry extends Brief {
  /** Ramp-to-ramp palette swaps exported as named variants (`red: { cloth: accent }`), tokens only (R11). */
  swaps?: Record<string, Record<string, string>>;
  priority?: number;
  importance?: Importance;
  /** Export anchor [x, y] in frame pixels (default: centre for topdown, bottom centre otherwise). */
  anchor?: [number, number];
  /** Pack this asset goes into (default: every pack whose `include` matches). */
  pack?: string;
}

const ID = /^[a-z][a-z0-9_-]*$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate one brief; returns the errors (empty when valid). */
export function validateBrief(b: unknown, where = 'brief'): string[] {
  const e: string[] = [];
  if (!isObj(b)) return [`${where}: must be a mapping`];
  const at = `${where} ${typeof b.id === 'string' ? b.id : '?'}`;
  if (typeof b.id !== 'string' || !ID.test(b.id)) e.push(`${at}: id must be lowercase letters, digits, - or _ (starting with a letter)`);
  if (typeof b.kind !== 'string' || !(BRIEF_KINDS as readonly string[]).includes(b.kind)) e.push(`${at}: kind must be one of ${BRIEF_KINDS.join(', ')}`);
  if (b.view !== undefined && !(VIEWS as readonly string[]).includes(b.view as string)) e.push(`${at}: view must be one of ${VIEWS.join(', ')}`);
  if (b.size !== undefined && typeof b.size !== 'string' && !(Array.isArray(b.size) && b.size.length === 2 && b.size.every(n => Number.isInteger(n) && n > 0))) e.push(`${at}: size must be a direction scale key or [w, h]`);
  if (b.states !== undefined && !(Array.isArray(b.states) && b.states.length && b.states.every(s => typeof s === 'string' && ID.test(s)))) e.push(`${at}: states must be a non-empty list of names`);
  if (b.directions !== undefined && ![1, 4, 8, 16].includes(b.directions as number)) e.push(`${at}: directions must be 1, 4, 8 or 16`);
  if (b.anims !== undefined) {
    if (!isObj(b.anims)) e.push(`${at}: anims must map state → { frames, fps, loop }`);
    else for (const [s, a] of Object.entries(b.anims)) {
      if (!isObj(a) || !Number.isInteger(a.frames) || (a.frames as number) < 1) e.push(`${at}: anims.${s}.frames must be a positive integer`);
      else if (Array.isArray(b.states) && !b.states.includes(s)) e.push(`${at}: anims.${s} is not in states`);
    }
  }
  if (b.variants !== undefined && !(Number.isInteger(b.variants) && (b.variants as number) >= 1)) e.push(`${at}: variants must be a positive integer`);
  if (b.importance !== undefined && !(IMPORTANCE as readonly string[]).includes(b.importance as string)) e.push(`${at}: importance must be one of ${IMPORTANCE.join(', ')}`);
  if (b.priority !== undefined && typeof b.priority !== 'number') e.push(`${at}: priority must be a number`);
  if (b.anchor !== undefined && !(Array.isArray(b.anchor) && b.anchor.length === 2 && b.anchor.every(n => typeof n === 'number'))) e.push(`${at}: anchor must be [x, y]`);
  if (b.swaps !== undefined) {
    if (!isObj(b.swaps)) e.push(`${at}: swaps must map variant name → { ramp: ramp }`);
    else for (const [n, m] of Object.entries(b.swaps)) if (!isObj(m) || !Object.values(m).every(v => typeof v === 'string' && !v.startsWith('#'))) e.push(`${at}: swaps.${n} must map ramp names to ramp names (no hex, R11)`);
  }
  return e;
}

export interface BriefsResult { ok: boolean; errors: string[]; briefs: BriefEntry[] }

/** Parse `briefs.yaml` text (a list of briefs; empty file = no briefs). Ids must be unique. */
export function parseBriefs(text: string): BriefsResult {
  const doc = parseDocument(text);
  if (doc.errors.length) return { ok: false, errors: doc.errors.map(e => `briefs.yaml: ${e.message}`), briefs: [] };
  const data = doc.toJS() ?? [];
  if (!Array.isArray(data)) return { ok: false, errors: ['briefs.yaml: must be a list of briefs'], briefs: [] };
  const errors: string[] = [], seen = new Set<string>();
  data.forEach((b, i) => {
    errors.push(...validateBrief(b, `brief #${i + 1}`));
    if (isObj(b) && typeof b.id === 'string') { if (seen.has(b.id)) errors.push(`brief ${b.id}: duplicate id`); seen.add(b.id); }
  });
  return { ok: !errors.length, errors, briefs: data as BriefEntry[] };
}

/** Briefs in run order: priority ascending (missing = after the numbered ones), then file order. */
export function briefOrder(briefs: BriefEntry[]): BriefEntry[] {
  return briefs.map((b, i) => ({ b, i })).sort((x, y) => (x.b.priority ?? Infinity) - (y.b.priority ?? Infinity) || x.i - y.i).map(x => x.b);
}

/** Add or replace (same id) a brief in the YAML text, keeping comments and the other entries' formatting. */
export function upsertBrief(text: string, brief: BriefEntry): string {
  const errs = validateBrief(brief);
  if (errs.length) throw new Error(errs.join('\n'));
  const doc = parseDocument(text.trim() ? text : '[]\n') as unknown as Document;
  let seq = doc.contents as unknown;
  if (!seq || (isSeq(seq) && seq.flow && !seq.items.length)) { seq = new YAMLSeq(); doc.contents = seq as YAMLSeq; }
  if (!isSeq(seq)) throw new Error('briefs.yaml: must be a list of briefs');
  const clean = JSON.parse(JSON.stringify(brief)) as BriefEntry;
  const node = doc.createNode(clean) as YAMLMap;
  for (const pair of node.items) { // short lists and small maps on one line, like the SPEC example
    const v = pair.value as { flow?: boolean; items?: unknown[] };
    if ((isSeq(v) || isMap(v)) && (v.items?.length ?? 0) <= 8) v.flow = true;
  }
  const items = seq.items as unknown[];
  const i = items.findIndex(it => isMap(it) && it.get('id') === brief.id);
  if (i >= 0) items[i] = node; else items.push(node);
  return doc.toString({ lineWidth: 120 });
}

/** Remove a brief by id; returns the new text (unchanged if absent). */
export function removeBrief(text: string, id: string): string {
  const doc = parseDocument(text);
  const seq = doc.contents;
  if (!isSeq(seq)) return text;
  const items = seq.items as unknown[], i = items.findIndex(it => isMap(it) && it.get('id') === id);
  if (i < 0) return text;
  items.splice(i, 1);
  return doc.toString({ lineWidth: 120 });
}

/** Default asset directory for a brief, relative to `art/`. */
export const briefDir = (b: Pick<BriefEntry, 'id' | 'kind'>): string => `assets/${b.kind}/${b.id}`;

export const briefsYaml = (briefs: BriefEntry[]): string => stringify(briefs, { lineWidth: 120 });

export type { Size, View };
