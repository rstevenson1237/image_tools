/**
 * The image tools' operations (docs/TOOLING-PLAN.md §6b, R5b): `trace`, `slice` and `quantize` read a picture by path and
 * write files beside it, so no project is needed. They are the same functions the web tools run (`artgen-imagekit`), declared once for
 * the CLI and Python. They are in the core module, so the maps-only bundle has them too (a traced outline feeds `map trace`).
 * `cut` and `trace-base` need the asset pipeline and are in `art-image.ts`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { crop, formatGpl, formatHex, paletteOf, parsePaletteText, sliceGrid, sliceSprites, snapToPalette, traceImage, traceToSvg, type TraceOptions, type TraceResult } from 'artgen-imagekit';
import { decodePNG, encodePNG, Grid, normHex } from 'artgen-primitives';
import { defineOp, p } from './registry.ts';

type Inp = Record<string, any>;

/** The picture at `file` (PNG). */
export function readPicture(file: string): Grid {
  if (!existsSync(file)) throw new Error(`${file}: not found`);
  try { return decodePNG(new Uint8Array(readFileSync(file))); } catch (e) { throw new Error(`${file}: ${(e as Error).message} (artgen reads 8-bit PNG files)`); }
}
export function writePicture(file: string, img: { w: number; h: number; d: ArrayLike<number> }): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePNG(img instanceof Grid ? img : new Grid(img.w, img.h, Uint8ClampedArray.from(img.d))));
}
/** `/a/b/goblin.png` → `/a/b/goblin` */
export const stemOf = (file: string): string => join(dirname(file), basename(file, extname(file)));

/** The trace flags shared by `trace`, `trace-base` and `map trace`. */
export const traceParams = () => ({
  threshold: p.str('grey level 0–255 that splits subject from background, or otsu (default: otsu picks one)'),
  invert: p.bool('the lighter region is the subject, not the darker one'),
  blur: p.int('Gaussian blur kernel before the threshold; 0 = none (default 3)'),
  smoothing: p.int('close kernel that seals speckle; 0 = none (default 3)'),
  simplify: p.num('Douglas–Peucker tolerance in pixels; 0 keeps every corner (default 1.5)'),
  min_area: p.num('drop shapes under this area in px² (default 24)'),
  holes: p.bool('trace the holes in a shape (off: outlines only; default on)', { style: 'onoff' }),
  max_paths: p.int('keep at most this many shapes, largest first (default 120)'),
  alpha: p.bool('read only the opaque pixels, so transparent art traces its own shape (default on)', { style: 'onoff' }),
});

/** The imagekit options from those flags. */
export function traceOptions(i: Inp): Partial<TraceOptions> {
  const t = i.threshold;
  if (t !== undefined && t !== 'otsu' && !(Number.isFinite(+t) && +t >= 0 && +t <= 255)) throw new Error('--threshold: otsu or a grey level from 0 to 255');
  return {
    ...(t !== undefined && { threshold: t === 'otsu' ? 'otsu' : +t }), ...(i.invert && { invert: true }),
    ...(i.blur !== undefined && { blur: i.blur }), ...(i.smoothing !== undefined && { smoothing: i.smoothing }),
    ...(i.simplify !== undefined && { simplifyTolerance: i.simplify }), ...(i.min_area !== undefined && { minArea: i.min_area }),
    ...(i.holes !== undefined && { keepHoles: i.holes }), ...(i.max_paths !== undefined && { maxPaths: i.max_paths }),
    ...(i.alpha !== undefined && { respectAlpha: i.alpha }),
  };
}

/** What a trace says about itself. */
export const traceSummary = (t: TraceResult) => ({ width: t.width, height: t.height, shapes: t.shapes.length, holes: t.shapes.reduce((n, s) => n + s.holes.length, 0), dropped: t.droppedCount, threshold: t.thresholdUsed });
const BY_PATH = 'reads a file by path outside the art/ sandbox';

/** A `#rrggbb` colour flag, or a clear error (the SVG writer would otherwise fall back to black without saying so). */
function hexFlag(v: unknown, flag: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${flag}: a colour like #rrggbb`);
  return v;
}

export const trace = defineOp({
  name: 'trace', module: 'core', effect: 'render', summary: 'Trace a picture or sketch to an SVG of closed shapes (outlines and their holes).',
  params: {
    image: p.str('the picture (PNG)', { positional: true, required: 'trace: <image.png> is required' }),
    out: p.str('the SVG to write (default: beside the picture, .svg)'), fill: p.str('the shapes\' colour, #rrggbb (default #000000)'), background: p.str('a background colour, #rrggbb (default none)'),
    ...traceParams(),
  },
  run(i: Inp) {
    const fill = hexFlag(i.fill, '--fill'), background = hexFlag(i.background, '--background'), file = resolve(i.image);
    const t = traceImage(readPicture(file), traceOptions(i)), out = resolve(i.out ?? `${stemOf(file)}.svg`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, traceToSvg(t, { fill, background }));
    return { out, ...traceSummary(t) };
  },
  cli: {
    usage: '       artgen trace <image.png> [--out file.svg] [--threshold otsu|0-255] [--invert] [--blur n] [--smoothing n] [--simplify px] [--min-area px²] [--holes off] [--max-paths n] [--fill #rrggbb] [--background #rrggbb]',
    text: r => `${r.out}: ${r.shapes} shapes${r.holes ? `, ${r.holes} holes` : ''} from a ${r.width}x${r.height} picture (level ${r.threshold}${r.dropped ? `, ${r.dropped} dropped` : ''})\nnext: artgen trace-base <asset> <image> turns it into an asset's base; artgen map trace <map> <image> into a map's ground`,
  },
  mcp: { exclude: BY_PATH }, python: {},
});

