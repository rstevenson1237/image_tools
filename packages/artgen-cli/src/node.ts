/** Node I/O adapter for artgen-core: resvg wasm init, PNG files, ledger appends, asset source loading. */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { decodePNG, encodePNG, formatLedgerLine, initSvg, type Grid, type LedgerEntry } from 'artgen-core';

const require = createRequire(import.meta.url);

/** Initialise the SVG rasteriser from the installed `@resvg/resvg-wasm` wasm file. */
export function initNodeSvg(): Promise<void> {
  return initSvg(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
}

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
