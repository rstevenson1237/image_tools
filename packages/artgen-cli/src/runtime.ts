/**
 * `artgen export --runtime` (SPEC §12.3, D4): vendor the W3 runtime into the game repo — the core plus the adapters
 * `artgen.config.json` selects — under `export.runtimeDir`, version-stamped in `runtime.json` with a hash per file. A
 * re-export upgrades it; files edited in the game repo are kept and reported unless `--force`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_VERSION } from 'artgen-runtime';
import { projectConfig, readJson, writeJson, type Project } from './project.ts';

export const STAMP = 'runtime.json';

/** Runtime sources: next to the bundled CLI in the committed install (`tools/artgen/runtime/`), else the workspace package. */
export function runtimeRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, 'runtime'), join(here, '..', '..', 'artgen-runtime', 'src')]) if (existsSync(join(p, 'pack.ts'))) return p;
  throw new Error(`artgen runtime sources not found next to ${here}`);
}

/** Vendored files: every core module (tests and test kits excluded) plus `adapters/<name>.ts` per selected adapter. */
export function runtimeFiles(adapters: string[], root = runtimeRoot()): string[] {
  const ts = (d: string) => (existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'testkit.ts' && f !== 'contract.ts') : []);
  const available = ts(join(root, 'adapters')).map(f => f.replace(/\.ts$/, ''));
  for (const a of adapters) if (!available.includes(a)) throw new Error(`unknown runtime adapter "${a}" in artgen.config.json (available: ${available.join(', ')})`);
  return [...ts(root).sort(), ...[...new Set(adapters)].map(a => `adapters/${a}.ts`)];
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const HEADER = `// Vendored by \`artgen export --runtime\` (artgen-runtime ${RUNTIME_VERSION}). Local edits are detected and kept;\n// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.\n`;

/** What `export --runtime` writes for one runtime file. */
export const vendoredSource = (file: string, root = runtimeRoot()): string => HEADER + readFileSync(join(root, file), 'utf8');

export interface RuntimeStamp { runtime: string; generator: string; adapters: string[]; files: Record<string, string> }
export interface VendorResult { dir: string; version: string; from: string | null; adapters: string[]; written: string[]; unchanged: string[]; kept: string[]; removed: string[] }

export function vendorRuntime(p: Project, o: { force?: boolean; generator?: string } = {}): VendorResult {
  const cfg = projectConfig(p), root = runtimeRoot(), adapters = cfg.runtime.adapters, files = runtimeFiles(adapters, root);
  const dir = join(p.root, cfg.export.runtimeDir), stampFile = join(dir, STAMP);
  const old = existsSync(stampFile) ? readJson<RuntimeStamp>(stampFile) : null;
  const generator = o.generator ?? 'artgen';
  const r: VendorResult = { dir: relative(p.root, dir).split('\\').join('/'), version: RUNTIME_VERSION, from: old?.runtime ?? null, adapters, written: [], unchanged: [], kept: [], removed: [] };
  const hashes: Record<string, string> = {};
  const edited = (f: string) => { const dest = join(dir, f); return existsSync(dest) && old?.files[f] !== undefined && sha(readFileSync(dest, 'utf8')) !== old.files[f]; };
  for (const f of files) {
    const text = vendoredSource(f, root), h = sha(text), dest = join(dir, f);
    if (existsSync(dest)) {
      const cur = sha(readFileSync(dest, 'utf8'));
      if (cur === h) { r.unchanged.push(f); hashes[f] = h; continue; }
      // a file we never stamped, or one changed since we wrote it, is the game's: keep it unless --force
      if (!o.force && (old?.files[f] === undefined || edited(f))) { r.kept.push(f); hashes[f] = old?.files[f] ?? cur; continue; }
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    r.written.push(f); hashes[f] = h;
  }
  // files the previous export vendored that this one doesn't (an adapter dropped from the config)
  for (const f of Object.keys(old?.files ?? {})) {
    if (files.includes(f) || !existsSync(join(dir, f))) continue;
    if (!o.force && edited(f)) { r.kept.push(f); hashes[f] = old!.files[f]; continue; }
    rmSync(join(dir, f)); r.removed.push(f);
  }
  writeJson(stampFile, { runtime: RUNTIME_VERSION, generator, adapters, files: hashes } satisfies RuntimeStamp);
  return r;
}