export const slice = defineOp({
  name: 'slice', module: 'core', effect: 'render', summary: 'Cut an outside sprite sheet into its sprites (a regular grid, or loose sprites found by their pixels).',
  params: {
    image: p.str('the sprite sheet (PNG)', { positional: true, required: 'slice: <sheet.png> is required' }),
    cols: p.int('cells across (with --rows)'), rows: p.int('cells down (with --cols)'), cell: p.size('cell size, WxH, e.g. 32x32 (instead of --cols and --rows)'),
    auto: p.bool('find loose sprites by their opaque pixels instead of a grid'), gap: p.int('--auto: pixels apart that still count as one sprite (default 1)'), min_size: p.int('--auto: ignore blobs smaller than this either way (default 2)'),
    margin: p.int('grid: pixels around the sheet that belong to no cell (default 0)'), spacing: p.int('grid: pixels between cells (default 0)'),
    skip_empty: p.bool('grid: leave out cells with nothing opaque'), trim: p.bool('grid: shrink each cell to its opaque pixels'),
    out: p.str('the folder to write the cells to (default: <sheet>-slices beside the sheet)'),
  },
  run(i: Inp) {
    const file = resolve(i.image), img = readPicture(file), dir = resolve(i.out ?? `${stemOf(file)}-slices`);
    const cell = Array.isArray(i.cell) ? i.cell : undefined;
    if (i.auto && (cell || i.cols || i.rows)) throw new Error('slice: --auto finds the sprites itself; drop --cols, --rows and --cell');
    const cells = i.auto ? sliceSprites(img, { gap: i.gap, minSize: i.min_size }) : sliceGrid(img, { cols: i.cols, rows: i.rows, cellW: cell?.[0], cellH: cell?.[1], margin: i.margin, spacing: i.spacing, skipEmpty: i.skip_empty, trim: i.trim });
    if (!cells.length) throw new Error(`${i.image}: no sprites found${i.auto ? ' (raise --gap or lower --min-size?)' : ''}`);
    const pad = String(cells.length - 1).length, stem = basename(file, extname(file));
    const files = cells.map(c => ({ ...c, file: `${stem}-${String(c.index).padStart(Math.max(2, pad), '0')}.png` }));
    for (const c of files) writePicture(join(dir, c.file), crop(img, c));
    writeFileSync(join(dir, 'slices.json'), JSON.stringify({ sheet: basename(file), width: img.w, height: img.h, cells: files }, null, 2) + '\n');
    return { dir, sheet: { width: img.w, height: img.h }, cells: files };
  },
  cli: {
    usage: '       artgen slice <sheet.png> --cols n --rows n | --cell WxH | --auto [--gap px] [--min-size px] [--margin px] [--spacing px] [--skip-empty] [--trim] [--out dir]',
    text: r => `${r.dir}: ${r.cells.length} cells from a ${r.sheet.width}x${r.sheet.height} sheet (${r.cells[0].w}x${r.cells[0].h} first) + slices.json`,
  },
  mcp: { exclude: BY_PATH }, python: {},
});

/** Colours from a file (`.hex`, `.gpl`, `.png`, any case) or a `#rgb,#rrggbb,…` list; a file that exists wins over a list that happens to look like one. */
function paletteColors(src: string, n: number): string[] {
  if (existsSync(src)) return /\.png$/i.test(src) ? paletteOf(readPicture(src), n).colors : parsePaletteText(readFileSync(src, 'utf8'));
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})(,#?([0-9a-f]{3}|[0-9a-f]{6}))*$/i.test(src)) return src.split(',').map(c => normHex('#' + c.replace('#', '')));
  throw new Error(`${src}: not found (a .hex, .gpl or .png file, or colours like #ff0000,#00aa11)`);
}

export const quantize = defineOp({
  name: 'quantize', module: 'core', effect: 'render', summary: 'Snap a picture to a palette (a .hex, .gpl or .png file, a list of colours, or the picture\'s own n dominant colours).',
  params: {
    image: p.str('the picture (PNG)', { positional: true, required: 'quantize: <image.png> is required' }),
    palette: p.str('the palette: a .hex, .gpl or .png file, or #rrggbb,#rrggbb,… (default: the picture\'s own --n colours)'), n: p.int('colours to take from the picture when there is no --palette (default 16)'),
    dither: p.oneOf(['none', 'bayer2', 'bayer4', 'noise'], 'ordered dither between the two nearest colours (default none)'), out: p.str('the PNG to write (default: <image>.quantized.png)'),
    save: p.str('also write the palette used as a .hex or .gpl file'),
  },
  run(i: Inp) {
    const file = resolve(i.image), img = readPicture(file), colors = i.palette ? paletteColors(i.palette, i.n ?? 16) : paletteOf(img, i.n ?? 16).colors;
    if (!colors.length) throw new Error(`${i.image}: nothing opaque to take colours from`);
    const out = resolve(i.out ?? `${stemOf(file)}.quantized.png`);
    writePicture(out, snapToPalette(img, colors, { dither: i.dither }));
    if (i.save) writeFileSync(resolve(i.save), i.save.endsWith('.gpl') ? formatGpl(colors, basename(i.save, '.gpl')) : formatHex(colors));
    return { out, colors };
  },
  cli: {
    usage: '       artgen quantize <image.png> [--palette file|#hex,#hex,…] [--n 16] [--dither none|bayer2|bayer4|noise] [--out file.png] [--save palette.hex|.gpl]',
    text: r => `${r.out}: ${r.colors.length} colours ${r.colors.join(' ')}`,
  },
  mcp: { exclude: BY_PATH }, python: {},
});

export const IMAGE_OPS = [trace, slice, quantize];
