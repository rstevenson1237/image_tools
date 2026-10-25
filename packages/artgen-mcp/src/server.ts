/**
 * artgen MCP server (SPEC §14): JSON-RPC 2.0 over stdio, newline-delimited, no SDK dependency so it bundles into
 * one file for the committed install. P2 served the W1 and pipeline tools, P3 added `status`; P7 completes the set:
 * `finish`, `make` (with the parallel round), `feedback`, `approve`, `gallery`, `texture`, `fx`, `export`, `restyle`
 * and `analytics`; 0.10.0 adds `brief_lint`. Image results are returned as MCP image content (base64 PNG).
 *
 * Terrain maps (`map_*`) work on `art/maps/<id>/map.json`, dungeon maps (`dungeon_*`) on `art/dungeons/<id>/dungeon.json`,
 * settlement maps (`settlement_*`) on `art/settlements/<id>/settlement.json`; a map, dungeon or settlement id is a name,
 * never a path.
 *
 * Paths are sandboxed: every asset argument must resolve inside the project's `art/` folder (a brief id resolves
 * through art/briefs.yaml), and the quick-look tools (`texture`, `fx`) write only under art/sheets/. `export` writes
 * where art/artgen.config.json says (the game's pack and runtime folders), as the CLI does.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { dungeon, encodePNG, map, MATERIALS, parseDirection, PRESET_NAMES, settlement, type Grid, type Size } from 'artgen-core';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import {
  approve, briefWarnings, candidateNames, cornerPoint, corridorEnd, createDungeon, describeDungeon, gridMode, listDungeons, readDungeon, renderDungeonFiles, updateDungeon, createMap, describeMap, exportPacks, listMaps, readMap, renderMapFiles, updateMap, feedback, findProject, fxRun, gallery, loadCandidate, lockedDirection, make, openAsset, passState, projectAnalytics,
  readBriefs, renderVersion, requireLocked, restyle, reviewVersion, projectStatus, scoreVersion, textureRun, VERSION, versionsIn, writeNextFinish, writeTile, type Project, checkDungeonFile, warningLines,
  checkSettlementFile, createSettlement, describeSettlement, listSettlements, mapForSettlement, readSettlement, readSettlementUnderlay, renderSettlementFiles, settlementWarningLines, updateSettlement,
} from 'artgen-cli';

export const SERVER = { name: 'artgen', version: VERSION === 'dev' ? '0.0.0-dev' : VERSION };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Json = Record<string, unknown>;
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };
interface ToolDef { name: string; description: string; inputSchema: Json; run(args: Json, p: Project): Promise<Content[]> }

const text = (v: unknown): Content => ({ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) });
const image = (g: Grid): Content => ({ type: 'image', data: Buffer.from(encodePNG(g)).toString('base64'), mimeType: 'image/png' });
const pngFile = (f: string): Content => ({ type: 'image', data: readFileSync(f).toString('base64'), mimeType: 'image/png' });
const str = { type: 'string' } as const, num = { type: 'number' } as const, bool = { type: 'boolean' } as const, strs = { type: 'array', items: str } as const;
/** A file a core function reported (relative to the process's cwd) as a path relative to the project root. */
const projRel = (p: Project, f: string) => relative(p.root, resolve(f)).split('\\').join('/');
const sizeArg = (v: unknown, d = 32): Size => (Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : [Number(v ?? d), Number(v ?? d)]);
const obj = (properties: Json, required: string[] = []) => ({ type: 'object', properties, required });

/**
 * Resolve an asset argument inside `art/`: a brief id, a directory relative to the project root or to `art/`, or a
 * bare asset name under `art/assets/[<kind>/]`. The first candidate that exists wins; nothing outside `art/` is used.
 */
