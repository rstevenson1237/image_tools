/**
 * Stages on disk (docs/STAGES.md §5): the placeholder (`placeholder.json`, `out/placeholder.png`), the shape sheet, the
 * `stages` report and the user's verdicts on a gate (`stage approve | reject`). The pure parts are in artgen-core
 * (keys, checks, the placeholder module) and artgen-workflow (verdicts, gates); this file does the I/O.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  defaultPlaceholder, imageTokens, parseVersion, placeholderChecks, placeholderKey, placeholderModule, renderAsset, shapeSheet, STAGES, stageState, stageVerdicts,
  type BriefEntry, type Placeholder, type StageCheck, type StageKeys, type StageId,
} from 'artgen-core';
import type { GateStage } from 'artgen-core';
import { effectivePlaceholder, gatesOf, ledgerFor, outDir, passOf, passState, placeholderPath, readPlaceholder, relPath, renderVersion, type AssetDir } from './asset.ts';
import { strip } from './bench.ts';
import { appendLedger, writeGrid } from './node.ts';
import { projectConfig } from './project.ts';
import { ensureAssetDir } from './w2.ts';

export interface PlaceholderResult { file: string; png: string; key: string; placeholder: Placeholder; checks: StageCheck[] }

/**
 * Write `placeholder.json` (the brief's defaults, with `size`, `pivot` and `ramp` overridden when given), render it to
 * `out/placeholder.png` at the review scale and check it. Works on a brief with no versions: it creates the asset folder
 * and `brief.json` the way `new` does, without `base.v1.js`. Refuses to overwrite a file unless `force`.
 */
export function placeholderRun(a: AssetDir, o: { force?: boolean; size?: [number, number]; pivot?: [number, number]; ramp?: string } = {}): PlaceholderResult {
  const file = placeholderPath(a);
  if (existsSync(file) && !o.force) throw new Error(`${a.brief.id}: ${file} exists — pass --force to write the defaults over it`);
  if (a.project) ensureAssetDir(a.project, a.brief as BriefEntry, a.dir); else mkdirSync(a.path, { recursive: true });
  const ph: Placeholder = { ...defaultPlaceholder(a.brief, a.dir), ...(o.size && { size: o.size }), ...(o.pivot && { pivot: o.pivot }), ...(o.ramp && { ramp: o.ramp }) };
  writeFileSync(file, JSON.stringify(ph, null, 2) + '\n');
  const r = renderAsset(placeholderModule(ph), { dir: a.dir, brief: a.brief }), png = join(outDir(a), 'placeholder.png'), sc = a.brief.review?.scale ?? 4;
  writeGrid(png, strip(r).scale(sc));
  const key = placeholderKey(ph);
  appendLedger(a.ledgerPath, { type: 'stage', asset: a.brief.id, stage: 'placeholder', event: 'written', key, by: 'agent' });
  return { file, png, key, placeholder: ph, checks: placeholderChecks(ph, a.brief, a.dir) };
}

export type StageState = 'approved' | 'changed' | 'new' | 'rejected' | 'n/a';
export interface StagesReport {
  id: string;
  version: string;
  keys: StageKeys;
  /** Per stage: why it has no key, or its approval state. */
  states: Record<StageId, StageState>;
  checks: StageCheck[];
  gates: GateStage[];
}

const WHY_NA: Record<StageId, string> = {
  placeholder: 'no placeholder', shape: 'no shape', rig: 'not rigged', decorate: '', decal: 'no decals', lighting: 'no normal maps', rotation: 'not rotated', animation: '',
};
export const whyNotApplicable = (s: StageId): string => WHY_NA[s];

/**
 * The stages of a version (`artgen stages`): each stage's key and whether the user approved it as it is now. Gated stages
 * (placeholder, shape) compare with the latest verdict; the later stages with the keys copied onto the latest approval.
 */
