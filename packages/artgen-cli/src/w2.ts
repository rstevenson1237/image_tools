/**
 * W2 themed production on disk (SPEC §5, PLAN P3): briefs → autonomous pipeline per brief → final → the user
 * approves or gives feedback (U stage) → export packs; restyle after a direction change; hand-edit import; analytics.
 *
 *   art/briefs.yaml                  the asset list (brief add | list | rm)
 *   art/assets/<kind>/<id>/          asset sources (base.vN.js, finish.vM.js), brief.json = template review settings
 *   art/sheets/gallery-N.png         finished assets for the user (`gallery`)
 *   art/sheets/restyle-vA-vB.png     before | after | token diff per asset (`restyle`)
 *   art/directions/v<N>.json         every locked direction version (written by lock)
 *   <packDir>/<pack>/                atlas PNGs, pack.json, Aseprite JSON; <assetsTs> typed ids (`export`)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  analytics, analyticsMarkdown, assetsTs, assetStatus, briefDir, briefOrder, buildPack, contactSheet, editOps, Grid, imageTokens,
  mirrorFacing, parseBriefs, parseLedger, parseVersion, removeBrief, restyleDiff, restyleSheet, tokenDiffMask, upsertBrief,
  type AssetMeta, type AssetStatus, type BriefEntry, type Direction, type LedgerEntry, type NextStep, type PackInput, type RenderResult,
} from 'artgen-core';
import {
  feedbackOf, finalHash, ledgerFor, openAsset, passState, renderVersion, versionsIn, type AssetBrief, type AssetDir,
} from './asset.ts';
import { strip } from './bench.ts';
import { appendLedger, readGrid, writeGrid } from './node.ts';
import { projectConfig, readJson, writeJson, type Project } from './project.ts';
import { findTemplate } from './templates.ts';
import { directionVersion, lockedDirection } from './w1.ts';

const briefsFile = (p: Project) => join(p.art, 'briefs.yaml');
const ledgerFile = (p: Project) => join(p.art, 'ledger.jsonl');
const rel = (p: Project, f: string) => relative(p.root, f).split('\\').join('/');

export function readBriefs(p: Project): BriefEntry[] {
  if (!existsSync(briefsFile(p))) return [];
  const r = parseBriefs(readFileSync(briefsFile(p), 'utf8'));
  if (!r.ok) throw new Error(`art/briefs.yaml:\n  ${r.errors.join('\n  ')}`);
  return r.briefs;
}

/** Add or replace a brief in `art/briefs.yaml` (comments kept). */
export function addBrief(p: Project, b: BriefEntry): BriefEntry[] {
  const text = existsSync(briefsFile(p)) ? readFileSync(briefsFile(p), 'utf8') : '';
  writeFileSync(briefsFile(p), upsertBrief(text, b));
  return readBriefs(p);
}

export function removeBriefFile(p: Project, id: string): boolean {
  const text = readFileSync(briefsFile(p), 'utf8'), out = removeBrief(text, id);
  if (out !== text) writeFileSync(briefsFile(p), out);
  return out !== text;
}

export const assetPathOf = (p: Project, b: Pick<BriefEntry, 'id' | 'kind'>): string => join(p.art, briefDir(b));

/** An asset argument: an existing directory, or a brief id in `art/briefs.yaml`. */
export function resolveAssetArg(p: Project | null, arg: string): string {
  if (existsSync(arg)) return arg;
  if (p) { const b = readBriefs(p).find(x => x.id === arg); if (b) return assetPathOf(p, b); }
  throw new Error(`${arg}: not an asset directory or a brief id in art/briefs.yaml`);
}

