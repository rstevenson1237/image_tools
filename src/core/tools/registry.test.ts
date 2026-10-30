import { describe, expect, it } from 'vitest';
import { getTool, groupedTools, toolsFor, tools } from './registry';

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
  it('shows the tools of the modules a served repo has installed, and all of them when the modules are unknown', () => {
    const ids = (modules: string[] | null) => toolsFor(modules).map(t => t.id);
    expect(ids(null)).toEqual(tools.map(t => t.id));
    expect(ids(['core', 'maps', 'ui'])).toEqual(['token-cutter', 'svg-tracer', 'terrain-map', 'dungeon-map', 'settlement-map', 'asset-review']);   // Asset Review lists maps in a maps-only repo
    expect(ids(['core', 'art'])).toEqual(['token-cutter', 'svg-tracer', 'art-direction', 'asset-review', 'asset-lab']);
  });
});
