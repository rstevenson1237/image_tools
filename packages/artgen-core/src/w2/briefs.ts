/**
 * Briefs (`art/briefs.yaml`, SPEC §5.1): the asset list for W2. Core parses, validates and edits the YAML text;
 * the CLI and the UI's project store do the file I/O. Edits go through the YAML document so comments survive.
 */
import { isMap, isSeq, parseDocument, stringify, type Document, type YAMLMap, YAMLSeq } from 'yaml';
import { VIEWS, type Size, type View } from '../direction.ts';
import type { Brief } from '../render.ts';

export const BRIEF_KINDS = ['character', 'creature', 'prop', 'tile', 'tileset', 'texture', 'effect', 'viewmodel', 'ui-icon', 'layer'] as const;
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

/** Colour words an effect `object` may not lean on: a drawable thing survives being described without them. */
const COLOUR_WORDS = new Set(('red orange yellow green blue purple violet pink white black grey gray brown gold golden silver amber crimson scarlet ' +
  'cyan teal magenta azure emerald jade turquoise indigo lilac lavender maroon ochre rust copper bronze ivory pale dark bright glowing glowy ' +
  'colorful colourful rainbow neon').split(' '));

/**
 * Effect object lint (rev 9): an ability has to be an object a draftsman could draw from memory, not an effect you can
 * describe. `object` names it without the word "effect" and without colour words ("ice lance", "ring of fire", "a
 * flock of doves" — not "cold flame", "shadow effect", "purple glow"). Returns the problems; empty when it holds.
 */
export function effectObjectIssues(b: Pick<BriefEntry, 'kind' | 'object'>): string[] {
  if (b.kind !== 'effect') return [];
  if (b.object === undefined) return ['effect brief has no object: name the drawable thing it is (brief add --object "ice lance")'];
  const words = String(b.object).toLowerCase().match(/[a-z]+/g) ?? [], out: string[] = [];
  if (!words.some(w => w.length >= 3)) out.push('object must name a thing (a noun a draftsman could draw)');
  if (words.some(w => w === 'effect' || w === 'effects' || w === 'fx' || w === 'vfx')) out.push('object must not say "effect": name the thing itself');
  const colours = words.filter(w => COLOUR_WORDS.has(w));
  if (colours.length) out.push(`object must not lean on colour words (${[...new Set(colours)].join(', ')}): colour comes from the direction`);
  return out;
}
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
    if (!isObj(b.anims)) e.push(`${at}: anims must map state → { frames, fps, loop, durations }`);
    else for (const [s, a] of Object.entries(b.anims)) {
      if (!isObj(a) || !Number.isInteger(a.frames) || (a.frames as number) < 1) e.push(`${at}: anims.${s}.frames must be a positive integer`);
      else if (Array.isArray(b.states) && !b.states.includes(s)) e.push(`${at}: anims.${s} is not in states`);
      else if (a.durations !== undefined && !(Array.isArray(a.durations) && a.durations.length === a.frames && a.durations.every(d => Number.isInteger(d) && d > 0)))
        e.push(`${at}: anims.${s}.durations must list one positive whole number of ms per frame (${a.frames})`);
      else if (a.sub !== undefined && !(Number.isInteger(a.sub) && (a.sub as number) >= 1 && (a.sub as number) <= 8)) e.push(`${at}: anims.${s}.sub must be a whole number of sub-frames per logical frame (1–8)`);
    }
  }
  if (b.variants !== undefined && !(Number.isInteger(b.variants) && (b.variants as number) >= 1)) e.push(`${at}: variants must be a positive integer`);
  if (b.importance !== undefined && !(IMPORTANCE as readonly string[]).includes(b.importance as string)) e.push(`${at}: importance must be one of ${IMPORTANCE.join(', ')}`);
  if (b.priority !== undefined && typeof b.priority !== 'number') e.push(`${at}: priority must be a number`);
  if (b.height !== undefined && !(typeof b.height === 'number' && b.height > 0 && b.height <= 1000)) e.push(`${at}: height must be the real-world height in metres (> 0)`);
  // a missing effect object is an open issue on the asset (older briefs stay valid); a bad one is an error
  if (b.object !== undefined) {
    if (typeof b.object !== 'string' || !b.object.trim()) e.push(`${at}: object must be text`);
    else for (const m of effectObjectIssues({ kind: String(b.kind), object: b.object })) e.push(`${at}: ${m}`);
  }
  if (b.autotile !== undefined && !['wang16', 'blob47'].includes(b.autotile as string)) e.push(`${at}: autotile must be wang16 or blob47`);
  if (b.surface !== undefined && !['wall', 'floor', 'ceiling', 'sky'].includes(b.surface as string)) e.push(`${at}: surface must be wall, floor, ceiling or sky`);
  if (b.blend !== undefined && !['normal', 'add'].includes(b.blend as string)) e.push(`${at}: blend must be normal or add`);
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
  if (!seq || (isSeq(seq) && seq.flow && !seq.items.length)) {
    const fresh = new YAMLSeq(), old = seq as { commentBefore?: string } | null;
    if (old?.commentBefore) fresh.commentBefore = old.commentBefore; // the file's header comment hangs on the empty list
    seq = fresh; doc.contents = fresh;
  }
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
