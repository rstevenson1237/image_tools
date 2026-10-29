/** The production operations (W2): briefs, `make`, `status`, `gallery`, `feedback`, `approve`, `roster`, `export`, `restyle`, `import-edit`, `analytics`. Implementations moved here from `cli.ts` and the MCP server. */
import { writeFileSync } from 'node:fs';
import { IMPORTANCE, type BriefEntry, type Importance } from 'artgen-core';
import { VERSION } from '../version.ts';
import { lockedDirection } from '../w1.ts';
import { addBrief, approve, briefWarnings, exportPacks, feedback, gallery, importEdit, make, pooledAnalytics, projectAnalytics, projectStatus, readBriefs, removeBriefFile, requireLocked, restyle, rosterRecord, rosterRun, type WorkPacket } from '../w2.ts';
import { idsParam, packetLine, projectPng, sizeKey, statusTable, text, type Inp } from './art-shared.ts';
import { defineOp, p } from './registry.ts';

const ROSTER_SKILL = 'a roster review needs a fresh reviewer subagent; the CLI drives it';

export const briefAdd = defineOp({
  name: 'brief.add', module: 'art', effect: 'write', summary: 'Add a brief to art/briefs.yaml: the asset to make (id, kind, view, size, states, animations, …).',
  description: 'Add a brief to art/briefs.yaml (the asset to make: id, kind, view, size, states, directions, animations, swaps, importance, notes), as `artgen brief add` does. Returns the brief and warnings about materials its kind can\'t colour. An effect needs `object`, the drawable thing.',
  params: {
    id: p.str('the asset id', { positional: true, required: true }), kind: p.str('character, creature, prop, tile, effect, …', { required: 'brief add: --kind is required' }),
    view: p.str('topdown or iso (default: the locked direction\'s view)'), size: p.str('a size key or WxH'), states: p.list('string', 'animation states, a,b'), directions: p.num('facings (4 or 8)'),
    anims: p.list('string', 'animations as state:frames[:fps], walk:4,attack:3'), durations: p.list('string', 'frame durations as state=ms/ms/…, attack=80/80/200/80'), variants: p.num('how many variants to make'),
    swaps: p.list('string', 'colour swaps as name:from=to, red:cloth=accent'), importance: p.oneOf(IMPORTANCE, 'hero, standard or filler', { error: IMPORTANCE.join(' | ') }), priority: p.num('make order; lower is first'),
    height: p.num('the thing\'s height in metres (checked against the drawn size by the roster)'), body: p.str('quadruped, serpent, flyer or large (non-humanoid rigs)'), object: p.str('the drawable thing, for an effect: "ice lance", "ring of fire"'),
    notes: p.str('notes for the maker'), break_contract: p.bool('allow changing an exported animation\'s contract'),
  },
  run(i: Inp, ctx) {
    const pr = ctx.project(), anims = i.anims as string[] | undefined, swaps = i.swaps as string[] | undefined;
    const b: BriefEntry = {
      id: i.id, kind: i.kind,
      ...(i.view && { view: i.view as BriefEntry['view'] }), ...(i.size && { size: sizeKey(i.size) }),
      ...(i.states && { states: i.states }), ...(i.directions !== undefined && { directions: i.directions as BriefEntry['directions'] }),
      ...(anims && { anims: Object.fromEntries(anims.map(x => { const [s, f, fps] = x.split(':'); return [s, { frames: +f, ...(fps && { fps: +fps }) }]; })) }),
      ...(i.variants !== undefined && { variants: i.variants }),
      ...(swaps && { swaps: swaps.reduce((m, x) => { const [n, pair] = x.split(':'), [from, to] = pair.split('='); (m[n] ??= {})[from] = to; return m; }, {} as Record<string, Record<string, string>>) }),
      ...(i.importance && { importance: i.importance as Importance }), ...(i.priority !== undefined && { priority: i.priority }),
      ...(i.notes && { notes: i.notes }), ...(i.height !== undefined && { height: i.height }),
      ...(i.object && { object: i.object }), ...(i.body && { body: i.body as BriefEntry['body'] }),
    };
    for (const d of (i.durations as string[] | undefined) ?? []) {
      const [s, ms] = d.split('='), a = b.anims?.[s];
      if (!a || !ms) throw new Error(`--durations ${d}: give state=ms/ms/… for a state in --anims`);
      a.durations = ms.split('/').map(Number);
    }
    // new effect briefs name the drawable thing up front (rev 9); older briefs without one show it as an open issue
    if (b.kind === 'effect' && !b.object) throw new Error(`brief add ${b.id}: an effect needs --object "<the drawable thing>" (e.g. "ice lance", "ring of fire") — without the word effect or colour words`);
    if (b.anims && !b.states) b.states = ['idle', ...Object.keys(b.anims).filter(s => s !== 'idle')];
    const all = addBrief(pr, b, { breakContract: i.break_contract === true }), dir = lockedDirection(pr), warnings = dir ? briefWarnings(b, dir) : [];
    return { brief: b, count: all.length, warnings };
  },
  cli: {
    usage: [
      '       artgen brief add <id> --kind k [--view v] [--size key|WxH] [--states a,b] [--directions n] [--anims walk:4] [--durations attack=80/80/200/80] [--variants n] [--swaps red:cloth=accent] [--importance t] [--priority n] [--height metres] [--body quadruped|serpent|flyer|large] [--object "ice lance"] [--notes "..."] [--break-contract]',
    ],
    text: r => `brief ${r.brief.id} (${r.brief.kind}) in art/briefs.yaml — ${r.count} briefs${r.warnings.map((w: string) => `\n  warning: ${w}`).join('')}\nnext: artgen make ${r.brief.id}`,
  },
  mcp: {}, python: {},
});

