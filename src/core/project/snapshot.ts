/**
 * Reading the art folder into a `Snapshot` for the engine, and turning asset sources into importable modules.
 *
 * Only what the engine reads is loaded: text files (config, direction, briefs, ledger, candidates, archived directions,
 * asset and probe sources) and the anchor PNGs. Renders (`out/`), sheets and reference images stay on disk.
 */
import type { Snapshot } from './engine';
import { walk, type FileStat, type ProjectFiles } from './files';

const TEXT = /\.(js|json|jsonl|yaml|yml|md)$/;
const SKIP = new Set(['out', 'sheets', 'refs', 'node_modules', '.git']);

export interface LoadedSnapshot extends Snapshot {
  /** Disk state of the files every user action depends on, at load time (the write check compares against it). */
  stats: Record<string, FileStat | undefined>;
}

/** Files a user action reads before it writes: if one changed on disk since load, the action is recomputed. */
export const WATCHED = ['ledger.jsonl', 'direction.json', 'briefs.yaml', 'artgen.config.json'];

export async function loadSnapshot(files: ProjectFiles): Promise<LoadedSnapshot> {
  const text: Record<string, string> = {}, bin: Record<string, Uint8Array> = {}, stats: Record<string, FileStat | undefined> = {};
  const paths = await walk(files, '', d => SKIP.has(d));
  await Promise.all(paths.map(async p => {
    if (TEXT.test(p)) text[p] = (await files.readText(p)) ?? '';
    else if (/^anchors\/[^/]+\.png$/.test(p)) bin[p] = (await files.readBytes(p))!;
  }));
  for (const p of WATCHED) stats[p] = await files.stat(p);
  return { text, bin, stats };
}

/** Is this folder an artgen art folder (or a game repo holding one)? Returns the art folder's prefix ('' or 'art/'). */
export async function findArt(files: Pick<ProjectFiles, 'stat'>): Promise<'' | 'art/' | null> {
  if (await files.stat('artgen.config.json')) return '';
  if (await files.stat('art/artgen.config.json')) return 'art/';
  return null;
}

// ---- asset modules ------------------------------------------------------------------------------------------------

/** `assets/prop/x` + `./finish.v1.js` → `assets/prop/x/finish.v1.js` (`..` and `.` segments resolved). */
export function joinPath(dir: string, spec: string): string {
  const out = dir.split('/').filter(Boolean);
  for (const s of spec.split('/')) {
    if (s === '..') out.pop();
    else if (s && s !== '.') out.push(s);
  }
  return out.join('/');
}

const RELATIVE = /(\bimport\s*\(\s*|\bfrom\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]+)\2/g;

/** Relative import specifiers in a module source. */
export const relativeImports = (src: string): string[] => [...src.matchAll(RELATIVE)].map(m => m[3]);

/** Replace relative import specifiers (static, re-export and dynamic) with what `resolve` returns for them. */
export function rewriteImports(src: string, resolve: (spec: string) => string): string {
  return src.replace(RELATIVE, (_, pre: string, q: string, spec: string) => `${pre}${q}${resolve(spec)}${q}`);
}

/**
 * A module loader over a snapshot: each source becomes a URL (blob: in the worker) with its relative imports pointing
 * at the URLs of the files they name, so `import * as prev from './finish.v1.js'` works without a file server.
 * URLs are cached per path + content, so an edited file is never served from the module cache.
 */
export function snapshotLoader(snap: Pick<Snapshot, 'text'>, toUrl: (code: string) => string, cache = new Map<string, string>()) {
  const urlOf = (path: string, seen: string[] = []): string => {
    const src = snap.text[path];
    if (src === undefined) throw new Error(`art/${path} does not exist (imported by ${seen[seen.length - 1] ?? 'the engine'})`);
    if (seen.includes(path)) throw new Error(`import cycle: ${[...seen, path].join(' → ')}`);
    const key = `${path}\n${src}`;
    let url = cache.get(key);
    if (!url) {
      const dir = path.split('/').slice(0, -1).join('/');
      url = toUrl(rewriteImports(src, spec => urlOf(joinPath(dir, spec), [...seen, path])));
      cache.set(key, url);
    }
    return url;
  };
  return { urlOf, load: (path: string) => import(/* @vite-ignore */ urlOf(path)) };
}
