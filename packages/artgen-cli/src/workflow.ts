/**
 * The Node side of the map workflow (docs/WORKFLOW.md §10): versions beside a map's working file, the ledger, the map
 * direction, review sheets and the data sheet. The rules (status, diffs, sheets) are `artgen-workflow`'s and the checks are
 * the engines' (`subjects`); this file reads and writes the files. A map, dungeon or settlement is one subject: its ledger
 * key is `<kind>:<id>` and its files are `art/<dir>/<id>/<stem>.json` (the working file), `<stem>.v<N>.json` (versions) and
 * `<stem>.brief.md`. Never imports the pixel-art pipeline.
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import {
  approvalEntry, dataSheetMarkdown, decodePNG, diffJson, encodePNG, feedbackEntry, formatLedgerLine, formatSubjectBrief, imageTokens, mapDirection, nextVersion, parseLedger, parseSubjectBrief, refOk,
  renderDataSheet, sortVersions, sourceHash, stemOf, subjectDataSheet, subjectKey, subjectReviewSheet, subjectStatus, subjects, versionFile, versionOfFile,
  type Change, type Check, type DataSheet, type LedgerEntry, type SheetRef, type SubjectBrief, type SubjectKind,
} from 'artgen-core/maps';
import { renderDungeonFiles } from './dungeon.ts';
import { renderMapFiles } from './map.ts';
import type { Project } from './projectfs.ts';
import { renderSettlementFiles } from './settlement.ts';

export { formatLedgerLine };
export type { SubjectKind };

const SUBJECTS = subjects.SUBJECTS;
export const KIND_NOUN: Record<SubjectKind, string> = { map: 'terrain map', dungeon: 'dungeon', settlement: 'settlement' };
const ID = /^[\w-]+$/;
/** The longest side of a review render, in pixels, before the sheet shrinks it. */
const RENDER_EDGE = 900;

export const ledgerPath = (p: Project): string => join(p.art, 'ledger.jsonl');
export const directionPath = (p: Project): string => join(p.art, mapDirection.DIRECTION_FILE);
/** A path from the art folder, with forward slashes (how ledger entries name files). */
export const relArt = (p: Project, f: string): string => relative(p.art, f).split('\\').join('/');
/** A path from the project root, with forward slashes (how results show files). */
export const relRoot = (p: Project, f: string): string => relative(p.root, f).split('\\').join('/');

/** Append one entry to `art/ledger.jsonl` (created with its folder if missing). */
export function appendLedger(path: string, entry: Omit<LedgerEntry, 'ts'> & { ts?: string }): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, formatLedgerLine({ ts: new Date().toISOString(), ...entry } as LedgerEntry) + '\n');
}

export interface Paths { kind: SubjectKind; id: string; key: string; dir: string; stem: string; file: string; brief: string; out: string; version(v: string): string }

/** The files of one subject. Ids are names, never paths, so nothing outside `art/<dir>` is touched. */
export function subjectPaths(p: Project, kind: SubjectKind, id: string): Paths {
  if (!ID.test(id ?? '')) throw new Error(`${kind} id ${JSON.stringify(id)}: letters, digits, - and _ only`);
  const s = SUBJECTS[kind], dir = join(p.art, s.dir, id), stem = stemOf(s);
  return { kind, id, key: subjectKey(kind, id), dir, stem, file: join(dir, s.file), brief: join(dir, `${stem}.brief.md`), out: join(dir, 'out'), version: v => join(dir, versionFile(stem, v)) };
}

/** The working file's text. */
export function readWorking(p: Project, kind: SubjectKind, id: string): string {
  const f = subjectPaths(p, kind, id).file;
  if (!existsSync(f)) throw new Error(`no ${kind} ${id} (${relRoot(p, f)}) — artgen ${kind} new ${id}`);
  return readFileSync(f, 'utf8');
}

/** The ids of the subjects of a kind in the project (those with a working file), sorted. */
export function listSubjectIds(p: Project, kind: SubjectKind): string[] {
  const root = join(p.art, SUBJECTS[kind].dir);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(root, d.name, SUBJECTS[kind].file))).map(d => d.name).sort();
}

