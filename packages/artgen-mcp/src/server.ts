/**
 * artgen MCP server (SPEC §14): JSON-RPC 2.0 over stdio, newline-delimited, no SDK dependency so it bundles into
 * one file for the committed install. P2 served the W1 and pipeline tools, P3 added `status`; P7 completes the set:
 * `finish`, `make` (with the parallel round), `feedback`, `approve`, `gallery`, `texture`, `fx`, `export`, `restyle`
 * and `analytics`. Image results are returned as MCP image content (base64 PNG).
 *
 * Paths are sandboxed: every asset argument must resolve inside the project's `art/` folder (a brief id resolves
 * through art/briefs.yaml), and the quick-look tools (`texture`, `fx`) write only under art/sheets/. `export` writes
 * where art/artgen.config.json says (the game's pack and runtime folders), as the CLI does.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { encodePNG, MATERIALS, parseDirection, PRESET_NAMES, type Grid, type Size } from 'artgen-core';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import {
  approve, candidateNames, exportPacks, feedback, findProject, fxRun, gallery, loadCandidate, lockedDirection, make, openAsset, passState, projectAnalytics,
  readBriefs, renderVersion, requireLocked, restyle, reviewVersion, projectStatus, scoreVersion, textureRun, VERSION, versionsIn, writeNextFinish, writeTile, type Project,
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
    name: 'review', description: 'Build the review sheet for a version (best so far, v(n-1), v(n), checker + scaled + in context + silhouette), log it to the ledger and return it. blind: the version alone (no earlier versions, scores or notes) for a fresh reviewer\'s blind re-score of a final.',
    inputSchema: obj({ asset: str, version: str, blind: { type: 'boolean' }, direction: str }, ['asset']),
    async run(a, p) {
      const ad = asset(p, a), vs = versionsIn(ad), version = typeof a.version === 'string' ? a.version : vs[vs.length - 1];
      const r = await reviewVersion(ad, version, { blind: a.blind === true });
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
    name: 'score', description: 'Record a 0-10 visual score for a reviewed version (the art-reviewer verdict) with gate results and token estimates. reviewer: who scored (the subagent name; omitted = self). blind: a blind re-score from the blind sheet (needs a reviewer).',
    inputSchema: obj({ asset: str, version: str, score: num, note: str, reviewer: str, blind: { type: 'boolean' }, direction: str }, ['asset', 'version', 'score']),
    async run(a, p) {
      const s = a.score as number, reviewer = typeof a.reviewer === 'string' && a.reviewer ? a.reviewer : 'self';
      if (!(s >= 0 && s <= 10)) throw new Error('score must be 0-10');
      if (a.blind === true && reviewer === 'self') throw new Error('a blind re-score needs reviewer: it comes from a fresh reviewer that saw only the blind sheet');
      return [text(await scoreVersion(asset(p, a), a.version as string, s, typeof a.note === 'string' ? a.note : '', { reviewer, ...(a.blind === true && { blind: true }) }))];
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
    name: 'make', description: 'One tick of the autonomous W2 run: scaffold missing assets from templates, mark finished pipelines final, and name the next step. parallel: n also returns a round of up to n maker packets (one subagent per asset; each writes only its own files, then runs render + review) and the main agent\'s review steps.',
    inputSchema: obj({ ids: { ...strs, description: 'brief ids; default all' }, parallel: { ...num, description: 'maker subagents per round' } }),
    async run(a, p) { return [text(await make(p, ids(a), { parallel: typeof a.parallel === 'number' && a.parallel >= 1 ? a.parallel : undefined }))]; },
  },
  {
    name: 'status', description: 'W2 production status of every brief in art/briefs.yaml (brief, in-pipeline, final, approved, exported, revision, stale), with the final version, score, open issues and the next pipeline step.',
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
    name: 'feedback', description: 'Record the user\'s feedback on a finished asset (by: user) and open a U-stage iteration. route base = form, proportion, colour (new base); finish = pixel fixes (finish revision). Pass the user\'s own words as note; region x,y,w,h in sprite pixels of cell state/facing/frame.',
    inputSchema: obj({ id: str, route: { type: 'string', enum: ['base', 'finish'] }, note: str, region: { type: 'array', items: num }, cell: str, force: bool }, ['id', 'route', 'note']),
    async run(a, p) {
      if (a.route !== 'base' && a.route !== 'finish') throw new Error('route: base | finish');
      if (typeof a.note !== 'string' || !a.note) throw new Error('note: the user\'s words are required');
      return [text(await feedback(p, a.id as string, { route: a.route, note: a.note, region: Array.isArray(a.region) ? (a.region as number[]) : undefined, cell: typeof a.cell === 'string' ? a.cell : undefined, force: a.force === true }))];
    },
  },
  {
    name: 'approve', description: 'Record the USER\'s approval of a final asset (D10: approval is the user\'s call, never the agent\'s). Call only after the user said so in this conversation; user_approved must be true and note should quote them. Needs a passing gate and a review sheet of the final (R6).',
    inputSchema: obj({ id: str, note: str, user_approved: { ...bool, description: 'true only when the user explicitly approved this asset' } }, ['id', 'user_approved']),
    async run(a, p) {
      if (a.user_approved !== true) throw new Error('approve: only the user approves assets (D10) — show them the gallery and ask; pass user_approved: true once they say so');
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
    name: 'export', description: 'Export approved assets into the configured packs (atlases, pack.json, Aseprite JSON, typed assets.ts); include_drafts adds finals; runtime vendors the W3 runtime + adapters. Animation contracts are enforced unless break_contract names the asset (or *).',
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