/** Create the asset directory for a brief: `brief.json` (template + review settings) and `base.v1.js` from the template. */
export function scaffoldAsset(p: Project, b: BriefEntry, dir: Direction): { path: string; created: boolean; template: string } {
  const path = assetPathOf(p, b), view = b.view ?? dir.camera.view;
  // figures that turn or walk start from the walker (facings + walk cycle)
  const walker = ['character', 'creature'].includes(b.kind) && ((b.directions ?? 1) > 1 || !!b.anims?.walk);
  const t = walker ? findTemplate(view, 'character-walk') : findTemplate(view, b.kind), template = `${t.view}/${t.kind}`;
  if (existsSync(join(path, 'base.v1.js'))) return { path, created: false, template };
  mkdirSync(path, { recursive: true });
  const tb = readJson<{ review?: unknown }>(join(t.dir, 'brief.json'));
  if (!existsSync(join(path, 'brief.json'))) writeJson(join(path, 'brief.json'), { id: b.id, template, review: tb.review ?? {} });
  writeFileSync(join(path, 'base.v1.js'), readFileSync(join(t.dir, 'base.js'), 'utf8').replace(/\{\{ID\}\}/g, b.id));
  return { path, created: true, template };
}

export interface AssetRow {
  id: string;
  kind: string;
  path: string;
  status: AssetStatus;
  final?: string;
  score?: number;
  gate?: boolean;
  issues: string[];
  next?: NextStep;
  why: string;
  imageTokens: number;
  stale?: string[];
}

/** Status of one brief's asset (derived from the ledger and the pass machine). */
export async function assetRow(p: Project, b: BriefEntry): Promise<AssetRow> {
  const path = assetPathOf(p, b);
  const base = { id: b.id, kind: b.kind, path: rel(p, path), issues: [] as string[], imageTokens: 0 };
  if (!existsSync(join(path, 'base.v1.js')) && !versionsInPath(path).length) return { ...base, status: 'brief', why: 'not started' };
  const a = openAsset(path), st = await passState(a), ledger = ledgerFor(a);
  const imageTokens = ledger.filter(e => e.type === 'review').reduce((n, e) => n + ((e.imageTokens as number) ?? 0), 0);
  if (!ledger.length && st.next.action === 'review' && st.next.version === 'base.v1') return { ...base, status: 'in-pipeline', next: st.next, why: 'base.v1 from the template: adapt it to the brief, then review', imageTokens };
  const fh = st.next.action === 'ready' ? finalHash(a, st.next.final) : undefined;
  const s = assetStatus({ ledger, next: st.next, direction: { id: a.dir.id, version: a.dir.version }, finalHash: fh });
  const sc = s.final ? [...ledger].reverse().find(e => e.type === 'score' && e.version === s.final) : undefined;
  const issues = [...s.issues, ...(st.stale ?? []).map(x => `finish-stale ${x}`)];
  return { ...base, status: s.status, final: s.final, score: sc?.score as number | undefined, gate: sc?.conformance?.pass, issues, next: st.next, why: s.why, imageTokens, stale: st.stale };
}

const versionsInPath = (path: string) => (existsSync(path) ? versionsIn({ path } as AssetDir) : []);

export async function projectStatus(p: Project, ids?: string[]): Promise<AssetRow[]> {
  requireLocked(p);
  const rows: AssetRow[] = [];
  for (const b of briefOrder(readBriefs(p))) if (!ids?.length || ids.includes(b.id)) rows.push(await assetRow(p, b));
  return rows;
}

export function requireLocked(p: Project): Direction {
  const d = lockedDirection(p);
  if (!d) throw new Error('no locked direction yet — run the art direction workflow first (`artgen direction lock <candidate>`)');
  return d;
}

export interface MakeResult { rows: AssetRow[]; next?: { id: string; path: string; step: NextStep }; scaffolded: string[]; finals: string[]; overBudget: string[] }

/**
 * One tick of the autonomous run (`/artgen:make`, D10): scaffold missing asset dirs from templates, record `final`
 * (with open issues) for every asset whose pipeline is complete, stop assets over their image-token budget, and name
 * the next step for the first unfinished asset in priority order. The agent does that step and calls make again.
 */
