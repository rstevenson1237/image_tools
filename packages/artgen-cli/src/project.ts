/**
 * Game-repo project layout (SPEC §3.2): `artgen init` scaffolds `art/`; every other command finds the project by
 * walking up from the working directory to the folder that holds `art/artgen.config.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface Project {
  /** Game repo root (the folder holding `art/`). */
  root: string;
  art: string;
}

export const CONFIG_FILE = 'artgen.config.json';

export function findProject(start = process.cwd()): Project | null {
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, 'art', CONFIG_FILE))) return { root: d, art: join(d, 'art') };
    if (dirname(d) === d) return null;
  }
}

export function requireProject(start?: string): Project {
  const p = findProject(start);
  if (!p) throw new Error('no artgen project here (art/artgen.config.json not found up the tree) — run `artgen init` in the game repo root');
  return p;
}

export interface BudgetCaps { revisionPasses?: number; extraAutonomousRevisions?: number; maxImageTokensPerAsset?: number }

export interface ProjectConfig {
  version: number;
  export: { packDir: string; runtimeDir: string; assetsTs: string; maxAtlas?: number; padding?: number };
  runtime: { adapters: string[] };
  /** Packs by name: `include` patterns over brief ids (`*`, `goblin*`) or kinds (`kind:tile`). */
  packs: Record<string, { include: string[] }>;
  budget: BudgetCaps & {
    maxSheetEdge?: number;
    maxUserIterations?: number;
    /** Per asset kind (`character: { revisionPasses: 4 }`). */
    perKind?: Record<string, BudgetCaps>;
    /** Per brief importance (hero / standard / filler). */
    tiers?: Record<string, BudgetCaps>;
  };
  /** Stage → model (and effort): `'default'` or `{ model, effort }`; stages run as subagents with that model. */
  models: Record<'base' | 'revise' | 'finish' | 'review', string | { model: string; effort?: string }>;
  gate: Record<string, unknown>;
}

/** Default `art/artgen.config.json` (export paths, runtime adapter, packs, budget, stage models — D19). */
export const DEFAULT_CONFIG: ProjectConfig = {
  version: 1,
  export: { packDir: 'public/assets', runtimeDir: 'src/art/runtime', assetsTs: 'src/art/assets.ts' },
  runtime: { adapters: ['canvas2d'] },
  packs: { main: { include: ['*'] } },
  budget: { revisionPasses: 3, maxSheetEdge: 1568, maxUserIterations: 3, extraAutonomousRevisions: 1, tiers: { hero: { revisionPasses: 4 }, filler: { revisionPasses: 2 } } },
  models: { base: 'default', revise: 'default', finish: 'default', review: 'default' },
  gate: {},
};

/** `art/direction.json` before W1 locks one: a draft placeholder the workflow replaces. */
export const EMPTY_DIRECTION = {
  id: 'untitled', version: 0, status: 'draft',
  theme: { pitch: '' },
  note: 'Not set yet. Run the art direction workflow (/artgen-direction, or `artgen direction candidates`) to create and lock one.',
};

const ART_GITIGNORE = `# artgen: renders are rebuilt from sources; keep approved sheets and W1 records
sheets/*
!sheets/approved/
**/out/
`;

/** True when a direction file is still the pre-W1 placeholder. */
export const isPlaceholderDirection = (d: unknown): boolean =>
  typeof d === 'object' && d !== null && (d as { status?: string }).status === 'draft' && !(d as { palette?: unknown }).palette;

/** Scaffold `art/` in `root`. Never overwrites an existing file; returns the files and folders it created. */
export function initProject(root: string): { project: Project; created: string[] } {
  const art = join(root, 'art'), created: string[] = [];
  const dir = (p: string) => { if (!existsSync(p)) { mkdirSync(p, { recursive: true }); created.push(p); } };
  const file = (p: string, text: string) => { if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); created.push(p); } };
  dir(art);
  file(join(art, 'direction.json'), JSON.stringify(EMPTY_DIRECTION, null, 2) + '\n');
  file(join(art, 'briefs.yaml'), '# Asset briefs (W2, SPEC §5.1). One entry per asset: id, kind, view, size, states, directions, anims, notes.\n[]\n');
  for (const d of ['assets', 'anchors', 'refs', 'candidates', 'probes', 'sheets']) dir(join(art, d));
  file(join(art, 'assets', '.gitkeep'), '');
  file(join(art, 'anchors', '.gitkeep'), '');
  file(join(art, 'refs', 'README.md'), 'Reference images for the art direction interview. `artgen palette extract art/refs/<image>.png` pulls a palette from one.\n');
  file(join(art, 'ledger.jsonl'), '');
  file(join(art, CONFIG_FILE), JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');
  file(join(art, '.gitignore'), ART_GITIGNORE);
  // asset sources are ESM (D17) whatever the game repo's own package.json says
  file(join(art, 'package.json'), JSON.stringify({ private: true, type: 'module', description: 'artgen asset sources (ESM)' }, null, 2) + '\n');
  return { project: { root, art }, created };
}

export const readJson = <T = unknown>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
export const writeJson = (p: string, v: unknown): void => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };

/** `art/artgen.config.json` merged over the defaults (sections shallow-merged, so older configs keep working). */
export function projectConfig(p: Project): ProjectConfig {
  const f = join(p.art, CONFIG_FILE), raw = existsSync(f) ? readJson<Partial<ProjectConfig>>(f) : {};
  const out = { ...DEFAULT_CONFIG } as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    const d = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' && !Array.isArray(v) && k !== 'packs' ? { ...d, ...v } : v;
  }
  return out as unknown as ProjectConfig;
}