export function assetPath(p: Project, arg: unknown): string {
  if (typeof arg !== 'string' || !arg) throw new Error('asset: required (e.g. "art/probes/character", "assets/character/goblin" or a brief id)');
  const bare = /^[\w-]+$/.test(arg), brief = bare ? (() => { try { return readBriefs(p).find(b => b.id === arg); } catch { return undefined; } })() : undefined;
  const kinds = bare && existsSync(join(p.art, 'assets')) ? readdirSync(join(p.art, 'assets'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(p.art, 'assets', d.name, arg)) : [];
  const cands = [...(brief ? [resolve(p.art, 'assets', brief.kind, brief.id)] : []), ...(isAbsolute(arg) ? [arg] : [resolve(p.root, arg), resolve(p.art, arg)]), ...(bare ? [join(p.art, 'assets', arg)] : []), ...kinds];
  const inside = cands.filter(c => { const r = relative(p.art, c); return r && !r.startsWith('..') && !isAbsolute(r); });
  if (!inside.length) throw new Error(`asset path ${arg} is outside art/ (sandbox)`);
  return inside.find(c => existsSync(c)) ?? inside[0];
}

/** `direction`: a bench direction name (`benchmark`, `alt`) or a file relative to the project root. */
const dirOpt = (p: Project, args: Json) => (typeof args.direction !== 'string' ? undefined : BENCH_DIRECTIONS[args.direction] ? args.direction : join(p.root, args.direction));
const asset = (p: Project, args: Json) => openAsset(assetPath(p, args.asset), { direction: dirOpt(p, args) });
const ids = (a: Json) => (Array.isArray(a.ids) ? (a.ids as string[]) : undefined);

export const TOOLS: ToolDef[] = [
  {
    name: 'direction_get', description: 'The locked art direction (direction.json) and the candidate names; call before writing any asset so colours, sizes, line and shading come from tokens.',
    inputSchema: obj({ candidate: { ...str, description: 'return this candidate instead of the locked direction' } }),
    async run(a, p) {
      if (typeof a.candidate === 'string') return [text(loadCandidate(p, a.candidate))];
      return [text({ locked: lockedDirection(p), candidates: candidateNames(p) })];
    },
  },
  {
    name: 'direction_tile', description: 'Render the probe set (character, prop, tile, effect) under each candidate into one style tile sheet (art/candidates/style-tile-rN.png) and return it.',
    inputSchema: obj({ candidates: { type: 'array', items: str, description: 'candidate names; default all' } }),
    async run(a, p) {
      const r = await writeTile(p, Array.isArray(a.candidates) ? (a.candidates as string[]) : undefined);
      return [text({ sheet: r.path, round: r.round, imageTokens: r.tokens, columns: r.columns, distinct: r.distinct }), pngFile(join(p.root, r.path))];
    },
  },
  {
    name: 'pass_status', description: 'Pipeline state of an asset directory: versions, scores, gate, best base, and the next step (write-base, review, write-finish, blind-review, ready).',
    inputSchema: obj({ asset: { ...str, description: 'asset directory, e.g. art/probes/character' }, direction: str }, ['asset']),
    async run(a, p) { return [text(await passState(asset(p, a)))]; },
  },
  {
    name: 'render', description: 'Render one version of an asset (all states × facings × frames side by side) and run the conformance gate.',
    inputSchema: obj({ asset: str, version: { ...str, description: 'base.vN or finish.vM; default the latest' }, variant: num, scale: num, direction: str }, ['asset']),
    async run(a, p) {
      const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === 'string' ? a.version : vs[vs.length - 1];
      if (!version) throw new Error(`${a.asset}: no versions yet`);
      const r = await renderVersion(ad, version, { variant: typeof a.variant === 'number' ? a.variant : 0 });
      return [text({ version, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics, stale: r.stale }), image(r.strip.scale(typeof a.scale === 'number' ? a.scale : 4))];
    },
  },
  {
    name: 'review', description: 'Build the review sheet for a version (best so far, v(n-1), v(n), checker + scaled + in context + silhouette), log it to the ledger and return it. blind: the version alone (no earlier versions, scores or notes) for a fresh reviewer\'s blind re-score of a version. detail: low = the first facing at 3x beside the previous version only (about half the image tokens; the default for r1), full = every facing and the best so far. scene: add the sprite at game zoom on the background, a floor and beside a wall (contrast check).',
    inputSchema: obj({ asset: str, version: str, blind: { type: 'boolean' }, detail: { type: 'string', enum: ['low', 'full'] }, scene: bool, direction: str }, ['asset']),
    async run(a, p) {
      const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === 'string' ? a.version : vs[vs.length - 1];
      const r = await reviewVersion(ad, version, { blind: a.blind === true, ...((a.detail === 'low' || a.detail === 'full') && { detail: a.detail }), scene: a.scene === true });
      return [text({ sheet: relative(p.root, r.path), imageTokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks }), pngFile(r.path)];
    },
  },
  {
    name: 'conformance', description: 'Conformance gate (palette, scale, aa, line, light, dither, source lint, scene lint, anchors) for a version.',
    inputSchema: obj({ asset: str, version: str, direction: str }, ['asset']),
    async run(a, p) {
      const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === 'string' ? a.version : vs[vs.length - 1];
      return [text((await renderVersion(ad, version)).report)];
    },
  },
  {
    name: 'score', description: 'Record a 0-10 visual score for a reviewed version (the art-reviewer verdict) with gate results and token estimates. reviewer: who scored (the subagent name; omitted = self). blind: a blind re-score from the blind sheet (needs a reviewer). agent_tokens_in: the total input tokens the maker or reviewer agent read for this pass, when known (analytics counts what the orchestration costs).',
    inputSchema: obj({ asset: str, version: str, score: num, note: str, reviewer: str, blind: { type: 'boolean' }, agent_tokens_in: num, direction: str }, ['asset', 'version', 'score']),
    async run(a, p) {
      const s = a.score as number, reviewer = typeof a.reviewer === 'string' && a.reviewer ? a.reviewer : 'self';
      if (!(s >= 0 && s <= 10)) throw new Error('score must be 0-10');
      if (a.blind === true && reviewer === 'self') throw new Error('a blind re-score needs reviewer: it comes from a fresh reviewer that saw only the blind sheet');
      return [text(await scoreVersion(asset(p, a), a.version as string, s, typeof a.note === 'string' ? a.note : '', { reviewer, ...(a.blind === true && { blind: true }), ...(typeof a.agent_tokens_in === 'number' && a.agent_tokens_in >= 0 && { measured: { agentIn: a.agent_tokens_in } }) }))];
    },
  },
  {
    name: 'finish', description: 'Write the next finish.vM.js for an asset from the finish template, bound to the best scored base (or `base`). Edit it with the finishing ops, then review it.',
    inputSchema: obj({ asset: str, base: { ...str, description: 'base.vN to bind; default the pass machine\'s choice' }, direction: str }, ['asset']),
    async run(a, p) {
      const r = await writeNextFinish(assetPath(p, a.asset), { base: typeof a.base === 'string' ? a.base : undefined, direction: dirOpt(p, a) });
      return [text({ file: projRel(p, r.file), base: r.base })];
    },
  },
  {
    name: 'make', description: 'One tick of the autonomous production run: scaffold missing assets from templates, mark finished pipelines final, and name the next step. parallel: n also returns a round of up to n maker packets (one subagent per asset; each writes only its own files, then runs render + review; resume: true = a version written but never reviewed, complete and review it) and the main agent\'s review steps. wave: finish n assets before starting more (survives usage-limit pauses: call make again, the ledger is the state). roster: assets held at v1 for the v1 roster review (artgen roster --stage v1); finalRoster: finals with no roster review yet.',
    inputSchema: obj({ ids: { ...strs, description: 'brief ids; default all' }, parallel: { ...num, description: 'maker subagents per round' }, wave: { ...num, description: 'assets in flight at once; the rest wait until those reach final' } }),
    async run(a, p) { return [text(await make(p, ids(a), { parallel: typeof a.parallel === 'number' && a.parallel >= 1 ? a.parallel : undefined, wave: typeof a.wave === 'number' && a.wave >= 1 ? a.wave : undefined }))]; },
  },
  {
    name: 'brief_lint', description: 'Warnings for briefs before any drawing starts: materials a brief names (wood, steel, lava, rubble…) that its kind\'s ramps leave out, and briefs with no template for their view.',
    inputSchema: obj({ ids: { ...strs, description: 'brief ids; default all' } }),
    async run(a, p) {
      const dir = requireLocked(p), want = ids(a);
      const rows = readBriefs(p).filter(b => !want?.length || want.includes(b.id)).map(b => ({ id: b.id, warnings: briefWarnings(b, dir) })).filter(r => r.warnings.length);
      return [text(rows.length ? rows : 'no brief warnings')];
    },
  },
  {
    name: 'status', description: 'Production status of every brief in art/briefs.yaml (brief, in-pipeline, final, approved, exported, revision, stale), with the final version, score, open issues and the next pipeline step.',
    inputSchema: obj({ ids: { type: 'array', items: str, description: 'brief ids; default all' } }),
    async run(a, p) { return [text(await projectStatus(p, ids(a)))]; },
  },
  {
    name: 'gallery', description: 'Sheet(s) of finished assets for the user (final render, score, blind score, open issues), logged to the ledger and returned.',
    inputSchema: obj({ ids: strs }),
    async run(a, p) {
      const r = await gallery(p, { ids: ids(a) });
      return [text(r.sheets.length ? r : 'no finished assets waiting for review'), ...r.sheets.map(f => pngFile(join(p.root, f)))];
    },
  },
  {
    name: 'feedback', description: 'Record feedback on a finished asset and open a revision. by: user (default) = the user\'s words, a U-stage iteration; by: roster = the agent acting on a roster note — recorded as the agent\'s (an extra autonomous revision within review.rosterRevisions), never as the user\'s. route base = form, proportion, colour (new base); finish = pixel fixes (finish revision). region x,y,w,h in sprite pixels of cell state/facing/frame.',
    inputSchema: obj({ id: str, route: { type: 'string', enum: ['base', 'finish'] }, note: str, by: { type: 'string', enum: ['user', 'roster', 'agent'] }, region: { type: 'array', items: num }, cell: str, force: bool }, ['id', 'route', 'note']),
    async run(a, p) {
      if (a.route !== 'base' && a.route !== 'finish') throw new Error('route: base | finish');
      if (typeof a.note !== 'string' || !a.note) throw new Error('note: the user\'s words (or the roster note) are required');
      const agent = a.by === 'roster' || a.by === 'agent';
      return [text(await feedback(p, a.id as string, { route: a.route, note: a.note, region: Array.isArray(a.region) ? (a.region as number[]) : undefined, cell: typeof a.cell === 'string' ? a.cell : undefined, force: a.force === true, ...(agent && { by: 'agent' as const, source: a.by as string }) }))];
    },
  },
  {
    name: 'approve', description: 'Record the USER\'s approval of a final asset (approval is the user\'s call, never the agent\'s). Call only after the user said so in this conversation; user_approved must be true and note should quote them. Needs a passing gate and a review sheet of the final (R6).',
    inputSchema: obj({ id: str, note: str, user_approved: { ...bool, description: 'true only when the user explicitly approved this asset' } }, ['id', 'user_approved']),
    async run(a, p) {
      if (a.user_approved !== true) throw new Error('approve: only the user approves assets — show them the gallery and ask; pass user_approved: true once they say so');
      return [text(await approve(p, a.id as string, typeof a.note === 'string' ? a.note : ''))];
    },
  },
  {
    name: 'texture', description: 'Render a material recipe under the locked direction (or `direction`) into art/sheets/textures: the tile, its normal map and a 3×3 repeat preview, with the seam and repetition metrics. list: the material names.',
    inputSchema: obj({ material: str, size: { description: 'px, or [w, h]; default 32' }, seed: num, ramps: { type: 'object', description: 'layer → ramp, e.g. { "base": "stone" }' }, scale: num, list: bool, direction: str }),
    async run(a, p) {
      if (a.list === true || !a.material) return [text(MATERIALS)];
      const dir = typeof a.direction === 'string' ? openDirection(p, a) : requireLocked(p), out = join(p.art, 'sheets', 'textures');
      const r = textureRun(dir, a.material as string, { size: sizeArg(a.size), seed: typeof a.seed === 'number' ? a.seed : undefined, ramps: a.ramps as Record<string, string> | undefined, scale: typeof a.scale === 'number' ? a.scale : undefined, out });
      const files = r.files.map(f => projRel(p, f));
      return [text({ ...r, files }), pngFile(join(p.root, files[2])), pngFile(join(p.root, files[1]))];
    },
  },
  {
    name: 'fx', description: 'Quick look at a particle preset under the locked direction (or `direction`) in art/sheets/fx: the frame strip and an onion-skin sheet (plus GIF/APNG files), with the solid-fill numbers. list: the preset names.',
    inputSchema: obj({ preset: str, size: { description: 'px, or [w, h]; default 32' }, frames: num, seed: num, scale: num, list: bool, direction: str }),
    async run(a, p) {
      if (a.list === true || !a.preset) return [text(PRESET_NAMES)];
      const dir = typeof a.direction === 'string' ? openDirection(p, a) : requireLocked(p), out = join(p.art, 'sheets', 'fx');
      const r = fxRun(dir, a.preset as string, { size: sizeArg(a.size), frames: typeof a.frames === 'number' ? a.frames : 8, seed: typeof a.seed === 'number' ? a.seed : undefined, scale: typeof a.scale === 'number' ? a.scale : undefined, out });
      const files = r.files.map(f => projRel(p, f));
      return [text({ ...r, files }), pngFile(join(p.root, files[0])), pngFile(join(p.root, files[1]))];
    },
  },
  {
    name: 'export', description: 'Export approved assets into the configured packs (atlases, pack.json, Aseprite JSON, typed assets.ts); include_drafts adds finals; runtime vendors the artgen runtime + adapters. Animation contracts are enforced unless break_contract names the asset (or *).',
    inputSchema: obj({ packs: strs, include_drafts: bool, runtime: bool, force: bool, break_contract: strs }),
    async run(a, p) {
      return [text(await exportPacks(p, { packs: a.packs as string[] | undefined, includeDrafts: a.include_drafts === true, generator: `artgen ${VERSION} (mcp)`, runtime: a.runtime === true, force: a.force === true, breakContract: a.break_contract as string[] | undefined }))];
    },
  },
  {
    name: 'restyle', description: 'Re-render every finished asset under the newly locked direction: before | after | token-diff sheet (returned), per-asset change numbers; changed assets go back to final for re-approval.',
    inputSchema: obj({ from: { ...num, description: 'direction version to compare from; default the previous one' } }),
    async run(a, p) {
      const r = await restyle(p, { from: typeof a.from === 'number' ? a.from : undefined });
      return [text(r), pngFile(join(p.root, r.sheet))];
    },
  },
  {
    name: 'analytics', description: 'Pipeline analytics for this project (per-pass gains, cost per asset, regressions, user revision rate, review independence, budget suggestions) as markdown.',
    inputSchema: obj({}),
    async run(_a, p) { return [text(projectAnalytics(p).markdown)]; },
  },
  {
    name: 'map_list', description: 'Terrain maps (TTRPG) in art/maps, plus the terrains, symbol kinds and label kinds the map tools accept.',
    inputSchema: obj({}),
    async run(_a, p) { return [text({ maps: listMaps(p), terrains: map.TERRAINS, symbols: map.SYMBOL_KINDS, labelKinds: map.LABEL_KINDS, presets: map.PRESETS })]; },
  },
  {
    name: 'map_get', description: 'A terrain map\'s file (art/maps/<id>/map.json) and a readable summary: generator settings, edits, labels and symbols with their indices.',
    inputSchema: obj({ id: str }, ['id']),
    async run(a, p) { const m = readMap(p, a.id as string); return [text(describeMap(m)), text(m)]; },
  },
  {
    name: 'map_new', description: 'Create a terrain map from a preset: regional (hex crawl, 6 mi hexes) or local (battle map, 5 ft squares). The terrain is generated from the seed; render it with map_render, then adjust.',
    inputSchema: obj({ id: str, preset: { type: 'string', enum: [...map.PRESETS] }, cols: num, rows: num, seed: num, title: str, grid: { type: 'string', enum: [...map.GRID_TYPES] } }, ['id']),
    async run(a, p) {
      const preset = (a.preset ?? 'regional') as map.Preset;
      const r = createMap(p, a.id as string, preset, {
        seed: typeof a.seed === 'number' ? a.seed : Math.floor(Math.random() * 1e6), ...(typeof a.cols === 'number' && { cols: a.cols }), ...(typeof a.rows === 'number' && { rows: a.rows }),
        ...(typeof a.title === 'string' && { title: a.title }), ...(typeof a.grid === 'string' && { grid: { ...map.PRESET_DEFAULTS[preset].grid, type: a.grid as map.GridType } }),
      });
      return [text({ file: r.file, summary: describeMap(r.map) })];
    },
  },
  {
    name: 'map_update', description: 'Change a terrain map\'s settings. gen: {land: mixed|island|inland, sea 0..0.9 (water fraction), moisture 0..1, roughness 0..1, relief 0..1, rivers 0..20, simplify 0..6 (higher = fewer, larger, smoother patches), feature (hill size in cells)}; topo: {interval, maxElevation, majorEvery, unit, labels}; grid: {type none|square|hex, size, coords}; scale: {perCell, unit}; title, legend, scale_bar, compass.',
    inputSchema: obj({ id: str, seed: num, gen: { type: 'object' }, topo: { type: 'object' }, grid: { type: 'object' }, scale: { type: 'object' }, title: str, legend: bool, scale_bar: bool, compass: bool }, ['id']),
    async run(a, p) {
      const m = updateMap(p, a.id as string, m => {
        if (typeof a.seed === 'number') m.seed = a.seed;
        for (const k of ['gen', 'topo', 'grid', 'scale'] as const) if (a[k] && typeof a[k] === 'object') Object.assign(m[k], a[k]);
        if (typeof a.title === 'string') { if (a.title) m.title = a.title; else delete m.title; }
        if (typeof a.legend === 'boolean') m.legend = a.legend;
        if (typeof a.scale_bar === 'boolean') m.scaleBar = a.scale_bar;
        if (typeof a.compass === 'boolean') m.compass = a.compass;
      });
      return [text(describeMap(m))];
    },
  },
  {
    name: 'map_edit', description: 'Append terrain edits to a map (applied in order on top of the generated terrain), or undo the last ones. Coordinates are map cells (x right, y down). ops: {op:"paint", terrain, shape} | {op:"elevate", amount -1..1, shape} | {op:"river", points:[x,y,…] from source to mouth, width? (at the mouth), delta? (default true: flares into the water it ends in, banks merging into the shore)} | {op:"road", points:[x,y,…]}; shape: {circle:[x,y,r]} | {poly:[x,y,…]} | {stroke:[x,y,…], width}.',
    inputSchema: obj({ id: str, ops: { type: 'array', items: { type: 'object' } }, undo: { ...num, description: 'remove this many of the latest edits first' } }, ['id']),
    async run(a, p) {
      const m = updateMap(p, a.id as string, m => {
        const n = typeof a.undo === 'number' ? a.undo : 0;
        if (n > m.edits.length) throw new Error(`${m.id}: only ${m.edits.length} edits to undo`);
        m.edits.splice(m.edits.length - n, n);
        if (Array.isArray(a.ops)) m.edits.push(...(a.ops as map.MapEdit[]));
      });
      return [text({ edits: m.edits.length, last: m.edits.slice(-3) })];
    },
  },
  {
    name: 'map_overlay', description: 'Labels and symbols over a map (the follow-up layer). add_labels: [{text, at:"x,y"|"0304"|"C4" or x,y, kind: region|place|water|note, size?, angle?}]; add_symbols: [{kind, at or x,y, scale?}] (kinds from map_list); remove_labels / remove_symbols: indices (from map_get); clear: "labels"|"symbols"|"all".',
    inputSchema: obj({ id: str, add_labels: { type: 'array', items: { type: 'object' } }, add_symbols: { type: 'array', items: { type: 'object' } }, remove_labels: { type: 'array', items: num }, remove_symbols: { type: 'array', items: num }, clear: str }, ['id']),
    async run(a, p) {
      const m = updateMap(p, a.id as string, m => {
        const pt = (o: Json): [number, number] => (typeof o.at === 'string' ? map.parsePoint(m, o.at) : [Number(o.x), Number(o.y)]);
        const drop = <T>(list: T[], idx: unknown) => { if (Array.isArray(idx)) for (const i of [...(idx as number[])].sort((x, y) => y - x)) { if (!list[i]) throw new Error(`no overlay item ${i}`); list.splice(i, 1); } };
        if (a.clear === 'labels' || a.clear === 'all') m.overlay.labels = [];
        if (a.clear === 'symbols' || a.clear === 'all') m.overlay.symbols = [];
        drop(m.overlay.labels, a.remove_labels); drop(m.overlay.symbols, a.remove_symbols);
        for (const l of (a.add_labels as Json[] | undefined) ?? []) { const [x, y] = pt(l); m.overlay.labels.push({ text: String(l.text), x, y, kind: (l.kind ?? 'place') as map.LabelKind, ...(typeof l.size === 'number' && { size: l.size }), ...(typeof l.angle === 'number' && { angle: l.angle }), ...(typeof l.href === 'string' && l.href && { href: l.href }) }); }
        for (const s of (a.add_symbols as Json[] | undefined) ?? []) {
          if (!map.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${map.SYMBOL_KINDS.join(', ')})`);
          const [x, y] = pt(s); m.overlay.symbols.push({ kind: String(s.kind), x, y, ...(typeof s.scale === 'number' && { scale: s.scale }) });
        }
      });
      return [text({ labels: m.overlay.labels.map((l, i) => `${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`), symbols: m.overlay.symbols.map((s, i) => `${i}. ${s.kind} at ${s.x},${s.y}`) })];
    },
  },
  {
    name: 'map_render', description: 'Render a terrain map to art/maps/<id>/out/ (SVG + PNG; theme color, bw or both) and return the PNG to look at. layers turns layers off/on: terrain, rivers, roads, contours, grid, symbols, labels, legend, scale, compass, title. ppu: pixels per cell (default 40; the returned image uses at most 24 unless set).',
    inputSchema: obj({ id: str, theme: { type: 'string', enum: ['color', 'bw', 'both'] }, ppu: num, layers: { type: 'object' } }, ['id']),
    async run(a, p) {
      const themes: map.ThemeName[] = a.theme === 'both' ? ['color', 'bw'] : [a.theme === 'bw' ? 'bw' : 'color'], layers = a.layers as Partial<Record<map.MapLayer, boolean>> | undefined;
      const r = await renderMapFiles(p, a.id as string, { themes, ppu: typeof a.ppu === 'number' ? a.ppu : undefined, layers });
      const files = r.files.map(f => projRel(p, f));
      const look = typeof a.ppu === 'number' ? files.filter(f => f.endsWith('.png')) : (await renderMapFiles(p, a.id as string, { themes, ppu: 24, layers, formats: ['png'], out: join(p.art, 'maps', a.id as string, 'out', 'preview') })).files.map(f => projRel(p, f));
      return [text({ ...r, files }), ...look.map(f => pngFile(join(p.root, f)))];
    },
  },
  {
    name: 'dungeon_list', description: 'Dungeon maps (TTRPG, black and white) in art/dungeons, plus the room shapes, door kinds, symbol kinds and label kinds the dungeon tools accept.',
    inputSchema: obj({}),
    async run(_a, p) { return [text({ dungeons: listDungeons(p), shapes: dungeon.ROOM_SHAPES, doors: dungeon.DOOR_KINDS, symbols: dungeon.SYMBOL_KINDS, labelKinds: dungeon.LABEL_KINDS, routes: dungeon.ROUTES })]; },
  },
  {
    name: 'dungeon_get', description: 'A dungeon\'s file (art/dungeons/<id>/dungeon.json) and a readable summary: rooms with ids, corridors, labels and symbols with their indices.',
    inputSchema: obj({ id: str }, ['id']),
    async run(a, p) { const m = readDungeon(p, a.id as string); return [text(describeDungeon(m)), text(m)]; },
  },
  {
    name: 'dungeon_new', description: 'Create a dungeon map. mode "generate" (default): rooms and corridors from the seed and gen settings ({rooms, minSize, maxSize, caves, round, loops, doors, corridorWidth, spacing, entrance, layout: scatter|dense|blocks (dense: rooms side by side joined through shared walls; blocks: blocks split into rooms joined by corridors), density (dense: share of the sheet filled, 0..1)}); "room": one room of shape rect|circle|octagon|cave, w × h cells, with exits [{side: n|e|s|w, door?: kind|null, at?: offset along the wall, text?: a note at the edge saying where it leads}] running off the map, a label and a number; "empty": nothing yet (add rooms with dungeon_edit). One cell is 5 ft. Render with dungeon_render.',
    inputSchema: obj({ id: str, mode: { type: 'string', enum: ['generate', 'room', 'empty'] }, cols: num, rows: num, seed: num, title: str, gen: { type: 'object' }, shape: { type: 'string', enum: ['rect', 'circle', 'octagon', 'cave'] }, w: num, h: num, exits: { type: 'array', items: { type: 'object' } }, label: str, number: num }, ['id']),
    async run(a, p) {
      let m = dungeon.newDungeon(a.id as string, {
        seed: typeof a.seed === 'number' ? a.seed : Math.floor(Math.random() * 1e6), ...(typeof a.cols === 'number' && { cols: a.cols }), ...(typeof a.rows === 'number' && { rows: a.rows }),
        ...(typeof a.title === 'string' && { title: a.title }), ...(a.gen && typeof a.gen === 'object' ? { gen: { ...dungeon.DEFAULTS.gen, ...(a.gen as Json) } as dungeon.DungeonSpec['gen'] } : {}),
      });
      if (a.mode === 'room') m = dungeon.singleRoom(m, { shape: (a.shape ?? 'rect') as dungeon.RoomShape, w: Number(a.w ?? 8), h: Number(a.h ?? 8), exits: (a.exits ?? []) as never, label: a.label as string | undefined, number: typeof a.number === 'number' ? a.number : undefined });
      else if (a.mode !== 'empty') m = dungeon.generateDungeon(m);
      const r = createDungeon(p, m);
      return [text({ file: r.file, summary: describeDungeon(r.dungeon) })];
    },
  },
  {
    name: 'dungeon_update', description: 'Change a dungeon\'s settings (not its rooms). grid_size: the grid size in the map unit (10 = a line every 10 ft; a whole number of squares), grid_unit: the unit (ft, m, …; it is also the scale unit), sub_grid: true for a fainter line at every square, show_grid; grid_mode: "10" | "5" | "10+5" | "none" (a shorthand); grid: {show, size (cells), sub, clip: floor|all}; style: {hatch: band|full|none, band (cells of hatching along the walls), wall (weight)}; scale: {perCell, unit}; gen: generator settings (used by dungeon_generate); title, numbers, scale_bar, compass, cols, rows; furniture: {place: over|outside|auto, side?: bottom|right} (where the title, scale bar, compass and legend go: over the map, in a band beside it, or in the band only when they would cover something).',
    inputSchema: obj({ id: str, grid_size: num, grid_unit: str, sub_grid: bool, show_grid: bool, grid_mode: str, grid: { type: 'object' }, style: { type: 'object' }, scale: { type: 'object' }, gen: { type: 'object' }, title: str, numbers: bool, scale_bar: bool, compass: bool, cols: num, rows: num, furniture: { type: 'object' } }, ['id']),
    async run(a, p) {
      const m = updateDungeon(p, a.id as string, m => {
        if (a.furniture && typeof a.furniture === 'object') m.furniture = a.furniture as dungeon.DungeonSpec['furniture'];
        for (const k of ['grid', 'style', 'scale', 'gen'] as const) if (a[k] && typeof a[k] === 'object') Object.assign(m[k], a[k]);
        if (typeof a.grid_unit === 'string' && a.grid_unit) m.scale.unit = a.grid_unit;
        if (typeof a.grid_mode === 'string') m.grid = gridMode(m, a.grid_mode);
        m.grid = dungeon.gridFromUnits(m, { size: typeof a.grid_size === 'number' ? a.grid_size : undefined, sub: typeof a.sub_grid === 'boolean' ? a.sub_grid : undefined, show: typeof a.show_grid === 'boolean' ? a.show_grid : undefined });
        if (typeof a.title === 'string') { if (a.title) m.title = a.title; else delete m.title; }
        if (typeof a.numbers === 'boolean') m.numbers = a.numbers;
        if (typeof a.scale_bar === 'boolean') m.scaleBar = a.scale_bar;
        if (typeof a.compass === 'boolean') m.compass = a.compass;
        if (typeof a.cols === 'number') m.cols = a.cols;
        if (typeof a.rows === 'number') m.rows = a.rows;
      });
      return [text(describeDungeon(m))];
    },
  },
  {
    name: 'dungeon_generate', description: 'Regenerate a dungeon\'s rooms and corridors from its seed and gen settings (replaces every room and corridor; labels and symbols stay). Pass seed / gen / cols / rows to change them first.',
    inputSchema: obj({ id: str, seed: num, gen: { type: 'object' }, cols: num, rows: num }, ['id']),
    async run(a, p) {
      const m = updateDungeon(p, a.id as string, m => {
        if (typeof a.seed === 'number') m.seed = a.seed;
        if (a.gen && typeof a.gen === 'object') Object.assign(m.gen, a.gen);
        if (typeof a.cols === 'number') m.cols = a.cols;
        if (typeof a.rows === 'number') m.rows = a.rows;
        return dungeon.generateDungeon(dungeon.parseDungeon(m));
      });
      return [text(describeDungeon(m))];
    },
  },
  {
    name: 'dungeon_edit', description: 'Change a dungeon\'s rooms and corridors, in order. Coordinates are cells (x right, y down; 1 cell = 5 ft); a point is [x,y], "x,y" or a cell name "C4". ops: {op:"add_room", shape: rect|circle|octagon|cave|poly, at: top-left, w, h, points? (poly: [x,y,…]), label?, number? (false hides it), href? (a link from its number and name: http(s), a relative path or #anchor), id?} | {op:"move_room", room, at} | {op:"set_room", room, shape?, w?, h?, label?, number?, href? ("" removes it)} | {op:"remove_room", room} (and its corridors) | {op:"add_block", shape: rect|octagon|circle|hex|poly, at, w, h, points?, split?: bsp|rows|cols|grid|cuts, min? (cells, about the size of each room), cuts?: {x?: [], y?: []}, seed?, doors? (0..1, extra doors), id?} (one shape split into rooms that share walls, with doors and openings between them; its rooms are ordinary rooms, ids <block>-1, <block>-2, …) | {op:"split_block", id, split?, min?, seed?} (split again: a new seed unless given) | {op:"remove_block", id} | {op:"link", from: room id, point or "corridor:<id>", to: the same (a point is an exit or dead end; past the map edge it runs off the map; a corridor is a junction on its centre line), from_side?/to_side?: n|e|s|w (leave the room by that wall), from_offset?/to_offset? (cells along that wall), width?, route?: auto|hv|vh|straight|around (around: along the grid, round the rooms in the way), via?: [x,y,…], curve?: "smooth", style?: "natural" (rough cave-like walls), seed?, id? (a name other corridors can join), exit?: {text, href?, fade?} (to a point past the edge: the corridor fades out and a boxed note says where it leads), doors?: [kind|null, kind|null]} | {op:"unlink", index} | {op:"connect", a: room, b: room, kind?: door|secret|locked|portcullis|arch|open, at?: a point on their shared wall, width?} (a door or opening in the wall two touching rooms share; touching rooms without one keep the wall) | {op:"disconnect", index} | {op:"door", index, end: from|to, kind: door|secret|locked|portcullis|arch|null} | {op:"fit", margin?}.',
    inputSchema: obj({ id: str, ops: { type: 'array', items: { type: 'object' } } }, ['id', 'ops']),
    async run(a, p) {
      const m = updateDungeon(p, a.id as string, m => {
        const pt = (v: unknown): [number, number] => (Array.isArray(v) ? [Number(v[0]), Number(v[1])] : dungeon.parsePoint(String(v)));
        const corner = (v: unknown): [number, number] => (Array.isArray(v) ? pt(v) : cornerPoint(String(v)));
        const room = (rid: unknown) => { const r = m.rooms.find(r => r.id === rid); if (!r) throw new Error(`no room ${String(rid)} (have: ${m.rooms.map(r => r.id).join(', ') || 'none'})`); return r; };
        const end = (v: unknown, side?: unknown, offset?: unknown): dungeon.CorridorEnd => {
          if (v && typeof v === 'object' && !Array.isArray(v)) return v as dungeon.CorridorEnd;
          if (typeof v === 'string' && (m.rooms.some(r => r.id === v) || v.startsWith('corridor:') || m.corridors.some(c => c.id === v))) return corridorEnd(m, v, typeof side === 'string' ? side : undefined, typeof offset === 'number' ? offset : undefined);
          return { at: pt(v) };
        };
        const corridor = (i: unknown) => { const c = m.corridors[Number(i)]; if (!c) throw new Error(`no corridor ${String(i)} (0..${m.corridors.length - 1})`); return c; };
        let out = m;
        for (const op of (a.ops as Json[]) ?? []) {
          if (op.op === 'add_room') {
            const shape = op.shape as dungeon.RoomShape, rid = typeof op.id === 'string' ? op.id : dungeon.nextRoomId(m);
            const r: dungeon.Room = shape === 'poly'
              ? { id: rid, shape, points: (op.points as number[]).map(Number), ...dungeon.polyBox((op.points as number[]).map(Number)) }
              : { id: rid, shape, ...(([x, y]) => ({ x, y }))(corner(op.at ?? [op.x, op.y])), w: Number(op.w), h: Number(op.h) };
            if (typeof op.label === 'string') r.label = op.label;
            if (typeof op.number === 'number' || op.number === false) r.number = op.number;
            if (typeof op.href === 'string' && op.href) r.href = op.href;
            m.rooms.push(r);
          } else if (op.op === 'move_room') {
            const r = room(op.room), [x, y] = corner(op.at ?? [op.x, op.y]), dx = x - r.x, dy = y - r.y;
            r.x = x; r.y = y;
            if (r.points) r.points = r.points.map((v, i) => v + (i % 2 ? dy : dx));
          } else if (op.op === 'set_room') {
            const r = room(op.room);
            if (typeof op.shape === 'string') { r.shape = op.shape as dungeon.RoomShape; if (r.shape !== 'poly') delete r.points; }
            if (typeof op.w === 'number') r.w = op.w;
            if (typeof op.h === 'number') r.h = op.h;
            if (typeof op.label === 'string') { if (op.label) r.label = op.label; else delete r.label; }
            if (typeof op.number === 'number' || op.number === false) r.number = op.number;
            if (typeof op.href === 'string') { if (op.href) r.href = op.href; else delete r.href; }
          } else if (op.op === 'remove_room') {
            dungeon.removeRoom(m, room(op.room).id);
          } else if (op.op === 'link') {
            m.corridors.push({
              ...(typeof op.id === 'string' && { id: op.id }),
              from: end(op.from, op.from_side, op.from_offset), to: ((e: dungeon.CorridorEnd) => (op.exit && typeof op.exit === 'object' && 'at' in e ? { ...e, exit: op.exit as dungeon.Exit } : e))(end(op.to, op.to_side, op.to_offset)), ...(typeof op.width === 'number' && { width: op.width }), ...(typeof op.route === 'string' && { route: op.route as dungeon.Route }),
              ...(op.curve === 'smooth' && { curve: 'smooth' as const }), ...(op.style === 'natural' && { style: 'natural' as const }), ...(typeof op.seed === 'number' && { seed: op.seed }),
              ...(Array.isArray(op.via) && { via: (op.via as number[]).map(Number) }), ...(Array.isArray(op.doors) && { doors: op.doors as [dungeon.DoorKind | null, dungeon.DoorKind | null] }),
            });
          } else if (op.op === 'unlink') { corridor(op.index); dungeon.removeCorridor(m, Number(op.index)); }
          else if (op.op === 'add_block' || op.op === 'split_block') {
            let id = String(op.id ?? '');
            const split = { mode: (op.split ?? 'bsp') as dungeon.SplitMode, ...(typeof op.min === 'number' && { min: op.min }), ...(op.cuts && typeof op.cuts === 'object' ? { cuts: op.cuts as { x?: number[]; y?: number[] } } : {}), ...(typeof op.seed === 'number' && { seed: op.seed }) };
            if (op.op === 'add_block') {
              const used = new Set((m.blocks ?? []).map(b => b.id));
              if (!id) for (let n = 1; ; n++) if (!used.has(`b${n}`)) { id = `b${n}`; break; }
              const [x, y] = corner(op.at ?? [op.x, op.y]), w = Number(op.w), h = Number(op.h), shape = String(op.shape ?? 'rect');
              const b: dungeon.Block = shape === 'hex' ? { id, shape: 'poly', points: dungeon.hexPoints(x, y, w, h), x, y, w, h, split }
                : shape === 'poly' ? { id, shape: 'poly', points: (op.points as number[]).map(Number), ...dungeon.polyBox((op.points as number[]).map(Number)), split }
                : { id, shape: shape as dungeon.Block['shape'], x, y, w, h, split };
              if (typeof op.doors === 'number') b.doors = op.doors;
              (m.blocks ??= []).push(b);
            } else {
              const b = m.blocks?.find(x => x.id === id);
              if (!b) throw new Error(`no block ${id}`);
              b.split = { ...b.split, ...(op.split !== undefined && { mode: split.mode }), ...(split.min !== undefined && { min: split.min }), ...(split.cuts && { cuts: split.cuts }), seed: split.seed ?? Math.floor(Math.random() * 1e6) };
            }
            out = dungeon.applyBlock(dungeon.parseDungeon(m), id).spec;
          } else if (op.op === 'remove_block') { dungeon.removeBlock(m, String(op.id)); }
          else if (op.op === 'connect') {
            (m.connections ??= []).push({ a: String(op.a), b: String(op.b), ...(op.at !== undefined && { at: pt(op.at) }), ...(typeof op.kind === 'string' && op.kind !== 'door' && { kind: op.kind as dungeon.DoorKind | 'open' }), ...(typeof op.width === 'number' && { width: op.width }) });
          } else if (op.op === 'disconnect') {
            if (!m.connections?.[Number(op.index)]) throw new Error(`no connection ${String(op.index)} (0..${(m.connections?.length ?? 0) - 1})`);
            m.connections.splice(Number(op.index), 1);
          }
          else if (op.op === 'door') {
            const c = corridor(op.index), d = c.doors ?? [null, null], kind = (op.kind ?? null) as dungeon.DoorKind | null;
            c.doors = op.end === 'to' ? [d[0], kind] : [kind, d[1]];
          } else if (op.op === 'fit') out = dungeon.fitDungeon(dungeon.parseDungeon(m), typeof op.margin === 'number' ? op.margin : 2);
          else throw new Error(`unknown op ${String(op.op)} (add_room, move_room, set_room, remove_room, add_block, split_block, remove_block, link, unlink, connect, disconnect, door, fit)`);
          if (out !== m) Object.assign(m, out);
        }
      });
      return [text([describeDungeon(m), ...warningLines(m)].join('\n'))];
    },
  },
  {
    name: 'dungeon_check', description: 'Check a dungeon: every error in its file with the JSON path (a field out of range, a room id that is not there), then drawing errors and warnings (a room outline that crosses itself, rooms laid over each other, a corridor through a room it does not join or across another, a door never drawn, a mark off the sheet or on a room number). Fix errors before rendering; look at each warning.',
    inputSchema: obj({ id: str }, ['id']),
    async run(a, p) { return [text(checkDungeonFile(p, a.id as string))]; },
  },
  {
    name: 'dungeon_overlay', description: 'Labels and symbols over a dungeon (the follow-up layer). add_labels: [{text, at:"x,y"|"C4" or x,y, kind: name|note|area, size?, angle?, href? (a link: http(s), a relative path or #anchor)}]; add_symbols: [{kind, at or x,y, scale?, angle?}] (kinds from dungeon_list: stairs, pillar, statue, altar, chest, trap, pit, pool, …); remove_labels / remove_symbols: indices (from dungeon_get); clear: "labels"|"symbols"|"all". Room names and numbers are room settings (dungeon_edit set_room).',
    inputSchema: obj({ id: str, add_labels: { type: 'array', items: { type: 'object' } }, add_symbols: { type: 'array', items: { type: 'object' } }, remove_labels: { type: 'array', items: num }, remove_symbols: { type: 'array', items: num }, clear: str }, ['id']),
    async run(a, p) {
      const m = updateDungeon(p, a.id as string, m => {
        const pt = (o: Json): [number, number] => (typeof o.at === 'string' ? dungeon.parsePoint(o.at) : Array.isArray(o.at) ? [Number(o.at[0]), Number(o.at[1])] : [Number(o.x), Number(o.y)]);
        const drop = <T>(items: T[], idx: unknown) => { if (Array.isArray(idx)) for (const i of [...(idx as number[])].sort((x, y) => y - x)) { if (!items[i]) throw new Error(`no overlay item ${i}`); items.splice(i, 1); } };
        if (a.clear === 'labels' || a.clear === 'all') m.overlay.labels = [];
        if (a.clear === 'symbols' || a.clear === 'all') m.overlay.symbols = [];
        drop(m.overlay.labels, a.remove_labels); drop(m.overlay.symbols, a.remove_symbols);
        for (const l of (a.add_labels as Json[] | undefined) ?? []) { const [x, y] = pt(l); m.overlay.labels.push({ text: String(l.text), x, y, kind: (l.kind ?? 'name') as dungeon.LabelKind, ...(typeof l.size === 'number' && { size: l.size }), ...(typeof l.angle === 'number' && { angle: l.angle }), ...(typeof l.href === 'string' && l.href && { href: l.href }) }); }
        for (const s of (a.add_symbols as Json[] | undefined) ?? []) {
          if (!dungeon.SYMBOLS[String(s.kind)]) throw new Error(`unknown symbol ${String(s.kind)} (have: ${dungeon.SYMBOL_KINDS.join(', ')})`);
          const [x, y] = pt(s); m.overlay.symbols.push({ kind: String(s.kind), x, y, ...(typeof s.scale === 'number' && { scale: s.scale }), ...(typeof s.angle === 'number' && { angle: s.angle }) });
        }
      });
      return [text({ labels: m.overlay.labels.map((l, i) => `${i}. ${l.kind} "${l.text}" at ${l.x},${l.y}`), symbols: m.overlay.symbols.map((s, i) => `${i}. ${s.kind} at ${s.x},${s.y}`) })];
    },
  },
  {
    name: 'dungeon_render', description: 'Render a dungeon to art/dungeons/<id>/out/ (black-and-white SVG + PNG) and return the PNG to look at. layers turns layers off/on: rock, floors, grid, doors, symbols, numbers, labels, title, scale, compass. ppu: pixels per cell (default 40; the returned image uses 24 unless set).',
    inputSchema: obj({ id: str, ppu: num, layers: { type: 'object' } }, ['id']),
    async run(a, p) {
      const layers = a.layers as Partial<Record<dungeon.DungeonLayer, boolean>> | undefined;
      const r = await renderDungeonFiles(p, a.id as string, { ppu: typeof a.ppu === 'number' ? a.ppu : undefined, layers });
      const files = r.files.map(f => projRel(p, f));
      const look = typeof a.ppu === 'number' ? files.filter(f => f.endsWith('.png')) : (await renderDungeonFiles(p, a.id as string, { ppu: 24, layers, formats: ['png'], out: join(p.art, 'dungeons', a.id as string, 'out', 'preview') })).files.map(f => projRel(p, f));
      return [text({ ...r, files }), ...look.map(f => pngFile(join(p.root, f)))];
    },
  },
  {
    name: 'settlement_list', description: 'Settlement maps (TTRPG villages, towns and castles, in colour or black and white) in art/settlements, plus the kinds every settlement tool accepts: settlement kinds, building kinds, shapes and roofs, road, water, wall, gate, area and tree kinds, fixture (furniture) kinds and edit ops.',
    inputSchema: obj({}),
    async run(_a, p) {
      return [text({
        settlements: listSettlements(p), kinds: settlement.SETTLEMENT_KINDS, buildings: settlement.BUILDING_KINDS, shapes: settlement.BUILDING_SHAPES, roofs: settlement.ROOFS,
        roads: settlement.ROAD_KINDS, water: settlement.WATER_KINDS, walls: settlement.WALL_KINDS, gates: settlement.GATE_KINDS, areas: settlement.AREA_KINDS, trees: settlement.TREE_KINDS,
        fixtures: settlement.FIXTURE_KINDS, symbols: settlement.SYMBOL_KINDS, labelKinds: settlement.LABEL_KINDS, ops: settlement.SETTLEMENT_OPS,
      })];
    },
  },
  {
    name: 'settlement_get', description: 'A settlement\'s file (art/settlements/<id>/settlement.json) and a readable summary: buildings with ids, kinds and floors, roads, water, walls with their indices, areas, trees and props.',
    inputSchema: obj({ id: str, file: bool }, ['id']),
    async run(a, p) { const m = readSettlement(p, a.id as string); return [text(describeSettlement(m)), ...(a.file === false ? [] : [text(m)])]; },
  },
  {
    name: 'settlement_new', description: 'Create a settlement map. kind: hamlet|village|town|city|castle (sets the sheet size, cell size and generator defaults: a town or city has 10 ft cells and a stone wall, a castle a curtain wall, keep and moat). mode "generate" (default): roads, water, walls, buildings, fields, trees and props from the seed and gen settings ({buildings, density 0..1, streets: organic|grid|radial, wall: none|palisade|stone, water: none|river|lake|coast|moat, trees 0..1, fields 0..1, market, castle, interiors (lay out every building\'s floors too)}); "empty": a blank sheet (add things with settlement_edit). map + at: a terrain map (its id in art/maps, or a path) under the sheet, its top-left at map units at=[x,y]; its rivers, lakes, sea, woods and slopes shape the layout. Render with settlement_render.',
    inputSchema: obj({ id: str, kind: { type: 'string', enum: [...settlement.SETTLEMENT_KINDS] }, mode: { type: 'string', enum: ['generate', 'empty'] }, cols: num, rows: num, seed: num, title: str, gen: { type: 'object' }, map: str, at: { type: 'array', items: num } }, ['id']),
    async run(a, p) {
      const kind = (a.kind ?? 'village') as settlement.SettlementKind, id = a.id as string;
      const base = settlement.newSettlement(id, kind, { seed: typeof a.seed === 'number' ? a.seed : Math.floor(Math.random() * 1e6), ...(typeof a.cols === 'number' && { cols: a.cols }), ...(typeof a.rows === 'number' && { rows: a.rows }), ...(typeof a.title === 'string' && { title: a.title }) });
      if (a.gen && typeof a.gen === 'object') Object.assign(base.gen, a.gen);
      if (typeof a.map === 'string' && a.map) {
        const mp = mapForSettlement(p, id, a.map), mspec = map.parseMap(JSON.parse(readFileSync(mp.path, 'utf8')));
        const scale = Math.round(((base.scale.perCell * settlement.feetIn(base.scale.unit)) / (mspec.scale.perCell * settlement.feetIn(mspec.scale.unit))) * 1e4) / 1e4;
        base.underlay = { map: mp.rel, origin: Array.isArray(a.at) ? [Number(a.at[0]), Number(a.at[1])] : [0, 0], scale };
      }
      // the underlay is read from the settlement's own folder: create the file first, then lay it out
      const empty = settlement.parseSettlement(base);
      createSettlement(p, empty);
      const m = a.mode === 'empty' ? empty : updateSettlement(p, id, m => settlement.generateSettlement(m, readSettlementUnderlay(p, id, m) ?? {}));
      return [text({ file: `art/settlements/${id}/settlement.json`, summary: describeSettlement(m) })];
    },
  },
  {
    name: 'settlement_update', description: 'Change a settlement\'s settings (not its contents): title, kind, ground (grass|dirt|sand|snow|stone), cols, rows, seed, gen (generator settings, used by settlement_generate), grid: {show, size (cells), sub}, grid_size (in the sheet\'s unit, e.g. 10 ft), scale: {perCell, unit}, plan_cell (feet in a floor-plan cell, default 5), numbers, scale_bar, compass, legend, furniture: {place: over|outside|auto, side?: bottom|right}, underlay: {map, origin, scale, theme?} or null.',
    inputSchema: obj({ id: str, title: str, kind: str, ground: str, cols: num, rows: num, seed: num, gen: { type: 'object' }, grid: { type: 'object' }, grid_size: num, scale: { type: 'object' }, plan_cell: num, numbers: bool, scale_bar: bool, compass: bool, legend: bool, furniture: { type: 'object' }, underlay: { type: ['object', 'null'] } }, ['id']),
    async run(a, p) {
      const m = updateSettlement(p, a.id as string, m => {
        for (const k of ['gen', 'grid', 'scale'] as const) if (a[k] && typeof a[k] === 'object') Object.assign(m[k], a[k]);
        if (typeof a.grid_size === 'number') m.grid = { ...m.grid, show: true, size: a.grid_size / m.scale.perCell };
        if (typeof a.plan_cell === 'number') m.interior.perCell = a.plan_cell;
        if (typeof a.title === 'string') { if (a.title) m.title = a.title; else delete m.title; }
        for (const k of ['kind', 'ground'] as const) if (typeof a[k] === 'string') (m as unknown as Json)[k] = a[k];
        for (const k of ['cols', 'rows', 'seed'] as const) if (typeof a[k] === 'number') m[k] = a[k] as number;
        if (typeof a.numbers === 'boolean') m.numbers = a.numbers;
        if (typeof a.scale_bar === 'boolean') m.scaleBar = a.scale_bar;
        if (typeof a.compass === 'boolean') m.compass = a.compass;
        if (typeof a.legend === 'boolean') m.legend = a.legend;
        if (a.furniture && typeof a.furniture === 'object') m.furniture = a.furniture as settlement.SettlementSpec['furniture'];
        if (a.underlay === null) delete m.underlay; else if (a.underlay && typeof a.underlay === 'object') m.underlay = a.underlay as settlement.SettlementSpec['underlay'];
      });
      return [text(describeSettlement(m).split('\n').slice(0, 3).join('\n'))];
    },
  },
  {
    name: 'settlement_generate', description: 'Lay the settlement out again from its seed, kind and gen settings (pass seed / kind / gen / cols / rows to change them first). Everything the generator wrote before (origin "gen") is replaced; entries made by hand are kept and kept clear of. With gen.interiors every building gets floors.',
    inputSchema: obj({ id: str, seed: num, kind: str, gen: { type: 'object' }, cols: num, rows: num }, ['id']),
    async run(a, p) {
      const id = a.id as string;
      const m = updateSettlement(p, id, m => {
        if (typeof a.seed === 'number') m.seed = a.seed;
        if (typeof a.kind === 'string') m.kind = a.kind as settlement.SettlementKind;
        if (a.gen && typeof a.gen === 'object') Object.assign(m.gen, a.gen);
        if (typeof a.cols === 'number') m.cols = a.cols;
        if (typeof a.rows === 'number') m.rows = a.rows;
        const s = settlement.parseSettlement(m);
        return settlement.generateSettlement(s, readSettlementUnderlay(p, id, s) ?? {});
      });
      return [text(describeSettlement(m))];
    },
  },
  {
    name: 'settlement_edit', description: 'Change a settlement\'s contents, in order. Site coordinates are cells (x right, y down; settlement_get says the cell size); a building\'s floor coordinates are plan cells (5 ft) from the footprint\'s top-left corner before it is turned. ops (each {op, …fields}): building.add {kind, x, y, w, h, shape?: rect|L|T|circle|octagon|poly, points?, wing?: [w,h] (L/T), angle? (degrees), roof?: gable|hip|flat|battlement|cone|thatch|none, stories?, label?, number? (false hides it), href?, id?} | building.set {id, …the same} | building.move {id, x, y} | building.rm {id} | interior {id, seed?, stories?} (lay its floors out: rooms, doors, windows, stairs, furniture by kind) | interior.clear {id} | floor.add {building, level (0 ground, 1 up, -1 cellar), name?} | floor.rm {building, level} | room.add {building, level, shape?: rect|circle|octagon|cave|poly, x, y, w, h, points?, label?, id?} | room.set {building, level, id, …} | room.rm {building, level, id} | connect {building, level, a, b, kind?: door|secret|locked|portcullis|arch|open, at?, width?} (a door in the wall two rooms share) | disconnect {building, level, index} | door {building, level, at: [x,y], kind?, width?} (in the outer wall) | window {building, level, at, width?} | fixture.add {building, level, kind, x, y (its centre), w?, h? (default: the kind\'s true size), angle?, label?} | fixture.rm {building, level, index} | prop.add {kind, x, y, w?, h?, angle?} (a fixture on the site: well, cart, stall, …) | prop.rm {index} | road.add {kind: highway|street|lane|alley|path|track, points: [x,y,…], width?, curve?: smooth, label?} | water.add {kind: river|stream|canal|moat (lines, width?) | pond|lake|sea (areas), points} | wall.add {kind: curtain|stone|palisade|fence|hedge|drystone|ruined, points, closed?, thickness?, towers?: {shape: round|square, size?, at?: "corners"|[vertex indices], every? (cells)}} | wall.gate {index, at, kind?: gatehouse|gate|postern|opening, width?, drawbridge?} | area.add {kind: field|garden|orchard|wood|scrub|marsh|graveyard|market|square|yard|paddock|rubble, points, label?} | tree.add {kind: tree|conifer|bush|rock|boulder|stump|reeds, x, y, size?} | tree.scatter {kind, area: [x,y,…], count, seed?} | label {text, x, y, kind?: name|note|area|street, size?, angle?, href?} | symbol {kind, x, y, scale?, angle?} | road.rm, water.rm, wall.rm, area.rm, tree.rm, label.rm, symbol.rm {index}.',
    inputSchema: obj({ id: str, ops: { type: 'array', items: { type: 'object' } } }, ['id', 'ops']),
    async run(a, p) {
      const done: string[] = [];
      const m = updateSettlement(p, a.id as string, m => { for (const op of (a.ops as settlement.SettlementOp[]) ?? []) done.push(settlement.editSettlement(m, op)); });
      return [text([...done, ...settlementWarningLines(m)].join('\n'))];
    },
  },
  {
    name: 'settlement_check', description: 'Check a settlement: every error in its file with the JSON path, then drawing warnings (buildings laid over each other, standing in water or across a road, a gate far from its wall, a room outside its footprint, furniture outside the building or on other furniture, stairs that meet nothing on the next floor, marks off the sheet).',
    inputSchema: obj({ id: str }, ['id']),
    async run(a, p) { return [text(checkSettlementFile(p, a.id as string))]; },
  },
  {
    name: 'settlement_facts', description: 'A settlement read back as numbers: counts by kind, each building\'s box, size, storeys and floors (rooms, doors, windows, furniture by kind), each wall\'s length, towers and gates, each road\'s length, water and areas.',
    inputSchema: obj({ id: str }, ['id']),
    async run(a, p) { return [text(settlement.settlementFacts(readSettlement(p, a.id as string)))]; },
  },
  {
    name: 'settlement_render', description: 'Render a settlement to art/settlements/<id>/out/ (SVG + PNG) and return the PNG to look at. view: site (default) or plan (one building\'s floor: building id, floor level, default the ground floor). buildings (site): roofs (blocked out, default), outline, or interior (each building cut away to its ground floor). theme: color (default), bw or both. plans: true renders the site and every floor of every building (images not returned). layers turns layers off/on (site: ground, underlay, areas, water, roads, bridges, walls, buildings, trees, props, grid, symbols, numbers, labels, legend, title, scale, compass; plan: floor, grid, walls, doors, windows, fixtures, numbers, labels, …). ppu: pixels per cell (default 24 on the site, 40 on a plan; the returned image is smaller unless set).',
    inputSchema: obj({ id: str, view: { type: 'string', enum: ['site', 'plan'] }, building: str, floor: num, buildings: { type: 'string', enum: [...settlement.BUILDING_MODES] }, theme: { type: 'string', enum: ['color', 'bw', 'both'] }, plans: bool, ppu: num, layers: { type: 'object' } }, ['id']),
    async run(a, p) {
      const id = a.id as string, themes: settlement.SettlementTheme[] = a.theme === 'both' ? ['color', 'bw'] : [a.theme === 'bw' ? 'bw' : 'color'];
      const o = { themes, ...(a.view === 'plan' || typeof a.building === 'string' ? { view: 'plan' as const } : {}), ...(typeof a.building === 'string' && { building: a.building }), ...(typeof a.floor === 'number' && { floor: a.floor }), ...(typeof a.buildings === 'string' && { buildings: a.buildings as settlement.BuildingMode }), layers: a.layers as Partial<Record<settlement.SettlementLayer, boolean>> | undefined };
      const rs = await renderSettlementFiles(p, id, { ...o, plans: a.plans === true, ppu: typeof a.ppu === 'number' ? a.ppu : undefined });
      const files = rs.flatMap(r => r.files.map(f => projRel(p, f)));
      if (a.plans === true) return [text({ renders: rs.length, files })];
      const look = typeof a.ppu === 'number' ? files.filter(f => f.endsWith('.png')) : (await renderSettlementFiles(p, id, { ...o, ppu: o.view === 'plan' ? 28 : Math.max(4, Math.min(16, Math.round(1100 / Math.max(readSettlement(p, id).cols, readSettlement(p, id).rows)))), formats: ['png'], out: join(p.art, 'settlements', id, 'out', 'preview') })).flatMap(r => r.files.map(f => projRel(p, f)));
      return [text({ ...rs[0], files }), ...look.map(f => pngFile(join(p.root, f)))];
    },
  },
];

function openDirection(p: Project, a: Json) {
  const name = dirOpt(p, a)!;
  return parseDirection(BENCH_DIRECTIONS[name] ?? JSON.parse(readFileSync(name, 'utf8')));
}

export interface RpcMessage { jsonrpc: '2.0'; id?: number | string | null; method?: string; params?: Json; result?: unknown; error?: unknown }

/** Handle one JSON-RPC message; returns the response, or null for notifications. */
export async function handle(msg: RpcMessage, cwd = process.cwd()): Promise<RpcMessage | null> {
  const reply = (result: unknown): RpcMessage => ({ jsonrpc: '2.0', id: msg.id ?? null, result });
  const fail = (code: number, message: string): RpcMessage => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null; // notifications (initialized, cancelled) need no answer
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion as string | undefined;
      return reply({ protocolVersion: asked && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER,
        instructions: 'artgen pixel-art pipeline for this game repo. Art lives in art/; read the artgen and art-direction skills for the workflow.' });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === msg.params?.name);
      if (!tool) return fail(-32602, `unknown tool ${String(msg.params?.name)}`);
      const p = findProject(cwd);
      if (!p) return reply({ content: [text('no artgen project here (art/artgen.config.json not found) — run `node tools/artgen/artgen.js init`')], isError: true });
      try {
        return reply({ content: await tool.run((msg.params?.arguments as Json) ?? {}, p) });
      } catch (e) {
        return reply({ content: [text(e instanceof Error ? e.message : String(e))], isError: true });
      }
    }
    default: return fail(-32601, `method not found: ${msg.method}`);
  }
}

/** Serve newline-delimited JSON-RPC on stdin/stdout; requests are answered in order. */
export function serve(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout, cwd = process.cwd()): Promise<void> {
  let buf = '', chain = Promise.resolve();
  const write = (m: RpcMessage) => output.write(JSON.stringify(m) + '\n');
  input.setEncoding?.('utf8');
  input.on('data', (chunk: string) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      chain = chain.then(async () => {
        let msg: RpcMessage;
        try { msg = JSON.parse(line); } catch { write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); return; }
        const r = await handle(msg, cwd);
        if (r) write(r);
      });
    }
  });
  return new Promise(res => input.on('end', () => { void chain.then(res); }));
}
