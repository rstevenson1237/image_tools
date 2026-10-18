/**
 * Project configuration (`art/artgen.config.json`, D19) and the small file conventions the CLI and the image tools UI
 * (W4) both read: defaults merged over the file, the effective budget of an asset, the pre-W1 direction placeholder,
 * and the base a finish is bound to. Pure data; the CLI and the UI's project store do the I/O.
 */
import type { Direction } from '../direction.ts';

export interface BudgetCaps { revisionPasses?: number; extraAutonomousRevisions?: number; maxImageTokensPerAsset?: number }

export type ModelSpec = string | { model: string; effort?: string };

/** Review sheet detail: `low` = the first facing at 3×, beside the previous version only; `full` = every facing. */
export type SheetDetail = 'low' | 'full';

/**
 * Review policy. `blind` (rev 9) adds a blind re-score by a fresh reviewer; the final is chosen on it, and a blind score
 * under `approveMin`, or more than `blindMaxGap` under the version's own score, is an open issue that starts one extra
 * revision from `blindRevisions` (on top of `budget.extraAutonomousRevisions`). The rest is from the first production
 * run (0.10.0): `finish` runs the finishing pass `always`, `never`, or on `auto` only when the base's review names a
 * finish-level problem or it clears `approveMin`; `earlyRoster` holds v2 until a roster review of every v1;
 * `rosterRevisions` caps the revisions a roster note may open per asset (`feedback --by roster`); `heightFail` fails
 * characters and creatures drawn further than that from their brief height; `sheetDetail` per pass (`r1: low`).
 */
export interface ReviewPolicy {
  blind: boolean;
  approveMin: number;
  blindMaxGap: number;
  blindRevisions: number;
  finish: 'auto' | 'always' | 'never';
  earlyRoster: boolean;
  rosterRevisions: number;
  heightFail: number;
  sheetDetail: Record<string, SheetDetail>;
}

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
  /**
   * Optional review tiers (0.10.0): `reviewEarly` scores r1 and r2 (a cheaper model is enough to steer early drafts),
   * `blind` the blind re-scores and `roster` the roster reviews (the strong model: they decide what ships).
   */
  models: Record<'base' | 'revise' | 'finish' | 'review', ModelSpec> & Partial<Record<'reviewEarly' | 'blind' | 'roster', ModelSpec>>;
  review: ReviewPolicy;
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
  review: { blind: true, approveMin: 6.5, blindMaxGap: 1, blindRevisions: 1, finish: 'auto', earlyRoster: true, rosterRevisions: 1, heightFail: 0.15, sheetDetail: { r1: 'low' } },
  gate: {},
};

/**
 * The config `artgen init` writes for a new project: the defaults plus per-kind revision passes from analytics v2 over
 * artgen's example games and benchmarks (51 assets): a third pass added +0.17 to textures (medium confidence), while
 * props still gained +0.5 at the third (high, 14 assets). Kept out of `DEFAULT_CONFIG` on purpose: that is merged
 * under every existing project's file, where new per-kind passes would reopen finished assets.
 */
export const INIT_CONFIG: ProjectConfig = {
  ...DEFAULT_CONFIG,
  budget: { ...DEFAULT_CONFIG.budget, perKind: { texture: { revisionPasses: 2 }, prop: { revisionPasses: 4 } } },
};

/** A parsed `artgen.config.json` merged over the defaults (sections shallow-merged, so older configs keep working). */
export function mergeConfig(raw: Partial<ProjectConfig> | Record<string, unknown> = {}): ProjectConfig {
  const out = { ...DEFAULT_CONFIG } as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    const d = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' && !Array.isArray(v) && k !== 'packs' ? { ...d, ...v } : v;
  }
  return out as unknown as ProjectConfig;
}

/** True when a direction file is still the pre-W1 placeholder. */
export const isPlaceholderDirection = (d: unknown): boolean =>
  typeof d === 'object' && d !== null && (d as { status?: string }).status === 'draft' && !(d as { palette?: unknown }).palette;

export interface AssetBudget { revisionPasses: number; extraRevisions: number; maxImageTokens?: number; maxUserIterations: number }

/** Effective pipeline budget for an asset (D19): `budget.perKind[kind]` > `budget.tiers[importance]` > `budget` > direction. */
export function budgetFor(cfg: ProjectConfig | undefined, brief: { kind: string; importance?: string }, dir: Direction): AssetBudget {
  const b = cfg?.budget ?? {}, kind = b.perKind?.[brief.kind] ?? {}, tier = (brief.importance && b.tiers?.[brief.importance]) || {};
  return {
    revisionPasses: kind.revisionPasses ?? tier.revisionPasses ?? b.revisionPasses ?? dir.pipeline.revisionPasses,
    extraRevisions: kind.extraAutonomousRevisions ?? tier.extraAutonomousRevisions ?? b.extraAutonomousRevisions ?? 0,
    maxImageTokens: kind.maxImageTokensPerAsset ?? tier.maxImageTokensPerAsset ?? b.maxImageTokensPerAsset,
    maxUserIterations: b.maxUserIterations ?? 3,
  };
}

/** The base a finish source is bound to (`export const base = 'base.v3'`). */
export const finishBaseOf = (src: string): string | undefined => src.match(/export\s+const\s+base\s*=\s*['"]([^'"]+)['"]/)?.[1];
