/**
 * Operations the page can run itself (R8): the user's decisions and one read. Each takes the arguments the registry declares for it
 * (the values of a generated form), applies the CLI's rules through the project store and returns what to show. Anything else in
 * the Commands tool only builds the `artgen …` line for Claude Code or a terminal.
 */
import type { GateStage } from 'artgen-core';
import type { ArtgenApi } from '../../workers/artgen.worker';
import { project } from '../project/store.svelte';
import type { Remote } from 'comlink';
import type { FormValues } from './forms';

export const RUNNABLE = ['stages', 'stage.approve', 'stage.reject', 'approve'] as const;
export const runnable = (name: string): boolean => (RUNNABLE as readonly string[]).includes(name);

const str = (v: FormValues, k: string): string => (typeof v[k] === 'string' ? (v[k] as string).trim() : '');

/** Run a runnable operation on the open project; returns the text to show. Throws the CLI's message when the arguments are wrong. */
export async function runOp(api: Remote<ArtgenApi>, name: string, v: FormValues): Promise<string> {
  const id = str(v, 'asset') || str(v, 'id');
  if (!id) throw new Error('name the asset');
  if (name === 'stages') {
    const a = await project.sync(api), version = str(v, 'version');
    if (!version) throw new Error('stages: pick a version (--version)');
    return JSON.stringify(await a.stages(id, version), null, 2);
  }
  if (name === 'approve') {
    const r = await project.approve(api, id, str(v, 'note'));
    if (!r) throw new Error(project.error ?? 'not approved');
    return `approved ${id} ${r.entry.version}`;
  }
  const stage = str(v, 'stage');
  if (stage !== 'placeholder' && stage !== 'shape') throw new Error('stage: placeholder | shape');
  const verdict = name === 'stage.approve' ? 'approve' : 'reject';
  const r = await project.stageVerdict(api, id, stage as GateStage, verdict, { version: str(v, 'version') || undefined, note: str(v, 'note'), force: v.force === true });
  if (!r) throw new Error(project.error ?? 'no verdict recorded');
  return `${verdict === 'approve' ? 'approved' : 'rejected'} the ${stage} of ${id}${r.entry.version ? ` ${r.entry.version}` : ''} (key ${r.entry.key})`;
}
