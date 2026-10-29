// Parity (docs/OPERATION-REGISTRY.md §8): the operation registry is the one list of what artgen can do, and every interface shows it.
// The MCP tools are exactly the registry's MCP operations; each operation is on every surface or says why not; the CLI's `--help`
// lists every command and the maps-only bundle's lists the map ones and answers no art command; the generated Python methods and
// the operations reference on disk are current; no two operations collide on a surface.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ART_OPS, cliOf, findOp, isExcluded, main, MAP_OPS, mapsMain, mcpName, mcpOf, operationsDoc, OPS, pythonOps, pyName, usageLines, wordsOf } from 'artgen-cli';
import { handle } from './index.ts';

const REPO = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, REPO), 'utf8');

/** What a command prints through console.log. */
async function printed(run: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [], spy = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
  try { await run(); } finally { spy.mockRestore(); }
  return lines.join('\n');
}
afterEach(() => { vi.restoreAllMocks(); });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('the registry', () => {
  test('is the art module, then the maps module, with every operation named once', () => {
    expect(OPS).toEqual([...ART_OPS, ...MAP_OPS]);
    expect(ART_OPS.every(op => op.module === 'art') && MAP_OPS.every(op => op.module === 'maps')).toBe(true);
    expect(new Set(OPS.map(op => op.name)).size).toBe(OPS.length);
    expect(new Set(OPS.map(op => wordsOf(op).join(' '))).size).toBe(OPS.length);
  });

  test('every operation is on every surface, or names why it is not (CLI, MCP, Python)', () => {
    const bad: string[] = [];
    for (const op of OPS) {
      expect(op.summary.trim(), `${op.name} summary`).not.toBe('');
      for (const [surface, s] of [['cli', op.cli], ['mcp', op.mcp], ['python', op.python]] as const) {
        if (isExcluded(s) && s.exclude.trim().length < 6) bad.push(`${op.name}: ${surface} is excluded without a reason`);
      }
      if (isExcluded(op.cli) && !isExcluded(op.python)) bad.push(`${op.name}: Python follows the CLI, so it needs the CLI's reason too`);
    }
    expect(bad).toEqual([]);
  });

  test('no two operations share an MCP tool name, a Python method name or a flag, and none is a keyword clash', () => {
    const tools = OPS.filter(op => mcpOf(op)).map(mcpName), py = OPS.filter(op => cliOf(op) && !isExcluded(op.python)).map(pyName);
    expect(new Set(tools).size, 'MCP names').toBe(tools.length);
    expect(new Set(py).size, 'Python names').toBe(py.length);
    for (const op of OPS) {
      const flags = Object.entries(op.params).filter(([, par]) => par.cli !== false && !par.positional).map(([k, par]) => par.flag ?? `--${k.replace(/_/g, '-')}`);
      expect(new Set(flags).size, `${op.name}: flags`).toBe(flags.length);
      const mcp = Object.keys(op.params).filter(k => op.params[k].mcp !== false);
      expect(new Set(mcp).size, `${op.name}: MCP arguments`).toBe(mcp.length);
    }
  });
});

describe('the MCP server', () => {
  test('lists exactly the registry\'s MCP operations, in registry order', async () => {
    const r = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))!.result as { tools: { name: string; description: string; inputSchema: { required?: string[] } }[] };
    const ops = OPS.filter(op => mcpOf(op));
    expect(r.tools.map(t => t.name)).toEqual(ops.map(mcpName));
    expect(r.tools.map(t => t.description)).toEqual(ops.map(op => op.description ?? op.summary));
    for (const t of r.tools) expect(t.description.trim(), t.name).not.toBe('');
  });
});

describe('the command line', () => {
  test('every CLI operation resolves to itself, and its usage lines are in `artgen --help`', async () => {
    const help = await printed(() => main(['--help']));
    for (const op of OPS) {
      if (!cliOf(op)) continue;
      expect(findOp(OPS, wordsOf(op))?.name, op.name).toBe(op.name);
      for (const line of usageLines(op)) expect(help, op.name).toContain(line);
    }
    expect(help.split('\n').filter(l => l.startsWith('       artgen ')).length).toBeGreaterThan(OPS.length / 2);
    expect(await printed(() => main([]))).toBe(help);
  });

  test('every operation answers `<command> --help` with its summary', async () => {
    for (const op of OPS) {
      if (!cliOf(op)) continue;
      const text = await printed(() => main([...wordsOf(op), '--help']));
      expect(text, op.name).toContain(op.summary);
    }
  });

  test('a flag or an argument an operation does not have is refused', async () => {
    await expect(main(['status', '--nonsense'])).rejects.toThrow(/artgen status: unknown flag --nonsense/);
    await expect(main(['conformance', 'a', 'b'])).rejects.toThrow(/artgen conformance: unexpected argument b/);
    await expect(main(['render'])).rejects.toThrow(/<asset> is required/);
    expect(await main(['nonsense'])).toBe(1);
  });

  test('no command is dispatched outside the registry', () => {
    const src = readFileSync(new URL('packages/artgen-cli/src/cli.ts', REPO), 'utf8');
    const branches = [...src.matchAll(/\bcmd === '([^']+)'/g)].map(m => m[1]);
    expect(branches.sort()).toEqual(['--help', '--version', '-h', 'help', 'version']);
    expect(src).toContain('runCli(OPS');
  });
});

describe('the maps-only bundle', () => {
  test('lists the map operations in `--help`', async () => {
    const help = await printed(() => mapsMain(['--help']));
    for (const op of MAP_OPS) for (const line of usageLines(op)) expect(help, op.name).toContain(line);
  });

  test('answers no art operation', async () => {
    for (const op of ART_OPS) await expect(mapsMain(wordsOf(op)), op.name).rejects.toThrow(/not a command here/);
    for (const op of MAP_OPS) expect(findOp(MAP_OPS, wordsOf(op))?.name, op.name).toBe(op.name);
    for (const op of ART_OPS) expect(findOp(MAP_OPS, wordsOf(op)), op.name).toBeUndefined();
  });
});

describe('the generated files', () => {
  test('python/artgen/src/artgen/_ops.py is what `npm run gen:ops` writes', () => {
    expect(read('python/artgen/src/artgen/_ops.py')).toBe(pythonOps(OPS));
  });
  test('docs/OPERATIONS.md is what `npm run gen:ops` writes', () => {
    expect(read('docs/OPERATIONS.md')).toBe(operationsDoc(OPS));
  });
  test('every CLI operation has a Python method but `bench`, and the reference lists every operation', () => {
    const py = read('python/artgen/src/artgen/_ops.py'), doc = read('docs/OPERATIONS.md');
    for (const op of OPS) {
      expect(doc, op.name).toContain(`| \`${op.name}\` |`);
      if (cliOf(op) && !isExcluded(op.python)) expect(py, op.name).toContain(`    def ${pyName(op)}(`);
    }
    expect(py).not.toContain('def bench(');
  });
});