export function listVersions(p: Project, kind: SubjectKind, id: string): string[] {
  const { dir, stem } = subjectPaths(p, kind, id);
  return existsSync(dir) ? sortVersions(readdirSync(dir).map(f => versionOfFile(stem, f)).filter((v): v is string => !!v)) : [];
}

export const readLedger = (p: Project): LedgerEntry[] => (existsSync(ledgerPath(p)) ? parseLedger(readFileSync(ledgerPath(p), 'utf8')) : []);
export const entriesOf = (p: Project, kind: SubjectKind, id: string): LedgerEntry[] => readLedger(p).filter(e => e.asset === subjectKey(kind, id));

/** `art/map-direction.json`, or null when there is none. */
export function readDirection(p: Project): mapDirection.MapDirection | null {
  const f = directionPath(p);
  if (!existsSync(f)) return null;
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${relRoot(p, f)}: not JSON (${(e as Error).message})`); }
  try { return mapDirection.parseMapDirection(raw); } catch (e) { throw new Error(`${relRoot(p, f)}: ${(e as Error).message}`); }
}

/** The checks of a file's text, under the locked map direction's symbol set. */
export function checksOf(p: Project, kind: SubjectKind, id: string, text: string): Check[] {
  const { dir } = subjectPaths(p, kind, id);
  return subjects.checkSource(kind, text, { exists: rel => existsSync(resolve(dir, rel)), symbols: mapDirection.symbolsFor(readDirection(p), kind) });
}

export interface State { paths: Paths; text: string; entries: LedgerEntry[]; versions: string[]; direction: mapDirection.MapDirection | null; status: ReturnType<typeof subjectStatus> }

/** Everything the rules need for one subject: its files, ledger lines, the map direction, and its status. */
export function subjectState(p: Project, kind: SubjectKind, id: string): State {
  const paths = subjectPaths(p, kind, id), text = readWorking(p, kind, id), direction = readDirection(p), entries = entriesOf(p, kind, id);
  return { paths, text, entries, versions: listVersions(p, kind, id), direction, status: subjectStatus({ entries, key: paths.key, workingHash: sourceHash(text), direction: mapDirection.directionRef(direction) }) };
}

const fails = (checks: Check[]): Check[] => checks.filter(c => c.status === 'fail');
const flags = (checks: Check[]): Check[] => checks.filter(c => c.status === 'flag');
const hint = (kind: SubjectKind, cmd: string, id: string) => `artgen ${kind} ${cmd} ${id}`;

// ---- brief and references

export function readBrief(p: Project, kind: SubjectKind, id: string): { path: string; text: string; brief: SubjectBrief } | null {
  const f = subjectPaths(p, kind, id).brief;
  if (!existsSync(f)) return null;
  const text = readFileSync(f, 'utf8');
  return { path: relRoot(p, f), text, brief: parseSubjectBrief(text) };
}

/** Write the brief: the text and/or the references given; what is not given stays. */
export function writeBrief(p: Project, kind: SubjectKind, id: string, o: { text?: string; refs?: string[] }): { path: string; brief: SubjectBrief } {
  readWorking(p, kind, id);
  const paths = subjectPaths(p, kind, id), had = readBrief(p, kind, id)?.brief ?? { refs: [], body: '' };
  for (const r of o.refs ?? []) if (!refOk(r)) throw new Error(`--refs ${r}: a path under art/ (no .. and not absolute)`);
  const next = { title: had.title, refs: o.refs ?? had.refs, body: o.text ?? had.body };
  writeFileSync(paths.brief, formatSubjectBrief(next));
  return { path: relRoot(p, paths.brief), brief: parseSubjectBrief(formatSubjectBrief(next)) };
}

/** The reference PNGs of a brief; one that is not a PNG, is missing, or does not decode is skipped with a warning. */
export function loadRefs(p: Project, refs: string[]): { refs: SheetRef[]; warnings: string[] } {
  const out: SheetRef[] = [], warnings: string[] = [];
  for (const r of refs) {
    const f = resolve(p.art, r);
    if (!refOk(r)) warnings.push(`${r}: not a path under art/, skipped`);
    else if (extname(r).toLowerCase() !== '.png') warnings.push(`${r}: not a PNG, skipped`);
    else if (!existsSync(f)) warnings.push(`${r}: no such file, skipped`);
    else try { out.push({ label: r.split('/').pop()!.replace(/\.png$/i, ''), grid: decodePNG(new Uint8Array(readFileSync(f))) }); } catch { warnings.push(`${r}: not a readable PNG, skipped`); }
  }
  return { refs: out, warnings };
}

// ---- versions and diffs

/** Record the working file as the next version. Refused when nothing changed since the latest one, or when it does not parse. */
export function recordVersion(p: Project, kind: SubjectKind, id: string, o: { note?: string; by?: 'agent' | 'user' } = {}): { version: string; file: string; sourceHash: string; wallMs?: number } {
  const st = subjectState(p, kind, id);
  try { SUBJECTS[kind].parse(JSON.parse(st.text)); } catch (e) { throw new Error(`${id}: the file does not parse, so it cannot be a version — ${(e as Error).message}`); }
  const latest = st.versions[st.versions.length - 1], hash = sourceHash(st.text);
  if (latest && sourceHash(readFileSync(st.paths.version(latest), 'utf8')) === hash) throw new Error(`${id}: no change since ${latest}`);
  const version = nextVersion(st.versions), file = st.paths.version(version), prev = st.entries[st.entries.length - 1];
  copyFileSync(st.paths.file, file);
  const wallMs = prev ? Math.max(0, Date.now() - Date.parse(prev.ts)) : undefined;
  appendLedger(ledgerPath(p), { type: 'version', asset: st.paths.key, version, file: relArt(p, file), sourceHash: hash, ...(o.note && { note: o.note }), by: o.by ?? 'agent', ...(Number.isFinite(wallMs) && { wallMs }) });
  return { version, file: relRoot(p, file), sourceHash: hash, ...(Number.isFinite(wallMs) && { wallMs }) };
}

/** What changed between two versions of a subject; `working` names the working file. Default: the latest version → the working file. */
export function diffVersions(p: Project, kind: SubjectKind, id: string, a?: string, b?: string): { from: string; to: string; changes: Change[] } {
  const st = subjectState(p, kind, id), latest = st.versions[st.versions.length - 1];
  if (!st.versions.length) throw new Error(`${id}: no version yet — ${hint(kind, 'version', id)}`);
  const read = (name: string): unknown => {
    const f = name === 'working' ? st.paths.file : st.paths.version(name);
    if (name !== 'working' && !st.versions.includes(name)) throw new Error(`${id}: no ${name} (have ${st.versions.join(', ')}, or working)`);
    return JSON.parse(readFileSync(f, 'utf8'));
  };
  const from = a ?? latest, to = b ?? (a ? latest : 'working');
  return { from, to, changes: diffJson(read(from), read(to)) };
}

// ---- review

async function renderPng(kind: SubjectKind, file: string, theme: string, out: string, text: string): Promise<string> {
  const size = subjects.sizeOf(text), edge = size ? Math.max(size.cols, size.rows) : 30, ref = { file };
  const ppu = Math.max(4, Math.min({ map: 40, dungeon: 40, settlement: 24 }[kind], Math.floor(RENDER_EDGE / edge)));
  if (kind === 'map') return resolve((await renderMapFiles(null, ref, { themes: [theme as 'color' | 'bw'], formats: ['png'], ppu, out })).files[0]);
  if (kind === 'dungeon') return resolve((await renderDungeonFiles(null, ref, { formats: ['png'], ppu, out })).files[0]);
  return resolve((await renderSettlementFiles(null, ref, { themes: [theme as 'color' | 'bw'], formats: ['png'], ppu, out }))[0].files[0]);
}

/** The data sheet of a subject: the engine's rows, then the theme and version, the brief's notes and references. */
function sheetOf(p: Project, st: State, text: string, checks: Check[], version?: string): { sheet: DataSheet; refs: SheetRef[]; warnings: string[] } {
  const { kind, id } = st.paths, base = SUBJECTS[kind].sheet(SUBJECTS[kind].parse(JSON.parse(text)), checks), brief = readBrief(p, kind, id)?.brief;
  const { refs, warnings } = loadRefs(p, brief?.refs ?? []);
  return { sheet: subjectDataSheet(base, { version, theme: mapDirection.themeFor(st.direction, kind), directionVersion: mapDirection.lockedMapDirection(st.direction)?.version, brief }), refs, warnings };
}

export interface Review { version: string; sheet: string; sheetFile: string; imageTokens: number; pass: boolean; checks: Check[]; warnings: string[]; score?: number }

/**
 * Render a version (default: the latest) in the map direction's theme, put the render, the data sheet and the references on one
 * review sheet (`out/review-v<N>.png`) and log it. `score` also logs a score entry for that version.
 */
export async function reviewSubject(p: Project, kind: SubjectKind, id: string, o: { version?: string; score?: number; note?: string; reviewer?: string } = {}): Promise<Review> {
  const st = subjectState(p, kind, id);
  if (!st.versions.length) throw new Error(`${id}: no version yet — ${hint(kind, 'version', id)}`);
  const version = o.version ?? st.versions[st.versions.length - 1];
  if (!st.versions.includes(version)) throw new Error(`${id}: no ${version} (have ${st.versions.join(', ')})`);
  if (o.score !== undefined && !(o.score >= 0 && o.score <= 10)) throw new Error('--score: a number from 0 to 10');
  const vfile = st.paths.version(version), text = readFileSync(vfile, 'utf8'), checks = checksOf(p, kind, id, text), theme = mapDirection.themeFor(st.direction, kind);
  const png = await renderPng(kind, vfile, theme, st.paths.out, text), { sheet, refs, warnings } = sheetOf(p, st, text, checks, version);
  const grid = subjectReviewSheet({ title: `${id} - ${version}`, render: decodePNG(new Uint8Array(readFileSync(png))), sheet, refs }), sheetFile = join(st.paths.out, `review-${version}.png`);
  mkdirSync(st.paths.out, { recursive: true });
  writeFileSync(sheetFile, encodePNG(grid));
  const tokens = imageTokens(grid.w, grid.h), conformance = { pass: !fails(checks).length, checks };
  appendLedger(ledgerPath(p), { type: 'review', asset: st.paths.key, version, sheet: relArt(p, sheetFile), imageTokens: tokens, conformance, by: 'agent' });
  if (o.score !== undefined) appendLedger(ledgerPath(p), { type: 'score', asset: st.paths.key, version, score: o.score, ...(o.note && { note: o.note }), reviewer: o.reviewer ?? 'self', conformance, by: 'agent' });
  return { version, sheet: relRoot(p, sheetFile), sheetFile, imageTokens: tokens, pass: conformance.pass, checks, warnings, ...(o.score !== undefined && { score: o.score }) };
}

/** The one-page data sheet of the working file: `out/sheet.png` and `out/sheet.json`. */
export function writeSheet(p: Project, kind: SubjectKind, id: string): { png: string; pngFile: string; json: string; sheet: DataSheet; markdown: string; warnings: string[] } {
  const st = subjectState(p, kind, id), checks = checksOf(p, kind, id, st.text), { sheet, refs, warnings } = sheetOf(p, st, st.text, checks);
  mkdirSync(st.paths.out, { recursive: true });
  const png = join(st.paths.out, 'sheet.png'), json = join(st.paths.out, 'sheet.json');
  writeFileSync(png, encodePNG(renderDataSheet(sheet, { refs })));
  writeFileSync(json, JSON.stringify(sheet, null, 2) + '\n');
  return { png: relRoot(p, png), pngFile: png, json: relRoot(p, json), sheet, markdown: dataSheetMarkdown(sheet), warnings };
}

// ---- the user's decisions

/** The user's feedback on the latest version; it opens a revision. */
export function feedbackSubject(p: Project, kind: SubjectKind, id: string, o: { note: string; region?: number[]; via?: string }): { on: string; status: string; why: string } {
  const st = subjectState(p, kind, id), entry = feedbackEntry({ kind, id, key: st.paths.key, latest: st.versions[st.versions.length - 1] }, o);
  appendLedger(ledgerPath(p), entry);
  const after = subjectState(p, kind, id).status;
  return { on: entry.on as string, status: after.status, why: after.why };
}

/** The user's approval of the latest version: it must be final (no unrecorded edits, no feedback open) and no check may fail. Flags are copied into the entry. */
export function approveSubject(p: Project, kind: SubjectKind, id: string, o: { note?: string; via?: string } = {}): LedgerEntry {
  const st = subjectState(p, kind, id), version = st.status.version;
  // the checks of the version the user approves: the working file is it when the status is final
  const checks = st.status.status === 'final' && version ? checksOf(p, kind, id, readFileSync(st.paths.version(version), 'utf8')) : [];
  const entry = approvalEntry({ kind, id, key: st.paths.key, status: st.status, checks, workingHash: sourceHash(st.text), direction: mapDirection.directionRef(st.direction) }, o);
  appendLedger(ledgerPath(p), entry);
  return { ts: new Date().toISOString(), ...entry } as LedgerEntry;
}

// ---- status

export interface StatusRow { id: string; kind: SubjectKind; status: string; version?: string; why: string; fail: number; flag: number }

/** One row per subject of a kind (or the ids given). */
export function statusRows(p: Project, kind: SubjectKind, ids?: string[]): StatusRow[] {
  return (ids?.length ? ids : listSubjectIds(p, kind)).map(id => {
    const st = subjectState(p, kind, id), checks = checksOf(p, kind, id, st.text);
    return { id, kind, status: st.status.status, ...(st.status.version && { version: st.status.version }), why: st.status.why, fail: fails(checks).length, flag: flags(checks).length };
  });
}

/** The ledger lines of one subject that tell its story: versions with notes, reviews, scores, feedback, approvals. */
export function history(p: Project, kind: SubjectKind, id: string): { ts: string; type: string; version?: string; by?: string; text: string }[] {
  return entriesOf(p, kind, id).filter(e => ['version', 'review', 'score', 'feedback', 'approve'].includes(e.type)).map(e => ({
    ts: e.ts, type: e.type, ...(typeof (e.version ?? e.on) === 'string' && { version: String(e.version ?? e.on) }), ...(e.by && { by: e.by }),
    text: e.type === 'score' ? `${e.score}${e.reviewer ? ` by ${String(e.reviewer)}` : ''}${e.note ? `: ${String(e.note)}` : ''}` : e.type === 'review' ? `${e.conformance?.pass === false ? 'checks fail, ' : ''}~${String(e.imageTokens ?? 0)} image tokens` : String(e.note ?? ''),
  }));
}

// ---- the map direction

export interface DirectionResult { direction: mapDirection.MapDirection | null; file: string; changed: boolean; locked: boolean }

/** Show the map direction, change its draft, or lock it (the user's call: a lock is an approval in the ledger). */
export function runDirection(p: Project, o: { theme?: string; symbols?: string; lock?: boolean; note?: string; via?: string }): DirectionResult {
  const had = readDirection(p), file = relRoot(p, directionPath(p));
  const themes = o.theme ? mapDirection.parseThemeFlag(o.theme) : undefined, symbols = o.symbols ? mapDirection.parseSymbolsFlag(o.symbols) : undefined;
  if (!themes && !symbols && !o.lock) return { direction: had, file, changed: false, locked: false };
  let d = had ?? mapDirection.newMapDirection();
  const edited = !!(themes || symbols);
  if (edited) d = mapDirection.editMapDirection(d, { themes, symbols });
  if (o.lock) {
    if (!had && !edited) throw new Error('map direction --lock: nothing to lock yet — set a theme or symbols first (--theme map=bw, --symbols dungeon=altar,statue)');
    if (!edited && d.status === 'locked') throw new Error(`map direction is already locked at v${d.version} — change a theme or symbols first`);
    d = mapDirection.lockMapDirection(d);
  }
  mkdirSync(p.art, { recursive: true });
  writeFileSync(directionPath(p), mapDirection.formatMapDirection(d));
  if (o.lock) appendLedger(ledgerPath(p), { type: 'approve', asset: 'maps:direction', version: `v${d.version}`, note: o.note ?? '', by: 'user', ...(o.via && { via: o.via }) });
  return { direction: d, file, changed: true, locked: !!o.lock };
}
