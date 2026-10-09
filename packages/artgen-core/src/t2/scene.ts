/**
 * T2+ 2D scenes (SPEC §6.3): primitives (rect, ellipse, circle, poly, path, line, capsule, tube, ring, arc, star),
 * booleans (union / subtract / intersect), groups with transforms, z-order, clip masks, `repeat`, mirrored copies,
 * automatic underlay ink, and shading models (flat, bevel, sphere, cyl, normal, linear) quantised to the direction's bands.
 *
 * Raster modes (both crisp, palette-exact by construction):
 *  - `direct`: coverage at 4×4 samples per pixel, each pixel goes to the shape covering most of it (empty when
 *    more than half is empty), then shading is evaluated at the pixel. Abutting shapes leave no gaps.
 *  - `ss` (R3): every sample at size×ss is shaded to a ramp colour (= quantised to the asset palette), then
 *    mode-downsampled; outline and shadows are applied at final resolution.
 * Colours are direction ramps or tokens; nothing here knows a hex value of its own (R11).
 */
import type { DirContext } from '../direction.ts';
import { normHex } from '../lib/color.ts';
import { Grid } from '../lib/grid.ts';
import { groundShadow } from '../lib/iso.ts';
import * as post from '../lib/post.ts';
import {
  apply, capsulePts, ellipsePts, fillPolygons, IDENTITY, Mask, matScale, mirrorX, mirrorY, mul, parsePath, rectPts,
  rotate, specMatrix, starPts, translate, type Mat, type Pt, type TransformSpec,
} from './geom.ts';
import { bandIndices, INK, Raster, type RasterItem } from './raster.ts';

export type Shade = 'flat' | 'bevel' | 'sphere' | 'cyl' | 'normal' | 'linear';

export interface Spec extends TransformSpec {
  type: 'rect' | 'ellipse' | 'circle' | 'poly' | 'path' | 'line' | 'capsule' | 'tube' | 'ring' | 'arc' | 'star'
    | 'union' | 'subtract' | 'intersect' | 'group';
  // geometry (by type)
  x?: number; y?: number; w?: number; h?: number; r?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
  pts?: Pt[];
  d?: string;
  fillRule?: 'nonzero' | 'evenodd';
  x0?: number; y0?: number; x1?: number; y1?: number;
  a?: Pt; b?: Pt; r1?: number;
  /** tube: end width (tapers from `w`). */
  w1?: number;
  /** arc: start/end angle in degrees (0 = +x, clockwise). */
  a0?: number; a1?: number;
  /** star: inner radius, point count, rotation. */
  r2?: number; n?: number; rot?: number;
  /** boolean operands (first is the base for subtract). */
  shapes?: Spec[];
  // group
  children?: Spec[];
  /** Dark silhouette copy beneath the group/shape, `true` = 1 px or a width in px. Skipped when `line.inner` is none. */
  underlay?: boolean | number;
  /** Clip children to this shape (group-local coordinates). */
  clip?: Spec;
  /** Repeat children n times, offset by (dx, dy) and rotated by `rotate` degrees about `origin` per step. */
  repeat?: { n: number; dx?: number; dy?: number; rotate?: number; origin?: Pt };
  // style
  /** Material: ramp (lightest first), ramp name, or material name from the direction. Inherited by children. */
  mat?: string | string[];
  /** Fixed colour (token like `gold.0` / `outline`, or a ramp colour from ctx.dir). Skips shading. */
  color?: string;
  shade?: Shade;
  /** cyl: the cylinder's long axis. */
  axis?: 'x' | 'y';
  /** flat: ramp index to use (default: the middle level). */
  band?: number;
  /** normal: rounding radius in px (default: the shape's inradius = full dome). */
  round?: number;
  /** Shading gain (default 1.4; `linear` uses it as a stretch, 1 = whole ramp across the shape). */
  gain?: number;
  /** Selective inner outline where this shape borders something drawn before it; `all` inks every edge. */
  ink?: boolean | 'all';
  /** Cast a shadow of this many px onto shapes beneath (away from the light). */
  cast?: number;
  /** Darken shapes beneath along this shape's edge (overlap ambient occlusion). */
  ao?: boolean;
  /** Part name for procedural layers, finishing regions and lint messages. */
  name?: string;
  /** Per-pixel band override at final resolution: return a ramp index or undefined to keep. */
  pattern?: (x: number, y: number, band: number) => number | undefined | null;
  /** Draw order among siblings (default 0; ties keep insertion order). */
  z?: number;
  /** Add a copy mirrored across x = mirrorX (or y = mirrorY), shaded for its own side. */
  mirrorX?: number;
  mirrorY?: number;
  [k: string]: unknown;
}

