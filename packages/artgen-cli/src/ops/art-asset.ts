/** The asset-pipeline operations (`pass`, `render`, `review`, `conformance`, `score`, `variants`, `report`) and the breadth ones (`voxel`, `anim`, `texture`, `fx`, `bench`). Implementations moved here from `cli.ts` and the MCP server. */
import { join } from 'node:path';
import { Grid, MATERIALS, PRESET_NAMES } from 'artgen-core';
import { passState, renderVersion, reviewVersion, scoreVersion, variantsSheet, writeRender } from '../asset.ts';
import { resolveDirection, updateGolden, writeBench } from '../bench.ts';
import { writeGrid } from '../node.ts';
import { animPreview, fxRun, textureRun, voxelExport } from '../p6.ts';
import { report } from '../report.ts';
import { requireLocked } from '../w2.ts';
import { assetOf, assetParam, directionParam, image, ledgerParam, pngFile, projectPng, sizeOf, text, toolDirection, versionOf, versionParam, type Inp } from './art-shared.ts';
import { defineOp, p } from './registry.ts';

const PASS_NEXT = 'pass_status includes the next step';
const passRows = (st: any): string => st.rows.map((r: any) => `  ${r.pass.padEnd(4)} ${r.version.padEnd(10)} ${r.score === undefined ? 'unscored' : `score ${r.score}`}${r.gate === undefined ? '' : r.gate ? ' gate pass' : ' gate FAIL'}${r.base ? ` (on ${r.base})` : ''}`);
const nextLine = (n: any): string => `${n.action} ${'version' in n ? n.version : ''} — ${n.why}`;

export const passStatus = defineOp({
  name: 'pass.status', module: 'art', effect: 'read', summary: 'Pipeline state of an asset: versions, scores, gate, best base and the next step.',
  description: 'Pipeline state of an asset directory: versions, scores, gate, best base, and the next step (write-base, review, write-finish, blind-review, ready).',
  params: { asset: assetParam(), direction: directionParam(), ledger: ledgerParam() },
  run: (i: Inp, ctx) => passState(assetOf(ctx, i)),
  cli: {
    usage: '       artgen pass status|next <assetDir>             pipeline state (v1 → v2 → v3 → finish → ready)',
    text: st => [`${st.asset}${st.best ? ` — best base ${st.best.version} (${st.best.score})` : ''}`, ...passRows(st), ...(st.stale?.length ? ['  FINISH-STALE:', ...st.stale.map((s: string) => `    ${s}`)] : []), `next: ${nextLine(st.next)}`].join('\n'),
  },
  mcp: { name: 'pass_status' }, python: {},
});

export const passNext = defineOp({
  name: 'pass.next', module: 'art', effect: 'read', summary: 'The next step of an asset\'s pipeline.',
  params: { asset: assetParam(), direction: directionParam(), ledger: ledgerParam() },
  run: (i: Inp, ctx) => passState(assetOf(ctx, i)),
  cli: { usage: [], text: st => nextLine(st.next), json: st => st.next },
  mcp: { exclude: PASS_NEXT }, python: {},
});

