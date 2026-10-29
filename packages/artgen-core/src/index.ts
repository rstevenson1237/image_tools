/** artgen engine facade: the artgen layer (direction-driven pipeline, QA, workflows) plus everything the lower layers export, so existing imports keep working. */
export const name = 'artgen-core';

export * from 'artgen-primitives';
export * from 'artgen-scene';
export * from 'artgen-workflow';
export { map, dungeon, settlement, subjects, mapDirection } from 'artgen-mapgen';
export * from './render.ts';
export * from './qa/metrics.ts';
export * from './qa/conformance.ts';
export * from './qa/sheet.ts';
export * from './qa/tiles.ts';
export * from './qa/anim.ts';
export * from './pipeline.ts';
export { applyFinish, finishSnapshot, finishStale, makePx, type FinishModule, type FinishContext, type PatchRecord, type Px } from './finish.ts';
export * from './w1/candidates.ts';
export { styleTile, styleSheet, wrap, paletteLuma, type ProbeImages, type StyleTileColumn } from './w1/sheets.ts';
export * from './w2/briefs.ts';
export * from './w2/pack.ts';
export * from './w2/contract.ts';
export * from './w2/roster.ts';
export * from './w2/recommend.ts';
export * from './w2/edit.ts';
export * from './w2/config.ts';
