/**
 * The generic command-line parser and dispatcher (docs/OPERATION-REGISTRY.md §3): finds the operation a command line
 * names, reads its flags and positionals as the operation's parameters declare them, runs it and prints the result. It
 * knows nothing about maps or art, and imports only `registry.ts`, so the maps-only bundle can hold it.
 */
import { cliOf, flagOf, onOff, opHelp, wordsOf, type Ctx, type OpDef, type Param } from './registry.ts';

export interface CliIO {
  log(s: string): void;
  /** The context an operation runs in: the project found from `--root` (or the working directory). */
  ctx(root: string | undefined): Ctx;
  /** The text of a file, for a json flag given as `@file.json`. */
  readFile?(path: string): string;
  /** Called with a command line no operation answers; it throws the message (default: a generic one). */
  unknown?(argv: string[]): never;
}

const isSwitch = (par: Param) => par.kind === 'boolean' && par.style !== 'onoff';

function convert(par: Param, raw: string, name: string, io: Pick<CliIO, 'readFile'>): unknown {
  const bad = (what: string): never => { throw new Error(`${name}: ${par.error ?? what}`); };
  switch (par.kind) {
    case 'string': return raw;
    case 'number': return Number.isFinite(+raw) ? +raw : bad('a number');
    case 'integer': return Number.isInteger(+raw) && raw.trim() !== '' ? +raw : bad('a whole number');
    case 'boolean': return onOff(raw);
    case 'enum': return par.values!.includes(raw) ? raw : bad(par.values!.join(', '));
    case 'list': {
      const xs = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (par.item !== 'number') return xs;
      const ns = xs.map(Number);
      return ns.some(n => !Number.isFinite(n)) ? bad('comma-separated numbers') : ns;
    }
    case 'points': {
      const ns = raw.split(',').map(s => s.trim()).filter(Boolean).map(Number);
      return !ns.length || ns.some(n => !Number.isFinite(n)) || ns.length % 2 ? bad('comma-separated numbers in x,y pairs') : ns;
    }
    case 'size': {
      const m = raw.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
      return m ? [+m[1], +m[2]] : bad('WIDTHxHEIGHT, e.g. 8x6');
    }
    case 'json': {
      let text = raw;
      if (raw.startsWith('@')) { if (!io.readFile) bad('@file is not available here'); text = io.readFile!(raw.slice(1)); }
      try { return JSON.parse(text); } catch (e) { return bad(`not JSON (${(e as Error).message})`); }
    }
  }
}

/** Find the operation whose command words start the command line (the longest wins). */
export function findOp(ops: readonly OpDef[], argv: string[]): OpDef | undefined {
  let best: OpDef | undefined;
  for (const op of ops) {
    const w = wordsOf(op);
    if (cliOf(op) && w.length <= argv.length && w.every((x, i) => argv[i] === x) && (!best || w.length > wordsOf(best).length)) best = op;
  }
  return best;
}

export interface Parsed {
  op: OpDef;
  /** The parameters by key, as typed (numbers are numbers, a size is `[w, h]`, a json flag is parsed). */
  values: Record<string, unknown>;
  json: boolean;
  root?: string;
  /** `--help` was given: print the operation's help instead of running it. */
  help: boolean;
}

/** Read a command line as an operation's parameters, with the errors a bad one earns; nothing is run. */
export function parseCli(ops: readonly OpDef[], argv: string[], io: Pick<CliIO, 'readFile' | 'unknown'> = {}): Parsed {
  const op = findOp(ops, argv);
  if (!op) {
    if (io.unknown) io.unknown(argv);
    throw new Error(`artgen: unknown command '${argv.slice(0, 2).join(' ')}' — run artgen --help for the list`);
  }
  const words = wordsOf(op), cmd = words.join(' '), tokens = argv.slice(words.length);
  if (tokens.includes('--help')) return { op, values: {}, json: false, help: true };

  const params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
  const flags = new Map(params.filter(([, par]) => !par.positional).map(([k, par]) => [flagOf(k, par), [k, par] as const]));
  const values: Record<string, unknown> = {}, positionals: string[] = [];
  let json = false, root: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.startsWith('--')) { positionals.push(t); continue; }
    if (t === '--json') { json = true; continue; }
    if (t === '--root') { if (tokens[i + 1] === undefined) throw new Error('--root: a folder is required'); root = tokens[++i]; continue; }
    const hit = flags.get(t);
    if (!hit) throw new Error(`artgen ${cmd}: unknown flag ${t} (artgen ${cmd} --help)`);
    const [key, par] = hit;
    if (isSwitch(par)) {
      // `--interiors` alone, or `--interiors on|off`
      const next = tokens[i + 1];
      if (par.style === 'either' && next !== undefined && /^(on|off|true|false|yes|no)$/i.test(next)) { values[key] = onOff(next); i++; } else values[key] = true;
      continue;
    }
    if (tokens[i + 1] === undefined) throw new Error(`${t}: a value is required`);
    const take = (raw: string) => convert(par, raw, t, io);
    if (par.multi) {
      const got = [take(tokens[++i])];
      while (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) got.push(take(tokens[++i]));
      values[key] = [...((values[key] as unknown[] | undefined) ?? []), ...got];
    } else if (par.repeat) values[key] = [...((values[key] as unknown[] | undefined) ?? []), take(tokens[++i])];
    else values[key] = take(tokens[++i]);
  }

  // path mode: with --file the id is not on the command line (except for `new`, where it may still be given)
  const fileMode = op.params.path?.flag === '--file' && values.path !== undefined, skipId = fileMode && !op.name.endsWith('.new');
  const slots = params.filter(([k, par]) => par.positional && !(skipId && k === 'id'));
  let at = 0;
  for (const [k, par] of slots) {
    if (par.positional === 'rest') { values[k] = positionals.slice(at).map(s => convert(par, s, `<${k}>`, io)); at = positionals.length; }
    else if (at < positionals.length) values[k] = convert(par, positionals[at++], `<${k}>`, io);
  }
  if (at < positionals.length) throw new Error(`artgen ${cmd}: unexpected argument ${positionals[at]} (artgen ${cmd} --help)`);
  for (const [k, par] of params) {
    if (!par.required || values[k] !== undefined || (fileMode && k === 'id')) continue;
    throw new Error(typeof par.required === 'string' ? par.required : par.positional ? `${cmd}: <${k}> is required` : `${flagOf(k, par)} is required`);
  }
  return { op, values, json, root, help: false };
}

/** Run a command line against the operations; returns the exit code. Errors are thrown, as the commands always have. */
export async function runCli(ops: readonly OpDef[], argv: string[], io: CliIO): Promise<number> {
  const { op, values, json, root, help } = parseCli(ops, argv, io), cli = cliOf(op)!;
  if (help) { io.log(opHelp(op)); return 0; }
  const r = await op.run(values, io.ctx(root));
  if (cli.output) cli.output(r, values, { json, log: io.log });
  else io.log(json ? JSON.stringify(cli.json ? cli.json(r, values) : r, null, 2) : cli.text ? cli.text(r, values) : JSON.stringify(r, null, 2));
  return cli.exit ? cli.exit(r, values) : 0;
}
