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
 *   art/contracts/<id>.json          frozen animation contract per exported asset (states, frames, durations, anchors)
 *   art/sheets/roster-*.png          roster lineup + shuffled silhouettes for a fresh reviewer (`roster`, rev 9)
 *   <runtimeDir>/                    the vendored W3 runtime + selected adapters, stamped in runtime.json (`export --runtime`)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  analytics, analyticsMarkdown, assetDataSheet, budgetFor, dataSheetMarkdown, encodePNG, generatorMetrics, renderDataSheet, generatorsMarkdown, isSubjectKey, SUBJECT_KINDS, subjectKey, assetsTs, assetStatus, blindScores, briefContract, effectObjectIssues, briefDir, briefOrder, buildPack, contactSheet, contractOf, diffContract,
  editOps, Grid, imageTokens, mirrorFacing, pxPerMetre, roster, drawnHeight, standFrames, rosterIssues, TILE_KINDS, type RosterItem, type RosterPair, type RosterReview, type RosterSize, parseBriefs, parseLedger, parseVersion, removeBrief, restyleDiff, restyleSheet, tokenDiffMask, upsertBrief,
  applyRecommendations, briefMaterialIssues, gatesFor, mergeConfig, recommend, recommendMarkdown, type LedgerSet,
  diffStageKeys, placeholderKey, placeholderModule, renderAsset, STAGES, type StageId,
  type AnimContract, type AssetMeta, type AssetStatus, type BriefEntry, type Direction, type LedgerEntry, type NextStep, type PackInput, type RenderResult,
} from 'artgen-core';
import {
  effectivePlaceholder, feedbackOf, finalHash, gatesOf, ledgerFor, openAsset, passState, renderVersion, versionsIn, type AssetBrief, type AssetDir,
} from './asset.ts';
import { strip } from './bench.ts';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { appendLedger, readGrid, writeGrid } from './node.ts';
import { vendorRuntime, type VendorResult } from './runtime.ts';
import { projectConfig, readJson, writeJson, type Project } from './project.ts';
import { findTemplate, newFinish, type TemplateRef } from './templates.ts';
import { directionVersion, lockedDirection } from './w1.ts';
import { listSubjectIds, loadRefs } from './workflow.ts';

const briefsFile = (p: Project) => join(p.art, 'briefs.yaml');
const ledgerFile = (p: Project) => join(p.art, 'ledger.jsonl');
const rel = (p: Project, f: string) => relative(p.root, f).split('\\').join('/');

export function readBriefs(p: Project): BriefEntry[] {
  if (!existsSync(briefsFile(p))) return [];
  const r = parseBriefs(readFileSync(briefsFile(p), 'utf8'));
  if (!r.ok) throw new Error(`art/briefs.yaml:\n  ${r.errors.join('\n  ')}`);
  return r.briefs;
}

const contractFile = (p: Project, id: string) => join(p.art, 'contracts', `${id}.json`);

/** The frozen animation contract of an exported asset (`art/contracts/<id>.json`), if it has been exported. */
export function readContract(p: Project, id: string): AnimContract | undefined {
  return existsSync(contractFile(p, id)) ? readJson<AnimContract>(contractFile(p, id)) : undefined;
}

/** Does `id` match a `--break-contract` list (ids, or `*` for every asset)? */
const allowed = (list: string[] | undefined, id: string) => !!list && (list.includes('*') || list.includes(id));

/**
 * Add or replace a brief in `art/briefs.yaml` (comments kept). An edit that would break the frozen animation contract
 * of an already exported asset (states, frame counts, durations, loop, facings) is refused unless `breakContract`.
 */
