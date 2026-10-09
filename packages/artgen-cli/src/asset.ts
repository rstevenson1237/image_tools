/**
 * Asset directories and the pass pipeline on disk (PLAN P1b). An asset directory holds `brief.json`,
 * `base.v<N>.js` and `finish.v<M>.js` (+ `finish.v<M>.snapshot.json`); scores and reviews go to the nearest
 * `ledger.jsonl` up the tree. In a game repo the brief comes from `art/briefs.yaml` (P3, the entry whose id is the
 * directory name) over the directory's own `brief.json` (template review settings); bench and probe assets keep
 * the whole brief in `brief.json`. Budgets come from `art/artgen.config.json` (D19).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyFinish, assembleSheet, budgetFor, finishBaseOf, conformance, contactSheet, parseBriefs, finishSnapshot, finishStale, Grid, imageTokens, iso, parseDirection, parseLedger,
  parseVersion, passId, planPasses, pxPerMetre, renderAsset, resolveSize, reviewSheet, sourceHash, stackStrip, parallaxStrip, TILE_KINDS, viewContext, autotileCount, autotileMap, autotileSheet,
  type AssetBudget, type AssetModule, type BriefEntry, type ConformanceReport, type FeedbackOpen, type Direction, type FinishModule, type LedgerEntry, type PassState,
  type PatchRecord, type RenderResult,
} from 'artgen-core';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import { strip } from './bench.ts';
import { appendLedger, initNodeSvg, readGrid, writeGrid } from './node.ts';
import { findProject, isPlaceholderDirection, projectConfig, type Project } from './project.ts';

export interface AssetBrief extends BriefEntry {
  /** Template the asset started from (`topdown/character`), recorded for analytics. */
  template?: string;
  /** Direction file (relative to the asset dir) or a bench direction name. Default: nearest direction.json. */
  direction?: string;
  review?: { scale?: number; bg?: string; iso?: boolean; sym?: 'x' | 'y' | 'none'; label?: string; /** tiles: the repeat is the design (bricks, panels) */ periodic?: boolean };
  /** Reference image shown on top of review sheets (e.g. the artlab final). */
  reference?: string;
  /** Score to beat. */
  target?: number;
}

export interface AssetDir {
  path: string;
  brief: AssetBrief;
  dir: Direction;
  ledgerPath: string;
  /** Game repo the asset belongs to (absent for bench assets outside a project). */
  project?: Project;
  /** Effective budget: revision passes (config per kind / tier, else the direction) and extra autonomous revisions. */
  budget?: AssetBudget;
}

export { budgetFor };

/** The brief for `id` in the project's `art/briefs.yaml`, if any (throws on an invalid file). */
export function projectBrief(p: Project, id: string): BriefEntry | undefined {
  const f = join(p.art, 'briefs.yaml');
  if (!existsSync(f)) return undefined;
  const r = parseBriefs(readFileSync(f, 'utf8'));
  if (!r.ok) throw new Error(`art/briefs.yaml:\n  ${r.errors.join('\n  ')}`);
  return r.briefs.find(b => b.id === id);
}

const CHARS_PER_TOKEN = 3.5;
export const codeTokens = (src: string): number => Math.ceil(src.length / CHARS_PER_TOKEN);

/** Tokens in lines that are new vs the previous version (approximate edit cost, artlab's measure). */
export function editTokens(prev: string | undefined, src: string): number {
  if (prev === undefined) return codeTokens(src);
  const pool = new Map<string, number>();
  for (const l of prev.split('\n')) pool.set(l, (pool.get(l) ?? 0) + 1);
  let added = '';
  for (const l of src.split('\n')) { const n = pool.get(l); if (n) pool.set(l, n - 1); else added += l + '\n'; }
  return codeTokens(added);
}

function findUp(start: string, name: string): string | null {
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, name))) return join(d, name);
    if (dirname(d) === d) return null;
  }
}

