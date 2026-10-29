/** The project and art-direction operations (`artgen init`, `direction …`, `palette …`, `new`, `finish`). Implementations moved here from `cli.ts` and the MCP server. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPalette, generateRamp, Grid, MIX_PARTS, rampsFromColors, parseGpl, parseHexPalette, validateDirection, type Interview, type MixPart } from 'artgen-core';
import { readGrid, writeGrid } from '../node.ts';
import { initProject, readJson, writeJson } from '../project.ts';
import { newAsset } from '../templates.ts';
import { candidateNames, loadCandidate, lockedDirection, lock, readInterview, show, writeAnchors, writeCandidates, writeDraft, writeMix, writeTile } from '../w1.ts';
import { writeNextFinish } from '../w2.ts';
import { assetParam, BY_PATH, directionParam, ledgerParam, projectPng, sizeKey, text, W1, type Inp } from './art-shared.ts';
import { defineOp, p } from './registry.ts';

/** Colours from a `.hex`/`.gpl` file, a PNG (median cut) or a comma list of hexes. */
function readColors(src: string, n = 16): string[] {
  if (/^#?[0-9a-f]{6}(,#?[0-9a-f]{6})*$/i.test(src)) return src.split(',').map(c => '#' + c.replace('#', '').toLowerCase());
  if (!existsSync(src)) throw new Error(`${src}: not found`);
  if (src.endsWith('.png')) return extractPalette(readGrid(src), n).colors;
  const t = readFileSync(src, 'utf8');
  return src.endsWith('.gpl') ? parseGpl(t) : parseHexPalette(t);
}

export const init = defineOp({
  name: 'init', module: 'art', effect: 'write', summary: 'Scaffold art/ in a game repo: direction, briefs, ledger and config.',
  params: {},
  run: (_i: Inp, ctx) => { const root = ctx.root ?? process.cwd(), r = initProject(root); return { root, created: r.created }; },
  cli: {
    usage: '       artgen init                                     scaffold art/ (direction, briefs, ledger, config)',
    text: r => (r.created.length ? `artgen project in ${r.root}/art\n  ${r.created.map((f: string) => f.slice(r.root.length + 1)).join('\n  ')}` : `artgen project in ${r.root}/art (already initialised)`),
  },
  mcp: { exclude: 'the server starts inside a project: run artgen init first' }, python: {},
});

export const candidates = defineOp({
  name: 'direction.candidates', module: 'art', effect: 'write', summary: 'Write the art-direction candidates for a game pitch, with probe assets to judge them by.',
  params: {
    pitch: p.str('the game in one paragraph (or --from an interview file)'), view: p.str('topdown or iso'), mood: p.list('string', 'mood words, a,b'), scale: p.str('small, medium or large'),
    directions: p.num('facings per character (4 or 8)'), id: p.str('the direction id'), colors: p.str('the palette: a .hex or .gpl file, a PNG, or #hex,#hex,…'), background: p.str('the background colour'), from: p.str('an interview file (default art/interview.json)'),
  },
  run(i: Inp, ctx) {
    const pr = ctx.project(), base: Partial<Interview> = i.from ? readInterview(i.from) : existsSync(join(pr.art, 'interview.json')) ? readJson<Interview>(join(pr.art, 'interview.json')) : {};
    const iv: Interview = {
      ...base, pitch: i.pitch ?? base.pitch ?? '', ...(i.view && { view: i.view as Interview['view'] }),
      ...(i.mood && { mood: i.mood }), ...(i.scale && { scale: i.scale as Interview['scale'] }),
      ...(i.directions !== undefined && { directions: i.directions as Interview['directions'] }), ...(i.id && { id: i.id }),
      ...(i.colors && { colors: readColors(i.colors) }), ...(i.background && { background: i.background }),
    };
    if (!iv.pitch) throw new Error('direction candidates: --pitch "<one-paragraph game pitch>" (or --from interview.json) is required');
    return writeCandidates(pr, iv);
  },
  cli: {
    usage: ['       artgen direction candidates --pitch "..." [--view topdown|iso] [--mood a,b] [--scale small|medium|large] [--directions 8] [--colors src] [--from interview.json]'],
    text: r => [`interview ${r.interview}`, ...r.candidates.map((c: any) => `${c.name.toUpperCase()} ${c.file}\n    ${c.summary.join('\n    ')}`), ...(r.probes.length ? [`probes:\n  ${r.probes.join('\n  ')}`] : []), ...r.fallbacks.map((f: string) => `note: ${f}`), 'next: artgen direction tile'].join('\n'),
  },
  mcp: { exclude: W1 }, python: {},
});

/** The direction operation shows: the locked direction and the candidates, or one candidate. */
export const directionShow = defineOp({
  name: 'direction.show', module: 'art', effect: 'read', summary: 'Show the locked direction, the candidates, the style tiles and the probes (or one candidate with --candidate).',
  description: 'The locked art direction (direction.json) and the candidate names; call before writing any asset so colours, sizes, line and shading come from tokens.',
  params: { candidate: p.str('return this candidate instead of the locked direction') },
  run(i: Inp, ctx): any {
    const pr = ctx.project();
    if (typeof i.candidate === 'string') return { candidate: loadCandidate(pr, i.candidate) };
    return ctx.surface === 'mcp' ? { get: { locked: lockedDirection(pr), candidates: candidateNames(pr) } } : { show: show(pr) };
  },
  cli: {
    usage: '       artgen direction show [--candidate name]       the locked direction, the candidates, the style tiles, the probes',
    text: r => {
      if (r.candidate) return JSON.stringify(r.candidate, null, 2);
      const s = r.show;
      return [
        s.locked ? `locked: ${s.locked.id} v${s.locked.version} (${s.locked.camera.view}, ${s.locked.anchors.length} anchors)` : 'locked: none yet',
        ...s.candidates.map((c: any) => `candidate ${c.name}: ${c.id} [${c.status}]\n    ${c.summary.join('\n    ')}`),
        ...(s.tiles.length ? [`style tiles: ${s.tiles.join(', ')}`] : []),
        ...Object.entries(s.probes).map(([k, v]) => `probe ${k}: ${v || '(empty)'}`),
      ].join('\n');
    },
    json: r => (r.candidate ?? { locked: r.show.locked && { id: r.show.locked.id, version: r.show.locked.version, anchors: r.show.locked.anchors }, candidates: r.show.candidates, tiles: r.show.tiles, probes: r.show.probes }),
  },
  mcp: { name: 'direction_get', content: r => [text(r.candidate ?? r.get)] }, python: {},
});

export const tile = defineOp({
  name: 'direction.tile', module: 'art', effect: 'render', summary: 'Render the probe set under each candidate into one style tile sheet.',
  description: 'Render the probe set (character, prop, tile, effect) under each candidate into one style tile sheet (art/candidates/style-tile-rN.png) and return it.',
  params: { candidates: p.str('candidate names; default all', { positional: 'rest', schema: { type: 'array', items: { type: 'string' } } }) },
  run: (i: Inp, ctx) => writeTile(ctx.project(), Array.isArray(i.candidates) ? (i.candidates as string[]) : undefined),
  cli: {
    usage: '       artgen direction tile [names...]                style tile: the probe set under each candidate, one sheet',
    text: r => [`style tile ${r.path} (round ${r.round}, ~${r.tokens} image tokens)`, ...r.columns.map((c: any) => `  ${c.name} ${c.id}: ${Object.entries(c.gates).map(([k, v]) => `${k} ${v ? 'ok' : 'FAIL'}`).join(', ')}${c.failing.length ? `\n    ${c.failing.join('\n    ')}` : ''}`), `  distinct designs: ${r.distinct.pairs}/${r.columns.length}, min palette luma gap ${r.distinct.minLumaGap}`].join('\n'),
    exit: r => (r.columns.every((c: any) => Object.values(c.gates).every(Boolean)) ? 0 : 1),
  },
  mcp: { content: (r, _i, ctx) => [text({ sheet: r.path, round: r.round, imageTokens: r.tokens, columns: r.columns, distinct: r.distinct }), projectPng(ctx, r.path)] }, python: {},
});

export const mix = defineOp({
  name: 'direction.mix', module: 'art', effect: 'write', summary: 'Mix a new candidate from parts of existing ones.',
  params: {
    base: p.str('the candidate to start from', { positional: true, required: true }),
    ...Object.fromEntries(MIX_PARTS.map(part => [part, p.str(`take the ${part} from this candidate`)])),
    name: p.str('the new candidate\'s name'),
  },
  run(i: Inp, ctx) {
    const take: Partial<Record<MixPart, string>> = {};
    for (const part of MIX_PARTS) if (i[part]) take[part] = i[part];
    return writeMix(ctx.project(), i.base, take, i.name);
  },
  cli: {
    usage: '       artgen direction mix <base> --palette a --line b [--shading c] [--scale c] [--name m]',
    text: r => `${r.name} ${r.file}: ${r.dir.theme.notes}\nnext: artgen direction tile ${r.name}`, json: r => ({ name: r.name, file: r.file }),
  },
  mcp: { exclude: W1 }, python: {},
});

export const lockOp = defineOp({
  name: 'direction.lock', module: 'art', effect: 'write', summary: 'Lock a candidate as the project\'s art direction: save the anchors and art/direction.png.',
  params: { candidate: p.str('the candidate to lock', { positional: true, required: true }), note: p.str('why this one'), id: p.str('the locked direction\'s id') },
  run: (i: Inp, ctx) => lock(ctx.project(), i.candidate, { id: i.id, note: i.note }),
  cli: {
    usage: '       artgen direction lock <candidate> [--note "..."] [--id name]   lock + anchors + art/direction.png',
    text: r => [`locked ${r.direction.id} v${r.direction.version} -> ${r.file}`, `anchors: ${r.anchors.join(', ')}`, `style sheet: ${r.sheet}`, ...Object.entries(r.gates).filter(([, ok]) => !ok).map(([k]) => `  gate FAIL on probe ${k}`)].join('\n'),
    json: r => ({ direction: { id: r.direction.id, version: r.direction.version }, file: r.file, anchors: r.anchors, sheet: r.sheet, versions: r.versions, gates: r.gates }),
  },
  mcp: { exclude: 'locking is the user\'s choice; the art-direction skill runs it' }, python: {},
});

export const anchors = defineOp({
  name: 'direction.anchors', module: 'art', effect: 'write', summary: 'Re-save the anchors from the probes (after their full pipeline).',
  params: {},
  run: (_i: Inp, ctx) => writeAnchors(ctx.project()),
  cli: {
    usage: '       artgen direction anchors                        re-save anchors from the probes (after their full pipeline)',
    text: r => `anchors: ${r.anchors.join(', ')} (${Object.entries(r.versions).map(([k, v]) => `${k} ${v}`).join(', ')})\nstyle sheet: ${r.sheet}`,
  },
  mcp: { exclude: W1 }, python: {},
});

export const draft = defineOp({
  name: 'direction.new', module: 'art', effect: 'write', summary: 'Start a draft direction from the locked one (a version change).',
  params: { from: p.str('the candidate to start from (default: the locked direction)'), name: p.str('the draft\'s name (default next)') },
  run: (i: Inp, ctx) => writeDraft(ctx.project(), i.from, i.name),
  cli: {
    usage: '       artgen direction new [--from <candidate>]       start a draft from the locked direction (version change)',
    text: r => `draft ${r.file} — edit it, then: artgen direction tile ${r.name} && artgen direction lock ${r.name}`,
  },
  mcp: { exclude: W1 }, python: {},
});

export const validate = defineOp({
  name: 'direction.validate', module: 'art', effect: 'read', summary: 'Check a direction file against the direction format.',
  params: { file: p.str('the direction file', { positional: true, required: true }) },
  run: (i: Inp) => validateDirection(JSON.parse(readFileSync(i.file, 'utf8'))),
  cli: {
    usage: '       artgen direction validate <file>',
    // prints the same lines with --json
    output: (r, _i, io) => io.log(r.ok ? `ok: ${r.direction!.id} v${r.direction!.version}` : r.errors.join('\n')),
    exit: r => (r.ok ? 0 : 1),
  },
  mcp: { exclude: 'reads a file by path; direction_get returns the parsed direction' }, python: {},
});

const swatch = (colors: string[], file: string) => {
  const g = new Grid(colors.length * 8, 8);
  colors.forEach((c, i) => g.fill(i * 8, 0, 8, 8, c));
  writeGrid(file, g);
};
/** `palette import` and `palette extract` read the colours of a file; they differ only in the name. */
const paletteFile = (name: 'import' | 'extract', what: string) => defineOp({
  name: `palette.${name}`, module: 'art', effect: 'write', summary: `${what} and print its colours and ramps.`,
  params: {
    file: p.str(name === 'import' ? 'a .hex or .gpl palette file' : 'an image (PNG)', { positional: true, required: true }), n: p.num('how many colours to extract (default 16)'),
    interview: p.bool('add the colours to art/interview.json (candidate A builds its ramps from them)'), swatch: p.str('write a swatch PNG here'),
  },
  run(i: Inp, ctx) {
    const colors = readColors(i.file, i.n ?? 16), ramps = rampsFromColors(colors);
    if (i.interview) {
      const f = join(ctx.project().art, 'interview.json'), iv = existsSync(f) ? readJson<Interview>(f) : ({ pitch: '' } as Interview);
      writeJson(f, { ...iv, colors });
    }
    if (i.swatch) swatch(colors, i.swatch);
    return { colors, ramps, interview: i.interview === true };
  },
  cli: {
    usage: name === 'import' ? '       artgen palette import <file.hex|.gpl> | extract <image.png> [--n 16] [--interview] [--swatch out.png]' : [],
    text: r => `${r.colors.length} colours: ${r.colors.join(' ')}\n${Object.entries(r.ramps).map(([k, x]) => `  ${k}: ${(x as string[]).join(' ')}`).join('\n')}${r.interview ? '\nadded to art/interview.json (candidate A builds its ramps from them)' : ''}`,
    json: r => ({ colors: r.colors, ramps: r.ramps }),
  },
  mcp: { exclude: BY_PATH }, python: {},
});
export const paletteImport = paletteFile('import', 'Read a palette file');
export const paletteExtract = paletteFile('extract', 'Extract the dominant colours of an image');

export const ramp = defineOp({
  name: 'palette.ramp', module: 'art', effect: 'read', summary: 'A colour ramp from one colour.',
  params: { hex: p.str('the base colour, #rrggbb', { positional: true, required: true }), steps: p.num('colours in the ramp (default 4)'), hue_shift: p.num('degrees of hue shift per step (default 12)'), contrast: p.num('light-to-dark contrast (default 0.45)') },
  run: (i: Inp) => ({ ramp: generateRamp(i.hex, { steps: i.steps ?? 4, hueShift: i.hue_shift ?? 12, contrast: i.contrast ?? 0.45 }) }),
  cli: { usage: '       artgen palette ramp <#hex> [--steps 4] [--hue-shift 12] [--contrast 0.45]', text: r => r.ramp.join(' ') },
  mcp: { exclude: W1 }, python: {},
});

export const newOp = defineOp({
  name: 'new', module: 'art', effect: 'write', summary: 'Scaffold an asset directory (base.v1.js and its brief) from the template for its kind and view.',
  params: {
    id: p.str('the asset id', { positional: true, required: true }),
    kind: p.str('character, creature, prop, tile, effect, …', { required: 'new: --kind is required (character, creature, prop, tile, effect, …)' }),
    view: p.str('topdown or iso (default: the locked direction\'s view)'), size: p.str('a size key or WxH'), states: p.list('string', 'animation states, a,b'),
    directions: p.num('facings (4 or 8)'), notes: p.str('notes for the brief'), dir: p.str('the asset directory (default art/assets/<kind>/<id>)'),
  },
  run(i: Inp, ctx) {
    const pr = ctx.findProject(), view = i.view ?? (pr && (() => { try { return readJson<{ camera?: { view?: string } }>(join(pr.art, 'direction.json')).camera?.view; } catch { return undefined; } })()) ?? 'topdown';
    const path = i.dir ?? (pr ? join(pr.art, 'assets', i.kind, i.id) : i.id);
    return { id: i.id, path, ...newAsset(path, { id: i.id, kind: i.kind, view, size: sizeKey(i.size), states: i.states, directions: i.directions, notes: i.notes }) };
  },
  cli: {
    usage: '       artgen new <id> --kind <kind> [--view v] [--size key|WxH] [--states a,b] [--directions n] [--notes "..."] [--dir path]',
    text: r => `${r.id}: ${r.files.join(', ')} (template ${r.template.view}/${r.template.kind}${r.template.fallback ? ', fallback' : ''})\nnext: edit base.v1.js for the brief, then artgen review ${r.path}`,
    json: r => ({ files: r.files, template: r.template }),
  },
  mcp: { exclude: 'make scaffolds assets from briefs' }, python: {},
});

export const finish = defineOp({
  name: 'finish', module: 'art', effect: 'write', summary: 'Write the next finish.vM.js from the template, bound to the best scored base.',
  description: 'Write the next finish.vM.js for an asset from the finish template, bound to the best scored base (or `base`). Edit it with the finishing ops, then review it.',
  params: { asset: assetParam('the asset: a brief id or an asset directory'), base: p.str('base.vN to bind; default the pass machine\'s choice'), direction: directionParam(), ledger: ledgerParam() },
  run: (i: Inp, ctx) => writeNextFinish(ctx.assetPath!(i.asset), { base: typeof i.base === 'string' ? i.base : undefined, direction: ctx.direction!(i.direction), ledger: i.ledger }),
  cli: { usage: '       artgen finish <assetDir> [--base base.vN]       write the next finish.vM.js from the template', text: r => `${r.file} (bound to ${r.base})` },
  mcp: { content: (r, _i, ctx) => [text({ file: ctx.rel(r.file), base: r.base })] }, python: {},
});