export function addBrief(p: Project, b: BriefEntry, o: { breakContract?: boolean } = {}): BriefEntry[] {
  const old = readContract(p, b.id), dir = old && lockedDirection(p);
  if (old && dir && !o.breakContract) {
    const d = diffContract(old, briefContract(b, dir, old));
    if (d.breaking.length) throw new Error(`brief ${b.id} would break its exported animation contract (art/contracts/${b.id}.json):\n  ${d.breaking.join('\n  ')}\ngame code may depend on it; re-run with --break-contract if that is intended`);
  }
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

/**
 * The template a brief starts from: a non-humanoid `body` its rig (`creature-quadruped`, `-serpent`, `-flyer`,
 * `-large`); figures that turn or walk the walker (facings + walk cycle, `character-walk`); else the kind's template.
 */
export function templateFor(b: BriefEntry, dir: Direction): TemplateRef {
  const view = b.view ?? dir.camera.view, figure = ['character', 'creature'].includes(b.kind);
  if (figure && b.body && b.body !== 'humanoid') return findTemplate(view, `creature-${b.body}`);
  const walker = figure && ((b.directions ?? 1) > 1 || !!b.anims?.walk);
  return walker ? findTemplate(view, 'character-walk') : findTemplate(view, b.kind);
}

/** Warnings to show when a brief is written (`brief add`, `brief lint`): materials its kind can't colour, a template from another view. */
export function briefWarnings(b: BriefEntry, dir: Direction): string[] {
  const out = briefMaterialIssues(b, dir), t = templateFor(b, dir), view = b.view ?? dir.camera.view;
  if (t.view !== view) out.push(`no ${view} template for it: it starts from ${t.view}/${t.kind} — check the review sheets for the ${view} camera`);
  return out;
}

/** Create the asset directory for a brief and its `brief.json` (template + review settings), without any version. */
export function ensureAssetDir(p: Project, b: BriefEntry, dir: Direction): { path: string; template: string; t: TemplateRef } {
  const path = assetPathOf(p, b), t = templateFor(b, dir), template = `${t.view}/${t.kind}`;
  mkdirSync(path, { recursive: true });
  if (!existsSync(join(path, 'brief.json'))) writeJson(join(path, 'brief.json'), { id: b.id, template, review: readJson<{ review?: unknown }>(join(t.dir, 'brief.json')).review ?? {} });
  return { path, template, t };
}

/** Create the asset directory for a brief: `brief.json` (template + review settings) and `base.v1.js` from the template. */
export function scaffoldAsset(p: Project, b: BriefEntry, dir: Direction): { path: string; created: boolean; template: string } {
  const path = assetPathOf(p, b), t = templateFor(b, dir), template = `${t.view}/${t.kind}`;
  if (existsSync(join(path, 'base.v1.js'))) return { path, created: false, template };
  ensureAssetDir(p, b, dir);
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
  /** Blind re-score of the final (rev 9). */
  blind?: number;
  /** The final's blind score (else its own) is under `review.approveMin`: the gallery labels it BELOW BAR. */
  belowBar?: boolean;
  /** A higher own score than the final's, lost on the gate or the blind score (`final≠best` in status and the gallery). */
  top?: { version: string; score: number };
}

/** Status of one brief's asset (derived from the ledger and the pass machine). */
export async function assetRow(p: Project, b: BriefEntry): Promise<AssetRow> {
  const path = assetPathOf(p, b);
  const base = { id: b.id, kind: b.kind, path: rel(p, path), issues: effectObjectIssues(b).map(x => `brief: ${x}`), imageTokens: 0 };
  if (!existsSync(join(path, 'base.v1.js')) && !versionsInPath(path).length) {
    // a placeholder gate holds the first base until the user approves the placeholder (docs/STAGES.md §5.4)
    if (gatesFor(projectConfig(p).review.gates, b).includes('placeholder')) {
      const a = openAsset(path), st = await passState(a);
      if (st.next.action === 'stage-gate') return { ...base, status: 'in-pipeline', next: st.next, why: st.next.why, imageTokens: 0 };
    }
    return { ...base, status: 'brief', why: 'not started' };
  }
  const a = openAsset(path), st = await passState(a), ledger = ledgerFor(a);
  const imageTokens = ledger.filter(e => e.type === 'review').reduce((n, e) => n + ((e.imageTokens as number) ?? 0), 0);
  if (!ledger.length && st.next.action === 'review' && st.next.version === 'base.v1') return { ...base, status: 'in-pipeline', next: st.next, why: 'base.v1 from the template: adapt it to the brief, then review', imageTokens };
  const fh = st.next.action === 'ready' ? finalHash(a, st.next.final) : undefined;
  const s = assetStatus({ ledger, next: st.next, direction: { id: a.dir.id, version: a.dir.version }, finalHash: fh });
  const sc = s.final ? [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === s.final) : undefined;
  // roster findings (rev 9) stand while the final they were made on is still the final
  const ro = s.final ? [...ledger].reverse().find(e => e.type === 'roster' && e.version === s.final && Array.isArray(e.issues)) : undefined;
  const issues = [...effectObjectIssues(b).map(x => `brief: ${x}`), ...s.issues, ...(st.stale ?? []).map(x => `finish-stale ${x}`), ...((ro?.issues as string[] | undefined) ?? [])];
  const blind = s.final ? blindScores(ledger).get(s.final)?.score : undefined, score = sc?.score as number | undefined, eff = blind ?? score;
  const top = st.next.action === 'ready' ? st.next.top : undefined;
  return {
    ...base, status: s.status, final: s.final, score, gate: sc?.conformance?.pass, issues, next: st.next, why: st.next.action === 'stage-gate' ? st.next.why : s.why, imageTokens, stale: st.stale,
    ...(blind !== undefined && { blind }), ...(eff !== undefined && eff < projectConfig(p).review.approveMin && { belowBar: true }), ...(top && { top }),
  };
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

/**
 * One unit of a parallel `make` round (P7). `maker` packets are authoring steps for one subagent each: it owns `owns`
 * (the asset's directory), writes only `writes` there (renders and sheets land in the same directory's `out/`) and
 * appends to the ledger through `artgen review` — the one shared write. `main` packets (reviews, blind re-scores) stay
 * with the main agent, which also runs the roster reviews. `resume`: a version file is written but was never reviewed —
 * its maker stopped (a usage-limit pause, a crash); the next maker checks the file, completes it if unfinished, and
 * reviews it instead of starting over.
 */
export interface WorkPacket { id: string; kind: string; owns: string; step: NextStep; writes: string[]; role: 'maker' | 'main'; resume?: boolean }

/** The early roster (`review.earlyRoster`): assets held at v1 until a roster review of the whole set's v1s is recorded. */
export interface RosterStep { stage: 'v1'; ids: string[]; why: string }

export interface MakeResult {
  rows: AssetRow[];
  next?: { id: string; path: string; step: NextStep };
  scaffolded: string[];
  finals: string[];
  overBudget: string[];
  /** The main agent runs the v1 roster review before these assets get their v2 (`artgen roster --stage v1`). */
  roster?: RosterStep;
  /** Finished non-tile assets whose final has no roster review yet (the final roster runs before the gallery). */
  finalRoster?: string[];
  /**
   * With `parallel`: makers for this round (up to `parallel`), makers that wait for the next round (or, with `wave`, for
   * the assets ahead of them to reach final), and the main agent's steps.
   */
  work?: { makers: WorkPacket[]; queued: WorkPacket[]; main: WorkPacket[] };
}

/** The work packet for an asset's next step (none when it is ready). `reviewed`: the version's review sheet exists. */
export function workPacket(row: AssetRow, reviewed = true): WorkPacket | undefined {
  const st = row.next;
  if (!st || st.action === 'ready') return undefined;
  const owns = row.path, base = { id: row.id, kind: row.kind, owns, step: st };
  if (st.action === 'write-base' || st.action === 'write-finish') return { ...base, writes: [`${owns}/${st.version}.js`], role: 'maker' };
  if (st.action === 'review' && st.version === 'base.v1' && /^base\.v1 from the template/.test(row.why)) return { ...base, writes: [`${owns}/base.v1.js`], role: 'maker' };
  if (st.action === 'review' && !reviewed) return { ...base, writes: [`${owns}/${st.version}.js`], role: 'maker', resume: true };
  return { ...base, writes: [], role: 'main' };
}

const DONE: AssetStatus[] = ['final', 'approved', 'exported'];

/**
 * One tick of the autonomous run (`/artgen:make`, D10): scaffold missing asset dirs from templates, record `final`
 * (with open issues) for every asset whose pipeline is complete, stop assets over their image-token budget, hold v2
 * for the early roster, and name the next step for the first unfinished asset in priority order. The agent does that
 * step and calls make again. Everything is derived from the files and the ledger, so a respawned agent resumes where
 * the last one stopped.
 */
export async function make(p: Project, ids?: string[], o: { parallel?: number; wave?: number } = {}): Promise<MakeResult> {
  const dir = requireLocked(p), briefs = briefOrder(readBriefs(p)).filter(b => !ids?.length || ids.includes(b.id) || ids.includes('all'));
  if (ids?.length && !ids.includes('all')) for (const id of ids) if (!briefs.some(b => b.id === id)) throw new Error(`no brief ${id} in art/briefs.yaml`);
  const scaffolded: string[] = [], finals: string[] = [], overBudget: string[] = [], rows: AssetRow[] = [], reviewed = new Map<string, boolean>();
  for (const b of briefs) {
    // an open placeholder gate holds the asset's first base: nothing is scaffolded until the user approves the placeholder
    const gateOpen = !existsSync(join(assetPathOf(p, b), 'base.v1.js')) && (await assetRow(p, b)).next?.action === 'stage-gate';
    const sc = gateOpen ? { path: assetPathOf(p, b), created: false, template: '' } : scaffoldAsset(p, b, dir);
    if (sc.created) scaffolded.push(rel(p, join(sc.path, 'base.v1.js')));
    let row = await assetRow(p, b);
    const a = openAsset(sc.path), ledger = ledgerFor(a);
    if (row.next?.action === 'review') { const v = row.next.version; reviewed.set(b.id, ledger.some(e => e.type === 'review' && e.version === v && !e.blind && !e.stage)); }
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
    }
    rows.push(row);
  }
  // waves (--wave n): only the first n unfinished assets in priority order are worked on; the rest wait their turn
  const live = rows.filter(r => !DONE.includes(r.status) && !r.why.startsWith('over budget')), active = new Set((o.wave ? live.slice(0, o.wave) : live).map(r => r.id));
  const roster = earlyRoster(p, rows.filter(r => active.has(r.id)));
  const held = new Set(roster?.ids ?? []), pending = rows.filter(r => active.has(r.id) && r.next && r.next.action !== 'ready' && !held.has(r.id));
  // an asset waiting for the user at a gate is named only when nothing else can move
  const n0 = pending.find(r => r.next!.action !== 'stage-gate') ?? pending[0], next = n0 && { id: n0.id, path: n0.path, step: n0.next! };
  const finalRoster = rows.filter(r => r.status === 'final' && !TILE_KINDS.has(r.kind) && !ledgerFor(openAsset(join(p.root, r.path))).some(e => e.type === 'roster' && e.version === r.final && Array.isArray(e.issues))).map(r => r.id);
  const res: MakeResult = { rows, ...(next && { next }), scaffolded, finals, overBudget, ...(roster && { roster }), ...(finalRoster.length >= 2 && { finalRoster }) };
  if (!o.parallel) return res;
  const packets = pending.map(r => workPacket(r, reviewed.get(r.id) ?? true)).filter((x): x is WorkPacket => !!x), makers = packets.filter(x => x.role === 'maker');
  const waiting = rows.filter(r => !active.has(r.id) && !DONE.includes(r.status) && !r.why.startsWith('over budget')).map(r => workPacket(r, reviewed.get(r.id) ?? true)).filter((x): x is WorkPacket => !!x && x.role === 'maker');
  return { ...res, work: { makers: makers.slice(0, o.parallel), queued: [...makers.slice(o.parallel), ...waiting], main: packets.filter(x => x.role === 'main') } };
}

/**
 * The early roster (0.10.0): the roster review found most real faults (look-alike casters, twin goblin and kobold, a
 * bandit that didn't read as hostile), all cheap to fix at v1. Once every active non-tile asset has a scored v1, those
 * not yet in a v1 roster wait for `roster --stage v1` + `roster record`; its notes go into each v2 brief.
 */
function earlyRoster(p: Project, rows: AssetRow[]): RosterStep | undefined {
  if (!projectConfig(p).review.earlyRoster) return undefined;
  const figures = rows.filter(r => !TILE_KINDS.has(r.kind) && r.status !== 'brief');
  if (figures.length < 2) return undefined;
  const atV1 = v1Rows(p, figures), ready = new Set(atV1.map(r => r.id));
  // still drawing or reviewing a v1 somewhere: wait for the whole set before showing it side by side
  const beforeV1 = figures.filter(r => !ready.has(r.id) && r.next?.action !== 'ready' && (r.next?.action === 'review' || r.next?.action === 'write-base') && 'version' in r.next && r.next.version === 'base.v1');
  const uncovered = atV1.filter(r => !ledgerFor(openAsset(join(p.root, r.path))).some(e => e.type === 'roster' && e.version === 'base.v1' && Array.isArray(e.issues)));
  if (uncovered.length < 2 && !(uncovered.length && atV1.length >= 2)) return undefined;
  if (beforeV1.length) return { stage: 'v1', ids: uncovered.map(r => r.id), why: `holding v2 for the v1 roster until ${beforeV1.map(r => r.id).join(', ')} ${beforeV1.length > 1 ? 'have' : 'has'} a scored v1` };
  return { stage: 'v1', ids: uncovered.map(r => r.id), why: 'every v1 is scored: run the v1 roster (`roster --stage v1`, a fresh art-reviewer, `roster record`) before any v2 — its notes go into each v2 brief' };
}

/** Render a final as one row per state of the first facing (gallery / restyle thumbnails). */
function thumb(r: RenderResult): Grid {
  const f = r.facings[0], cells = r.cells.filter(c => c.facing === f);
  return cells.length > 1 ? strip({ ...r, cells }) : cells[0].grid;
}

export interface GalleryResult { sheets: string[]; tokens: number; assets: { id: string; final: string; score?: number; blind?: number; reviewer?: string; issues: string[]; belowBar?: boolean; top?: { version: string; score: number } }[] }

/** Who scored a final and its blind re-score, from the asset's ledger (rev 9). */
function reviewOf(a: AssetDir, final: string): { reviewer?: string; blind?: number } {
  const ledger = ledgerFor(a), own = [...ledger].reverse().find(e => e.type === 'score' && !e.blind && e.version === final);
  return { reviewer: typeof own?.reviewer === 'string' ? own.reviewer : undefined, blind: blindScores(ledger).get(final)?.score };
}

/** Gallery of finished assets (`/artgen:review`): final render, in context, score and open issues; ≤ 12 per sheet. */
export async function gallery(p: Project, opts: { ids?: string[]; statuses?: AssetStatus[] } = {}): Promise<GalleryResult> {
  const dir = requireLocked(p), want = opts.statuses ?? ['final'], rows = (await projectStatus(p, opts.ids)).filter(r => r.final && (opts.ids?.length || want.includes(r.status)));
  const items: { label: string; grid: Grid; bg?: string }[] = [], assets: GalleryResult['assets'] = [];
  for (const r of rows) {
    const a = openAsset(join(p.root, r.path)), v = await renderVersion(a, r.final!);
    const rv = reviewOf(a, r.final!);
    // score, then the blind re-score (b) or SELF when only the authoring agent scored it
    // BELOW BAR: under review.approveMin (blind score, else own); final≠best: a higher-scoring version lost on the gate or blind score
    const tag = `${r.id} ${r.final} ${r.score ?? '-'}${rv.blind !== undefined ? ` b${rv.blind}` : rv.reviewer === 'self' ? ' SELF' : ''}${r.gate === false ? ' GATE' : ''}${r.belowBar ? ' BELOW BAR' : ''}${r.top ? ` final≠best ${r.top.version} ${r.top.score}` : ''}${r.issues.length ? ` !${r.issues.length}` : ''}`;
    items.push({ label: tag, grid: thumb(v.render), bg: a.brief.review?.bg ?? dir.background });
    assets.push({ id: r.id, final: r.final!, score: r.score, ...(rv.blind !== undefined && { blind: rv.blind }), ...(rv.reviewer && { reviewer: rv.reviewer }), issues: r.issues, ...(r.belowBar && { belowBar: true }), ...(r.top && { top: r.top }) });
  }
  if (!items.length) return { sheets: [], tokens: 0, assets };
  const sheets: string[] = [];
  let tokens = 0;
  const n0 = (existsSync(join(p.art, 'sheets')) ? readdirCount(join(p.art, 'sheets'), /^gallery-\d+\.png$/) : 0) + 1;
  for (let i = 0; i < items.length; i += 12) {
    const page = items.slice(i, i + 12), sheet = contactSheet(`${dir.id} v${dir.version}: finished assets ${i + 1}-${i + page.length} of ${items.length} (score, b blind score, !issues; BELOW BAR under ${projectConfig(p).review.approveMin})`, page, 4, Math.min(4, page.length));
    const f = join(p.art, 'sheets', `gallery-${n0 + i / 12}.png`);
    writeGrid(f, sheet);
    sheets.push(rel(p, f));
    tokens += imageTokens(sheet.w, sheet.h);
  }
  appendLedger(ledgerFile(p), { type: 'review', asset: 'gallery', sheet: sheets.join(','), imageTokens: tokens, assets: assets.map(x => x.id), by: 'agent' });
  return { sheets, tokens, assets };
}

const readdirCount = (d: string, re: RegExp): number => readdirSync(d).filter(f => re.test(f)).length;

export interface RosterRun { lineup: string; silhouettes: string; sheets: string[]; assets: string; tokens: number; seed: number; stage: 'v1' | 'final'; sizes: RosterSize[]; pairs: RosterPair[]; skipped: string[] }

/** Assets whose `base.v1` is scored and no `base.v2` is written yet (the early roster, `review.earlyRoster`). */
export function v1Rows(p: Project, rows: AssetRow[]): AssetRow[] {
  const out: AssetRow[] = [];
  for (const r of rows) {
    if (TILE_KINDS.has(r.kind) || r.status === 'brief') continue;
    const a = openAsset(join(p.root, r.path)), vs = versionsIn(a);
    if (!vs.includes('base.v1') || vs.includes('base.v2') || (a.budget?.revisionPasses ?? 3) < 2) continue;
    if (ledgerFor(a).some(e => e.type === 'score' && !e.blind && e.version === 'base.v1')) out.push(r);
  }
  return out;
}

/**
 * Roster review sheets (rev 9): every finished non-tile asset's final (or with `stage: 'v1'`, every asset's scored
 * `base.v1` before its v2 — the cheap time to fix structure). Writes the lineups and shuffled silhouette sheets, paged
 * `ROSTER_PAGE` assets per pair (`roster-lineup.png`, or `-1.png`, `-2.png`… for bigger sets), and `roster-assets.json`
 * (alphabetical ids, kinds, notes — all the reviewer may read besides the sheets); the label key goes only into the
 * ledger. Heights are measured as the conformance gate measures them (`drawnHeight(standFrames)`).
 */
export async function rosterRun(p: Project, o: { ids?: string[]; seed?: number; stage?: 'v1' | 'final' } = {}): Promise<RosterRun> {
  const dir = requireLocked(p), briefs = readBriefs(p), ledgerAll = parseLedger(existsSync(ledgerFile(p)) ? readFileSync(ledgerFile(p), 'utf8') : ''), stage = o.stage ?? 'final';
  const ids = o.ids?.length ? o.ids : undefined;
  const all = await projectStatus(p, ids), rows = stage === 'v1' ? v1Rows(p, all) : all.filter(r => r.final);
  const items: RosterItem[] = [], versions: Record<string, string> = {}, skipped: string[] = [];
  for (const r of rows) {
    const b = briefs.find(x => x.id === r.id)!, version = stage === 'v1' ? 'base.v1' : r.final!;
    if (TILE_KINDS.has(b.kind)) { skipped.push(`${r.id} (${b.kind})`); continue; }
    const v = await renderVersion(openAsset(join(p.root, r.path)), version);
    items.push({ id: r.id, kind: b.kind, grid: v.render.cells[0].grid, drawn: drawnHeight(standFrames(v.render)), notes: b.notes, height: b.height });
    versions[r.id] = version;
  }
  if (items.length < 2) throw new Error(`roster: needs at least two ${stage === 'v1' ? 'non-tile assets with a scored base.v1 and no v2' : 'finished non-tile assets'} (have ${items.length})`);
  const seed = o.seed ?? ledgerAll.filter(e => e.type === 'roster' && e.asset === 'roster' && e.key).length + 1;
  const res = roster(items, { bg: dir.background ?? '#202020', pxPerMetre: pxPerMetre(dir), heightFail: projectConfig(p).review.heightFail, seed });
  const f = (n: string) => join(p.art, 'sheets', n), many = res.pages.length > 1, sheets: string[] = [];
  let tokens = 0;
  res.pages.forEach((pg, i) => {
    const sfx = many ? `-${i + 1}` : '';
    writeGrid(f(`roster-lineup${sfx}.png`), pg.lineup);
    writeGrid(f(`roster-silhouettes${sfx}.png`), pg.silhouettes);
    sheets.push(rel(p, f(`roster-lineup${sfx}.png`)), rel(p, f(`roster-silhouettes${sfx}.png`)));
    tokens += imageTokens(pg.lineup.w, pg.lineup.h) + imageTokens(pg.silhouettes.w, pg.silhouettes.h);
  });
  writeJson(f('roster-assets.json'), {
    stage, lineup: items.map(it => it.id), ...(many && { pages: res.pages.map((pg, i) => ({ lineup: `roster-lineup-${i + 1}.png`, silhouettes: `roster-silhouettes-${i + 1}.png`, ids: pg.ids })) }),
    assets: [...items].sort((a, b) => a.id.localeCompare(b.id)).map(it => ({ id: it.id, kind: it.kind, notes: it.notes ?? '', ...(it.height && { height: it.height }) })),
  });
  appendLedger(ledgerFile(p), { type: 'roster', asset: 'roster', stage, key: res.key, versions, seed, sizes: res.sizes, pairs: res.pairs, sheet: sheets.map(x => relative(p.art, join(p.root, x)).split('\\').join('/')).join(','), imageTokens: tokens, by: 'agent' });
  return { lineup: sheets[0], silhouettes: sheets[1], sheets, assets: rel(p, f('roster-assets.json')), tokens, seed, stage, sizes: res.sizes, pairs: res.pairs, skipped };
}

/** Record a roster review (`RosterReview` JSON from a fresh reviewer): per-asset open issues on the finals it saw. */
export function rosterRecord(p: Project, file: string, reviewer = 'self'): { issues: Record<string, string[]>; notes: string[] } {
  const ledgerAll = parseLedger(existsSync(ledgerFile(p)) ? readFileSync(ledgerFile(p), 'utf8') : '');
  const run = [...ledgerAll].reverse().find(e => e.type === 'roster' && e.asset === 'roster' && e.key);
  if (!run) throw new Error('roster record: run `artgen roster` first');
  const review = readJson<RosterReview>(resolve(file)), key = run.key as Record<string, string>, versions = run.versions as Record<string, string>;
  const issues = rosterIssues(review, key);
  for (const id of Object.values(key)) {
    const s = (review.silhouettes ?? []).find(x => key[x.letter] === id);
    appendLedger(ledgerFile(p), { type: 'roster', asset: id, version: versions[id], issues: issues[id] ?? [], ...(s && { readability: s.readability, guess: s.guess }), reviewer, by: 'agent' });
  }
  appendLedger(ledgerFile(p), { type: 'roster', asset: 'roster', recorded: true, notes: review.notes ?? [], reviewer, by: 'agent' });
  return { issues, notes: review.notes ?? [] };
}

/**
 * Feedback on a finished asset. The user's (`by: user`, default) starts a U-stage iteration (`base` = form/colour,
 * `finish` = pixels). The agent's (`by: agent`, `source: roster` — acting on a roster note) opens an extra autonomous
 * revision recorded as the agent's, within `review.rosterRevisions` per asset; the user's iteration budget is untouched.
 */
export async function feedback(p: Project, id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean; by?: 'user' | 'agent'; source?: string; via?: string }): Promise<{ opens: string; next: NextStep; iterations: number }> {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  requireLocked(p);
  const row = await assetRow(p, b), agent = o.by === 'agent';
  if (!['final', 'approved', 'exported', 'stale'].includes(row.status)) throw new Error(`${id} is ${row.status}: feedback applies to finished assets (wait for final)`);
  const a = openAsset(assetPathOf(p, b)), mine = feedbackOf(a).filter(f => (f.by === 'agent') === agent), iterations = mine.length + 1;
  const max = agent ? projectConfig(p).review.rosterRevisions : a.budget?.maxUserIterations ?? 3;
  if (iterations > max && !o.force) throw new Error(agent
    ? `${id}: ${iterations - 1} revisions from roster notes already (review.rosterRevisions ${max}) — list the note for the user instead, or pass --force`
    : `${id}: ${iterations - 1} user iterations already (budget.maxUserIterations ${max}) — escalate: talk it through with the user, or pass --force`);
  const vs = versionsIn(a), kind = o.route === 'base' ? 'base' : 'finish';
  const opens = `${kind}.v${Math.max(0, ...vs.map(parseVersion).filter(v => v!.kind === kind).map(v => v!.n)) + 1}`;
  appendLedger(ledgerFile(p), { type: 'feedback', asset: id, route: o.route, opens, on: row.final, note: o.note, ...(o.region && { region: o.region }), ...(o.cell && { cell: o.cell }), ...(agent ? { by: 'agent', source: o.source ?? 'roster' } : { by: 'user' }), ...(o.via && { via: o.via }) });
  return { opens, next: (await passState(openAsset(assetPathOf(p, b)))).next, iterations };
}

