/**
 * Procedural pass v1 (S2, SPEC §6.4): seeded layers applied to a T2+ raster before colours are fixed —
 * `materialNoise`, `pattern`, `detail` (mask-template variation), lighting (`rimLight`, `ao`, `castShadow`,
 * `groundShadow`, `dropShadow`) and `dither`.
 * Layers move pixels along their own material ramp, so the output stays on the direction palette.
 * The direction's `pipeline.procedural` list supplies default layers; an asset layer with the same name replaces
 * the default's options.
 */
import type { DirContext } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { INK, Raster } from './raster.ts';
import type { Scene2D } from './scene.ts';

export interface ProcEnv {
  dir: DirContext;
  seed: number;
  /** Outer-line pass, used when the source is a finished grid that had none. */
  line: (g: Grid) => Grid;
}

/** Which pixels a layer touches: part names (`hull`, `hull*` prefix) and/or material ramp names. */
export interface Target { part?: string | string[]; mat?: string | string[] }

export interface LayerOptions extends Target { [k: string]: unknown }

interface LayerState { shadow?: [number, number]; ground?: [number, number, number] | 'auto' }

type Layer = (r: Raster, env: ProcEnv, o: LayerOptions, st: LayerState) => void;

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Pixel filter for a layer's target. */
function matcher(r: Raster, env: ProcEnv, t: Target): (p: number) => boolean {
  const parts = t.part === undefined ? null : ([] as string[]).concat(t.part);
  const mats = t.mat === undefined ? null : ([] as string[]).concat(t.mat).map(m => env.dir.pal[m] ?? env.dir.pal[env.dir.palette.materials[m]]);
  const okItem = r.items.map(it => {
    if (it.underlay || !it.ramp) return false;
    if (parts && !parts.some(p => (p.endsWith('*') ? (it.name ?? '').startsWith(p.slice(0, -1)) : it.name === p))) return false;
    if (mats && !mats.some(m => m && m.length === it.ramp!.length && m.every((c, i) => c === it.ramp![i]))) return false;
    return true;
  });
  return p => r.id[p] >= 0 && !(r.flag[p] & INK) && okItem[r.id[p]];
}

