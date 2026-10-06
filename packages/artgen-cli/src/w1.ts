/**
 * W1 art direction on disk (SPEC §4.2, PLAN P2): interview → 3 candidates → style tiles (the same probe set
 * under each candidate) → choose / mix → lock (anchors + `art/direction.png`).
 *
 *   art/interview.json            the interview answers (pitch, view, mood, scale, colours …)
 *   art/candidates/<name>.json    candidate directions (a, b, c, mix1, …)
 *   art/candidates/style-tile-r<N>.png   one sheet per tile round, one column per candidate
 *   art/probes/<kind>/            probe assets (character, prop, tile, effect): brief.json, base.vN.js, finish.vM.js
 *   art/direction.json, art/anchors/<kind>.png, art/direction.png   written by lock
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import {
  describeDirection, generateCandidates, Grid, imageTokens, lockDirection, mixDirections, MIX_PARTS, paletteLuma, parseDirection,
  PROBE_KINDS, styleSheet, styleTile, validateDirection,
  type Direction, type Interview, type MixPart, type ProbeImages, type StyleTileColumn,
} from 'artgen-core';
import { ledgerFor, renderVersion, versionsIn, type AssetBrief, type AssetDir, type VersionRender } from './asset.ts';
import { appendLedger, writeGrid } from './node.ts';
import { isPlaceholderDirection, readJson, writeJson, type Project } from './project.ts';
import { newAsset } from './templates.ts';

const cdir = (p: Project) => join(p.art, 'candidates');
const probeDir = (p: Project, kind: string) => join(p.art, 'probes', kind);
const ledgerPath = (p: Project) => join(p.art, 'ledger.jsonl');
const rel = (p: Project, f: string) => relative(p.root, f).split('\\').join('/');

/** Candidate names on disk, a/b/c first, then mixes and drafts in name order. */
export function candidateNames(p: Project): string[] {
  if (!existsSync(cdir(p))) return [];
  return readdirSync(cdir(p)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
    .sort((x, y) => (x.length === 1 ? 0 : 1) - (y.length === 1 ? 0 : 1) || x.localeCompare(y, 'en', { numeric: true }));
}

/** A candidate by name (`a`, `mix1`), or a direction file path. */
export function loadCandidate(p: Project, name: string): Direction {
  const file = existsSync(join(cdir(p), `${name}.json`)) ? join(cdir(p), `${name}.json`) : name;
  if (!existsSync(file)) throw new Error(`no candidate ${name} (have: ${candidateNames(p).join(', ') || 'none — run direction candidates'})`);
  return parseDirection(readJson(file));
}

/** The locked direction, or null while `art/direction.json` is still the placeholder. */
export function lockedDirection(p: Project): Direction | null {
  const f = join(p.art, 'direction.json');
  if (!existsSync(f)) return null;
  const raw = readJson(f);
  return isPlaceholderDirection(raw) ? null : parseDirection(raw);
}

/** Copy the probe templates for the view into `art/probes/<kind>/` (kinds that already exist are kept). */
export function ensureProbes(p: Project, view: string): { created: string[]; fallbacks: string[] } {
  const created: string[] = [], fallbacks: string[] = [];
  for (const kind of PROBE_KINDS) {
    const d = probeDir(p, kind);
    if (existsSync(join(d, 'brief.json'))) continue;
    const r = newAsset(d, { id: `probe-${kind}`, kind, view });
    created.push(...r.files.map(f => rel(p, f)));
    if (r.template.fallback) fallbacks.push(`${kind}: ${view} has no template yet, used ${r.template.view}/${r.template.kind}`);
  }
  return { created, fallbacks };
}

export interface CandidatesResult { interview: string; candidates: { name: string; file: string; summary: string[] }[]; probes: string[]; fallbacks: string[] }

/** Interview → `art/interview.json` + `art/candidates/{a,b,c}.json` (existing candidates are replaced) + probe set. */
export function writeCandidates(p: Project, iv: Interview): CandidatesResult {
  const ivFile = join(p.art, 'interview.json');
  writeJson(ivFile, iv);
  const dirs = generateCandidates(iv), out: CandidatesResult['candidates'] = [];
  dirs.forEach((d, i) => {
    const name = 'abc'[i], file = join(cdir(p), `${name}.json`);
    writeJson(file, d);
    out.push({ name, file: rel(p, file), summary: [d.theme.notes ?? '', ...describeDirection(d)] });
  });
  const probes = ensureProbes(p, iv.view ?? 'topdown');
  appendLedger(ledgerPath(p), { type: 'note', asset: 'direction', note: `candidates ${out.map(c => c.name).join(', ')} from interview`, by: 'agent' });
  return { interview: rel(p, ivFile), candidates: out, probes: probes.created, fallbacks: probes.fallbacks };
}

/** The version a probe shows on a tile: its latest finish, else its latest base (the short pipeline, PLAN P2). */
export function probeVersion(a: AssetDir): string {
  const vs = versionsIn(a);
  if (!vs.length) throw new Error(`${a.path}: no base.vN.js`);
  return [...vs].reverse().find(v => v.startsWith('finish.')) ?? vs.filter(v => v.startsWith('base.')).pop()!;
}

function probeAsset(p: Project, kind: string, dir: Direction): AssetDir {
  const path = probeDir(p, kind), brief = readJson<AssetBrief>(join(path, 'brief.json'));
  return { path, brief: { ...brief, id: brief.id ?? `probe-${kind}` }, dir, ledgerPath: ledgerPath(p) };
}

/** Render the probe set under one direction. */
export async function renderProbes(p: Project, dir: Direction, opts: { versions?: Partial<Record<string, string>> } = {}) {
  const renders: Record<string, VersionRender> = {};
  for (const kind of PROBE_KINDS) {
    const a = probeAsset(p, kind, dir);
    renders[kind] = await renderVersion(a, opts.versions?.[kind] ?? probeVersion(a));
  }
  const cell = (k: string) => renders[k].render.cells[0].grid;
  const images: ProbeImages = { character: cell('character'), prop: cell('prop'), tile: cell('tile'), effect: renders.effect.render.cells.map(c => c.grid) };
  return { renders, images };
}

export interface TileResult { path: string; round: number; tokens: number; columns: { name: string; id: string; gates: Record<string, boolean>; failing: string[] }[]; distinct: { pairs: number; minLumaGap: number } }

/** Render every candidate (or the named ones) into one style tile sheet: `art/candidates/style-tile-r<N>.png`. */
export async function writeTile(p: Project, names?: string[]): Promise<TileResult> {
  const list = names?.length ? names : candidateNames(p);
  if (!list.length) throw new Error('no candidates — run `artgen direction candidates` first');
  const columns: StyleTileColumn[] = [], info: TileResult['columns'] = [], hashes: string[] = [];
  for (const name of list) {
    const dir = loadCandidate(p, name), { renders, images } = await renderProbes(p, dir);
    const gates = Object.fromEntries(Object.entries(renders).map(([k, r]) => [k, r.report.pass]));
    const failing = Object.entries(renders).flatMap(([k, r]) => r.report.checks.filter(c => c.status === 'fail').map(c => `${k}.${c.id}: ${c.detail}`));
    columns.push({ label: `${name.length === 1 ? name.toUpperCase() : name} - ${dir.id}`, notes: describeDirection(dir), dir, probes: images, gates });
    info.push({ name, id: dir.id, gates, failing });
    hashes.push(images.character.hash() + images.prop.hash());
  }
  const versions = PROBE_KINDS.map(k => `${k} ${probeVersion(probeAsset(p, k, loadCandidate(p, list[0])))}`).join(', ');
  const round = (existsSync(cdir(p)) ? readdirSync(cdir(p)).filter(f => /^style-tile-r\d+\.png$/.test(f)).length : 0) + 1;
  const sheet = styleTile(`style tile round ${round}: ${versions}`, columns);
  const path = join(cdir(p), `style-tile-r${round}.png`);
  writeGrid(path, sheet);
  const tokens = imageTokens(sheet.w, sheet.h);
  appendLedger(ledgerPath(p), { type: 'review', asset: 'direction', version: `tile-r${round}`, sheet: relative(p.art, path).split('\\').join('/'), imageTokens: tokens, candidates: list, by: 'agent' });
  const dirs = list.map(n => loadCandidate(p, n)), lumas = dirs.map(paletteLuma);
  let minGap = Infinity;
  for (let i = 0; i < lumas.length; i++) for (let j = i + 1; j < lumas.length; j++) minGap = Math.min(minGap, Math.abs(lumas[i] - lumas[j]));
  return { path: rel(p, path), round, tokens, columns: info, distinct: { pairs: new Set(hashes).size, minLumaGap: Number.isFinite(minGap) ? Math.round(minGap * 10) / 10 : 0 } };
}

/** "A's palette, B's outlines": a new candidate `mix<N>` from `base` with parts taken from others. */
export function writeMix(p: Project, base: string, take: Partial<Record<MixPart, string>>, name?: string): { name: string; file: string; dir: Direction } {
  const n = name ?? `mix${candidateNames(p).filter(c => c.startsWith('mix')).length + 1}`;
  const parts: Partial<Record<MixPart, Direction>> = {};
  for (const [part, src] of Object.entries(take) as [MixPart, string][]) {
    if (!MIX_PARTS.includes(part)) throw new Error(`unknown part ${part} (have: ${MIX_PARTS.join(', ')})`);
    parts[part] = loadCandidate(p, src);
  }
  const b = loadCandidate(p, base), d = mixDirections(b, parts, `${b.id.replace(/-[a-z]$/, '')}-${n}`);
  d.theme.notes = `mix ${n}: ${base.toUpperCase()} as the base${Object.entries(take).map(([k, v]) => `, ${k} from ${String(v).toUpperCase()}`).join('')}`;
  const file = join(cdir(p), `${n}.json`);
  writeJson(file, d);
  appendLedger(ledgerPath(p), { type: 'note', asset: 'direction', note: d.theme.notes, by: 'user' });
  return { name: n, file: rel(p, file), dir: d };
}

/** Start a new draft from the locked direction (or a candidate) — the first step of a direction version change. */
export function writeDraft(p: Project, from?: string, name = 'next'): { name: string; file: string } {
  const src = from ? loadCandidate(p, from) : lockedDirection(p);
  if (!src) throw new Error('nothing to start from: no locked direction; use --from <candidate>');
  const d = { ...JSON.parse(JSON.stringify(src)), status: 'draft' };
  const file = join(cdir(p), `${name}.json`);
  writeJson(file, d);
  return { name, file: rel(p, file) };
}

export interface AnchorsResult { anchors: string[]; sheet: string; versions: Record<string, string>; gates: Record<string, boolean> }

/** Render each probe's current version under the locked direction to `art/anchors/<kind>.png`; rewrite `art/direction.png`. */
export async function writeAnchors(p: Project): Promise<AnchorsResult> {
  const dir = lockedDirection(p);
  if (!dir) throw new Error('art/direction.json is not locked yet — run `artgen direction lock <candidate>`');
  const { renders, images } = await renderProbes(p, dir), files: string[] = [], list: { label: string; grid: Grid }[] = [];
  const strip = (fs: Grid[]) => { const g = new Grid(fs.reduce((n, f) => n + f.w, 0) + fs.length - 1, Math.max(...fs.map(f => f.h))); let x = 0; for (const f of fs) { g.blit(f, x, 0); x += f.w + 1; } return g; };
  for (const kind of PROBE_KINDS) {
    const g = kind === 'effect' ? strip(images.effect) : images[kind as 'character' | 'prop' | 'tile'];
    const f = join(p.art, 'anchors', `${kind}.png`);
    writeGrid(f, g);
    files.push(relative(p.art, f).split('\\').join('/'));
    list.push({ label: kind, grid: g });
  }
  const file = join(p.art, 'direction.json'), raw = readJson<Record<string, unknown>>(file);
  writeJson(file, { ...raw, anchors: files });
  const sheet = join(p.art, 'direction.png');
  writeGrid(sheet, styleSheet({ ...dir, anchors: files }, list));
  const versions = Object.fromEntries(Object.entries(renders).map(([k, r]) => [k, r.version]));
  appendLedger(ledgerPath(p), { type: 'note', asset: 'direction', version: `v${dir.version}`, note: `anchors from probes ${Object.entries(versions).map(([k, v]) => `${k} ${v}`).join(', ')}`, by: 'agent' });
  return { anchors: files.map(f => `art/${f}`), sheet: rel(p, sheet), versions, gates: Object.fromEntries(Object.entries(renders).map(([k, r]) => [k, r.report.pass])) };
}

/** Lock a candidate: `art/direction.json` (status locked, version bumped), anchors and the style sheet. */
export async function lock(p: Project, name: string, opts: { id?: string; note?: string } = {}): Promise<{ direction: Direction; file: string } & AnchorsResult> {
  const chosen = loadCandidate(p, name), prev = lockedDirection(p);
  const d = lockDirection(chosen, prev, opts.id);
  d.theme = { ...d.theme, notes: `${d.theme.notes ?? ''}${opts.note ? `. ${opts.note}` : ''}`.trim() };
  const file = join(p.art, 'direction.json');
  writeJson(file, d);
  appendLedger(ledgerPath(p), { type: 'approve', asset: 'direction', version: `v${d.version}`, note: `locked ${name}${opts.note ? `: ${opts.note}` : ''}`, direction: { id: d.id, version: d.version }, by: 'user' });
  const anchors = await writeAnchors(p);
  return { direction: lockedDirection(p)!, file: rel(p, file), ...anchors };
}

/** Summary of the project's direction state. */
export function show(p: Project): { locked: Direction | null; candidates: { name: string; id: string; status: string; summary: string[] }[]; tiles: string[]; probes: Record<string, string>; history: number } {
  const locked = lockedDirection(p);
  const candidates = candidateNames(p).map(n => {
    const raw = readJson(join(cdir(p), `${n}.json`)), r = validateDirection(raw);
    return r.ok ? { name: n, id: r.direction!.id, status: r.direction!.status, summary: describeDirection(r.direction!) } : { name: n, id: '?', status: 'invalid', summary: r.errors.slice(0, 3) };
  });
  const tiles = existsSync(cdir(p)) ? readdirSync(cdir(p)).filter(f => /^style-tile-r\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(12)) - parseInt(b.slice(12))).map(f => rel(p, join(cdir(p), f))) : [];
  const probes: Record<string, string> = {};
  for (const k of PROBE_KINDS) if (existsSync(join(probeDir(p, k), 'brief.json'))) {
    const a = { path: probeDir(p, k), brief: readJson<AssetBrief>(join(probeDir(p, k), 'brief.json')), dir: undefined as unknown as Direction, ledgerPath: ledgerPath(p) };
    probes[k] = versionsIn(a).join(' ');
  }
  const history = existsSync(ledgerPath(p)) ? ledgerFor({ brief: { id: 'direction' }, ledgerPath: ledgerPath(p) } as AssetDir).length : 0;
  return { locked, candidates, tiles, probes, history };
}

export const readInterview = (file: string): Interview => {
  const iv = JSON.parse(readFileSync(file, 'utf8')) as Interview;
  if (!iv.pitch) throw new Error(`${basename(file)}: "pitch" is required`);
  return iv;
};
