/**
 * Game-repo project layout (SPEC §3.2): `artgen init` scaffolds `art/`; every other command finds the project by
 * walking up from the working directory to the folder that holds `art/artgen.config.json`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_FILE, readJson, type Project } from './projectfs.ts';
import { INIT_CONFIG, mergeConfig, type ProjectConfig } from 'artgen-core';

export { CONFIG_FILE, fileId, fileStem, findProject, readJson, requireProject, writeJson, type FileRef, type Project } from './projectfs.ts';
export { DEFAULT_CONFIG, isPlaceholderDirection, type BudgetCaps, type ProjectConfig } from 'artgen-core';

/** `art/direction.json` before W1 locks one: a draft placeholder the workflow replaces. */
export const EMPTY_DIRECTION = {
  id: 'untitled', version: 0, status: 'draft',
  theme: { pitch: '' },
  note: 'Not set yet. Run the art direction workflow (/artgen-direction, or `artgen direction candidates`) to create and lock one.',
};

const ART_GITIGNORE = `# artgen: renders are rebuilt from sources; keep approved sheets and art-direction records
sheets/*
!sheets/approved/
**/out/
`;

/** Scaffold `art/` in `root`. Never overwrites an existing file; returns the files and folders it created. */
export function initProject(root: string): { project: Project; created: string[] } {
  const art = join(root, 'art'), created: string[] = [];
  const dir = (p: string) => { if (!existsSync(p)) { mkdirSync(p, { recursive: true }); created.push(p); } };
  const file = (p: string, text: string) => { if (!existsSync(p)) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); created.push(p); } };
  dir(art);
  file(join(art, 'direction.json'), JSON.stringify(EMPTY_DIRECTION, null, 2) + '\n');
  file(join(art, 'briefs.yaml'), '# Asset briefs. One entry per asset: id, kind, view, size, states, directions, anims, notes.\n[]\n');
  for (const d of ['assets', 'anchors', 'refs', 'candidates', 'probes', 'sheets']) dir(join(art, d));
  file(join(art, 'assets', '.gitkeep'), '');
  file(join(art, 'anchors', '.gitkeep'), '');
  file(join(art, 'refs', 'README.md'), 'Reference images for the art direction interview. `artgen palette extract art/refs/<image>.png` pulls a palette from one.\n');
  file(join(art, 'ledger.jsonl'), '');
  file(join(art, CONFIG_FILE), JSON.stringify(INIT_CONFIG, null, 2) + '\n');
  file(join(art, '.gitignore'), ART_GITIGNORE);
  // asset sources are ESM (D17) whatever the game repo's own package.json says
  file(join(art, 'package.json'), JSON.stringify({ private: true, type: 'module', description: 'artgen asset sources (ESM)' }, null, 2) + '\n');
  return { project: { root, art }, created };
}

/** `art/artgen.config.json` merged over the defaults (sections shallow-merged, so older configs keep working). */
export function projectConfig(p: Project): ProjectConfig {
  const f = join(p.art, CONFIG_FILE);
  return mergeConfig(existsSync(f) ? readJson<Partial<ProjectConfig>>(f) : {});
}
