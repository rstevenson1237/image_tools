/**
 * The map direction (docs/WORKFLOW.md §7.4): `art/map-direction.json`, the theme for each kind of map and the symbols a kind may
 * use, with a version and a lock. It applies to review sheets, checks and staleness only; `map render` keeps its own defaults,
 * so no consumer's render changes. Custom inks and fonts are not part of it yet: the renderers take named themes only.
 */
import { THEMES as MAP_THEMES } from './map/theme.ts';
import { THEMES as SETTLEMENT_THEMES } from './settlement/theme.ts';
import { SYMBOL_KINDS as MAP_SYMBOLS } from './map/symbols.ts';
import { SYMBOL_KINDS as DUNGEON_SYMBOLS } from './dungeon/symbols.ts';
import { SYMBOL_KINDS as SETTLEMENT_SYMBOLS } from './settlement/render.ts';

export const DIRECTION_FILE = 'map-direction.json';
export const KINDS = ['map', 'dungeon', 'settlement'] as const;
export type DirectionKind = (typeof KINDS)[number];

/** The theme names each engine has. A dungeon is drawn in black and white only. */
export const THEME_NAMES: Record<DirectionKind, readonly string[]> = { map: MAP_THEMES, dungeon: ['bw'], settlement: SETTLEMENT_THEMES };
/** The symbol kinds each engine has. */
export const SYMBOL_NAMES: Record<DirectionKind, readonly string[]> = { map: MAP_SYMBOLS, dungeon: DUNGEON_SYMBOLS, settlement: SETTLEMENT_SYMBOLS };
/** The theme a kind is reviewed in when there is no locked direction. */
export const DEFAULT_THEME: Record<DirectionKind, string> = { map: 'color', dungeon: 'bw', settlement: 'color' };

export interface MapDirection {
  id: string;
  /** 0 until the first lock; each lock moves it up by one. */
  version: number;
  status: 'draft' | 'locked';
  themes: Partial<Record<DirectionKind, string>>;
  symbols: Partial<Record<DirectionKind, string[]>>;
  note?: string;
}

/** A new draft. */
export const newMapDirection = (): MapDirection => ({ id: 'maps', version: 0, status: 'draft', themes: {}, symbols: {} });

/** Every problem with a direction file, each with its JSON path. */
export function checkMapDirection(raw: unknown): string[] {
  const e: string[] = [], r = raw as Record<string, any> | null;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['(file): a JSON object'];
  if (typeof r.id !== 'string' || !r.id) e.push('id: a non-empty string');
  if (!Number.isInteger(r.version) || r.version < 0) e.push('version: a whole number, 0 or more');
  if (r.status !== 'draft' && r.status !== 'locked') e.push('status: draft or locked');
  if (r.status === 'locked' && !(r.version >= 1)) e.push('version: 1 or more when locked');
  for (const [key, names] of [['themes', THEME_NAMES], ['symbols', SYMBOL_NAMES]] as const) {
    const o = r[key];
    if (o === undefined) continue;
    if (!o || typeof o !== 'object' || Array.isArray(o)) { e.push(`${key}: an object keyed by ${KINDS.join(', ')}`); continue; }
    for (const [k, v] of Object.entries(o)) {
      if (!(KINDS as readonly string[]).includes(k)) { e.push(`${key}.${k}: not a kind (${KINDS.join(', ')})`); continue; }
      const have = names[k as DirectionKind];
      if (key === 'themes') { if (typeof v !== 'string' || !have.includes(v)) e.push(`themes.${k}: one of ${have.join(', ')}`); }
      else if (!Array.isArray(v) || v.some(s => typeof s !== 'string' || !have.includes(s))) e.push(`symbols.${k}: a list of ${k} symbol kinds${Array.isArray(v) ? ` (not ${v.filter(s => !have.includes(s)).join(', ')})` : ''}`);
    }
  }
  if (r.note !== undefined && typeof r.note !== 'string') e.push('note: a string');
  return e;
}

/** Parse a direction file; throws with every problem. */
export function parseMapDirection(raw: unknown): MapDirection {
  const e = checkMapDirection(raw);
  if (e.length) throw new Error(`invalid map direction:\n  ${e.join('\n  ')}`);
  const r = raw as Partial<MapDirection>;
  return { id: r.id!, version: r.version!, status: r.status!, themes: { ...r.themes }, symbols: Object.fromEntries(Object.entries(r.symbols ?? {}).map(([k, v]) => [k, [...v!]])), ...(r.note && { note: r.note }) };
}

