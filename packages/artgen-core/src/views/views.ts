/**
 * View modules (SPEC §8, D8): what a view means for the pipeline beyond its camera — the anchor and sort convention
 * the export and runtime use, the context a review shows the asset in, and the runtime helpers that place it. Adding a
 * view is adding an entry here (+ a camera in `camera.ts` when 3D mode renders it); nothing else changes.
 */
import type { Direction } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { isoFloor } from '../lib/iso.ts';

export interface ViewModule {
  id: string;
  /** How the camera sees the world (docs, skill references). */
  projection: string;
  /** Export anchor: `center` (frame centre) or `feet` (bottom centre). */
  anchor: 'center' | 'feet';
  /** Draw-order rule for the game. */
  sort: string;
  /** Runtime helpers that place assets of this view. */
  runtime: string[];
  /** Review context drawn under an asset (same size as the image it backs), or undefined for the game background. */
  context?(w: number, h: number, dir: Direction): Grid;
  /** 3D-mode renderer settings for the view (`renderer`, camera `view`). */
  render3d: { renderer: 'cubes' | 'raster'; view: string };
}

/** Darkest and a mid step of a direction ramp (contexts are drawn in the game's own colours, quietly). */
function tones(dir: Direction, ramp: string): { lo: string; mid: string; hi: string } {
  const r = dir.palette.ramps[ramp] ?? Object.values(dir.palette.ramps)[0];
  return { lo: r[r.length - 1], mid: r[Math.max(0, r.length - 2)], hi: r[r.length >> 1] };
}

/** Oblique room: a floor of foreshortened tiles (mid tone, dark seams) and a darker back wall band (top third). */
export function obliqueRoom(w: number, h: number, dir: Direction, frontRatio = dir.camera.oblique?.frontRatio ?? 0.5): Grid {
  const g = new Grid(w, h), floor = tones(dir, 'stone'), wall = tones(dir, 'wood'), tile = Math.max(6, Math.round(w / 4)), row = Math.max(3, Math.round(tile * (1 / frontRatio - 1)));
  const wallH = Math.round(h / 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y < wallH) g.set(x, y, y === wallH - 1 || x % (tile * 2) === 0 ? wall.mid : wall.lo);
    else g.set(x, y, (y - wallH) % row === 0 || x % tile === 0 ? floor.lo : floor.mid);
  }
  return g;
}

/** Side-view scroll strip: sky band, a ground line at the feet row and a dirt band under it. */
export function sideStrip(w: number, h: number, dir: Direction): Grid {
  const g = new Grid(w, h), sky = dir.background ?? tones(dir, 'stone').lo, ground = tones(dir, 'grass'), dirt = tones(dir, 'dirt');
  const gy = h - Math.max(2, Math.round(h / 10));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, y < gy ? sky : y === gy ? ground.hi : (x + y) % 5 ? dirt.mid : dirt.lo);
  return g;
}

/** Top-down ground: a quiet two-tone dirt checker at tile size. */
export function groundPlane(w: number, h: number, dir: Direction): Grid {
  const g = new Grid(w, h), t = tones(dir, 'dirt'), s = typeof dir.scale.tile === 'number' ? dir.scale.tile : 16;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, (Math.floor(x / s) + Math.floor(y / s)) % 2 ? t.mid : t.hi);
  return g;
}

/** One slice rotated about its centre (nearest neighbour, exact pixels). */
export function rotateGrid(g: Grid, rad: number, out = new Grid(g.w, g.h)): Grid {
  const c = Math.cos(rad), s = Math.sin(rad), cx = g.w / 2, cy = g.h / 2, ox = out.w / 2, oy = out.h / 2;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const dx = x + 0.5 - ox, dy = y + 0.5 - oy, sx = Math.floor(c * dx + s * dy + cx), sy = Math.floor(-s * dx + c * dy + cy);
    const i = (sy * g.w + sx) * 4;
    if (g.inb(sx, sy) && g.d[i + 3]) out.d.set(g.d.subarray(i, i + 4), (y * out.w + x) * 4);
  }
  return out;
}

