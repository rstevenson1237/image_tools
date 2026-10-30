/**
 * Subjects (docs/WORKFLOW.md §4): the things the workflow keeps versions, reviews, approvals and metrics for besides pixel
 * assets. artgen supplies assets (a brief id), mapgen supplies maps, dungeons and settlements. A subject's ledger key is
 * `<kind>:<id>`; brief ids can't hold `:`, so a subject never collides with an asset.
 */
import type { Check } from './check.ts';
import type { DataSheet } from './sheet.ts';

export const SUBJECT_KINDS = ['map', 'dungeon', 'settlement'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const subjectKey = (kind: SubjectKind, id: string): string => `${kind}:${id}`;

/** `map:keep` → `{ kind: 'map', id: 'keep' }`; null for anything else (a brief id, `direction`, `maps:direction`). */
export function parseSubjectKey(key: string): { kind: SubjectKind; id: string } | null {
  const m = /^(map|dungeon|settlement):([\w-]+)$/.exec(key);
  return m ? { kind: m[1] as SubjectKind, id: m[2] } : null;
}
export const isSubjectKey = (asset: string): boolean => parseSubjectKey(asset) !== null;

/** What a generator supplies to the workflow: how to check and describe one of its files. */
export interface Subject<S = unknown> {
  kind: SubjectKind;
  /** Folder under art/ and file name: `maps` + `map.json`. */
  dir: string;
  file: string;
  /** Parse and validate; throws like the engine's own parse. */
  parse(raw: unknown): S;
  /** The gate: format errors, lint findings and requirements as checks (fail = blocks approval, flag = warning). */
  check(raw: unknown, o?: { exists?(relPath: string): boolean; symbols?: string[] }): Check[];
  /** The one-page data sheet (§8). */
  sheet(spec: S, checks: Check[]): DataSheet;
}

/** The file stem of a subject's working file (`map.json` → `map`); versions and the brief are named from it. */
export const stemOf = (s: Pick<Subject, 'file'>): string => s.file.replace(/\.json$/, '');