/** The direction that applies: the file's, when it is locked; none otherwise (a draft changes nothing). */
export const lockedMapDirection = (d: MapDirection | null | undefined): MapDirection | null => (d && d.status === 'locked' ? d : null);

/** `{ id, version }` of a locked direction, as an approval records it. */
export const directionRef = (d: MapDirection | null | undefined): { id: string; version: number } | undefined => { const l = lockedMapDirection(d); return l ? { id: l.id, version: l.version } : undefined; };

/** The theme a kind of map is reviewed in. */
export const themeFor = (d: MapDirection | null | undefined, kind: DirectionKind): string => lockedMapDirection(d)?.themes[kind] ?? DEFAULT_THEME[kind];

/** The symbol kinds a kind of map may use under the locked direction, if it lists any. */
export const symbolsFor = (d: MapDirection | null | undefined, kind: DirectionKind): string[] | undefined => { const s = lockedMapDirection(d)?.symbols[kind]; return s?.length ? s : undefined; };

/** `map=bw,dungeon=color` → `{ map: 'bw', dungeon: 'color' }`; throws on a kind or theme the engines don't have. */
export function parseThemeFlag(v: string): Partial<Record<DirectionKind, string>> {
  const out: Partial<Record<DirectionKind, string>> = {};
  for (const part of v.split(',').map(s => s.trim()).filter(Boolean)) {
    const [k, t] = part.split('=');
    if (!(KINDS as readonly string[]).includes(k) || !t) throw new Error(`--theme: kind=theme pairs, e.g. map=bw,settlement=color (kinds: ${KINDS.join(', ')})`);
    if (!THEME_NAMES[k as DirectionKind].includes(t)) throw new Error(`--theme ${k}: one of ${THEME_NAMES[k as DirectionKind].join(', ')}`);
    out[k as DirectionKind] = t;
  }
  return out;
}

/** `dungeon=altar,statue` (repeat the flag for more kinds, or `;` between them) → `{ dungeon: ['altar', 'statue'] }`; an empty list clears the kind. */
export function parseSymbolsFlag(v: string): Partial<Record<DirectionKind, string[]>> {
  const out: Partial<Record<DirectionKind, string[]>> = {};
  for (const part of v.split(';').map(s => s.trim()).filter(Boolean)) {
    const [k, list = ''] = part.split('=');
    if (!(KINDS as readonly string[]).includes(k)) throw new Error(`--symbols: kind=symbol,symbol (kinds: ${KINDS.join(', ')})`);
    const names = list.split(',').map(s => s.trim()).filter(Boolean), bad = names.filter(n => !SYMBOL_NAMES[k as DirectionKind].includes(n));
    if (bad.length) throw new Error(`--symbols ${k}: no such symbol ${bad.join(', ')} (have: ${SYMBOL_NAMES[k as DirectionKind].join(', ')})`);
    out[k as DirectionKind] = names;
  }
  return out;
}

/** The draft after a change: the themes and symbols merged over it, and back to a draft. */
export function editMapDirection(d: MapDirection, o: { themes?: Partial<Record<DirectionKind, string>>; symbols?: Partial<Record<DirectionKind, string[]>>; note?: string }): MapDirection {
  const symbols = { ...d.symbols, ...o.symbols };
  for (const k of KINDS) if (symbols[k] && !symbols[k]!.length) delete symbols[k];
  return { ...d, status: 'draft', themes: { ...d.themes, ...o.themes }, symbols, ...(o.note !== undefined && (o.note ? { note: o.note } : {})) };
}

/** Lock a draft: the version moves up by one. */
export const lockMapDirection = (d: MapDirection): MapDirection => ({ ...d, status: 'locked', version: d.version + 1 });

/** The direction as the file is written. */
export function formatMapDirection(d: MapDirection): string {
  return JSON.stringify({ id: d.id, version: d.version, status: d.status, themes: d.themes, symbols: d.symbols, ...(d.note && { note: d.note }) }, null, 2) + '\n';
}
