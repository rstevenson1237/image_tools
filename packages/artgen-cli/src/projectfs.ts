/** Finding a project and reading and writing its JSON files, without the project scaffold (the maps-only bundle's share of `project.ts`). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

export interface Project {
  /** Game repo root (the folder holding `art/`). */
  root: string;
  art: string;
}

export const CONFIG_FILE = 'artgen.config.json';

/** Path mode: a map or dungeon file named by its path (`--file`), needing no project. */
export interface FileRef { file: string }

/** A file's name without its extension. */
export const fileStem = (file: string): string => basename(file, extname(file));
/** That name as a map or dungeon id (`F.a.json` → `F-a`). */
export const fileId = (file: string): string => fileStem(file).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'map';

export function findProject(start = process.cwd()): Project | null {
  for (let d = resolve(start); ; d = dirname(d)) {
    if (existsSync(join(d, 'art', CONFIG_FILE))) return { root: d, art: join(d, 'art') };
    if (dirname(d) === d) return null;
  }
}

export function requireProject(start?: string): Project {
  const p = findProject(start);
  if (!p) throw new Error('no artgen project here (art/artgen.config.json not found up the tree) — run `artgen init` in the game repo root');
  return p;
}

export const readJson = <T = unknown>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
export const writeJson = (p: string, v: unknown): void => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
