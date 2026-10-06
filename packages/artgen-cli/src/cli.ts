#!/usr/bin/env node
/**
 * artgen CLI (P1b subset; the full command set lands in P2).
 *   artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>]
 *   artgen bench --update-golden
 *   artgen direction validate <file>
 *   artgen pass status|next <assetDir>             pipeline state (v1 → v2 → v3 → finish → ready)
 *   artgen render <assetDir> [--version v] [--variant n] [--stages]
 *   artgen review <assetDir> [--version v]         review sheet: reference, best, v(n−1), v(n)
 *   artgen score <assetDir> <version> <0-10> [--note "…"]
 *   artgen variants <assetDir> [--version v] [--n 8]
 *   artgen report <dir> [--out REPORT.md] [--title "…"]
 * Asset commands take --direction <file|bench name> and --ledger <file> overrides; add --json for JSON output.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grid, validateDirection } from 'artgen-core';
import { openAsset, passState, renderVersion, reviewVersion, scoreVersion, variantsSheet, versionsIn, writeRender } from './asset.ts';
import { resolveDirection, updateGolden, writeBench } from './bench.ts';
import { writeGrid } from './node.ts';
import { report } from './report.ts';

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const USAGE = `usage: artgen bench [--direction benchmark|alt|<file>] [--out <dir>] [--stages] [--ledger <file>] [--update-golden]
       artgen direction validate <file>
       artgen pass status|next <assetDir>
       artgen render <assetDir> [--version base.vN|finish.vM] [--variant n] [--stages]
       artgen review <assetDir> [--version v]
       artgen score <assetDir> <version> <score> [--note "..."]
       artgen variants <assetDir> [--version v] [--n 8]
       artgen report <dir> [--out REPORT.md] [--title "..."]`;

export async function main(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  const json = args.includes('--json'), print = (human: string, data: unknown) => console.log(json ? JSON.stringify(data, null, 2) : human);
  const asset = (p: string) => openAsset(p, { direction: flag(args, '--direction'), ledger: flag(args, '--ledger') });
  const latest = (p: string) => { const vs = versionsIn(asset(p)); if (!vs.length) throw new Error(`${p}: no base.vN.js yet`); return vs[vs.length - 1]; };

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
  if (cmd === 'pass' && (sub === 'status' || sub === 'next') && rest[0]) {
    const st = await passState(asset(rest[0]));
    if (sub === 'next') { print(`${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`, st.next); return 0; }
    const lines = st.rows.map(r => `  ${r.pass.padEnd(4)} ${r.version.padEnd(10)} ${r.score === undefined ? 'unscored' : `score ${r.score}`}${r.gate === undefined ? '' : r.gate ? ' gate pass' : ' gate FAIL'}${r.base ? ` (on ${r.base})` : ''}`);
    print([`${st.asset}${st.best ? ` — best base ${st.best.version} (${st.best.score})` : ''}`, ...lines, ...(st.stale?.length ? ['  FINISH-STALE:', ...st.stale.map(s => `    ${s}`)] : []), `next: ${st.next.action} ${'version' in st.next ? st.next.version : ''} — ${st.next.why}`].join('\n'), st);
    return 0;
  }
  if (cmd === 'render' && sub) {
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), stages = args.includes('--stages') ? new Map<string, Grid>() : undefined;
    const variant = +(flag(args, '--variant') ?? 0);
    const r = await renderVersion(a, version, { variant, stages });
    const files = writeRender(a, r, variant ? join(a.path, 'out', `variant-${variant}`) : undefined);
    if (stages) for (const [k, g] of stages) writeGrid(join(a.path, 'out', 'stages', version, `${k.replace(/\//g, '_')}.png`), g);
    print(`${a.brief.id} ${version}: ${r.report.pass ? 'gate pass' : 'gate FAIL'}  ${r.report.checks.map(c => `${c.id}:${c.status}`).join(' ')}\n  ${files.join('\n  ')}${r.stale?.length ? `\n  FINISH-STALE: ${r.stale.join('; ')}` : ''}`,
      { version, pass: r.report.pass, checks: r.report.checks, metrics: r.report.metrics, files, stale: r.stale });
    return r.report.pass ? 0 : 1;
  }
  if (cmd === 'review' && sub) {
    const a = asset(sub), version = flag(args, '--version') ?? latest(sub), r = await reviewVersion(a, version);
    print(`review sheet ${r.path} (~${r.tokens} image tokens); gate ${r.render.report.pass ? 'pass' : 'FAIL'}`, { sheet: r.path, tokens: r.tokens, pass: r.render.report.pass, checks: r.render.report.checks });
    return 0;
  }
  if (cmd === 'score' && sub && rest[0] && rest[1]) {
    const score = +rest[1];
    if (!(score >= 0 && score <= 10)) throw new Error('score must be 0–10');
    const e = await scoreVersion(asset(sub), rest[0], score, flag(args, '--note') ?? '');
    print(`scored ${e.asset} ${e.version} (${e.pass}) ${score}; gate ${e.conformance?.pass ? 'pass' : 'FAIL'}`, e);
    return 0;
  }
  if (cmd === 'variants' && sub) {
    const r = await variantsSheet(asset(sub), flag(args, '--version') ?? latest(sub), +(flag(args, '--n') ?? 8));
    print(`${r.path}: ${r.distinct} distinct of ${r.hashes.length}`, r);
    return 0;
  }
  if (cmd === 'report' && sub) {
    const r = await report(sub, { out: flag(args, '--out'), title: flag(args, '--title') });
    if (!flag(args, '--out')) console.log(r.markdown);
    return r.summaries.every(s => s.met) ? 0 : 1;
  }
  console.log(USAGE);
  return cmd ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