export function openAsset(path: string, opts: { direction?: string; ledger?: string } = {}): AssetDir {
  const briefPath = join(path, 'brief.json'), project = findProject(path) ?? undefined;
  const local = existsSync(briefPath) ? (JSON.parse(readFileSync(briefPath, 'utf8')) as AssetBrief) : undefined;
  const id = local?.id ?? basename(resolve(path)), fromYaml = project ? projectBrief(project, id) : undefined;
  if (!local && !fromYaml) throw new Error(`${path}: no brief.json and no brief "${id}" in art/briefs.yaml`);
  const brief = { ...local, ...fromYaml, id } as AssetBrief;
  // --direction is relative to the working directory, brief.direction to the asset directory
  const dname = opts.direction ?? brief.direction;
  let dir: Direction;
  if (dname && BENCH_DIRECTIONS[dname]) dir = parseDirection(BENCH_DIRECTIONS[dname]);
  else {
    const file = opts.direction ? resolve(opts.direction) : dname ? resolve(path, dname) : findUp(path, 'direction.json');
    if (!file) throw new Error(`${path}: no direction (brief.direction, --direction or a direction.json up the tree)`);
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (isPlaceholderDirection(raw)) throw new Error(`${file} is not locked yet — lock one with \`artgen direction lock <candidate>\`, or pass --direction art/candidates/<name>.json`);
    dir = parseDirection(raw);
  }
  const ledgerPath = opts.ledger ?? findUp(path, 'ledger.jsonl') ?? join(dirname(resolve(path)), 'ledger.jsonl');
  const cfg = project ? projectConfig(project) : undefined;
  return { path, brief, dir, ledgerPath, ...(project && { project }), budget: budgetFor(cfg, brief, dir) };
}

/** Revision passes for an asset: its budget, else the direction's. */
export const revisionPasses = (a: AssetDir): number => a.budget?.revisionPasses ?? a.dir.pipeline.revisionPasses;

/** User feedback that opened U-stage versions, in ledger order. */
export const feedbackOf = (a: AssetDir): FeedbackOpen[] =>
  ledgerFor(a).filter(e => e.type === 'feedback' && e.by === 'user' && typeof e.opens === 'string').map(e => ({
    route: e.route === 'finish' ? 'finish' : 'base', opens: e.opens as string,
    ...(typeof e.note === 'string' && { note: e.note }), ...(Array.isArray(e.region) && { region: e.region as number[] }), ...(typeof e.cell === 'string' && { cell: e.cell }),
  }));

/** Ledger pass id of a version for this asset (feedback-aware: r, x, u, f). */
export const passOf = (a: AssetDir, version: string): string => passId(version, revisionPasses(a), a.project ? feedbackOf(a).map(f => f.opens) : undefined);

export const versionsIn = (a: AssetDir): string[] =>
  readdirSync(a.path).map(f => parseVersion(f)?.name).filter((v): v is string => !!v)
    .sort((x, y) => { const a1 = parseVersion(x)!, b1 = parseVersion(y)!; return a1.kind === b1.kind ? a1.n - b1.n : a1.kind === 'base' ? -1 : 1; });

export const sourceOf = (a: AssetDir, version: string): string => readFileSync(join(a.path, `${version}.js`), 'utf8');

export function ledgerFor(a: AssetDir): LedgerEntry[] {
  return existsSync(a.ledgerPath) ? parseLedger(readFileSync(a.ledgerPath, 'utf8')).filter(e => e.asset === a.brief.id) : [];
}

/** Import an asset module; the URL carries a content hash so an edited file is never served from the module cache. */
async function load<T>(file: string): Promise<T> {
  return (await import(`${pathToFileURL(resolve(file)).href}?h=${sourceHash(readFileSync(file, 'utf8'))}`)) as T;
}

