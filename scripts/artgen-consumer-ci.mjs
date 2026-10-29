#!/usr/bin/env node
// Consumer CI (docs/TOOLING-PLAN.md §5, R4): every consumer fixture (packages/artgen-cli/fixtures/<consumer>/<case>/) run against the
// candidate BUILD, the bundles a game repo would be installed with, not the sources. A fixture that stops passing stops the release.
//
//   node scripts/artgen-consumer-ci.mjs [--dist packages/artgen-dist/out] [--fixtures dir]
//
// What each case is held to here (the facts each case.md states are held by the fixture tests, from the sources, in `npm test`):
//   - a map, dungeon or settlement: `check --file` exits 0, or non-zero when case.md has a "Must go on failing" section; and when it
//     passes, `render --file` writes the same SVG twice;
//   - an asset (a reported bundle): `render` in a scratch project exits 0 or 1, never an error.
// The summary goes to the job summary of GitHub Actions when there is one.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUTS = { map: 'map.json', dungeon: 'dungeon.json', settlement: 'settlement.json' };

/** Every case under a fixtures folder: { consumer, name, dir, md }. */
export function casesIn(fixtures) {
  const out = [];
  for (const c of readdirSync(fixtures, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const k of readdirSync(join(fixtures, c.name), { withFileTypes: true }).filter(d => d.isDirectory())) {
      const dir = join(fixtures, c.name, k.name);
      if (existsSync(join(dir, 'case.md'))) out.push({ consumer: c.name, name: k.name, dir, md: readFileSync(join(dir, 'case.md'), 'utf8') });
    }
  }
  return out;
}

/**
 * Run the cases against the build in `dist` (the `out/` of artgen-dist, or any folder with `dist/tools/artgen/`).
 * Returns { results: [{ id, ok, detail }], failed }.
 */
export function runConsumerCi(dist, fixtures, node = process.execPath) {
  const tools = [join(dist, 'dist', 'tools', 'artgen'), join(dist, 'tools', 'artgen')].find(d => existsSync(join(d, 'artgen-maps.js')));
  if (!tools) throw new Error(`${dist}: no tools/artgen/artgen-maps.js — build the distribution first (npm run build:dist)`);
  const run = (cwd, script, args) => spawnSync(node, [join(tools, script), ...args], { cwd, encoding: 'utf8', timeout: 120_000 });
  const results = [];
  for (const c of casesIn(fixtures)) {
    const id = `${c.consumer}/${c.name}`, fail = detail => results.push({ id, ok: false, detail }), pass = detail => results.push({ id, ok: true, detail });
    const scratch = mkdtempSync(join(tmpdir(), 'artgen-consumer-ci-'));
    try {
      if (/^kind: asset$/m.test(c.md)) {
        // a reported asset bundle: rebuilt as a project, rendered by the full CLI
        if (!existsSync(join(tools, 'artgen.js'))) { pass('asset case: the build has no pixel-art CLI (maps only), skipped'); continue; }
        const init = run(scratch, 'artgen.js', ['init']);
        if (init.status !== 0) { fail(`init: ${init.stderr.trim()}`); continue; }
        for (const f of ['direction.json', 'briefs.yaml', 'artgen.config.json', 'ledger.jsonl']) if (existsSync(join(c.dir, f))) cpSync(join(c.dir, f), join(scratch, 'art', f));
        const at = c.md.match(/^asset: (\S+)$/m)?.[1];
        if (!at) { fail('case.md names no asset folder (asset: assets/<kind>/<id>)'); continue; }
        cpSync(join(c.dir, 'asset'), join(scratch, 'art', at), { recursive: true });
        const r = run(scratch, 'artgen.js', ['render', basename(at)]);
        r.status === 0 || r.status === 1 ? pass(`render exit ${r.status}`) : fail(`render exit ${r.status}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
        continue;
      }
      const kind = c.md.match(/^format: (map|dungeon|settlement) \d+$/m)?.[1];
      if (!kind) { fail('case.md has no "format: <kind> <version>" line'); continue; }
      const file = join(c.dir, INPUTS[kind]), mustFail = /^## Must go on failing/m.test(c.md);
      const check = run(c.dir, 'artgen-maps.js', [kind, 'check', '--file', file, '--json']);
      if (mustFail !== (check.status !== 0)) { fail(`check exit ${check.status}, but case.md says it must go on ${mustFail ? 'failing' : 'passing'}`); continue; }
      if (mustFail) { pass('check refuses it, as case.md says'); continue; }
      const svg = n => {
        const out = join(scratch, n);
        mkdirSync(out);
        const r = run(c.dir, 'artgen-maps.js', [kind, 'render', '--file', file, '--format', 'svg', '--out', out]);
        const fs = existsSync(out) ? readdirSync(out).filter(x => x.endsWith('.svg')).sort() : [];
        return { r, text: fs.length ? fs.map(f => readFileSync(join(out, f), 'utf8')).join('\n') : undefined };
      };
      const a = svg('a'), b = svg('b');
      if (a.r.status !== 0 || a.text === undefined) { fail(`render exit ${a.r.status}: ${(a.r.stderr || a.r.stdout).trim().split('\n')[0]}`); continue; }
      a.text === b.text ? pass('check passes; the render is the same twice') : fail('the render differs between two runs');
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  }
  return { results, failed: results.filter(r => !r.ok).length };
}

export function summary(r, dist) {
  return [`### Consumer fixtures against the build in \`${dist}\``, '', `${r.results.length - r.failed} of ${r.results.length} pass.`, '', '| case | result |', '|---|---|', ...r.results.map(x => `| ${x.id} | ${x.ok ? 'pass' : '**FAIL**'}: ${x.detail.replace(/\|/g, '/')} |`), ''].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const dist = resolve(arg('--dist') ?? join(ROOT, 'packages', 'artgen-dist', 'out')), fixtures = resolve(arg('--fixtures') ?? join(ROOT, 'packages', 'artgen-cli', 'fixtures'));
  try {
    const r = runConsumerCi(dist, fixtures), md = summary(r, dist);
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    process.exit(r.failed ? 1 : 0);
  } catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
}