/** Approve a finished asset (R6: needs a passing gate on the final and a review sheet of it; D10: user only). */
export async function approve(p: Project, id: string, note = '', via?: string): Promise<LedgerEntry> {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  const dir = requireLocked(p), row = await assetRow(p, b);
  if (row.status !== 'final') throw new Error(`${id} is ${row.status}: only a final asset can be approved${row.status === 'stale' ? ' (run restyle first)' : ''}`);
  const a = openAsset(assetPathOf(p, b)), r = await renderVersion(a, row.final!);
  if (!r.report.pass) throw new Error(`${id} ${row.final}: the gate fails (${r.report.checks.filter(c => c.status === 'fail').map(c => c.id).join(', ')}) — give feedback instead (R6)`);
  const sheet = [...ledgerFor(a)].reverse().find(e => e.type === 'review' && e.version === row.final && !e.stage)?.sheet;
  if (!sheet) throw new Error(`${id} ${row.final}: no review sheet yet — artgen review first (R6)`);
  // keep the sheet the user approved from (art/sheets/approved/ is the one sheets folder that is committed)
  const kept = join(p.art, 'sheets', 'approved', `${id}-${row.final}.png`), src = resolve(dirname(ledgerFile(p)), String(sheet));
  if (existsSync(src)) { mkdirSync(dirname(kept), { recursive: true }); copyFileSync(src, kept); }
  // rev 9: approval stays the user's call, but say when the score behind it is not independent or the blind one disagrees
  const rv = reviewOf(a, row.final!), cfg = projectConfig(p).review, warnings: string[] = [];
  if (rv.blind === undefined) warnings.push(rv.reviewer === 'self' || !rv.reviewer ? 'scored only by the agent that made it, with no blind re-score' : 'no blind re-score of the final');
  warnings.push(...row.issues.filter(x => x.startsWith('blind re-score')));
  if (rv.blind !== undefined && rv.blind < cfg.approveMin && !warnings.some(x => x.startsWith('blind re-score'))) warnings.push(`blind re-score ${rv.blind} is under ${cfg.approveMin}`);
  // the keys of the stages the user approved: copied from the final's latest score entry (no new render)
  const stages = [...ledgerFor(a)].reverse().find(x => x.type === 'score' && !x.blind && x.version === row.final)?.stages;
  const e = { type: 'approve' as const, asset: id, version: row.final, sourceHash: finalHash(a, row.final!), outputHash: r.strip.hash(), ...(stages && typeof stages === 'object' ? { stages: stages as object } : {}), sheet: existsSync(kept) ? relative(p.art, kept).split('\\').join('/') : sheet, direction: { id: dir.id, version: dir.version }, note, ...(warnings.length && { warnings }), by: 'user' as const, ...(via && { via }) };
  appendLedger(ledgerFile(p), e);
  return { ts: new Date().toISOString(), ...e };
}

