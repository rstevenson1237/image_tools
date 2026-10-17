/**
 * Terrain Map state: the map file (`map.json`, the same shape the artgen CLI writes) plus view settings. Every change
 * to the map is one history command that swaps whole map snapshots, so undo never writes through a stale proxy.
 */
import { map } from 'artgen-core';
import type { FileStat } from '../../core/project/files';
import { commandId, createHistory } from '../../core/stores/history.svelte';

export type MapTool = 'pan' | 'paint' | 'raise' | 'lower' | 'river' | 'road' | 'label' | 'symbol' | 'erase';

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export class TerrainMapStore {
  spec = $state<map.MapSpec>(map.newMap('map', 'regional', { seed: randomSeed() }));
  readonly history = createHistory<string>(100);

  // view and tool settings (not part of the file)
  theme = $state<map.ThemeName>('color');
  layers = $state<Partial<Record<map.MapLayer, boolean>>>({});
  tool = $state<MapTool>('pan');
  terrain = $state<map.Terrain>('forest');
  brush = $state(2);
  strength = $state(0.25);
  symbol = $state('town');
  labelKind = $state<map.LabelKind>('place');
  labelText = $state('New place');
  exportPpu = $state(40);
  /** Where the open map lives in the project, with the disk state it was read at. */
  source = $state<{ id: string; stat?: FileStat } | null>(null);
  dirty = $state(false);

  /** Apply a change as one undoable step; an invalid change throws and leaves the map as it was. */
  change(label: string, mutate: (m: map.MapSpec) => void): void {
    const before = $state.snapshot(this.spec) as map.MapSpec, after = structuredClone(before);
    mutate(after);
    map.parseMap(after);
    this.history.execute({
      id: commandId('map'), actionType: label, payload: label,
      apply: () => { this.spec = structuredClone(after); this.dirty = true; },
      revert: () => { this.spec = structuredClone(before); this.dirty = true; },
    });
  }

  /** Replace the whole map (new / open), clearing the history. */
  load(next: unknown, source: { id: string; stat?: FileStat } | null = null): void {
    this.spec = map.parseMap(next);
    this.history.clear();
    this.source = source;
    this.dirty = false;
  }

  newMap(preset: map.Preset, id = 'map'): void {
    this.load(map.newMap(id, preset, { seed: randomSeed() }));
  }

  reseed(): void {
    this.change('new seed', m => { m.seed = randomSeed(); });
  }
}