export const render = defineOp({
  name: 'render', module: 'art', effect: 'render', summary: 'Render one version of an asset and run the conformance gate.',
  description: 'Render one version of an asset (all states × facings × frames side by side) and run the conformance gate.',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), version: versionParam(), variant: p.int('render this variant of the version (a seed offset)'),
    stages: p.bool('write each drawing stage as a PNG under out/stages', { mcp: false }), scale: p.num('scale of the returned image (default 4)', { cli: false }), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const a = assetOf(ctx, i), version = versionOf(ctx, a, i, 'no versions yet'), stages = i.stages ? new Map<string, Grid>() : undefined;
    const variant = typeof i.variant === 'number' ? i.variant : 0;
    const r = await renderVersion(a, version, { variant, stages });
    // the command line writes the render's files; the MCP tool returns the strip and writes nothing
    let files: string[] = [];
    if (ctx.surface === 'cli') {
      files = writeRender(a, r, variant ? join(a.path, 'out', `variant-${variant}`) : undefined);
      if (stages) for (const [k, g] of stages) writeGrid(join(a.path, 'out', 'stages', version, `${k.replace(/\//g, '_')}.png`), g);
    }
    return { id: a.brief.id, version, r, files };
  },
  cli: {
    usage: '       artgen render <assetDir> [--version base.vN|finish.vM] [--variant n] [--stages]',
    text: x => `${x.id} ${x.version}: ${x.r.report.pass ? 'gate pass' : 'gate FAIL'}  ${x.r.report.checks.map((c: any) => `${c.id}:${c.status}`).join(' ')}\n  ${x.files.join('\n  ')}${x.r.stale?.length ? `\n  FINISH-STALE: ${x.r.stale.join('; ')}` : ''}`,
    json: x => ({ version: x.version, pass: x.r.report.pass, checks: x.r.report.checks, metrics: x.r.report.metrics, files: x.files, stale: x.r.stale }),
    exit: x => (x.r.report.pass ? 0 : 1),
  },
  mcp: { content: (x, i) => [text({ version: x.version, pass: x.r.report.pass, checks: x.r.report.checks, metrics: x.r.report.metrics, stale: x.r.stale }), image(x.r.strip.scale(typeof i.scale === 'number' ? i.scale : 4))] }, python: {},
});

export const review = defineOp({
  name: 'review', module: 'art', effect: 'render', summary: 'Build the review sheet for a version and log it to the ledger.',
  description: 'Build the review sheet for a version (best so far, v(n-1), v(n), checker + scaled + in context + silhouette), log it to the ledger and return it. blind: the version alone (no earlier versions, scores or notes) for a fresh reviewer\'s blind re-score of a version. detail: low = the first facing at 3x beside the previous version only (about half the image tokens; the default for r1), full = every facing and the best so far. scene: add the sprite at game zoom on the background, a floor and beside a wall (contrast check).',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), version: versionParam('the version to review; default the latest'),
    blind: p.bool('the version alone, for a fresh reviewer\'s blind re-score'), detail: p.str('low (first facing at 3×, previous version only) or full (every facing, the best so far)', { schema: { type: 'string', enum: ['low', 'full'] } }),
    scene: p.bool('add the sprite on a floor and beside a wall (contrast check)'), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const detail = i.detail;
    if (ctx.surface === 'cli' && detail !== undefined && detail !== 'low' && detail !== 'full') throw new Error('review --detail low (first facing at 3×, previous version only) | full (every facing, the best so far)');
    const a = assetOf(ctx, i), version = versionOf(ctx, a, i);
    return reviewVersion(a, version, { blind: i.blind === true, ...((detail === 'low' || detail === 'full') && { detail }), scene: i.scene === true });
  },
  cli: {
    usage: '       artgen review <assetDir> [--version v] [--blind] [--detail low|full] [--scene]',
    text: r => `review sheet ${r.path} (~${r.tokens} image tokens); gate ${r.render.report.pass ? 'pass' : 'FAIL'}`,
    json: r => ({ sheet: r.path, tokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks }),
  },
  mcp: { content: (r, _i, ctx) => [text({ sheet: ctx.rel(r.path), imageTokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks }), pngFile(r.path)] }, python: {},
});

