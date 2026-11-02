/**
 * Tilesets for map exports (R7c, docs/TILEMAPS.md §4): the image every exported tile comes from, and which tile each
 * cell shows. A class can be bound to a tile asset of an exported pack (`pack.json` + atlases): a plain tile (its
 * variants spread over the map with the runtime's `cellHash`) or an autotile set (`wang16` / `blob47`, resolved from the
 * eight neighbours of the same class with the runtime's rule). A class with no binding gets a flat tile in its own
 * colour, so every map exports and plays before it has art.
 */
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { autotileCount, autotileIndexOf, cellHash, neighbourMask, type AutotileLayout } from 'artgen-primitives/lib/autobits.ts';
import type { TileGrid } from './grid.ts';

/** The tile shape a map's cells are drawn with: square (orthogonal), diamond (isometric 2:1) or a flat-top hexagon. */
export type TileShape = 'square' | 'diamond' | 'hex';

/** What a binding needs of an exported pack asset (`PackAsset` in artgen-core and the runtime). */
export interface PackTileAsset {
  kind: string;
  view: string;
  size: [number, number];
  states: Record<string, unknown>;
  /** [atlas, x, y, w, h, facing index, state, frame, variant] */
  frames: [number, number, number, number, number, number, string, number, number][];
  variants: string[];
  swaps?: Record<string, unknown>;
  autotile?: AutotileLayout;
  map?: number[];
}

export interface TileBinding {
  /** The class id it draws. */
  class: string;
  /** `pack/asset`, for the tileset's properties. */
  source: string;
  view: string;
  size: [number, number];
  autotile?: AutotileLayout;
  /** [variant][tile index]: canonical autotile order, or one tile per variant. */
  tiles: Grid[][];
}

/** Cut a tile asset's frames out of its pack's atlases: the first state and facing, every param variant (palette swaps are left out). */
export function bindTiles(cls: string, pack: string, id: string, asset: PackTileAsset, atlases: Grid[]): TileBinding {
  if (!['tile', 'tileset', 'texture'].includes(asset.kind)) throw new Error(`${pack}/${id} is a ${asset.kind}: bind a tile, tileset or texture`);
  const state = Object.keys(asset.states)[0], swaps = Object.keys(asset.swaps ?? {}).length;
  const variants = Math.max(1, asset.variants.length - swaps);
  const count = asset.autotile ? autotileCount(asset.autotile) : 1;
  const tiles: Grid[][] = [];
  for (let v = 0; v < variants; v++) {
    const row: Grid[] = [];
    for (let i = 0; i < count; i++) {
      const frame = asset.autotile && asset.map ? asset.map[i] ?? i : i;
      const f = asset.frames.find(e => e[6] === state && e[5] === 0 && e[7] === frame && e[8] === v);
      if (!f) { if (v > 0 && i === 0) break; throw new Error(`${pack}/${id}: no frame ${frame} of ${state}${v ? ` (variant ${asset.variants[v]})` : ''} in the pack`); }
      const atlas = atlases[f[0]];
      if (!atlas) throw new Error(`${pack}/${id}: atlas ${f[0]} is missing`);
      row.push(atlas.crop(f[1], f[2], f[3], f[4]));
    }
    if (row.length === count) tiles.push(row);
  }
  return { class: cls, source: `${pack}/${id}`, view: asset.view, size: [asset.size[0], asset.size[1]], ...(asset.autotile && { autotile: asset.autotile }), tiles };
}

export interface SheetTile {
  /** Local tile id: Tiled's id in the tileset (gid − firstgid), LDtk's tile id. */
  id: number;
  class: string;
  variant: number;
  /** Autotile index (canonical order); 0 for a plain tile. */
  index: number;
  /** Autotile: the 8-bit neighbour mask the tile is drawn for. */
  autotile?: AutotileLayout;
  /** A flat tile drawn in the class's colour (no art bound yet). */
  flat?: boolean;
}

export interface TileSheet {
  name: string;
  shape: TileShape;
  /** The grid's cell in pixels (an iso tile's diamond, a hex's box). */
  tileW: number;
  tileH: number;
  /** Each tile image's size: the cell, or taller for iso tiles with height (walls). */
  imageW: number;
  imageH: number;
  columns: number;
  tiles: SheetTile[];
  /** Tiles laid out `columns` wide with no spacing, row by row. */
  image: Grid;
  bindings: { class: string; source: string; autotile?: AutotileLayout; variants: number }[];
}

export interface SheetOptions {
  name: string;
  shape?: TileShape;
  /** Cell width in px when no binding sets it (default 16; iso 32). */
  tile?: number;
  bindings?: TileBinding[];
}

/** A flat-top hexagon's height for a width: across the flats, √3/2 of the width, rounded. */
export const hexHeight = (w: number): number => Math.round((w * Math.sqrt(3)) / 2);

