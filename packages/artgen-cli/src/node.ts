/** Node I/O adapter for artgen-core: resvg wasm init, PNG files, ledger appends, asset source loading. */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePNG, encodePNG, formatLedgerLine, type Grid, type LedgerEntry } from 'artgen-core';

export { initNodeMapSvg, initNodeSvg, MAP_FONTS } from './node-svg.ts';

export function writeGrid(path: string, g: Grid): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(g));
}

export const readGrid = (path: string): Grid => decodePNG(new Uint8Array(readFileSync(path)));

/** Append one entry to a `ledger.jsonl` (created with its folder if missing). */
export function appendLedger(path: string, entry: Omit<LedgerEntry, 'ts'> & { ts?: string }): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, formatLedgerLine({ ts: new Date().toISOString(), ...entry } as LedgerEntry) + '\n');
}
