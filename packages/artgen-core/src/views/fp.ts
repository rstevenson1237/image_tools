/**
 * First-person view module (P6d, SPEC §8 `fp`): a small grid raycaster used as the review context and in the UI, and
 * the sky generator. First-person assets are textures (walls, floors, ceilings, skies), 8-direction billboards and
 * view-models; the corridor shot shows each in its place: textures on the surfaces, billboards standing in the
 * corridor (sorted by distance, clipped by the walls' depth), the view-model over the bottom of the screen.
 *
 * The preview is a context image, not an asset: it shades by distance toward the direction's background (fog) and
 * darkens the walls that face along y, like the classic raycasters, so it is not palette-exact.
 */
import { dirContext, type DirContext, type Direction } from '../direction.ts';
import { material } from '../tex/materials.ts';
import { parseColor } from '../lib/color.ts';
import { Grid } from '../lib/grid.ts';
import { pGradient, pValue } from '../tex/noise.ts';

export interface Billboard { grid: Grid; /** map position (tiles) */ x: number; y: number; /** height in tiles (default: grid height / 64) */ height?: number }

export interface RaycastScene {
  /** Map rows: `#` wall, anything else open. Default: a corridor with side alcoves. */
  map?: string[];
  wall: Grid;
  floor?: Grid;
  ceiling?: Grid;
  /** Panorama behind open ceilings (wraps across 360°). */
  sky?: Grid;
  sprites?: Billboard[];
  /** Drawn over the bottom centre of the view, integer-scaled to about half the view width. */
  viewmodel?: Grid;
}

export interface RaycastOptions {
  w: number;
  h: number;
  /** Camera position (tiles) and heading (degrees, 0 = +x, 90 = +y / down the map). */
  pos?: [number, number];
  angle?: number;
  fov?: number;
  /** Fog colour (default black) and the distance (tiles) at which it is total. */
  fog?: string;
  fogDist?: number;
}

export const CORRIDOR = [
  '#########',
  '###...###',
  '##.....##',
  '###...###',
  '##.....##',
  '###...###',
  '###...###',
  '#########',
];

const texel = (g: Grid, u: number, v: number): [number, number, number, number] => {
  const x = ((Math.floor(u * g.w) % g.w) + g.w) % g.w, y = ((Math.floor(v * g.h) % g.h) + g.h) % g.h, i = (y * g.w + x) * 4;
  return [g.d[i], g.d[i + 1], g.d[i + 2], g.d[i + 3]];
};