export interface VersionRender {
  version: string;
  render: RenderResult;
  /** Every cell side by side (hashed into the ledger; the `out/<version>.png` layout). */
  strip: Grid;
  /** Review layout: the strip for up to 8 cells, else one row per state × facing (mirrored facings left out). */
  grid: Grid;
  report: ConformanceReport;
  source: string;
  /** finish versions: the base they are bound to, their patches and any stale patches. */
  base?: string;
  patches?: PatchRecord[];
  stale?: string[];
}

/** Render one version (a finish renders its bound base first). */
export async function renderVersion(a: AssetDir, version: string, opts: { variant?: number; stages?: Map<string, Grid>; onScene?: (cell: string, scene: unknown) => void } = {}): Promise<VersionRender> {
  await initNodeSvg();
  const v = parseVersion(version);
  if (!v) throw new Error(`bad version ${version}`);
  const file = join(a.path, `${v.name}.js`);
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  const source = readFileSync(file, 'utf8');
  let render: RenderResult, base: string | undefined, patches: PatchRecord[] | undefined, stale: string[] | undefined, src = source;
  if (v.kind === 'base') render = renderAsset(await load<AssetModule>(file), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages, onScene: opts.onScene });
  else {
    const fin = await load<FinishModule>(file);
    base = fin.base;
    if (!parseVersion(base ?? '')) throw new Error(`${file}: export const base = 'base.vN' is required`);
    const baseRender = renderAsset(await load<AssetModule>(join(a.path, `${base}.js`)), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages, onScene: opts.onScene });
    const f = applyFinish(baseRender, fin, a.dir);
    render = f.render; patches = f.patches;
    const snap = join(a.path, `${v.name}.snapshot.json`);
    if (existsSync(snap) && !opts.variant) stale = finishStale(JSON.parse(readFileSync(snap, 'utf8')), patches);
    src = sourceOf(a, base) + '\n' + source;
  }
  const s = strip(render), grid = reviewGrid(render);
  const report = conformance({
    frames: render.cells.map(c => c.grid), dir: a.dir, kind: a.brief.kind, size: resolveSize(a.dir, a.brief.size, a.brief.kind),
    source: src, symAxis: a.brief.review?.sym ?? 'x', lint: render.lint, periodic: a.brief.review?.periodic, autotile: a.brief.autotile,
    ...(a.brief.height && { height: { metres: a.brief.height, pxPerMetre: pxPerMetre(a.dir) } }),
  });
  return { version: v.name, render, strip: s, grid, report, source, base, patches, stale };
}

/** Review context under a sprite: the iso floor (`review.iso`), else the view module's context (oblique room, side strip). */
export function contextFor(a: AssetDir, g: Grid): Grid | undefined {
  if (a.brief.review?.iso) return iso.isoFloor(g.w, g.h);
  const view = a.brief.view ?? a.dir.camera.view;
  if (a.brief.kind === 'layer') return undefined; // parallax layers are their own background
  return view === 'oblique' || view === 'side' ? viewContext(view, g.w, g.h, a.dir) : undefined;
}

/** The first facing's cells side by side (all states and frames). */
export function firstFacing(r: RenderResult): Grid {
  const f = r.facings[0];
  return strip({ ...r, cells: r.cells.filter(c => c.facing === f) });
}

