/** Node I/O adapter for artgen-core: resvg wasm init, PNG files, ledger appends, asset source loading. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePNG, encodePNG, type Grid } from 'artgen-core';

export { initNodeMapSvg, initNodeSvg, MAP_FONTS } from './node-svg.ts';
/** One implementation, in the workflow module, which the maps-only bundle holds too. */
export { appendLedger } from './workflow.ts';

export function writeGrid(path: string, g: Grid): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(g));
}

export const readGrid = (path: string): Grid => decodePNG(new Uint8Array(readFileSync(path)));