export async function make(p: Project, ids?: string[]): Promise<MakeResult> {
  const dir = requireLocked(p), briefs = briefOrder(readBriefs(p)).filter(b => !ids?.length || ids.includes(b.id) || ids.includes('all'));
  if (ids?.length && !ids.includes('all')) for (const id of ids) if (!briefs.some(b => b.id === id)) throw new Error(`no brief ${id} in art/briefs.yaml`);
  const scaffolded: string[] = [], finals: string[] = [], overBudget: string[] = [], rows: AssetRow[] = [];
  let next: MakeResult['next'];
  for (const b of briefs) {
    const sc = scaffoldAsset(p, b, dir);
    if (sc.created) scaffolded.push(rel(p, join(sc.path, 'base.v1.js')));
    let row = await assetRow(p, b);
    const a = openAsset(sc.path), ledger = ledgerFor(a);
    if (row.next?.action === 'ready') {
      const fin = row.next.final;
      if (!ledger.some(e => e.type === 'status' && e.status === 'final' && e.version === fin && e.sourceHash === finalHash(a, fin))) {
        appendLedger(ledgerFile(p), { type: 'status', asset: b.id, status: 'final', version: fin, sourceHash: finalHash(a, fin), issues: row.issues, direction: { id: dir.id, version: dir.version }, by: 'agent' });
        finals.push(b.id);
      }
    } else if (row.next && a.budget?.maxImageTokens && row.imageTokens >= a.budget.maxImageTokens) {
      // budget cap: finish with what there is — the best finished version, else the best base — and list why
      const st = await passState(a), best = st.rows.filter(r => r.score !== undefined).sort((x, y) => y.score! - x.score!)[0];
      if (best && !ledger.some(e => e.type === 'status' && e.status === 'final' && e.version === best.version)) {
        appendLedger(ledgerFile(p), { type: 'status', asset: b.id, status: 'final', version: best.version, sourceHash: finalHash(a, best.version), issues: [`budget: ${row.imageTokens} review-image tokens ≥ ${a.budget.maxImageTokens}`], direction: { id: dir.id, version: dir.version }, by: 'agent' });
        overBudget.push(b.id);
      }
      row = { ...row, why: `over budget (${row.imageTokens} image tokens); left at ${best?.version ?? 'nothing scored'}` };
      rows.push(row);
      continue;
    }
    rows.push(row);
    if (!next && row.next && row.next.action !== 'ready') next = { id: b.id, path: row.path, step: row.next };
  }
  return { rows, next, scaffolded, finals, overBudget };
}

/** Render a final as one row per state of the first facing (gallery / restyle thumbnails). */
function thumb(r: RenderResult): Grid {
  const f = r.facings[0], cells = r.cells.filter(c => c.facing === f);
  return cells.length > 1 ? strip({ ...r, cells }) : cells[0].grid;
}

export interface GalleryResult { sheets: string[]; tokens: number; assets: { id: string; final: string; score?: number; issues: string[] }[] }

/** Gallery of finished assets (`/artgen:review`): final render, in context, score and open issues; ≤ 12 per sheet. */
export async function gallery(p: Project, opts: { ids?: string[]; statuses?: AssetStatus[] } = {}): Promise<GalleryResult> {
  const dir = requireLocked(p), want = opts.statuses ?? ['final'], rows = (await projectStatus(p, opts.ids)).filter(r => r.final && (opts.ids?.length || want.includes(r.status)));
  const items: { label: string; grid: Grid; bg?: string }[] = [], assets: GalleryResult['assets'] = [];
  for (const r of rows) {
    const a = openAsset(join(p.root, r.path)), v = await renderVersion(a, r.final!);
    const tag = `${r.id} ${r.final} ${r.score ?? '-'}${r.gate === false ? ' GATE' : ''}${r.issues.length ? ` !${r.issues.length}` : ''}`;
    items.push({ label: tag, grid: thumb(v.render), bg: a.brief.review?.bg ?? dir.background });
    assets.push({ id: r.id, final: r.final!, score: r.score, issues: r.issues });
  }
  if (!items.length) return { sheets: [], tokens: 0, assets };
  const sheets: string[] = [];
  let tokens = 0;
  const n0 = (existsSync(join(p.art, 'sheets')) ? readdirCount(join(p.art, 'sheets'), /^gallery-\d+\.png$/) : 0) + 1;
  for (let i = 0; i < items.length; i += 12) {
    const page = items.slice(i, i + 12), sheet = contactSheet(`${dir.id} v${dir.version}: finished assets ${i + 1}-${i + page.length} of ${items.length} (score, !issues)`, page, 4, Math.min(4, page.length));
    const f = join(p.art, 'sheets', `gallery-${n0 + i / 12}.png`);
    writeGrid(f, sheet);
    sheets.push(rel(p, f));
    tokens += imageTokens(sheet.w, sheet.h);
  }
  appendLedger(ledgerFile(p), { type: 'review', asset: 'gallery', sheet: sheets.join(','), imageTokens: tokens, assets: assets.map(x => x.id), by: 'agent' });
  return { sheets, tokens, assets };
}

