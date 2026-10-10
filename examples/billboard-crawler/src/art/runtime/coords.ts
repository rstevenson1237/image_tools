// Vendored by `artgen export --runtime` (artgen-runtime 1.2.1). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * Iso and oblique coordinate helpers. World coordinates are in tiles (x, y on the ground, z up in pixels); screen
 * coordinates are pixels relative to the world origin.
 */

export interface IsoTile { w: number; h: number }
const ISO: IsoTile = { w: 32, h: 16 };

/** Dimetric (2:1) iso: world tile (x, y, z px) → screen pixel. */
export function isoToScreen(x: number, y: number, z = 0, tile: IsoTile = ISO): [number, number] {
  return [((x - y) * tile.w) / 2, ((x + y) * tile.h) / 2 - z];
}

/** Screen pixel → world tile on the ground plane (z = 0). Floor it for the tile under the cursor. */
export function screenToIso(sx: number, sy: number, tile: IsoTile = ISO): [number, number] {
  const a = sx / (tile.w / 2), b = sy / (tile.h / 2);
  return [(a + b) / 2, (b - a) / 2];
}

/**
 * Draw-order key for iso (and top-down) scenes: farther rows first, then lower z. Use it as `zIndex` / sort key.
 * Valid for z below 1000 px.
 */
export const depthKey = (x: number, y: number, z = 0): number => x + y + z / 1000;

export interface ObliqueTile { w: number; h: number }
const OBLIQUE: ObliqueTile = { w: 16, h: 12 };

/** Oblique / ¾ top-down: ground rows foreshortened to `h` px, z (px) straight up. */
export function obliqueToScreen(x: number, y: number, z = 0, tile: ObliqueTile = OBLIQUE): [number, number] {
  return [x * tile.w, y * tile.h - z];
}

export function screenToOblique(sx: number, sy: number, tile: ObliqueTile = OBLIQUE): [number, number] {
  return [sx / tile.w, sy / tile.h];
}

/** Oblique draw order: by ground row, then z. */
export const obliqueDepth = (_x: number, y: number, z = 0): number => y + z / 1000;
