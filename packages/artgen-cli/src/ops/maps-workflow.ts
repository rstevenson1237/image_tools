/**
 * The workflow operations of the map module (docs/WORKFLOW.md §10): brief, version, diff, review, feedback, approve, status and
 * sheet for each of `map`, `dungeon` and `settlement`, and `map direction`. One factory declares the same operations for the
 * three kinds. They are project features (they write the ledger), so none takes `--file`. Only the user approves or gives
 * feedback: on MCP `approve` needs `user_approved` and `feedback` needs the user's words. Imports only files the maps-only
 * bundle may hold.
 */
import { diffLines, mapDirection, subjects, type Change, type SubjectBrief, type SubjectKind } from 'artgen-core/maps';
import {
  approveSubject, diffVersions, feedbackSubject, history, KIND_NOUN, readBrief, recordVersion, reviewSubject, runDirection, statusRows, writeBrief, writeSheet, type StatusRow,
} from '../workflow.ts';
import { text, pngFile, type Inp } from './maps-shared.ts';
import { defineOp, p, type OpDef } from './registry.ts';

const noun = (k: SubjectKind) => KIND_NOUN[k];
const ID_DOC = (k: SubjectKind) => `the ${noun(k)}'s id`;
const idP = (k: SubjectKind, cmd: string) => p.str(ID_DOC(k), { positional: true, required: `${k} ${cmd}: <id>` });
const STR_LIST = { type: 'array', items: { type: 'string' } };
const region = (v: unknown): number[] | undefined => (Array.isArray(v) ? (v as number[]).map(Number) : undefined);

