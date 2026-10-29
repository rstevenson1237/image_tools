/**
 * artgen MCP server (SPEC §14): JSON-RPC 2.0 over stdio, newline-delimited, no SDK dependency so it bundles into
 * one file for the committed install. Every tool is generated from the operation registry (`artgen-cli`'s `ops/`, see
 * docs/OPERATION-REGISTRY.md): its name, description and input schema come from the operation's declaration, its behaviour
 * from the operation's `run`. This file holds what is MCP's own: the sandbox, the project context, the JSON-RPC framing.
 * Image results are returned as MCP image content (base64 PNG).
 *
 * Terrain maps (`map_*`) work on `art/maps/<id>/map.json`, dungeon maps (`dungeon_*`) on `art/dungeons/<id>/dungeon.json`,
 * settlement maps (`settlement_*`) on `art/settlements/<id>/settlement.json`; a map, dungeon or settlement id is a name,
 * never a path.
 *
 * Paths are sandboxed: every asset argument must resolve inside the project's `art/` folder (a brief id resolves
 * through art/briefs.yaml), and the quick-look tools (`texture`, `fx`) write only under art/sheets/. `export` writes
 * where art/artgen.config.json says (the game's pack and runtime folders), as the CLI does.
 */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { BENCH_DIRECTIONS } from 'artgen-core/bench';
import { artMetricsOf, findProject, openAsset, OPS, readBriefs, VERSION, inputSchema, mcpName, mcpOf, type Ctx, type OpDef, type Project } from 'artgen-cli';

export const SERVER = { name: 'artgen', version: VERSION === 'dev' ? '0.0.0-dev' : VERSION };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Json = Record<string, unknown>;
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };
interface ToolDef { name: string; description: string; inputSchema: Json; annotations?: { readOnlyHint: boolean }; run(args: Json, p: Project): Promise<Content[]> }

const text = (v: unknown): Content => ({ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) });
/** A file a core function reported (relative to the process's cwd) as a path relative to the project root. */
const projRel = (p: Project, f: string) => relative(p.root, resolve(f)).split('\\').join('/');
/** What an operation sees on MCP: the server's project, paths relative to its root, assets only inside `art/` (and no `ledger` override). */
const mcpCtx = (p: Project): Ctx => ({
  surface: 'mcp', project: () => p, findProject: () => p, rel: f => projRel(p, f),
  assetPath: arg => assetPath(p, arg), asset: (arg, o) => openAsset(assetPath(p, arg), { direction: dirOpt(p, o?.direction) }), direction: d => dirOpt(p, d), artMetrics: artMetricsOf,
});
/** A tool made from an operation of the registry (docs/OPERATION-REGISTRY.md §4): its schema, description and content come from the declaration. */
function mcpTool(op: OpDef): ToolDef {
  const m = mcpOf(op)!, schema = inputSchema(op), known = new Set(Object.keys(schema.properties));
  return {
    name: mcpName(op), description: op.description ?? op.summary, inputSchema: schema, annotations: { readOnlyHint: op.effect === 'read' },
    // only the arguments the schema lists reach the operation: a command-line-only one (`path`, `ledger`, `out`, `across`) names a file outside the sandbox
    async run(given, p) { const a = Object.fromEntries(Object.entries(given).filter(([k]) => known.has(k))), ctx = mcpCtx(p), r = await op.run(a, ctx); return m.content ? m.content(r, a, ctx) : [text(r)]; },
  };
}

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
const dirOpt = (p: Project, d: unknown) => (typeof d !== 'string' ? undefined : BENCH_DIRECTIONS[d] ? d : join(p.root, d));

/** The MCP tools: every operation of the registry that is not left off MCP, in registry order. */
export const TOOLS: ToolDef[] = OPS.filter(op => mcpOf(op)).map(mcpTool);

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
    case 'tools/list': return reply({ tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, ...(annotations && { annotations }) })) });
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
