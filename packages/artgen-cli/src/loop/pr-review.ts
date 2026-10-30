/**
 * Review on the pull request (docs/TOOLING-PLAN.md §5b, R4): the path for sessions that run in the cloud, where the person
 * cannot open `artgen ui`. `prepare` copies each finished asset's review sheet (and the sheet of the version a round of
 * feedback was on) into `art/review/` and writes `REVIEW.md`, a table the session commits to its pull request. The person
 * answers in a pull request comment, one line per asset; `parse` reads those lines into the `approve` and `feedback` calls
 * the session then makes with `--via pr`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GATEABLE, type GateStage } from 'artgen-core';
import { ledgerFor, openAsset, outDir } from '../asset.ts';
import type { Project } from '../projectfs.ts';
import { lockedDirection } from '../w1.ts';
import { projectStatus, type AssetRow } from '../w2.ts';

export interface ReviewItem {
  id: string;
  version: string;
  score?: number;
  blind?: number;
  issues: string[];
  belowBar?: boolean;
  /** The review sheet of the final, relative to `art/review/`. */
  sheet?: string;
  /** The sheet of the version the latest round of feedback was on, relative to `art/review/`: the "before". */
  before?: string;
  beforeVersion?: string;
}
/** An asset waiting on a gate (docs/STAGES.md §5.5): its sheet, relative to `art/review/`, and the answer it waits for. */
export interface GateItem { id: string; stage: GateStage; version?: string; sheet?: string; answer: string }
export interface ReviewPrepared { dir: string; table: string; items: ReviewItem[]; missing: string[]; gates: GateItem[] }

/** The review sheet of `version` of an asset, if the ledger names one and it is still on disk. */
function sheetFor(p: Project, row: AssetRow, version: string): string | undefined {
  const a = openAsset(join(p.root, row.path)), s = [...ledgerFor(a)].reverse().find(e => e.type === 'review' && e.version === version && !e.stage && typeof e.sheet === 'string')?.sheet;
  if (!s) return undefined;
  const f = resolve(p.art, String(s).split(',')[0]);
  return existsSync(f) ? f : undefined;
}

const cell = (s: string): string => s.replace(/\|/g, '/').replace(/\n/g, ' ');

/**
 * Copy the review sheets of the finished assets (all of them, or `ids`) to `art/review/<id>-<version>.png` and write `REVIEW.md`.
 * `base` turns the image links into absolute ones (`https://github.com/<repo>/blob/<ref>/art/review`, for a comment); by default they are
 * relative, which render in `REVIEW.md` itself on GitHub.
 */
export async function prepareReview(p: Project, o: { ids?: string[]; base?: string; now?: Date } = {}): Promise<ReviewPrepared> {
  const all = await projectStatus(p, o.ids), rows = all.filter(r => r.final && (o.ids?.length || r.status === 'final'));
  const dir = join(p.art, 'review');
  // a review is a snapshot: drop the sheets and table of an earlier one (and nothing else that is in the folder)
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (/^[\w-]+-(base|finish)\.v\d+(-shape)?\.png$|^[\w-]+-placeholder\.png$|^REVIEW\.md$/.test(f)) rmSync(join(dir, f));
  mkdirSync(dir, { recursive: true });
  const items: ReviewItem[] = [], missing: string[] = [], gates: GateItem[] = [];
  // assets waiting for the user at a gate: the shape sheet (or the placeholder picture) and the answer that opens it
  for (const r of all) if (r.next?.action === 'stage-gate') {
    const g = r.next, id = r.id, item: GateItem = { id, stage: g.stage, ...(g.version && { version: g.version }), answer: g.stage === 'shape' ? `approve ${id} shape, or ${id}: shape: <what to change>` : `approve ${id} placeholder, or ${id}: placeholder: <what to change>` };
    const a = openAsset(join(p.root, r.path));
    const src = g.stage === 'shape'
      ? (() => { const s = [...ledgerFor(a)].reverse().find(e => e.type === 'review' && e.stage === 'shape' && e.version === g.version && typeof e.sheet === 'string')?.sheet; return s ? resolve(p.art, String(s)) : undefined; })()
      : join(outDir(a), 'placeholder.png');
    if (src && existsSync(src)) { const name = g.stage === 'shape' ? `${id}-${g.version}-shape.png` : `${id}-placeholder.png`; copyFileSync(src, join(dir, name)); item.sheet = name; }
    gates.push(item);
  }
  for (const r of rows) {
    const item: ReviewItem = { id: r.id, version: r.final!, score: r.score, blind: r.blind, issues: r.issues, ...(r.belowBar && { belowBar: true }) };
    const sheet = sheetFor(p, r, r.final!);
    if (sheet) { const name = `${r.id}-${r.final}.png`; copyFileSync(sheet, join(dir, name)); item.sheet = name; } else missing.push(r.id);
    // the version the latest feedback was on, so the person sees what changed
    const fb = [...ledgerFor(openAsset(join(p.root, r.path)))].reverse().find(e => e.type === 'feedback' && typeof e.on === 'string' && e.on !== r.final);
    if (fb) {
      const prev = sheetFor(p, r, fb.on as string);
      if (prev) { const name = `${r.id}-${fb.on}.png`; copyFileSync(prev, join(dir, name)); item.before = name; item.beforeVersion = fb.on as string; }
    }
    items.push(item);
  }
  const d = lockedDirection(p), base = o.base ? o.base.replace(/\/$/, '') + '/' : '';
  const img = (f: string | undefined, alt: string) => (f ? `![${alt}](${base}${f})` : '—');
  const table = [
    `# Asset review${d ? ` — ${d.id} v${d.version}` : ''}, ${(o.now ?? new Date()).toISOString().slice(0, 10)}`, '',
    'Answer in a comment on this pull request, one line per asset:', '',
    '    approve goblin', '    goblin: the arms are too long', '    goblin: finish: the eyes are too dark', '',
    '`approve <id>` approves the asset as shown. `<id>: <what to change>` sends it back; start the note with `base:` (form, proportion, colour) or `finish:` (pixels) to say which kind of change it is, or leave that to the session. Lines that are neither are ignored.', '',
    items.length ? '| Asset | Version | Score | Blind | Open issues | Before | Now |\n|---|---|---|---|---|---|---|' : 'No finished assets are waiting for review.',
    ...items.map(i => `| **${i.id}**${i.belowBar ? ' (below bar)' : ''} | ${i.version} | ${i.score ?? '—'} | ${i.blind ?? '—'} | ${i.issues.length ? cell(i.issues.join('; ')) : '—'} | ${i.beforeVersion ? `${i.beforeVersion}<br>${img(i.before, `${i.id} ${i.beforeVersion}`)}` : '—'} | ${img(i.sheet, `${i.id} ${i.version}`)} |`),
    ...(missing.length ? ['', `No review sheet yet for ${missing.join(', ')}: run \`artgen review <id>\` first.`] : []),
    ...(gates.length ? [
      '', '## Waiting for your answer on a gate', '',
      'These assets stop at a gate until you answer: `approve <id> shape` keeps the silhouette as it is, `<id>: shape: <what to change>` sends it back (the same with `placeholder`).', '',
      '| Asset | Gate | Version | Sheet | Answer |', '|---|---|---|---|---|',
      ...gates.map(g => `| **${g.id}** | ${g.stage} | ${g.version ?? '—'} | ${g.sheet ? img(g.sheet, `${g.id} ${g.stage}`) : `none yet: run \`artgen ${g.stage === 'shape' ? `review ${g.id} --stage shape` : `placeholder ${g.id}`}\``} | \`${g.answer}\` |`),
    ] : []), '',
  ].join('\n');
  writeFileSync(join(dir, 'REVIEW.md'), table);
  return { dir, table, items, missing, gates };
}

