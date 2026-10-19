/** Node side of the SVG rasteriser (resvg wasm, map label fonts); the maps-only bundle imports this and not `node.ts`. */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dungeon as _d, initSvg, map, setSvgFonts } from 'artgen-core/maps';

const require = createRequire(import.meta.url);

/**
 * Initialise the SVG rasteriser: the committed install ships `resvg.wasm` next to the bundled `artgen.js`; in this
 * repo it comes from the installed `@resvg/resvg-wasm` package.
 */
export function initNodeSvg(): Promise<void> {
  const local = fileURLToPath(new URL('./resvg.wasm', import.meta.url));
  let file = local;
  if (!existsSync(local)) {
    // the maps-only bundle may be installed without it (SVG needs no rasteriser); say which file PNG is missing
    try { file = require.resolve('@resvg/resvg-wasm/index_bg.wasm'); } catch {
      throw new Error(`PNG output needs resvg.wasm next to this script (${local}) — copy it from artgen-dist maps/, or render --format svg`);
    }
  }
  return initSvg(readFileSync(file));
}

export const MAP_FONTS = ['AlegreyaSans-Regular.ttf', 'AlegreyaSans-Bold.ttf', 'AlegreyaSans-Italic.ttf'];

/**
 * The SVG rasteriser plus the map label fonts: the committed install ships them in `fonts/` next to `artgen.js`; in
 * this repo they are `artgen-core/assets/fonts`.
 */
export async function initNodeMapSvg(): Promise<void> {
  await initNodeSvg();
  const local = fileURLToPath(new URL('./fonts/', import.meta.url)), dir = existsSync(join(local, MAP_FONTS[0])) ? local : fileURLToPath(new URL('../../artgen-core/assets/fonts/', import.meta.url));
  // fonts are optional in the maps-only bundle: a PNG without them has no text (SVG labels use the renderer's CSS font list)
  if (!MAP_FONTS.every(f => existsSync(join(dir, f)))) { console.error(`note: no fonts/ next to this script (${local}); labels are left out of the PNG`); return; }
  setSvgFonts(MAP_FONTS.map(f => new Uint8Array(readFileSync(join(dir, f)))), map.FONT_FAMILY);
}