/** Hash-lattice value noise in [0, 1), smooth-interpolated, `octaves` of fBm. */
export function valueNoise(seed: number, x: number, y: number, scale: number, octaves = 2): number {
  const hash = (i: number, j: number) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  let sum = 0, amp = 1, norm = 0, f = 1 / Math.max(0.5, scale);
  for (let o = 0; o < octaves; o++) {
    const fx = x * f, fy = y * f, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    sum += amp * (a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

const BAYER: Record<string, number[][]> = {
  bayer2: [[0, 2], [3, 1]].map(r => r.map(v => (v + 0.5) / 4)),
  bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16)),
};

export const LAYERS: Record<string, Layer> = {
  /** Interior pixels step one band darker/lighter where seeded noise is high/low. Options: amount, scale, octaves. */
  materialNoise(r, env, o) {
    const hit = matcher(r, env, o), amount = (o.amount as number) ?? 0.2, scale = (o.scale as number) ?? 3, oct = (o.octaves as number) ?? 2;
    const seed = env.seed + ((o.seed as number) ?? 0), moves: [number, number][] = [];
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x = p % r.w, y = (p / r.w) | 0;
      if (!N4.every(([dx, dy]) => { const q = r.idx(x + dx, y + dy); return q >= 0 && r.id[q] === r.id[p] && !(r.flag[q] & INK); })) continue;
      const n = valueNoise(seed, x, y, scale, oct);
      if (n > 1 - amount / 2) moves.push([p, 1]); else if (n < amount / 2) moves.push([p, -1]);
    }
    for (const [p, s] of moves) r.step(p, s);
  },

  /**
   * Repeating structure. type: stripes | planks | bricks | grid | checker | rivets. Options: period, axis
   * ('x' = lines run along x), width, offset, length (planks/bricks joint spacing), step (+1 darker, -1 lighter).
   */
  pattern(r, env, o) {
    const hit = matcher(r, env, o), type = (o.type as string) ?? 'stripes', P = (o.period as number) ?? 4, wd = (o.width as number) ?? 1;
    const off = (o.offset as number) ?? 0, len = (o.length as number) ?? P * 3, step = (o.step as number) ?? 1, along = (o.axis as string) ?? 'x';
    const mod = (a: number, b: number) => ((a % b) + b) % b;
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x0 = p % r.w, y0 = (p / r.w) | 0, [u, v] = along === 'x' ? [x0, y0] : [y0, x0];
      const row = Math.floor((v - off) / P), line = mod(v - off, P) < wd;
      let on = false;
      if (type === 'stripes') on = line;
      else if (type === 'planks' || type === 'bricks') on = line || mod(u - (row % 2 ? len / 2 : 0) - ((o.joint as number) ?? 0), len) < wd;
      else if (type === 'grid') on = mod(u - off, P) < wd || line;
      else if (type === 'checker') on = (Math.floor((u - off) / P) + row) % 2 === 0;
      else if (type === 'rivets') on = mod(u - off, P) === 0 && mod(v - off, P) === 0;
      else throw new Error(`pattern: unknown type ${type}`);
      if (on) r.step(p, step);
    }
  },

  /**
   * Mask-template variation (Bollinger-style, P3): a small char mask is filled from the seed and stepped onto the
   * target as markings. Mask cells: `.` never, `#` always body, `1` body or empty, `2` body or border, `-` always
   * border. Body pixels step `step` (default +1, darker), border pixels `step + 1`; with `mirror: 'x'` (default) the
   * mask is the left half and is mirrored. Options: mask (rows), at ([x, y] top-left, default centred on the
   * target's bounding box), tile (repeat over the box), density (chance a random cell is body, 0.5), seed, step.
   * Vary `seed` per variant (`seed: ctx.variant`) for different markings on every variant.
   */
  detail(r, env, o) {
    const hit = matcher(r, env, o), rows = o.mask as string[];
    if (!Array.isArray(rows) || !rows.length) throw new Error('detail: mask (array of rows) is required');
    const mirror = (o.mirror as string) ?? 'x', density = (o.density as number) ?? 0.5, step = (o.step as number) ?? 1;
    let seed = (env.seed * 2654435761 + ((o.seed as number) ?? 0) * 40503 + 7) >>> 0;
    const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // fill the template: 0 empty, 1 body, 2 border
    const half = rows.map(row => [...row].map(ch => ch === '#' ? 1 : ch === '-' ? 2 : ch === '1' ? (rand() < density ? 1 : 0) : ch === '2' ? (rand() < density ? 1 : 2) : 0));
    let cells = half;
    if (mirror === 'x') cells = half.map(row => [...row, ...[...row].reverse()]);
    else if (mirror === 'y') cells = [...half, ...[...half].reverse()];
    const mh = cells.length, mw = Math.max(...cells.map(c => c.length));
    // empty cells next to body become border (Bollinger's outline step)
    const at0 = (x: number, y: number) => (y >= 0 && y < mh && x >= 0 && x < cells[y].length ? cells[y][x] : 0);
    const mask = cells.map((row, y) => row.map((c, x) => (c === 0 && N4.some(([dx, dy]) => at0(x + dx, y + dy) === 1) ? 2 : c)));
    const v = (x: number, y: number) => (y >= 0 && y < mh && x >= 0 && x < mask[y].length ? mask[y][x] : 0);
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let p = 0; p < r.id.length; p++) if (hit(p)) { const x = p % r.w, y = (p / r.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return;
    const at = (o.at as [number, number]) ?? [Math.round((x0 + x1 + 1 - mw) / 2), Math.round((y0 + y1 + 1 - mh) / 2)];
    const moves: [number, number][] = [];
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x = p % r.w, y = (p / r.w) | 0;
      let mx = x - at[0], my = y - at[1];
      if (o.tile) { mx = ((mx % mw) + mw) % mw; my = ((my % mh) + mh) % mh; }
      const c = v(mx, my);
      if (c) moves.push([p, c === 2 ? step + Math.sign(step || 1) : step]);
    }
    for (const [p, k] of moves) r.step(p, k);
  },

  /** Edge light: `side: 'lit'` (default) sets edges facing the light to the lightest level; `away` steps them lighter. */
  rimLight(r, env, o) {
    const hit = matcher(r, env, o), [lx, ly] = env.dir.camera.light.map(Math.sign), away = o.side === 'away';
    const sx = away ? -lx : lx, sy = away ? -ly : ly, sets: number[] = [];
    const open = (x: number, y: number) => { const q = r.idx(x, y); return q < 0 || r.id[q] < 0 || !!(r.flag[q] & INK); };
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x = p % r.w, y = (p / r.w) | 0;
      if ((sx && open(x + sx, y)) || (sy && open(x, y + sy))) sets.push(p);
    }
    for (const p of sets) away ? r.step(p, -1) : r.setLevel(p, 0);
  },

  /** Overlap ambient occlusion: pixels next to a shape drawn above them step darker. */
  ao(r, env, o) {
    const hit = matcher(r, env, o), moves: number[] = [];
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x = p % r.w, y = (p / r.w) | 0, rank = r.items[r.id[p]].rank;
      if (N4.some(([dx, dy]) => { const q = r.idx(x + dx, y + dy); return q >= 0 && r.id[q] >= 0 && !r.items[r.id[q]].underlay && r.items[r.id[q]].rank > rank; })) moves.push(p);
    }
    for (const p of moves) r.step(p, (o.strength as number) ?? 1);
  },

  /** Every targeted shape casts `dist` px away from the light onto shapes beneath it. */
  castShadow(r, env, o) {
    const hit = matcher(r, env, o), dist = (o.dist as number) ?? 1, [lx, ly] = env.dir.camera.light.map(Math.sign), done = new Uint8Array(r.id.length);
    const moves: number[] = [];
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p) && !(r.id[p] >= 0 && r.flag[p] & INK && o.part === undefined)) continue;
      const x = p % r.w, y = (p / r.w) | 0, rank = r.items[r.id[p]].rank;
      for (let k = 1; k <= dist; k++) {
        const q = r.idx(x - lx * k, y - ly * k);
        if (q < 0 || done[q] || r.id[q] < 0 || r.items[r.id[q]].rank >= rank || r.items[r.id[q]].underlay) continue;
        done[q] = 1; moves.push(q);
      }
    }
    for (const q of moves) r.step(q, 1);
  },

  /** Ordered dither across band boundaries inside a material (only when the direction allows dither). */
  dither(r, env, o) {
    const m = BAYER[env.dir.shading.dither === 'noise' ? 'bayer4' : env.dir.shading.dither];
    if (!m) return;
    const hit = matcher(r, env, o), sets: [number, number][] = [];
    for (let p = 0; p < r.id.length; p++) {
      if (!hit(p)) continue;
      const x = p % r.w, y = (p / r.w) | 0;
      for (const [dx, dy] of N4) {
        const q = r.idx(x + dx, y + dy);
        if (q < 0 || r.id[q] !== r.id[p] || r.flag[q] & INK || r.band[q] <= r.band[p]) continue;
        if (m[y % m.length][x % m.length] < 0.5) sets.push([p, r.band[q]]);
        break;
      }
    }
    for (const [p, b] of sets) r.band[p] = b;
  },

  /** 2:1 ground shadow ellipse under the sprite; cx/cy/rx default to the footprint of the opaque pixels. */
  groundShadow(_r, _env, o, st) {
    st.ground = o.cx !== undefined ? [o.cx as number, o.cy as number, (o.rx as number) ?? 6] : 'auto';
  },

  dropShadow(_r, _env, o, st) { st.shadow = [(o.dx as number) ?? 1, (o.dy as number) ?? 1]; },
};

