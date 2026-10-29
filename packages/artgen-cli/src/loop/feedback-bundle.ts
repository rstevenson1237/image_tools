/**
 * `artgen report <asset|map> [--note]` (docs/TOOLING-PLAN.md §5, R4): a feedback bundle a consumer repo can send back to the
 * artgen repo. It writes `art/feedback/<date>-<id>/` with the input file, the command that was run, the versions, the render,
 * the ledger lines and a `case.md` in the consumer-fixture layout (`packages/artgen-cli/fixtures/`), plus `ISSUE.md`, the text
 * of the issue it would open. Nothing leaves the machine unless `--issue` is given; the person reads the folder first.
 *
 * It imports only what the maps-only bundle may hold (no pixel-art pipeline): assets are read as files and ledger lines.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { checkDungeonFile, dungeonFile, renderDungeonFiles } from '../dungeon.ts';
import { checkMapFile, mapFile, renderMapFiles } from '../map.ts';
import { checkSettlementFile, renderSettlementFiles, settlementFile } from '../settlement.ts';
import type { Project } from '../projectfs.ts';
import { VERSION } from '../version.ts';

export type BundleKind = 'asset' | 'map' | 'dungeon' | 'settlement';
export const BUNDLE_KINDS: readonly BundleKind[] = ['asset', 'map', 'dungeon', 'settlement'];
/** Where issues go unless `--repo` says otherwise. */
export const DEFAULT_REPO = 'rstevenson1237/image_tools';
/** The input file of each map kind, as the fixtures name it. */
const INPUT: Record<Exclude<BundleKind, 'asset'>, string> = { map: 'map.json', dungeon: 'dungeon.json', settlement: 'settlement.json' };
/** A GitHub issue body holds 65536 characters; inline the input file only when it leaves room. */
const INLINE_MAX = 40_000;
/** The prefilled-link form of an issue has to fit in a URL. */
const LINK_BODY_MAX = 1_800;

export interface BundleOptions {
  /** What was wrong or missing, in the person's words. */
  note?: string;
  /** A map, dungeon or settlement file by path (no project needed). */
  file?: string;
  kind?: BundleKind;
  /** The folder to write the bundle to (default `art/feedback/<date>-<id>/` in the project, else beside the file). */
  out?: string;
  /** Leave the render out. */
  noRender?: boolean;
  now?: Date;
  repo?: string;
}

export interface Bundle {
  dir: string;
  id: string;
  kind: BundleKind;
  /** Files written, relative to `dir`. */
  files: string[];
  title: string;
  /** What the issue would say: `ISSUE.md`. */
  body: string;
  /** The prefilled new-issue link. */
  link: string;
  /** `ok`, or why the check failed or the render could not be made. */
  check: string;
}

const run = (cwd: string, ...args: string[]): string | undefined => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined; } catch { return undefined; }
};

/** The consumer's repo and commit, for case.md (`unknown` outside a git checkout). */
function consumerOf(root: string): { name: string; commit: string; branch: string } {
  const url = run(root, 'config', '--get', 'remote.origin.url'), name = url?.replace(/\.git$/, '').split(/[/:]/).slice(-2).join('/') ?? basename(root);
  return { name, commit: run(root, 'rev-parse', 'HEAD') ?? 'unknown', branch: run(root, 'rev-parse', '--abbrev-ref', 'HEAD') ?? 'unknown' };
}

/** What kind of file a map-family JSON file is, by its keys. */
export function kindOfFile(raw: unknown): Exclude<BundleKind, 'asset'> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.rooms) && Array.isArray(o.corridors)) return 'dungeon';
  if (Array.isArray(o.buildings)) return 'settlement';
  if (typeof o.cols === 'number' && typeof o.rows === 'number') return 'map';
  return undefined;
}

/** `art/assets/<kind>/<id>`, found by name (the briefs file is not read: it is YAML, and this must run without the pixel-art pipeline). */
function assetDirOf(p: Project, id: string): string | undefined {
  const base = join(p.art, 'assets');
  if (!existsSync(base)) return undefined;
  for (const k of readdirSync(base, { withFileTypes: true })) {
    const d = join(base, k.name, id);
    if (k.isDirectory() && existsSync(d) && statSync(d).isDirectory()) return d;
  }
  return undefined;
}