/** Review layout for big sheets (8 facings × walk cycles): rows per state × unique facing, columns per frame. */
export function reviewGrid(r: RenderResult): Grid {
  // parallax layers (P6a): the layers in a row, and under it the scene scrolled to three camera positions, back
  // layers (earlier states) moving slower
  if (r.brief.kind === 'layer' && r.states.length > 1) {
    const cells = r.states.map(s => r.cells.find(c => c.state === s)!), row = strip({ ...r, cells });
    const layers = cells.map((c, i) => ({ grid: c.grid, depth: (i + 1) / cells.length }));
    const scroll = parallaxStrip(layers, r.size[0], [0, Math.round(r.size[0] / 3), Math.round((2 * r.size[0]) / 3)]);
    const g = new Grid(Math.max(row.w, scroll.w), row.h + 2 + scroll.h);
    g.blit(row, 0, 0); g.blit(scroll, 0, row.h + 2);
    return g;
  }
  // sprite stacks (P6a): the slices in a row, and under it the stack as the runtime draws it at 8 angles
  if (r.brief.view === 'stack') {
    const slices = r.cells.filter(c => c.state === r.states[0] && c.facing === r.facings[0]).map(c => c.grid);
    const row = strip({ ...r, cells: r.cells.filter(c => c.state === r.states[0] && c.facing === r.facings[0]) }), turn = stackStrip(slices, 8, 1);
    const g = new Grid(Math.max(row.w, turn.w), row.h + 2 + turn.h);
    g.blit(row, 0, 0); g.blit(turn, 0, row.h + 2);
    return g;
  }
  // autotile sets (P6b): the set in canonical order, and beside it an island resolved by the runtime's rule from it
  if (r.brief.autotile && r.cells.length >= autotileCount(r.brief.autotile)) {
    const tiles = r.cells.filter(c => c.state === r.states[0] && c.facing === r.facings[0]).map(c => c.grid);
    const sheet = autotileSheet(tiles, 8), map = autotileMap(tiles, r.brief.autotile, undefined, 8);
    const g = new Grid(sheet.w + 4 + map.w, Math.max(sheet.h, map.h));
    g.blit(sheet, 0, 0); g.blit(map, sheet.w + 4, 0);
    return g;
  }
  // tiles are judged tiled: each cell repeated 3×3, so seams show
  if (['tile', 'tileset', 'texture'].includes(r.brief.kind) && r.cells.length <= 4) {
    const [w, h] = r.size, isoTile = r.brief.view === 'iso' || (r.brief as AssetBrief).review?.iso;
    if (isoTile) { // iso diamonds tile staggered: every other row shifted half a tile
      const W = w * 3 + (w >> 1), H = (h >> 1) * 6 + (h >> 1), g = new Grid((W + 1) * r.cells.length - 1, H);
      r.cells.forEach((c, k) => { for (let j = 0; j < 7; j++) for (let i = -1; i < 4; i++) g.over(c.grid, k * (W + 1) + i * w + (j % 2) * (w >> 1), j * (h >> 1) - (h >> 1)); });
      return g;
    }
    const g = new Grid((w * 3 + 1) * r.cells.length - 1, h * 3);
    r.cells.forEach((c, k) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.blit(c.grid, k * (w * 3 + 1) + i * w, j * h); });
    return g;
  }
  if (r.cells.length <= 8) return strip(r);
  const facings = r.facings.filter(f => r.cells.some(c => c.facing === f && !c.mirrored));
  return assembleSheet({ ...r, facings, cells: r.cells.filter(c => facings.includes(c.facing)) }, 1).grid;
}

export function outDir(a: AssetDir): string { return join(a.path, 'out'); }

/** Write 1×, scaled and sheet PNGs for a version render. */
export function writeRender(a: AssetDir, r: VersionRender, out = outDir(a)): string[] {
  const sc = a.brief.review?.scale ?? 4, files = [join(out, `${r.version}.png`), join(out, `${r.version}@${sc}x.png`)];
  writeGrid(files[0], r.strip);
  writeGrid(files[1], r.strip.scale(sc));
  return files;
}

const rowLabel = (r: VersionRender, score?: number) =>
  `${r.version}${score !== undefined ? ` (${score})` : ''} | hyg ${r.report.metrics.hygiene} col ${r.report.metrics.colors} orph ${r.report.metrics.orphanPct}% | gate ${r.report.pass ? 'pass' : 'FAIL'}${r.stale?.length ? ' | FINISH-STALE' : ''}`;

