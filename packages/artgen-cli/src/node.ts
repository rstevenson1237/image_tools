/** Node I/O adapter for artgen-core: resvg wasm init, PNG files, ledger appends, asset source loading. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG, formatLedgerLine, initSvg, map, setSvgFonts, type Grid, type LedgerEntry } from 'artgen-core';

const require = createRequire(import.meta.url);

/**
 * Initialise the SVG rasteriser: the committed install ships `resvg.wasm` next to the bundled `artgen.js`; in this
 * repo it comes from the installed `@resvg/resvg-wasm` package.
 */
export function initNodeSvg(): Promise<void> {
  const local = fileURLToPath(new URL('./resvg.wasm', import.meta.url));
  return initSvg(readFileSync(existsSync(local) ? local : require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
}

export const MAP_FONTS = ['AlegreyaSans-Regular.ttf', 'AlegreyaSans-Bold.ttf', 'AlegreyaSans-Italic.ttf'];

/**
 * The SVG rasteriser plus the map label fonts: the committed install ships them in `fonts/` next to `artgen.js`; in
 * this repo they are `artgen-core/assets/fonts`.
 */
export async function initNodeMapSvg(): Promise<void> {
  await initNodeSvg();
  const local = fileURLToPath(new URL('./fonts/', import.meta.url)), dir = existsSync(join(local, MAP_FONTS[0])) ? local : fileURLToPath(new URL('../../artgen-core/assets/fonts/', import.meta.url));
  setSvgFonts(MAP_FONTS.map(f => new Uint8Array(readFileSync(join(dir, f)))), map.FONT_FAMILY);
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
