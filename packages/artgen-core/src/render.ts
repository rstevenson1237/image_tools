/**
 * Asset module contract (SPEC §6.2) and the render loop over states × facings × frames.
 * Every render gets the direction through `ctx.dir`; `ctx.lib` hands out engine pieces pre-bound to it.
 */
import { dirContext, kindPalette, resolveSize, type DirContext, type Direction, type Size, type View } from './direction.ts';
import * as blitLib from './lib/blit.ts';
import { Grid } from './lib/grid.ts';
import * as iso from './lib/iso.ts';
import * as palette from './lib/palette.ts';
import * as post from './lib/post.ts';
import { Scene, R, mirrorSpec, type SceneOptions } from './lib/prim.ts';
import { rng } from './lib/rng.ts';
import { doc, rasterizeSvg, svgToGrid, type SvgToGridOptions } from './lib/svg.ts';
import { Voxels, face } from './lib/voxel.ts';

export interface Brief {
  id: string;
  kind: string;
  view?: View;
  /** Direction scale key or [w, h]. */
  size?: string | Size;
  states?: string[];
  directions?: 1 | 4 | 8 | 16;
  anims?: Record<string, { frames: number; fps?: number; loop?: boolean }>;
  variants?: number;
  notes?: string;
}

export type Anchors = Record<string, [number, number]>;

export interface AssetModule {
  meta?: { brief?: string; pass?: string; notes?: string; /** Render west-side facings as mirrored east ones (default true). */ mirror?: boolean };
  params?: Record<string, unknown>;
  render(ctx: RenderContext): Grid;
  anchors?(ctx: RenderContext): Anchors;
}

export interface RenderContext {
  dir: DirContext;
  brief: Brief;
  size: Size;
  seed: number;
  params: Record<string, unknown>;
  state: string;
  facing: string;
  frame: number;
  /** frame / frames in [0, 1). */
  t: number;
  rng: () => number;
  lib: Lib;
  /** Restricted palette for this asset: the named ramps (default: those allowed for the kind) plus the outline. */
  palette(names?: string[]): string[];
  /** Record an intermediate grid (`--stages`, R8). */
  stage(name: string, g: Grid): void;
}

export type Lib = ReturnType<typeof makeLib>;

/** Engine pieces bound to a direction: colours, light, bands and line style come from `dir`. */
export function makeLib(dir: DirContext, kind?: string, stage?: (name: string, g: Grid) => void) {
  const rampList = Object.values(dir.pal);
  /** Outer-line pass per `line.outer`. */
  const line = (g: Grid): Grid =>
    dir.line.outer === 'none' ? g : dir.line.outer === 'selout' ? post.selout(g, rampList, dir.outline) : post.outline(g, dir.outline);
  const sceneOpts: SceneOptions = { light: dir.camera.light, bands: dir.shading.bands, outlineColor: dir.outline, shadowColor: dir.shadow, applyLine: line };
  return {
    Grid,
    line,
    post: {
      ...post,
      outline: (g: Grid, color = dir.outline, diag = false) => post.outline(g, color, diag),
      dropShadow: (g: Grid, dx: number, dy: number, color = dir.shadow) => post.dropShadow(g, dx, dy, color),
      quantize: (g: Grid, pal = kindPalette(dir, kind), opts: Parameters<typeof post.quantize>[2] = { dither: dir.shading.dither }) => post.quantize(g, pal, opts),
      selout: (g: Grid) => post.selout(g, rampList, dir.outline),
    },
    prim: {
      Scene, R, mirrorSpec,
      scene: (w: number, h: number, opts: SceneOptions = {}) => new Scene(w, h, { ...sceneOpts, ...opts }),
    },
    blit: {
      ...blitLib,
      shadeSide: (g: Grid, darker: Record<string, string>) => blitLib.shadeSide(g, { light: dir.camera.light, outline: dir.outline, darker }),
    },
    svg: {
      doc, rasterize: rasterizeSvg,
      /** T3 path; `outline: true` applies the direction's line style, `pal` defaults to the kind palette. */
      toGrid(svg: string, w: number, h: number, opts: Omit<SvgToGridOptions, 'outline'> & { outline?: boolean | string } = {}) {
        const { outline, ...rest } = opts;
        let g = svgToGrid(svg, w, h, {
          ss: dir.pipeline.raster.ss, pal: kindPalette(dir, kind), shadowColor: dir.shadow, stage, ...rest,
          outline: typeof outline === 'string' ? outline : false, shadow: null,
        });
        if (outline === true) { g = line(g); stage?.('outline', g); }
        if (rest.shadow) { g = post.dropShadow(g, rest.shadow[0], rest.shadow[1], dir.shadow); stage?.('shadow', g); }
        return g;
      },
    },
    iso: { ...iso, groundShadow: (g: Grid, cx: number, cy: number, rx: number) => iso.groundShadow(g, cx, cy, rx, dir.shadow) },
    voxel: { Voxels, face, model: (opts: { k?: number } = {}) => new Voxels({ ...opts, outlineColor: dir.outline, shadowColor: dir.shadow, applyLine: line }) },
    palette,
    rng,
  };
}

