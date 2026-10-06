/**
 * artlab T3's SVG raster path on resvg (wasm), kept as an engine internal: it becomes T2+ `ss` mode (R3).
 * Modes: 'raw' (resvg AA, as-is) | 'crisp' (AA → palette quantize + alpha cut)
 *        'ss' (rasterise at ss×, quantize to the asset palette, mode-downsample, then outline at final res).
 * The wasm module must be initialised once with `initSvg` (the Node adapter and the UI worker do this).
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { Grid } from './grid.ts';
import * as post from './post.ts';

let ready: Promise<void> | null = null, initialised = false;

/** Initialise resvg with the wasm bytes or module (`@resvg/resvg-wasm/index_bg.wasm`). Safe to call repeatedly. */
export function initSvg(wasm: Parameters<typeof initWasm>[0]): Promise<void> {
  ready ??= initWasm(wasm).then(() => { initialised = true; });
  return ready;
}

export const svgReady = (): boolean => initialised;

/** Rasterise an SVG document at w×h (the root is scaled to fit the width). Returns straight (non-premultiplied) RGBA. */
export function rasterizeSvg(svg: string, w: number, h: number): Grid {
  if (!initialised) throw new Error('SVG rasteriser not initialised: call initSvg(wasm) first');
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: false } });
  const img = r.render(), px = img.pixels, iw = img.width, ih = img.height, g = new Grid(w, h);
  for (let y = 0; y < Math.min(h, ih); y++) for (let x = 0; x < Math.min(w, iw); x++) {
    const s = (y * iw + x) * 4, a = px[s + 3];
    if (!a) continue;
    const i = (y * w + x) * 4;
    g.d[i] = (px[s] * 255) / a; g.d[i + 1] = (px[s + 1] * 255) / a; g.d[i + 2] = (px[s + 2] * 255) / a; g.d[i + 3] = a;
  }
  img.free(); r.free();
  return g;
}

export type StageHook = (name: string, g: Grid) => void;

export interface SvgToGridOptions {
  mode?: 'raw' | 'crisp' | 'ss';
  ss?: number;
  /** Palette for 'crisp' / 'ss' quantize (the asset-restricted palette). */
  pal?: string[];
  /** Outline colour, or false / omitted for none. */
  outline?: string | false;
  /** Drop-shadow offset and colour. */
  shadow?: [number, number] | null;
  shadowColor?: string;
  /** Receives each intermediate grid (`--stages`, R8). */
  stage?: StageHook;
}

export function svgToGrid(svg: string, w: number, h: number, { mode = 'raw', ss = 8, pal, outline, shadow, shadowColor, stage }: SvgToGridOptions = {}): Grid {
  let g: Grid;
  const need = () => { if (!pal?.length) throw new Error(`svgToGrid: mode '${mode}' needs a palette`); return pal; };
  if (mode === 'raw') { g = rasterizeSvg(svg, w, h); stage?.('raster', g); }
  else if (mode === 'crisp') {
    const r = rasterizeSvg(svg, w, h); stage?.('raster', r);
    g = post.quantize(r, need()); stage?.('quantize', g);
  } else {
    const r = rasterizeSvg(svg, w * ss, h * ss); stage?.('raster', r);
    const q = post.quantize(r, need()); stage?.('quantize', q);
    g = post.modeDownsample(q, ss); stage?.('downsample', g);
  }
  if (outline) { g = post.outline(g, outline); stage?.('outline', g); }
  if (shadow) {
    if (!shadowColor) throw new Error('svgToGrid: shadow needs shadowColor');
    g = post.dropShadow(g, shadow[0], shadow[1], shadowColor); stage?.('shadow', g);
  }
  return g;
}

/** Build an SVG document from element strings. */
export const doc = (w: number, h: number, body: string, extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;