export const briefList = defineOp({
  name: 'brief.list', module: 'art', effect: 'read', summary: 'List the briefs in art/briefs.yaml.',
  description: 'The briefs in art/briefs.yaml (id, kind, view, size, states, directions, animations, importance, notes).',
  params: {},
  run: (_i: Inp, ctx) => readBriefs(ctx.project()),
  cli: {
    usage: '       artgen brief list | rm <id> | lint [ids]',
    text: bs => bs.map((b: any) => `${b.id.padEnd(16)} ${b.kind.padEnd(10)} ${(b.states ?? ['idle']).join(',')}${b.directions ? ` ×${b.directions}` : ''}${b.anims ? ` ${Object.entries(b.anims).map(([k, v]) => `${k}:${(v as any).frames}`).join(' ')}` : ''}${b.importance ? ` [${b.importance}]` : ''}${b.notes ? ` — ${b.notes}` : ''}`).join('\n') || 'no briefs yet (artgen brief add <id> --kind …)',
  },
  mcp: {}, python: {},
});

export const briefRm = defineOp({
  name: 'brief.rm', module: 'art', effect: 'write', summary: 'Remove a brief (the asset sources are kept).',
  params: { id: p.str('the brief id', { positional: true, required: true }) },
  run: (i: Inp, ctx) => ({ id: i.id, removed: removeBriefFile(ctx.project(), i.id) }),
  cli: { usage: [], text: r => (r.removed ? `removed ${r.id} (asset sources are kept)` : `no brief ${r.id}`), json: r => ({ removed: r.removed }), exit: r => (r.removed ? 0 : 1) },
  mcp: { exclude: 'removing a brief is the user\'s call' }, python: {},
});

export const briefLint = defineOp({
  name: 'brief.lint', module: 'art', effect: 'read', summary: 'Warnings for briefs before any drawing starts: materials their kind\'s ramps leave out, views with no template.',
  description: 'Warnings for briefs before any drawing starts: materials a brief names (wood, steel, lava, rubble…) that its kind\'s ramps leave out, and briefs with no template for their view.',
  params: { ids: idsParam() },
  run(i: Inp, ctx) {
    const pr = ctx.project(), dir = ctx.surface === 'mcp' ? requireLocked(pr) : lockedDirection(pr);
    if (!dir) throw new Error('brief lint: lock a direction first (it checks briefs against its ramps and templates)');
    const want = Array.isArray(i.ids) ? (i.ids as string[]) : undefined;
    return readBriefs(pr).filter(b => !want?.length || want.includes(b.id)).map(b => ({ id: b.id, warnings: briefWarnings(b, dir) })).filter(r => r.warnings.length);
  },
  cli: { usage: [], text: rows => (rows.length ? rows.map((r: any) => `${r.id}:\n${r.warnings.map((w: string) => `  ${w}`).join('\n')}`).join('\n') : 'no brief warnings') },
  mcp: { content: rows => [text(rows.length ? rows : 'no brief warnings')] }, python: {},
});