export const conformance = defineOp({
  name: 'conformance', module: 'art', effect: 'read', summary: 'Run the conformance gate on a version (nothing is written).',
  description: 'Conformance gate (palette, scale, aa, line, light, dither, source lint, scene lint, anchors) for a version.',
  params: { asset: assetParam('the asset: a brief id or an asset directory'), version: versionParam(), direction: directionParam(), ledger: ledgerParam() },
  async run(i: Inp, ctx) {
    const a = assetOf(ctx, i), version = versionOf(ctx, a, i);
    return { id: a.brief.id, version, report: (await renderVersion(a, version)).report };
  },
  cli: {
    usage: '       artgen conformance <assetDir> [--version v]     the gate alone: palette, scale, aa, line, light, dither, lint, anchors',
    text: x => `${x.id} ${x.version}: ${x.report.pass ? 'gate pass' : 'gate FAIL'}  ${x.report.checks.map((c: any) => `${c.id}:${c.status}`).join(' ')}`,
    json: x => x.report, exit: x => (x.report.pass ? 0 : 1),
  },
  mcp: { content: x => [text(x.report)] }, python: {},
});

export const score = defineOp({
  name: 'score', module: 'art', effect: 'write', summary: 'Record a 0-10 visual score for a reviewed version, with its gate results and token estimates.',
  description: 'Record a 0-10 visual score for a reviewed version (the art-reviewer verdict) with gate results and token estimates. reviewer: who scored (the subagent name; omitted = self). blind: a blind re-score from the blind sheet (needs a reviewer). agent_tokens_in: the total input tokens the maker or reviewer agent read for this pass, when known (analytics counts what the orchestration costs).',
  params: {
    asset: assetParam('the asset: a brief id or an asset directory'), version: p.str('the version scored, base.vN or finish.vM', { positional: true, required: true }),
    // text on the command line, a number on MCP: the check below reads both, and says "score must be 0–10" for anything else
    score: p.str('the visual score, 0 to 10', { positional: true, required: true, schema: { type: 'number' } }),
    note: p.str('what the reviewer saw'), reviewer: p.str('who scored: the reviewer subagent\'s name (default self)'), blind: p.bool('a blind re-score from the blind sheet (needs a reviewer)'),
    model: p.str('the model that made this pass (overrides the config mapping)'), effort: p.str('the effort level of this pass'), tokens_in: p.num('measured input tokens of this pass'), tokens_out: p.num('measured output tokens of this pass'),
    agent_tokens_in: p.num('the total input tokens the maker or reviewer agent read for this pass, when known'), ms: p.num('wall-clock milliseconds of this pass'), direction: directionParam(), ledger: ledgerParam(),
  },
  async run(i: Inp, ctx) {
    const mcp = ctx.surface === 'mcp', s = mcp ? i.score : +i.score;
    if (!(s >= 0 && s <= 10)) throw new Error(mcp ? 'score must be 0-10' : 'score must be 0–10');
    // measured analytics override the config mapping and the estimates (D19)
    const ex: Record<string, unknown> = {};
    if (i.model) ex.model = i.model;
    if (i.effort) ex.effort = i.effort;
    if (typeof i.ms === 'number') ex.wallMs = i.ms;
    // who scored (rev 9): the reviewer subagent passes its name; anything else is the authoring agent scoring itself
    const reviewer = mcp ? (typeof i.reviewer === 'string' && i.reviewer ? i.reviewer : 'self') : (i.reviewer ?? 'self');
    ex.reviewer = reviewer;
    if (i.blind === true) {
      if (reviewer === 'self') throw new Error(mcp ? 'a blind re-score needs reviewer: it comes from a fresh reviewer that saw only the blind sheet' : 'score --blind needs --reviewer <name>: a blind re-score comes from a fresh reviewer that saw only the blind sheet, never from the agent that made the asset');
      ex.blind = true;
    }
    const a = assetOf(ctx, i);
    if (typeof i.tokens_in === 'number' || typeof i.tokens_out === 'number') ex.measured = { in: i.tokens_in ?? 0, out: i.tokens_out ?? 0 };
    // the context the maker or reviewer agent read for this pass (skills, direction, rigs): what the orchestration costs
    if (i.agent_tokens_in !== undefined) {
      const n = i.agent_tokens_in;
      if (!mcp && !(n >= 0)) throw new Error('score --agent-tokens-in <n>: the total input tokens the agent read for this pass');
      if (typeof n === 'number' && n >= 0) ex.measured = { ...(ex.measured as object | undefined), agentIn: n };
    }
    return scoreVersion(a, i.version, s, typeof i.note === 'string' ? i.note : '', ex);
  },
  cli: {
    usage: '       artgen score <assetDir> <version> <score> [--note "..."] [--reviewer name] [--blind] [--model m] [--effort e] [--tokens-in n] [--tokens-out n] [--agent-tokens-in n] [--ms n]',
    text: (e, i) => `scored ${e.asset} ${e.version} (${e.pass}${e.blind ? ', blind' : ''}, by ${e.reviewer}) ${+i.score}; gate ${e.conformance?.pass ? 'pass' : 'FAIL'}${typeof e.gap === 'number' ? `; ${e.gap} under its own score` : ''}`,
  },
  mcp: {}, python: {},
});

