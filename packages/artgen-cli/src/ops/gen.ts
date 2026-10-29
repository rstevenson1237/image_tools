/**
 * What the registry generates (docs/OPERATION-REGISTRY.md §5): the Python client's methods (`python/artgen/src/artgen/_ops.py`)
 * and the operations reference (`docs/OPERATIONS.md`). Both are plain text made from the declarations; `gen-bin.ts` writes them
 * (`npm run gen:ops`) and the parity test fails when a file on disk differs from what these return. Imports nothing from Node.
 */
import { cliOf, flagOf, isExcluded, mcpName, mcpOf, wordsOf, type OpDef, type Param } from './registry.ts';

const PY_KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);
/** The Python name of a parameter: a keyword gets a trailing underscore (`from` → `from_`). */
export const pyParam = (key: string): string => (PY_KEYWORDS.has(key) ? `${key}_` : key);
/** The Python method name of an operation (`brief.add` → `brief_add`). */
export const pyName = (op: OpDef): string => (isExcluded(op.python) ? '' : op.python.name ?? op.name.replace(/[.-]/g, '_'));

/** How `_op()` writes a keyword on the command line: the value kind, or `switch`/`onoff`/`either` for a boolean. */
const pyKind = (par: Param): string =>
  par.kind === 'boolean' ? par.style ?? 'switch' : par.multi ? 'multi' : par.repeat ? 'repeat' : par.kind === 'list' || par.kind === 'points' || par.kind === 'size' || par.kind === 'json' ? par.kind : 'value';

function pyHint(par: Param): string {
  const one = ((): string => {
    switch (par.kind) {
      case 'string': return par.schema?.type === 'number' ? 'float' : 'str';
      case 'number': return 'float';
      case 'integer': return 'int';
      case 'boolean': return 'bool';
      case 'enum': return `Literal[${par.values!.map(v => JSON.stringify(v)).join(', ')}]`;
      case 'list': return `Sequence[${par.item === 'number' ? 'float' : 'str'}]`;
      case 'points': return 'Sequence[float]';
      case 'size': return 'Union[str, Sequence[float]]';
      case 'json': return 'Any';
    }
  })();
  return par.repeat || par.multi ? `Sequence[${one}]` : one;
}

const q = (s: string) => JSON.stringify(s);
const docOf = (s: string) => s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');

/** The Python name of each parameter: positionals keep their key; a flag is named for the flag in snake case (`--hue-shift` → `hue_shift`, `--file` for the key `path` → `file`), or for its key when that name is taken. */
function pyNames(params: [string, Param][]): Record<string, string> {
  const out: Record<string, string> = {}, used = new Set(params.filter(([, par]) => par.positional).map(([k]) => pyParam(k)));
  for (const [k, par] of params) if (par.positional) out[k] = pyParam(k);
  for (const [k, par] of params.filter(([, par]) => !par.positional)) {
    const flagName = par.flag ? pyParam(par.flag.replace(/^--/, '').replace(/-/g, '_')) : pyParam(k);
    out[k] = used.has(flagName) ? pyParam(k) : flagName;
    if (used.has(out[k])) throw new Error(`two parameters of an operation are called ${out[k]} in Python (${k})`);
    used.add(out[k]);
  }
  return out;
}

interface PyOp { op: OpDef; name: string; words: string[]; pos: [string, Param][]; flags: [string, Param][]; py: Record<string, string> }
function pyOps(ops: readonly OpDef[]): PyOp[] {
  return ops.filter(op => cliOf(op) && !isExcluded(op.python)).map(op => {
    const params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
    return { op, name: pyName(op), words: wordsOf(op), pos: params.filter(([, par]) => par.positional), flags: params.filter(([, par]) => !par.positional), py: pyNames(params) };
  });
}

function method({ op, name, words, pos, flags, py }: PyOp): string {
  // a positional is required only before the first optional one, and not when `--file` can stand in for the id
  const pathMode = op.params.path?.flag === '--file';
  let seenOptional = false;
  const args = pos.map(([k, par]) => {
    if (par.positional === 'rest') return `*${py[k]}: ${pyHint({ ...par, kind: 'string' })}`;
    const need = !!par.required && !pathMode && !seenOptional;
    if (!need) seenOptional = true;
    return need ? `${py[k]}: ${pyHint(par)}` : `${py[k]}: Optional[${pyHint(par)}] = None`;
  });
  const kw = flags.map(([k, par]) => `${py[k]}: Optional[${pyHint(par)}] = None`);
  const hasRest = pos.some(([, par]) => par.positional === 'rest');
  const sig = ['self', ...args, ...(kw.length && !hasRest ? ['*'] : []), ...kw].join(', ');
  const posList = pos.map(([k, par]) => (par.positional === 'rest' ? `*${py[k]}` : py[k])).join(', ');
  const flagDict = flags.map(([k]) => `${q(py[k])}: ${py[k]}`).join(', ');
  return `    def ${name}(${sig}) -> "Result":\n        """${docOf(op.summary)} (artgen ${words.join(' ')})"""\n        return self._op(${q(op.name)}, [${posList}], {${flagDict}})\n`;
}