/**
 * Review sheet (R7): reference (if any), the best-so-far and previous versions, then the version under review;
 * checker, scaled, in-context and silhouette panels. Records a `review` ledger line with the image-token estimate.
 * `blind` (rev 9): the version alone, labelled with the asset id only — no earlier versions, no scores, no pass — for
 * a fresh reviewer's blind re-score of a final.
 */
export async function reviewVersion(a: AssetDir, version: string, o: { blind?: boolean } = {}): Promise<{ path: string; tokens: number; render: VersionRender }> {
  const vs = versionsIn(a), cur = await renderVersion(a, version), R = a.brief.review ?? {}, sc = R.scale ?? 4;
  const sil = !TILE_KINDS.has(a.brief.kind);
  if (o.blind) {
    const sheet = reviewSheet({
      title: R.label ?? a.brief.id, anchors: anchorsFor(a), maxEdge: a.project ? projectConfig(a.project).budget?.maxSheetEdge : undefined,
      rows: [{ label: a.brief.id, grid: cur.grid, scale: sc, bg: R.bg ?? a.dir.background, context: contextFor(a, cur.grid), silhouette: sil }],
    });
    const path = join(outDir(a), `review-${version}-blind.png`), tokens = imageTokens(sheet.w, sheet.h);
    writeGrid(path, sheet);
    appendLedger(a.ledgerPath, { type: 'review', asset: a.brief.id, version, pass: 'b', blind: true, sheet: relPath(a, path), imageTokens: tokens, by: 'agent' });
    return { path, tokens, render: cur };
  }
  const scores = new Map(ledgerFor(a).filter(e => e.type === 'score' && !e.blind && e.version).map(e => [e.version!, e.score as number]));
  const ctx = (g: Grid) => contextFor(a, g);
  const rows: { label: string; grid: Grid; scale: number; bg?: string; context?: Grid; silhouette?: boolean }[] = [];
  if (a.brief.reference) {
    const ref = readGrid(resolve(a.path, a.brief.reference));
    rows.push({ label: `reference${a.brief.target !== undefined ? ` (target ${a.brief.target})` : ''}`, grid: ref, scale: sc, bg: R.bg, context: ctx(ref) });
  }
  const v = parseVersion(version)!, prev = v.kind === 'finish' ? cur.base : vs.filter(x => parseVersion(x)!.kind === 'base' && parseVersion(x)!.n < v.n).pop();
  const best = [...scores].filter(([k]) => parseVersion(k)?.kind === 'base' && k !== prev && k !== version).sort((x, y) => y[1] - x[1])[0]?.[0];
  // big sheets (8 facings × walk): earlier versions show their first facing only, so the version under review stays legible
  const big = cur.render.cells.length > 8;
  for (const other of [best, prev]) if (other) {
    const r = await renderVersion(a, other), grid = big ? firstFacing(r.render) : r.grid;
    rows.push({ label: rowLabel(r, scores.get(other)) + (big ? ' | first facing' : ''), grid, scale: sc, bg: R.bg ?? a.dir.background, context: ctx(grid), silhouette: sil });
  }
  rows.push({ label: `>> ${rowLabel(cur)}`, grid: cur.grid, scale: sc, bg: R.bg ?? a.dir.background, context: ctx(cur.grid), silhouette: sil });
  const sheet = reviewSheet({ title: `${R.label ?? a.brief.id} - ${version} (${passOf(a, version)})`, rows, anchors: anchorsFor(a), maxEdge: a.project ? projectConfig(a.project).budget?.maxSheetEdge : undefined });
  const path = join(outDir(a), `review-${version}.png`);
  writeGrid(path, sheet);
  writeRender(a, cur);
  const tokens = imageTokens(sheet.w, sheet.h);
  appendLedger(a.ledgerPath, { type: 'review', asset: a.brief.id, version, pass: passOf(a, version), sheet: relPath(a, path), imageTokens: tokens, by: 'agent' });
  return { path, tokens, render: cur };
}

