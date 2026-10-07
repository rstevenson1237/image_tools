/**
 * artgen MCP server (SPEC §14): JSON-RPC 2.0 over stdio, newline-delimited, no SDK dependency so it bundles into
 * one file for the committed install. P2 serves the W1 and pipeline tools the skills use, P3 adds `status`; P7 adds
 * the rest (finish, approve, texture, fx, export). Image results are returned as MCP image content (base64 PNG).
 *
 * Paths are sandboxed: every asset path must resolve inside the project's `art/` folder.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { encodePNG, type Grid } from 'artgen-core';
import {
  candidateNames, findProject, loadCandidate, lockedDirection, openAsset, passState, renderVersion, reviewVersion,
  projectStatus, scoreVersion, versionsIn, writeTile, type Project,
} from 'artgen-cli';

export const SERVER = { name: 'artgen', version: '0.3.0' };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Json = Record<string, unknown>;
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };
interface ToolDef { name: string; description: string; inputSchema: Json; run(args: Json, p: Project): Promise<Content[]> }

const text = (v: unknown): Content => ({ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) });
const image = (g: Grid): Content => ({ type: 'image', data: Buffer.from(encodePNG(g)).toString('base64'), mimeType: 'image/png' });
const pngFile = (f: string): Content => ({ type: 'image', data: readFileSync(f).toString('base64'), mimeType: 'image/png' });
const str = { type: 'string' } as const, num = { type: 'number' } as const;
const obj = (properties: Json, required: string[] = []) => ({ type: 'object', properties, required });

/** Resolve an asset directory argument inside `art/` (relative to the project root or to `art/`). */
export function assetPath(p: Project, arg: unknown): string {
  if (typeof arg !== 'string' || !arg) throw new Error('asset: required (e.g. "art/probes/character" or "assets/character/goblin")');
  const cands = isAbsolute(arg) ? [arg] : [resolve(p.root, arg), resolve(p.art, arg)];
  for (const c of cands) {
    const r = relative(p.art, c);
    if (r && !r.startsWith('..') && !isAbsolute(r)) return c;
  }
  throw new Error(`asset path ${arg} is outside art/ (sandbox)`);
}

const asset = (p: Project, args: Json) => openAsset(assetPath(p, args.asset), { direction: typeof args.direction === 'string' ? join(p.root, args.direction) : undefined });

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
    name: 'status', description: 'W2 production status of every brief in art/briefs.yaml (brief, in-pipeline, final, approved, exported, revision, stale), with the final version, score, open issues and the next pipeline step.',
    inputSchema: obj({ ids: { type: 'array', items: str, description: 'brief ids; default all' } }),
    async run(a, p) { return [text(await projectStatus(p, Array.isArray(a.ids) ? (a.ids as string[]) : undefined))]; },
  },
];

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
