/**
 * Iso tile sets (SPEC §8–9, PLAN P6b): seamless textures projected onto the 2:1 diamond grid. A floor tile is the
 * texture laid on the diamond (staggered tiles continue each other because the texture wraps); a block is a floor
 * diamond on top of two wall faces (left = the face toward screen down-left, right = down-right), the faces stepped
 * darker along their own ramps as the `cubes` renderer lights them (top, left, right).
 */
import type { DirContext } from '../direction.ts';
import { Grid } from '../lib/grid.ts';

const mod = (a: number, b: number) => ((a % b) + b) % b;

function stepper(dir: DirContext): (c: string, k: number) => string {
  const at = new Map<string, [string, number]>();
  for (const [name, r] of Object.entries(dir.pal)) r.forEach((c, i) => { if (!at.has(c)) at.set(c, [name, i]); });
  return (c, k) => { const hit = at.get(c); if (!hit) return c; const r = dir.pal[hit[0]]; return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))]; };
}

/** Length of the ramp a colour is on (0 when it's on none). */
function rampLen(dir: DirContext, c: string | null): number {
  for (const r of Object.values(dir.pal)) if (c && r.includes(c)) return r.length;
  return 0;
}

/** Texture (u, v) under diamond pixel (x, y) of a `tw × th` diamond whose top corner is at (tw/2, top). */
function diamondUV(tex: Grid, tw: number, th: number, x: number, y: number, top = 0): [number, number] | null {
  const sx = x + 0.5 - tw / 2, sy = y + 0.5 - top, S = tex.w;
  const u = (sx / tw + sy / th) * S, v = (sy / th - sx / tw) * S;
  return u < 0 || v < 0 || u >= S || v >= S ? null : [Math.floor(u), Math.floor(v)];
}

/** An iso floor tile: the (square, seamless) texture on a `tw × th` diamond (default th = tw / 2). */
export function isoFloorTile(tex: Grid, tw: number, th = tw / 2): Grid {
  const g = new Grid(tw, th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const uv = diamondUV(tex, tw, th, x, y);
    if (uv) g.set(x, y, tex.get(uv[0], uv[1]));
  }
  if (tex.normal) {
    const n = new Grid(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const uv = diamondUV(tex, tw, th, x, y); if (uv) { const i = (uv[1] * tex.w + uv[0]) * 4; n.d.set(tex.normal.d.subarray(i, i + 4), (y * tw + x) * 4); } }
    g.normal = n;
  }
  return g;
}

export interface IsoBlockOptions {
  /** Textures per face (default: `top` for all three). */
  top: Grid;
  left?: Grid;
  right?: Grid;
  /** Wall height in px (default th). */
  height?: number;
  /** Ramp steps darker for the left / right faces (default 1 / 2, the cubes lighting). */
  shade?: [number, number];
  /** Leave the top off (a wall face set seen from the room side, or an open pit). */
  noTop?: boolean;
}

/**
 * An iso block tile `tw × (th + height)`: the top diamond, the left face (from the left corner down-right to the bottom
 * corner) and the right face, each from its texture. Walls, crates of terrain, raised floors.
 */
export function isoBlockTile(dir: DirContext, tw: number, o: IsoBlockOptions, th = tw / 2): Grid {
  const h = o.height ?? th, H = th + h, g = new Grid(tw, H), step = stepper(dir);
  const L = o.left ?? o.top, R = o.right ?? o.top, S = L.w;
  // short ramps (3 steps) can't take two steps on the right face without flattening it to the darkest colour: both
  // faces step once there and the corner between them gets the darkest step instead
  const short = Math.min(...[o.top, L, R].map(t => rampLen(dir, t.get(t.w >> 1, t.h >> 1)))) <= 3, [sl, sr] = o.shade ?? (short ? [1, 1] : [1, 2]);
  for (let y = 0; y < H; y++) for (let x = 0; x < tw; x++) {
    const uv = o.noTop ? null : diamondUV(o.top, tw, th, x, y);
    if (uv) { g.set(x, y, o.top.get(uv[0], uv[1])); continue; }
    // faces: below the diamond's lower edges, down to `h` px under them
    const half = tw / 2, cx = x + 0.5;
    if (cx < half) {
      const edgeY = th / 2 + (cx / half) * (th / 2), dy = y + 0.5 - edgeY; // left face spans from the left corner to the bottom corner
      if (dy >= 0 && dy < h) { const u = mod(Math.floor((cx / half) * S), S), v = mod(Math.floor((dy / h) * S), S); g.set(x, y, step(L.get(u, v)!, sl)); }
    } else {
      const edgeY = th - ((cx - half) / half) * (th / 2), dy = y + 0.5 - edgeY;
      if (dy >= 0 && dy < h) { const u = mod(Math.floor(((cx - half) / half) * S), S), v = mod(Math.floor((dy / h) * S), S); g.set(x, y, step(R.get(u, v)!, x === half && short ? 9 : sr)); }
    }
  }
  return g;
}

/** Review context for iso tiles: the floor tile staggered over an area (rows offset by half a tile). */
export function isoTiling(tile: Grid, cols = 4, rows = 7): Grid {
  const tw = tile.w, th = Math.round(tile.w / 2), g = new Grid(tw * cols + (tw >> 1), (th >> 1) * (rows + 1) + (tile.h - th));
  for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) g.over(tile, i * tw + (j % 2) * (tw >> 1), j * (th >> 1) - (th >> 1));
  return g;
}