export const makeOp = defineOp({
  name: 'make', module: 'art', effect: 'write', summary: 'One tick of the autonomous run: scaffold, mark finals, hold v2 for the v1 roster and name the next step.',
  description: 'One tick of the autonomous production run: scaffold missing assets from templates, mark finished pipelines final, and name the next step. parallel: n also returns a round of up to n maker packets (one subagent per asset; each writes only its own files, then runs render + review; resume: true = a version written but never reviewed, complete and review it) and the main agent\'s review steps. wave: finish n assets before starting more (survives usage-limit pauses: call make again, the ledger is the state). roster: assets held at v1 for the v1 roster review (artgen roster --stage v1); finalRoster: finals with no roster review yet.',
  params: {
    ids: idsParam(),
    // text on the command line, numbers on MCP: the check below reads both and says what it always has
    parallel: p.str('maker subagents per round', { schema: { type: 'number', description: 'maker subagents per round' } }),
    wave: p.str('assets in flight at once; the rest wait until those reach final', { schema: { type: 'number', description: 'assets in flight at once; the rest wait until those reach final' } }),
  },
  async run(i: Inp, ctx) {
    const cli = ctx.surface === 'cli', pick = (v: unknown, msg: string) => {
      if (cli) { if (v !== undefined && !(+(v as string) >= 1)) throw new Error(msg); return v === undefined ? undefined : +(v as string); }
      return typeof v === 'number' && v >= 1 ? v : undefined;
    };
    const parallel = pick(i.parallel, 'make --parallel <n>: how many maker subagents to run at once (e.g. 4)'), wave = pick(i.wave, 'make --wave <n>: how many assets to finish before starting more (e.g. 10)');
    return make(ctx.project(), Array.isArray(i.ids) ? (i.ids as string[]) : undefined, { parallel, wave });
  },
  cli: {
    usage: '       artgen make [ids|all] [--parallel n] [--wave n]',
    text: r => {
      const pk = packetLine, counts = Object.entries(r.rows.reduce((m: Record<string, number>, x: any) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, v]) => `${v} ${k}`).join(', ');
      return [
        ...(r.scaffolded.length ? [`scaffolded from templates:\n  ${r.scaffolded.join('\n  ')}`] : []), ...(r.finals.length ? [`marked final: ${r.finals.join(', ')}`] : []),
        ...(r.overBudget.length ? [`over budget, finished as is: ${r.overBudget.join(', ')}`] : []), statusTable(r.rows), `(${counts})`,
        ...(r.work ? [
          `parallel round: ${r.work.makers.length} maker subagent(s), one per asset; each writes only its own file(s), then runs artgen render + artgen review on its asset`,
          ...r.work.makers.map(pk), ...(r.work.queued.length ? [`queued for the next round (${r.work.queued.length}):`, ...r.work.queued.map(pk)] : []),
          ...(r.work.main.length ? ['main agent (reviews, blind re-scores — fresh art-reviewer per sheet):', ...r.work.main.map((x: WorkPacket) => pk(x))] : []),
        ] : []),
        ...(r.roster ? [`v1 roster: ${r.roster.ids.join(', ')} wait for it — ${r.roster.why}`] : []),
        r.next ? `next: ${r.next.id} — ${r.next.step.action} ${'version' in r.next.step ? r.next.step.version : ''} (${r.next.path}) — ${r.next.step.why}`
          : r.roster ? 'next: artgen roster --stage v1, a fresh art-reviewer in roster mode, then artgen roster record <its json> --reviewer art-reviewer'
          : r.finalRoster?.length ? `next: the final roster (${r.finalRoster.length} finals have no roster review): artgen roster, a fresh art-reviewer, artgen roster record — then the gallery`
          : 'next: nothing left in the pipeline — show the gallery to the user (artgen gallery)',
      ].join('\n');
    },
  },
  mcp: {}, python: {},
});