/** Render the corridor shot. */
export function raycast(scene: RaycastScene, o: RaycastOptions): Grid {
  const { w, h } = o, map = scene.map ?? CORRIDOR, out = new Grid(w, h);
  const [px, py] = o.pos ?? [4.5, 6.5], ang = ((o.angle ?? -90) * Math.PI) / 180, fov = ((o.fov ?? 66) * Math.PI) / 180;
  const fog = parseColor(o.fog ?? '#000000'), fogDist = o.fogDist ?? 7;
  const dx = Math.cos(ang), dy = Math.sin(ang), plane = Math.tan(fov / 2), qx = -dy * plane, qy = dx * plane;
  const solid = (x: number, y: number) => y < 0 || y >= map.length || x < 0 || x >= map[y].length || map[y][x] === '#';
  const put = (x: number, y: number, c: [number, number, number, number], dist: number, dim = 1) => {
    if (c[3] < 128) return false;
    const f = Math.min(1, dist / fogDist) ** 1.2, k = dim * (1 - f);
    const i = (y * w + x) * 4;
    out.d[i] = Math.round(c[0] * k + fog[0] * f); out.d[i + 1] = Math.round(c[1] * k + fog[1] * f); out.d[i + 2] = Math.round(c[2] * k + fog[2] * f); out.d[i + 3] = 255;
    return true;
  };
  const zbuf = new Float32Array(w).fill(Infinity), horizon = h / 2;
  // floor, ceiling and sky
  for (let y = 0; y < h; y++) {
    const below = y >= horizon, p = Math.abs(y + 0.5 - horizon);
    const rowDist = (h / 2) / Math.max(1e-3, p);
    for (let x = 0; x < w; x++) {
      const cx = (2 * (x + 0.5)) / w - 1, rx = dx + qx * cx, ry = dy + qy * cx;
      const fx = px + rx * rowDist, fy = py + ry * rowDist;
      if (below) put(x, y, scene.floor ? texel(scene.floor, fx % 1, fy % 1) : [60, 60, 60, 255], rowDist);
      else if (scene.ceiling) put(x, y, texel(scene.ceiling, fx % 1, fy % 1), rowDist);
      else if (scene.sky) {
        const a = Math.atan2(ry, rx) / (Math.PI * 2);
        put(x, y, texel(scene.sky, a, y / horizon), 0);
      }
    }
  }
  // walls (DDA per column)
  for (let x = 0; x < w; x++) {
    const cx = (2 * (x + 0.5)) / w - 1, rx = dx + qx * cx, ry = dy + qy * cx;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rx || 1e-9)), ddy = Math.abs(1 / (ry || 1e-9)), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
    let sdx = rx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = ry < 0 ? (py - my) * ddy : (my + 1 - py) * ddy, side = 0;
    for (let n = 0; n < 64; n++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      if (solid(mx, my)) break;
    }
    const dist = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = dist;
    let wx = side === 0 ? py + dist * ry : px + dist * rx;
    wx -= Math.floor(wx);
    if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) wx = 1 - wx;
    const lh = h / dist, top = horizon - lh / 2;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, Math.ceil(top + lh)); y++) put(x, y, texel(scene.wall, wx, (y + 0.5 - top) / lh), dist, side ? 0.72 : 1);
  }
  // billboards, far to near, feet on the floor
  const sprites = [...(scene.sprites ?? [])].map(s => ({ s, d: (s.x - px) ** 2 + (s.y - py) ** 2 })).sort((a, b) => b.d - a.d);
  const inv = 1 / (qx * dy - dx * qy);
  for (const { s } of sprites) {
    const ox = s.x - px, oy = s.y - py, tx = inv * (dy * ox - dx * oy), tz = inv * (-qy * ox + qx * oy);
    if (tz <= 0.1) continue;
    const scx = (w / 2) * (1 + tx / tz), sh = (h / tz) * (s.height ?? s.grid.h / 64), sw = sh * (s.grid.w / s.grid.h);
    const bottom = horizon + h / tz / 2, top = bottom - sh;
    for (let x = Math.max(0, Math.floor(scx - sw / 2)); x < Math.min(w, Math.ceil(scx + sw / 2)); x++) {
      if (tz >= zbuf[x]) continue;
      const u = (x + 0.5 - (scx - sw / 2)) / sw;
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(h, Math.ceil(bottom)); y++) put(x, y, texel(s.grid, u, (y + 0.5 - top) / sh), tz);
    }
  }
  if (scene.viewmodel) {
    const vm = scene.viewmodel, k = Math.max(1, Math.round((w * 0.5) / vm.w)), big = vm.scale(k);
    out.over(big, Math.round((w - big.w) / 2), h - big.h);
  }
  return out;
}

export interface SkyOptions {
  w: number;
  h: number;
  /** Ramp the sky bands come from (default `cloth`, else the first ramp), lightest at the horizon. */
  ramp?: string;
  /** Cloud ramp (default `metal`, else `stone`); `clouds: 0` turns them off. */
  cloudRamp?: string;
  clouds?: number;
  /** Stars (single light pixels) in the top part: share of pixels, e.g. 0.01. */
  stars?: number;
  /** A distant ridge along the bottom (ramp name; off when absent). */
  ridge?: string;
  seed?: number;
}

/**
 * Sky panorama (P6d): horizontal bands of a ramp (lightest at the horizon, darkest at the zenith, with a dithered
 * edge between bands), periodic clouds, optional stars and a distant ridge. Seamless across x (wraps 360° in the
 * raycaster and as a parallax layer); palette-exact.
 */
