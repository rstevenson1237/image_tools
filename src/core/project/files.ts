/**
 * The project's `art/` folder as a small file API (SPEC §13.2). Two backends:
 *
 *   HandleFiles   File System Access directory handle (Chromium; also the origin-private file system, which the
 *                 acceptance run uses because a directory picker can't be driven headlessly)
 *   MemoryFiles   an in-memory copy: the zip fallback for browsers without `showDirectoryPicker`, and the tests
 *
 * Paths are relative to the `art/` folder and use `/`. Rune-free and DOM-light so it runs under vitest in node.
 */

export interface FileStat {
  size: number;
  /** ms since epoch; the conflict check compares it before every write (D5: Claude Code may write the same file). */
  lastModified: number;
}

export interface ProjectFiles {
  readonly kind: 'handle' | 'memory';
  /** Display name of the opened folder. */
  readonly name: string;
  /** Entries directly under `dir` ('' = the art folder); folders end in `/`. Missing folder → []. */
  list(dir: string): Promise<string[]>;
  readText(path: string): Promise<string | undefined>;
  readBytes(path: string): Promise<Uint8Array | undefined>;
  stat(path: string): Promise<FileStat | undefined>;
  /** Create or replace a file (parent folders are created). */
  write(path: string, data: string | Uint8Array): Promise<void>;
  /** Append text without rewriting what is there (ledger lines). */
  append(path: string, text: string): Promise<void>;
}

const split = (path: string): string[] => path.split('/').filter(Boolean);

export const isFolder = (entry: string): boolean => entry.endsWith('/');

/** Every file under `dir`, recursively, as paths relative to the art folder; `skip` prunes folders by name. */
export async function walk(files: ProjectFiles, dir = '', skip: (folder: string) => boolean = () => false): Promise<string[]> {
  const out: string[] = [];
  for (const e of await files.list(dir)) {
    const p = dir ? `${dir}/${e}` : e;
    if (isFolder(e)) {
      if (!skip(e.slice(0, -1))) out.push(...(await walk(files, p.slice(0, -1), skip)));
    } else out.push(p);
  }
  return out;
}

const enc = new TextEncoder(), dec = new TextDecoder();

/** In-memory files (zip fallback, tests). `dirty` records every path written since load, for the zip export. */
export class MemoryFiles implements ProjectFiles {
  readonly kind = 'memory' as const;
  readonly dirty = new Set<string>();
  private readonly data = new Map<string, { bytes: Uint8Array; lastModified: number }>();
  private clock = 0;

  constructor(readonly name = 'art', entries: Record<string, string | Uint8Array> = {}) {
    for (const [p, d] of Object.entries(entries)) this.data.set(split(p).join('/'), { bytes: typeof d === 'string' ? enc.encode(d) : d, lastModified: 0 });
  }

  /** Every file path (sorted). */
  paths(): string[] { return [...this.data.keys()].sort(); }

  /** Every file's bytes, by path. */
  entries(): [string, Uint8Array][] { return this.paths().map(p => [p, this.data.get(p)!.bytes]); }

  async list(dir: string): Promise<string[]> {
    const pre = split(dir).join('/'), out = new Set<string>();
    for (const p of this.data.keys()) {
      if (pre && !p.startsWith(pre + '/')) continue;
      const rest = pre ? p.slice(pre.length + 1) : p, i = rest.indexOf('/');
      out.add(i < 0 ? rest : rest.slice(0, i + 1));
    }
    return [...out].sort();
  }

  async readBytes(path: string): Promise<Uint8Array | undefined> { return this.data.get(split(path).join('/'))?.bytes; }

  async readText(path: string): Promise<string | undefined> {
    const b = await this.readBytes(path);
    return b && dec.decode(b);
  }

  async stat(path: string): Promise<FileStat | undefined> {
    const e = this.data.get(split(path).join('/'));
    return e && { size: e.bytes.length, lastModified: e.lastModified };
  }

  async write(path: string, data: string | Uint8Array): Promise<void> {
    const p = split(path).join('/');
    this.data.set(p, { bytes: typeof data === 'string' ? enc.encode(data) : data.slice(), lastModified: ++this.clock });
    this.dirty.add(p);
  }

  async append(path: string, text: string): Promise<void> {
    const old = (await this.readBytes(path)) ?? new Uint8Array(), add = enc.encode(text), b = new Uint8Array(old.length + add.length);
    b.set(old); b.set(add, old.length);
    await this.write(path, b);
  }
}

/** File System Access backend over a directory handle (the art folder). */
export class HandleFiles implements ProjectFiles {
  readonly kind = 'handle' as const;

  /** `name`: what the user picked (the game repo), when the root is its `art/` folder. */
  constructor(readonly root: FileSystemDirectoryHandle, readonly name = root.name) {}

  private async folder(parts: string[], create = false): Promise<FileSystemDirectoryHandle | undefined> {
    let d = this.root;
    for (const p of parts) {
      try { d = await d.getDirectoryHandle(p, { create }); } catch { return undefined; }
    }
    return d;
  }

  private async file(path: string, create = false): Promise<FileSystemFileHandle | undefined> {
    const parts = split(path), name = parts.pop();
    if (!name) return undefined;
    const d = await this.folder(parts, create);
    if (!d) return undefined;
    try { return await d.getFileHandle(name, { create }); } catch { return undefined; }
  }

  async list(dir: string): Promise<string[]> {
    const d = await this.folder(split(dir));
    if (!d) return [];
    const out: string[] = [];
    // `entries()` is in every browser that has the API; the DOM lib types lag behind it
    for await (const [name, h] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries())
      out.push(h.kind === 'directory' ? `${name}/` : name);
    return out.sort();
  }

  async readBytes(path: string): Promise<Uint8Array | undefined> {
    const f = await this.file(path);
    return f && new Uint8Array(await (await f.getFile()).arrayBuffer());
  }

  async readText(path: string): Promise<string | undefined> {
    const f = await this.file(path);
    return f && (await f.getFile()).text();
  }

  async stat(path: string): Promise<FileStat | undefined> {
    const f = await this.file(path);
    if (!f) return undefined;
    const file = await f.getFile();
    return { size: file.size, lastModified: file.lastModified };
  }

  async write(path: string, data: string | Uint8Array): Promise<void> {
    const f = await this.file(path, true);
    if (!f) throw new Error(`cannot create ${path}`);
    const w = await f.createWritable();
    await w.write(data as FileSystemWriteChunkType);
    await w.close();
  }

  async append(path: string, text: string): Promise<void> {
    const f = await this.file(path, true);
    if (!f) throw new Error(`cannot create ${path}`);
    // keepExistingData + seek to the end: a true append, so a line Claude Code wrote meanwhile is never overwritten
    const size = (await f.getFile()).size, w = await f.createWritable({ keepExistingData: true });
    await w.seek(size);
    await w.write(text);
    await w.close();
  }
}