export class Proc {
  private layers: [string, LayerOptions][] = [];
  private useDefaults = true;
  readonly source: Scene2D | Grid;
  readonly env: ProcEnv;
  readonly stage?: (name: string, g: Grid) => void;

  constructor(source: Scene2D | Grid, env: ProcEnv, stage?: (name: string, g: Grid) => void) {
    this.source = source; this.env = env; this.stage = stage;
  }

  add(name: string, opts: LayerOptions = {}): this {
    if (!LAYERS[name]) throw new Error(`procedural layer ${JSON.stringify(name)} does not exist (have: ${Object.keys(LAYERS).join(', ')})`);
    this.layers.push([name, opts]);
    return this;
  }

  /** Skip the direction's default layers. */
  noDefaults(): this { this.useDefaults = false; return this; }

  /** Layers in run order: direction defaults not replaced by the asset, then the asset's layers. */
  plan(): [string, LayerOptions][] {
    const mine = new Set(this.layers.map(l => l[0]));
    const defs = this.useDefaults ? this.env.dir.pipeline.procedural.filter(n => !mine.has(n)).map(n => {
      if (!LAYERS[n]) throw new Error(`direction pipeline.procedural: unknown layer ${JSON.stringify(n)}`);
      return [n, {}] as [string, LayerOptions];
    }) : [];
    return [...defs, ...this.layers];
  }

  render(): Grid {
    const isScene = !(this.source as Grid).d, st: LayerState = {};
    const r = isScene ? (this.source as Scene2D).raster() : Raster.fromGrid(this.source as Grid, this.env.dir.pal, this.env.dir.outline, this.env.dir.shading.bands);
    for (const [name, o] of this.plan()) { LAYERS[name](r, this.env, o, st); this.stage?.(`proc-${name}`, r.toGrid()); }
    if (isScene) {
      const ground = st.ground === 'auto' ? autoGround(r) : st.ground;
      return (this.source as Scene2D).finalize(r, { ...(st.shadow && { shadow: st.shadow }), ...(ground && { groundShadow: ground }) });
    }
    // grid source: colours change in place; shadows are added beneath like a scene's
    let g = r.toGrid();
    const src = this.source as Grid;
    for (let i = 0; i < src.w * src.h; i++) if (src.d[i * 4 + 3] && src.d[i * 4 + 3] < 255) g.d.set(src.d.subarray(i * 4, i * 4 + 4), i * 4);
    if (st.shadow || st.ground) g = shadowsUnder(g, st, this.env, r);
    return g;
  }
}

function autoGround(r: Raster): [number, number, number] {
  let x0 = r.w, x1 = -1, y1 = -1;
  for (let p = 0; p < r.id.length; p++) if (r.id[p] >= 0) { const x = p % r.w, y = (p / r.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return [r.w / 2, r.h - 2, 1];
  return [(x0 + x1 + 1) / 2, y1, Math.max(2, ((x1 - x0 + 1) / 2) * 0.8)];
}

function shadowsUnder(g: Grid, st: LayerState, env: ProcEnv, r: Raster): Grid {
  const under = new Grid(g.w, g.h);
  if (st.shadow) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x - st.shadow[0], y - st.shadow[1]) === 255) under.set(x, y, env.dir.shadow);
  if (st.ground) {
    const [cx, cy, rx] = st.ground === 'auto' ? autoGround(r) : st.ground, ry = rx / 2;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) under.set(x, y, env.dir.shadow);
  }
  return under.stamp(g);
}
