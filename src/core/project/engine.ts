/**
 * The artgen project as the image tools see it (W4, SPEC §13): a snapshot of a game repo's `art/` folder read
 * through `@artgen/core`, with the same derivations the CLI makes — asset status (§5.2), the pass timeline, renders,
 * conformance, analytics — and the same writes: user approvals and feedback as ledger lines (`by: "user"`), direction
 * drafts and locks (§13.3: files are the API; nothing is cached across the boundary).
 *
 * It mirrors `packages/artgen-cli` (asset.ts, w1.ts, w2.ts) over a file snapshot instead of `node:fs`; `engine.test.ts`
 * checks it against the CLI on the fixture repos so the two can't drift. Writes are returned as plans (`FileOp[]`)
 * that the project store applies, so this module stays free of I/O and runs both in the artgen worker and in node.
 *
 * Asset modules are arbitrary code from the game repo (D17): the loader runs them in the worker, never on the page.
 */
import {
  analytics, applyFinish, approvalEntry, diffJson, diffLines, assetDataSheet, assetStatus, dataSheetMarkdown, feedbackEntry, generatorMetrics, isSubjectKey, mapDirection, parseSubjectBrief, subjectDataSheet, subjectKey, subjectStatus, subjects, SUBJECT_KINDS, versionFile, versionOfFile, blindScores, briefDir, briefOrder, budgetFor, conformance, describeDirection,
  effectObjectIssues, encodePNG, finishBaseOf, finishStale, formatLedgerLine, Grid, isPlaceholderDirection, iso, lockDirection,
  mergeConfig, parseBriefs, parseDirection, parseLedger, parseVersion, passId, planPasses, PROBE_KINDS, pxPerMetre, animInput, standFrames,
  renderAsset, FACINGS, resolveSize, sourceHash, styleSheet, styleTile, TILE_KINDS, validateDirection, decodePNG, viewContext, stackStrip, parallaxStrip, fpRole, fpShots, autotileCount, autotileMap,
  type AnalyticsReport, type AnimContract, type Check, type DataSheet, type GeneratorMetrics, type SubjectBrief, type SubjectKind, type AssetBudget, type AssetMeta, type AssetModule, type AssetStatus, type BriefEntry,
  type ConformanceReport, type Direction, type FeedbackOpen, type FinishModule, type LedgerEntry, type NextStep,
  type PassRow, type PatchRecord, type ProbeImages, type ProjectConfig, type RenderResult, type StyleTileColumn,
} from 'artgen-core';
import { joinPath } from './snapshot';

/** Text and binary files of the art folder, keyed by path relative to it (`assets/prop/reeds/base.v2.js`). */
export interface Snapshot {
  text: Record<string, string>;
  bin: Record<string, Uint8Array>;
}

/** Imports an asset module by its path in the snapshot. */
export type ModuleLoader = (path: string) => Promise<unknown>;

/** A file change the project store applies (writes are checked against the disk first; appends never overwrite). */
export type FileOp =
  | { op: 'write'; path: string; data: string | Uint8Array }
  | { op: 'append'; path: string; data: string };

/** RGBA image as it crosses the worker boundary. */
export interface Img { w: number; h: number; data: Uint8ClampedArray }

export const img = (g: Grid): Img => ({ w: g.w, h: g.h, data: g.d });

export interface AssetCtx {
  id: string;
  path: string;
  brief: BriefEntry & { template?: string; review?: { scale?: number; bg?: string; iso?: boolean; sym?: 'x' | 'y' | 'none'; label?: string; /** tiles: the repeat is the design (bricks, panels) */ periodic?: boolean } };
  dir: Direction;
  budget: AssetBudget;
}

export interface VersionRender {
  version: string;
  render: RenderResult;
  report: ConformanceReport;
  source: string;
  base?: string;
  patches?: PatchRecord[];
  stale?: string[];
}

export interface AssetRow {
  id: string;
  kind: string;
  path: string;
  status: AssetStatus;
  final?: string;
  score?: number;
  blind?: number;
  reviewer?: string;
  gate?: boolean;
  issues: string[];
  next?: NextStep;
  why: string;
  imageTokens: number;
  stale?: string[];
}

/** A map, dungeon or settlement in Asset Review: a row in the same status groups as an asset. */
export interface SubjectRow {
  key: string;
  kind: SubjectKind;
  id: string;
  status: AssetStatus;
  /** The latest version. */
  version?: string;
  why: string;
  /** No check fails (the checks of the latest version, or of the working file when there is none). */
  pass: boolean;
  fail: number;
  flag: number;
}

export interface SubjectVersion { version: string; ts?: string; note?: string; by?: string; sourceHash?: string; score?: number; reviewer?: string }

export interface SubjectDetail {
  row: SubjectRow;
  /** Oldest first. */
  versions: SubjectVersion[];
  /** The checks of the latest version (the working file when there is none). */
  checks: Check[];
  sheet: DataSheet;
  markdown: string;
  brief?: SubjectBrief;
  /** The theme the version is shown in (the locked map direction's, else the default). */
  theme: string;
  direction: mapDirection.MapDirection | null;
  feedback: LedgerEntry[];
  approvals: LedgerEntry[];
  reviews: LedgerEntry[];
}

export interface TimelineRow extends PassRow {
  blind?: number;
  reviewer?: string;
  note?: string;
  /** Sheet of the version's latest review (relative to the art folder). */
  sheet?: string;
}

