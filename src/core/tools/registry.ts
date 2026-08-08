import type { Component } from 'svelte';

export type WorkerKind = 'opencv' | 'ffmpeg' | 'native';

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
  load: () => Promise<{ default: Component<Record<string, never>> }>;
  requiredWorkers: WorkerKind[];
}

export const tools: ToolDefinition[] = [
  {
    id: 'token-cutter',
    name: 'VTT Token Cutter',
    blurb: 'Lasso a figure and extract a mono-colour silhouette PNG.',
    icon: '⬤',
    load: () =>
      import('../../tools/TokenCutter/index.svelte') as Promise<{
        default: Component<Record<string, never>>;
      }>,
    requiredWorkers: ['opencv'],
  },
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((t) => t.id === id);
}