/**
 * Write the next `finish.vM.js` from the finish template (`artgen finish`, MCP `finish`), bound to `base`, else to the
 * pass machine's choice (the best scored base), else to the latest base (W1 probes before a lock).
 */
export async function writeNextFinish(path: string, o: { base?: string; direction?: string; ledger?: string } = {}): Promise<{ file: string; base: string }> {
  const vs = versionsIn({ path } as AssetDir), n = vs.filter(v => v.startsWith('finish.')).length + 1;
  let base = o.base;
  if (!base) {
    const st = await (async () => { try { return await passState(openAsset(path, o)); } catch { return undefined; } })();
    base = st?.next.action === 'write-finish' ? st.next.base : st?.best?.version ?? vs.filter(v => v.startsWith('base.')).pop();
  }
  if (!base) throw new Error(`${path}: no base version to finish`);
  // characters and creatures get the face-first finish template; the kind comes from the brief (W2) or brief.json (probes)
  const kind = (() => { try { return openAsset(path, o).brief.kind; } catch { return undefined; } })();
  return { file: newFinish(path, n, base, kind), base };
}

/** Does a brief belong in a pack (`include`: `*`, `goblin*`, `kind:tile`)? */
export function inPack(b: BriefEntry, pack: string, include: string[]): boolean {
  if (b.pack) return b.pack === pack;
  return include.some(pat => pat.startsWith('kind:') ? b.kind === pat.slice(5) : new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(b.id));
}