export const FACINGS: Record<number, string[]> = {
  1: ['s'],
  4: ['s', 'w', 'n', 'e'],
  8: ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'],
  16: ['s', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw', 'n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse'],
};

/** East-west mirror of a facing name (`sw` ↔ `se`; `n`/`s` unchanged). */
export const mirrorFacing = (f: string): string => f.replace(/[we]/g, c => (c === 'w' ? 'e' : 'w'));

export interface Cell {
  state: string;
  facing: string;
  frame: number;
  grid: Grid;
  /** Rendered as the flipped east-side facing. */
  mirrored: boolean;
  anchors?: Anchors;
}

export interface RenderOptions {
  dir: Direction;
  brief: Brief;
  seed?: number;
  params?: Record<string, unknown>;
  /** Collect stage dumps per cell, keyed `state/facing/frame/<n>-<stage>`. */
  stages?: Map<string, Grid>;
}

export interface RenderResult {
  brief: Brief;
  size: Size;
  states: string[];
  facings: string[];
  frames: Record<string, number>;
  cells: Cell[];
}

/** Render one asset over every state × facing × frame of its brief. West-side facings mirror east ones (2D). */
export function renderAsset(mod: AssetModule, { dir, brief, seed = 1, params = {}, stages }: RenderOptions): RenderResult {
  const dc = dirContext(dir), size = resolveSize(dir, brief.size, brief.kind);
  const states = brief.states?.length ? brief.states : ['idle'];
  const facings = FACINGS[brief.directions ?? 1];
  if (!facings) throw new Error(`brief ${brief.id}: directions must be 1, 4, 8 or 16`);
  const frames: Record<string, number> = {};
  for (const s of states) frames[s] = brief.anims?.[s]?.frames ?? 1;
  const mirror = mod.meta?.mirror !== false, cells: Cell[] = [], cache = new Map<string, Cell>();
  const allParams = { ...(mod.params ?? {}), ...params };

  const renderCell = (state: string, facing: string, frame: number): Cell => {
    const key = `${state}/${facing}/${frame}`;
    let n = 0;
    const stage = stages ? (name: string, g: Grid) => { stages.set(`${key}/${n++}-${name}`, g.clone()); } : undefined;
    const ctx: RenderContext = {
      dir: dc, brief, size, seed, params: allParams, state, facing, frame, t: frame / frames[state], rng: rng(seed),
      lib: makeLib(dc, brief.kind, stage),
      palette: names => (names ? palette.restrict(dc.pal, names, [dc.outline]) : kindPalette(dir, brief.kind)),
      stage: stage ?? (() => {}),
    };
    const grid = mod.render(ctx);
    if (grid.w !== size[0] || grid.h !== size[1]) throw new Error(`${brief.id} ${key}: rendered ${grid.w}x${grid.h}, brief size is ${size.join('x')}`);
    return { state, facing, frame, grid, mirrored: false, anchors: mod.anchors?.(ctx) };
  };

  for (const state of states) for (const facing of facings) for (let frame = 0; frame < frames[state]; frame++) {
    const src = mirrorFacing(facing);
    if (mirror && facing.includes('w') && facings.includes(src)) {
      const key = `${state}/${src}/${frame}`;
      let e = cache.get(key);
      if (!e) { e = renderCell(state, src, frame); cache.set(key, e); }
      const anchors = e.anchors && Object.fromEntries(Object.entries(e.anchors).map(([k, [x, y]]) => [k, [size[0] - 1 - x, y] as [number, number]]));
      cells.push({ state, facing, frame, grid: e.grid.flip('x'), mirrored: true, anchors });
    } else {
      const key = `${state}/${facing}/${frame}`;
      let c = cache.get(key);
      if (!c) { c = renderCell(state, facing, frame); cache.set(key, c); }
      cells.push(c);
    }
  }
  return { brief, size, states, facings, frames, cells };
}

export interface SheetRect { state: string; facing: string; frame: number; x: number; y: number; w: number; h: number; mirrored: boolean }

/** Pack a render into one sheet: one row per state × facing, one column per frame. */
export function assembleSheet(r: RenderResult, gap = 0): { grid: Grid; rects: SheetRect[] } {
  const [w, h] = r.size, cols = Math.max(...Object.values(r.frames)), rows = r.states.length * r.facings.length;
  const grid = new Grid(cols * w + (cols - 1) * gap, rows * h + (rows - 1) * gap), rects: SheetRect[] = [];
  for (const c of r.cells) {
    const row = r.states.indexOf(c.state) * r.facings.length + r.facings.indexOf(c.facing);
    const x = c.frame * (w + gap), y = row * (h + gap);
    grid.blit(c.grid, x, y);
    rects.push({ state: c.state, facing: c.facing, frame: c.frame, x, y, w, h, mirrored: c.mirrored });
  }
  return { grid, rects };
}