export type Mode = 'direct' | 'ss' | 'auto';

export interface Scene2DOptions {
  /** Raster mode; `auto` = direct up to `direction.pipeline.raster.directMaxPx`, ss above. */
  mode?: Mode;
  ss?: number;
  /** Apply the direction's outer line (default true). */
  outline?: boolean;
  /** Drop shadow offset in px. */
  shadow?: [number, number] | null;
  /** 2:1 iso ground-shadow ellipse [cx, cy, rx] drawn beneath. */
  groundShadow?: [number, number, number] | null;
  /** Stage hook (R8). */
  stage?: (name: string, g: Grid) => void;
}

export interface SceneEnv {
  dir: DirContext;
  /** Restricted palette for the asset kind (lint: colours outside it are hard-coded). */
  palette: string[];
  /** Outer-line pass from the direction. */
  line: (g: Grid) => Grid;
}

interface Item extends RasterItem {
  spec: Spec;
  mask: Mask;
  key: number[];
  shade: Shade;
  ink?: boolean | 'all';
  cast?: number;
  ao?: boolean;
  pattern?: Spec['pattern'];
  band?: number;
  round?: number;
  gain: number;
  axis?: 'x' | 'y';
  /** Underlay: masks it is the dilated union of, and its width in px. */
  under?: { width: number; of: Item[] };
}

const N4: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GEOM_TYPES = new Set(['rect', 'ellipse', 'circle', 'poly', 'path', 'line', 'capsule', 'tube', 'ring', 'arc', 'star', 'union', 'subtract', 'intersect']);

export class Scene2D {
  readonly w: number;
  readonly h: number;
  readonly specs: Spec[] = [];
  readonly opts: Scene2DOptions;
  readonly env: SceneEnv;
  private warnings: string[] = [];

  constructor(w: number, h: number, env: SceneEnv, opts: Scene2DOptions = {}) {
    this.w = w; this.h = h; this.env = env; this.opts = opts;
  }

  add(...specs: Spec[]): this { this.specs.push(...specs); return this; }

  /** Convenience: a group node. */
  group(props: Omit<Spec, 'type' | 'children'>, children: Spec[]): Spec { return { ...props, type: 'group', children }; }

  get mode(): 'direct' | 'ss' {
    const m = this.opts.mode ?? 'auto';
    return m === 'auto' ? (Math.max(this.w, this.h) <= this.env.dir.pipeline.raster.directMaxPx ? 'direct' : 'ss') : m;
  }

  /** Samples per pixel at the working resolution. */
  get samples(): number { return this.mode === 'ss' ? (this.opts.ss ?? this.env.dir.pipeline.raster.ss) : 4; }

  /** Source lint (R4 no strokes, R11 colours from the direction, unknown types). */
  lint(): string[] {
    const out: string[] = [], pal = new Set(this.env.palette.map(normHex));
    const walk = (s: Spec, path: string) => {
      const at = s.name ? `${path}(${s.name})` : path;
      if (!GEOM_TYPES.has(s.type) && s.type !== 'group') out.push(`${at}: unknown type ${JSON.stringify(s.type)}`);
      for (const k of ['stroke', 'strokeWidth', 'stroke-width']) if (k in s) out.push(`${at}: strokes are not allowed (R4); use a tube/capsule shape, ink or an underlay`);
      const colours = [...(Array.isArray(s.mat) ? s.mat : []), ...(typeof s.color === 'string' && s.color.startsWith('#') ? [s.color] : [])];
      for (const c of colours) if (!pal.has(normHex(c))) out.push(`${at}: colour ${c} is not in the direction palette for this asset (R11)`);
      s.children?.forEach((c, i) => walk(c, `${at}.children[${i}]`));
      s.shapes?.forEach((c, i) => walk(c, `${at}.shapes[${i}]`));
    };
    this.specs.forEach((s, i) => walk(s, `[${i}]`));
    return [...out, ...this.warnings];
  }

