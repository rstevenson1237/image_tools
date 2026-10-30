/** The stage operations (docs/STAGES.md §5): `placeholder`, `stages`, `stage approve` and `stage reject`. The gates themselves are the pass machine's (`pass next`, `make`, `status`); `review --stage shape` is in `art-asset.ts`, `export --placeholders` in `art-production.ts`. */
import { GATEABLE, STAGES } from 'artgen-core';
import { placeholderRun, stageVerdict, stagesRun, whyNotApplicable } from '../stages.ts';
import { assetOf, assetParam, directionParam, ledgerParam, projectPng, text, versionOf, versionParam, type Inp } from './art-shared.ts';
import { defineOp, p } from './registry.ts';

const checkLines = (cs: { id: string; status: string; detail: string }[]): string[] => cs.map(c => `  ${c.id.padEnd(14)} ${c.status.padEnd(5)} ${c.detail}`);

export const placeholderOp = defineOp({
  name: 'placeholder', module: 'art', effect: 'write', summary: 'Write the asset\'s placeholder (flat shapes at the right size, pivot and footprint), render it and check it.',
  description: 'Write the asset\'s placeholder.json from the brief\'s defaults (size, pivot, collision box, footprint, ramp, anchors), render it to out/placeholder.png and check it. Works on a brief with no versions yet. Refuses to overwrite a placeholder.json unless force. size, pivot and ramp override single fields. Export it with export placeholders so the game runs with it from day one.',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), force: p.bool('write the defaults over an existing placeholder.json'),
    size: p.size('the frame size, WxH (default: the brief\'s)', { schema: { type: 'array', items: { type: 'number' }, description: '[w, h] (default: the brief\'s size)' } }),
    pivot: p.points('the pivot, x,y in frame pixels', { schema: { type: 'array', items: { type: 'number' }, description: '[x, y] in frame pixels' } }), ramp: p.str('the ramp the body is drawn in (default: the kind\'s usual one)'),
    direction: directionParam(), ledger: ledgerParam(),
  },
  run(i: Inp, ctx) {
    const pivot = Array.isArray(i.pivot) ? (i.pivot as number[]) : undefined, size = Array.isArray(i.size) ? (i.size as number[]) : undefined;
    if (pivot && pivot.length !== 2) throw new Error('placeholder --pivot x,y: two numbers');
    if (size && size.length !== 2) throw new Error('placeholder --size WxH: width and height');
    const a = assetOf(ctx, i);
    return { id: a.brief.id, r: placeholderRun(a, { force: i.force === true, ...(size && { size: size as [number, number] }), ...(pivot && { pivot: pivot as [number, number] }), ...(typeof i.ramp === 'string' && { ramp: i.ramp }) }) };
  },
  cli: {
    usage: '       artgen placeholder <id> [--force] [--size WxH] [--pivot x,y] [--ramp name]   write, render and check the placeholder',
    text: ({ id, r }, i) => [`${id}: ${r.file} (key ${r.key})`, `  ${r.png}`, ...checkLines(r.checks), `next: artgen export --placeholders to put it in the game; ${i.force ? '' : 'show the user out/placeholder.png, then '}artgen stage approve ${id} placeholder`].join('\n'),
    json: ({ r }) => ({ file: r.file, png: r.png, key: r.key, placeholder: r.placeholder, checks: r.checks }),
    exit: ({ r }) => (r.checks.some((c: { status: string }) => c.status === 'fail') ? 1 : 0),
  },
  mcp: { content: ({ id, r }, _i, ctx) => [text({ id, file: ctx.rel(r.file), png: ctx.rel(r.png), key: r.key, placeholder: r.placeholder, checks: r.checks }), projectPng(ctx, ctx.rel(r.png))] }, python: {},
});

export const stagesOp = defineOp({
  name: 'stages', module: 'art', effect: 'read', summary: 'The stages of a version: each key, whether the user approved it as it is, and the stage checks.',
  description: 'The stages of a version (placeholder, shape, rig, decorate, decal, lighting, rotation, animation): each stage\'s key (a digest of its result) and its state (approved, changed since the approval, new, n/a), the stage checks (placeholder and shape) and the asset\'s gates.',
  params: { asset: assetParam('the asset: a brief id or an asset directory'), version: versionParam(), direction: directionParam(), ledger: ledgerParam() },
  async run(i: Inp, ctx) { const a = assetOf(ctx, i); return stagesRun(a, versionOf(ctx, a, i)); },
  cli: {
    usage: '       artgen stages <id> [--version v]   the stage keys of a version, what the user approved, the shape checks',
    text: r => [
      `${r.id} ${r.version}${r.gates.length ? ` (gates: ${r.gates.join(', ')})` : ' (no gates)'}`,
      ...STAGES.map((s, n) => `  ${n} ${s.padEnd(12)} ${(r.keys[s] ?? '—').padEnd(9)} ${r.keys[s] === undefined ? `n/a${whyNotApplicable(s) ? ` (${whyNotApplicable(s)})` : ''}` : r.states[s]}`),
      ...(r.checks.length ? ['checks:', ...checkLines(r.checks)] : []),
    ].join('\n'),
  },
  mcp: { content: r => [text(r)] }, python: {},
});