export interface AssetDetail {
  row: AssetRow;
  versions: string[];
  timeline: TimelineRow[];
  feedback: LedgerEntry[];
  approvals: LedgerEntry[];
  params: Record<string, unknown>;
  view: string;
  background?: string;
  facings: string[];
}

const LEDGER = 'ledger.jsonl';
const ledgerLine = (e: Omit<LedgerEntry, 'ts'>): string => formatLedgerLine({ ts: new Date().toISOString(), ...e } as LedgerEntry) + '\n';
const json = (v: unknown): string => JSON.stringify(v, null, 2) + '\n';

/** Pixel strip of every cell, left to right (the CLI's `out/<version>.png` layout). */
export function strip(r: RenderResult): Grid {
  const g = new Grid(r.size[0] * r.cells.length, r.size[1]);
  r.cells.forEach((c, i) => g.blit(c.grid, i * r.size[0], 0));
  return g;
}

export class ArtProject {
  private readonly renders = new Map<string, VersionRender>();

  constructor(readonly snap: Snapshot, private readonly load: ModuleLoader) {}

  // ---- files -------------------------------------------------------------------------------------------------------

  text(path: string): string | undefined { return this.snap.text[path]; }

  config(): ProjectConfig {
    const t = this.text('artgen.config.json');
    return mergeConfig(t ? JSON.parse(t) : {});
  }

  /** `direction.json` as written (null when missing). */
  rawDirection(): Record<string, unknown> | null {
    const t = this.text('direction.json');
    return t ? JSON.parse(t) : null;
  }

  locked(): Direction | null {
    const raw = this.rawDirection();
    return !raw || isPlaceholderDirection(raw) ? null : parseDirection(raw);
  }

  requireLocked(): Direction {
    const d = this.locked();
    if (!d) throw new Error('no locked direction yet — run the art direction workflow first (`/artgen-direction`)');
    return d;
  }

  briefs(): BriefEntry[] {
    const t = this.text('briefs.yaml');
    if (!t) return [];
    const r = parseBriefs(t);
    if (!r.ok) throw new Error(`art/briefs.yaml:\n  ${r.errors.join('\n  ')}`);
    return r.briefs;
  }

  ledger(): LedgerEntry[] { return parseLedger(this.text(LEDGER) ?? ''); }

  ledgerFor(id: string): LedgerEntry[] { return this.ledger().filter(e => e.asset === id); }

  /** `base.vN` / `finish.vM` present in an asset folder, bases first. */
  versionsIn(path: string): string[] {
    const pre = path + '/';
    return Object.keys(this.snap.text).filter(p => p.startsWith(pre) && !p.slice(pre.length).includes('/'))
      .map(p => parseVersion(p.slice(pre.length))?.name).filter((v): v is string => !!v)
      .sort((x, y) => { const a = parseVersion(x)!, b = parseVersion(y)!; return a.kind === b.kind ? a.n - b.n : a.kind === 'base' ? -1 : 1; });
  }

  source(a: Pick<AssetCtx, 'path'>, version: string): string {
    const s = this.text(`${a.path}/${version}.js`);
    if (s === undefined) throw new Error(`art/${a.path}/${version}.js does not exist`);
    return s;
  }

  // ---- assets --------------------------------------------------------------------------------------------------------

  /** An asset by brief id: `art/briefs.yaml` wins over the folder's `brief.json` (template review settings). */
  asset(id: string, dir = this.requireLocked()): AssetCtx {
    const b = this.briefs().find(x => x.id === id);
    if (!b) throw new Error(`no brief ${id} in art/briefs.yaml`);
    const path = briefDir(b), lt = this.text(`${path}/brief.json`), local = lt ? JSON.parse(lt) : {};
    const brief = { ...local, ...b, id } as AssetCtx['brief'];
    return { id, path, brief, dir, budget: budgetFor(this.config(), brief, dir) };
  }

  feedbackOf(id: string): FeedbackOpen[] {
    // the user's feedback, and the agent's from roster notes (`feedback --by roster`, an extra autonomous revision)
    return this.ledgerFor(id).filter(e => e.type === 'feedback' && (e.by === 'user' || e.by === 'agent') && typeof e.opens === 'string')
      .map(e => ({
        route: e.route === 'finish' ? 'finish' : 'base', opens: e.opens as string, ...(e.by === 'agent' && { by: 'agent' as const, source: typeof e.source === 'string' ? e.source : 'agent' }),
        ...(typeof e.on === 'string' && { on: e.on }),
        ...(typeof e.note === 'string' && { note: e.note }), ...(Array.isArray(e.region) && { region: e.region as number[] }), ...(typeof e.cell === 'string' && { cell: e.cell }),
      }));
  }

  passOf(a: AssetCtx, version: string): string {
    return passId(version, a.budget.revisionPasses, this.feedbackOf(a.id).filter(f => f.by !== 'agent').map(f => f.opens));
  }

  private async module<T>(path: string): Promise<T> { return (await this.load(path)) as T; }

