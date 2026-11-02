/**
 * How a map is laid out for each camera (R7c, docs/TILEMAPS.md §2). The view modules (`artgen-scene/views/views.ts`)
 * carry this as their `map`; it lives down here so the maps-only bundle can export maps for a view without the
 * pixel pipeline.
 */
export interface ViewMap {
  /** Tiled's map orientation. */
  tiled: 'orthogonal' | 'isometric';
  /** The cell: a square, or a 2:1 diamond. */
  tile: 'square' | 'diamond';
  /** LDtk has square grids only. */
  ldtk: boolean;
}

const SQUARE: ViewMap = { tiled: 'orthogonal', tile: 'square', ldtk: true };

/** Views a map can be exported for. The free camera shows meshes and has none. */
export const VIEW_MAPS: Readonly<Record<string, ViewMap>> = {
  topdown: SQUARE, oblique: SQUARE, stack: SQUARE, side: SQUARE, fp: SQUARE,
  iso: { tiled: 'isometric', tile: 'diamond', ldtk: false },
};

/**
 * The `tile-shape` check: does a tile of `w × h` px fit the view's map cell? Square cells take square tiles (a side-view
 * or oblique tile may be taller: its front face hangs below the cell); iso cells are 2:1 diamonds, and a tile may stand
 * taller than its diamond (a wall). Null when it fits, else what is wrong.
 */
export function tileShapeProblem(view: string, w: number, h: number): string | null {
  const m = VIEW_MAPS[view];
  if (!m) return `the ${view} view has no tile maps (have: ${Object.keys(VIEW_MAPS).join(', ')})`;
  if (m.tile === 'diamond') return w % 2 ? `iso tiles are an even width (${w} px)` : h < w / 2 ? `an iso tile is at least half as tall as it is wide (${w}×${h} px)` : null;
  if (h < w) return `a ${view} tile is at least as tall as it is wide (${w}×${h} px)`;
  return (view === 'topdown' || view === 'fp' || view === 'stack') && h !== w ? `a ${view} tile is square (${w}×${h} px)` : null;
}
