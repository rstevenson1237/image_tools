/** The feedback-loop operations that need the pixel-art pipeline (docs/TOOLING-PLAN.md §5b, R4): `pr prepare`, `pr parse`. `report`, `upstream`, `metrics export` and `metrics pool` are in `core.ts`: the maps-only bundle has them too. */
import { readFileSync } from 'node:fs';
import { parseReviewComment, prepareReview } from '../loop/pr-review.ts';
import { readBriefs } from '../w2.ts';
import { idsParam, text, type Inp } from './art-shared.ts';
import { defineOp, p } from './registry.ts';

export const prPrepare = defineOp({
  name: 'pr.prepare', module: 'art', effect: 'render',
  summary: 'Copy the finished assets\' review sheets to art/review/ and write REVIEW.md, the table to commit to the pull request for review from the phone or the cloud.',
  description: 'Prepare review on a pull request: copies each finished asset\'s review sheet (and the sheet of the version the latest feedback was on) to art/review/ and writes art/review/REVIEW.md, a table with the score, open issues and images. Commit art/review/ to the session\'s pull request; the user answers in a comment, one line per asset.',
  params: { ids: idsParam('brief ids; default every final asset'), base: p.str('make the image links absolute, e.g. https://github.com/<owner>/<repo>/blob/<branch>/art/review (for a pull request comment)', { mcp: false }) },
  async run(i: Inp, ctx) {
    const r = await prepareReview(ctx.project(), { ids: Array.isArray(i.ids) ? (i.ids as string[]) : undefined, base: i.base });
    return { dir: ctx.rel(r.dir), table: r.table, assets: r.items.map(x => x.id), missing: r.missing };
  },
  cli: {
    usage: '       artgen pr prepare [ids] [--base url]   review sheets and REVIEW.md in art/review/ to commit to the pull request',
    text: r => `${r.assets.length} assets in ${r.dir}/REVIEW.md${r.missing.length ? `\nno review sheet yet: ${r.missing.join(', ')} (artgen review <id>)` : ''}\ncommit art/review/ to the pull request, then ask the user to reply there: approve <id>, or <id>: <what to change>`,
  },
  mcp: { content: r => [text(r.table)] }, python: {},
});

export const prParse = defineOp({
  name: 'pr.parse', module: 'art', effect: 'read',
  summary: 'Read a pull request comment into the approve and feedback calls it asks for (one line per asset).',
  description: 'Read the user\'s pull request comment ("approve goblin", "goblin: arms too long", "goblin: finish: eyes too dark") into actions: approve and feedback calls, with lines naming no brief listed apart. Parse only: the session makes the calls with via: pr, after checking the comment is the user\'s.',
  params: { comment: p.str('the comment text; or a file with --file', { positional: true }), file: p.str('read the comment from this file (- for standard input)', { mcp: false }), ids: idsParam('brief ids that count; default every brief') },
  run(i: Inp, ctx) {
    const body = typeof i.file === 'string' ? readFileSync(i.file === '-' ? 0 : i.file, 'utf8') : typeof i.comment === 'string' ? i.comment : undefined;
    if (body === undefined) throw new Error('pr parse: give the comment text, or --file <path>');
    const ids = Array.isArray(i.ids) && (i.ids as string[]).length ? (i.ids as string[]) : readBriefs(ctx.project()).map(b => b.id);
    return parseReviewComment(body, ids);
  },
  cli: {
    usage: '       artgen pr parse <comment text> | --file <path|-> [ids]   a pull request comment as approve / feedback calls',
    text: r => [
      ...r.actions.map((a: { type: string; id: string; note: string; route?: string }) => a.type === 'approve' ? `approve ${a.id}${a.note ? ` --note ${JSON.stringify(a.note)}` : ''} --via pr` : `feedback ${a.id} ${a.route ? `--route ${a.route}` : '--route <base|finish>'} --note ${JSON.stringify(a.note)} --via pr`),
      ...r.unknown.map((u: string) => `unknown asset: ${u}`), ...r.ignored.map((u: string) => `ignored: ${u}`),
    ].join('\n') || 'nothing to do',
  },
  mcp: {}, python: {},
});

export const LOOP_ART_OPS = [prPrepare, prParse];