const readdirCount = (d: string, re: RegExp): number => readdirSync(d).filter(f => re.test(f)).length;

/** User feedback on a finished asset: starts a U-stage iteration (`base` = form/colour, `finish` = pixels). */
export async function feedback(p: Project, id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean }): Promise<{ opens: string; next: NextStep; iterations: number }> {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  requireLocked(p);
  const row = await assetRow(p, b);
  if (!['final', 'approved', 'exported', 'stale'].includes(row.status)) throw new Error(`${id} is ${row.status}: feedback applies to finished assets (wait for final)`);
  const a = openAsset(assetPathOf(p, b)), iterations = feedbackOf(a).length + 1, max = a.budget?.maxUserIterations ?? 3;
  if (iterations > max && !o.force) throw new Error(`${id}: ${iterations - 1} user iterations already (budget.maxUserIterations ${max}) — escalate: talk it through with the user, or pass --force`);
  const vs = versionsIn(a), kind = o.route === 'base' ? 'base' : 'finish';
  const opens = `${kind}.v${Math.max(0, ...vs.map(parseVersion).filter(v => v!.kind === kind).map(v => v!.n)) + 1}`;
  appendLedger(ledgerFile(p), { type: 'feedback', asset: id, route: o.route, opens, on: row.final, note: o.note, ...(o.region && { region: o.region }), ...(o.cell && { cell: o.cell }), by: 'user' });
  return { opens, next: (await passState(openAsset(assetPathOf(p, b)))).next, iterations };
}

/** Approve a finished asset (R6: needs a passing gate on the final and a review sheet of it; D10: user only). */
export async function approve(p: Project, id: string, note = ''): Promise<LedgerEntry> {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  const dir = requireLocked(p), row = await assetRow(p, b);
  if (row.status !== 'final') throw new Error(`${id} is ${row.status}: only a final asset can be approved${row.status === 'stale' ? ' (run restyle first)' : ''}`);
  const a = openAsset(assetPathOf(p, b)), r = await renderVersion(a, row.final!);
  if (!r.report.pass) throw new Error(`${id} ${row.final}: the gate fails (${r.report.checks.filter(c => c.status === 'fail').map(c => c.id).join(', ')}) — give feedback instead (R6)`);
  const sheet = [...ledgerFor(a)].reverse().find(e => e.type === 'review' && e.version === row.final)?.sheet;
  if (!sheet) throw new Error(`${id} ${row.final}: no review sheet yet — artgen review first (R6)`);
  // keep the sheet the user approved from (art/sheets/approved/ is the one sheets folder that is committed)
  const kept = join(p.art, 'sheets', 'approved', `${id}-${row.final}.png`), src = resolve(dirname(ledgerFile(p)), String(sheet));
  if (existsSync(src)) { mkdirSync(dirname(kept), { recursive: true }); copyFileSync(src, kept); }
  const e = { type: 'approve' as const, asset: id, version: row.final, sourceHash: finalHash(a, row.final!), outputHash: r.strip.hash(), sheet: existsSync(kept) ? relative(p.art, kept).split('\\').join('/') : sheet, direction: { id: dir.id, version: dir.version }, note, by: 'user' as const };
  appendLedger(ledgerFile(p), e);
  return { ts: new Date().toISOString(), ...e };
}

/** Does a brief belong in a pack (`include`: `*`, `goblin*`, `kind:tile`)? */
export function inPack(b: BriefEntry, pack: string, include: string[]): boolean {
  if (b.pack) return b.pack === pack;
  return include.some(pat => pat.startsWith('kind:') ? b.kind === pat.slice(5) : new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(b.id));
}

