/**
 * Sprite normal maps (PLAN P6a/P6b/P6d): RGB = the surface normal per pixel in screen terms, OpenGL convention (x right,
 * y up, z toward the viewer — what three.js expects), alpha = coverage. 2D scenes write them from their shading normals,
 * the voxel raster renderer from its normal buffer, textures from a height field (`normalFromHeight`).
 */
import { Grid } from './grid.ts';

export type N3 = [number, number, number];

/** Encode a screen-space normal (x right, y DOWN, z toward the viewer) into a pixel. */
export function putNormal(g: Grid, x: number, y: number, n: N3): void {
  const l = Math.hypot(n[0], n[1], n[2]) || 1, i = (y * g.w + x) * 4;
  g.d[i] = Math.round((n[0] / l * 0.5 + 0.5) * 255);
  g.d[i + 1] = Math.round((-n[1] / l * 0.5 + 0.5) * 255);
  g.d[i + 2] = Math.round((n[2] / l * 0.5 + 0.5) * 255);
  g.d[i + 3] = 255;
}

/** Decode a pixel back to a screen-space normal (y down), or null when transparent. */
export function getNormal(g: Grid, x: number, y: number): N3 | null {
  if (!g.inb(x, y)) return null;
  const i = (y * g.w + x) * 4;
  if (!g.d[i + 3]) return null;
  return [g.d[i] / 127.5 - 1, -(g.d[i + 1] / 127.5 - 1), g.d[i + 2] / 127.5 - 1];
}

export const FLAT: N3 = [0, 0, 1];

/** Mirror a normal map horizontally: pixels flip and x components negate (mirrored facings). */
export function flipNormalMap(g: Grid): Grid {
  const out = g.flip('x');
  for (let i = 0; i < out.d.length; i += 4) if (out.d[i + 3]) out.d[i] = 255 - out.d[i];
  return out;
}

/**
 * Fit a normal map to a finished sprite: pixels the sprite has but the map lacks (outline, ink, patches) face the
 * viewer; pixels the sprite lost are cleared; translucent sprite pixels (shadows) get none.
 */
export function fitNormalMap(sprite: Grid, normal: Grid | undefined): Grid {
  const out = new Grid(sprite.w, sprite.h);
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    if (sprite.alpha(x, y) < 255) continue;
    const n = normal && getNormal(normal, x, y);
    putNormal(out, x, y, n ?? FLAT);
  }
  return out;
}

/**
 * Normals from a height field (`heights` per pixel, any scale; `strength` = slope gain). `wrap` treats the image as
 * tiling (textures), so the map is seamless too.
 */
export function normalFromHeight(heights: Float32Array | number[], w: number, h: number, o: { strength?: number; wrap?: boolean; mask?: Grid } = {}): Grid {
  const k = o.strength ?? 2, out = new Grid(w, h);
  const H = (x: number, y: number) => {
    if (o.wrap) { x = ((x % w) + w) % w; y = ((y % h) + h) % h; } else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); }
    return heights[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (o.mask && o.mask.alpha(x, y) < 255) continue;
    const dx = (H(x + 1, y) - H(x - 1, y)) / 2, dy = (H(x, y + 1) - H(x, y - 1)) / 2;
    putNormal(out, x, y, [-dx * k, -dy * k, 1]);
  }
  return out;
}

/** Heights from a sprite's luminance (fallback for a grid without a better height source). */
export function heightFromLuma(g: Grid): Float32Array {
  const out = new Float32Array(g.w * g.h);
  for (let i = 0; i < out.length; i++) out[i] = (0.299 * g.d[i * 4] + 0.587 * g.d[i * 4 + 1] + 0.114 * g.d[i * 4 + 2]) / 255;
  return out;
}