export function sky(dir: DirContext, o: SkyOptions): Grid {
  const { w, h } = o, seed = o.seed ?? 1, g = new Grid(w, h);
  const pick = (want: string | undefined, fallback: string[]) => (want && dir.pal[want] ? want : fallback.find(n => dir.pal[n]) ?? Object.keys(dir.pal)[0]);
  const band = dir.pal[pick(o.ramp, ['cloth', 'stone'])], cloud = dir.pal[pick(o.cloudRamp, ['metal', 'stone'])], n = band.length;
  const clouds = o.clouds ?? 0.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 1 - y / h; // 0 at the horizon (bottom), 1 at the zenith
    const jitter = (pValue(x, y, { w, h, cells: Math.max(1, Math.round(w / 4)), cellsY: Math.max(1, Math.round(h / 4)), seed: seed + 3 }) - 0.5) * 0.18;
    let c = band[Math.max(0, Math.min(n - 1, Math.floor((v + jitter) * n)))];
    if (clouds > 0) {
      const cn = pGradient(x, y * 2.5, { w, h: h * 2.5, cells: Math.max(1, Math.round(w / 24)), cellsY: Math.max(1, Math.round(h / 10)), octaves: 3, seed });
      const lim = 1 - clouds * 0.45 - (v > 0.7 ? -0.2 : 0);
      if (cn > lim) c = cloud[cn > lim + 0.08 ? 0 : Math.min(cloud.length - 1, 1)];
    }
    if (o.stars && v > 0.45) {
      const hsh = ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519)) >>> 0) / 4294967296;
      if (hsh < o.stars) c = cloud[0];
    }
    g.set(x, y, c);
  }
  if (o.ridge && dir.pal[o.ridge]) {
    const r = dir.pal[o.ridge];
    for (let x = 0; x < w; x++) {
      const top = h - Math.round(h * (0.12 + 0.18 * pGradient(x, 0, { w, h: 1, cells: Math.max(1, Math.round(w / 32)), cellsY: 1, octaves: 3, seed: seed + 9 })));
      for (let y = top; y < h; y++) g.set(x, y, r[Math.min(r.length - 1, y === top ? r.length - 2 : r.length - 1)]);
    }
  }
  return g;
}

export type FpSurface = 'wall' | 'floor' | 'ceiling' | 'sky';

/** Which part of a first-person scene an asset is: textures by `surface` (default wall), layers are skies. */
export function fpRole(kind: string, surface?: FpSurface): FpSurface | 'billboard' | 'viewmodel' {
  if (kind === 'viewmodel') return 'viewmodel';
  if (kind === 'layer') return 'sky';
  if (kind === 'texture' || kind === 'tile' || kind === 'tileset') return surface ?? (kind === 'texture' ? 'wall' : 'floor');
  return 'billboard';
}

/**
 * Corridor shots for a first-person asset (review context): the asset in its place, quiet stone everywhere else.
 * `frames` are the cells to show (one shot each, up to 3; billboards: all in one shot, nearest first).
 */
export function fpShots(dir: Direction, kind: string, frames: Grid[], o: { surface?: FpSurface; w?: number; h?: number } = {}): Grid[] {
  const dc = dirContext(dir), w = o.w ?? 128, h = o.h ?? 80, role = fpRole(kind, o.surface);
  const base: RaycastScene = {
    wall: material('stone', dc, { w: 32, h: 32 }).grid, floor: material('dirt', dc, { w: 32, h: 32, seed: 3 }).grid,
    ceiling: material('stone', dc, { w: 32, h: 32, seed: 5, range: [1, 2] }).grid,
  };
  const ro: RaycastOptions = { w, h, fog: dir.background ?? '#000000', fogDist: 8 };
  if (role === 'billboard') {
    const spots: [number, number][] = [[4.5, 4.4], [3.4, 2.6], [5.6, 2.4]];
    return [raycast({ ...base, sprites: frames.slice(0, 3).map((g, i) => ({ grid: g, x: spots[i][0], y: spots[i][1], height: 0.85 * (g.h / Math.max(g.w, g.h)) })) }, ro)];
  }
  return frames.slice(0, 3).map(g => {
    if (role === 'viewmodel') return raycast({ ...base, viewmodel: g }, ro);
    if (role === 'sky') return raycast({ ...base, ceiling: undefined, sky: g }, ro);
    return raycast({ ...base, [role]: g }, ro);
  });
}