/** Everything the id could name in this project. */
function candidates(p: Project, id: string): { kind: BundleKind; file: string }[] {
  const out: { kind: BundleKind; file: string }[] = [];
  if (/^[\w-]+$/.test(id)) {
    for (const [kind, file] of [['map', mapFile(p, id)], ['dungeon', dungeonFile(p, id)], ['settlement', settlementFile(p, id)]] as const) if (existsSync(file)) out.push({ kind, file });
    const a = assetDirOf(p, id);
    if (a) out.push({ kind: 'asset', file: a });
  }
  return out;
}

const dateOf = (d: Date): string => d.toISOString().slice(0, 10);

/** An id as a folder name: letters, digits, `_` and `-` (a file's own `id` field is the reporter's text, not checked by anything yet). */
const safeId = (id: string): string => id.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';

/**
 * `briefs.yaml` cut down to the entry of one asset, so a report on one asset does not carry every other brief. A brief is a top-level
 * list item (`- id: goblin` …); undefined when the file does not read that way (the caller then says what it copied).
 */
export function briefOf(yaml: string, id: string): string | undefined {
  const blocks = yaml.split(/\r?\n/).reduce<string[][]>((acc, line) => { if (/^- /.test(line)) acc.push([line]); else acc.at(-1)?.push(line); return acc; }, []);
  if (!blocks.length) return undefined;
  const mine = blocks.filter(b => b.some(l => new RegExp(`^(?:- )?\\s*id:\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(l)));
  return mine.length === 1 ? mine[0].join('\n').replace(/\n*$/, '\n') : undefined;
}

/** A folder name nothing is in yet: `<name>`, `<name>-2`, … */
function freshDir(parent: string, name: string): string {
  for (let n = 1; ; n++) {
    const d = join(parent, n === 1 ? name : `${name}-${n}`);
    if (!existsSync(d)) return d;
  }
}

const list = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? list(join(dir, e.name)).map(f => `${e.name}/${f}`) : [e.name]));

const issueLink = (repo: string, title: string, body: string): string =>
  `https://github.com/${repo}/issues/new?${new URLSearchParams({ labels: 'artgen-feedback', title, body: body.length > LINK_BODY_MAX ? `${body.slice(0, LINK_BODY_MAX)}\n…\n(the rest is in ISSUE.md of the bundle: paste it here)` : body }).toString()}`;

/** `case.md`, in the layout of `packages/artgen-cli/fixtures/<consumer>/<case>/case.md`. */
function caseMd(o: { id: string; kind: BundleKind; format?: number; note: string; command: string; consumer: ReturnType<typeof consumerOf>; mapgen?: string; check: string; render: string; asset?: string; extra?: string }): string {
  const title = o.note.split('\n')[0].slice(0, 80) || 'reported from a consumer';
  return [
    `# ${o.id} — ${title}`, '',
    ...(o.format !== undefined ? [`format: ${o.kind} ${o.format}`] : [`kind: ${o.kind}`]),
    `consumer: ${o.consumer.name} at ${o.consumer.commit} (${o.consumer.branch}), reported with \`artgen report\``,
    `artgen: ${VERSION}${o.mapgen ? `, maps ${o.mapgen}` : ''}`,
    ...(o.asset ? [`asset: ${o.asset}`] : []), '',
    o.note || '(no note given)', '',
    '```sh', o.command, '```', '',
    `check: ${o.check}`, `render: ${o.render}`, '',
    '## Must go on drawing', '', '_(for the maintainer: the facts this file states, once the report is understood)_', '',
    '## Does not yet draw well', '', '_(what the consumer reported)_', '',
    ...(o.extra ? [o.extra, ''] : []),
  ].join('\n');
}

/** Read `version` from a map-family file, if it has one. */
const formatOf = (raw: unknown): number | undefined => (raw && typeof raw === 'object' && typeof (raw as { version?: unknown }).version === 'number' ? (raw as { version: number }).version : undefined);

/** Write the feedback bundle of an asset, map, dungeon or settlement. */
export async function writeBundle(p: Project | null, target: string | undefined, o: BundleOptions = {}): Promise<Bundle> {
  const now = o.now ?? new Date(), note = (o.note ?? '').trim();
  let kind: BundleKind, input: string, id: string;
  if (o.file) {
    input = resolve(o.file);
    if (!existsSync(input)) throw new Error(`report: no such file ${o.file}`);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(input, 'utf8')); } catch { raw = undefined; }
    const k = o.kind ?? kindOfFile(raw);
    if (!k || k === 'asset') throw new Error(`report --file ${o.file}: is it a map, a dungeon or a settlement? say so with --kind`);
    kind = k;
    id = safeId(target ?? ((raw as { id?: string } | undefined)?.id ?? basename(dirname(input))));
  } else {
    if (!target) throw new Error('report: name an asset, map, dungeon or settlement id (or --file <path>)');
    // `artgen report <dir>` used to write a benchmark report; that command is `bench-report` now
    if (existsSync(target) && statSync(target).isDirectory() && !candidates(p ?? { root: '.', art: '.' }, target).length) throw new Error(`report: ${target} is a folder: a benchmark report on a folder of asset directories is now \`artgen bench-report ${target}\`; \`report\` sends feedback about one asset or map`);
    if (!p) throw new Error('report: no artgen project here — name a file with --file <path>');
    const found = candidates(p, target).filter(c => !o.kind || c.kind === o.kind);
    if (!found.length) throw new Error(`report: ${target} is not an asset, a map, a dungeon or a settlement in this project`);
    if (found.length > 1) throw new Error(`report: ${target} is a ${found.map(c => c.kind).join(' and a ')} — say which with --kind`);
    ({ kind, file: input } = { kind: found[0].kind, file: found[0].file });
    id = target;
  }
  const root = p?.root ?? dirname(input), consumer = consumerOf(root);
  const dir = resolve(o.out ?? (p ? freshDir(join(p.art, 'feedback'), `${dateOf(now)}-${id}`) : freshDir(dirname(input), `feedback-${dateOf(now)}-${id}`)));
  mkdirSync(dir, { recursive: true });
  const files: string[] = [], put = (rel: string, text: string) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); files.push(rel); };
  const mapgen = (() => { try { return readFileSync(join(root, 'tools', 'artgen', 'VERSION'), 'utf8').trim(); } catch { return undefined; } })();

  let briefsNote: string | undefined;
  let check = 'ok', render = o.noRender ? 'not made (--no-render)' : 'ok', format: number | undefined, command: string, assetPath: string | undefined;
  if (kind === 'asset') {
    // the asset's sources, its brief, the direction it was made under and its ledger lines
    assetPath = p ? relative(p.art, input).split('\\').join('/') : undefined;
    const dst = join(dir, 'asset');
    cpSync(input, dst, { recursive: true, filter: f => relative(input, f).split(sep)[0] !== 'out' });
    files.push(...list(dst).map(f => `asset/${f}`));
    for (const f of ['direction.json', 'artgen.config.json']) if (p && existsSync(join(p.art, f))) { copyFileSync(join(p.art, f), join(dir, f)); files.push(f); }
    // the brief of this asset only; the whole file when it can't be cut (and the report says so)
    if (p && existsSync(join(p.art, 'briefs.yaml'))) {
      const all = readFileSync(join(p.art, 'briefs.yaml'), 'utf8'), mine = briefOf(all, id);
      put('briefs.yaml', mine ?? all);
      if (!mine) briefsNote = 'briefs.yaml is the whole file: the brief of this asset could not be cut out of it';
    }
    const ledger = p && existsSync(join(p.art, 'ledger.jsonl')) ? readFileSync(join(p.art, 'ledger.jsonl'), 'utf8').split('\n').filter(l => { try { return JSON.parse(l).asset === id; } catch { return false; } }) : [];
    put('ledger.jsonl', ledger.length ? ledger.join('\n') + '\n' : '');
    // the review sheet of the latest review, if it is still on disk
    const sheet = [...ledger].reverse().map(l => { try { return JSON.parse(l); } catch { return {}; } }).find(e => e.type === 'review' && typeof e.sheet === 'string')?.sheet as string | undefined;
    const sheetFile = p && sheet ? resolve(p.art, sheet.split(',')[0]) : undefined;
    if (!o.noRender && sheetFile && existsSync(sheetFile)) { mkdirSync(join(dir, 'render'), { recursive: true }); copyFileSync(sheetFile, join(dir, 'render', basename(sheetFile))); files.push(`render/${basename(sheetFile)}`); }
    else if (!o.noRender) render = 'no review sheet on disk (run `artgen review`)';
    const last = [...ledger].reverse().map(l => { try { return JSON.parse(l); } catch { return {}; } }).find(e => typeof e.version === 'string')?.version as string | undefined;
    command = `node tools/artgen/artgen.js render ${id}${last ? ` --version ${last}` : ''}`;
    check = ledger.length ? `${ledger.length} ledger lines${briefsNote ? `; ${briefsNote}` : ''}` : 'no ledger lines for it';
  } else {
    const ref = { file: input };
    writeFileSync(join(dir, INPUT[kind]), readFileSync(input));
    files.push(INPUT[kind]);
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(input, 'utf8')); } catch { raw = undefined; }
    format = formatOf(raw);
    const res = kind === 'map' ? checkMapFile(p, ref) : kind === 'dungeon' ? checkDungeonFile(p, ref) : checkSettlementFile(p, ref);
    const errors = res.errors as { path: string; message: string }[];
    check = res.ok ? 'ok' : errors.length ? errors.slice(0, 5).map(e => `${e.path || '(file)'}: ${e.message}`).join('; ') : `unmet: ${(res as { unmet?: string[] }).unmet?.join(', ')}`;
    if (!o.noRender) {
      try {
        const rr = kind === 'map' ? await renderMapFiles(p, ref, { out: dir }) : kind === 'dungeon' ? await renderDungeonFiles(p, ref, { out: dir }) : await renderSettlementFiles(p, ref, { out: dir });
        for (const f of [...new Set((Array.isArray(rr) ? rr.flatMap(x => x.files) : rr.files).map(f => basename(f)))]) if (existsSync(join(dir, f))) files.push(f);
      } catch (e) { render = `failed: ${(e as Error).message.split('\n')[0]}`; }
    }
    command = `node tools/artgen/artgen-maps.js ${kind} check --file ${INPUT[kind]} --json`;
  }

  const md = caseMd({ id, kind, format, note, command, consumer, mapgen, check, render, asset: assetPath });
  put('case.md', md);
  put('report.json', JSON.stringify({ schema: 1, id, kind, ...(format !== undefined && { format }), artgen: VERSION, ...(mapgen && { installed: mapgen }), consumer, note, check, render, createdAt: now.toISOString(), command }, null, 2) + '\n');

  // the issue it would open: the case, and the input file inline when it fits
  const title = `[artgen report] ${kind} ${id}${note ? `: ${note.split('\n')[0].slice(0, 60)}` : ''}`;
  const inputText = kind === 'asset' ? undefined : readFileSync(join(dir, INPUT[kind as Exclude<BundleKind, 'asset'>]), 'utf8');
  const inline = inputText !== undefined && inputText.length <= INLINE_MAX;
  const body = [
    md,
    ...(inline ? [`<!-- artgen:input ${INPUT[kind as Exclude<BundleKind, 'asset'>]} -->`, '```json', inputText!.trimEnd(), '```', ''] :
      [kind === 'asset' ? `The asset files, ledger lines and render are in \`${relative(p?.root ?? process.cwd(), dir)}\`: zip the folder and attach it to this issue.`
        : `The input file is too large to paste: attach \`${INPUT[kind as Exclude<BundleKind, 'asset'>]}\` from \`${relative(p?.root ?? process.cwd(), dir)}\` to this issue.`, '']),
  ].join('\n');
  put('ISSUE.md', `# ${title}\n\n${body}`);
  const repo = o.repo ?? DEFAULT_REPO;
  return { dir, id, kind, files, title, body, link: issueLink(repo, title, body), check };
}

/**
 * Open the issue for a bundle through the GitHub API with `token` (`GH_TOKEN` or `GITHUB_TOKEN`). Only `--issue` calls this, so the
 * person has read the bundle first. Returns the issue's link.
 */
export async function openIssue(b: Pick<Bundle, 'title' | 'body'>, repo: string, token: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'artgen-report' },
    body: JSON.stringify({ title: b.title, body: b.body, labels: ['artgen-feedback'] }),
  });
  if (!res.ok) throw new Error(`report --issue: GitHub answered ${res.status} for ${repo} — open the link instead (it is printed without --issue)`);
  const j = (await res.json()) as { html_url?: string };
  return j.html_url ?? `https://github.com/${repo}/issues`;
}
