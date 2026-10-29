/**
 * `artgen upstream` (docs/TOOLING-PLAN.md §5, R4): the local edits to the installed files (skills, agents, commands, templates)
 * as a patch against their source paths in the artgen repo, so an edit made in a game repo stops being a fork. The installer's
 * `MANIFEST.json` holds the hash and the source path of every file as installed; the file as installed (the base of the diff)
 * comes from a distribution folder (`--base`) or from the release tag on GitHub.
 *
 * Installed files have `{{ARTGEN}}`, `{{CMD}}` and `{{CMD_DIRECTION}}` filled in; the source files do not. Both sides of a diff
 * are turned back into the source form first, so the patch applies to the source with `git apply`. The limit: a source that spells
 * one of the filled values out by hand (`node tools/artgen/artgen.js` where the rest use `{{ARTGEN}}`) is turned into the placeholder
 * on both sides, and its hunk then does not match the source; `git apply` says so, and the fix is to put the placeholder in the source.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { unifiedDiff } from './diff.ts';
import { DEFAULT_REPO } from './feedback-bundle.ts';

const MANIFEST = 'tools/artgen/MANIFEST.json';
/** Where a path of the distribution (`dist/…`) goes in the game repo: the installer's table, read backwards. */
const TARGETS: [string, string][] = [['claude/', '.claude/'], ['tools/artgen/', 'tools/artgen/'], ['github/', '.github/']];

const sha = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex').slice(0, 16);

interface Manifest { version: string; files: Record<string, string>; sources?: Record<string, string> }

export type UpstreamStatus = 'patch' | 'same' | 'built' | 'binary' | 'deleted' | 'no-base';
export interface UpstreamFile { installed: string; source?: string; status: UpstreamStatus; note?: string }
export interface UpstreamResult {
  /** The installed artgen version: the release the patch is against. */
  version: string;
  patch: string;
  files: UpstreamFile[];
  /** Where the patch was written (none when nothing is edited). */
  out?: string;
}

/** The distribution path of an installed file (`.claude/skills/x/SKILL.md` → `claude/skills/x/SKILL.md`). */
export function distPathOf(installed: string): string {
  const t = TARGETS.find(([, to]) => installed.startsWith(to));
  if (!t) throw new Error(`${installed}: not under a folder the installer writes to`);
  return t[0] + installed.slice(t[1].length);
}

/**
 * An installed file's text in the form of its source: the values the build filled in put back. The maps skills call the
 * maps-only bundle (`artgen-maps.js`); every other file calls `artgen.js`.
 */
export function unfill(text: string): string {
  return text
    .split('node tools/artgen/artgen-maps.js').join('{{ARTGEN}}')
    .split('node tools/artgen/artgen.js').join('{{ARTGEN}}')
    .split('`/artgen-direction`').join('{{CMD_DIRECTION}}')
    // `/artgen-review` as a command name, not the `/artgen-` inside a path
    .replace(/(^|[\s`(])\/artgen-(?=[a-z])/g, '$1{{CMD}}');
}

export interface UpstreamOptions {
  /** A distribution folder at the installed version (the content of the `artgen-dist` branch, or its `dist/` folder). */
  base?: string;
  repo?: string;
  /** Where to write the patch (default `art/feedback/upstream-<date>.patch`, or beside the manifest's repo root). */
  out?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}

/** The file as installed, from `--base` or from the release tag on GitHub. */
async function baseOf(version: string, installed: string, o: UpstreamOptions): Promise<Buffer | undefined> {
  const dist = distPathOf(installed);
  if (o.base) {
    for (const f of [join(o.base, 'dist', dist), join(o.base, dist)]) if (existsSync(f)) return readFileSync(f);
    return undefined;
  }
  try {
    const res = await (o.fetchImpl ?? fetch)(`https://raw.githubusercontent.com/${o.repo ?? DEFAULT_REPO}/artgen-dist-v${version}/dist/${dist}`);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : undefined;
  } catch { return undefined; }
}

/** Compare every installed file with `MANIFEST.json`; for each edited one write its change as a patch against its source path. */
export async function upstream(root: string, o: UpstreamOptions = {}): Promise<UpstreamResult> {
  root = resolve(root);
  const mf = join(root, MANIFEST);
  if (!existsSync(mf)) throw new Error('upstream: artgen is not installed here (tools/artgen/MANIFEST.json not found)');
  const m = JSON.parse(readFileSync(mf, 'utf8')) as Manifest;
  if (!m.sources) throw new Error(`upstream: this install (${m.version}) does not record where its files come from — run \`npx -y github:${o.repo ?? DEFAULT_REPO}#artgen-dist update\` once, then try again`);
  const files: UpstreamFile[] = [], patches: string[] = [];
  for (const [installed, hash] of Object.entries(m.files)) {
    const f = join(root, installed);
    if (!existsSync(f)) { files.push({ installed, source: m.sources[installed], status: 'deleted', note: 'deleted here; remove it in the source by hand if that is meant' }); continue; }
    const cur = readFileSync(f);
    if (sha(cur) === hash) continue;
    const source = m.sources[installed];
    if (!source) { files.push({ installed, status: 'built', note: 'built from the sources, not copied: change the source it is built from' }); continue; }
    if (cur.includes(0)) { files.push({ installed, source, status: 'binary', note: 'not a text file' }); continue; }
    const base = await baseOf(m.version, installed, o);
    if (!base) { files.push({ installed, source, status: 'no-base', note: `the file as installed (${m.version}) could not be fetched: pass --base <the artgen-dist folder at that version>` }); continue; }
    const patch = unifiedDiff(source, unfill(base.toString('utf8')), unfill(cur.toString('utf8')));
    const drift = sha(base) !== hash ? `the base is not the file as installed (hash ${sha(base)}, installed ${hash}): the patch may include changes from another release` : undefined;
    if (!patch) { files.push({ installed, source, status: 'same', note: 'edited only where the build fills in a value' }); continue; }
    patches.push(patch);
    files.push({ installed, source, status: 'patch', ...(drift && { note: drift }) });
  }
  const patch = patches.join('');
  let out: string | undefined;
  if (patch) {
    const date = (o.now ?? new Date()).toISOString().slice(0, 10);
    out = resolve(o.out ?? join(root, existsSync(join(root, 'art')) ? join('art', 'feedback') : '.', `upstream-${date}.patch`));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, patch);
  }
  return { version: m.version, patch, files, ...(out && { out }) };
}
