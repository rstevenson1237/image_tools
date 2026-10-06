/**
 * Asset directories and the pass pipeline on disk (PLAN P1b). An asset directory holds `brief.json`,
 * `base.v<N>.js` and `finish.v<M>.js` (+ `finish.v<M>.snapshot.json`); scores and reviews go to the nearest
 * `ledger.jsonl` up the tree. Until `art/briefs.yaml` lands (P3) the brief lives next to the sources.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyFinish, conformance, contactSheet, finishSnapshot, finishStale, Grid, imageTokens, iso, parseDirection, parseLedger,
  parseVersion, passId, planPasses, renderAsset, resolveSize, reviewSheet, sourceHash,
  type AssetModule, type Brief, type ConformanceReport, type Direction, type FinishModule, type LedgerEntry, type PassState,
  type PatchRecord, type RenderResult,
} from 'artgen-core';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import { strip } from './bench.ts';
import { appendLedger, initNodeSvg, readGrid, writeGrid } from './node.ts';
import { isPlaceholderDirection } from './project.ts';

export interface AssetBrief extends Brief {
  /** Direction file (relative to the asset dir) or a bench direction name. Default: nearest direction.json. */
  direction?: string;
  review?: { scale?: number; bg?: string; iso?: boolean; sym?: 'x' | 'y' | 'none'; label?: string };
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
  const briefPath = join(path, 'brief.json');
  if (!existsSync(briefPath)) throw new Error(`${path}: no brief.json`);
  const brief = JSON.parse(readFileSync(briefPath, 'utf8')) as AssetBrief;
  if (!brief.id) brief.id = basename(resolve(path));
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
  return { path, brief, dir, ledgerPath };
}

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
  strip: Grid;
  report: ConformanceReport;
  source: string;
  /** finish versions: the base they are bound to, their patches and any stale patches. */
  base?: string;
  patches?: PatchRecord[];
  stale?: string[];
}

/** Render one version (a finish renders its bound base first). */
export async function renderVersion(a: AssetDir, version: string, opts: { variant?: number; stages?: Map<string, Grid> } = {}): Promise<VersionRender> {
  await initNodeSvg();
  const v = parseVersion(version);
  if (!v) throw new Error(`bad version ${version}`);
  const file = join(a.path, `${v.name}.js`);
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  const source = readFileSync(file, 'utf8');
  let render: RenderResult, base: string | undefined, patches: PatchRecord[] | undefined, stale: string[] | undefined, src = source;
  if (v.kind === 'base') render = renderAsset(await load<AssetModule>(file), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages });
  else {
    const fin = await load<FinishModule>(file);
    base = fin.base;
    if (!parseVersion(base ?? '')) throw new Error(`${file}: export const base = 'base.vN' is required`);
    const baseRender = renderAsset(await load<AssetModule>(join(a.path, `${base}.js`)), { dir: a.dir, brief: a.brief, variant: opts.variant, stages: opts.stages });
    const f = applyFinish(baseRender, fin, a.dir);
    render = f.render; patches = f.patches;
    const snap = join(a.path, `${v.name}.snapshot.json`);
    if (existsSync(snap) && !opts.variant) stale = finishStale(JSON.parse(readFileSync(snap, 'utf8')), patches);
    src = sourceOf(a, base) + '\n' + source;
  }
  const s = strip(render);
  const report = conformance({
    frames: render.cells.map(c => c.grid), dir: a.dir, kind: a.brief.kind, size: resolveSize(a.dir, a.brief.size, a.brief.kind),
    source: src, symAxis: a.brief.review?.sym ?? 'x', lint: render.lint,
  });
  return { version: v.name, render, strip: s, report, source, base, patches, stale };
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
 * checker, scaled and in-context panels. Records a `review` ledger line with the image-token estimate.
 */