export const variants = defineOp({
  name: 'variants', module: 'art', effect: 'render', summary: 'A sheet of seed variants of a version, with how many are distinct.',
  params: { asset: assetParam(), version: versionParam('the version; default the latest'), n: p.num('how many variants (default 8)'), direction: directionParam(), ledger: ledgerParam() },
  async run(i: Inp, ctx) { const a = assetOf(ctx, i); return variantsSheet(a, versionOf(ctx, a, i), i.n ?? 8); },
  cli: { usage: '       artgen variants <assetDir> [--version v] [--n 8]', text: r => `${r.path}: ${r.distinct} distinct of ${r.hashes.length}` },
  mcp: { exclude: 'a CLI review aid; review covers the pipeline\'s sheets' }, python: {},
});

export const reportOp = defineOp({
  name: 'report', module: 'art', effect: 'write', summary: 'A markdown report on every asset directory under a folder (benchmark runs).',
  params: { dir: p.str('the folder of asset directories', { positional: true, required: true }), out: p.str('write the report here instead of printing it'), title: p.str('the report\'s title') },
  run: (i: Inp) => report(i.dir, { out: i.out, title: i.title }),
  cli: {
    usage: '       artgen report <dir> [--out REPORT.md] [--title "..."]',
    // prints the markdown (never JSON), and only when it is not written to a file
    output: (r, i, io) => { if (!i.out) io.log(r.markdown); },
    exit: r => (r.summaries.every((s: any) => s.met) ? 0 : 1),
  },
  mcp: { exclude: 'writes a report for a folder by path' }, python: {},
});

export const voxel = defineOp({
  name: 'voxel', module: 'art', effect: 'render', summary: 'Export a 3D-mode asset as a .vox and a greedy-meshed .glb.',
  params: { asset: assetParam(), version: versionParam('the version; default the latest'), cell: p.str('the cell, state/facing/frame'), out: p.str('the output folder'), scale: p.num('metres per voxel'), direction: directionParam(), ledger: ledgerParam() },
  run: (i: Inp, ctx) => voxelExport(assetOf(ctx, i), { version: i.version, cell: i.cell, out: i.out, scale: i.scale }),
  cli: { usage: '       artgen voxel <asset> [--version v] [--cell s/f/n] [--out dir] [--scale m]', text: r => `${r.cell}: ${r.voxels} voxels, ${r.materials} materials, ${r.size.join('x')}\n  ${r.vox}\n  ${r.glb}` },
  mcp: { exclude: 'writes model files for the game; run from the CLI' }, python: {},
});

