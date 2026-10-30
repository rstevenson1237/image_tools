/**
 * The operation registry (docs/OPERATION-REGISTRY.md): every artgen operation declared once, with its parameters, its
 * side effect, its implementation and how the CLI and the MCP server show it. This file holds the types, the parameter
 * helpers and the JSON Schema and help text made from a declaration. It imports nothing from Node or the engines (only
 * types), so the web app can use it too; the command-line parser is `cli.ts`, the declarations are `maps.ts` and `art.ts`.
 */
import type { AssetDir } from '../asset.ts';
import type { ArtMetricsOf } from '../loop/metrics.ts';
import type { Project } from '../projectfs.ts';

export type Module = 'core' | 'art' | 'maps';
/** read: writes nothing. write: changes a source file (a map, briefs, the ledger, direction.json). render: writes only derived files (out/, sheets/). */
export type Effect = 'read' | 'write' | 'render';

/** A surface the operation is left off, with the reason (shown in docs/OPERATIONS.md). */
export interface Excluded { exclude: string }

/** What an MCP tool returns: text, or a PNG. */
export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' };

export interface Param {
  kind: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'list' | 'points' | 'size' | 'json';
  doc?: string;                       // CLI --help, MCP description, Python docstring
  values?: readonly string[];         // enum
  item?: 'string' | 'number';         // list
  schema?: Record<string, unknown>;   // json (and any kind): the MCP JSON Schema, e.g. { type: 'array', items: { type: 'object' } }
  required?: boolean | string;        // a string is the error message, kept verbatim from today
  positional?: boolean | 'rest';      // CLI: bound in declaration order; rest = every remaining positional (an array)
  repeat?: boolean;                   // CLI: the flag may repeat (`--room a --room b`) → an array
  multi?: boolean;                    // CLI: the flag takes every value up to the next flag (`--at 4,60 12,80`) → an array
  flag?: string;                      // CLI flag when it isn't `--<key in kebab case>` (e.g. `--file` for `path`)
  style?: 'switch' | 'onoff' | 'either';  // boolean on the CLI: presence (`--empty`, default), a value (`--legend on|off`), or presence with an optional value (`--interiors [on|off]`)
  error?: string;                     // what a bad value is told: `<flag>: <error>` (default per kind)
  cli?: false;                        // not on the CLI (nor Python)
  mcp?: false;                        // not on MCP (every path outside art/ is mcp: false: the sandbox)
}

export interface Ctx {
  surface: 'cli' | 'mcp';
  /** The project: CLI requireProject(--root) with today's message; MCP the server's project. */
  project(): Project;
  /** CLI findProject(--root) (null outside a project); MCP the server's project. */
  findProject(): Project | null;
  /** A path a core function reported, as the surface shows it (MCP: relative to the project root). */
  rel(file: string): string;
  /** The `--root` given on the command line (CLI only; `init` creates a project there). */
  root?: string;
  /** art module only (set by the CLI's and the MCP server's art context): resolve and open an asset argument. */
  asset?(arg: unknown, o?: { direction?: string; ledger?: string }): AssetDir;
  assetPath?(arg: unknown): string;
  /** art module only (set by the CLI's and the MCP server's art contexts): the pixel-art numbers of a metrics export. A maps-only repo has none. */
  artMetrics?: ArtMetricsOf;
  /** art module only: a `direction` argument as the engine takes it (CLI: as given; MCP: a bench name or a file under the project root). */
  direction?(d: unknown): string | undefined;
}

export interface OpDef<I = Record<string, any>, R = any> {
  name: string;                       // the CLI command path with dots: 'map.render', 'pass.status', 'render', 'import-edit'
  module: Module;
  summary: string;                    // one line: help, docs, Python docstring
  description?: string;               // MCP description (default: summary); copied verbatim from today's tool
  effect: Effect;
  params: Record<string, Param>;      // ordered; keys are snake_case and are the MCP argument names
  run(input: I, ctx: Ctx): R | Promise<R>;
  cli: Excluded | {
    usage: string | string[];         // the top-level --help line(s), kept from today's USAGE text ([]: another operation's lines show it)
    text?(r: R, input: I): string;    // human output (default JSON)
    json?(r: R, input: I): unknown;   // the --json payload (default r)
    exit?(r: R, input: I): number;    // exit code (default 0)
    output?(r: R, input: I, io: { json: boolean; log(s: string): void }): void;  // escape hatch (report, bench)
  };
  mcp: Excluded | {
    name?: string;                    // default: name with . and - → _
    content?(r: R, input: I, ctx: Ctx): Content[] | Promise<Content[]>;  // default [text(r)]
  };
  python: Excluded | { name?: string };  // default: name with . and - → _
}
export const defineOp = <I, R>(op: OpDef<I, R>): OpDef<I, R> => op;

export type CliDef = Exclude<OpDef['cli'], Excluded>;
export type McpDef = Exclude<OpDef['mcp'], Excluded>;
export const isExcluded = (x: object): x is Excluded => 'exclude' in x;
export const cliOf = (op: OpDef): CliDef | null => (isExcluded(op.cli) ? null : op.cli);
export const mcpOf = (op: OpDef): McpDef | null => (isExcluded(op.mcp) ? null : op.mcp);