export const status = defineOp({
  name: 'status', module: 'art', effect: 'read', summary: 'Production status of every brief: brief, in-pipeline, final, approved, exported, with revision and stale.',
  description: 'Production status of every brief in art/briefs.yaml (brief, in-pipeline, final, approved, exported, revision, stale), with the final version, score, open issues and the next pipeline step.',
  params: { ids: idsParam() },
  run: (i: Inp, ctx) => projectStatus(ctx.project(), Array.isArray(i.ids) ? (i.ids as string[]) : undefined),
  cli: { usage: '       artgen status [ids]', text: rows => statusTable(rows) || 'no briefs yet' },
  mcp: {}, python: {},
});

export const galleryOp = defineOp({
  name: 'gallery', module: 'art', effect: 'render', summary: 'A sheet of finished assets for the user: score, open issues, BELOW BAR.',
  description: 'Sheet(s) of finished assets for the user (final render, score, blind score, open issues), logged to the ledger and returned.',
  params: { ids: idsParam('brief ids; default all finished') },
  run: (i: Inp, ctx) => gallery(ctx.project(), { ids: Array.isArray(i.ids) ? (i.ids as string[]) : undefined }),
  cli: {
    usage: '       artgen gallery [ids]',
    text: r => (r.sheets.length ? `gallery ${r.sheets.join(', ')} (~${r.tokens} image tokens)\n${r.assets.map((a: any) => `  ${a.id} ${a.final} ${a.score ?? '-'}${a.blind !== undefined ? ` b${a.blind}` : ''}${a.belowBar ? ' BELOW BAR' : ''}${a.top ? ` final≠best (${a.top.version} ${a.top.score})` : ''}${a.issues.length ? `\n${a.issues.map((x: string) => `    issue: ${x}`).join('\n')}` : ''}`).join('\n')}` : 'no finished assets waiting for review'),
  },
  mcp: { content: (r, _i, ctx) => [text(r.sheets.length ? r : 'no finished assets waiting for review'), ...r.sheets.map((f: string) => projectPng(ctx, f))] }, python: {},
});

export const feedbackOp = defineOp({
  name: 'feedback', module: 'art', effect: 'write', summary: 'Record feedback on a finished asset and open a revision.',
  description: 'Record feedback on a finished asset and open a revision. by: user (default) = the user\'s words, a U-stage iteration; by: roster = the agent acting on a roster note — recorded as the agent\'s (an extra autonomous revision within review.rosterRevisions), never as the user\'s. route base = form, proportion, colour (new base); finish = pixel fixes (finish revision). region x,y,w,h in sprite pixels of cell state/facing/frame.',
  params: {
    id: p.str('the brief id', { positional: true, required: true }),
    route: p.str('base (form, proportion, colour → new base) or finish (pixels → finish revision)', { required: 'feedback: --route base (form, proportion, colour → new base) | finish (pixels → finish revision)', schema: { type: 'string', enum: ['base', 'finish'] } }),
    note: p.str('what was asked for', { required: 'feedback: --note "<what the user asked for>" is required' }),
    by: p.str('user (default), roster or agent: who the note is from', { schema: { type: 'string', enum: ['user', 'roster', 'agent'] } }),
    region: p.list('number', 'x,y,w,h in sprite pixels of the cell'), cell: p.str('state/facing/frame'), force: p.bool('record it even when the asset is not final'),
  },
  async run(i: Inp, ctx) {
    const mcp = ctx.surface === 'mcp';
    if (i.route !== 'base' && i.route !== 'finish') throw new Error(mcp ? 'route: base | finish' : 'feedback: --route base (form, proportion, colour → new base) | finish (pixels → finish revision)');
    if (typeof i.note !== 'string' || !i.note) throw new Error(mcp ? 'note: the user\'s words (or the roster note) are required' : 'feedback: --note "<what the user asked for>" is required');
    // --by roster | agent: the agent acting on a roster note — recorded as the agent's, never as the user's
    if (!mcp && i.by !== undefined && !['user', 'roster', 'agent'].includes(i.by)) throw new Error('feedback --by user (default) | roster | agent');
    const agent = i.by === 'roster' || i.by === 'agent';
    return feedback(ctx.project(), i.id, { route: i.route, note: i.note, region: Array.isArray(i.region) ? (i.region as number[]) : undefined, cell: typeof i.cell === 'string' ? i.cell : undefined, force: i.force === true, ...(agent && { by: 'agent' as const, source: i.by as string }) });
  },
  cli: {
    usage: '       artgen feedback <id> --route base|finish --note "..." [--region x,y,w,h] [--cell s/f/n] [--by roster] [--force]',
    text: (r, i) => `feedback recorded (${i.by === 'roster' || i.by === 'agent' ? `${i.by} revision` : 'user iteration'} ${r.iterations}): opens ${r.opens}\nnext: ${r.next.action} ${'version' in r.next ? r.next.version : ''} — ${r.next.why}`,
  },
  mcp: {}, python: {},
});