export const anim = defineOp({
  name: 'anim', module: 'art', effect: 'render', summary: 'GIF and APNG previews of an asset\'s animation states.',
  params: { asset: assetParam(), version: versionParam('the version; default the latest'), state: p.str('only this state'), facing: p.str('only this facing'), scale: p.num('preview scale'), out: p.str('the output folder'), direction: directionParam(), ledger: ledgerParam() },
  run: (i: Inp, ctx) => animPreview(assetOf(ctx, i), { version: i.version, state: i.state, facing: i.facing, scale: i.scale, out: i.out }),
  cli: { usage: '       artgen anim <asset> [--version v] [--state s] [--facing f] [--scale n] [--out dir]', text: r => [...r.states.map((s: any) => `${s.state}/${s.facing}: ${s.frames} frames, ${s.ms} ms`), ...r.files.map((f: string) => `  ${f}`)].join('\n') },
  mcp: { exclude: 'writes GIF and APNG previews; MCP returns PNG only' }, python: {},
});

export const texture = defineOp({
  name: 'texture', module: 'art', effect: 'render', summary: 'Render a material recipe under the direction: tile, normal map and a 3×3 repeat preview.',
  description: 'Render a material recipe under the locked direction (or `direction`) into art/sheets/textures: the tile, its normal map and a 3×3 repeat preview, with the seam and repetition metrics. list: the material names.',
  params: {
    material: p.str('the material (see --list)', { positional: true }),
    size: p.str('px, or WxH; default 32', { schema: { description: 'px, or [w, h]; default 32' } }), seed: p.num('the seed'),
    ramps: p.list('string', 'layer ramps, base=stone,…', { schema: { type: 'object', description: 'layer → ramp, e.g. { "base": "stone" }' } }), scale: p.num('preview scale'),
    list: p.bool('print the material names'), out: p.str('the output folder (default art/sheets/textures)', { mcp: false }), direction: directionParam(),
  },
  run(i: Inp, ctx) {
    const mcp = ctx.surface === 'mcp';
    if (i.list === true || (mcp && !i.material)) return { list: MATERIALS };
    if (!i.material) throw new Error('texture: name a material (artgen texture --list)');
    const { p: pr, dir } = mcp ? { p: ctx.project(), dir: typeof i.direction === 'string' ? resolveDirection(ctx.direction!(i.direction)!) : requireLocked(ctx.project()) } : toolDirection('texture', ctx.findProject(), i.direction);
    const size = sizeOf(i.size), ramps = Array.isArray(i.ramps) ? (i.ramps as string[]).reduce((m, x) => { const [k, v] = x.split('='); m[k] = v; return m; }, {} as Record<string, string>) : i.ramps as Record<string, string> | undefined;
    const out = mcp ? join(pr!.art, 'sheets', 'textures') : i.out ?? (pr ? join(pr.art, 'sheets', 'textures') : 'artgen-out');
    return { material: i.material, size, r: textureRun(dir, i.material, { size, seed: typeof i.seed === 'number' ? i.seed : undefined, ramps, scale: typeof i.scale === 'number' ? i.scale : undefined, out }) };
  },
  cli: {
    usage: '       artgen texture <material> [--size 32|WxH] [--seed n] [--ramps base=stone,…] [--scale k] [--out dir] | texture --list',
    text: x => (x.list ? x.list.join('\n') : [`${x.material} ${x.size.join('x')} (ramps ${Object.entries(x.r.ramps).map(([k, v]) => `${k}=${v}`).join(', ')})`, ...x.r.files.map((f: string) => `  ${f}`),
      `seam ${x.r.seam.ratio}× the interior · repetition: ${x.r.issues.length ? x.r.issues.join('; ') : `clear (lowStd ${x.r.repetition.lowStd}, ${x.r.repetition.markBlobs} marks)`}`].join('\n')),
    json: x => x.list ?? x.r,
  },
  mcp: {
    content: (x, _i, ctx) => {
      if (x.list) return [text(x.list)];
      const files = x.r.files.map((f: string) => ctx.rel(f));
      return [text({ ...x.r, files }), projectPng(ctx, files[2]), projectPng(ctx, files[1])];
    },
  }, python: {},
});