/** Path as recorded in the ledger: relative to the ledger's folder. */
const relPath = (a: AssetDir, p: string) => relative(dirname(resolve(a.ledgerPath)), resolve(p)).split('\\').join('/');

/** Record a visual score for a version, with gate results, metrics and token estimates (analytics, D19). */
export async function scoreVersion(a: AssetDir, version: string, score: number, note = '', extra: Record<string, unknown> = {}): Promise<LedgerEntry> {
  const r = await renderVersion(a, version), v = parseVersion(version)!, pass = extra.blind === true ? 'b' : passOf(a, version);
  const vs = versionsIn(a).filter(x => parseVersion(x)!.kind === v.kind && parseVersion(x)!.n < v.n);
  const prevSrc = v.kind === 'finish' ? undefined : vs.length ? sourceOf(a, vs[vs.length - 1]) : undefined;
  const blind = extra.blind === true, reviews = ledgerFor(a).filter(e => e.type === 'review' && e.version === version && !!e.blind === blind);
  if (blind && !reviews.length) throw new Error(`${a.brief.id} ${version}: no blind sheet yet — artgen review ${a.brief.id} --version ${version} --blind, and give only that sheet to the reviewer`);
  if (v.kind === 'finish' && r.patches) {
    const snap = join(a.path, `${version}.snapshot.json`);
    if (!existsSync(snap)) writeFileSync(snap, JSON.stringify(finishSnapshot(r.patches)) + '\n');
  }
  // analytics (D19): the stage's model/effort from the config, wall time since the asset's previous record, Δ score
  const ledger = ledgerFor(a), prevTs = ledger.length ? Date.parse(ledger[ledger.length - 1].ts) : NaN;
  const scores = new Map(ledger.filter(e => e.type === 'score' && !e.blind && e.version).map(e => [e.version!, e.score as number]));
  const prevBase = versionsIn(a).filter(x => parseVersion(x)!.kind === 'base' && parseVersion(x)!.n < v.n && scores.has(x)).pop();
  const ref = blind ? undefined : v.kind === 'finish' ? r.base : prevBase, delta = ref && scores.has(ref) ? Math.round((score - scores.get(ref)!) * 100) / 100 : undefined;
  const entry = {
    type: 'score' as const, asset: a.brief.id, version, pass, score, note, sourceHash: sourceHash(r.source),
    outputHash: r.strip.hash(), direction: { id: a.dir.id, version: a.dir.version }, metrics: r.report.metrics,
    conformance: { pass: r.report.pass, checks: r.report.checks }, ...(r.base && { base: r.base }),
    tokens: { code: codeTokens(r.source), edit: editTokens(prevSrc, r.source), ...(extra.measured as object | undefined) },
    imageTokens: reviews.length ? (reviews[reviews.length - 1].imageTokens as number) : undefined, by: 'agent' as const,
    ...stageModel(a, pass), ...(Number.isFinite(prevTs) && { wallMs: Date.now() - prevTs }), ...(delta !== undefined && { delta }),
    ...(blind && scores.has(version) && { gap: Math.round((scores.get(version)! - score) * 100) / 100 }), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'measured')),
  };
  appendLedger(a.ledgerPath, entry);
  return { ts: new Date().toISOString(), ...entry };
}

export async function passState(a: AssetDir): Promise<PassState & { stale?: string[] }> {
  const versions = versionsIn(a), finishBase: Record<string, string> = {};
  for (const v of versions) if (v.startsWith('finish.')) {
    const b = finishBaseOf(sourceOf(a, v));
    if (b) finishBase[v] = b;
  }
  const st = planPasses({
    asset: a.brief.id, versions, ledger: ledgerFor(a), revisionPasses: revisionPasses(a), finishPass: a.dir.pipeline.finishPass, finishBase,
    ...(a.project && { feedback: feedbackOf(a), extraRevisions: a.budget?.extraRevisions ?? 0, ...blindConfig(a.project) }),
  });
  const lastFinish = versions.filter(v => v.startsWith('finish.')).pop();
  if (lastFinish && existsSync(join(a.path, `${lastFinish}.snapshot.json`))) {
    const stale = (await renderVersion(a, lastFinish)).stale;
    if (stale?.length) return { ...st, stale };
  }
  return st;
}

