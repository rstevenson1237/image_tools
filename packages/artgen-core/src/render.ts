/**
 * Asset module contract (SPEC §6.2) and the render loop over states × facings × frames.
 * Every render gets the direction through `ctx.dir`; `ctx.lib` hands out engine pieces pre-bound to it.
 */
import { dirContext, kindPalette, resolveSize, type DirContext, type Direction, type Size, type View } from './direction.ts';
import * as blitLib from './lib/blit.ts';
import { Grid } from './lib/grid.ts';
import { fitNormalMap, flipNormalMap } from './lib/normals.ts';
import * as iso from './lib/iso.ts';
import * as palette from './lib/palette.ts';
import * as post from './lib/post.ts';
import { Scene, R, mirrorSpec, type SceneOptions } from './lib/prim.ts';
import { rng } from './lib/rng.ts';
import { doc, rasterizeSvg, svgToGrid, type SvgToGridOptions } from './lib/svg.ts';
import { Voxels, face } from './lib/voxel.ts';
import { resolveParams } from './t2/params.ts';
import { autotile, autotileCount, autotileMask, type AutotileOptions } from './tex/autotile.ts';
import { isoBlockTile, isoFloorTile, type IsoBlockOptions } from './tex/iso.ts';
import { lsystem, lsystemSpecs, turtle } from './tex/lsystem.ts';
import { material, type MaterialOptions } from './tex/materials.ts';
import { pGradient, pValue, pWorley } from './tex/noise.ts';
import { wfc } from './tex/wfc.ts';
import { Proc } from './t2/proc.ts';
import { Scene2D, type Scene2DOptions } from './t2/scene.ts';
import { Scene3D, type Scene3DOptions } from './t2/scene3d.ts';

export interface Brief {
  id: string;
  kind: string;
  view?: View;
  /** Direction scale key or [w, h]. */
  size?: string | Size;
  states?: string[];
  directions?: 1 | 4 | 8 | 16;
  /** Per state: frame count, playback rate, loop, and optional per-frame durations in ms (hold a contact frame longer). */
  anims?: Record<string, { frames: number; fps?: number; loop?: boolean; durations?: number[] }>;
  variants?: number;
  notes?: string;
  /** Real-world height in metres (rev 9): the drawn body should be `height × pxPerMetre(dir)` px tall (conformance `height`). */
  height?: number;
  /** Effects: the drawable thing the effect is (`ice lance`, `ring of fire`), not a description of an effect (rev 9). */
  object?: string;
  /** Tilesets (P6b): frames of the first state are the autotile set in canonical order (16 Wang edges or 47 blob). */
  autotile?: 'wang16' | 'blob47';
}

export type Anchors = Record<string, [number, number]>;

export interface AssetModule {
  meta?: { brief?: string; pass?: string; notes?: string; /** Render west-side facings as mirrored east ones (default true). */ mirror?: boolean };
  /** Fixed values and/or a param schema (`{ type: 'range' | 'toggle' | 'choice' | 'swap', … }`) sampled per variant. */
  params?: Record<string, unknown>;
  render(ctx: RenderContext): Grid;
  anchors?(ctx: RenderContext): Anchors;
}