export const fx = defineOp({
  name: 'fx', module: 'art', effect: 'render', summary: 'Quick look at a particle preset: a frame strip, an onion-skin sheet and GIF/APNG files.',
  description: 'Quick look at a particle preset under the locked direction (or `direction`) in art/sheets/fx: the frame strip and an onion-skin sheet (plus GIF/APNG files), with the solid-fill numbers. list: the preset names.',
  params: {
    preset: p.str('the preset (see --list)', { positional: true }), size: p.str('px, or WxH; default 32', { schema: { description: 'px, or [w, h]; default 32' } }), frames: p.num('frames (default 8)'), seed: p.num('the seed'), scale: p.num('preview scale'),
    list: p.bool('print the preset names'), out: p.str('the output folder (default art/sheets/fx)', { mcp: false }), direction: directionParam(),
  },
  run(i: Inp, ctx) {
    const mcp = ctx.surface === 'mcp';
    if (i.list === true || (mcp && !i.preset)) return { list: PRESET_NAMES };
    if (!i.preset) throw new Error('fx: name a preset (artgen fx --list)');
    const { p: pr, dir } = mcp ? { p: ctx.project(), dir: typeof i.direction === 'string' ? resolveDirection(ctx.direction!(i.direction)!) : requireLocked(ctx.project()) } : toolDirection('fx', ctx.findProject(), i.direction);
    const size = sizeOf(i.size), out = mcp ? join(pr!.art, 'sheets', 'fx') : i.out ?? (pr ? join(pr.art, 'sheets', 'fx') : 'artgen-out');
    return { preset: i.preset, size, r: fxRun(dir, i.preset, { size, frames: typeof i.frames === 'number' ? i.frames : 8, seed: typeof i.seed === 'number' ? i.seed : undefined, scale: typeof i.scale === 'number' ? i.scale : undefined, out }) };
  },
  cli: {
    usage: '       artgen fx <preset> [--size 32|WxH] [--frames 8] [--seed n] [--scale n] [--out dir] | fx --list',
    text: x => (x.list ? x.list.join('\n') : [`${x.preset} ${x.size.join('x')} × ${x.r.frames} frames`, ...x.r.files.map((f: string) => `  ${f}`), `interior ${x.r.fill.interior.join(' ')} · brightest ${x.r.fill.brightest.join(' ')}`].join('\n')),
    json: x => x.list ?? x.r,
  },
  mcp: {
    content: (x, _i, ctx) => {
      if (x.list) return [text(x.list)];
      const files = x.r.files.map((f: string) => ctx.rel(f));
      return [text({ ...x.r, files }), projectPng(ctx, files[0]), projectPng(ctx, files[1])];
    },
  }, python: {},
});

export const bench = defineOp({
  name: 'bench', module: 'art', effect: 'render', summary: 'Render the artlab parity benchmark under a direction and check it against the golden hashes.',
  params: {
    direction: p.str('benchmark, alt or a direction file (default benchmark)'), out: p.str('the output folder (default artgen-out)'), stages: p.bool('write each drawing stage as a PNG'),
    ledger: p.str('the ledger file to log to'), update_golden: p.bool('recompute the golden hashes for every bench direction'),
  },
  async run(i: Inp) {
    if (i.update_golden) return { golden: await updateGolden() };
    const results = await writeBench(resolveDirection(i.direction ?? 'benchmark'), i.out ?? 'artgen-out', { stages: i.stages === true, ledger: i.ledger });
    return { pass: results.every(r => r.report.pass) };
  },
  cli: {
    usage: '       artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>] [--update-golden]',
    // the benchmark prints its own table; --update-golden prints the new hashes (never in the other mode)
    output: (r, _i, io) => { if (r.golden) io.log(JSON.stringify(r.golden, null, 2)); },
    exit: r => (r.golden || r.pass ? 0 : 1),
  },
  mcp: { exclude: 'this repo\'s benchmark' }, python: { exclude: 'this repo\'s benchmark' },
});