export const approveOp = defineOp({
  name: 'approve', module: 'art', effect: 'write', summary: 'Record the user\'s approval of a final asset (a passing gate and a review sheet are needed).',
  description: 'Record the USER\'s approval of a final asset (approval is the user\'s call, never the agent\'s). Call only after the user said so in this conversation; user_approved must be true and note should quote them. Needs a passing gate and a review sheet of the final (R6).',
  params: {
    id: p.str('the brief id', { positional: true, required: true }), note: p.str('the user\'s words'),
    user_approved: p.bool('true only when the user explicitly approved this asset', { required: true, cli: false }),
  },
  async run(i: Inp, ctx) {
    if (ctx.surface === 'mcp' && i.user_approved !== true) throw new Error('approve: only the user approves assets — show them the gallery and ask; pass user_approved: true once they say so');
    return approve(ctx.project(), i.id, typeof i.note === 'string' ? i.note : '');
  },
  cli: {
    usage: '       artgen approve <id> [--note "..."]              user approval (a passing gate and a review sheet)',
    text: e => { const warn = (e.warnings as string[] | undefined) ?? []; return `approved ${e.asset} ${e.version} (direction v${e.direction?.version})${warn.length ? `\nnote for the user: ${warn.join('; ')}` : ''}`; },
  },
  mcp: {}, python: {},
});

export const roster = defineOp({
  name: 'roster', module: 'art', effect: 'render', summary: 'Contact sheets of the roster for a fresh reviewer: sizes against briefs, the most similar silhouettes.',
  params: { ids: idsParam('brief ids; default all'), seed: p.num('the sheet order\'s seed'), stage: p.str('v1 (every scored base.v1, before v2) or final (default)', { schema: { type: 'string', enum: ['v1', 'final'] } }) },
  async run(i: Inp, ctx) {
    const stage = i.stage ?? 'final';
    if (stage !== 'v1' && stage !== 'final') throw new Error('roster --stage v1 (every scored base.v1, before v2) | final (default)');
    return rosterRun(ctx.project(), { ids: i.ids, seed: i.seed, stage });
  },
  cli: {
    usage: '       artgen roster [ids] [--seed n] [--stage v1]',
    text: r => [
      `roster (${r.stage}) sheets: ${r.sheets.join(', ')} (~${r.tokens} image tokens); asset list for the reviewer: ${r.assets}${r.skipped.length ? `; tiles left out: ${r.skipped.join(', ')}` : ''}`,
      'sizes (drawn body height vs brief height × px per metre):',
      ...r.sizes.map((x: any) => `  ${x.id.padEnd(16)} ${String(x.drawn).padStart(3)} px${x.expected !== undefined ? `, expected ${x.expected} px for ${x.height} m (${x.dev! >= 0 ? '+' : ''}${Math.round(x.dev! * 100)} %)${x.flag ? ' FLAG' : ''}` : ' (no height in the brief)'}`),
      `most similar silhouettes: ${r.pairs.map((x: any) => `${x.a} ~ ${x.b} ${x.overlap}`).join(', ')}`,
      `next: give the ${r.sheets.length} sheets and the asset list (not the ledger) to a fresh art-reviewer in roster mode, then artgen roster record <its json> --reviewer art-reviewer${r.stage === 'v1' ? ' (its notes go into each asset\'s v2 brief)' : ''}`,
    ].join('\n'),
  },
  mcp: { exclude: ROSTER_SKILL }, python: {},
});

