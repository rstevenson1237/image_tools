// Records the numbers later phases have to beat (docs/TOOLING-PLAN.md §11, phase R0) in docs/metrics/baseline.json:
// ledger KPIs for the bench and the example game repos, build and test times, bundle sizes, and the boundary-lint
// count. Needs Node 22.18+ (it imports the TypeScript sources directly).
//
//   node scripts/metrics-baseline.mjs           refresh ledger KPIs, sizes, boundaries; keep the recorded timings
//   node scripts/metrics-baseline.mjs --time    also run and time the CI steps (about 5 minutes), then measure sizes
//   node scripts/metrics-baseline.mjs --stdout  print instead of writing
//
// Ledger numbers are deterministic. Timings are one run on one machine and vary by tens of percent: compare a later
// phase against them with that margin.
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { findViolations, summarize } from './check-boundaries.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
// The core engine imports with plain .ts specifiers, so Node runs it as is; the CLI does not (it relies on a bundler).
const { passRecords } = await import('../packages/artgen-core/src/w2/analytics.ts');
const { parseLedger } = await import('../packages/artgen-core/src/qa/ledger.ts');
const { parse: parseYaml } = await import('yaml');

const OUT = 'docs/metrics/baseline.json';
const args = process.argv.slice(2);

/** Where the ledgers live. `bench` ledgers were produced by scripted runs; `example` ones by the fixture game repos. */
const SOURCES = [
  { group: 'bench', dir: 'packages/artgen-core/bench/p6' },
  { group: 'bench', dir: 'packages/artgen-core/bench/pipeline' },
  { group: 'example', dir: 'examples/swamp-topdown' },
  { group: 'example', dir: 'examples/iso-dungeon' },
  { group: 'example', dir: 'examples/billboard-crawler' },
];

/** A project (art/ledger.jsonl + briefs.yaml) or a bench folder (ledger.jsonl beside asset dirs with brief.json). */
function ledgerSet(dir) {
  const art = existsSync(join(dir, 'art', 'ledger.jsonl')) ? join(dir, 'art') : dir;
  const ledger = parseLedger(readFileSync(join(art, 'ledger.jsonl'), 'utf8'));
  let briefs = [];
  if (existsSync(join(art, 'briefs.yaml'))) briefs = parseYaml(readFileSync(join(art, 'briefs.yaml'), 'utf8')) ?? [];
  else for (const d of readdirSync(art, { withFileTypes: true })) {
    const bj = join(art, d.name, 'brief.json');
    if (d.isDirectory() && existsSync(bj)) briefs.push({ id: d.name, ...JSON.parse(readFileSync(bj, 'utf8')) });
  }
  return { project: dir, ledger, metas: briefs.map(b => ({ id: b.id, kind: b.kind })) };
}

/** A pass longer than this is a pause between sessions, not work: it is left out of the minutes. */
const IDLE_GAP_MS = 30 * 60000;

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const mean = xs => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const sum = xs => xs.reduce((a, b) => a + b, 0);
const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length ? round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

/** One row per scored asset, and the gate/blind facts of one ledger set. */
function rowsOf(set, group) {
  const kindOf = new Map(set.metas.map(m => [m.id, m.kind]));
  const recs = passRecords(set.ledger);
  const approved = new Set(set.ledger.filter(e => e.type === 'approve' && e.asset !== 'direction').map(e => e.asset));
  const withFeedback = new Set(set.ledger.filter(e => e.type === 'feedback' && e.by === 'user' && e.asset !== 'direction').map(e => e.asset));
  const assets = [...new Set(recs.map(r => r.asset))].map(id => {
    const rs = recs.filter(r => r.asset === id);
    // wallMs is the time since the asset's previous record, so a pause between sessions shows up as one huge pass
    const walls = rs.filter(r => r.wallMs !== undefined && r.wallMs <= IDLE_GAP_MS);
    return {
      project: set.project, group, id, kind: kindOf.get(id) ?? 'unknown', passes: rs.length,
      tokens: sum(rs.map(r => r.outTokens + r.inTokens + r.imageTokens + r.agentIn)),
      minutes: round(sum(walls.map(r => r.wallMs)) / 60000), timed: walls.length > 0, idleGaps: rs.filter(r => r.wallMs > IDLE_GAP_MS).length,
      approved: approved.has(id), firstPass: approved.has(id) && !withFeedback.has(id),
    };
  });
  // gate result of the latest scored record per asset version
  const latest = new Map();
  for (const e of set.ledger) if (e.type === 'score' && !e.blind && e.version && e.asset !== 'direction' && e.conformance) latest.set(`${e.asset}\0${e.version}`, e);
  const gates = [...latest.values()].map(e => ({ pass: e.conformance.pass, checks: e.conformance.checks }));
  const own = new Map(), blind = [];
  for (const e of set.ledger) if (e.type === 'score' && !e.blind && typeof e.score === 'number' && e.asset !== 'direction') own.set(`${e.asset}\0${e.version}`, e);
  const blindLatest = new Map();
  for (const e of set.ledger) if (e.type === 'score' && e.blind && typeof e.score === 'number') blindLatest.set(`${e.asset}\0${e.version}`, e.score);
  for (const [k, score] of blindLatest) if (own.has(k)) blind.push({ blind: score, own: own.get(k).score });
  const reviewers = {};
  for (const e of own.values()) reviewers[e.reviewer ?? 'unrecorded'] = (reviewers[e.reviewer ?? 'unrecorded'] ?? 0) + 1;
  return { assets, gates, blind, reviewers };
}