export interface ContractChange { id: string; change: 'created' | 'extended' | 'broken'; notes: string[] }
export interface ExportResult { packs: { pack: string; dir: string; atlases: string[]; assets: string[]; drafts: string[]; placeholders?: string[] }[]; assetsTs: string; skipped: { id: string; status: AssetStatus }[]; contracts: ContractChange[]; runtime?: VendorResult }

/**
 * Export approved assets into the configured packs: atlases + pack.json + Aseprite JSON, and the typed `assets.ts`;
 * with `runtime`, also vendor the W3 runtime (`--force` overwrites locally edited runtime files).
 * Every exported asset is held to its animation contract (`art/contracts/<id>.json`, written on its first export):
 * if a redraw changed states, frame counts, durations, loop, facings or anchor names, nothing is written unless the
 * asset is listed in `breakContract` (`*` = all). Additions extend the contract.
 */
export async function exportPacks(p: Project, o: { packs?: string[]; includeDrafts?: boolean; generator?: string; runtime?: boolean; force?: boolean; breakContract?: string[]; placeholders?: boolean } = {}): Promise<ExportResult> {
  const dir = requireLocked(p), cfg = projectConfig(p), rows = await projectStatus(p), briefs = readBriefs(p);
  const ok = (s: AssetStatus) => s === 'approved' || s === 'exported' || (o.includeDrafts && s === 'final');
  // `--placeholders` (docs/STAGES.md §5.2): what would not be exported is exported from its placeholder, unless real art of it was exported before
  const everExported = new Set(parseAll(ledgerFile(p)).filter(e => e.type === 'export' && e.version !== 'placeholder').map(e => e.asset));
  const standIn = (r: AssetRow) => !!o.placeholders && !ok(r.status) && !everExported.has(r.id);
  const skipped = rows.filter(r => !ok(r.status) && !standIn(r)).map(r => ({ id: r.id, status: r.status }));
  const out: ExportResult['packs'] = [], forTs: { manifest: ReturnType<typeof buildPack>['manifest']; url: string }[] = [];
  const builds: { pack: string; built: ReturnType<typeof buildPack>; inputs: PackInput[] }[] = [];
  for (const [pack, def] of Object.entries(cfg.packs)) {
    if (o.packs?.length && !o.packs.includes(pack)) continue;
    const inputs: PackInput[] = [];
    for (const r of rows) {
      const b = briefs.find(x => x.id === r.id)!;
      if (!(ok(r.status) || standIn(r)) || !inPack(b, pack, def.include)) continue;
      if (!ok(r.status)) {
        const a = openAsset(join(p.root, r.path)), ph = effectivePlaceholder(a), key = placeholderKey(ph);
        inputs.push({ brief: a.brief as AssetBrief, view: a.brief.view ?? dir.camera.view, renders: [renderAsset(placeholderModule(ph), { dir: a.dir, brief: a.brief })], version: 'placeholder', sourceHash: key, placeholder: true });
        continue;
      }
      const a = openAsset(join(p.root, r.path)), n = Math.max(1, b.variants ?? 1), renders: RenderResult[] = [];
      for (let k = 0; k < n; k++) renders.push((await renderVersion(a, r.final!, { variant: k })).render);
      inputs.push({ brief: a.brief as AssetBrief, view: a.brief.view ?? dir.camera.view, renders, version: r.final!, sourceHash: finalHash(a, r.final!), draft: r.status === 'final' });
    }
    if (!inputs.length) continue;
    builds.push({ pack, inputs, built: buildPack(pack, dir, inputs, { generator: o.generator, runtime: RUNTIME_VERSION, maxSize: cfg.export.maxAtlas, padding: cfg.export.padding }) });
  }
  // animation contracts: check every asset before writing anything
  const contracts: { next: AnimContract; change: ContractChange }[] = [], refused: string[] = [], seen = new Set<string>();
  for (const { built } of builds) for (const [id, a] of Object.entries(built.manifest.assets)) {
    if (seen.has(id)) continue; // an asset in several packs is the same render
    seen.add(id);
    const next = contractOf(id, a), old = readContract(p, id);
    if (!old) { contracts.push({ next, change: { id, change: 'created', notes: [] } }); continue; }
    const d = diffContract(old, next);
    if (d.breaking.length && !allowed(o.breakContract, id)) refused.push(`${id}: ${d.breaking.join('; ')}`);
    else if (d.breaking.length || d.added.length) contracts.push({ next, change: { id, change: d.breaking.length ? 'broken' : 'extended', notes: [...d.breaking, ...d.added.map(x => `added ${x}`)] } });
  }
  if (refused.length) throw new Error(`export refused: the animation contract changed for\n  ${refused.join('\n  ')}\ngame code indexes these states and frames (art/contracts/<id>.json). Restore the brief's anims/states/directions and the base's anchors, or re-run with --break-contract <id> once the game code is updated`);
  for (const { pack, built, inputs } of builds) {
    const pdir = join(p.root, cfg.export.packDir, pack);
    built.atlases.forEach((g, i) => { writeGrid(join(pdir, built.manifest.atlases[i]), g); writeJson(join(pdir, built.manifest.atlases[i].replace(/\.png$/, '.aseprite.json')), built.aseprite[i]); });
    built.normals?.forEach((g, i) => writeGrid(join(pdir, built.manifest.normals![i]), g));
    writeJson(join(pdir, 'pack.json'), built.manifest);
    for (const inp of inputs) appendLedger(ledgerFile(p), { type: 'export', asset: inp.brief.id, version: inp.version, sourceHash: inp.sourceHash, pack, direction: { id: dir.id, version: dir.version }, ...(inp.draft && { draft: true }), ...(inp.placeholder && { placeholder: true }), by: 'agent' });
    out.push({ pack, dir: rel(p, pdir), atlases: built.manifest.atlases.map(f => rel(p, join(pdir, f))), assets: inputs.map(i => i.brief.id), drafts: built.manifest.drafts ?? [], ...(built.manifest.placeholders && { placeholders: built.manifest.placeholders }) });
    const pub = cfg.export.packDir.replace(/\\/g, '/').replace(/^\.?\/?/, '');
    forTs.push({ manifest: built.manifest, url: pub.startsWith('public/') || pub === 'public' ? `/${pub.slice(7)}${pub.length > 7 ? '/' : ''}${pack}/pack.json`.replace(/\/+/g, '/') : `${pub}/${pack}/pack.json` });
  }
  for (const { next, change } of contracts) {
    writeJson(contractFile(p, next.asset), next);
    appendLedger(ledgerFile(p), { type: 'contract', asset: next.asset, change: change.change, ...(change.notes.length && { notes: change.notes }), by: 'agent' });
  }
  const tsFile = join(p.root, cfg.export.assetsTs);
  if (forTs.length) { mkdirSync(dirname(tsFile), { recursive: true }); writeFileSync(tsFile, assetsTs(forTs)); }
  const runtime = o.runtime ? vendorRuntime(p, { force: o.force, generator: o.generator }) : undefined;
  return { packs: out, assetsTs: forTs.length ? rel(p, tsFile) : '', skipped, contracts: contracts.map(c => c.change), ...(runtime && { runtime }) };
}

