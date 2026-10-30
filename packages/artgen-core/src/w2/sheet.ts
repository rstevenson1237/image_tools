/**
 * The one-page data sheet of an asset (docs/WORKFLOW.md §8): what the brief asks for, as a person reads and signs it off: kind,
 * view, size in pixels and px per metre, states, facings, frames and fps per state, template, budget, the kind's palette, the
 * animation contract when there is one, and the references. The page itself (markdown, picture) is `artgen-workflow`'s.
 */
import type { DataSheet } from 'artgen-workflow/sheet.ts';
import { kindPalette, pxPerMetre, resolveSize, type Direction } from 'artgen-scene/direction.ts';
import { FACINGS } from '../render.ts';
import type { BriefEntry } from './briefs.ts';
import type { AnimContract } from './contract.ts';
import type { AssetBudget } from './config.ts';
import { stateDefs } from './pack.ts';

/** Words of the brief's notes kept on the sheet. */
const NOTE_WORDS = 60;

export function assetDataSheet(brief: BriefEntry & { template?: string }, dir: Direction, budget: AssetBudget, contract?: AnimContract): DataSheet {
  const [w, h] = resolveSize(dir, brief.size, brief.kind), ppm = pxPerMetre(dir), names = brief.states?.length ? brief.states : ['idle'];
  const defs = stateDefs(brief, dir, Object.fromEntries(names.map(s => [s, brief.anims?.[s]?.frames ?? 1]))), facings = FACINGS[brief.directions ?? 1] ?? ['s'];
  const frames = names.map(s => `${s} ${defs[s].frames} frame${defs[s].frames === 1 ? '' : 's'}${defs[s].frames > 1 ? ` at ${defs[s].fps} fps` : ''}${defs[s].loop ? ', loops' : ''}`);
  const words = (brief.notes ?? '').trim().split(/\s+/).filter(Boolean), notes = words.length > NOTE_WORDS ? `${words.slice(0, NOTE_WORDS).join(' ')} ...` : words.join(' ');
  return {
    title: `${brief.id} — ${brief.kind}`, subject: brief.id,
    rows: [
      { label: 'Kind', value: brief.kind }, { label: 'Importance', value: brief.importance ?? 'standard' }, { label: 'View', value: brief.view ?? dir.camera.view },
      { label: 'Size', value: `${w}x${h} px, ${Math.round(ppm * 10) / 10} px per metre${brief.height ? `; ${brief.height} m tall is about ${Math.round(brief.height * ppm)} px` : ''}` },
      { label: 'States', value: names.join(', ') }, { label: 'Facings', value: `${facings.length}: ${facings.join(' ')}` }, { label: 'Frames', value: frames.join('; ') },
      { label: 'Template', value: brief.template ?? '-' },
      { label: 'Budget', value: `${budget.revisionPasses} revision passes, ${budget.maxUserIterations} user iterations${budget.maxImageTokens ? `, ${budget.maxImageTokens} image tokens` : ''}` },
    ],
    ...(contract && { must: [
      { text: `facings ${contract.facings.join(' ')}` },
      ...Object.entries(contract.states).map(([s, c]) => ({ text: `${s}: ${c.frames} frame${c.frames === 1 ? '' : 's'}, ${c.durations.join('/')} ms${c.loop ? ', loops' : ''}` })),
      ...(contract.anchors.length ? [{ text: `anchors ${contract.anchors.join(', ')}` }] : []),
    ] }),
    swatches: kindPalette(dir, brief.kind),
    ...(brief.refs?.length && { refs: [...brief.refs] }),
    ...(notes && { notes }),
  };
}