/** The §11 KPIs over any number of ledger sets. */
function kpis(parts) {
  const assets = parts.flatMap(p => p.assets), gates = parts.flatMap(p => p.gates), blind = parts.flatMap(p => p.blind);
  const timed = assets.filter(a => a.timed), approved = assets.filter(a => a.approved);
  const byKind = {};
  for (const a of assets) (byKind[a.kind] ??= []).push(a);
  const failByCheck = {}, flagByCheck = {};
  for (const g of gates) for (const c of g.checks) {
    if (c.status === 'fail') failByCheck[c.id] = (failByCheck[c.id] ?? 0) + 1;
    if (c.status === 'flag') flagByCheck[c.id] = (flagByCheck[c.id] ?? 0) + 1;
  }
  const sorted = o => Object.fromEntries(Object.entries(o).sort(([ka, a], [kb, b]) => b - a || ka.localeCompare(kb)));
  const reviewers = {};
  for (const p of parts) for (const [k, n] of Object.entries(p.reviewers)) reviewers[k] = (reviewers[k] ?? 0) + n;
  return {
    scoredAssets: assets.length,
    approvedAssets: approved.length,
    passesPerAsset: { mean: mean(assets.map(a => a.passes)), byKind: Object.fromEntries(Object.entries(byKind).sort(([a], [b]) => a.localeCompare(b)).map(([k, as]) => [k, { assets: as.length, mean: mean(as.map(a => a.passes)) }])) },
    tokensPerAsset: { mean: mean(assets.map(a => a.tokens)), basis: 'code + measured input + review images + agent input, per scored asset' },
    minutesPerAsset: { mean: mean(timed.map(a => a.minutes)), median: median(timed.map(a => a.minutes)), assetsTimed: timed.length, idleGapsLeftOut: sum(assets.map(a => a.idleGaps)), basis: 'sum of recorded pass wall time (generation and render), passes over 30 minutes left out as idle gaps; not time spent by a person' },
    firstPassApprovalRate: approved.length ? { rate: round(approved.filter(a => a.firstPass).length / approved.length), approvedAssets: approved.length } : null,
    blindScore: blind.length ? { n: blind.length, meanBlind: mean(blind.map(b => b.blind)), meanOwn: mean(blind.map(b => b.own)), meanGap: mean(blind.map(b => round(b.own - b.blind))) } : null,
    scoredBy: sorted(reviewers),
    gate: { versions: gates.length, versionsFailing: gates.filter(g => !g.pass).length, failByCheck: sorted(failByCheck), flagByCheck: sorted(flagByCheck) },
  };
}

function ledgerSection() {
  const sets = SOURCES.map(s => ({ ...s, set: ledgerSet(s.dir) })).map(s => ({ ...s, parts: rowsOf(s.set, s.group) }));
  const section = { sources: {}, bench: kpis(sets.filter(s => s.group === 'bench').map(s => s.parts)), examples: kpis(sets.filter(s => s.group === 'example').map(s => s.parts)), pooled: kpis(sets.map(s => s.parts)) };
  for (const s of sets) section.sources[s.dir] = { group: s.group, ledgerLines: s.set.ledger.length, ...kpis([s.parts]) };
  return section;
}

const bytes = f => statSync(f).size;
const gz = f => gzipSync(readFileSync(f)).length;
const dirBytes = d => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? dirBytes(join(d, e.name)) : bytes(join(d, e.name))), 0) : null);

