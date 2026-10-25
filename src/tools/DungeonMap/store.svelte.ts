/**
 * Dungeon Map state: the dungeon file (`dungeon.json`, the same shape the artgen CLI writes) plus view and tool
 * settings. Every change to the dungeon is one history command that swaps whole snapshots, so undo never writes through
 * a stale proxy.
 */
import { dungeon } from 'artgen-core';
import type { FileStat } from '../../core/project/files';
import { commandId, createHistory } from '../../core/stores/history.svelte';

export type DungeonTool = 'pan' | 'select' | 'room' | 'poly' | 'link' | 'door' | 'label' | 'symbol' | 'erase';
export type Side = 'n' | 'e' | 's' | 'w';

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export class DungeonMapStore {
  spec = $state<dungeon.DungeonSpec>(dungeon.generateDungeon(dungeon.newDungeon('dungeon', { seed: randomSeed() })));
  readonly history = createHistory<string>(100);

  // view and tool settings (not part of the file)
  layers = $state<Partial<Record<dungeon.DungeonLayer, boolean>>>({});
  tool = $state<DungeonTool>('select');
  /** The selected room's id. */
  selected = $state<string | null>(null);
  roomShape = $state<Exclude<dungeon.RoomShape, 'poly'>>('rect');
  linkDoors = $state<[dungeon.DoorKind | 'none', dungeon.DoorKind | 'none']>(['door', 'none']);
  linkWidth = $state(1);
  /** Where a new corridor meets a room: its centre, or the wall nearest the click. */
  linkAttach = $state<'centre' | 'wall'>('centre');
  linkRoute = $state<dungeon.Route>('auto');
  linkCurve = $state(false);
  linkStyle = $state<dungeon.CorridorStyle>('built');
  symbol = $state('stairs');
  symbolAngle = $state(0);
  labelKind = $state<dungeon.LabelKind>('name');
  labelText = $state('Bone pit');
  exportPpu = $state(70);
  /** The single-room maker's settings. */
  single = $state({ shape: 'rect' as Exclude<dungeon.RoomShape, 'poly'>, w: 8, h: 8, label: '', number: 1, exits: { n: 'door', e: 'none', s: 'door', w: 'off' } as Record<Side, dungeon.DoorKind | 'none' | 'off'> });
  /** Where the open dungeon lives in the project, with the disk state it was read at. */
  source = $state<{ id: string; stat?: FileStat } | null>(null);
  dirty = $state(false);

  /** Apply a change as one undoable step; an invalid change throws and leaves the dungeon as it was. */
  change(label: string, mutate: (m: dungeon.DungeonSpec) => dungeon.DungeonSpec | void): void {
    const before = $state.snapshot(this.spec) as dungeon.DungeonSpec, draft = structuredClone(before);
    const after = dungeon.parseDungeon(mutate(draft) ?? draft);
    this.history.execute({
      id: commandId('dungeon'), actionType: label, payload: label,
      apply: () => { this.spec = structuredClone(after); this.dirty = true; },
      revert: () => { this.spec = structuredClone(before); this.dirty = true; },
    });
  }

  /** Replace the whole dungeon (new / open), clearing the history. */
  load(next: unknown, source: { id: string; stat?: FileStat } | null = null): void {
    this.spec = dungeon.parseDungeon(next);
    this.history.clear();
    this.source = source;
    this.selected = null;
    this.dirty = false;
  }

  /** A fresh dungeon keeping the current id, size and settings: generated, empty, or the single room. */
  fresh(kind: 'generated' | 'empty' | 'room'): void {
    const cur = $state.snapshot(this.spec) as dungeon.DungeonSpec;
    let next = dungeon.newDungeon(cur.id, { ...cur, seed: randomSeed(), rooms: [], corridors: [], overlay: { labels: [], symbols: [] } });
    if (kind === 'generated') next = dungeon.generateDungeon(next);
    if (kind === 'room') {
      const o = this.single, exits = (Object.entries(o.exits) as [Side, string][]).filter(([, k]) => k !== 'off')
        .map(([side, k]) => ({ side, door: k === 'none' ? null : (k as dungeon.DoorKind) }));
      next = dungeon.singleRoom(next, { shape: o.shape, w: o.w, h: o.h, exits, label: o.label.trim() || undefined, number: o.number > 0 ? o.number : false });
    }
    this.load(next);
  }

  /** Lay out the rooms again from the generator settings and a new seed (undoable; labels and symbols stay). */
  regenerate(newSeed = true): void {
    this.change('generate', m => { if (newSeed) m.seed = randomSeed(); return dungeon.generateDungeon(m); });
    this.selected = null;
  }
}
