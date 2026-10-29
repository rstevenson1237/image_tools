/** 2:1 isometric helpers (artlab): projection, box faces, ground shadow, review floor. */
import { Grid } from './grid.ts';

/** World (x right-down, y left-down, z up) → screen px. 1 world unit = 2 px across, 1 px down. */
export const P = (x: number, y: number, z: number, ox = 0, oy = 0): [number, number] => [ox + (x - y) * 2, oy + (x + y) - z * 2];

/** Faces of an axis box as screen polygons; light from upper-left: top = light, left (+y) = mid, right (+x) = dark. */
export function boxFaces(x: number, y: number, z: number, w: number, d: number, h: number, ox = 0, oy = 0) {
  const p = (a: number, b: number, c: number) => P(a, b, c, ox, oy);
  return {
    top: [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)],
    left: [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)],
    right: [p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)],
  };
}

/** 2:1 ground-shadow ellipse (alpha-blended), drawn first under a sprite. */
export function groundShadow(g: Grid, cx: number, cy: number, rx: number, color: string): Grid {
  const ry = rx / 2;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g.set(x, y, color);
  return g;
}

/** Review context: 2:1 diamond floor tiles (32×16) in two alternating tones with dark seams. */
export function isoFloor(w: number, h: number, { a = '#545060', b = '#4a4452', seam = '#23202a' } = {}): Grid {
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = Math.floor((x / 2 + (y + 4)) / 16), v = Math.floor((-x / 2 + (y + 4)) / 16);
    const e = (x / 2 + y + 4) % 16 < 1 || (-x / 2 + y + 4 + 1024) % 16 < 1;
    g.set(x, y, e ? seam : (u + v) % 2 ? b : a);
  }
  return g;
}
