/**
 * Open and save for a map-like document: the game repo's `art/<dir>/<id>/<file>` through the open project, or a plain
 * `.json` file on disk. Terrain maps, dungeons and settlements differ only in the folder, the file name and the three
 * project calls, which `MapKind` carries.
 */
import { project } from '../project/store.svelte';
import type { FileStat } from '../project/files';
import { downloadText } from '../utils/download';
import { messageOf } from './editor';

export interface MapKind {
  /** `map`, `dungeon`: used in messages and in the downloaded file name. */
  noun: string;
  plural: string;
  /** Folder under the project, e.g. `art/maps`. */
  dir: string;
  /** File inside each document's folder, e.g. `map.json`. */
  file: string;
  ids(): Promise<string[]>;
  read(id: string): Promise<{ text: string; stat?: FileStat } | undefined>;
  save(id: string, text: string, base: FileStat | undefined, force: boolean): Promise<FileStat | undefined>;
}

export const MAP_KINDS = {
  map: { noun: 'map', plural: 'maps', dir: 'art/maps', file: 'map.json', ids: () => project.mapIds(), read: id => project.readMap(id), save: (id, text, base, force) => project.saveMap(id, text, base, force) },
  dungeon: { noun: 'dungeon', plural: 'dungeons', dir: 'art/dungeons', file: 'dungeon.json', ids: () => project.dungeonIds(), read: id => project.readDungeon(id), save: (id, text, base, force) => project.saveDungeon(id, text, base, force) },
  settlement: { noun: 'settlement', plural: 'settlements', dir: 'art/settlements', file: 'settlement.json', ids: () => project.settlementIds(), read: id => project.readSettlement(id), save: (id, text, base, force) => project.saveSettlement(id, text, base, force) },
} satisfies Record<string, MapKind>;

/** What the controller needs from an editor's store. */
export interface MapDocStore {
  readonly spec: { id: string };
  dirty: boolean;
  source: { id: string; stat?: FileStat } | null;
  load(next: unknown, source?: { id: string; stat?: FileStat } | null): void;
}

export class MapProjectFiles {
  /** Ids of this kind in the open project. */
  ids = $state<string[]>([]);
  pick = $state('');

  constructor(
    readonly kind: MapKind,
    private readonly store: MapDocStore,
    /** Where an action error goes (null clears it). */
    private readonly report: (message: string | null) => void,
  ) {}

  /** Keep `ids` in step with the open project; call while the component initialises. */
  watch(): void {
    $effect(() => {
      void project.revision;
      if (project.files) void this.kind.ids().then(ids => { this.ids = ids; if (!ids.includes(this.pick)) this.pick = ids[0] ?? ''; });
      else this.ids = [];
    });
  }

  /** A plain `.json` file chosen with a file input. */
  async openFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { this.store.load(JSON.parse(await f.text())); this.report(null); } catch (err) { this.report(`${f.name}: ${messageOf(err)}`); }
  }

  async openFromProject(): Promise<void> {
    const { kind, pick, store } = this;
    if (!pick) return;
    if (store.dirty && !confirm(`Open ${pick}? Unsaved changes to this ${kind.noun} are lost.`)) return;
    const r = await kind.read(pick);
    if (!r) { this.report(`${kind.dir}/${pick}/${kind.file} is gone`); return; }
    try { store.load(JSON.parse(r.text), { id: pick, stat: r.stat }); this.report(null); } catch (err) { this.report(messageOf(err)); }
  }

  async saveToProject(force = false): Promise<void> {
    const { kind, store } = this, id = store.spec.id, base = store.source?.id === id ? store.source.stat : undefined;
    const stat = await kind.save(id, JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', base, force);
    if (stat) { store.source = { id, stat }; store.dirty = false; this.ids = await kind.ids(); this.pick = id; }
    else if (project.error && confirm(`${project.error}\n\nOverwrite it?`)) await this.saveToProject(true);
  }

  downloadJson(): void {
    const { kind, store } = this;
    downloadText(JSON.stringify($state.snapshot(store.spec), null, 2) + '\n', `${store.spec.id}.${kind.file}`, 'application/json');
    store.dirty = false;
  }
}