export interface ExportResult { packs: { pack: string; dir: string; atlases: string[]; assets: string[]; drafts: string[] }[]; assetsTs: string; skipped: { id: string; status: AssetStatus }[] }

/** Export approved assets into the configured packs: atlases + pack.json + Aseprite JSON, and the typed `assets.ts`. */
export async function exportPacks(p: Project, o: { packs?: string[]; includeDrafts?: boolean; generator?: string } = {}): Promise<ExportResult> {
  const dir = requireLocked(p), cfg = projectConfig(p), rows = await projectStatus(p), briefs = readBriefs(p);
  const ok = (s: AssetStatus) => s === 'approved' || s === 'exported' || (o.includeDrafts && s === 'final');
  const skipped = rows.filter(r => !ok(r.status)).map(r => ({ id: r.id, status: r.status }));
  const out: ExportResult['packs'] = [], forTs: { manifest: ReturnType<typeof buildPack>['manifest']; url: string }[] = [];
  for (const [pack, def] of Object.entries(cfg.packs)) {
    if (o.packs?.length && !o.packs.includes(pack)) continue;
    const inputs: PackInput[] = [];
    for (const r of rows) {
      const b = briefs.find(x => x.id === r.id)!;
      if (!ok(r.status) || !inPack(b, pack, def.include)) continue;
      const a = openAsset(join(p.root, r.path)), n = Math.max(1, b.variants ?? 1), renders: RenderResult[] = [];
      for (let k = 0; k < n; k++) renders.push((await renderVersion(a, r.final!, { variant: k })).render);
      inputs.push({ brief: a.brief as AssetBrief, view: a.brief.view ?? dir.camera.view, renders, version: r.final!, sourceHash: finalHash(a, r.final!), draft: r.status === 'final' });
    }
    if (!inputs.length) continue;
    const built = buildPack(pack, dir, inputs, { generator: o.generator, maxSize: cfg.export.maxAtlas, padding: cfg.export.padding });
    const pdir = join(p.root, cfg.export.packDir, pack);
    built.atlases.forEach((g, i) => { writeGrid(join(pdir, built.manifest.atlases[i]), g); writeJson(join(pdir, built.manifest.atlases[i].replace(/\.png$/, '.aseprite.json')), built.aseprite[i]); });
    writeJson(join(pdir, 'pack.json'), built.manifest);
    for (const inp of inputs) appendLedger(ledgerFile(p), { type: 'export', asset: inp.brief.id, version: inp.version, sourceHash: inp.sourceHash, pack, direction: { id: dir.id, version: dir.version }, ...(inp.draft && { draft: true }), by: 'agent' });
    out.push({ pack, dir: rel(p, pdir), atlases: built.manifest.atlases.map(f => rel(p, join(pdir, f))), assets: inputs.map(i => i.brief.id), drafts: built.manifest.drafts ?? [] });
    const pub = cfg.export.packDir.replace(/\\/g, '/').replace(/^\.?\/?/, '');
    forTs.push({ manifest: built.manifest, url: pub.startsWith('public/') || pub === 'public' ? `/${pub.slice(7)}${pub.length > 7 ? '/' : ''}${pack}/pack.json`.replace(/\/+/g, '/') : `${pub}/${pack}/pack.json` });
  }
  const tsFile = join(p.root, cfg.export.assetsTs);
  if (forTs.length) { mkdirSync(dirname(tsFile), { recursive: true }); writeFileSync(tsFile, assetsTs(forTs)); }
  return { packs: out, assetsTs: forTs.length ? rel(p, tsFile) : '', skipped };
}

export interface RestyleResult { from: number; to: number; sheet: string; tokens: number; assets: { id: string; final: string; changedPct: number; tokenSame: number; consistent: boolean; gate: boolean; stale: string[] }[] }

/**
 * Restyle (SPEC §4.2 step 6): re-render every finished asset under the current direction and the one it was made
 * under, write before | after | token-diff, and send changed assets back to the user (`final`, re-approve).
 */