  private resolveMat(m: Spec['mat']): string[] | undefined {
    if (m === undefined) return undefined;
    if (Array.isArray(m)) return m.map(normHex);
    const { pal, palette } = this.env.dir;
    const r = pal[m] ?? pal[palette.materials[m]];
    if (!r) throw new Error(`unknown material ${JSON.stringify(m)} (not a ramp or direction material)`);
    return r;
  }

  private resolveColor(c: string): string {
    if (c.startsWith('#') || c.startsWith('rgb')) return normHex(c);
    const { pal, outline, palette } = this.env.dir;
    if (c === 'outline') return outline;
    const [name, idx] = c.split('.'), ramp = pal[name] ?? pal[palette.materials[name]];
    if (!ramp) throw new Error(`unknown colour token ${JSON.stringify(c)}`);
    const i = idx === undefined ? ramp.length >> 1 : +idx;
    if (!(i >= 0 && i < ramp.length)) throw new Error(`colour token out of range: ${c}`);
    return ramp[i];
  }

  /** Geometry of one shape spec as a mask at the working resolution. */
  private shapeMask(s: Spec, M: Mat, S: number): Mask {
    const W = this.w * S, H = this.h * S, m = new Mask(W, H, S), tol = 0.5 / (S * matScale(M));
    const poly = (pts: Pt[]) => pts.map(p => apply(M, p));
    const fill = (rings: Pt[][], rule: 'nonzero' | 'evenodd' = 'nonzero') => fillPolygons(m, rings.map(poly), rule);
    const num = (v: number | undefined, name: string) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${s.type}${s.name ? ` ${s.name}` : ''}: ${name} must be a number`); return v; };
    switch (s.type) {
      case 'rect': return fill([rectPts(num(s.x ?? 0, 'x'), num(s.y ?? 0, 'y'), num(s.w, 'w'), num(s.h, 'h'), s.r ?? 0, tol)]);
      case 'ellipse': return fill([ellipsePts(num(s.cx, 'cx'), num(s.cy, 'cy'), num(s.rx, 'rx'), num(s.ry ?? s.rx, 'ry'), tol)]);
      case 'circle': return fill([ellipsePts(num(s.cx, 'cx'), num(s.cy, 'cy'), num(s.r, 'r'), s.r!, tol)]);
      case 'poly': return fill([s.pts ?? []], s.fillRule);
      case 'path': return fill(parsePath(s.d ?? '', tol), s.fillRule);
      case 'star': return fill([starPts(num(s.cx, 'cx'), num(s.cy, 'cy'), num(s.r, 'r'), num(s.r2, 'r2'), num(s.n, 'n'), s.rot ?? -90)]);
      case 'ring': {
        const cx = num(s.cx, 'cx'), cy = num(s.cy, 'cy'), r = num(s.r, 'r'), w = num(s.w, 'w');
        return fill([ellipsePts(cx, cy, r, r, tol), ellipsePts(cx, cy, r - w, r - w, tol).reverse()], 'evenodd');
      }
      case 'arc': {
        const cx = num(s.cx, 'cx'), cy = num(s.cy, 'cy'), r = num(s.r, 'r'), w = num(s.w, 'w'), a0 = num(s.a0, 'a0'), a1 = num(s.a1, 'a1');
        return fill([[...ellipsePts(cx, cy, r, r, tol, a0, a1), ...ellipsePts(cx, cy, r - w, r - w, tol, a0, a1).reverse()]]);
      }
      case 'line': {
        // pixel-centre segment with square caps, `w` px wide
        const a: Pt = [num(s.x0, 'x0') + 0.5, num(s.y0, 'y0') + 0.5], b: Pt = [num(s.x1, 'x1') + 0.5, num(s.y1, 'y1') + 0.5], hw = (s.w ?? 1) / 2;
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        return fill([[[a[0] - ux * hw - uy * hw, a[1] - uy * hw + ux * hw], [b[0] + ux * hw - uy * hw, b[1] + uy * hw + ux * hw],
          [b[0] + ux * hw + uy * hw, b[1] + uy * hw - ux * hw], [a[0] - ux * hw + uy * hw, a[1] - uy * hw - ux * hw]]]);
      }
      case 'capsule': {
        const a = s.a ?? [num(s.x0, 'x0'), num(s.y0, 'y0')], b = s.b ?? [num(s.x1, 'x1'), num(s.y1, 'y1')];
        return fill([capsulePts(a, b, num(s.r, 'r'), s.r1 ?? s.r, tol)]);
      }
      case 'tube': {
        // a filled band along a polyline or path: union of tapered capsules (R4: a shape, not a stroke)
        const pts = s.d ? parsePath(s.d, tol)[0] ?? [] : (s.pts ?? []);
        const w0 = num(s.w, 'w'), w1 = s.w1 ?? w0;
        const lens = pts.map((p, i) => (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0));
        const total = lens.reduce((a, b) => a + b, 0) || 1;
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const ra = (w0 + ((w1 - w0) * acc) / total) / 2; acc += lens[i];
          const rb = (w0 + ((w1 - w0) * acc) / total) / 2;
          fillPolygons(m, [poly(capsulePts(pts[i - 1], pts[i], ra, rb, tol))]);
        }
        return m;
      }
      case 'union': case 'subtract': case 'intersect': {
        const parts = (s.shapes ?? []).map(c => this.shapeMask(c, mul(M, specMatrix(c)), S));
        if (!parts.length) return m;
        const out = parts[0].clone();
        for (const p of parts.slice(1)) s.type === 'union' ? out.or(p) : s.type === 'subtract' ? out.andNot(p) : out.and(p);
        return out;
      }
      default: throw new Error(`unknown shape type ${JSON.stringify(s.type)}`);
    }
  }

  /** Flatten the node tree into draw items (masks at the working resolution), in draw order. */
  private compile(S: number): Item[] {
    const items: Item[] = [], bands = this.env.dir.shading.bands, inner = this.env.dir.line.inner !== 'none';
    this.warnings = [];
    type Inh = { mat?: string[]; shade?: Shade; clip?: Mask };
    const walk = (s: Spec, M: Mat, key: number[], inh: Inh): Item[] => {
      const copies: Mat[] = [mul(M, specMatrix(s))];
      if (s.mirrorX != null) copies.push(mul(M, mul(mirrorX(s.mirrorX), specMatrix(s))));
      if (s.mirrorY != null) copies.push(mul(M, mul(mirrorY(s.mirrorY), specMatrix(s))));
      const out: Item[] = [];
      copies.forEach((Mc, ci) => {
        const k = [...key, ci];
        const mat = this.resolveMat(s.mat) ?? inh.mat, shade = s.shade ?? inh.shade;
        if (s.type === 'group') {
          let clip = inh.clip;
          if (s.clip) { const c = this.shapeMask(s.clip, mul(Mc, specMatrix(s.clip)), S); clip = clip ? c.and(clip) : c; }
          const reps = s.repeat?.n ?? 1, sub: Item[] = [];
          for (let r = 0; r < reps; r++) {
            let Mr = Mc;
            if (s.repeat) {
              const o = s.repeat.origin ?? [0, 0];
              Mr = mul(Mc, mul(translate((s.repeat.dx ?? 0) * r, (s.repeat.dy ?? 0) * r), mul(translate(o[0], o[1]), mul(rotate((s.repeat.rotate ?? 0) * r), translate(-o[0], -o[1])))));
            }
            const kids = (s.children ?? []).map((c, i) => ({ c, i })).sort((p, q) => (p.c.z ?? 0) - (q.c.z ?? 0) || p.i - q.i);
            kids.forEach(({ c, i }) => sub.push(...walk(c, Mr, [...k, r, c.z ?? 0, i], { mat, shade, clip })));
          }
          if (s.underlay && inner && sub.length) out.push(this.underlayItem(sub, s.underlay, S, [...k, -1], s.name));
          out.push(...sub);
          return;
        }
        let mask = this.shapeMask(s, Mc, S);
        if (inh.clip) mask = mask.and(inh.clip);
        if (!mask.any()) this.warnings.push(`${s.type}${s.name ? ` ${s.name}` : ''}: covers no pixels`);
        const fixed = s.color ? this.resolveColor(s.color) : undefined;
        if (!fixed && !mat) throw new Error(`${s.type}${s.name ? ` ${s.name}` : ''}: needs mat or color`);
        const ramp = fixed ? undefined : mat;
        const it: Item = {
          spec: s, mask, key: [...k, 1], name: s.name, ramp, fixed, levels: ramp ? bandIndices(ramp.length, bands) : [], rank: 0,
          shade: shade ?? 'flat', ink: inner ? s.ink : undefined, cast: s.cast, ao: s.ao, pattern: s.pattern, band: s.band,
          round: s.round, gain: s.gain ?? ((shade ?? 'flat') === 'linear' ? 1 : 1.4), axis: s.axis,
        };
        if (s.underlay && inner) out.push(this.underlayItem([it], s.underlay, S, [...k, 0], s.name));
        out.push(it);
      });
      return out;
    };
    const top = this.specs.map((s, i) => ({ s, i })).sort((p, q) => (p.s.z ?? 0) - (q.s.z ?? 0) || p.i - q.i);
    for (const { s, i } of top) items.push(...walk(s, IDENTITY, [s.z ?? 0, i], {}));
    items.forEach((it, r) => { it.rank = r; });
    return items;
  }

  private underlayItem(of: Item[], width: boolean | number, S: number, key: number[], name?: string): Item {
    const w = width === true ? 1 : +width, u = new Mask(this.w * S, this.h * S, S);
    for (const it of of) u.or(it.mask);
    return {
      spec: { type: 'group' }, mask: u.dilate(w * S), key, name: name ? `${name}:underlay` : 'underlay', fixed: this.env.dir.outline,
      levels: [], rank: 0, underlay: true, shade: 'flat', gain: 1, under: { width: w, of },
    };
  }

  /** Ramp index for item `it` at working-resolution sample (sx, sy). */
  private shadeAt(it: Item, sx: number, sy: number, S: number, cache: Map<Item, { bb: ReturnType<Mask['bounds']>; R: number }>): number {
    const L = it.levels, n = L.length, mid = (n - 1) >> 1;
    if (it.fixed || !n) return 0;
    if (it.shade === 'flat' || n === 1) return it.band ?? L[mid];
    const light = this.env.dir.camera.light, lx = Math.sign(light[0]), ly = Math.sign(light[1]), m = it.mask;
    if (it.shade === 'bevel') {
      const lit = (!!lx && !m.has(sx + lx * S, sy)) || (!!ly && !m.has(sx, sy + ly * S));
      const dark = (!!lx && !m.has(sx - lx * S, sy)) || (!!ly && !m.has(sx, sy - ly * S));
      return lit && !dark ? L[0] : dark && !lit ? L[n - 1] : L[mid];
    }
    let geo = cache.get(it);
    if (!geo) {
      const bb = m.bounds();
      let R = 0;
      if (it.shade === 'normal') { const dist = m.insideDistance(); for (let i = 0; i < dist.length; i++) if (dist[i] > R) R = dist[i]; }
      geo = { bb, R }; cache.set(it, geo);
    }
    const ln = Math.hypot(light[0], light[1], light[2]) || 1, Lx = light[0] / ln, Ly = light[1] / ln, Lz = light[2] / ln;
    const bb = geo.bb!;
    if (it.shade === 'linear') { // straight gradient across the shape, lit corner to shaded corner
      const ll = Math.hypot(light[0], light[1]) || 1, ux = -light[0] / ll, uy = -light[1] / ll;
      const corners = [[bb.x0, bb.y0], [bb.x1 + 1, bb.y0], [bb.x0, bb.y1 + 1], [bb.x1 + 1, bb.y1 + 1]].map(([x, y]) => x * ux + y * uy);
      const lo = Math.min(...corners), hi = Math.max(...corners), t = ((sx + 0.5) * ux + (sy + 0.5) * uy - lo) / (hi - lo || 1);
      return L[Math.max(0, Math.min(n - 1, Math.floor(t * it.gain * n)))];
    }
    const [nx, ny, nz] = this.curvedNormal(it, sx, sy, S, geo);
    const dot = nx * Lx + ny * Ly + nz * Lz;
    const pos = Math.round(mid - (dot - Lz) * it.gain * (n - 1));
    return L[Math.max(0, Math.min(n - 1, pos))];
  }

  /** Surface normal of a `sphere` / `cyl` / `normal` shaded item at a working-resolution sample (screen terms, y down). */
  private curvedNormal(it: Item, sx: number, sy: number, S: number, geo: { bb: ReturnType<Mask['bounds']>; R: number }): [number, number, number] {
    const m = it.mask, bb = geo.bb!;
    let nx = 0, ny = 0, nz = 1;
    if (it.shade === 'sphere' || it.shade === 'cyl') {
      const cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2, rx = (bb.x1 - bb.x0 + 1) / 2, ry = (bb.y1 - bb.y0 + 1) / 2;
      const ux = (sx + 0.5 - cx) / rx, uy = (sy + 0.5 - cy) / ry;
      if (it.shade === 'sphere') { nx = ux; ny = uy; }
      else if (it.axis === 'x') ny = uy; else nx = ux;
      const q = nx * nx + ny * ny;
      if (q > 1) { const k = 1 / Math.sqrt(q); nx *= k; ny *= k; }
      nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    } else { // normal: dome over the inside distance field
      const dist = m.insideDistance(), W = m.w, at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= m.h ? 0 : dist[y * W + x]);
      const R = Math.max(1e-3, it.round !== undefined ? it.round * S : geo.R), d = at(sx, sy), u = Math.min(1, d / R);
      const gx = (at(sx + 1, sy) - at(sx - 1, sy)) / 2, gy = (at(sx, sy + 1) - at(sx, sy - 1)) / 2, gl = Math.hypot(gx, gy);
      if (gl > 1e-6 && u < 1) {
        const slope = Math.min(4, (1 - u) / Math.sqrt(Math.max(1e-4, 1 - (1 - u) * (1 - u))));
        const tx = -gx / gl, ty = -gy / gl, k = 1 / Math.sqrt(1 + slope * slope);
        nx = tx * slope * k; ny = ty * slope * k; nz = k;
      }
    }
    return [nx, ny, nz];
  }

  /** Normal-map normal of an item at a working-resolution sample (P6a): curved shades exact, the rest approximated. */
  private normalAt(it: Item, sx: number, sy: number, S: number, cache: Map<Item, { bb: ReturnType<Mask['bounds']>; R: number }>): [number, number, number] {
    if (it.fixed || it.underlay || !it.levels.length) return [0, 0, 1];
    const light = this.env.dir.camera.light, lx = Math.sign(light[0]), ly = Math.sign(light[1]), m = it.mask;
    if (it.shade === 'sphere' || it.shade === 'cyl' || it.shade === 'normal') {
      this.shadeAt(it, sx, sy, S, cache); // fills the geometry cache
      return this.curvedNormal(it, sx, sy, S, cache.get(it)!);
    }
    if (it.shade === 'bevel') {
      const lit = (!!lx && !m.has(sx + lx * S, sy)) || (!!ly && !m.has(sx, sy + ly * S));
      const dark = (!!lx && !m.has(sx - lx * S, sy)) || (!!ly && !m.has(sx, sy - ly * S));
      if (lit && !dark) return [lx * 0.6, ly * 0.6, 1];
      if (dark && !lit) return [-lx * 0.6, -ly * 0.6, 1];
    }
    if (it.shade === 'linear') return [-lx * 0.3, -ly * 0.3, 1];
    return [0, 0, 1];
  }

  /** Render to a Raster (before the outer line and shadows): S1 output, the input of the procedural pass. */
  raster(): Raster {
    const S = this.samples, mode = this.mode, items = this.compile(S), W = this.w * S, H = this.h * S;
    const label = new Int16Array(W * H).fill(-1);
    // underlays only ink over content already drawn: the silhouette edge is the outer line's job
    for (const it of items) for (let i = 0; i < label.length; i++) if (it.mask.d[i] && (!it.underlay || label[i] >= 0)) label[i] = it.rank;
    const r = new Raster(this.w, this.h, items, this.env.dir.outline), cache = new Map();
    const stage = this.opts.stage;
    if (stage) {
      const g = new Grid(W, H);
      for (let i = 0; i < label.length; i++) if (label[i] >= 0) {
        const it = items[label[i]], c = it.fixed ?? it.ramp![this.shadeAt(it, i % W, (i / W) | 0, S, cache)];
        g.set(i % W, (i / W) | 0, c);
      }
      stage(mode === 'ss' ? 'raster-ss' : 'coverage', g);
    }
    const half = (S * S) / 2;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const counts = new Map<number, number>();
      let empty = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const sx = x * S + i, sy = y * S + j, l = label[sy * W + sx];
        if (l < 0) { empty++; continue; }
        const key = mode === 'ss' ? l * 4096 + this.shadeAt(items[l], sx, sy, S, cache) : l;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      if (empty > half) continue;
      let best = -1, bn = 0;
      for (const [k, c] of counts) if (c > bn || (c === bn && k > best)) { bn = c; best = k; }
      const p = y * this.w + x;
      if (mode === 'ss') { r.id[p] = Math.floor(best / 4096); r.band[p] = best % 4096; }
      else { r.id[p] = best; r.band[p] = this.shadeAt(items[best], x * S + (S >> 1), y * S + (S >> 1), S, cache); }
    }
    // normals per final pixel at its centre sample (normal maps, P6a)
    r.normal = new Float32Array(this.w * this.h * 3);
    for (let p = 0; p < r.id.length; p++) {
      if (r.id[p] < 0) continue;
      const it = items[r.id[p]], x = p % this.w, y = (p / this.w) | 0;
      r.normal.set(this.normalAt(it, x * S + (S >> 1), y * S + (S >> 1), S, cache), p * 3);
    }
    // final-resolution passes: patterns, ink, cast shadows, AO
    for (let p = 0; p < r.id.length; p++) {
      const it = items[r.id[p]];
      if (it?.pattern) { const b = it.pattern(p % this.w, (p / this.w) | 0, r.band[p]); if (b != null && it.ramp && b >= 0 && b < it.ramp.length) r.band[p] = b; }
    }
    const inkFlags: number[] = [];
    for (let p = 0; p < r.id.length; p++) {
      const id = r.id[p];
      if (id < 0) continue;
      const it = items[id], x = p % this.w, y = (p / this.w) | 0;
      if (it.underlay) { r.flag[p] |= INK; continue; }
      if (!it.ink) continue;
      const hit = N4.some(([dx, dy]) => {
        const q = r.idx(x + dx, y + dy);
        if (it.ink === 'all') return q < 0 || r.id[q] !== id;
        return q >= 0 && r.id[q] >= 0 && r.id[q] !== id && items[r.id[q]].rank < it.rank;
      });
      if (hit) inkFlags.push(p);
    }
    for (const p of inkFlags) r.flag[p] |= INK;
    const light = this.env.dir.camera.light, sx = -Math.sign(light[0]), sy = -Math.sign(light[1]), darkened = new Uint8Array(r.id.length);
    for (const it of items) {
      if (!it.cast && !it.ao) continue;
      for (let p = 0; p < r.id.length; p++) {
        if (r.id[p] !== it.rank) continue;
        const x = p % this.w, y = (p / this.w) | 0;
        const targets: number[] = [];
        if (it.cast) for (let k = 1; k <= it.cast; k++) targets.push(r.idx(x + sx * k, y + sy * k));
        if (it.ao) for (const [dx, dy] of N4) targets.push(r.idx(x + dx, y + dy));
        for (const q of targets) {
          if (q < 0 || r.id[q] < 0 || darkened[q] || items[r.id[q]].rank >= it.rank || items[r.id[q]].underlay) continue;
          if (r.step(q, 1)) darkened[q] = 1;
        }
      }
    }
    stage?.('downsample', r.toGrid());
    return r;
  }

  /** Colours → outer line → shadows (shared with the procedural pass). */
  finalize(r: Raster, extra: Pick<Scene2DOptions, 'shadow' | 'groundShadow'> = {}): Grid {
    let g = r.toGrid();
    const normal = r.normalMap();
    const stage = this.opts.stage, { dir } = this.env, o = { ...this.opts, ...extra };
    if (o.outline !== false) { g = this.env.line(g); stage?.('outline', g); }
    if (o.shadow) { g = post.dropShadow(g, o.shadow[0], o.shadow[1], dir.shadow); stage?.('shadow', g); }
    if (o.groundShadow) {
      const s = new Grid(g.w, g.h);
      groundShadow(s, ...o.groundShadow, dir.shadow);
      g = s.stamp(g); stage?.('ground-shadow', g);
    }
    if (normal) g.normal = normal;
    return g;
  }

  render(): Grid { return this.finalize(this.raster()); }
}
