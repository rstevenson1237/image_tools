import { describe, expect, it } from 'vitest';
import { getTool, groupedTools, tools } from './registry';

describe('tool registry', () => {
  it('lists the tools under the image, maps and art groups, in that order', () => {
    expect(groupedTools().map(g => [g.id, g.tools.map(t => t.id)])).toEqual([
      ['image', ['token-cutter', 'svg-tracer']],
      ['maps', ['terrain-map', 'dungeon-map', 'settlement-map']],
      ['art', ['art-direction', 'asset-review', 'asset-lab']],
    ]);
  });
  it('gives every tool a group and a unique id', () => {
    expect(tools.every(t => t.group)).toBe(true);
    expect(new Set(tools.map(t => t.id)).size).toBe(tools.length);
    expect(getTool('dungeon-map')?.group).toBe('maps');
  });
});
