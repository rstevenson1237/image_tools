/**
 * The open artgen project, shared by the Art Direction, Asset Review and Asset Lab tools (SPEC §13.2). One per page:
 * switching tools keeps the folder open.
 *
 * Every user action re-reads the files first, plans its writes in the artgen worker, checks that nothing it read
 * changed on disk meanwhile (Claude Code may be writing the same files, D5), then writes. Ledger lines are appended,
 * never rewritten.
 */
import type { Remote } from 'comlink';
import type { LedgerEntry } from 'artgen-core';
import type { ArtgenApi } from '../../workers/artgen.worker';
import { BUNDLED, serverToken } from '../bundle';
import { downloadBlob } from '../utils/download';
import type { FileOp } from './engine';
import { HandleFiles, HttpFiles, isFolder, MemoryFiles, type FileStat, type ProjectFiles } from './files';
import { forgetHandle, recallHandle, rememberHandle } from './persist';
import { findArt, loadSnapshot, WATCHED, type LoadedSnapshot } from './snapshot';
import { artFromZip, zipArt } from './zip';

export type Api = Remote<ArtgenApi>;

type Picker = (o?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
type Permissioned = FileSystemDirectoryHandle & {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
};

const sameStat = (a?: FileStat, b?: FileStat) => a?.lastModified === b?.lastModified && a?.size === b?.size;

class ProjectStore {
  files = $state.raw<ProjectFiles | null>(null);
  snapshot = $state.raw<LoadedSnapshot | null>(null);
  /** Bumped on every reload; tools re-query the worker when it changes. */
  revision = $state(0);
  busy = $state(false);
  error = $state<string | null>(null);
  /** Outcome of the last action, shown in the project bar. */
  notice = $state<string | null>(null);
  /** Name of a remembered folder that needs a click to reopen (permission is per session). */
  remembered = $state<string | null>(null);
  readonly canPickFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  /** This is the review UI served by `artgen ui`: the repo is the server's, not picked. */
  readonly bundled = BUNDLED;
  /** The installer modules of the served repo (`art`, `maps`, …); null when unknown. Decides which tools the sidebar shows. */
  modules = $state.raw<string[] | null>(null);

  private handle: FileSystemDirectoryHandle | null = null;

  constructor() {
    if (typeof window !== 'undefined') void recallHandle().then(h => { if (h && !this.files) { this.handle = h; this.remembered = h.name; } });
  }

  get name(): string { return this.files?.name ?? ''; }
  get isZip(): boolean { return this.files?.kind === 'memory'; }
  get isServer(): boolean { return this.files?.kind === 'server'; }
  get dirty(): string[] { return this.files instanceof MemoryFiles ? [...this.files.dirty].sort() : []; }

  private async guard<T>(run: () => Promise<T>): Promise<T | undefined> {
    this.busy = true; this.error = null;
    try { return await run(); } catch (e) { this.error = e instanceof Error ? e.message : String(e); return undefined; } finally { this.busy = false; }
  }

  /** Pick the game repo (or its `art/` folder) with the File System Access API. */
  open(): Promise<void> {
    return this.guard(async () => {
      const pick = (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker;
      let h: FileSystemDirectoryHandle;
      try { h = await pick({ id: 'artgen-project', mode: 'readwrite' }); } catch (e) { if ((e as DOMException).name === 'AbortError') return; throw e; }
      await this.useHandle(h);
      await rememberHandle(h);
    }) as Promise<void>;
  }

  /** Open the repo `artgen ui` serves, with the token from the link. */
  openServer(): Promise<void> {
    return this.guard(async () => {
      const token = serverToken();
      if (!token) throw new Error('No access token: open the link `artgen ui` printed (it ends in ?t=…).');
      const { files, modules } = await HttpFiles.connect(token);
      this.modules = modules;
      await this.use(files);
    }) as Promise<void>;
  }

  /** Reopen the remembered folder (asks for permission again: browsers don't keep it across sessions). */
  reopen(): Promise<void> {
    return this.guard(async () => {
      const h = this.handle as Permissioned | null;
      if (!h) return;
      if (h.requestPermission && (await h.queryPermission?.({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted')
        throw new Error(`no permission to read and write ${h.name}`);
      await this.useHandle(h);
    }) as Promise<void>;
  }

  private async useHandle(h: FileSystemDirectoryHandle): Promise<void> {
    const art = await findArt(new HandleFiles(h));
    if (art === null) throw new Error(`${h.name} has no art/artgen.config.json — pick the game repo (or its art/ folder) after \`artgen init\``);
    this.handle = h; this.remembered = null;
    await this.use(new HandleFiles(art ? await h.getDirectoryHandle('art') : h, h.name));
  }

  /** Zip fallback: a zip of the game repo or its art folder, worked on in memory. */
  importZip(file: File): Promise<void> {
    return this.guard(async () => {
      await this.use(artFromZip(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.zip$/i, '')));
    }) as Promise<void>;
  }

  /** Download the art folder (zip fallback) to unpack over the game repo. */
  exportZip(): void {
    if (!(this.files instanceof MemoryFiles)) return;
    downloadBlob(new Blob([zipArt(this.files) as BlobPart], { type: 'application/zip' }), `${this.files.name || 'art'}-art.zip`);
  }

  async close(): Promise<void> {
    this.files = null; this.snapshot = null; this.notice = null; this.error = null;
    if (this.handle) { await forgetHandle(); this.handle = null; }
  }

  private async use(files: ProjectFiles): Promise<void> {
    this.files = files;
    this.notice = null;
    await this.reload();
  }

  /** Re-read the files (Claude Code may have changed them). */
  async reload(): Promise<void> {
    if (!this.files) return;
    this.snapshot = await loadSnapshot(this.files);
    this.revision++;
  }

  /** The worker with the current snapshot loaded. */
  async sync(api: Api): Promise<Api> {
    if (!this.snapshot) throw new Error('no project open');
    if ((await api.rev()) !== this.revision) {
      const { text, bin } = this.snapshot;
      await api.load({ text, bin }, this.revision);
    }
    return api;
  }

  /**
   * A user action: re-read, plan in the worker, check the disk, write. A file the plan read (ledger, direction,
   * briefs, config) or will overwrite that changed between the re-read and the write stops the action unwritten.
   */
  private async act<T>(api: Api, plan: (api: Api) => Promise<{ ops: FileOp[]; result: T }>, done: (r: T) => string): Promise<T | undefined> {
    return this.guard(async () => {
      const files = this.files;
      if (!files) throw new Error('no project open');
      await this.reload();
      const { ops, result } = await plan(await this.sync(api));
      const before = this.snapshot!.stats, targets = new Map<string, FileStat | undefined>();
      for (const o of ops) if (o.op === 'write') targets.set(o.path, await files.stat(o.path));
      for (const p of WATCHED) if (!sameStat(before[p], await files.stat(p)))
        throw new Error(`art/${p} changed on disk while this was being prepared (Claude Code?) — nothing was written; try again`);
      for (const o of ops) {
        if (o.op === 'append') { await files.append(o.path, o.data); continue; }
        if (!sameStat(targets.get(o.path), await files.stat(o.path))) throw new Error(`art/${o.path} changed on disk while writing — reload and try again`);
        await files.write(o.path, o.data);
      }
      await this.reload();
      this.notice = done(result);
      return result;
    });
  }

  /** Approve a final asset (writes the ledger; keeps the review sheet in sheets/approved/ when it is on disk). */
  approve(api: Api, id: string, note = '') {
    return this.act(api, async a => {
      const { entry, keep, warnings } = await a.approve(id, note);
      const sheet = await this.files!.readBytes(keep.from), ops: FileOp[] = [];
      if (sheet) ops.push({ op: 'write', path: keep.to, data: sheet });
      const e = { ...entry, sheet: sheet ? keep.to : entry.sheet } as Omit<LedgerEntry, 'ts'>;
      ops.push({ op: 'append', path: 'ledger.jsonl', data: await a.line(e) });
      return { ops, result: { entry: e, warnings } };
    }, r => `approved ${id} ${r.entry.version}${r.warnings.length ? ` (note: ${r.warnings.join('; ')})` : ''}`);
  }

  /** Request changes: a user feedback line that opens the next base (form/colour) or finish (pixels) version. */
  requestChanges(api: Api, id: string, o: { route: 'base' | 'finish'; note: string; region?: number[]; cell?: string; force?: boolean }) {
    return this.act(api, async a => {
      const r = await a.feedback(id, o);
      return { ops: [{ op: 'append', path: 'ledger.jsonl', data: await a.line(r.entry) }], result: r };
    }, r => `requested changes on ${id}: opens ${r.opens} — ask Claude Code to run /artgen-make`);
  }

  saveDraft(api: Api, name: string, direction: unknown) {
    return this.act(api, async a => ({ ops: await a.saveDraft(name, direction), result: name }), n => `saved draft art/candidates/${n}.json`);
  }

  lock(api: Api, name: string, note = '') {
    return this.act(api, async a => {
      const r = await a.lock(name, note);
      return { ops: r.ops, result: r.direction };
    }, d => `locked ${name} as ${d.id} v${d.version} — approved assets now need a restyle (ask Claude Code: /artgen-restyle)`);
  }

  /** Ids of the folders under `art/<dir>/` that hold a `<file>` (maps, dungeons, settlements). */
  private async folderIds(dir: string, file: string): Promise<string[]> {
    const files = this.files;
    if (!files) return [];
    const ids = (await files.list(dir)).filter(isFolder).map(e => e.slice(0, -1));
    return (await Promise.all(ids.map(async id => ((await files.stat(`${dir}/${id}/${file}`)) ? id : null)))).filter((id): id is string => !!id).sort();
  }

  /** A text file and its disk state (pass the state back when saving so a change by Claude Code isn't overwritten). */
  private async readWithStat(path: string): Promise<{ text: string; stat?: FileStat } | undefined> {
    const text = await this.files?.readText(path);
    return text === undefined ? undefined : { text, stat: await this.files!.stat(path) };
  }

  /**
   * Write `art/<dir>/<id>/<file>`. `base` is the disk state it was read at (undefined: a new file, which must not exist
   * yet); if the file changed since, nothing is written unless `force`. Returns the new disk state.
   */
  private saveInFolder(dir: string, file: string, what: string, render: string, id: string, text: string, base: FileStat | undefined, force: boolean): Promise<FileStat | undefined> {
    return this.guard(async () => {
      const files = this.files;
      if (!files) throw new Error('no project open');
      if (!/^[\w-]+$/.test(id)) throw new Error(`${what} id ${id}: letters, digits, - and _ only`);
      const path = `${dir}/${id}/${file}`, now = await files.stat(path);
      if (!force && now && !sameStat(base, now))
        throw new Error(base ? `art/${path} changed on disk since you opened it (Claude Code?) — nothing was written; reopen it, or save again to overwrite` : `art/${path} already exists — open it, pick another id, or save again to overwrite`);
      await files.write(path, text);
      this.notice = `saved art/${path} — ask Claude Code to render it (${render} ${id}), or keep editing here`;
      return files.stat(path);
    });
  }

  /** Terrain maps in the project (`art/maps/<id>/map.json`). */
  mapIds(): Promise<string[]> { return this.folderIds('maps', 'map.json'); }
  /** A map's file and its disk state (pass the state back to `saveMap`). */
  readMap(id: string): Promise<{ text: string; stat?: FileStat } | undefined> { return this.readWithStat(`maps/${id}/map.json`); }
  /** Write `art/maps/<id>/map.json`, refusing to overwrite a change made since `base` unless `force`. */
  saveMap(id: string, text: string, base: FileStat | undefined, force = false): Promise<FileStat | undefined> {
    return this.saveInFolder('maps', 'map.json', 'map', 'artgen map render', id, text, base, force);
  }

  /** Dungeon maps in the project (`art/dungeons/<id>/dungeon.json`). */
  dungeonIds(): Promise<string[]> { return this.folderIds('dungeons', 'dungeon.json'); }
  /** A dungeon's file and its disk state (pass the state back to `saveDungeon`). */
  readDungeon(id: string): Promise<{ text: string; stat?: FileStat } | undefined> { return this.readWithStat(`dungeons/${id}/dungeon.json`); }
  /** Write `art/dungeons/<id>/dungeon.json`, refusing to overwrite a change made since `base` unless `force`. */
  saveDungeon(id: string, text: string, base: FileStat | undefined, force = false): Promise<FileStat | undefined> {
    return this.saveInFolder('dungeons', 'dungeon.json', 'dungeon', 'artgen dungeon render', id, text, base, force);
  }

  /** Settlement maps in the project (`art/settlements/<id>/settlement.json`). */
  settlementIds(): Promise<string[]> { return this.folderIds('settlements', 'settlement.json'); }
  /** A settlement's file and its disk state (pass the state back to `saveSettlement`). */
  readSettlement(id: string): Promise<{ text: string; stat?: FileStat } | undefined> { return this.readWithStat(`settlements/${id}/settlement.json`); }
  /** Write `art/settlements/<id>/settlement.json`, refusing to overwrite a change made since `base` unless `force`. */
  saveSettlement(id: string, text: string, base: FileStat | undefined, force = false): Promise<FileStat | undefined> {
    return this.saveInFolder('settlements', 'settlement.json', 'settlement', 'artgen settlement render', id, text, base, force);
  }
  /** Any text file under `art/` (a settlement's underlay map, by its path from `art/`). */
  readArtText(path: string): Promise<string | undefined> { return this.files ? this.files.readText(path) : Promise.resolve(undefined); }

  /** Read a file of the project (sheets, reference images) for display. */
  async bytes(path: string): Promise<Uint8Array | undefined> { return this.files?.readBytes(path); }
}

export const project = new ProjectStore();

export { MemoryFiles };
