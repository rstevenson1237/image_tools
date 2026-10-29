// Package-boundary lint (docs/TOOLING-PLAN.md §6, phase R1). Each package is one layer, and a file may import only
// from the layers below it:
//
//   interfaces (cli, mcp, python, web)  →  anything
//   artgen (artgen-core)                →  scene, workflow, primitives
//   mapgen, imagekit, workflow, scene   →  primitives   (mapgen also gets workflow from R5)
//   primitives, runtime                 →  nothing
//
// artgen-core is both the artgen layer and the facade that re-exports the lower packages for existing imports. Its
// `index.ts` and `maps.ts` are the facade and sit outside the layers; everything else under `src/` is the artgen layer.
// The workflow package arrives in R5; until then the ledger and status logic stay in the artgen layer.
//
//   node scripts/check-boundaries.mjs            list violations (exit 0)
//   node scripts/check-boundaries.mjs --strict   exit 1 on any violation (CI)
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
// Not layered: the facade re-exports every layer (§6), and the bench drives the whole pipeline.
const EXEMPT = [CORE + 'index.ts', CORE + 'maps.ts', 'packages/artgen-core/bench/'];
// First match wins. Paths are repo-relative with `/`.
const LAYERS = [
  ['runtime', ['packages/artgen-runtime/']],
  ['primitives', ['packages/artgen-primitives/']],
  ['scene', ['packages/artgen-scene/']],
  ['mapgen', ['packages/artgen-mapgen/']],
  ['artgen', [CORE]],
  ['interface', ['packages/artgen-cli/', 'packages/artgen-mcp/', 'packages/artgen-dist/', 'src/', 'python/']],
];
/** The layer a bare package specifier belongs to. `artgen-core` is the facade: a layer must not import it. */
const PACKAGE_LAYER = { 'artgen-primitives': 'primitives', 'artgen-scene': 'scene', 'artgen-mapgen': 'mapgen', 'artgen-runtime': 'runtime' };

/** Test files that import the facade on purpose. */
const FACADE_TESTS = [
  // checks that the dependency-free runtime's manifest type accepts what artgen-core writes
  'packages/artgen-runtime/src/runtime.test.ts',
];

export const layerOf = file => {
  if (EXEMPT.some(p => file.startsWith(p))) return undefined;
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
        } else if (PACKAGE_LAYER[spec.split('/')[0]]) to = PACKAGE_LAYER[spec.split('/')[0]];
        else if (/^artgen-(core|cli|mcp)\b/.test(spec)) to = 'facade';
        else continue;
        if (!to || to === from) continue;
        if (to === 'facade' && FACADE_TESTS.includes(rel(file))) continue;
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