export interface RenderContext {
  dir: DirContext;
  brief: Brief;
  size: Size;
  seed: number;
  /** 0 = defaults; n > 0 = a seeded variant of the param schema. */
  variant: number;
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
export function makeLib(dir: DirContext, kind?: string, stage?: (name: string, g: Grid) => void, seed = 1, onScene?: (s: { lint(): string[] }) => void) {
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
    /** T2+ (S1): 2D scenes and 3D mode, bound to the direction. */
    t2: {
      scene: (w: number, h: number, opts: Scene2DOptions = {}) => {
        const s = new Scene2D(w, h, { dir, palette: kindPalette(dir, kind), line }, { stage, ...opts });
        onScene?.(s);
        return s;
      },
      scene3d: (opts: Scene3DOptions = {}) => {
        const s = new Scene3D(dir, opts), render = s.render.bind(s), slices = s.slices.bind(s);
        s.render = (w, h, o, l = line) => render(w, h, o, l);
        s.slices = (w, h, o = {}) => slices(w, h, { line, ...o });
        onScene?.(s);
        return s;
      },
    },
    /**
     * Textures and tiles (P6b): material recipes on the direction's ramps (seamless, with normal maps), autotile
     * transitions, iso floor / block tiles, WFC layouts, L-system growth.
     */
    tex: {
      material: (name: string, o: Omit<MaterialOptions, 'w' | 'h'> & { size: [number, number] } ) => material(name, dir, { ...o, w: o.size[0], h: o.size[1], seed: o.seed ?? seed }).grid,
      materialResult: (name: string, o: MaterialOptions) => material(name, dir, { seed, ...o }),
      autotile: (layout: 'wang16' | 'blob47', index: number, o: AutotileOptions) => autotile(dir, layout, index, o),
      autotileMask, autotileCount,
      isoFloor: isoFloorTile,
      isoBlock: (tw: number, o: IsoBlockOptions, th?: number) => isoBlockTile(dir, tw, o, th),
      wfc, lsystem, turtle, lsystemSpecs,
      noise: { value: pValue, gradient: pGradient, worley: pWorley },
    },
    /** Procedural pass (S2) over a T2+ scene or a finished grid. */
    proc: (source: Scene2D | Grid) => new Proc(source, { dir, seed, line }, stage),
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
  /** Normal map (P6a): from the renderer's normals (2D shading, voxel raster), fitted to the cell's pixels. */
  normal?: Grid;
}

export interface RenderOptions {
  dir: Direction;
  brief: Brief;
  seed?: number;
  /** Param-schema variant (0 = defaults). */
  variant?: number;
  params?: Record<string, unknown>;
  /** Collect stage dumps per cell, keyed `state/facing/frame/<n>-<stage>`. */
  stages?: Map<string, Grid>;
  /** Called with every T2+ scene a cell's render built (2D and 3D), keyed `state/facing/frame` — voxel exports use it. */
  onScene?: (cell: string, scene: unknown) => void;
}

export interface RenderResult {
  brief: Brief;
  size: Size;
  states: string[];
  facings: string[];
  frames: Record<string, number>;
  cells: Cell[];
  /** T2+ scene lint over every cell (R4 strokes, R11 colours, R5 interpenetration, empty shapes), deduplicated. */
  lint: string[];
}

/** Render one asset over every state × facing × frame of its brief. West-side facings mirror east ones (2D). */
export function renderAsset(mod: AssetModule, { dir, brief, seed = 1, variant = 0, params = {}, stages, onScene }: RenderOptions): RenderResult {
  const dc = dirContext(dir), size = resolveSize(dir, brief.size, brief.kind);
  const states = brief.states?.length ? brief.states : ['idle'];
  const facings = FACINGS[brief.directions ?? 1];
  if (!facings) throw new Error(`brief ${brief.id}: directions must be 1, 4, 8 or 16`);
  const frames: Record<string, number> = {};
  for (const s of states) frames[s] = brief.anims?.[s]?.frames ?? 1;
  const mirror = mod.meta?.mirror !== false, cells: Cell[] = [], cache = new Map<string, Cell>(), lint = new Set<string>();
  const allParams = resolveParams(mod.params, variant, params);

  const renderCell = (state: string, facing: string, frame: number): Cell => {
    const key = `${state}/${facing}/${frame}`;
    let n = 0;
    const stage = stages ? (name: string, g: Grid) => { stages.set(`${key}/${n++}-${name}`, g.clone()); } : undefined;
    const scenes: { lint(): string[] }[] = [];
    const ctx: RenderContext = {
      dir: dc, brief, size, seed, variant, params: allParams, state, facing, frame, t: frame / frames[state], rng: rng(seed),
      lib: makeLib(dc, brief.kind, stage, seed, sc => scenes.push(sc)),
      palette: names => (names ? palette.restrict(dc.pal, names, [dc.outline]) : kindPalette(dir, brief.kind)),
      stage: stage ?? (() => {}),
    };
    const grid = mod.render(ctx);
    for (const sc of scenes) { for (const m of sc.lint()) lint.add(m); onScene?.(key, sc); }
    if (grid.w !== size[0] || grid.h !== size[1]) throw new Error(`${brief.id} ${key}: rendered ${grid.w}x${grid.h}, brief size is ${size.join('x')}`);
    return { state, facing, frame, grid, mirrored: false, anchors: mod.anchors?.(ctx), ...(grid.normal && { normal: fitNormalMap(grid, grid.normal) }) };
  };

  for (const state of states) for (const facing of facings) for (let frame = 0; frame < frames[state]; frame++) {
    const src = mirrorFacing(facing);
    if (mirror && facing.includes('w') && facings.includes(src)) {
      const key = `${state}/${src}/${frame}`;
      let e = cache.get(key);
      if (!e) { e = renderCell(state, src, frame); cache.set(key, e); }
      const anchors = e.anchors && Object.fromEntries(Object.entries(e.anchors).map(([k, [x, y]]) => [k, [size[0] - 1 - x, y] as [number, number]]));
      cells.push({ state, facing, frame, grid: e.grid.flip('x'), mirrored: true, anchors, ...(e.normal && { normal: flipNormalMap(e.normal) }) });
    } else {
      const key = `${state}/${facing}/${frame}`;
      let c = cache.get(key);
      if (!c) { c = renderCell(state, facing, frame); cache.set(key, c); }
      cells.push(c);
    }
  }
  return { brief, size, states, facings, frames, cells, lint: [...lint] };
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
