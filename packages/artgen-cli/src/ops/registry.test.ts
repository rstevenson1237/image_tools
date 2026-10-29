// The operation registry (docs/OPERATION-REGISTRY.md): how each parameter kind reads off a command line and what it is told
// when it is wrong, the JSON Schema and help made from a declaration, path mode, rest and repeated flags, unknown flags,
// and that every concrete map, dungeon and settlement example in the shipped skills and commands parses.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findOp, parseCli, runCli, type CliIO } from './cli.ts';
import { MAP_OPS } from './maps.ts';
import { defineOp, inputSchema, mcpName, opHelp, p, usageLines, type Ctx } from './registry.ts';

const ctx: Ctx = { surface: 'cli', project: () => ({ root: '/p', art: '/p/art' }), findProject: () => null, rel: f => f };
const lines: string[] = [];
const io: CliIO = { log: s => lines.push(s), ctx: () => ctx, readFile: f => (f === 'ops.json' ? '[{"op":"fit"}]' : '{}') };

const demo = defineOp({
  name: 'demo.run', module: 'maps', summary: 'A demo.', effect: 'read',
  params: {
    id: p.str('the id', { positional: true, required: 'demo run: <id>' }),
    path: p.str('a file instead of the id', { flag: '--file', mcp: false }),
    rest: p.str('more words', { positional: 'rest', mcp: false }),
    name: p.str('a name'), n: p.num('a number'), count: p.int('a whole number'), on: p.bool('a switch'), legend: p.bool('on or off', { style: 'onoff' }), mode: p.oneOf(['a', 'b', 'c'], 'a mode'),
    tags: p.list('string', 'tags'), nums: p.list('number', 'numbers'), pts: p.points('points'), size: p.size('a size'), data: p.json({ type: 'object' }, 'json'),
    room: p.str('a room', { repeat: true }), at: p.str('points', { multi: true }), scale_bar: p.bool('a switch with a long name'), only_cli: p.str('cli only', { mcp: false }), only_mcp: p.str('mcp only', { cli: false }),
    odd: p.num('a number with its own words', { error: 'a number above 0' }),
  },
  run: i => i,
  cli: { usage: '       artgen demo run <id> [flags]' }, mcp: {}, python: {},
});
const parse = (...argv: string[]) => parseCli([demo], ['demo', 'run', ...argv], io).values;

describe('the parser reads each kind', () => {
  test('strings, numbers, integers, switches and on/off', () => {
    expect(parse('x', '--name', 'Port Ash', '--n', '-1.5', '--count', '3', '--on', '--legend', 'off', '--scale-bar')).toMatchObject({ id: 'x', name: 'Port Ash', n: -1.5, count: 3, on: true, legend: false, scale_bar: true });
    expect(parse('x', '--legend', 'yes').legend).toBe(true);
    expect(parse('x', '--name', '').name).toBe('');
  });
  test('enums, lists, points, sizes and json', () => {
    expect(parse('x', '--mode', 'b', '--tags', 'a, b,,c', '--nums', '1,2.5', '--pts', '1,2,3,4', '--size', '8x6.5', '--data', '{"a":1}')).toMatchObject({ mode: 'b', tags: ['a', 'b', 'c'], nums: [1, 2.5], pts: [1, 2, 3, 4], size: [8, 6.5], data: { a: 1 } });
    expect(parse('x', '--data', '@ops.json').data).toEqual([{ op: 'fit' }]);
  });
  test('a bad value is told what is wanted, with the flag', () => {
    expect(() => parse('x', '--n', 'abc')).toThrow('--n: a number');
    expect(() => parse('x', '--count', '1.5')).toThrow('--count: a whole number');
    expect(() => parse('x', '--mode', 'z')).toThrow('--mode: a, b, c');
    expect(() => parse('x', '--nums', '1,x')).toThrow('--nums: comma-separated numbers');
    expect(() => parse('x', '--pts', '1,2,3')).toThrow('--pts: comma-separated numbers in x,y pairs');
    expect(() => parse('x', '--size', '8')).toThrow('--size: WIDTHxHEIGHT, e.g. 8x6');
    expect(() => parse('x', '--data', '{nope')).toThrow(/--data: not JSON/);
    expect(() => parse('x', '--odd', 'z')).toThrow('--odd: a number above 0');
  });
  test('a flag with no value is an error', () => {
    expect(() => parse('x', '--name')).toThrow('--name: a value is required');
  });
});