type Opts = Partial<Pick<Param, 'required' | 'positional' | 'repeat' | 'multi' | 'flag' | 'style' | 'error' | 'cli' | 'mcp' | 'schema'>>;
/** Parameter declarations: `p.str('doc', { positional: true })`. */
export const p = {
  str: (doc: string, o: Opts = {}): Param => ({ kind: 'string', doc, ...o }),
  num: (doc: string, o: Opts = {}): Param => ({ kind: 'number', doc, ...o }),
  int: (doc: string, o: Opts = {}): Param => ({ kind: 'integer', doc, ...o }),
  bool: (doc: string, o: Opts = {}): Param => ({ kind: 'boolean', doc, style: 'switch', ...o }),
  oneOf: (values: readonly string[], doc: string, o: Opts = {}): Param => ({ kind: 'enum', values, doc, ...o }),
  list: (item: 'string' | 'number', doc: string, o: Opts = {}): Param => ({ kind: 'list', item, doc, ...o }),
  points: (doc: string, o: Opts = {}): Param => ({ kind: 'points', doc, ...o }),
  size: (doc: string, o: Opts = {}): Param => ({ kind: 'size', doc, ...o }),
  json: (schema: Record<string, unknown>, doc: string, o: Opts = {}): Param => ({ kind: 'json', schema, doc, ...o }),
};

/** `on`/`off`/`true`/`false`/`yes`/`no` → boolean (anything but on, true, yes and 1 is off). */
export const onOff = (v: string): boolean => /^(on|true|yes|1)$/i.test(v);

/** The CLI flag of a parameter. */
export const flagOf = (key: string, par: Param): string => par.flag ?? `--${key.replace(/_/g, '-')}`;
/** The command words of an operation (`map.render` → map render). */
export const wordsOf = (op: OpDef): string[] => op.name.split('.');
/** The MCP tool name. */
export const mcpName = (op: OpDef): string => mcpOf(op)?.name ?? op.name.replace(/[.-]/g, '_');

const KIND_SCHEMA: Record<Param['kind'], (par: Param) => Record<string, unknown>> = {
  string: () => ({ type: 'string' }),
  number: () => ({ type: 'number' }),
  integer: () => ({ type: 'number' }),
  boolean: () => ({ type: 'boolean' }),
  enum: par => ({ type: 'string', enum: [...(par.values ?? [])] }),
  list: par => ({ type: 'array', items: { type: par.item ?? 'string' } }),
  points: () => ({ type: 'array', items: { type: 'number' } }),
  size: () => ({ type: 'array', items: { type: 'number' } }),
  json: par => { if (!par.schema) throw new Error('a json parameter needs a schema'); return par.schema; },
};

/** The JSON Schema of one parameter (its `schema` when it has one). */
export function paramSchema(par: Param): Record<string, unknown> {
  const s = par.schema ?? KIND_SCHEMA[par.kind](par);
  return par.doc && !('description' in s) ? { ...s, description: par.doc } : s;
}

/** The MCP input schema of an operation: its parameters that are not `mcp: false`. */
export function inputSchema(op: OpDef): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
  const on = Object.entries(op.params).filter(([, par]) => par.mcp !== false);
  return { type: 'object', properties: Object.fromEntries(on.map(([k, par]) => [k, paramSchema(par)])), required: on.filter(([, par]) => par.required).map(([k]) => k) };
}

const KIND_WORD: Record<Param['kind'], string> = { string: '<value>', number: 'number', integer: 'whole number', boolean: '', enum: '', list: 'a,b,…', points: 'x,y,…', size: 'WxH', json: 'json | @file' };

/** The top-level `--help` lines of an operation (empty when another operation's lines show it). */
export function usageLines(op: OpDef): string[] {
  const c = cliOf(op);
  return c ? (Array.isArray(c.usage) ? c.usage : [c.usage]).filter(Boolean) : [];
}

/** `artgen map render --help`: the usage lines, the summary, then one line per parameter. */
export function opHelp(op: OpDef): string {
  const words = wordsOf(op).join(' '), params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
  const pos = params.filter(([, par]) => par.positional).map(([k, par]) => (par.required ? `<${k}>` : `[${k}]`) + (par.positional === 'rest' ? '…' : ''));
  const own = usageLines(op);
  const rows = params.map(([k, par]) => {
    const name = par.positional ? `<${k}>` : flagOf(k, par), what = par.positional ? '' : par.kind === 'enum' ? par.values!.join('|') : par.kind === 'boolean' ? (par.style === 'onoff' ? 'on|off' : par.style === 'either' ? '[on|off]' : '') : KIND_WORD[par.kind];
    return `  ${[name, what].filter(Boolean).join(' ').padEnd(30)} ${par.doc ?? ''}${par.repeat ? ' (repeatable)' : ''}`.trimEnd();
  });
  return [
    ...(own.length ? own : [`       artgen ${[words, ...pos].join(' ')}${params.some(([, par]) => !par.positional) ? ' [flags]' : ''}`]), '', op.summary, '',
    ...rows, '', `  --json                         print machine-readable output`, `  --root <dir>                   the game repo (default: found from here upward)`,
  ].join('\n');
}
