/**
 * Zip fallback (D5) for browsers without `showDirectoryPicker` (Firefox, Safari): import a zip of the game repo or of
 * its `art/` folder, work on it in memory, download the art folder back as a zip and unpack it over the repo.
 * It is a manual round trip, so the export lists what changed: anything Claude Code wrote meanwhile is overwritten.
 */
import { strToU8, unzipSync, zipSync } from 'fflate';
import { MemoryFiles } from './files';

/** The art folder inside a zip: the shallowest `artgen.config.json` decides where it is. */
export function artFromZip(bytes: Uint8Array, name = 'art'): MemoryFiles {
  const all = unzipSync(bytes);
  const configs = Object.keys(all).filter(p => p === 'artgen.config.json' || p.endsWith('/artgen.config.json'))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  if (!configs.length) throw new Error('no artgen.config.json in this zip — zip the game repo, or its art/ folder');
  const pre = configs[0].slice(0, -'artgen.config.json'.length), out: Record<string, Uint8Array> = {};
  for (const [p, d] of Object.entries(all)) if (p.startsWith(pre) && !p.endsWith('/')) out[p.slice(pre.length)] = d;
  return new MemoryFiles(name, out);
}

/** The art folder as a zip (paths under `art/`, so it unpacks over the game repo root), with a CHANGES note. */
export function zipArt(files: MemoryFiles): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [p, d] of files.entries()) entries[`art/${p}`] = d;
  const changed = [...files.dirty].sort();
  entries['art/.image-tools-changes.txt'] = strToU8(
    `Files changed in the image tools since this zip was imported (unzip over the game repo root to apply):\n${changed.map(p => `  art/${p}`).join('\n') || '  (none)'}\n`,
  );
  return zipSync(entries, { level: 6 });
}