export const rosterRecordOp = defineOp({
  name: 'roster.record', module: 'art', effect: 'write', summary: 'Record a roster review\'s notes as open issues on the assets.',
  params: { file: p.str('the reviewer\'s review.json', { positional: true, required: true }), reviewer: p.str('who reviewed (default self)') },
  run: (i: Inp, ctx) => rosterRecord(ctx.project(), i.file, i.reviewer ?? 'self'),
  cli: {
    usage: '       artgen roster record <review.json> [--reviewer name]   (pages past 26 assets)',
    text: r => { const lines = Object.entries(r.issues).map(([id, xs]) => `  ${id}: ${(xs as string[]).join('; ')}`); return [`roster review recorded: ${lines.length} assets with open issues`, ...lines, ...r.notes.map((n: string) => `  note: ${n}`), 'they show in status and the gallery until the asset gets a new final'].join('\n'); },
  },
  mcp: { exclude: ROSTER_SKILL }, python: {},
});

export const exportOp = defineOp({
  name: 'export', module: 'art', effect: 'write', summary: 'Export approved assets into the configured packs: atlases, pack.json, Aseprite JSON, typed assets.ts.',
  description: 'Export approved assets into the configured packs (atlases, pack.json, Aseprite JSON, typed assets.ts); include_drafts adds finals; runtime vendors the artgen runtime + adapters. Animation contracts are enforced unless break_contract names the asset (or *).',
  params: {
    packs: p.list('string', 'pack names; default all', { flag: '--pack' }), include_drafts: p.bool('export finals that are not approved yet'), runtime: p.bool('vendor the artgen runtime and the adapters into the runtime folder'),
    force: p.bool('overwrite locally edited runtime files'), break_contract: p.list('string', 'asset ids (or *) whose animation contract may change'),
  },
  async run(i: Inp, ctx) {
    return exportPacks(ctx.project(), { packs: i.packs, includeDrafts: i.include_drafts === true, generator: `artgen ${VERSION}${ctx.surface === 'mcp' ? ' (mcp)' : ''}`, runtime: i.runtime === true, force: i.force === true, breakContract: i.break_contract });
  },
  cli: {
    usage: [
      '       artgen export [--pack name] [--include-drafts] [--runtime [--force]] [--break-contract id,…|*]',
    ],
    text: r => {
      const rt = r.runtime;
      return [
        ...r.packs.map((x: any) => `pack ${x.pack}: ${x.assets.length} assets → ${x.atlases.join(', ')} + ${x.dir}/pack.json${x.drafts.length ? ` (drafts: ${x.drafts.join(', ')})` : ''}`),
        r.assetsTs ? `typed ids: ${r.assetsTs}` : 'nothing approved to export yet',
        ...(r.skipped.length ? [`not exported: ${r.skipped.map((s: any) => `${s.id} (${s.status})`).join(', ')}`] : []),
        ...r.contracts.map((c: any) => `contract ${c.id}: ${c.change}${c.notes.length ? ` (${c.notes.join('; ')})` : ''} → art/contracts/${c.id}.json`),
        ...(rt ? [
          `runtime ${rt.from && rt.from !== rt.version ? `${rt.from} → ` : ''}${rt.version} (${rt.adapters.join(', ')}) in ${rt.dir}: ${rt.written.length} written, ${rt.unchanged.length} unchanged${rt.removed.length ? `, ${rt.removed.length} removed` : ''}`,
          ...(rt.kept.length ? [`kept locally edited runtime files (re-run with --force to overwrite): ${rt.kept.join(', ')}`] : []),
        ] : []),
      ].join('\n');
    },
  },
  mcp: {}, python: {},
});

