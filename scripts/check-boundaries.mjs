// Package-boundary lint (docs/TOOLING-PLAN.md §6, phase R0). Sorts source files into the planned layers and reports
// every relative import that points the wrong way:
//
//   interfaces (cli, mcp, python, web)  →  anything
//   artgen                              →  scene, workflow, primitives
//   mapgen, imagekit, workflow, scene   →  primitives   (mapgen also gets workflow from R5)
//   primitives, runtime                 →  nothing
//
// The packages don't exist yet, so the layers are told apart by path inside artgen-core (LAYERS below). R1 moves the
// files; this table then becomes "one package = one layer" and the lint passes `--strict` in CI.
//
//   node scripts/check-boundaries.mjs            list violations as warnings, exit 0 (R0)
//   node scripts/check-boundaries.mjs --strict   exit 1 on any violation (R1)
//   node scripts/check-boundaries.mjs --json     machine-readable summary
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Which layers a layer may import from (itself is always allowed). */
export const ALLOWED = {
  primitives: [],
  scene: ['primitives'],
  workflow: ['primitives'],
  artgen: ['scene', 'workflow', 'primitives'],
  mapgen: ['primitives'],
  imagekit: ['primitives'],
  runtime: [],
  interface: ['primitives', 'scene', 'workflow', 'artgen', 'mapgen', 'imagekit', 'runtime'],
};

const CORE = 'packages/artgen-core/src/';
// First match wins. Paths are repo-relative with `/`; a trailing `/` matches a directory.
const LAYERS = [
  ['runtime', ['packages/artgen-runtime/']],
  ['primitives', [CORE + 'lib/', CORE + 't2/geom', CORE + 't2/raster', CORE + 'format']],
  // ledger and status logic are the seed of the workflow package (§6)
  ['workflow', [CORE + 'qa/ledger', CORE + 'w2/status']],
  ['scene', [CORE + 't2/', CORE + 'voxel/', CORE + 'views/', CORE + 'anim/', CORE + 'fx/', CORE + 'tex/']],
  ['mapgen', [CORE + 'map/', CORE + 'dungeon/', CORE + 'settlement/', CORE + 'maps.']],
  ['artgen', [CORE + 'direction', CORE + 'pipeline', CORE + 'render', CORE + 'w1/', CORE + 'w2/', CORE + 'qa/']],
  ['interface', ['packages/artgen-cli/', 'packages/artgen-mcp/', 'packages/artgen-dist/', 'src/', 'python/']],
];
// Not layered: the facade re-exports every layer (§6), and the bench drives the whole pipeline. Test files are
// exempt too: they are not shipped, and integration tests reach across layers on purpose.
const EXEMPT = [CORE + 'index.ts', 'packages/artgen-core/bench/'];

export const layerOf = file => {
  if (EXEMPT.some(p => file.startsWith(p)) || /\.test\.[a-z]+$/.test(file)) return undefined;
  return LAYERS.find(([, prefixes]) => prefixes.some(p => file.startsWith(p)))?.[0];
};

const SOURCE = /\.(ts|mjs|js|svelte)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.git', 'vendor']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (SOURCE.test(name)) yield p;
  }
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const resolveImport = (from, spec) => {
  const base = resolve(dirname(from), spec);
  for (const c of [base, base + '.ts', join(base, 'index.ts'), base.replace(/\.js$/, '.ts')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return undefined;
};

/** Every relative import between layered files that the table forbids. */
export function findViolations(dir = root) {
  const out = [];
  const rel = f => relative(dir, f).split(sep).join('/');
  for (const dirName of ['packages', 'src']) {
    if (!existsSync(join(dir, dirName))) continue;
    for (const file of walk(join(dir, dirName))) {
      const from = layerOf(rel(file));
      if (!from || from === 'interface') continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(IMPORT)) {
        const spec = m[1] ?? m[2] ?? m[3];
        let to;
        if (spec.startsWith('.')) {
          const target = resolveImport(file, spec);
          if (!target) continue;
          if (rel(target) === CORE + 'index.ts') { out.push({ file: rel(file), line: lineOf(text, m), from, to: 'facade', spec }); continue; }
          to = layerOf(rel(target));
        } else if (/^artgen-(core|cli|mcp)\b/.test(spec)) to = 'facade';
        else continue;
        if (!to || to === from) continue;
        if (to === 'facade' || !ALLOWED[from].includes(to)) out.push({ file: rel(file), line: lineOf(text, m), from, to, spec });
      }
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

// the match may start on the newline (and blank lines) before the statement, so count to its first real character
const lineOf = (text, m) => text.slice(0, m.index + m[0].search(/\S/)).split('\n').length;

export function summarize(violations) {
  const byArrow = {};
  for (const v of violations) byArrow[`${v.from} -> ${v.to}`] = (byArrow[`${v.from} -> ${v.to}`] ?? 0) + 1;
  return { total: violations.length, byArrow: Object.fromEntries(Object.entries(byArrow).sort(([a], [b]) => a.localeCompare(b))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), violations = findViolations(), summary = summarize(violations);
  if (args.includes('--json')) console.log(JSON.stringify({ ...summary, violations }, null, 2));
  else {
    const annotate = !!process.env.GITHUB_ACTIONS;
    for (const v of violations) {
      const msg = `${v.from} must not import ${v.to}: '${v.spec}' (docs/TOOLING-PLAN.md §6)`;
      console.log(annotate ? `::warning file=${v.file},line=${v.line}::${msg}` : `${v.file}:${v.line}  ${msg}`);
    }
    console.log(violations.length ? `\n${summary.total} boundary violation(s):` : 'no boundary violations');
    for (const [arrow, n] of Object.entries(summary.byArrow)) console.log(`  ${arrow}: ${n}`);
  }
  process.exit(args.includes('--strict') && violations.length ? 1 : 0);
}