export async function restyle(p: Project, o: { from?: number } = {}): Promise<RestyleResult> {
  const to = requireLocked(p), from = directionVersion(p, o.from ?? to.version - 1);
  if (from.version === to.version) throw new Error(`nothing to restyle: direction is v${to.version}`);
  const rows = (await projectStatus(p)).filter(r => r.final), sheetRows: Parameters<typeof restyleSheet>[1] = [], assets: RestyleResult['assets'] = [];
  const fromFile = join(p.art, 'directions', `v${from.version}.json`);
  for (const r of rows) {
    const path = join(p.root, r.path), a = openAsset(path), old = openAsset(path, { direction: existsSync(fromFile) ? fromFile : undefined });
    if (!existsSync(fromFile)) old.dir = from;
    const [before, after] = [await renderVersion(old, r.final!), await renderVersion(a, r.final!)];
    const d = restyleDiff(before.strip, after.strip, from, to);
    sheetRows.push({ label: `${r.id} ${r.final}: ${d.changedPct}% px changed, tokens kept ${Math.round(d.tokenSame * 100)}%${after.report.pass ? '' : ' GATE FAIL'}${after.stale?.length ? ' FINISH-STALE' : ''}`, before: thumb(before.render), after: thumb(after.render), mask: tokenDiffMask(thumb(before.render), thumb(after.render), from, to), bg: to.background });
    assets.push({ id: r.id, final: r.final!, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, stale: after.stale ?? [] });
    appendLedger(ledgerFile(p), { type: 'restyle', asset: r.id, version: r.final, from: { id: from.id, version: from.version }, direction: { id: to.id, version: to.version }, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, outputHash: after.strip.hash(), ...(after.stale?.length && { stale: after.stale }), by: 'agent' });
  }
  const sheet = restyleSheet(`restyle ${from.id} v${from.version} -> ${to.id} v${to.version}`, sheetRows);
  const f = join(p.art, 'sheets', `restyle-v${from.version}-v${to.version}.png`);
  writeGrid(f, sheet);
  return { from: from.version, to: to.version, sheet: rel(p, f), tokens: imageTokens(sheet.w, sheet.h), assets };
}

/**
 * Hand-edit round trip (SPEC §6.6): diff an edited PNG (the `out/<final>.png` strip, or one cell with `cell`)
 * against the current final and write the next `finish.vM.js` that replays the previous finish plus the edits as
 * colour tokens. Recorded as user feedback on the finish route, so the asset goes back through review.
 */
