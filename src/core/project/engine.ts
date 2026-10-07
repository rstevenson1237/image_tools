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
  analytics, applyFinish, assetStatus, blindScores, briefDir, briefOrder, budgetFor, conformance, describeDirection,
  effectObjectIssues, encodePNG, finishBaseOf, finishStale, formatLedgerLine, Grid, isPlaceholderDirection, iso, lockDirection,
  mergeConfig, parseBriefs, parseDirection, parseLedger, parseVersion, passId, planPasses, PROBE_KINDS, pxPerMetre,
  renderAsset, FACINGS, resolveSize, sourceHash, styleSheet, styleTile, TILE_KINDS, validateDirection, decodePNG,
  type AnalyticsReport, type AssetBudget, type AssetMeta, type AssetModule, type AssetStatus, type BriefEntry,
  type ConformanceReport, type Direction, type FeedbackOpen, type FinishModule, type LedgerEntry, type NextStep,
  type PassRow, type PatchRecord, type ProbeImages, type ProjectConfig, type RenderResult, type StyleTileColumn,
} from 'artgen-core';

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
  brief: BriefEntry & { template?: string; review?: { scale?: number; bg?: string; iso?: boolean; sym?: 'x' | 'y' | 'none'; label?: string } };
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
    return this.ledgerFor(id).filter(e => e.type === 'feedback' && e.by === 'user' && typeof e.opens === 'string')
      .map(e => ({
        route: e.route === 'finish' ? 'finish' : 'base', opens: e.opens as string,
        ...(typeof e.note === 'string' && { note: e.note }), ...(Array.isArray(e.region) && { region: e.region as number[] }), ...(typeof e.cell === 'string' && { cell: e.cell }),
      }));
  }

  passOf(a: AssetCtx, version: string): string {
    return passId(version, a.budget.revisionPasses, this.feedbackOf(a.id).map(f => f.opens));
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
      source: src, symAxis: a.brief.review?.sym ?? 'x', lint: render.lint,
      ...(a.brief.height && { height: { metres: a.brief.height, pxPerMetre: pxPerMetre(a.dir) } }),
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
    const dir = this.requireLocked(), rows: AssetRow[] = [];
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
    const a = this.asset(id, dir), iterations = this.feedbackOf(id).length + 1, max = a.budget.maxUserIterations;
    if (iterations > max && !o.force) throw new Error(`${id}: ${iterations - 1} user iterations already (budget.maxUserIterations ${max}) — talk it through with Claude Code, or force it`);
    const kind = o.route === 'base' ? 'base' : 'finish', vs = this.versionsIn(a.path);
    const opens = `${kind}.v${Math.max(0, ...vs.map(parseVersion).filter(v => v!.kind === kind).map(v => v!.n)) + 1}`;
    const entry = { type: 'feedback' as const, asset: id, route: o.route, opens, on: row.final, note: o.note.trim(), ...(o.region && { region: o.region }), ...(o.cell && { cell: o.cell }), via: 'image-tools', by: 'user' as const };
    return { entry, opens, iterations };
  }

  /** Ledger line for an entry (the store appends it). */
  static line(e: Omit<LedgerEntry, 'ts'>): string { return ledgerLine(e); }

  analytics(): { report: AnalyticsReport; metas: AssetMeta[] } {
    const dir = this.requireLocked(), metas: AssetMeta[] = this.briefs().map(b => {
      const t = this.text(`${briefDir(b)}/brief.json`), local = t ? (JSON.parse(t) as { template?: string }) : {};
      const size = Array.isArray(b.size) ? b.size.join('x') : (b.size ?? b.kind);
      return { id: b.id, kind: b.kind, view: b.view ?? dir.camera.view, size, template: local.template, importance: b.importance ?? 'standard' };
    });
    const ids = new Set(metas.map(m => m.id));
    return { report: analytics(this.ledger().filter(e => ids.has(e.asset) || e.asset === 'gallery'), metas), metas };
  }

  /** In-context background for an asset's review: 3×3 tiling is done by the viewer; iso assets get the floor. */
  context(a: AssetCtx, w: number, h: number): Img | undefined {
    const isoView = (a.brief.view ?? a.dir.camera.view) === 'iso' && !TILE_KINDS.has(a.brief.kind);
    return a.brief.review?.iso || isoView ? img(iso.isoFloor(w, h)) : undefined;
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