function sizesSection() {
  const sizes = { note: 'bytes; run `npm run build` and `npm run build:dist` first' };
  const out = 'packages/artgen-dist/out';
  sizes.dist = { total: dirBytes(out), files: {} };
  for (const f of ['dist/tools/artgen/artgen.js', 'dist/tools/artgen/artgen-mcp.js', 'dist/tools/artgen/resvg.wasm', 'maps/artgen-maps.js']) {
    const p = join(out, f);
    sizes.dist.files[f] = existsSync(p) ? { bytes: bytes(p), ...(f.endsWith('.js') && { gzip: gz(p) }) } : null;
  }
  const assets = 'dist/assets';
  if (existsSync(assets)) {
    const js = readdirSync(assets).filter(n => n.endsWith('.js')).map(n => join(assets, n));
    sizes.web = {
      total: dirBytes('dist'), assets: dirBytes(assets), vendor: dirBytes('dist/vendor'),
      jsFiles: js.length, jsBytes: sum(js.map(bytes)), jsGzip: sum(js.map(gz)),
      note: 'vendor is the 10 MB OpenCV asset R5b removes; compare the rest',
    };
  } else sizes.web = null;
  return sizes;
}

function run(cmd, argv) {
  const t = performance.now(), r = spawnSync(cmd, argv, { stdio: 'ignore', cwd: root });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed (exit ${r.status})`);
  return round((performance.now() - t) / 1000, 1);
}

function timings() {
  const workspaces = JSON.parse(readFileSync('package.json', 'utf8')).workspaces
    .flatMap(w => readdirSync(w.replace('/*', '')).map(n => `${w.replace('/*', '')}/${n}`))
    .filter(w => existsSync(join(w, 'package.json')));
  const out = { checkApp: run('npm', ['run', 'check']), testApp: run('npm', ['test']), checkPackages: run('npm', ['run', 'check:packages']), testPackages: {}, buildWeb: run('npm', ['run', 'build']), buildDist: run('npm', ['run', 'build:dist']) };
  for (const w of workspaces) if (JSON.parse(readFileSync(join(w, 'package.json'), 'utf8')).scripts?.test) out.testPackages[w] = run('npm', ['test', '-w', w]);
  out.testPackagesTotal = round(sum(Object.values(out.testPackages)), 1);
  return { seconds: out, machine: { node: process.version, cpus: cpus().length, platform: process.platform }, note: 'one run; expect tens of percent of variation' };
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const timed = args.includes('--time') ? timings() : previous.timings ?? null;
const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

const fixtureCases = existsSync('packages/artgen-cli/fixtures')
  ? readdirSync('packages/artgen-cli/fixtures', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => ({ consumer: d.name, cases: readdirSync(join('packages/artgen-cli/fixtures', d.name), { withFileTypes: true }).filter(c => c.isDirectory()).length }))
  : [];
const mcpTools = (readFileSync('packages/artgen-mcp/src/server.ts', 'utf8').match(/^\s*name: '/gm) ?? []).length;

const baseline = {
  schema: 1,
  note: 'R0 baseline (docs/TOOLING-PLAN.md §10-11). Later phases are compared against this file. Refresh with scripts/metrics-baseline.mjs.',
  measuredAtCommit: git,
  date: new Date().toISOString().slice(0, 10),
  ledgerKpis: ledgerSection(),
  timings: timed,
  sizes: sizesSection(),
  boundaries: summarize(findViolations()),
  fixtures: { consumers: fixtureCases, total: sum(fixtureCases.map(f => f.cases)) },
  interfaces: { mcpTools },
  notReportedYet: {
    timeToFirstPlaceholder: 'needs the placeholder stage (R6a)',
    consumerLag: 'needs modules in MANIFEST.json and pooled metrics (R3, R4)',
    regressionsCaughtBeforeRelease: 'needs consumer CI before release (R4)',
    operationsMissingFromAnInterface: 'needs the operation registry and parity test (R2); mcpTools above is the count to cover',
  },
  caveats: [
    'Approvals in the example repos were given by a simulated user (see their ledger notes), so first-pass approval is a placeholder until real runs are recorded.',
    'The bench ledgers hold scores and gate results but no approvals: approval-based KPIs come from the examples only.',
    'Most scores were self-scored (see scoredBy); blindScore shows the gap where a blind re-score exists.',
  ],
};

const text = JSON.stringify(baseline, null, 2) + '\n';
if (args.includes('--stdout')) process.stdout.write(text);
else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
