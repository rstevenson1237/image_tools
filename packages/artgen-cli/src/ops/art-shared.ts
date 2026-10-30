/** What the pixel-art operations share: parameters every asset operation takes, the size and brief readers, the tool-direction lookup and the text tables. Node is allowed here (the maps bundle never imports this file). */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { encodePNG, parseDirection, validateDirection, type Grid, type Size } from 'artgen-core';
import { resolveDirection } from '../bench.ts';
import { versionsIn, type AssetDir } from '../asset.ts';
import { readJson, type Project } from '../projectfs.ts';
import { p, type Content, type Ctx, type Param } from './registry.ts';
import { pngFile, text } from './maps-shared.ts';
import type { projectStatus, WorkPacket } from '../w2.ts';

export { pngFile, text };
export type Inp = Record<string, any>;

/** An image result: the grid as a PNG. */
export const image = (g: Grid): Content => ({ type: 'image', data: Buffer.from(encodePNG(g)).toString('base64'), mimeType: 'image/png' });

/** Why the direction commands (W1) are not MCP tools. */
export const W1 = 'W1 runs through the art-direction skill and the CLI';
/** The reason for the operations that read a file by path. */
export const BY_PATH = 'reads a file by path outside the art/ sandbox';

// ---- parameters
const STR_LIST = { type: 'array', items: { type: 'string' } };
/** The asset every pipeline operation works on: a brief id or an asset directory. */
export const assetParam = (doc = 'the asset: a brief id (art/briefs.yaml) or an asset directory, e.g. art/probes/character'): Param => p.str(doc, { positional: true, required: true });
/** `--direction`: a direction file or a bench direction name, in place of the project's locked direction. */
export const directionParam = (): Param => p.str('a direction file (or a bench direction: benchmark, alt) in place of the locked one');
/** `--ledger`: the ledger file to log to (the command line only). */
export const ledgerParam = (): Param => p.str('the ledger file to log to (default: art/ledger.jsonl)', { mcp: false });
/** The brief ids a project operation is limited to (`ids…` on the command line, a list on MCP). */
export const idsParam = (doc = 'brief ids; default all'): Param => p.str(doc, { positional: 'rest', schema: STR_LIST });
/** `--version`: which version of the asset; the default is the latest. */
export const versionParam = (doc = 'base.vN or finish.vM; default the latest'): Param => p.str(doc);

/** The options `ctx.asset` takes from an operation's input. */
export const assetOpts = (i: Inp): { direction?: string; ledger?: string } => ({ direction: i.direction, ledger: i.ledger });
/** The asset an operation works on, opened. */
export const assetOf = (ctx: Ctx, i: Inp): AssetDir => ctx.asset!(i.asset, assetOpts(i));
/** The version to work on: the one named, else the latest. With none, the command line says so; MCP passes `undefined` on, as it always has (`mcpEmpty`: unless the tool refused). */
export function versionOf(ctx: Ctx, a: AssetDir, i: Inp, mcpEmpty?: string): string {
  if (typeof i.version === 'string') return i.version;
  const vs = versionsIn(a);
  if (!vs.length && ctx.surface === 'cli') throw new Error(`${i.asset}: no base.vN.js yet`);
  if (!vs.length && mcpEmpty) throw new Error(`${i.asset}: ${mcpEmpty}`);
  return vs[vs.length - 1];
}

/** `--size 8x6` (or MCP's `[8, 6]`) as a size; a bare number is square. */
export const sizeOf = (v: unknown, d = 32): Size => {
  if (Array.isArray(v) && v.length === 2) return [Number(v[0]), Number(v[1])];
  const m = typeof v === 'string' ? v.match(/^(\d+)x(\d+)$/) : null;
  return m ? [+m[1], +m[2]] : [Number(v ?? d), Number(v ?? d)];
};
/** A brief's or asset's `--size`: `WxH` as a pair, else the size key as given. */
export const sizeKey = (s?: string): string | Size | undefined => {
  const m = s?.match(/^(\d+)x(\d+)$/);
  return m ? [+m[1], +m[2]] : s;
};

/** The project's direction for the standalone generators (texture, fx): a clear error until one is locked. */
export function toolDirection(cmd: string, project: Project | null, override: string | undefined) {
  const file = override ?? (project ? join(project.art, 'direction.json') : undefined);
  const fix = 'lock one first (artgen direction candidates → tile → lock, or /artgen-direction in Claude Code), or pass --direction <file|benchmark>';
  if (override && !existsSync(override) && ['benchmark', 'alt'].includes(override)) return { p: project, dir: resolveDirection(override) };
  if (override && !existsSync(override)) throw new Error(`${cmd}: --direction ${override}: no such file (or bench direction: benchmark, alt)`);
  if (!file || !existsSync(file)) throw new Error(`${cmd}: no art direction found — ${fix}`);
  const raw = readJson<any>(file), v = validateDirection(raw);
  if (!v.ok) throw new Error(raw?.status === 'draft' && !override ? `${cmd}: the art direction is still a draft — ${fix}` : `${cmd}: ${file} is not a valid direction:\n  ${v.errors.join('\n  ')}`);
  return { p: project, dir: parseDirection(raw) };
}

/** A step as the tables name it: `review base.v1`, `stage-gate shape base.v1`. */
export const stepName = (s: { action: string; version?: string; stage?: string }): string => (s.action === 'stage-gate' ? `${s.action} ${s.stage}${s.version ? ` ${s.version}` : ''}` : `${s.action} ${s.version ?? ''}`);

/** The status table `status` and `make` print. */
export const statusTable = (rows: Awaited<ReturnType<typeof projectStatus>>): string => rows.map(r => `  ${r.id.padEnd(16)} ${r.status.padEnd(11)} ${r.final ? `${r.final} ${r.score ?? '-'}${r.blind !== undefined ? ` b${r.blind}` : ''}${r.gate === false ? ' GATE FAIL' : ''}${r.belowBar ? ' BELOW BAR' : ''}${r.top ? ` final≠best (${r.top.version} ${r.top.score})` : ''}` : (r.next ? stepName(r.next) : '')}${r.issues.length ? `\n${r.issues.map(i => `      issue: ${i}`).join('\n')}` : ''}`).join('\n');
/** One maker or review packet of a parallel `make` round. */
export const packetLine = (x: WorkPacket): string => `  ${x.id.padEnd(16)} ${stepName(x.step)}${x.writes.length ? ` → writes ${x.writes.join(', ')}` : ''}${x.resume ? ' (resume: written, never reviewed — check it, complete it, review it)' : ''}`;

/** An MCP image result that reads a PNG under the project root. */
export const projectPng = (ctx: Ctx, f: string): Content => pngFile(join(ctx.project().root, f));