export const restyleOp = defineOp({
  name: 'restyle', module: 'art', effect: 'render', summary: 'Re-render finished assets under the newly locked direction, with a before / after / token-diff sheet.',
  description: 'Re-render every finished asset under the newly locked direction: before | after | token-diff sheet (returned), per-asset change numbers; changed assets go back to final for re-approval.',
  params: { from: p.num('direction version to compare from; default the previous one') },
  run: (i: Inp, ctx) => restyle(ctx.project(), { from: typeof i.from === 'number' ? i.from : undefined }),
  cli: {
    usage: '       artgen restyle [--from N]                       re-render finished assets under the new direction + diff sheet',
    text: r => [`restyle v${r.from} → v${r.to}: ${r.sheet} (~${r.tokens} image tokens)`, ...r.assets.map((a: any) => `  ${a.id.padEnd(16)} ${a.changedPct}% px changed, tokens kept ${Math.round(a.tokenSame * 100)}%${a.consistent ? '' : ' (inconsistent colour mapping)'}${a.gate ? '' : ' GATE FAIL'}${a.stale.length ? ` FINISH-STALE ${a.stale.join('; ')}` : ''}`), 'changed assets are back to final: show the gallery and re-approve'].join('\n'),
    exit: r => (r.assets.every((a: any) => a.gate) ? 0 : 1),
  },
  mcp: { content: (r, _i, ctx) => [text(r), projectPng(ctx, r.sheet)] }, python: {},
});

export const importEditOp = defineOp({
  name: 'import-edit', module: 'art', effect: 'write', summary: 'Take a hand-edited PNG of an asset back into the next finish.vM.js.',
  params: { id: p.str('the brief id', { positional: true, required: true }), png: p.str('the edited PNG', { positional: true, required: true }), cell: p.str('state/facing/frame') },
  async run(i: Inp, ctx) { return { id: i.id, r: await importEdit(ctx.project(), i.id, i.png, { cell: i.cell }) }; },
  cli: {
    usage: '       artgen import-edit <id> <edited.png> [--cell s/f/n]   hand edit → next finish.vM.js',
    text: ({ id, r }) => `${r.file}: ${r.pixels} pixels in ${r.cells} cells${r.snapped ? `, ${r.snapped} snapped to the nearest palette colour` : ''}${r.conflicts ? `, ${r.conflicts} mirrored-cell edits dropped (edit the east facing)` : ''}\nnext: artgen review ${id}`,
    json: x => x.r,
  },
  mcp: { exclude: 'reads an edited PNG by path' }, python: {},
});

export const analytics = defineOp({
  name: 'analytics', module: 'art', effect: 'write', summary: 'Pipeline analytics: per-pass gains, cost per asset, budget suggestions (--across: pooled over projects).',
  description: 'Pipeline analytics for this project (per-pass gains, cost per asset, regressions, user revision rate, review independence, budget suggestions) as markdown.',
  params: {
    across: p.list('string', 'project roots (or bench folders with a ledger.jsonl) to pool: v2 recommendations across them', { mcp: false }), apply: p.bool('merge the config patch into this project\'s artgen.config.json (with --across)', { mcp: false }),
    min_assets: p.num('fewest assets a kind needs to be counted (default 3)', { mcp: false }), out: p.str('also write the markdown here', { mcp: false }),
  },
  run(i: Inp, ctx) {
    const across = i.across as string[] | undefined;
    if (across) {
      if (!across.length) throw new Error('analytics --across <project root>[,<root>…]: the projects (or bench folders with a ledger.jsonl) to pool');
      const r = pooledAnalytics(across, { apply: i.apply ? ctx.project() : undefined, minAssets: i.min_assets });
      if (i.out) writeFileSync(i.out, r.markdown);
      return { markdown: r.markdown + (r.applied ? `\napplied to ${r.applied}` : ''), data: { ...r.report, ...(r.applied && { applied: r.applied }) } };
    }
    const r = projectAnalytics(ctx.project());
    if (i.out) writeFileSync(i.out, r.markdown);
    return { markdown: r.markdown, data: r.report };
  },
  cli: {
    usage: ['       artgen analytics [--out file.md] | analytics --across <root>,<root>… [--apply] [--min-assets n] [--out file.md]'],
    text: r => r.markdown, json: r => r.data,
  },
  mcp: { content: r => [text(r.markdown)] }, python: {},
});
