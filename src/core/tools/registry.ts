import type { Component } from 'svelte';

export type WorkerKind = 'opencv' | 'artgen' | 'ffmpeg' | 'native';

/** Sidebar sections. Tools without a group sit under the first one. */
export const toolGroups = [
  { id: 'image', name: 'Image tools' },
  { id: 'art', name: 'Art pipeline' },
] as const;

export type ToolGroup = (typeof toolGroups)[number]['id'];

/**
 * Contract every tool in the suite implements.
 *
 * `load` is a dynamic import rather than an eagerly-resolved component so each
 * tool's UI, canvas wiring and worker land in their own chunk. A session that
 * only opens the Token Cutter never downloads the Sprite Builder.
 */
export interface ToolDefinition {
  id: string;
  name: string;
  /** Short description shown under the tool name in the sidebar. */
  blurb: string;
  /** Single glyph used as the sidebar icon. */
  icon: string;
  /** Sidebar section (default: the first group). */
  group?: ToolGroup;
  load: () => Promise<{ default: Component<Record<string, never>> }>;
  requiredWorkers: WorkerKind[];
}

type Loaded = Promise<{ default: Component<Record<string, never>> }>;

export const tools: ToolDefinition[] = [
  {
    id: 'token-cutter',
    name: 'VTT Token Cutter',
    blurb: 'Lasso a figure and extract a mono-colour silhouette PNG.',
    icon: '⬤',
    group: 'image',
    load: () => import('../../tools/TokenCutter/index.svelte') as Loaded,
    requiredWorkers: ['opencv'],
  },
  {
    id: 'svg-tracer',
    name: 'SVG Tracer',
    blurb: 'Trace artwork to vector paths, fix the nodes, export SVG.',
    icon: '✧',
    group: 'image',
    load: () => import('../../tools/SvgTracer/index.svelte') as Loaded,
    requiredWorkers: ['opencv'],
  },
  {
    id: 'art-direction',
    name: 'Art Direction',
    blurb: "Edit a game's palette and style settings, compare candidates, lock.",
    icon: '◐',
    group: 'art',
    load: () => import('../../tools/ArtDirection/index.svelte') as Loaded,
    requiredWorkers: ['artgen'],
  },
  {
    id: 'asset-review',
    name: 'Asset Review',
    blurb: 'Finished assets by status: compare, approve or request changes.',
    icon: '▦',
    group: 'art',
    load: () => import('../../tools/AssetReview/index.svelte') as Loaded,
    requiredWorkers: ['artgen'],
  },
  {
    id: 'asset-lab',
    name: 'Asset Lab',
    blurb: 'Params, seed, facing and frame; animation through the runtime.',
    icon: '⚗',
    group: 'art',
    load: () => import('../../tools/AssetLab/index.svelte') as Loaded,
    requiredWorkers: ['artgen'],
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((t) => t.id === id);
}

/** Tools per sidebar section, in registry order; empty sections are left out. */
export function groupedTools(list: ToolDefinition[] = tools) {
  return toolGroups
    .map((g, i) => ({ ...g, tools: list.filter((t) => (t.group ?? toolGroups[0].id) === g.id || (i === 0 && !t.group)) }))
    .filter((g) => g.tools.length);
}