export async function stagesRun(a: AssetDir, version: string): Promise<StagesReport> {
  const r = await renderVersion(a, version), ledger = ledgerFor(a), keys = r.stages.keys;
  const approval = [...ledger].reverse().find(e => e.type === 'approve' && e.by === 'user' && e.stages && typeof e.stages === 'object');
  const states = Object.fromEntries(STAGES.map((s): [StageId, StageState] => {
    const key = keys[s];
    if (key === undefined) return [s, 'n/a'];
    if (s === 'placeholder' || s === 'shape') {
      const sv = stageState(ledger, s);
      if (sv.latest?.key === key) return [s, sv.latest.verdict === 'approve' ? 'approved' : 'rejected'];
      return [s, stageVerdicts(ledger, s).some(v => v.verdict === 'approve') ? 'changed' : 'new'];
    }
    const was = (approval?.stages as StageKeys | undefined)?.[s];
    return [s, was === undefined ? 'new' : was === key ? 'approved' : 'changed'];
  })) as Record<StageId, StageState>;
  return { id: a.brief.id, version, keys, states, checks: r.stages.checks, gates: gatesOf(a) };
}

/**
 * Record the user's verdict on a gate. Approve refuses when a check of that stage fails (`force` overrides and records
 * `forced`). The version defaults to the one the pending stage-gate names, else the latest scored base; the key comes from
 * that version's render (shape) or the placeholder in effect (placeholder).
 */
export async function stageVerdict(a: AssetDir, stage: GateStage, verdict: 'approve' | 'reject', o: { version?: string; note?: string; via?: string; force?: boolean } = {}): Promise<{ entry: Record<string, unknown>; checks: StageCheck[] }> {
  let version = o.version, key: string, checks: StageCheck[];
  if (stage === 'placeholder') {
    const ph = effectivePlaceholder(a);
    key = placeholderKey(ph); checks = placeholderChecks(ph, a.brief, a.dir);
    version = undefined;
  } else {
    if (!version) {
      const next = (await passState(a)).next;
      version = next.action === 'stage-gate' && next.stage === stage ? next.version : undefined;
      if (!version) {
        const scored = ledgerFor(a).filter(e => e.type === 'score' && !e.blind && e.version && parseVersion(e.version)?.kind === 'base').map(e => parseVersion(e.version!)!);
        version = scored.sort((x, y) => x.n - y.n).pop()?.name;
      }
      if (!version) throw new Error(`${a.brief.id}: no scored base to ${verdict} the ${stage} of — pass --version`);
    }
    const r = await renderVersion(a, version);
    key = r.stages.keys.shape!; checks = r.stages.checks.filter(c => c.stage === 'shape');
  }
  const failing = checks.filter(c => c.status === 'fail');
  if (verdict === 'approve' && failing.length && !o.force) throw new Error(`${a.brief.id}: the ${stage} checks fail (${failing.map(c => `${c.id}: ${c.detail}`).join('; ')}) — fix it, or pass --force to approve it as it is`);
  const entry = {
    type: 'stage' as const, asset: a.brief.id, stage, verdict, key, ...(version && { version }), ...(o.note && { note: o.note }),
    ...(verdict === 'approve' && failing.length && { forced: true }), by: 'user' as const, ...(o.via && { via: o.via }),
  };
  appendLedger(a.ledgerPath, entry);
  return { entry, checks };
}

/** The shape sheet of a version (`review --stage shape`): logged as a `review` entry with `stage: 'shape'`. */
export async function shapeReview(a: AssetDir, version: string): Promise<{ path: string; tokens: number; render: Awaited<ReturnType<typeof renderVersion>>; stage: 'shape'; checks: StageCheck[] }> {
  const cur = await renderVersion(a, version), cfg = a.project ? projectConfig(a.project) : undefined;
  let placeholder: Placeholder | undefined;
  try { placeholder = readPlaceholder(a); } catch { /* reported by `artgen placeholder` */ }
  const checks = cur.stages.checks.filter(c => c.stage === 'shape'), R = a.brief.review ?? {};
  const sheet = shapeSheet(cur.render, a.dir, { title: `${R.label ?? a.brief.id} - ${version} shape`, placeholder, checks, maxEdge: cfg?.budget?.maxSheetEdge });
  const path = join(outDir(a), `shape-${version}.png`), tokens = imageTokens(sheet.w, sheet.h);
  mkdirSync(dirname(path), { recursive: true });
  writeGrid(path, sheet);
  appendLedger(a.ledgerPath, { type: 'review', asset: a.brief.id, version, pass: passOf(a, version), stage: 'shape', sheet: relPath(a, path), imageTokens: tokens, by: 'agent' });
  return { path, tokens, render: cur, stage: 'shape', checks };
}