  /** Render one version (a finish renders its bound base first) with conformance, like `artgen render`. */
  async renderVersion(a: AssetCtx, version: string, o: { variant?: number; seed?: number; params?: Record<string, unknown> } = {}): Promise<VersionRender> {
    const v = parseVersion(version);
    if (!v) throw new Error(`bad version ${version}`);
    const key = `${a.path}|${version}|${o.variant ?? 0}|${o.seed ?? 1}|${JSON.stringify(o.params ?? {})}|${a.dir.id}@${a.dir.version}`;
    const hit = this.renders.get(key);
    if (hit) return hit;
    const source = this.source(a, v.name), opts = { dir: a.dir, brief: a.brief, variant: o.variant, seed: o.seed, params: o.params };
    let render: RenderResult, base: string | undefined, patches: PatchRecord[] | undefined, stale: string[] | undefined, src = source;
    if (v.kind === 'base') render = renderAsset(await this.module<AssetModule>(`${a.path}/${v.name}.js`), opts);
    else {
      const fin = await this.module<FinishModule>(`${a.path}/${v.name}.js`);
      base = fin.base;
      if (!parseVersion(base ?? '')) throw new Error(`art/${a.path}/${v.name}.js: export const base = 'base.vN' is required`);
      const f = applyFinish(renderAsset(await this.module<AssetModule>(`${a.path}/${base}.js`), opts), fin, a.dir);
      render = f.render; patches = f.patches;
      const snap = this.text(`${a.path}/${v.name}.snapshot.json`);
      if (snap && !o.variant) stale = finishStale(JSON.parse(snap), patches);
      src = this.source(a, base!) + '\n' + source;
    }
    const report = conformance({
      frames: render.cells.map(c => c.grid), dir: a.dir, kind: a.brief.kind, size: resolveSize(a.dir, a.brief.size, a.brief.kind),
      source: src, symAxis: a.brief.review?.sym ?? 'x', lint: render.lint, periodic: a.brief.review?.periodic, autotile: a.brief.autotile,
      ...(a.brief.height && { height: { metres: a.brief.height, pxPerMetre: pxPerMetre(a.dir), frames: standFrames(render), view: a.brief.view ?? a.dir.camera.view, body: a.brief.body } }), anim: animInput(render),
      thresholds: { heightFail: this.config().review.heightFail },
    });
    const out = { version: v.name, render, report, source, base, patches, stale };
    this.renders.set(key, out);
    return out;
  }

  async passState(a: AssetCtx) {
    const versions = this.versionsIn(a.path), finishBase: Record<string, string> = {}, cfg = this.config();
    for (const v of versions) if (v.startsWith('finish.')) { const b = finishBaseOf(this.source(a, v)); if (b) finishBase[v] = b; }
    const st = planPasses({
      asset: a.id, versions, ledger: this.ledgerFor(a.id), revisionPasses: a.budget.revisionPasses, finishPass: a.dir.pipeline.finishPass, finishBase,
      feedback: this.feedbackOf(a.id), extraRevisions: a.budget.extraRevisions,
      finish: cfg.review.finish, approveMin: cfg.review.approveMin, blindRevisions: cfg.review.blindRevisions,
      ...(cfg.review.blind !== false && { blind: { minScore: cfg.review.approveMin, maxGap: cfg.review.blindMaxGap } }),
    });
    const lastFinish = versions.filter(v => v.startsWith('finish.')).pop();
    if (lastFinish && this.text(`${a.path}/${lastFinish}.snapshot.json`)) {
      const stale = (await this.renderVersion(a, lastFinish)).stale;
      if (stale?.length) return { ...st, stale };
    }
    return { ...st, stale: undefined as string[] | undefined };
  }

  /** Source hash of a final as approved and exported: the base source plus, for a finish, its own source. */
  finalHash(a: AssetCtx, version: string): string {
    const v = parseVersion(version)!;
    if (v.kind === 'base') return sourceHash(this.source(a, version));
    const src = this.source(a, version), base = finishBaseOf(src);
    return sourceHash((base ? this.source(a, base) + '\n' : '') + src);
  }

  /** Status row of one brief, derived from the ledger and the pass machine (the CLI's `assetRow`). */
  async row(b: BriefEntry, dir = this.requireLocked()): Promise<AssetRow> {
    const path = briefDir(b), briefIssues = effectObjectIssues(b).map(x => `brief: ${x}`);
    const base = { id: b.id, kind: b.kind, path: `art/${path}`, issues: briefIssues, imageTokens: 0 };
    if (this.text(`${path}/base.v1.js`) === undefined && !this.versionsIn(path).length) return { ...base, status: 'brief', why: 'not started' };
    const a = this.asset(b.id, dir), st = await this.passState(a), ledger = this.ledgerFor(a.id);
    const imageTokens = ledger.filter(e => e.type === 'review').reduce((n, e) => n + ((e.imageTokens as number) ?? 0), 0);
    if (!ledger.length && st.next.action === 'review' && st.next.version === 'base.v1') return { ...base, status: 'in-pipeline', next: st.next, why: 'base.v1 from the template: adapt it to the brief, then review', imageTokens };
    const fh = st.next.action === 'ready' ? this.finalHash(a, st.next.final) : undefined;
    const s = assetStatus({ ledger, next: st.next, direction: { id: dir.id, version: dir.version }, finalHash: fh });
    const sc = s.final ? [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === s.final) : undefined;
    const ro = s.final ? [...ledger].reverse().find(e => e.type === 'roster' && e.version === s.final && Array.isArray(e.issues)) : undefined;
    const issues = [...briefIssues, ...s.issues, ...(st.stale ?? []).map(x => `finish-stale ${x}`), ...((ro?.issues as string[] | undefined) ?? [])];
    const blind = s.final ? blindScores(ledger).get(s.final)?.score : undefined;
    return {
      ...base, status: s.status, final: s.final, score: sc?.score as number | undefined, gate: sc?.conformance?.pass, issues, next: st.next, why: s.why, imageTokens, stale: st.stale,
      ...(blind !== undefined && { blind }), ...(typeof sc?.reviewer === 'string' && { reviewer: sc.reviewer }),
    };
  }