export async function importEdit(p: Project, id: string, png: string, o: { cell?: string } = {}): Promise<{ file: string; pixels: number; cells: number; snapped: number; conflicts: number }> {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  const dir = requireLocked(p), row = await assetRow(p, b);
  if (!row.final) throw new Error(`${id} is ${row.status}: import-edit applies to a finished asset`);
  const a = openAsset(assetPathOf(p, b)), r = await renderVersion(a, row.final), edited = readGrid(resolve(png)), [w, h] = r.render.size;
  const cells = r.render.cells;
  let pieces: { idx: number; grid: Grid }[];
  if (o.cell) {
    const idx = cells.findIndex(c => `${c.state}/${c.facing}/${c.frame}` === o.cell);
    if (idx < 0) throw new Error(`no cell ${o.cell} (cells are state/facing/frame)`);
    pieces = [{ idx, grid: edited }];
  } else if (edited.w === r.strip.w && edited.h === r.strip.h) {
    pieces = cells.map((_, i) => { const g = new Grid(w, h); g.blit(crop(edited, i * w, 0, w, h), 0, 0); return { idx: i, grid: g }; });
  } else if (cells.length === 1) pieces = [{ idx: 0, grid: edited }];
  else throw new Error(`${png} is ${edited.w}x${edited.h}; expected the ${r.strip.w}x${r.strip.h} strip (out/${row.final}.png) or --cell state/facing/frame`);
  const edits: Record<string, [number, number, string | null][]> = {};
  let pixels = 0, snapped = 0, conflicts = 0;
  for (const { idx, grid } of pieces) {
    const c = cells[idx], e = editOps(c.grid, grid, dir);
    if (!e.ops.length) continue;
    snapped += e.snapped;
    // west facings are mirrored east cells: an edit there lands on the east cell, flipped
    const key = c.mirrored ? `${c.state}/${mirrorFacing(c.facing)}/${c.frame}` : `${c.state}/${c.facing}/${c.frame}`;
    const ops = c.mirrored ? e.ops.map(([x, y, t]) => [w - 1 - x, y, t] as [number, number, string | null]) : e.ops;
    if (edits[key]) { conflicts += ops.length; if (c.mirrored) continue; }
    edits[key] = ops;
    pixels += ops.length;
  }
  if (!pixels) throw new Error(`${png}: no pixel differs from ${row.final}`);
  const vs = versionsIn(a), n = Math.max(0, ...vs.map(parseVersion).filter(v => v!.kind === 'finish').map(v => v!.n)) + 1;
  const fin = parseVersion(row.final)!, base = fin.kind === 'finish' ? r.base! : row.final, prev = fin.kind === 'finish' ? row.final : undefined;
  const file = join(a.path, `finish.v${n}.js`);
  const body = Object.entries(edits).map(([k, ops]) => `  '${k}': ${JSON.stringify(ops)},`).join('\n');
  writeFileSync(file, `// finish.v${n} — hand edit imported from ${relative(a.path, resolve(png)).split('\\').join('/')} (artgen import-edit, SPEC §6.6):
// ${pixels} pixels in ${Object.keys(edits).length} cells, as colour tokens so the edit survives a restyle.${prev ? ` Replays ${prev} first.` : ''}
${prev ? `import * as prev from './${prev}.js';\n` : ''}export const base = '${base}';
export const meta = { notes: 'hand edit (import-edit)' };

const EDITS = {
${body}
};

export function finish(g, ctx) {
${prev ? '  g = prev.finish(g, ctx) ?? g;\n' : ''}  for (const [x, y, t] of EDITS[\`\${ctx.state}/\${ctx.facing}/\${ctx.frame}\`] ?? []) {
    if (t === null) g.clear(x, y); else ctx.lib.px.set(g, [x, y], t);
  }
  return g;
}
`);
  appendLedger(ledgerFile(p), { type: 'import-edit', asset: id, version: `finish.v${n}`, on: row.final, file: rel(p, resolve(png)), pixels, snapped, by: 'user' });
  appendLedger(ledgerFile(p), { type: 'feedback', asset: id, route: 'finish', opens: `finish.v${n}`, on: row.final, note: `hand edit: ${pixels} px (import-edit)`, by: 'user' });
  return { file: rel(p, file), pixels, cells: Object.keys(edits).length, snapped, conflicts };
}

function crop(g: Grid, x0: number, y0: number, w: number, h: number): Grid {
  const out = new Grid(w, h);
  for (let y = 0; y < h; y++) out.d.set(g.d.subarray(((y0 + y) * g.w + x0) * 4, ((y0 + y) * g.w + x0 + w) * 4), y * w * 4);
  return out;
}

/** Analytics over the project's ledger with brief metadata (kind, view, size, template, importance). */
export function projectAnalytics(p: Project, title?: string) {
  const dir = requireLocked(p), all = parseAll(ledgerFile(p)), metas: AssetMeta[] = readBriefs(p).map(b => {
    const bj = join(assetPathOf(p, b), 'brief.json'), local = existsSync(bj) ? readJson<{ template?: string }>(bj) : {};
    const size = Array.isArray(b.size) ? b.size.join('x') : (b.size ?? b.kind);
    return { id: b.id, kind: b.kind, view: b.view ?? dir.camera.view, size, template: local.template, importance: b.importance ?? 'standard' };
  });
  const ids = new Set(metas.map(m => m.id)), report = analytics(all.filter(e => ids.has(e.asset) || e.asset === 'gallery'), metas);
  return { report, markdown: analyticsMarkdown(report, title ?? `${dir.id}: pipeline analytics`) };
}

const parseAll = (f: string): LedgerEntry[] => (existsSync(f) ? parseLedger(readFileSync(f, 'utf8')) : []);