export async function reviewVersion(a: AssetDir, version: string): Promise<{ path: string; tokens: number; render: VersionRender }> {
  const vs = versionsIn(a), cur = await renderVersion(a, version), R = a.brief.review ?? {}, sc = R.scale ?? 4;
  const scores = new Map(ledgerFor(a).filter(e => e.type === 'score' && e.version).map(e => [e.version!, e.score as number]));
  const ctx = (g: Grid) => (R.iso ? iso.isoFloor(g.w, g.h) : undefined);
  const rows: { label: string; grid: Grid; scale: number; bg?: string; context?: Grid }[] = [];
  if (a.brief.reference) {
    const ref = readGrid(resolve(a.path, a.brief.reference));
    rows.push({ label: `reference${a.brief.target !== undefined ? ` (target ${a.brief.target})` : ''}`, grid: ref, scale: sc, bg: R.bg, context: ctx(ref) });
  }
  const v = parseVersion(version)!, prev = v.kind === 'finish' ? cur.base : vs.filter(x => parseVersion(x)!.kind === 'base' && parseVersion(x)!.n < v.n).pop();
  const best = [...scores].filter(([k]) => parseVersion(k)?.kind === 'base' && k !== prev && k !== version).sort((x, y) => y[1] - x[1])[0]?.[0];
  for (const other of [best, prev]) if (other) {
    const r = await renderVersion(a, other);
    rows.push({ label: rowLabel(r, scores.get(other)), grid: r.strip, scale: sc, bg: R.bg, context: ctx(r.strip) });
  }
  rows.push({ label: `>> ${rowLabel(cur)}`, grid: cur.strip, scale: sc, bg: R.bg, context: ctx(cur.strip) });
  const sheet = reviewSheet({ title: `${R.label ?? a.brief.id} - ${version} (${passId(version, a.dir.pipeline.revisionPasses)})`, rows });
  const path = join(outDir(a), `review-${version}.png`);
  writeGrid(path, sheet);
  writeRender(a, cur);
  const tokens = imageTokens(sheet.w, sheet.h);
  appendLedger(a.ledgerPath, { type: 'review', asset: a.brief.id, version, pass: passId(version, a.dir.pipeline.revisionPasses), sheet: relPath(a, path), imageTokens: tokens, by: 'agent' });
  return { path, tokens, render: cur };
}

/** Path as recorded in the ledger: relative to the ledger's folder. */
const relPath = (a: AssetDir, p: string) => relative(dirname(resolve(a.ledgerPath)), resolve(p)).split('\\').join('/');

/** Record a visual score for a version, with gate results, metrics and token estimates (analytics, D19). */
export async function scoreVersion(a: AssetDir, version: string, score: number, note = '', extra: Record<string, unknown> = {}): Promise<LedgerEntry> {
  const r = await renderVersion(a, version), N = a.dir.pipeline.revisionPasses, v = parseVersion(version)!;
  const vs = versionsIn(a).filter(x => parseVersion(x)!.kind === v.kind && parseVersion(x)!.n < v.n);
  const prevSrc = v.kind === 'finish' ? undefined : vs.length ? sourceOf(a, vs[vs.length - 1]) : undefined;
  const reviews = ledgerFor(a).filter(e => e.type === 'review' && e.version === version);
  if (v.kind === 'finish' && r.patches) {
    const snap = join(a.path, `${version}.snapshot.json`);
    if (!existsSync(snap)) writeFileSync(snap, JSON.stringify(finishSnapshot(r.patches)) + '\n');
  }
  const entry = {
    type: 'score' as const, asset: a.brief.id, version, pass: passId(version, N), score, note, sourceHash: sourceHash(r.source),
    outputHash: r.strip.hash(), direction: { id: a.dir.id, version: a.dir.version }, metrics: r.report.metrics,
    conformance: { pass: r.report.pass, checks: r.report.checks }, ...(r.base && { base: r.base }),
    tokens: { code: codeTokens(r.source), edit: editTokens(prevSrc, r.source) },
    imageTokens: reviews.length ? (reviews[reviews.length - 1].imageTokens as number) : undefined, by: 'agent' as const, ...extra,
  };
  appendLedger(a.ledgerPath, entry);
  return { ts: new Date().toISOString(), ...entry };
}

export async function passState(a: AssetDir): Promise<PassState & { stale?: string[] }> {
  const versions = versionsIn(a), finishBase: Record<string, string> = {};
  for (const v of versions) if (v.startsWith('finish.')) {
    const m = sourceOf(a, v).match(/export\s+const\s+base\s*=\s*['"]([^'"]+)['"]/);
    if (m) finishBase[v] = m[1];
  }
  const st = planPasses({ asset: a.brief.id, versions, ledger: ledgerFor(a), revisionPasses: a.dir.pipeline.revisionPasses, finishPass: a.dir.pipeline.finishPass, finishBase });
  const lastFinish = versions.filter(v => v.startsWith('finish.')).pop();
  if (lastFinish && existsSync(join(a.path, `${lastFinish}.snapshot.json`))) {
    const stale = (await renderVersion(a, lastFinish)).stale;
    if (stale?.length) return { ...st, stale };
  }
  return st;
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