export interface ReviewAction { type: 'approve' | 'feedback' | 'stage-approve' | 'stage-reject'; id: string; note: string; route?: 'base' | 'finish'; stage?: GateStage }
export interface ReviewParsed { actions: ReviewAction[]; unknown: string[]; ignored: string[] }

/**
 * Read a pull request comment into actions. `ids` are the assets under review: a line naming any other id is reported in
 * `unknown`, not guessed at. Several `approve` ids on one line (`approve goblin, orc`) are several actions.
 */
export function parseReviewComment(text: string, ids: readonly string[]): ReviewParsed {
  const known = new Set(ids), actions: ReviewAction[] = [], unknown: string[] = [], ignored: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // a quoted line (`> approve goblin`) is someone's earlier text, a copy of the instructions or a bot's echo: never a command
    if (/^\s*>/.test(raw)) { if (raw.replace(/^[\s>]+/, '')) ignored.push(raw.trim()); continue; }
    const line = raw.replace(/^[\s*\-+]+(?=\S)/, '').replace(/^\d+[.)]\s+/, '').replace(/[`*]/g, '').trim();
    if (!line) continue;
    const ap = line.match(/^approve\s+(.+)$/i), fb = line.match(/^([\w-]+)\s*:\s*(?:(base|finish|shape|placeholder)\s*:\s*)?(.+)$/i);
    // `approve goblin shape` approves a gate; `goblin: shape: arms too long` rejects one
    const st = ap?.[1].trim().match(/^([\w-]+)\s+(shape|placeholder)(?:\s+(?:[—–-]\s+|#\s+)(.*))?$/i);
    if (st && known.has(st[1]) && !known.has(st[2].toLowerCase())) { actions.push({ type: 'stage-approve', id: st[1], stage: st[2].toLowerCase() as GateStage, note: (st[3] ?? '').trim() }); continue; }
    if (ap) {
      // `approve goblin`, `approve goblin, orc`, `approve goblin — looks great`
      const [list, ...rest] = ap[1].split(/\s+[—–-]\s+|\s+#\s+/), words = list.split(/[\s,]+/).filter(Boolean);
      const named = words.filter(w => known.has(w)), note = rest.join(' - ').trim();
      if (!named.length) { unknown.push(raw.trim()); continue; }
      for (const w of words) if (!known.has(w)) unknown.push(`approve ${w}`);
      for (const id of named) actions.push({ type: 'approve', id, note });
    } else if (fb) {
      if (!known.has(fb[1])) { if (/^approve$/i.test(fb[1])) ignored.push(raw.trim()); else unknown.push(raw.trim()); continue; }
      if (fb[2] && (GATEABLE as readonly string[]).includes(fb[2].toLowerCase())) actions.push({ type: 'stage-reject', id: fb[1], stage: fb[2].toLowerCase() as GateStage, note: fb[3].trim() });
      else actions.push({ type: 'feedback', id: fb[1], note: fb[3].trim(), ...(fb[2] && { route: fb[2].toLowerCase() as 'base' | 'finish' }) });
    } else ignored.push(raw.trim());
  }
  return { actions, unknown, ignored };
}