  /** Every brief's status, in brief priority order (`artgen status`). */
  async status(): Promise<AssetRow[]> {
    // a maps-only repo has no locked art direction: no art rows, but the maps are still listed (`subjects()`)
    const dir = this.locked(), rows: AssetRow[] = [];
    if (!dir) return rows;
    for (const b of briefOrder(this.briefs())) rows.push(await this.row(b, dir));
    return rows;
  }

  /** One asset for Asset Review: status, the pass timeline with scores and reviewers, feedback and approvals. */
  async detail(id: string): Promise<AssetDetail> {
    const dir = this.requireLocked(), b = this.briefs().find(x => x.id === id);
    if (!b) throw new Error(`no brief ${id}`);
    const row = await this.row(b, dir);
    const versions = this.versionsIn(briefDir(b));
    if (!versions.length) return { row, versions, timeline: [], feedback: [], approvals: [], params: {}, view: b.view ?? dir.camera.view, facings: [] };
    const a = this.asset(id, dir), st = await this.passState(a), ledger = this.ledgerFor(id), blind = blindScores(ledger);
    const timeline: TimelineRow[] = st.rows.map(r => {
      const own = [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === r.version);
      const sheet = [...ledger].reverse().find(e => e.type === 'review' && !e.blind && e.version === r.version)?.sheet;
      return {
        ...r, ...(blind.get(r.version) && { blind: blind.get(r.version)!.score }), ...(typeof own?.reviewer === 'string' && { reviewer: own.reviewer }),
        ...(typeof own?.note === 'string' && own.note && { note: own.note }), ...(typeof sheet === 'string' && { sheet }),
      };
    });
    const mod = await this.module<AssetModule>(`${a.path}/${versions.filter(v => v.startsWith('base.')).pop()}.js`);
    return {
      row, versions, timeline, params: mod.params ?? {},
      feedback: ledger.filter(e => e.type === 'feedback'), approvals: ledger.filter(e => e.type === 'approve'),
      view: a.brief.view ?? dir.camera.view, background: a.brief.review?.bg ?? dir.background, facings: FACINGS[a.brief.directions ?? 1] ?? ['s'],
    };
  }

  /** The param schema and fixed params a version renders with (a finish uses its bound base's). */
  async paramsOf(id: string, version: string): Promise<Record<string, unknown>> {
    const a = this.asset(id), v = parseVersion(version);
    if (!v) throw new Error(`bad version ${version}`);
    const base = v.kind === 'base' ? v.name : finishBaseOf(this.source(a, v.name));
    if (!base) throw new Error(`art/${a.path}/${v.name}.js: export const base = 'base.vN' is required`);
    return (await this.module<AssetModule>(`${a.path}/${base}.js`)).params ?? {};
  }

  // ---- user decisions (D10: only `approved` and `revision` come from the user) --------------------------------------

  /** Approve a final (R6: a passing gate and a review sheet; the CLI's `approve`). */
  async approve(id: string, note = ''): Promise<{ entry: Omit<LedgerEntry, 'ts'>; keep: { from: string; to: string }; warnings: string[] }> {
    const dir = this.requireLocked(), b = this.briefs().find(x => x.id === id);
    if (!b) throw new Error(`no brief ${id}`);
    const row = await this.row(b, dir);
    if (row.status !== 'final') throw new Error(`${id} is ${row.status}: only a final asset can be approved${row.status === 'stale' ? ' (ask Claude Code to run restyle first)' : ''}`);
    const a = this.asset(id, dir), r = await this.renderVersion(a, row.final!);
    if (!r.report.pass) throw new Error(`${id} ${row.final}: the gate fails (${r.report.checks.filter(c => c.status === 'fail').map(c => c.id).join(', ')}) — request changes instead (R6)`);
    const ledger = this.ledgerFor(id), sheet = [...ledger].reverse().find(e => e.type === 'review' && e.version === row.final)?.sheet;
    if (typeof sheet !== 'string') throw new Error(`${id} ${row.final}: no review sheet yet — the pipeline reviews every final before it reaches you (R6)`);
    const kept = `sheets/approved/${id}-${row.final}.png`;
    const own = [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === row.final), cfg = this.config().review, warnings: string[] = [];
    const bl = blindScores(ledger).get(row.final!)?.score, reviewer = typeof own?.reviewer === 'string' ? own.reviewer : undefined;
    if (bl === undefined) warnings.push(reviewer === 'self' || !reviewer ? 'scored only by the agent that made it, with no blind re-score' : 'no blind re-score of the final');
    warnings.push(...row.issues.filter(x => x.startsWith('blind re-score')));
    if (bl !== undefined && bl < cfg.approveMin && !warnings.some(x => x.startsWith('blind re-score'))) warnings.push(`blind re-score ${bl} is under ${cfg.approveMin}`);
    // the store copies the sheet into sheets/approved/ when it can read it (review sheets live in gitignored out/
    // folders, so a fresh clone may not have it) and then records the kept copy, as the CLI does
    const entry = {
      type: 'approve' as const, asset: id, version: row.final, sourceHash: this.finalHash(a, row.final!), outputHash: strip(r.render).hash(),
      sheet, direction: { id: dir.id, version: dir.version }, note, ...(warnings.length && { warnings }), via: 'image-tools', by: 'user' as const,
    };
    return { entry, keep: { from: sheet, to: kept }, warnings };
  }