const stageParam = () => p.oneOf(GATEABLE, 'the stage: placeholder or shape', { positional: true, required: true, error: GATEABLE.join(' | ') });

export const stageApprove = defineOp({
  name: 'stage.approve', module: 'art', effect: 'write', summary: 'Record the user\'s approval of a stage (placeholder or shape) as it is now.',
  description: 'Record the USER\'s approval of a stage gate (placeholder or shape) as it is now: the stage key is recorded, so a later revision that keeps it passes the gate without asking again. Call only after the user said so in this conversation; user_approved must be true and note should quote them. Refused while a check of that stage fails, unless force.',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), stage: stageParam(), version: versionParam('the version approved; default the one the gate names, else the latest scored base'),
    note: p.str('the user\'s words'), force: p.bool('approve although a check of the stage fails (recorded as forced)'),
    user_approved: p.bool('true only when the user explicitly approved this stage', { required: true, cli: false }),
    via: p.str('where the approval came from, recorded in the ledger (pr: a pull request comment)', { mcp: false }), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    if (ctx.surface === 'mcp' && i.user_approved !== true) throw new Error('stage_approve: only the user approves a stage — show them the sheet and ask; pass user_approved: true once they say so');
    return stageVerdict(assetOf(ctx, i), i.stage, 'approve', { version: i.version, note: i.note, via: i.via, force: i.force === true });
  },
  cli: {
    usage: '       artgen stage approve <id> <placeholder|shape> [--version v] [--note "..."] [--via pr] [--force]   user approval of a gate',
    text: ({ entry }) => `approved the ${entry.stage} of ${entry.asset}${entry.version ? ` ${entry.version}` : ''} (key ${entry.key})${entry.forced ? ' - forced past failing checks' : ''}`,
    json: ({ entry }) => entry,
  },
  mcp: { name: 'stage_approve', content: ({ entry }) => [text(entry)] }, python: {},
});

export const stageReject = defineOp({
  name: 'stage.reject', module: 'art', effect: 'write', summary: 'Record the user\'s rejection of a stage (placeholder or shape), with what to change.',
  description: 'Record the USER\'s rejection of a stage gate (placeholder or shape), with their words. The pass machine then asks for a new base that redraws the silhouette and form (shape) before any decoration. Call only after the user said so in this conversation; user_approved must be true and note must be their words.',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), stage: stageParam(), version: versionParam('the version rejected; default the one the gate names, else the latest scored base'),
    note: p.str('what the user asked for', { required: 'stage reject: --note "<what the user asked for>" is required' }),
    user_approved: p.bool('true only when the user explicitly rejected this stage', { required: true, cli: false }),
    via: p.str('where the rejection came from, recorded in the ledger (pr: a pull request comment)', { mcp: false }), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    if (ctx.surface === 'mcp' && i.user_approved !== true) throw new Error('stage_reject: only the user rejects a stage — pass user_approved: true once they said so, and note their words');
    if (typeof i.note !== 'string' || !i.note) throw new Error(ctx.surface === 'mcp' ? 'note: the user\'s words are required' : 'stage reject: --note "<what the user asked for>" is required');
    return stageVerdict(assetOf(ctx, i), i.stage, 'reject', { version: i.version, note: i.note, via: i.via });
  },
  cli: {
    usage: '       artgen stage reject <id> <placeholder|shape> --note "..." [--version v] [--via pr]   user rejection of a gate',
    text: ({ entry }) => `rejected the ${entry.stage} of ${entry.asset}${entry.version ? ` ${entry.version}` : ''}: ${entry.note}`,
    json: ({ entry }) => entry,
  },
  mcp: { name: 'stage_reject', content: ({ entry }) => [text(entry)] }, python: {},
});

export const STAGE_OPS = [placeholderOp, stagesOp, stageApprove, stageReject];