/** `python/artgen/src/artgen/_ops.py`: the `_OPS` table `_op()` reads and the `Ops` mixin with one method per CLI operation. */
export function pythonOps(ops: readonly OpDef[]): string {
  const list = pyOps(ops);
  return [
    '# Generated by `npm run gen:ops` from packages/artgen-cli/src/ops. Do not edit.',
    '"""One method per artgen command, made from the operation registry (docs/OPERATION-REGISTRY.md).',
    '',
    'A method takes the command\'s positional arguments, then its flags as keywords (snake case, all optional); it',
    'runs ``artgen <command> --json`` through ``Artgen._op`` and returns what the hand-written methods return.',
    '``Artgen`` inherits this class; a method it writes itself (``render``, ``review``, ``texture``, …) wins.',
    '"""',
    'from __future__ import annotations',
    '',
    'from typing import TYPE_CHECKING, Any, Literal, Mapping, Optional, Sequence, Union',
    '',
    'if TYPE_CHECKING:',
    '    from .client import Result',
    '',
    '#: operation -> (command words, positional keys (``*`` = every remaining word), {keyword: (flag, kind)})',
    '_OPS: dict[str, tuple[tuple[str, ...], tuple[str, ...], dict[str, tuple[str, str]]]] = {',
    ...list.map(({ op, words, pos, flags, py }) => {
      const tup = (xs: string[]) => `(${xs.join(', ')}${xs.length === 1 ? ',' : ''})`;
      const posKeys = tup(pos.map(([k, par]) => q((par.positional === 'rest' ? '*' : '') + py[k])));
      const flagTable = flags.map(([k, par]) => `${q(py[k])}: (${q(flagOf(k, par))}, ${q(pyKind(par))})`).join(', ');
      return `    ${q(op.name)}: (${tup(words.map(q))}, ${posKeys}, {${flagTable}}),`;
    }),
    '}',
    '',
    '',
    'class Ops:',
    '    """The generated methods (see the module docstring)."""',
    '',
    '    def _op(self, name: str, positionals: Sequence[Any], flags: Mapping[str, Any]) -> Any:  # defined by Artgen',
    '        raise NotImplementedError',
    '',
    ...list.map(method),
  ].join('\n').replace(/\n+$/, '\n');
}

// ---- docs/OPERATIONS.md
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const MODULES: Record<string, string> = { art: 'Pixel-art module', maps: 'Maps module', core: 'Core module' };

/** `artgen map render <id> [flags]`: the command, its positional arguments and whether it takes flags. */
function cliForm(op: OpDef): string {
  const params = Object.entries(op.params).filter(([, par]) => par.cli !== false);
  const pos = params.filter(([, par]) => par.positional).map(([k, par]) => (par.required ? `<${k}>` : `[${k}]`) + (par.positional === 'rest' ? '…' : ''));
  return `artgen ${[...wordsOf(op), ...pos].join(' ')}${params.some(([, par]) => !par.positional) ? ' [flags]' : ''}`;
}

/** `docs/OPERATIONS.md`: one table per module, one row per operation. */
export function operationsDoc(ops: readonly OpDef[]): string {
  const out = [
    '# Operations',
    '',
    'Generated by `npm run gen:ops` from `packages/artgen-cli/src/ops`; do not edit. The design is [`OPERATION-REGISTRY.md`](OPERATION-REGISTRY.md).',
  ];
  for (const [module, title] of Object.entries(MODULES)) {
    const rows = ops.filter(op => op.module === module);
    if (!rows.length) continue;
    out.push('', `## ${title}`, '', '| Operation | Effect | CLI | MCP tool | Python | Summary |', '| --- | --- | --- | --- | --- | --- |');
    for (const op of rows) {
      const mcp = mcpOf(op) ? `\`${mcpName(op)}\`` : `not a tool: ${isExcluded(op.mcp) ? op.mcp.exclude : ''}`;
      const py = isExcluded(op.python) ? `none: ${op.python.exclude}` : `\`${pyName(op)}()\``;
      const cli = isExcluded(op.cli) ? `none: ${op.cli.exclude}` : `\`${cliForm(op)}\``;
      out.push(`| \`${op.name}\` | ${op.effect} | ${cell(cli)} | ${cell(mcp)} | ${cell(py)} | ${cell(op.summary)} |`);
    }
  }
  return out.join('\n') + '\n';
}