/** A sprite stack drawn as the runtime draws it: slices bottom first, rotated, stepped up `spacing` px each. */
export function stackComposite(slices: Grid[], rad: number, spacing = 1): Grid {
  if (!slices.length) return new Grid(1, 1);
  const w = slices[0].w, h = slices[0].h, lift = Math.ceil((slices.length - 1) * spacing), out = new Grid(w, h + lift);
  slices.forEach((s, i) => { const r = rotateGrid(s, rad); out.stamp(r, 0, lift - Math.round(i * spacing)); });
  return out;
}

/** The stack review context: the stack at `n` angles side by side (8 by default: every 45°). */
export function stackStrip(slices: Grid[], n = 8, spacing = 1): Grid {
  const frames = Array.from({ length: n }, (_, i) => stackComposite(slices, (i / n) * Math.PI * 2, spacing));
  const out = new Grid(frames.reduce((a, f) => a + f.w + 1, -1), frames[0].h);
  let x = 0;
  for (const f of frames) { out.blit(f, x, 0); x += f.w + 1; }
  return out;
}

/** Parallax preview: layers (back first) composited at `offsets` scroll positions, each layer moving by its depth. */
export function parallaxStrip(layers: { grid: Grid; depth: number }[], viewW: number, offsets = [0, 24, 48]): Grid {
  const h = Math.max(...layers.map(l => l.grid.h)), out = new Grid((viewW + 1) * offsets.length - 1, h);
  offsets.forEach((cam, k) => {
    for (const l of layers) {
      const lw = l.grid.w, off = -cam * l.depth, start = off - Math.ceil(off / lw) * lw;
      for (let x = start; x < viewW; x += lw) for (let y = 0; y < l.grid.h; y++) for (let i = 0; i < lw; i++) {
        const sx = Math.round(x) + i;
        if (sx < 0 || sx >= viewW) continue;
        const c = l.grid.get(i, y);
        if (c && l.grid.alpha(i, y) === 255) out.set(k * (viewW + 1) + sx, h - l.grid.h + y, c);
      }
    }
  });
  return out;
}

export const VIEW_MODULES: Record<string, ViewModule> = {
  topdown: { id: 'topdown', projection: 'orthographic, straight down', anchor: 'center', sort: 'none (or y)', runtime: ['ArtSprite.face'], render3d: { renderer: 'raster', view: 'topdown' } },
  oblique: { id: 'oblique', projection: 'top + front face; a cube shows top : front = (1/frontRatio − 1) : 1, heights at full size', anchor: 'feet', sort: 'by ground row (y), then z', runtime: ['obliqueToScreen', 'obliqueDepth'], context: obliqueRoom, render3d: { renderer: 'raster', view: 'oblique' } },
  iso: { id: 'iso', projection: '2:1 dimetric: x → (2, 1), y → (−2, 1), z → (0, −2) px', anchor: 'feet', sort: 'x + y, then z', runtime: ['isoToScreen', 'screenToIso', 'depthKey'], context: (w, h) => isoFloor(w, h), render3d: { renderer: 'cubes', view: 'iso' } },
  stack: { id: 'stack', projection: 'voxel z-slices, top-down; drawn rotated and stepped up', anchor: 'center', sort: 'y of the base', runtime: ['pack.stack', 'StackSprite'], render3d: { renderer: 'raster', view: 'topdown' } },
  side: { id: 'side', projection: 'orthographic side view; parallax layers scroll by depth', anchor: 'feet', sort: 'layer, then x', runtime: ['parallaxTiles'], context: sideStrip, render3d: { renderer: 'raster', view: 'side' } },
  fp: { id: 'fp', projection: 'raycaster: assets are wall / floor textures, 8-direction billboards and view-models', anchor: 'feet', sort: 'distance (raycaster)', runtime: ['three billboards', 'tileTexture'], render3d: { renderer: 'raster', view: 'billboard' } },
};

export function viewModule(view: string): ViewModule {
  const m = VIEW_MODULES[view];
  if (!m) throw new Error(`unknown view ${JSON.stringify(view)} (have: ${Object.keys(VIEW_MODULES).join(', ')})`);
  return m;
}

/** Review context for an asset of a view (undefined: the plain game background). */
export function viewContext(view: string, w: number, h: number, dir: Direction): Grid | undefined {
  return VIEW_MODULES[view]?.context?.(w, h, dir);
}