const cell = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}~` : s.padEnd(n));
const rowLine = (r: StatusRow) => `${cell(r.id, 16)} ${cell(r.status, 11)} ${cell(r.version ?? '-', 4)} ${r.why}${r.fail ? `  (${r.fail} check${r.fail === 1 ? '' : 's'} fail)` : ''}${r.flag ? `  (${r.flag} warning${r.flag === 1 ? '' : 's'})` : ''}`;

function opsFor(kind: SubjectKind): OpDef[] {
  const k = kind, N = noun(kind), ID = (cmd: string) => idP(k, cmd);

  const brief = defineOp({
    name: `${k}.brief`, module: 'maps', effect: 'write', summary: `Show or write the ${N}'s brief: what it is for in the user's words, and its reference images.`,
    description: `Show, or write, the ${N}'s brief (art/${subjects.SUBJECTS[k].dir}/<id>/${k}.brief.md): what it is for, in the user's words, with optional references (paths under art/, e.g. refs/coast.png) that the review sheet shows. Write it before generating. text and refs are changed only when given.`,
    params: { id: ID('brief'), text: p.str('the brief, in the user\'s words (replaces the text)'), refs: p.list('string', 'reference image paths under art/, e.g. refs/coast.png (replaces the list)', { schema: STR_LIST }) },
    run(i: Inp, ctx) {
      const P = ctx.project();
      type Out = { id: string; written: boolean; path?: string; text?: string; brief?: SubjectBrief };
      if (i.text === undefined && i.refs === undefined) { const b = readBrief(P, k, i.id); return { id: i.id, written: false, ...(b && { path: b.path, text: b.text, brief: b.brief }) } as Out; }
      const w = writeBrief(P, k, i.id, { text: typeof i.text === 'string' ? i.text : undefined, refs: Array.isArray(i.refs) ? (i.refs as string[]) : undefined });
      return { id: i.id, written: true, path: w.path, brief: w.brief } as Out;
    },
    cli: {
      usage: `       artgen ${k} brief <id> [--text "..."] [--refs a.png,b.png]   show or write the ${N}'s brief (what it is for, in the user's words) and its references`,
      text: r => (r.written ? `wrote ${r.path}${r.brief?.refs.length ? ` (${r.brief.refs.length} references)` : ''}` : r.text ?? `no brief yet: artgen ${k} brief ${r.id} --text "what it is for"`),
    },
    mcp: { content: r => [text(r.written ? { written: r.path, brief: r.brief } : r.text ?? `no brief yet for ${r.id}`)] }, python: {},
  });

  const version = defineOp({
    name: `${k}.version`, module: 'maps', effect: 'write', summary: `Record the working file as the next version (v1, v2, …), a frozen copy beside it.`,
    description: `Record the ${N}'s working file as the next version (a frozen copy beside it: v1, v2, …) and log it. Refused when nothing changed since the latest version. Do this after the edits of a round, before review.`,
    params: { id: ID('version'), note: p.str('what this version changes') },
    run: (i: Inp, ctx) => recordVersion(ctx.project(), k, i.id, { note: typeof i.note === 'string' ? i.note : undefined }),
    cli: { usage: `       artgen ${k} version <id> [--note "..."]   record the working file as the next version (a frozen copy beside it)`, text: (r, i) => `${i.id}: ${r.version} (${r.file})\nnext: artgen ${k} review ${i.id}` },
    mcp: {}, python: {},
  });

  const diff = defineOp({
    name: `${k}.diff`, module: 'maps', effect: 'read', summary: `What changed between two versions of a ${N} (default: the latest version → the working file).`,
    description: `What changed between two versions of the ${N}, one line per change (paths like rooms[id=hall].w). a and b are version names (v1, v2…) or "working"; default: the latest version against the working file.`,
    params: { id: ID('diff'), a: p.str('the older version, or "working"', { positional: true }), b: p.str('the newer version, or "working"', { positional: true }) },
    run: (i: Inp, ctx) => diffVersions(ctx.project(), k, i.id, i.a, i.b),
    cli: {
      usage: `       artgen ${k} diff <id> [a] [b]   what changed between two versions (default: the latest version → the working file; "working" is the file now)`,
      text: r => (r.changes.length ? [`${r.from} -> ${r.to}: ${r.changes.length} change${r.changes.length === 1 ? '' : 's'}`, ...diffLines(r.changes as Change[])].join('\n') : `${r.from} -> ${r.to}: no change`),
    },
    mcp: { content: r => [text({ from: r.from, to: r.to, changes: diffLines(r.changes as Change[]) })] }, python: {},
  });

  const review = defineOp({
    name: `${k}.review`, module: 'maps', effect: 'render', summary: `Build the review sheet of a version (render, data sheet, references) and log it; --score also logs a score.`,
    description: `Render a version of the ${N} (default: the latest) in the map direction's theme and put the render, the one-page data sheet and the references on a review sheet (art/…/out/review-vN.png), log it with the checks, and return it. Look at it: labels can be read, symbols don't overlap, the legend matches what is drawn, the requirements are met. score (0-10) with note and reviewer also logs a score for that version.`,
    params: {
      id: ID('review'), version: p.str('the version to review (v1, v2…; default the latest)', { positional: true }),
      score: p.num('also log this 0-10 score for the version'), note: p.str('the reviewer\'s note, with --score'), reviewer: p.str('who scored: the reviewer subagent\'s name (default self)'),
    },
    run: (i: Inp, ctx) => reviewSubject(ctx.project(), k, i.id, { version: i.version, score: typeof i.score === 'number' ? i.score : undefined, note: i.note, reviewer: i.reviewer }),
    cli: {
      usage: `       artgen ${k} review <id> [version] [--score n --note "..." --reviewer name]   the review sheet of a version (render, data sheet, references); --score logs a score`,
      text: (r, i) => [`review sheet ${r.sheet} (~${r.imageTokens} image tokens); checks ${r.pass ? 'pass' : 'FAIL'}`, ...r.checks.filter((c: { status: string }) => c.status === 'fail' || c.status === 'flag').map((c: { id: string; status: string; detail: string }) => `  ${c.status === 'fail' ? 'FAIL' : 'flag'} ${c.id}: ${c.detail}`), ...r.warnings.map((w: string) => `  warning: ${w}`), ...(r.score !== undefined ? [`score ${r.score} logged for ${r.version}`] : []), `next: show it to the user, then artgen ${k} approve ${i.id} or artgen ${k} feedback ${i.id} --note "..."`].join('\n'),
      json: r => ({ version: r.version, sheet: r.sheet, imageTokens: r.imageTokens, pass: r.pass, checks: r.checks, warnings: r.warnings, ...(r.score !== undefined && { score: r.score }) }),
    },
    mcp: { content: (r, _i, ctx) => [text({ version: r.version, sheet: ctx.rel(r.sheetFile), imageTokens: r.imageTokens, pass: r.pass, checks: r.checks, warnings: r.warnings, ...(r.score !== undefined && { score: r.score }) }), pngFile(r.sheetFile)] }, python: {},
  });

  const feedback = defineOp({
    name: `${k}.feedback`, module: 'maps', effect: 'write', summary: `Record the user's feedback on the latest version and open a revision.`,
    description: `Record the USER's feedback on the latest version of the ${N} (their words, not yours) and open a revision: rework, then record the next version. region x,y,w,h is optional (${k === 'map' ? 'map units' : 'cells'}).`,
    params: {
      id: ID('feedback'), note: p.str('what the user asked for, in their words', { required: `${k} feedback: --note "<what the user asked for>" is required` }),
      region: p.list('number', `x,y,w,h the note is about, in ${k === 'map' ? 'map units' : 'cells'}`), via: p.str('where the feedback came from, recorded in the ledger (pr: a pull request comment)', { mcp: false }),
    },
    run: (i: Inp, ctx) => feedbackSubject(ctx.project(), k, i.id, { note: i.note, region: region(i.region), via: typeof i.via === 'string' ? i.via : undefined }),
    cli: { usage: `       artgen ${k} feedback <id> --note "..." [--region x,y,w,h] [--via pr]   the user's feedback on the latest version; opens a revision`, text: (r, i) => `feedback recorded on ${r.on}: ${i.id} is ${r.status} (${r.why})` },
    mcp: {}, python: {},
  });

  const approve = defineOp({
    name: `${k}.approve`, module: 'maps', effect: 'write', summary: `Record the user's approval of the latest version (it must be final, with no failing check).`,
    description: `Record the USER's approval of the ${N}'s latest version (approval is the user's call, never the agent's). Call only after the user said so in this conversation; user_approved must be true and note should quote them. The version must be final (the working file equals it, no feedback open) and no check may fail; warnings are copied into the approval.`,
    params: {
      id: ID('approve'), note: p.str('the user\'s words'), user_approved: p.bool(`true only when the user explicitly approved this ${N}`, { required: true, cli: false }),
      via: p.str('where the approval came from, recorded in the ledger (pr: a pull request comment)', { mcp: false }),
    },
    run(i: Inp, ctx) {
      if (ctx.surface === 'mcp' && i.user_approved !== true) throw new Error(`approve: only the user approves a ${N} — show them the review sheet and ask; pass user_approved: true once they say so`);
      return approveSubject(ctx.project(), k, i.id, { note: typeof i.note === 'string' ? i.note : undefined, via: typeof i.via === 'string' ? i.via : undefined });
    },
    cli: {
      usage: `       artgen ${k} approve <id> [--note "..."] [--via pr]   the user's approval of the latest version (final, no failing check)`,
      text: e => `approved ${e.asset} ${e.version}${e.direction ? ` (map direction v${e.direction.version})` : ''}${(e.warnings as string[] | undefined)?.length ? `\nnote for the user: ${(e.warnings as string[]).join('; ')}` : ''}`,
    },
    mcp: {}, python: {},
  });

  const status = defineOp({
    name: `${k}.status`, module: 'maps', effect: 'read', summary: `Status of each ${N}: in-pipeline, final, approved, revision, stale; with one id, its history.`,
    description: `Status of every ${N} in the project (or the ids given): in-pipeline, revision, final (waiting for the user), approved or stale, with the latest version and why. With one id, also its history: versions with notes, reviews, scores, feedback and approvals.`,
    params: { ids: p.str(`${N} ids; default all`, { positional: 'rest', schema: STR_LIST }) },
    run(i: Inp, ctx) {
      const P = ctx.project(), ids = Array.isArray(i.ids) ? (i.ids as string[]) : undefined, rows = statusRows(P, k, ids);
      return { rows, ...(ids?.length === 1 && { history: history(P, k, ids[0]) }) };
    },
    cli: {
      usage: `       artgen ${k} status [ids]   status of each ${N}; with one id, its history (versions, reviews, feedback, approvals)`,
      text: r => [...(r.rows.length ? r.rows.map(rowLine) : [`no ${k}s yet: artgen ${k} new <id>`]), ...(r.history ? ['', ...(r.history.length ? r.history.map((h: { ts: string; type: string; version?: string; by?: string; text: string }) => `  ${h.ts.slice(0, 16).replace('T', ' ')}  ${cell(h.version ?? '', 4)} ${cell(h.type, 8)} ${h.by ?? ''}${h.text ? `  ${h.text}` : ''}`) : ['  no history yet'])] : [])].join('\n'),
    },
    mcp: {}, python: {},
  });

  const sheet = defineOp({
    name: `${k}.sheet`, module: 'maps', effect: 'render', summary: `The ${N}'s one-page data sheet: out/sheet.png and out/sheet.json.`,
    description: `Write the ${N}'s one-page data sheet (size, scale, grid, counts, what must hold, brief, references) to art/…/out/sheet.png and sheet.json, and return it.`,
    params: { id: ID('sheet') },
    run: (i: Inp, ctx) => writeSheet(ctx.project(), k, i.id),
    cli: {
      usage: `       artgen ${k} sheet <id>   the one-page data sheet: out/sheet.png and out/sheet.json`,
      text: r => `${r.png}\n${r.json}\n${r.markdown}${r.warnings.map((w: string) => `\nwarning: ${w}`).join('')}`,
      json: r => ({ png: r.png, json: r.json, sheet: r.sheet, warnings: r.warnings }),
    },
    mcp: { content: r => [text({ png: r.png, json: r.json, sheet: r.sheet, warnings: r.warnings }), pngFile(r.pngFile)] }, python: {},
  });

  return [brief, version, diff, review, feedback, approve, status, sheet];
}