/** Blind re-score settings for the pass machine (rev 9): `review.blind` in artgen.config.json, on by default. */
function blindConfig(p: Project): { blind?: { minScore: number; maxGap: number } } {
  const r = projectConfig(p).review;
  return r.blind === false ? {} : { blind: { minScore: r.approveMin, maxGap: r.blindMaxGap } };
}

/** Contact sheet of `n` seeded variants (variant 0 = defaults) and how many are distinct. */
export async function variantsSheet(a: AssetDir, version: string, n = 8): Promise<{ path: string; distinct: number; hashes: string[] }> {
  const items: { label: string; grid: Grid; bg?: string; context?: Grid }[] = [], hashes: string[] = [];
  for (let k = 0; k < n; k++) {
    const r = await renderVersion(a, version, { variant: k });
    hashes.push(r.strip.hash());
    items.push({ label: `#${k}${k ? '' : ' defaults'}`, grid: r.strip, bg: a.brief.review?.bg, context: a.brief.review?.iso ? iso.isoFloor(r.strip.w, r.strip.h) : undefined });
  }
  const distinct = new Set(hashes).size, cols = Math.min(4, n);
  const sheet = contactSheet(`${a.brief.id} ${version}: ${n} variants, ${distinct} distinct`, items, a.brief.review?.scale ?? 4, cols);
  const path = join(outDir(a), `variants-${version}.png`);
  writeGrid(path, sheet);
  return { path, distinct, hashes };
}

/** Pipeline stage of a pass → `models` key in artgen.config.json. */
export const stageKey = (pass: string): 'base' | 'revise' | 'finish' => (pass === 'r1' ? 'base' : pass.startsWith('f') ? 'finish' : 'revise');

/** Model + effort recorded with a score: the config's mapping for the stage (`'default'` = the session's model). */
export function stageModel(a: AssetDir, pass: string): { model: string; effort: string; reviewModel: string } {
  const m = (a.project ? projectConfig(a.project).models : undefined) ?? {};
  const pick = (k: string) => { const v = (m as Record<string, unknown>)[k]; return typeof v === 'string' ? { model: v, effort: 'default' } : { model: String((v as { model?: string })?.model ?? 'default'), effort: String((v as { effort?: string })?.effort ?? 'default') }; };
  const st = pick(stageKey(pass));
  return { model: st.model, effort: st.effort, reviewModel: pick('review').model };
}

/** The project's anchors of the asset's kind (fallback: all anchors), shown under every review sheet (R7). */
export function anchorsFor(a: AssetDir): { label: string; grid: Grid }[] {
  if (!a.project || !a.dir.anchors?.length) return [];
  const all = a.dir.anchors.map(f => ({ label: basename(f, '.png'), file: resolve(a.project!.art, f) })).filter(x => existsSync(x.file));
  const same = all.filter(x => x.label === a.brief.kind || (a.brief.kind === 'creature' && x.label === 'character') || (['tileset', 'texture'].includes(a.brief.kind) && x.label === 'tile'));
  return (same.length ? same : all).map(x => ({ label: `anchor ${x.label}`, grid: readGrid(x.file) }));
}

/** Source hash of a final as approved and exported: the base source plus, for a finish, its own source. */
export function finalHash(a: AssetDir, version: string): string {
  const v = parseVersion(version)!;
  if (v.kind === 'base') return sourceHash(sourceOf(a, version));
  const src = sourceOf(a, version), base = finishBaseOf(src);
  return sourceHash((base ? sourceOf(a, base) + '\n' : '') + src);
}