describe('positionals, path mode, repeated flags', () => {
  test('positionals bind in order, rest takes the remainder', () => {
    expect(parse('x', 'a', 'b', 'c')).toMatchObject({ id: 'x', rest: ['a', 'b', 'c'] });
    expect(parse('x')).toMatchObject({ id: 'x', rest: [] });
  });
  test('a positional may look like a negative number', () => {
    expect(parse('x', '-3').rest).toEqual(['-3']);
  });
  test('a required positional that is missing says its own message', () => {
    expect(() => parse()).toThrow('demo run: <id>');
  });
  test('--file stands in for the id, which is then not on the command line', () => {
    expect(parse('--file', 'a.json', 'one', 'two')).toMatchObject({ path: 'a.json', rest: ['one', 'two'] });
    expect(parse('--file', 'a.json').id).toBeUndefined();
  });
  test('`new` still takes an id beside --file', () => {
    const make = defineOp({ ...demo, name: 'demo.new' });
    expect(parseCli([make], ['demo', 'new', 'x', '--file', 'a.json'], io).values).toMatchObject({ id: 'x', path: 'a.json' });
  });
  test('a repeated flag collects, a multi flag takes every value up to the next flag', () => {
    expect(parse('x', '--room', 'r1', '--room', 'r2')).toMatchObject({ room: ['r1', 'r2'] });
    expect(parse('x', '--at', '3,3', 'C4', '--name', 'n', '--at', '0304').at).toEqual(['3,3', 'C4', '0304']);
  });
  test('the globals are accepted by every operation', () => {
    const r = parseCli([demo], ['demo', 'run', 'x', '--json', '--root', '/somewhere'], io);
    expect(r).toMatchObject({ json: true, root: '/somewhere' });
    expect(() => parseCli([demo], ['demo', 'run', 'x', '--root'], io)).toThrow('--root');
  });
});

describe('what the parser refuses', () => {
  test('an unknown flag names the operation and points at --help', () => {
    expect(() => parse('x', '--thme', 'bw')).toThrow('artgen demo run: unknown flag --thme (artgen demo run --help)');
    expect(() => parse('x', '--only-mcp', 'v')).toThrow('unknown flag --only-mcp');
  });
  test('an extra positional is an error unless a rest takes it', () => {
    const one = defineOp({ ...demo, params: { id: demo.params.id } });
    expect(() => parseCli([one], ['demo', 'run', 'x', 'y'], io)).toThrow('artgen demo run: unexpected argument y (artgen demo run --help)');
  });
  test('the longest command wins, and an unknown command is handed to the caller', () => {
    const short = defineOp({ ...demo, name: 'demo' });
    expect(findOp([short, demo], ['demo', 'run', 'x'])?.name).toBe('demo.run');
    expect(findOp([short, demo], ['demo', 'x'])?.name).toBe('demo');
    expect(() => parseCli([demo], ['nope'], { unknown: a => { throw new Error(`no ${a[0]}`); } })).toThrow('no nope');
    expect(() => parseCli([demo], ['nope', 'x'], io)).toThrow("unknown command 'nope x'");
  });
  test('an operation left off the CLI is not found', () => {
    const hidden = defineOp({ ...demo, name: 'demo.hidden', cli: { exclude: 'because' } });
    expect(findOp([hidden], ['demo', 'hidden'])).toBeUndefined();
  });
});

describe('running', () => {
  test('text, --json, exit code and --help', async () => {
    lines.length = 0;
    const op = defineOp({ ...demo, params: { id: demo.params.id }, run: (i: Record<string, any>) => ({ ok: false, id: i.id as string }), cli: { usage: [], text: (r: { id: string }) => `id ${r.id}`, json: (r: object) => ({ version: 1, ...r }), exit: (r: { ok: boolean }) => (r.ok ? 0 : 1) } });
    expect(await runCli([op], ['demo', 'run', 'a'], io)).toBe(1);
    expect(await runCli([op], ['demo', 'run', 'a', '--json'], io)).toBe(1);
    expect(await runCli([op], ['demo', 'run', '--help'], io)).toBe(0);
    expect(lines[0]).toBe('id a');
    expect(JSON.parse(lines[1])).toEqual({ version: 1, ok: false, id: 'a' });
    expect(lines[2]).toContain('A demo.');
    expect(lines[2]).toContain('<id>');
  });
  test('an operation\'s own output wins', async () => {
    lines.length = 0;
    const op = defineOp({ ...demo, params: {}, run: () => 'r', cli: { usage: '', output: (r, _i, o) => o.log(`${r}${o.json ? ' json' : ''}`) } });
    await runCli([op], ['demo', 'run', '--json'], io);
    expect(lines).toEqual(['r json']);
  });
});