const direction = defineOp({
  name: 'map.direction', module: 'maps', effect: 'write', summary: 'Show or change the map direction: the theme of each kind of map, the symbols a kind may use, and its lock.',
  description: 'Show, or change, the map direction (art/map-direction.json): the theme for each kind (map, dungeon, settlement) and the symbols a kind may use. theme "map=bw,settlement=color" and symbols "dungeon=altar,statue" change the draft; lock locks it, which is the USER\'s call (user_approved must be true). A lock moves the version up by one, so maps approved under the old one show as stale. The direction applies to review sheets, checks and staleness only; renders keep their own defaults.',
  params: {
    theme: p.str('kind=theme pairs, e.g. map=bw,settlement=color (a dungeon is bw only)'), symbols: p.str('kind=symbol,symbol, e.g. dungeon=altar,statue ("dungeon=" clears the set; ; between kinds)'),
    lock: p.bool('lock the direction (the user\'s call)'), note: p.str('the user\'s words, with --lock'),
    user_approved: p.bool('true only when the user explicitly asked to lock the map direction', { cli: false }),
    via: p.str('where the lock came from, recorded in the ledger (pr: a pull request comment)', { mcp: false }),
  },
  run(i: Inp, ctx) {
    if (i.lock && ctx.surface === 'mcp' && i.user_approved !== true) throw new Error('map direction: only the user locks the map direction — ask them; pass user_approved: true once they say so');
    return runDirection(ctx.project(), { theme: i.theme, symbols: i.symbols, lock: i.lock === true, note: i.note, via: typeof i.via === 'string' ? i.via : undefined });
  },
  cli: {
    usage: '       artgen map direction [--theme map=bw,settlement=color] [--symbols dungeon=altar,statue] [--lock] [--note "..."]   show or change the map direction; --lock is the user\'s call',
    text: r => {
      const d = r.direction as mapDirection.MapDirection | null;
      if (!d) return `no map direction yet: artgen map direction --theme map=bw,dungeon=bw,settlement=color --symbols dungeon=altar,statue, then --lock when the user agrees\nreviews use ${Object.entries(mapDirection.DEFAULT_THEME).map(([k, t]) => `${k} ${t}`).join(', ')}`;
      const lines = [`${d.id} v${d.version} ${d.status}${d.note ? ` — ${d.note}` : ''}`, ...Object.entries(d.themes).map(([k, t]) => `  ${k}: ${t}`), ...Object.entries(d.symbols).map(([k, s]) => `  ${k} symbols: ${(s as string[]).join(', ')}`)];
      return [...lines, ...(r.changed ? [r.locked ? `locked at v${d.version}: maps approved under another version are stale until re-approved` : `draft saved to ${r.file}; it applies once the user locks it (--lock)`] : [])].join('\n');
    },
    json: r => ({ direction: r.direction, file: r.file, changed: r.changed, locked: r.locked }),
  },
  mcp: { content: r => [text({ direction: r.direction, file: r.file, changed: r.changed, locked: r.locked })] }, python: {},
});

export const WORKFLOW_OPS: OpDef[] = [...opsFor('map'), direction, ...opsFor('dungeon'), ...opsFor('settlement')];
