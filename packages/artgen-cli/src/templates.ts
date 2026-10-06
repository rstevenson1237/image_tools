/**
 * Asset templates (`templates/<view>/<kind>/{brief.json, base.js}` + `templates/finish.js`): `artgen new`,
 * `artgen finish` and the W1 probe set copy from here. In the repo they sit next to `src/`; in the committed install
 * they sit next to the bundled `artgen.js` (`tools/artgen/templates/`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, 'templates'), join(here, '..', 'templates')]) if (existsSync(join(p, 'finish.js'))) return p;
  throw new Error(`artgen templates not found next to ${here}`);
}

export interface TemplateRef { view: string; kind: string; dir: string; fallback: boolean }

/** Kinds that start from a related template (brief kinds beyond the probe set). */
const KIND_ALIAS: Record<string, string> = { creature: 'character', tileset: 'tile', texture: 'tile', viewmodel: 'prop', 'ui-icon': 'prop' };

/** Template for a kind in a view; views without one fall back to `topdown`, related kinds to their alias, others to `prop`. */
export function findTemplate(view: string, kind: string): TemplateRef {
  const root = templatesRoot(), alias = KIND_ALIAS[kind] ?? kind;
  for (const [v, k] of [[view, kind], ['topdown', kind], [view, alias], ['topdown', alias], [view, 'prop'], ['topdown', 'prop']]) {
    const dir = join(root, v, k);
    if (existsSync(join(dir, 'base.js'))) return { view: v, kind: k, dir, fallback: v !== view || k !== kind };
  }
  throw new Error(`no template for ${view}/${kind}`);
}

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);

export interface NewAssetOptions {
  id: string;
  kind: string;
  view: string;
  size?: string | [number, number];
  states?: string[];
  directions?: number;
  notes?: string;
}

/**
 * Create an asset directory: `brief.json` (template defaults + options) and `base.v1.js` from the template.
 * Refuses to touch an existing `base.v1.js` (R10: a scored version is never edited).
 */
export function newAsset(path: string, o: NewAssetOptions): { files: string[]; template: TemplateRef } {
  const t = findTemplate(o.view, o.kind), base = join(path, 'base.v1.js');
  if (existsSync(base)) throw new Error(`${base} exists — write the next version instead (R10)`);
  mkdirSync(path, { recursive: true });
  const brief = {
    id: o.id, ...JSON.parse(readFileSync(join(t.dir, 'brief.json'), 'utf8')), kind: o.kind, view: o.view,
    ...(o.size && { size: o.size }), ...(o.states && { states: o.states }), ...(o.directions && { directions: o.directions }), ...(o.notes && { notes: o.notes }),
  };
  writeFileSync(join(path, 'brief.json'), JSON.stringify(brief, null, 2) + '\n');
  writeFileSync(base, fill(readFileSync(join(t.dir, 'base.js'), 'utf8'), { ID: o.id }));
  return { files: [join(path, 'brief.json'), base], template: t };
}

/** Write `finish.v<n>.js` from the finish template, bound to `base`. */
export function newFinish(path: string, n: number, base: string): string {
  const file = join(path, `finish.v${n}.js`);
  if (existsSync(file)) throw new Error(`${file} exists`);
  writeFileSync(file, fill(readFileSync(join(templatesRoot(), 'finish.js'), 'utf8'), { BASE: base, N: String(n) }));
  return resolve(file);
}