export interface RestyleResult { from: number; to: number; sheet: string; tokens: number; assets: { id: string; final: string; changedPct: number; tokenSame: number; consistent: boolean; gate: boolean; stale: string[]; stages: { same: StageId[]; changed: StageId[] } }[] }

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
    // which stages' keys moved (docs/STAGES.md §5.6); the sheet says so only for assets that use gates, so other sheets stay as they were
    const diff = diffStageKeys(before.stages.keys, after.stages.keys), stages = { same: STAGES.filter(k => diff[k] === 'same'), changed: STAGES.filter(k => diff[k] !== 'same' && diff[k] !== 'n/a') };
    const gated = gatesOf(a).includes('shape');
    sheetRows.push({ label: `${r.id} ${r.final}: ${d.changedPct}% px changed, tokens kept ${Math.round(d.tokenSame * 100)}%${gated ? (diff.shape === 'same' ? ' shape kept' : ' SHAPE CHANGED') : ''}${after.report.pass ? '' : ' GATE FAIL'}${after.stale?.length ? ' FINISH-STALE' : ''}`, before: thumb(before.render), after: thumb(after.render), mask: tokenDiffMask(thumb(before.render), thumb(after.render), from, to), bg: to.background });
    assets.push({ id: r.id, final: r.final!, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, stale: after.stale ?? [], stages });
    appendLedger(ledgerFile(p), { type: 'restyle', asset: r.id, version: r.final, from: { id: from.id, version: from.version }, direction: { id: to.id, version: to.version }, changedPct: d.changedPct, tokenSame: d.tokenSame, consistent: d.consistent, gate: after.report.pass, outputHash: after.strip.hash(), stages, ...(after.stale?.length && { stale: after.stale }), by: 'agent' });
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
  writeFileSync(file, `// finish.v${n} — hand edit imported from ${relative(a.path, resolve(png)).split('\\').join('/')} (artgen import-edit):
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
  const dir = requireLocked(p), all = parseAll(ledgerFile(p)), metas = projectMetas(p, dir);
  const ids = new Set(metas.map(m => m.id)), analysed = analytics(all.filter(e => ids.has(e.asset) || e.asset === 'gallery'), metas);
  // once there is map work in the ledger, the Generators table (art and each kind of map, the same fields); before that the report reads as it always did
  const maps = SUBJECT_KINDS.flatMap(kind => listSubjectIds(p, kind).map(id => ({ generator: kind as string, key: subjectKey(kind, id) })));
  const generators = all.some(e => isSubjectKey(e.asset)) ? generatorMetrics(all, [...metas.map(m => ({ generator: 'art', key: m.id })), ...maps]) : undefined, report = generators ? { ...analysed, generators } : analysed;
  return { report, markdown: analyticsMarkdown(report, title ?? `${dir.id}: pipeline analytics`) + (generators ? generatorsMarkdown(generators) : '') };
}

const parseAll = (f: string): LedgerEntry[] => (existsSync(f) ? parseLedger(readFileSync(f, 'utf8')) : []);

/** Brief metadata for analytics: kind, view, size, template and importance per brief id. */
function projectMetas(p: Project, dir?: Direction | null): AssetMeta[] {
  return readBriefs(p).map(b => {
    const bj = join(assetPathOf(p, b), 'brief.json'), local = existsSync(bj) ? readJson<{ template?: string }>(bj) : {};
    const size = Array.isArray(b.size) ? b.size.join('x') : (b.size ?? b.kind);
    return { id: b.id, kind: b.kind, view: b.view ?? dir?.camera.view, size, template: local.template, importance: b.importance ?? 'standard' };
  });
}

/**
 * The ledger and asset metadata of a project root (art/ledger.jsonl + briefs.yaml + its config), or of a bench-style
 * folder (ledger.jsonl beside asset directories with brief.json), for pooled analytics (v2, PLAN P7).
 */
export function ledgerSet(dir: string): LedgerSet {
  const root = resolve(dir), name = relative(process.cwd(), root).split('\\').join('/') || '.';
  if (existsSync(join(root, 'art', 'artgen.config.json'))) {
    const p = { root, art: join(root, 'art') };
    return { project: name, ledger: parseAll(ledgerFile(p)), metas: projectMetas(p, lockedDirection(p)), config: projectConfig(p) };
  }
  if (!existsSync(join(root, 'ledger.jsonl'))) throw new Error(`${dir}: neither a project (art/artgen.config.json) nor a folder with ledger.jsonl`);
  const metas: AssetMeta[] = [];
  for (const d of readdirSync(root, { withFileTypes: true })) {
    const bj = join(root, d.name, 'brief.json');
    if (!d.isDirectory() || !existsSync(bj)) continue;
    const b = readJson<{ id?: string; kind: string; view?: string; size?: string | number[]; template?: string; importance?: string }>(bj);
    metas.push({ id: b.id ?? d.name, kind: b.kind, view: b.view, size: Array.isArray(b.size) ? b.size.join('x') : b.size, template: b.template, importance: b.importance ?? 'standard' });
  }
  return { project: name, ledger: parseAll(join(root, 'ledger.jsonl')), metas };
}

/** Pooled recommendations (analytics v2) over project roots / bench folders; `apply` merges the patch into `p`'s config. */
export function pooledAnalytics(dirs: string[], o: { apply?: Project; minAssets?: number; title?: string } = {}) {
  const r = recommend(dirs.map(ledgerSet), { minAssets: o.minAssets });
  let applied: string | undefined;
  if (o.apply) {
    const f = join(o.apply.art, 'artgen.config.json'), raw = readJson<Record<string, unknown>>(f), next = applyRecommendations(mergeConfig(raw), r.patch);
    writeJson(f, { ...raw, budget: { ...(raw.budget as object), ...(next.budget.perKind && { perKind: next.budget.perKind }) }, models: next.models });
    applied = rel(o.apply, f);
  }
  return { report: r, markdown: recommendMarkdown(r, o.title), ...(applied && { applied }) };
}

/** The one-page data sheet of an asset (`artgen sheet <id>`): `<asset folder>/out/sheet.png` and `sheet.json`. */
export function writeAssetSheet(p: Project, id: string): { png: string; pngFile: string; json: string; sheet: ReturnType<typeof assetDataSheet>; markdown: string; warnings: string[] } {
  const b = readBriefs(p).find(x => x.id === id);
  if (!b) throw new Error(`no brief ${id}`);
  const dir = requireLocked(p), folder = assetPathOf(p, b), bj = join(folder, 'brief.json'), local = existsSync(bj) ? readJson<{ template?: string }>(bj) : {};
  const brief = { ...local, ...b }, sheet = assetDataSheet(brief, dir, budgetFor(projectConfig(p), brief, dir), readContract(p, id)), { refs, warnings } = loadRefs(p, brief.refs ?? []);
  const png = join(folder, 'out', 'sheet.png'), json = join(folder, 'out', 'sheet.json');
  mkdirSync(dirname(png), { recursive: true });
  writeFileSync(png, encodePNG(renderDataSheet(sheet, { refs })));
  writeFileSync(json, JSON.stringify(sheet, null, 2) + '\n');
  return { png: rel(p, png), pngFile: png, json: rel(p, json), sheet, markdown: dataSheetMarkdown(sheet), warnings };
}