describe('what a declaration makes', () => {
  test('the MCP schema leaves out CLI-only parameters and lists the required ones', () => {
    const s = inputSchema(demo);
    expect(Object.keys(s.properties)).toEqual(['id', 'name', 'n', 'count', 'on', 'legend', 'mode', 'tags', 'nums', 'pts', 'size', 'data', 'room', 'at', 'scale_bar', 'only_mcp', 'odd']);
    expect(s.required).toEqual(['id']);
    expect(s.properties.mode).toEqual({ type: 'string', enum: ['a', 'b', 'c'], description: 'a mode' });
    expect(s.properties.count).toEqual({ type: 'number', description: 'a whole number' });
    expect(s.properties.tags).toEqual({ type: 'array', items: { type: 'string' }, description: 'tags' });
    expect(s.properties.nums).toEqual({ type: 'array', items: { type: 'number' }, description: 'numbers' });
    expect(s.properties.pts).toMatchObject({ type: 'array', items: { type: 'number' } });
    expect(s.properties.data).toEqual({ type: 'object', description: 'json' });
    expect(s.properties.on).toEqual({ type: 'boolean', description: 'a switch' });
  });
  test('a schema override wins over the kind', () => {
    const op = defineOp({ ...demo, params: { size: p.str('px, or [w, h]', { schema: { description: 'px, or [w, h]; default 32' } }) } });
    expect(inputSchema(op).properties.size).toEqual({ description: 'px, or [w, h]; default 32' });
  });
  test('a json parameter needs a schema', () => {
    const op = defineOp({ ...demo, params: { x: { kind: 'json' } } });
    expect(() => inputSchema(op)).toThrow('needs a schema');
  });
  test('the MCP name is the operation name with . and - as _', () => {
    expect(mcpName(demo)).toBe('demo_run');
    expect(mcpName(defineOp({ ...demo, name: 'import-edit' }))).toBe('import_edit');
    expect(mcpName(defineOp({ ...demo, name: 'x.y', mcp: { name: 'z' } }))).toBe('z');
  });
  test('help lists the usage, the summary and one line a parameter, but not what is MCP-only', () => {
    const h = opHelp(demo);
    expect(h).toContain('artgen demo run <id> [flags]');
    expect(h).toContain('A demo.');
    expect(h).toContain('--file');
    expect(h).toContain('--mode a|b|c');
    expect(h).toContain('--room');
    expect(h).toContain('(repeatable)');
    expect(h).not.toContain('--only-mcp');
    expect(opHelp(defineOp({ ...demo, params: { id: demo.params.id }, cli: { usage: [] } }))).toContain('artgen demo run <id>');
  });
});

describe('the map module\'s operations', () => {
  const cli = MAP_OPS.filter(op => !('exclude' in op.cli));
  test('every operation is on the CLI and says what it does', () => {
    expect(cli.length).toBe(MAP_OPS.length);
    for (const op of MAP_OPS) expect(op.summary, op.name).not.toBe('');
  });
  test('names are unique, and an operation left off MCP or Python says why', () => {
    expect(new Set(MAP_OPS.map(o => o.name)).size).toBe(MAP_OPS.length);
    for (const op of MAP_OPS) { for (const s of [op.mcp, op.python]) if ('exclude' in s) expect(s.exclude.length, op.name).toBeGreaterThan(5); }
  });
  test('every operation has a usage line somewhere in the module\'s --help', () => {
    const text = MAP_OPS.flatMap(usageLines).join('\n');
    for (const op of MAP_OPS) { const w = op.name.split('.'); expect(text, op.name).toMatch(new RegExp(w.length === 1 ? `artgen ${w[0]}\\b` : `artgen ${w[0]}\\b[^\\n]*\\b${w[w.length - 1]}\\b`)); }
  });
  test('every operation answers --help', async () => {
    for (const op of MAP_OPS) {
      lines.length = 0;
      expect(await runCli(MAP_OPS, [...op.name.split('.'), '--help'], io), op.name).toBe(0);
      expect(lines[0], op.name).toContain(op.summary);
    }
  });
  test('MCP parameters match the R1 tools: map operations take their id as `id` and never the path', () => {
    for (const op of MAP_OPS) if (op.params.path) expect(inputSchema(op).properties.path, op.name).toBeUndefined();
  });
});

// ---- the examples in the shipped skills and commands
/** A shell-like split: words, with '…' and "…" quoting. */
function words(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = '', has = false;
  for (const ch of line) {
    if (q) { if (ch === q) q = ''; else cur += ch; } else if (ch === '"' || ch === "'") { q = ch; has = true; } else if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ''; has = false; } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}
function* markdown(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) { const full = join(dir, f); if (statSync(full).isDirectory()) yield* markdown(full); else if (f.endsWith('.md')) yield full; }
}
const CONTENT = new URL('../../../artgen-dist/content', import.meta.url).pathname;

describe('the examples in the skills and commands', () => {
  const examples: { file: string; line: string }[] = [];
  for (const file of markdown(CONTENT)) {
    let code = false;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      if (raw.trimStart().startsWith('```')) { code = !code; continue; }
      if (!code) continue;
      const m = raw.trim().match(/^\{\{ARTGEN\}\} ((?:map|dungeon|settlement|formats)\b.*)$/);
      if (!m) continue;
      const line = m[1].replace(/\s+#\s.*$/, '').replace(/<[a-z-]+>/g, 'x').replace(/\{\{ARTGEN\}\}/g, 'artgen');
      if (/[|…\[\]]|\.\.\./.test(line) || /\s#$/.test(line)) continue;
      examples.push({ file: file.slice(CONTENT.length + 1), line });
    }
  }
  test('there are some', () => { expect(examples.length).toBeGreaterThan(40); });
  test('each concrete one names a known operation and only flags it has', () => {
    const bad: string[] = [];
    for (const { file, line } of examples) {
      try { parseCli(MAP_OPS, words(line), { readFile: () => '[]' }); } catch (e) { bad.push(`${file}: ${line}\n    ${(e as Error).message}`); }
    }
    expect(bad).toEqual([]);
  });
});

