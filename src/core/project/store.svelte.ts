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
import { downloadBlob } from '../utils/download';
import type { FileOp } from './engine';
import { HandleFiles, MemoryFiles, type FileStat, type ProjectFiles } from './files';
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

  private handle: FileSystemDirectoryHandle | null = null;

  constructor() {
    if (typeof window !== 'undefined') void recallHandle().then(h => { if (h && !this.files) { this.handle = h; this.remembered = h.name; } });
  }

  get name(): string { return this.files?.name ?? ''; }
  get isZip(): boolean { return this.files?.kind === 'memory'; }
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

  /** Read a file of the project (sheets, reference images) for display. */
  async bytes(path: string): Promise<Uint8Array | undefined> { return this.files?.readBytes(path); }
}

export const project = new ProjectStore();

export { MemoryFiles };
