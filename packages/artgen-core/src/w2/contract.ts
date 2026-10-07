/**
 * Animation contract (`art/contracts/<id>.json`): the part of an exported asset that game code depends on — state
 * names, the number of logical frames per state, each frame's duration, looping, facings and anchor names. Written
 * the first time an asset is exported, then frozen: a later base revision, finish or restyle may redraw every pixel
 * but may not change the contract, so gameplay that keys on "frame 3 of attack" keeps landing the same hit.
 * Additions (a new state, facing or anchor) extend it; anything else needs an explicit `--break-contract`.
 */
import { FACINGS } from '../render.ts';
import type { Direction } from '../direction.ts';
import type { BriefEntry } from './briefs.ts';
import { frameDurations, stateDefs, type PackAsset } from './pack.ts';

export interface StateContract { frames: number; /** ms per frame */ durations: number[]; loop: boolean }

export interface AnimContract {
  format: 1;
  asset: string;
  facings: string[];
  states: Record<string, StateContract>;
  /** Anchor names game code may attach to. Positions are not part of the contract: they move with the drawing. */
  anchors: string[];
}

export interface ContractDiff {
  /** Changes that would break game code written against the old contract. */
  breaking: string[];
  /** States, facings or anchors the new export adds. */
  added: string[];
}

const states = (defs: PackAsset['states']): Record<string, StateContract> =>
  Object.fromEntries(Object.entries(defs).map(([s, d]) => [s, { frames: d.frames, durations: frameDurations(d), loop: d.loop }]));

/** The contract an exported asset satisfies. */
export function contractOf(id: string, a: PackAsset): AnimContract {
  return { format: 1, asset: id, facings: [...a.facings], states: states(a.states), anchors: Object.keys(a.anchors ?? {}).sort() };
}

/**
 * The contract a brief asks for, without rendering (anchors unknown: kept from `old`). Used to refuse a brief edit
 * that would break an exported asset before any pass runs.
 */
export function briefContract(b: BriefEntry, dir: Direction, old?: AnimContract): AnimContract {
  const names = b.states?.length ? b.states : ['idle'];
  const frames = Object.fromEntries(names.map(s => [s, b.anims?.[s]?.frames ?? 1]));
  return { format: 1, asset: b.id, facings: [...(FACINGS[b.directions ?? 1] ?? [])], states: states(stateDefs(b, dir, frames)), anchors: old?.anchors ?? [] };
}

/** Compare a new contract against the frozen one. */
export function diffContract(old: AnimContract, next: AnimContract): ContractDiff {
  const breaking: string[] = [], added: string[] = [];
  for (const [s, o] of Object.entries(old.states)) {
    const n = next.states[s];
    if (!n) { breaking.push(`state "${s}" removed`); continue; }
    if (n.frames !== o.frames) breaking.push(`state "${s}": ${o.frames} → ${n.frames} logical frames`);
    else if (n.durations.some((d, i) => d !== o.durations[i])) breaking.push(`state "${s}": frame durations ${o.durations.join(',')} → ${n.durations.join(',')} ms`);
    if (n.loop !== o.loop) breaking.push(`state "${s}": loop ${o.loop} → ${n.loop}`);
  }
  for (const s of Object.keys(next.states)) if (!old.states[s]) added.push(`state "${s}"`);
  for (const f of old.facings) if (!next.facings.includes(f)) breaking.push(`facing "${f}" removed`);
  for (const f of next.facings) if (!old.facings.includes(f)) added.push(`facing "${f}"`);
  for (const a of old.anchors) if (!next.anchors.includes(a)) breaking.push(`anchor "${a}" removed`);
  for (const a of next.anchors) if (!old.anchors.includes(a)) added.push(`anchor "${a}"`);
  return { breaking, added };
}