  /** User feedback on a finished asset: opens a U-stage version (`base` = form/colour, `finish` = pixels). */
  async feedback(id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean }): Promise<{ entry: Omit<LedgerEntry, 'ts'>; opens: string; iterations: number }> {
    const dir = this.requireLocked(), b = this.briefs().find(x => x.id === id);
    if (!b) throw new Error(`no brief ${id}`);
    if (!o.note.trim()) throw new Error('write what should change');
    const row = await this.row(b, dir);
    if (!['final', 'approved', 'exported', 'stale'].includes(row.status)) throw new Error(`${id} is ${row.status}: feedback applies to finished assets (wait for final)`);
    const a = this.asset(id, dir), iterations = this.feedbackOf(id).filter(f => f.by !== 'agent').length + 1, max = a.budget.maxUserIterations;
    if (iterations > max && !o.force) throw new Error(`${id}: ${iterations - 1} user iterations already (budget.maxUserIterations ${max}) — talk it through with Claude Code, or force it`);
    const kind = o.route === 'base' ? 'base' : 'finish', vs = this.versionsIn(a.path);
    const opens = `${kind}.v${Math.max(0, ...vs.map(parseVersion).filter(v => v!.kind === kind).map(v => v!.n)) + 1}`;
    const entry = { type: 'feedback' as const, asset: id, route: o.route, opens, on: row.final, note: o.note.trim(), ...(o.region && { region: o.region }), ...(o.cell && { cell: o.cell }), via: 'image-tools', by: 'user' as const };
    return { entry, opens, iterations };
  }

  /** Ledger line for an entry (the store appends it). */
  static line(e: Omit<LedgerEntry, 'ts'>): string { return ledgerLine(e); }

  analytics(): { report: AnalyticsReport; metas: AssetMeta[]; generators?: Record<string, GeneratorMetrics> } {
    const dir = this.locked(), metas: AssetMeta[] = dir ? this.briefs().map(b => {
      const t = this.text(`${briefDir(b)}/brief.json`), local = t ? (JSON.parse(t) as { template?: string }) : {};
      const size = Array.isArray(b.size) ? b.size.join('x') : (b.size ?? b.kind);
      return { id: b.id, kind: b.kind, view: b.view ?? dir.camera.view, size, template: local.template, importance: b.importance ?? 'standard' };
    }) : [];
    const ids = new Set(metas.map(m => m.id)), ledger = this.ledger(), report = analytics(ledger.filter(e => ids.has(e.asset) || e.asset === 'gallery'), metas);
    // once there is map work in the ledger, the Generators table (as `artgen analytics` shows it)
    const maps = SUBJECT_KINDS.flatMap(kind => this.subjectIds(kind).map(id => ({ generator: kind as string, key: subjectKey(kind, id) })));
    return { report, metas, ...(ledger.some(e => isSubjectKey(e.asset)) && { generators: generatorMetrics(ledger, [...metas.map(m => ({ generator: 'art', key: m.id })), ...maps]) }) };
  }

  // ---- maps, dungeons and settlements (docs/WORKFLOW.md §11): the same rules as the CLI's `workflow.ts`, over the snapshot ----------

  /** Ids of the subjects of a kind (the folders under `art/<dir>/` that hold the working file). */
  subjectIds(kind: SubjectKind): string[] {
    const sub = subjects.SUBJECTS[kind], re = new RegExp(`^${sub.dir}/([\\w-]+)/${sub.file.replace('.', '\\.')}$`);
    return Object.keys(this.snap.text).map(p => re.exec(p)?.[1]).filter((id): id is string => !!id).sort();
  }

  /** `art/map-direction.json`, or null when there is none. */
  mapDirection(): mapDirection.MapDirection | null {
    const t = this.text(mapDirection.DIRECTION_FILE);
    if (t === undefined) return null;
    try { return mapDirection.parseMapDirection(JSON.parse(t)); } catch (e) { throw new Error(`art/${mapDirection.DIRECTION_FILE}: ${(e as Error).message}`); }
  }

  /** The working file, its versions and ledger lines, and its status. */
  private subjectState(kind: SubjectKind, id: string) {
    const sub = subjects.SUBJECTS[kind], stem = sub.file.replace(/\.json$/, ''), dir = `${sub.dir}/${id}`, text = this.text(`${dir}/${sub.file}`);
    if (text === undefined) throw new Error(`no ${kind} ${id} (art/${dir}/${sub.file})`);
    const key = subjectKey(kind, id), entries = this.ledger().filter(e => e.asset === key), direction = this.mapDirection();
    const versions = Object.keys(this.snap.text).filter(p => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/')).map(p => versionOfFile(stem, p.slice(dir.length + 1))).filter((v): v is string => !!v)
      .sort((a, b) => +a.slice(1) - +b.slice(1));
    const ref = mapDirection.directionRef(direction), status = subjectStatus({ entries, key, workingHash: sourceHash(text), direction: ref });
    return { sub, stem, dir, key, text, entries, versions, direction, ref, status, versionText: (v: string) => this.text(`${dir}/${versionFile(stem, v)}`) };
  }

  /** The checks of a file's text under the locked map direction's symbol set; an underlay is looked for in the snapshot. */
  private subjectChecks(kind: SubjectKind, dir: string, text: string, direction: mapDirection.MapDirection | null): Check[] {
    return subjects.checkSource(kind, text, { exists: rel => this.text(joinPath(dir, rel)) !== undefined, symbols: mapDirection.symbolsFor(direction, kind) });
  }

  /** One row per map, dungeon and settlement in the project, as `artgen <kind> status` shows them. */
  subjects(): SubjectRow[] {
    return SUBJECT_KINDS.flatMap(kind => this.subjectIds(kind).map((id): SubjectRow => {
      const st = this.subjectState(kind, id), v = st.status.version, checks = this.subjectChecks(kind, st.dir, (v && st.versionText(v)) || st.text, st.direction);
      const fail = checks.filter(c => c.status === 'fail').length;
      return { key: st.key, kind, id, status: st.status.status, ...(v && { version: v }), why: st.status.why, pass: !fail, fail, flag: checks.filter(c => c.status === 'flag').length };
    }));
  }

  /** One subject for Asset Review: status, versions with their notes, checks, the data sheet, the brief, and its ledger lines. */
  subjectDetail(kind: SubjectKind, id: string): SubjectDetail {
    const st = this.subjectState(kind, id), v = st.status.version, text = (v && st.versionText(v)) || st.text, checks = this.subjectChecks(kind, st.dir, text, st.direction);
    const briefText = this.text(`${st.dir}/${st.stem}.brief.md`), brief = briefText === undefined ? undefined : parseSubjectBrief(briefText), theme = mapDirection.themeFor(st.direction, kind);
    const fail = checks.filter(c => c.status === 'fail').length;
    const versionEntries = st.entries.filter(e => e.type === 'version'), scores = st.entries.filter(e => e.type === 'score' && !e.blind);
    const versions = st.versions.map((name): SubjectVersion => {
      const e = [...versionEntries].reverse().find(x => x.version === name), sc = [...scores].reverse().find(x => x.version === name);
      return { version: name, ...(e && { ts: e.ts, by: e.by, sourceHash: e.sourceHash }), ...(typeof e?.note === 'string' && e.note && { note: e.note }), ...(typeof sc?.score === 'number' && { score: sc.score }), ...(typeof sc?.reviewer === 'string' && { reviewer: sc.reviewer }) };
    });
    const sheet = subjectDataSheet(st.sub.sheet(st.sub.parse(JSON.parse(text)), checks), { version: v, theme, directionVersion: mapDirection.lockedMapDirection(st.direction)?.version, brief });
    return {
      row: { key: st.key, kind, id, status: st.status.status, ...(v && { version: v }), why: st.status.why, pass: !fail, fail, flag: checks.filter(c => c.status === 'flag').length },
      versions, checks, sheet, markdown: dataSheetMarkdown(sheet), ...(brief && { brief }), theme, direction: st.direction,
      feedback: st.entries.filter(e => e.type === 'feedback'), approvals: st.entries.filter(e => e.type === 'approve'), reviews: st.entries.filter(e => e.type === 'review'),
    };
  }

  /** The file text of a version (the working file when `version` is left out): what the worker renders. */
  subjectFile(kind: SubjectKind, id: string, version?: string): string {
    const st = this.subjectState(kind, id), t = version ? st.versionText(version) : st.text;
    if (t === undefined) throw new Error(`${id}: no ${version} (have ${st.versions.join(', ') || 'none'})`);
    return t;
  }

  /** What changed between two versions of a subject (`working` is the file now), one line per change (`artgen <kind> diff`). */
  subjectDiff(kind: SubjectKind, id: string, a: string, b: string): string[] {
    const read = (v: string) => JSON.parse(this.subjectFile(kind, id, v === 'working' ? undefined : v));
    return diffLines(diffJson(read(a), read(b)));
  }

  /** The terrain map a dungeon's or settlement's `underlay` names, as its JSON (undefined when it has none or it is not in the project). */
  subjectUnderlay(kind: SubjectKind, id: string): unknown | undefined {
    const st = this.subjectState(kind, id), u = (JSON.parse(st.text) as { underlay?: { map?: unknown } }).underlay?.map, t = typeof u === 'string' ? this.text(joinPath(st.dir, u)) : undefined;
    return t === undefined ? undefined : JSON.parse(t);
  }

  /** Approve the latest version of a subject: the CLI's rules (it must be final, no check may fail). The ledger line is the plan to write. */
  approveSubject(kind: SubjectKind, id: string, note = ''): FileOp[] {
    const st = this.subjectState(kind, id), v = st.status.version, checks = st.status.status === 'final' && v ? this.subjectChecks(kind, st.dir, st.versionText(v) ?? st.text, st.direction) : [];
    const entry = approvalEntry({ kind, id, key: st.key, status: st.status, checks, workingHash: sourceHash(st.text), direction: st.ref }, { note, via: 'image-tools' });
    return [{ op: 'append', path: LEDGER, data: ledgerLine(entry) }];
  }

  /** The user's feedback on the latest version (a note; the region is optional and not drawn on maps yet). */
  feedbackSubject(kind: SubjectKind, id: string, o: { note: string; region?: number[] }): FileOp[] {
    const st = this.subjectState(kind, id), entry = feedbackEntry({ kind, id, key: st.key, latest: st.versions[st.versions.length - 1] }, { ...o, via: 'image-tools' });
    return [{ op: 'append', path: LEDGER, data: ledgerLine(entry) }];
  }

  /** The one-page data sheet of an asset (what `artgen sheet` writes), with the animation contract when the asset has been exported. */
  assetSheet(id: string): { sheet: DataSheet; markdown: string } {
    const a = this.asset(id), ct = this.text(`contracts/${id}.json`), sheet = assetDataSheet(a.brief, a.dir, a.budget, ct ? (JSON.parse(ct) as AnimContract) : undefined);
    return { sheet, markdown: dataSheetMarkdown(sheet) };
  }

  /** In-context background for an asset's review: 3×3 tiling is done by the viewer; iso assets get the floor, oblique
   * ones a room, side ones a scroll strip (the view module's context, P6a). */
  context(a: AssetCtx, w: number, h: number): Img | undefined {
    const view = a.brief.view ?? a.dir.camera.view, isoView = view === 'iso' && !TILE_KINDS.has(a.brief.kind);
    if (a.brief.review?.iso || isoView) return img(iso.isoFloor(w, h));
    if (a.brief.kind === 'layer') return undefined;
    const c = view === 'oblique' || view === 'side' ? viewContext(view, w, h, a.dir) : undefined;
    return c && img(c);
  }

  /**
   * How the game shows the asset when that isn't one frame (P6a/b/d): a sprite stack turned through 8 angles, parallax
   * layers scrolled to three camera positions, an autotile set laid as an island, a first-person asset in the
   * raycaster corridor (the same shots as the CLI review sheet). Undefined for ordinary sprites.
   */
  preview(a: AssetCtx, r: RenderResult): Img | undefined {
    const view = a.brief.view ?? a.dir.camera.view;
    if (view === 'fp') {
      const f0 = r.facings[0], role = fpRole(a.brief.kind, a.brief.surface);
      const frames = role === 'billboard'
        ? r.facings.filter(f => ['s', 'se', 'e', 'sw', 'n'].includes(f)).slice(0, 3).map(f => r.cells.find(c => c.state === r.states[0] && c.facing === f)!.grid)
        : role === 'viewmodel' ? r.states.map(s => { const cs = r.cells.filter(c => c.state === s && c.facing === f0); return cs[Math.min(1, cs.length - 1)].grid; })
        : [r.cells.find(c => c.state === r.states[0] && c.facing === f0)!.grid];
      const shots = fpShots(a.dir, a.brief.kind, frames, { surface: a.brief.surface }), row = new Grid(shots.reduce((n, x) => n + x.w + 2, -2), shots[0].h);
      let x = 0;
      for (const sh of shots) { row.blit(sh, x, 0); x += sh.w + 2; }
      return img(row);
    }
    if (view === 'stack') return img(stackStrip(r.cells.filter(c => c.state === r.states[0] && c.facing === r.facings[0]).map(c => c.grid), 8, 1));
    if (a.brief.autotile && r.cells.length >= autotileCount(a.brief.autotile)) {
      const tiles = r.cells.filter(c => c.state === r.states[0] && c.facing === r.facings[0]).map(c => c.grid);
      return img(autotileMap(tiles, a.brief.autotile, undefined, 8));
    }
    if (a.brief.kind === 'layer' && r.states.length > 1) {
      const cells = r.states.map(s => r.cells.find(c => c.state === s)!);
      return img(parallaxStrip(cells.map((c, i) => ({ grid: c.grid, depth: (i + 1) / cells.length })), r.size[0], [0, Math.round(r.size[0] / 3), Math.round((2 * r.size[0]) / 3)]));
    }
    return undefined;
  }

  // ---- art direction (W1 in the UI) ----------------------------------------------------------------------------------

  candidateNames(): string[] {
    return Object.keys(this.snap.text).filter(p => /^candidates\/[^/]+\.json$/.test(p)).map(p => p.slice(11, -5))
      .sort((x, y) => (x.length === 1 ? 0 : 1) - (y.length === 1 ? 0 : 1) || x.localeCompare(y, 'en', { numeric: true }));
  }

  candidates(): { name: string; id: string; status: string; summary: string[]; errors: string[] }[] {
    return this.candidateNames().map(name => {
      const r = validateDirection(JSON.parse(this.text(`candidates/${name}.json`)!));
      return r.ok ? { name, id: r.direction!.id, status: r.direction!.status, summary: describeDirection(r.direction!), errors: [] } : { name, id: '?', status: 'invalid', summary: [], errors: r.errors };
    });
  }

  candidate(name: string): Direction {
    const t = this.text(`candidates/${name}.json`);
    if (!t) throw new Error(`no candidate ${name}`);
    return parseDirection(JSON.parse(t));
  }

  /** Probe version shown on a tile: the latest finish, else the latest base (the short pipeline). */
  probeVersion(kind: string): string {
    const vs = this.versionsIn(`probes/${kind}`);
    if (!vs.length) throw new Error(`art/probes/${kind}: no base.vN.js — run the art direction workflow in Claude Code first`);
    return [...vs].reverse().find(v => v.startsWith('finish.')) ?? vs.filter(v => v.startsWith('base.')).pop()!;
  }

  probeAsset(kind: string, dir: Direction): AssetCtx {
    const t = this.text(`probes/${kind}/brief.json`);
    if (!t) throw new Error(`art/probes/${kind}/brief.json is missing`);
    const brief = JSON.parse(t), id = brief.id ?? `probe-${kind}`;
    return { id, path: `probes/${kind}`, brief: { ...brief, id }, dir, budget: budgetFor(undefined, brief, dir) };
  }

  hasProbes(): boolean { return PROBE_KINDS.every(k => this.text(`probes/${k}/brief.json`) !== undefined); }

  /** The probe set rendered under a direction, with gate results per probe. */
  async renderProbes(dir: Direction): Promise<{ images: ProbeImages; gates: Record<string, boolean>; failing: string[] }> {
    const renders: Record<string, VersionRender> = {};
    for (const kind of PROBE_KINDS) renders[kind] = await this.renderVersion(this.probeAsset(kind, dir), this.probeVersion(kind));
    const cell = (k: string) => renders[k].render.cells[0].grid;
    return {
      images: { character: cell('character'), prop: cell('prop'), tile: cell('tile'), effect: renders.effect.render.cells.map(c => c.grid) },
      gates: Object.fromEntries(Object.entries(renders).map(([k, r]) => [k, r.report.pass])),
      failing: Object.entries(renders).flatMap(([k, r]) => r.report.checks.filter(c => c.status === 'fail').map(c => `${k}.${c.id}: ${c.detail}`)),
    };
  }

  /** Live style tile: the probe set under each direction, one column each (the CLI's tile, not written to disk). */
  async styleTile(columns: { label: string; dir: Direction }[], title = 'style tile (preview)'): Promise<{ tile: Img; gates: Record<string, boolean>[]; failing: string[][] }> {
    const cols: StyleTileColumn[] = [], gates: Record<string, boolean>[] = [], failing: string[][] = [];
    for (const c of columns) {
      const p = await this.renderProbes(c.dir);
      cols.push({ label: c.label, notes: describeDirection(c.dir), dir: c.dir, probes: p.images, gates: p.gates });
      gates.push(p.gates); failing.push(p.failing);
    }
    return { tile: img(styleTile(title, cols)), gates, failing };
  }

  /** Save an edited direction as a draft candidate (`art/candidates/<name>.json`), validated like the CLI's. */
  saveDraft(name: string, edited: unknown): FileOp[] {
    if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw new Error('draft names are lower-case letters, digits, - and _ (e.g. next, mix2)');
    if (name.length === 1 && 'abc'.includes(name) && this.text(`candidates/${name}.json`) !== undefined) {
      // a, b and c are the generated candidates; edits go to a new draft so the round can be compared
      throw new Error(`candidate ${name} was generated by the direction workflow — save your edit under another name (e.g. ${name}2)`);
    }
    const r = validateDirection({ ...(edited as object), status: 'draft' });
    if (!r.ok) throw new Error(`direction is invalid:\n  ${r.errors.join('\n  ')}`);
    return [
      { op: 'write', path: `candidates/${name}.json`, data: json({ ...(edited as object), status: 'draft' }) },
      { op: 'append', path: LEDGER, data: ledgerLine({ type: 'note', asset: 'direction', note: `draft ${name} edited in the image tools (Art Direction)`, via: 'image-tools', by: 'user' }) },
    ];
  }

  /**
   * Lock a candidate (the CLI's `direction lock`): `direction.json` locked with the version bumped, the previous version
   * archived in `directions/`, anchors re-rendered from the probes, `direction.png` rewritten, approval in the ledger.
   */
  async lock(name: string, note = ''): Promise<{ direction: Direction; ops: FileOp[] }> {
    const chosen = this.candidate(name), prev = this.locked(), raw = this.rawDirection();
    const d = lockDirection(chosen, prev);
    d.theme = { ...d.theme, notes: `${d.theme.notes ?? ''}${note ? `. ${note}` : ''}`.trim() };
    const ops: FileOp[] = [];
    if (prev && raw && this.text(`directions/v${prev.version}.json`) === undefined) ops.push({ op: 'write', path: `directions/v${prev.version}.json`, data: json(raw) });
    ops.push({ op: 'append', path: LEDGER, data: ledgerLine({ type: 'approve', asset: 'direction', version: `v${d.version}`, note: `locked ${name}${note ? `: ${note}` : ''}`, direction: { id: d.id, version: d.version }, via: 'image-tools', by: 'user' }) });
    const { images } = await this.renderProbes(d), files: string[] = [], list: { label: string; grid: Grid }[] = [];
    const row = (fs: Grid[]) => { const g = new Grid(fs.reduce((n, f) => n + f.w, 0) + fs.length - 1, Math.max(...fs.map(f => f.h))); let x = 0; for (const f of fs) { g.blit(f, x, 0); x += f.w + 1; } return g; };
    for (const kind of PROBE_KINDS) {
      const g = kind === 'effect' ? row(images.effect) : images[kind as 'character' | 'prop' | 'tile'];
      ops.push({ op: 'write', path: `anchors/${kind}.png`, data: encodePNG(g) });
      files.push(`anchors/${kind}.png`);
      list.push({ label: kind, grid: g });
    }
    const out = { ...JSON.parse(JSON.stringify(d)), anchors: files };
    ops.push({ op: 'write', path: 'direction.json', data: json(out) });
    ops.push({ op: 'write', path: 'direction.png', data: encodePNG(styleSheet(out, list)) });
    const versions = Object.fromEntries(PROBE_KINDS.map(k => [k, this.probeVersion(k)]));
    ops.push({ op: 'append', path: LEDGER, data: ledgerLine({ type: 'note', asset: 'direction', version: `v${d.version}`, note: `anchors from probes ${Object.entries(versions).map(([k, v]) => `${k} ${v}`).join(', ')}`, via: 'image-tools', by: 'user' }) });
    ops.push({ op: 'write', path: `directions/v${d.version}.json`, data: json(out) });
    return { direction: parseDirection(out), ops };
  }

  /** Anchors as images (shown beside every review, R7). */
  anchors(): { label: string; img: Img }[] {
    const d = this.locked();
    return (d?.anchors ?? []).filter(f => this.snap.bin[f]).map(f => ({ label: f.replace(/^anchors\/|\.png$/g, ''), img: img(decodePNG(this.snap.bin[f])) }));
  }
}
