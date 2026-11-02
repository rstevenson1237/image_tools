/**
 * `artgen metrics export` and `metrics pool` (docs/TOOLING-PLAN.md §5, R4; docs/WORKFLOW.md §9, R5). The export is what one repo
 * contributes to the pool: counts and ratios from the ledger (per generator: pixel art and each kind of map; for art also assets,
 * passes, tokens, minutes, scores, gate failures per kind), the artgen version and the installed modules. No images, no ids, no prose,
 * no paths: the person reads the file before it is shared. The pool puts exports from several repos side by side per artgen version,
 * so a release can be judged on whether it made the work cheaper. This file is in the core module (the maps-only bundle has it); the
 * art numbers come from `Ctx.artMetrics` (`art-metrics.ts`), which only the art module's contexts provide.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { generatorMetrics, METRICS_SCHEMA, poolExports, poolMarkdown, SUBJECT_KINDS, subjectKey, type ArtMetrics, type MetricsExport, type Pool, type VersionPool } from 'artgen-core/maps';
import type { Project } from '../projectfs.ts';
import { VERSION } from '../version.ts';
import { listSubjectIds, readLedger } from '../workflow.ts';


export { METRICS_SCHEMA };
export type { ArtMetrics, MetricsExport };

/** The art numbers of a project (`Ctx.artMetrics`): only the art module has them. */
export type ArtMetricsOf = (p: Project) => ArtMetrics;

function modulesOf(root: string): Record<string, string> {
  try { return JSON.parse(readFileSync(join(root, 'tools', 'artgen', 'MANIFEST.json'), 'utf8')).modules ?? {}; } catch { return {}; }
}

/** The numbers one repo exports. `name` is how it appears in the pool; `art` gives the pixel-art numbers (the art module's). */
export function metricsOf(p: Project, o: { name?: string; now?: Date; art?: ArtMetricsOf } = {}): MetricsExport {
  const art = o.art?.(p), { generators: artGenerators, ...artFields } = art ?? ({} as Partial<ArtMetrics>);
  const subjects = SUBJECT_KINDS.flatMap(kind => listSubjectIds(p, kind).map(id => ({ generator: kind as string, key: subjectKey(kind, id) })));
  const count = (kind: (typeof SUBJECT_KINDS)[number]) => subjects.filter(s => s.generator === kind).length;
  const generators = { ...artGenerators, ...generatorMetrics(readLedger(p), subjects) };
  return {
    schema: METRICS_SCHEMA,
    repo: o.name ?? `repo-${createHash('sha256').update(basename(p.root)).digest('hex').slice(0, 8)}`,
    artgen: VERSION, modules: modulesOf(p.root), exported: (o.now ?? new Date()).toISOString().slice(0, 10),
    ...(artFields.assets && { assets: artFields.assets }),
    maps: { map: count('map'), dungeon: count('dungeon'), settlement: count('settlement') },
    ...(artFields.assets && { byKind: artFields.byKind, passes: artFields.passes, totals: artFields.totals, firstPassApproval: artFields.firstPassApproval, userRevisionRate: artFields.userRevisionRate, gateFailures: artFields.gateFailures, blind: artFields.blind, ...(artFields.gates && { gates: artFields.gates }), ...(artFields.firstInGameMinutes !== undefined && { firstInGameMinutes: artFields.firstInGameMinutes }) }),
    generators,
  };
}

/** Write `art/metrics/<artgen version>.json` (or `out`). */
export function exportMetrics(p: Project, o: { name?: string; out?: string; now?: Date; art?: ArtMetricsOf } = {}): { file: string; metrics: MetricsExport } {
  const metrics = metricsOf(p, o), file = resolve(o.out ?? join(p.art, 'metrics', `${metrics.artgen}.json`));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(metrics, null, 2) + '\n');
  return { file, metrics };
}

/** Every `*.json` export under the given files and folders. */
function exportsIn(paths: string[]): MetricsExport[] {
  const out: MetricsExport[] = [];
  const add = (f: string) => {
    let j: unknown;
    try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { throw new Error(`${f}: not JSON`); }
    const schema = (j as { schema?: number })?.schema;
    if ((schema !== 1 && schema !== METRICS_SCHEMA) || typeof (j as MetricsExport).repo !== 'string') throw new Error(`${f}: not an artgen metrics export (schema 1 or ${METRICS_SCHEMA})`);
    out.push(j as MetricsExport);
  };
  const walk = (x: string): void => {
    if (!existsSync(x)) throw new Error(`${x}: no such file or folder`);
    if (statSync(x).isDirectory()) for (const e of readdirSync(x).sort()) { const f = join(x, e); if (statSync(f).isDirectory() ? e !== 'node_modules' && e !== '.git' : e.endsWith('.json')) walk(f); } else add(x);
  };
  for (const x of paths) walk(x);
  return out;
}

/** Put exports from several repos side by side per artgen version, from files (`metrics pool <file|folder>…`). */
export const pool = (paths: string[]): Pool => poolExports(exportsIn(paths));
export { poolExports, poolMarkdown };
export type { Pool, VersionPool };
