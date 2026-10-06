#!/usr/bin/env node
/**
 * artgen CLI (P1 subset; the full command set lands in P2).
 *   artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>]
 *   artgen bench --update-golden
 *   artgen direction validate <file>
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateDirection } from 'artgen-core';
import { resolveDirection, updateGolden, writeBench } from './bench.ts';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  if (cmd === 'bench') {
    if (args.includes('--update-golden')) { console.log(JSON.stringify(await updateGolden(), null, 2)); return 0; }
    const dir = resolveDirection(flag(args, '--direction') ?? 'benchmark');
    const results = await writeBench(dir, flag(args, '--out') ?? 'artgen-out', { stages: args.includes('--stages'), ledger: flag(args, '--ledger') });
    return results.every(r => r.report.pass) ? 0 : 1;
  }
  if (cmd === 'direction' && sub === 'validate' && rest[0]) {
    const r = validateDirection(JSON.parse(readFileSync(rest[0], 'utf8')));
    console.log(r.ok ? `ok: ${r.direction!.id} v${r.direction!.version}` : r.errors.join('\n'));
    return r.ok ? 0 : 1;
  }
  console.log('usage: artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>] [--update-golden]\n       artgen direction validate <file>');
  return cmd ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