/** The tileset for a grid: every bound tile, then a flat tile for each class without one. */
export function buildSheet(g: TileGrid, o: SheetOptions): TileSheet {
  const shape: TileShape = o.shape ?? (g.grid === 'hex' ? 'hex' : 'square'), bindings = o.bindings ?? [];
  if (g.grid === 'hex' && shape !== 'hex') throw new Error('a hex map exports with hex tiles');
  for (const b of bindings) {
    if (!g.classes.some(c => c.id === b.class)) throw new Error(`no class ${JSON.stringify(b.class)} in this ${g.source} (have: ${g.classes.map(c => c.id).join(', ')})`);
    if (b.autotile && shape === 'hex') throw new Error(`${b.source}: autotile sets are square; a hex map takes plain tiles`);
  }
  const first = bindings[0];
  let tileW: number, tileH: number, imageH: number;
  if (first) {
    tileW = first.size[0];
    tileH = shape === 'diamond' ? tileW / 2 : shape === 'hex' ? hexHeight(tileW) : first.size[1];
    imageH = Math.max(...bindings.map(b => b.size[1]));
    for (const b of bindings) if (b.size[0] !== tileW) throw new Error(`tiles of different widths: ${first.source} is ${tileW} px, ${b.source} ${b.size[0]} px`);
    if (shape === 'diamond' && tileW % 2) throw new Error(`iso tiles must be an even width (${first.source} is ${tileW} px)`);
  } else {
    tileW = o.tile ?? (shape === 'diamond' ? 32 : 16);
    tileH = shape === 'diamond' ? tileW / 2 : shape === 'hex' ? hexHeight(tileW) : tileW;
    imageH = tileH;
  }
  if (!Number.isInteger(tileW) || tileW < 2 || tileW > 512 || !Number.isInteger(tileH)) throw new Error(`tile size ${tileW}×${tileH}: whole pixels from 2 to 512`);
  const imageW = tileW, tiles: SheetTile[] = [], images: Grid[] = [];
  for (const c of g.classes) {
    const b = bindings.find(x => x.class === c.id);
    if (b) b.tiles.forEach((row, variant) => row.forEach((img, index) => {
      tiles.push({ id: tiles.length, class: c.id, variant, index, ...(b.autotile && { autotile: b.autotile }) });
      images.push(img);
    }));
    else { tiles.push({ id: tiles.length, class: c.id, variant: 0, index: 0, flat: true }); images.push(flatTile(shape, tileW, tileH, c.color)); }
  }
  const columns = Math.min(tiles.length, Math.max(1, Math.ceil(Math.sqrt(tiles.length))) * (tileW < 24 ? 2 : 1)), rows = Math.ceil(tiles.length / columns);
  const image = new Grid(columns * imageW, rows * imageH);
  // a tile shorter than the image box (a flat iso floor next to a wall) sits at its bottom, as Tiled and LDtk draw it
  images.forEach((img, i) => image.blit(img, (i % columns) * imageW, Math.floor(i / columns) * imageH + (imageH - img.h)));
  return {
    name: o.name, shape, tileW, tileH, imageW, imageH, columns, tiles, image,
    bindings: bindings.map(b => ({ class: b.class, source: b.source, ...(b.autotile && { autotile: b.autotile }), variants: b.tiles.length })),
  };
}

/** A flat tile of one colour in the cell's shape (transparent outside a diamond or hexagon). */
export function flatTile(shape: TileShape, w: number, h: number, color: string): Grid {
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
    const inside = shape === 'square' ? true
      : shape === 'diamond' ? Math.abs(px) / (w / 2) + Math.abs(py) / (h / 2) <= 1
        // flat-top hexagon in a w × h box: flat edges top and bottom, points left and right
        : Math.abs(py) <= h / 2 && Math.abs(px) <= w / 2 - (Math.abs(py) / (h / 2)) * (w / 4);
    if (inside) g.set(x, y, color);
  }
  return g;
}

/**
 * Which sheet tile each cell shows (−1: empty), row by row. Variants come from the runtime's `cellHash(x, y, n, seed)`;
 * an autotile's neighbour mask counts cells of the same class, and cells off the map as the same, so the map's border
 * does not draw an edge.
 */
export function resolveTiles(g: TileGrid, sheet: TileSheet, seed = 0): Int32Array {
  const out = new Int32Array(g.cols * g.rows).fill(-1);
  const byClass = new Map<string, SheetTile[][]>();
  for (const t of sheet.tiles) {
    const rows = byClass.get(t.class) ?? [];
    (rows[t.variant] ??= [])[t.index] = t;
    byClass.set(t.class, rows);
  }
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const v = g.cells[y * g.cols + x];
    if (!v) continue;
    const variants = byClass.get(g.classes[v - 1].id)!, row = variants[variants.length > 1 ? cellHash(x, y, variants.length, seed) : 0];
    const layout = row[0].autotile;
    const index = layout ? autotileIndexOf(layout, neighbourMask(x, y, (nx, ny) => nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || g.cells[ny * g.cols + nx] === v)) : 0;
    out[y * g.cols + x] = row[index].id;
  }
  return out;
}

/**
 * The map drawn from its tiles as Tiled draws it: rows top to bottom; iso cells on the 2:1 diamond lattice; hex columns
 * three quarters of a tile apart, odd ones half a tile down. For the review and the export's preview.
 */
export function previewTiles(g: TileGrid, sheet: TileSheet, tiles: Int32Array, background?: string): Grid {
  const { tileW: tw, tileH: th, imageW: iw, imageH: ih, columns } = sheet, lift = ih - th;
  let W: number, H: number, at: (x: number, y: number) => [number, number];
  if (sheet.shape === 'diamond') { W = (g.cols + g.rows) * (tw / 2); H = (g.cols + g.rows) * (th / 2) + lift; at = (x, y) => [(x - y + g.rows - 1) * (tw / 2), (x + y) * (th / 2)]; }
  else if (sheet.shape === 'hex') { W = Math.ceil((g.cols - 1) * 0.75 * tw + tw); H = g.rows * th + Math.ceil(th / 2) + lift; at = (x, y) => [Math.round(x * 0.75 * tw), y * th + (x % 2 ? Math.round(th / 2) : 0)]; }
  else { W = g.cols * tw; H = g.rows * th + lift; at = (x, y) => [x * tw, y * th]; }
  const out = new Grid(W, H);
  if (background) out.fill(0, 0, W, H, background);
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const t = tiles[y * g.cols + x];
    if (t < 0) continue;
    const [px, py] = at(x, y), src = sheet.image.crop((t % columns) * iw, Math.floor(t / columns) * ih, iw, ih);
    out.over(src, px, py);
  }
  return out;
}
