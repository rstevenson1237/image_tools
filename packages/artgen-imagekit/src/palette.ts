/**
 * Palette: the colours of a picture, a picture snapped to a palette, and palette files. The extraction and the snapping are the
 * primitives layer's (the art direction reads palettes with them too); this adds the picture and file formats the tools need.
 */
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { extractPalette as extract, parseGpl, parseHexPalette, type Ramps } from 'artgen-primitives/lib/palette.ts';
import { quantize, type Dither } from 'artgen-primitives/lib/post.ts';
import { normHex } from 'artgen-primitives/lib/color.ts';
import type { Pixels } from './mask.ts';

export type { Dither, Ramps };

const grid = (img: Pixels): Grid => (img instanceof Grid ? img : new Grid(img.w, img.h, Uint8ClampedArray.from(img.d as ArrayLike<number>)));

/** The `n` dominant colours of a picture's opaque pixels (median cut), and those colours grouped into ramps, lightest first. */
export function paletteOf(img: Pixels, n = 16): { colors: string[]; ramps: Ramps } { return extract(grid(img), n); }

/** A picture with every opaque pixel snapped to the nearest colour of `colors` (alpha becomes 0 or 255), optionally ordered-dithered. */
export function snapToPalette(img: Pixels, colors: string[], o: { dither?: Dither; alphaCut?: number } = {}): { w: number; h: number; d: Uint8ClampedArray } {
  if (!colors.length) throw new Error('snapToPalette: the palette has no colours');
  const g = quantize(grid(img), colors.map(normHex), o);
  return { w: g.w, h: g.h, d: g.d };
}

/** Lospec `.hex`: one `rrggbb` per line. */
export const formatHex = (colors: string[]): string => colors.map(c => normHex(c).slice(1)).join('\n') + '\n';

/** GIMP `.gpl`: a header, then `R G B name` rows. */
export function formatGpl(colors: string[], name = 'artgen'): string {
  const rows = colors.map((c, i) => {
    const h = normHex(c), v = [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
    return `${String(v[0]).padStart(3)} ${String(v[1]).padStart(3)} ${String(v[2]).padStart(3)} ${h} (${i + 1})`;
  });
  return `GIMP Palette\nName: ${name}\nColumns: 8\n#\n${rows.join('\n')}\n`;
}

/** Colours from the text of a `.hex` or `.gpl` file (the format is read from the text). */
export const parsePaletteText = (text: string): string[] => (/^GIMP Palette/m.test(text) ? parseGpl(text) : parseHexPalette(text));

/** A strip of swatches, one square per colour, as a picture. */
export function swatchImage(colors: string[], cell = 8): { w: number; h: number; d: Uint8ClampedArray } {
  const g = new Grid(Math.max(1, colors.length) * cell, cell);
  colors.forEach((c, i) => g.fill(i * cell, 0, cell, cell, c));
  return { w: g.w, h: g.h, d: g.d };
}
