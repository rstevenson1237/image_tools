/**
 * T2+ geometry: affine transforms, SVG path data → polygons, primitive outlines as polygons, and `Mask`, the
 * coverage bitmap every shape compiles to at the working resolution (1 px for `direct`, ss× for `ss`).
 * Coordinates are sprite pixels with SVG semantics: pixel (i, j) covers [i, i+1) × [j, j+1).
 */

export type Pt = [number, number];
/** Affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (SVG order). */
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, sy, 0, 0];
export function rotate(deg: number): Mat {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}
/** `m` applied about the point (ox, oy). */
export const about = (m: Mat, ox: number, oy: number): Mat => mul(translate(ox, oy), mul(m, translate(-ox, -oy)));
/** Mirror across the vertical line x = ax (or the horizontal line y = ay). */
export const mirrorX = (ax: number): Mat => [-1, 0, 0, 1, 2 * ax, 0];
export const mirrorY = (ay: number): Mat => [1, 0, 0, -1, 0, 2 * ay];

export const apply = (m: Mat, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** Mean linear scale of a matrix (for curve flattening tolerances). */
export const matScale = (m: Mat): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

/** Transform spec shared by every T2+ node. */
export interface TransformSpec {
  translate?: Pt;
  /** Degrees, clockwise on screen (y points down). */
  rotate?: number;
  scale?: number | Pt;
  /** Pivot for rotate/scale (default [0, 0]). */
  origin?: Pt;
  /** Flip about the origin. */
  flip?: 'x' | 'y';
}

export function specMatrix(t: TransformSpec): Mat {
  let m: Mat = IDENTITY;
  const [ox, oy] = t.origin ?? [0, 0];
  if (t.scale !== undefined || t.flip) {
    const [sx, sy] = typeof t.scale === 'number' ? [t.scale, t.scale] : (t.scale ?? [1, 1]);
    m = mul(about(scale(t.flip === 'x' ? -sx : sx, t.flip === 'y' ? -sy : sy), ox, oy), m);
  }
  if (t.rotate) m = mul(about(rotate(t.rotate), ox, oy), m);
  if (t.translate) m = mul(translate(t.translate[0], t.translate[1]), m);
  return m;
}

// ---------------------------------------------------------------------------------------------- SVG path data

const segs = (len: number, tol: number) => Math.max(4, Math.min(96, Math.ceil(len / tol)));

/**
 * Parse SVG path data (M L H V C S Q T A Z, absolute and relative) into flattened subpaths. `tol` is the
 * target segment length in path units (smaller = smoother curves).
 */
export function parsePath(d: string, tol = 0.5): Pt[][] {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Pt[][] = [];
  let i = 0, cmd = '', cur: Pt = [0, 0], start: Pt = [0, 0], sub: Pt[] | null = null, lastCtrl: Pt | null = null, lastCmd = '';
  const num = () => {
    const t = toks[i++];
    if (t === undefined || /^[a-zA-Z]$/.test(t)) throw new Error(`path: expected a number near token ${i} in "${d.slice(0, 40)}"`);
    return +t;
  };
  const pt = (rel: boolean): Pt => { const x = num(), y = num(); return rel ? [cur[0] + x, cur[1] + y] : [x, y]; };
  const lineTo = (p: Pt) => { if (!sub) { sub = [cur]; out.push(sub); } sub.push(p); cur = p; };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) throw new Error(`path: data must start with a command: "${d.slice(0, 40)}"`);
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'M') {
      cur = pt(rel); start = cur; sub = [cur]; out.push(sub);
      cmd = rel ? 'l' : 'L'; // further pairs are line-tos
      lastCtrl = null; lastCmd = 'M';
      continue;
    }
    if (C === 'Z') { if (sub) { sub.push(start); } cur = start; sub = null; lastCtrl = null; lastCmd = 'Z'; continue; }
    if (C === 'L') lineTo(pt(rel));
    else if (C === 'H') { const x = num(); lineTo([rel ? cur[0] + x : x, cur[1]]); }
    else if (C === 'V') { const y = num(); lineTo([cur[0], rel ? cur[1] + y : y]); }
    else if (C === 'C' || C === 'S') {
      const p0 = cur;
      let c1: Pt;
      if (C === 'C') c1 = pt(rel);
      else c1 = lastCtrl && (lastCmd === 'C' || lastCmd === 'S') ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
      const c2 = pt(rel), p3 = pt(rel);
      const n = segs(Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]), tol);
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        lineTo([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
      }
      lastCtrl = c2;
    } else if (C === 'Q' || C === 'T') {
      const p0 = cur;
      const c: Pt = C === 'Q' ? pt(rel) : lastCtrl && (lastCmd === 'Q' || lastCmd === 'T') ? [2 * p0[0] - lastCtrl[0], 2 * p0[1] - lastCtrl[1]] : p0;
      const p2 = pt(rel);
      const n = segs(Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p2[0] - c[0], p2[1] - c[1]), tol);
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        lineTo([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]);
      }
      lastCtrl = c;
    } else if (C === 'A') {
      const rx0 = num(), ry0 = num(), rotDeg = num(), large = num(), sweep = num(), p = pt(rel);
      arcTo(cur, p, rx0, ry0, rotDeg, !!large, !!sweep, tol).forEach(lineTo);
      lastCtrl = null;
    } else throw new Error(`path: unsupported command ${cmd}`);
    lastCmd = C;
  }
  return out.filter(s => s.length > 1);
}

/** SVG elliptical arc (endpoint form, SVG 1.1 F.6.5) as points after `p0`. */
function arcTo(p0: Pt, p1: Pt, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, tol: number): Pt[] {
  if (!rx || !ry) return [p1];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2, x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (co * rx * y1) / ry, cy1 = (-co * ry * x1) / rx;
  const cx = cp * cx1 - sp * cy1 + (p0[0] + p1[0]) / 2, cy = sp * cx1 + cp * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = segs(Math.abs(dt) * Math.max(rx, ry), tol), out: Pt[] = [];
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push(k === n ? p1 : [cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- primitives

/** Points around an ellipse, clockwise on screen, starting at angle a0 (degrees, 0 = +x). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, tol = 0.25, a0 = 0, a1 = 360): Pt[] {
  const sweep = ((a1 - a0) * Math.PI) / 180, n = segs(Math.abs(sweep) * Math.max(rx, ry), tol), out: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = (a0 * Math.PI) / 180 + (sweep * k) / n;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  if (Math.abs(a1 - a0) >= 360) out.pop();
  return out;
}

/** Rectangle with optional corner radius. */
export function rectPts(x: number, y: number, w: number, h: number, r = 0, tol = 0.25): Pt[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return [
    ...ellipsePts(x + w - r, y + r, r, r, tol, -90, 0), ...ellipsePts(x + w - r, y + h - r, r, r, tol, 0, 90),
    ...ellipsePts(x + r, y + h - r, r, r, tol, 90, 180), ...ellipsePts(x + r, y + r, r, r, tol, 180, 270),
  ];
}

/** Capsule between two centres with radii r0, r1 (tapered when they differ). */
export function capsulePts(a: Pt, b: Pt, r0: number, r1 = r0, tol = 0.25): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 1e-6) return ellipsePts(a[0], a[1], Math.max(r0, r1), Math.max(r0, r1), tol);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  // tangent offset angle for unequal radii (external tangents of two circles)
  const off = (Math.asin(Math.max(-1, Math.min(1, (r0 - r1) / len))) * 180) / Math.PI;
  return [...ellipsePts(b[0], b[1], r1, r1, tol, ang - 90 + off, ang + 90 - off), ...ellipsePts(a[0], a[1], r0, r0, tol, ang + 90 - off, ang + 270 + off)];
}

export function starPts(cx: number, cy: number, r: number, r2: number, n: number, rotDeg = -90): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < n * 2; k++) {
    const t = ((rotDeg + (k * 180) / n) * Math.PI) / 180, rr = k % 2 ? r2 : r;
    out.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- masks

/** Coverage bitmap at the working resolution (`s` samples per sprite pixel). */
export class Mask {
  readonly w: number;
  readonly h: number;
  readonly s: number;
  readonly d: Uint8Array;
  private inner?: Float32Array;

  constructor(w: number, h: number, s: number, d?: Uint8Array) {
    this.w = w; this.h = h; this.s = s; this.d = d ?? new Uint8Array(w * h);
  }

  has(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1; }

  /** Inside test at a point in sprite pixels. */
  at(px: number, py: number): boolean { return this.has(Math.floor(px * this.s), Math.floor(py * this.s)); }

  count(): number { let n = 0; for (let i = 0; i < this.d.length; i++) n += this.d[i]; return n; }

  any(): boolean { return this.d.includes(1); }

  clone(): Mask { return new Mask(this.w, this.h, this.s, this.d.slice()); }

  or(o: Mask): this { for (let i = 0; i < this.d.length; i++) this.d[i] |= o.d[i]; this.inner = undefined; return this; }
  and(o: Mask): this { for (let i = 0; i < this.d.length; i++) this.d[i] &= o.d[i]; this.inner = undefined; return this; }
  andNot(o: Mask): this { for (let i = 0; i < this.d.length; i++) this.d[i] &= o.d[i] ^ 1; this.inner = undefined; return this; }

  /** Bounding box in samples, or null when empty. */
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /**
   * Run an EDT over the bounding box grown by `m` samples (clamped to the mask): the nearest inside/outside
   * sample of anything that matters always lies in that window, so the result equals a full-canvas transform.
   */
  private windowEdt(m: number, sources: 0 | 1, sqrt: boolean): { dist: Float32Array; x0: number; y0: number; ww: number; wh: number } | null {
    const b = this.bounds();
    if (!b) return null;
    const x0 = Math.max(0, b.x0 - m), y0 = Math.max(0, b.y0 - m), x1 = Math.min(this.w - 1, b.x1 + m), y1 = Math.min(this.h - 1, b.y1 + m);
    const ww = x1 - x0 + 1, wh = y1 - y0 + 1, f = new Float32Array(ww * wh);
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) f[y * ww + x] = this.d[(y + y0) * this.w + x + x0] === sources ? 0 : 1e20;
    return { dist: edt(f, ww, wh, sqrt), x0, y0, ww, wh };
  }

  /** Distance (in samples) from each inside sample to the nearest outside sample; 0 outside. */
  insideDistance(): Float32Array {
    if (!this.inner) {
      this.inner = new Float32Array(this.w * this.h);
      const e = this.windowEdt(1, 0, true);
      if (e) for (let y = 0; y < e.wh; y++) for (let x = 0; x < e.ww; x++) this.inner[(y + e.y0) * this.w + x + e.x0] = e.dist[y * e.ww + x];
    }
    return this.inner;
  }

  /** Grow by `r` samples (Euclidean). */
  dilate(r: number): Mask {
    const out = new Mask(this.w, this.h, this.s), e = this.windowEdt(Math.ceil(r), 1, false), r2 = r * r + 1e-6;
    if (e) for (let y = 0; y < e.wh; y++) for (let x = 0; x < e.ww; x++) if (e.dist[y * e.ww + x] <= r2) out.d[(y + e.y0) * this.w + x + e.x0] = 1;
    return out;
  }

  /** Move by (dx, dy) samples. */
  shift(dx: number, dy: number): Mask {
    const out = new Mask(this.w, this.h, this.s);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h) out.d[ny * this.w + nx] = 1;
    }
    return out;
  }
}

/** Fill polygons (rings in sprite pixels) into a mask by scanline at sample centres. */
export function fillPolygons(m: Mask, rings: Pt[][], rule: 'nonzero' | 'evenodd' = 'nonzero'): Mask {
  const s = m.s, edges: [number, number, number, number, number][] = [];
  let ymin = Infinity, ymax = -Infinity;
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] === b[1]) continue;
    const dir = b[1] > a[1] ? 1 : -1, [p, q] = dir > 0 ? [a, b] : [b, a];
    edges.push([p[0] * s, p[1] * s, q[0] * s, q[1] * s, dir]);
    ymin = Math.min(ymin, p[1] * s); ymax = Math.max(ymax, q[1] * s);
  }
  const y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(m.h - 1, Math.ceil(ymax));
  const xs: [number, number][] = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const [ax, ay, bx, by, dir] of edges) if (sy >= ay && sy < by) xs.push([ax + ((sy - ay) * (bx - ax)) / (by - ay), dir]);
    if (!xs.length) continue;
    xs.sort((u, v) => u[0] - v[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += rule === 'evenodd' ? 1 : xs[k][1];
      const inside = rule === 'evenodd' ? wind % 2 === 1 : wind !== 0;
      if (!inside) continue;
      // samples whose centre x + 0.5 lies in [xa, xb)
      const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(m.w - 1, Math.ceil(xs[k + 1][0] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) m.d[y * m.w + x] = 1;
    }
  }
  return m;
}

/**
 * Exact squared Euclidean distance transform (Felzenszwalb–Huttenlocher) of `f` (0 at sources, 1e20 elsewhere).
 * With `sqrt`, returns distances instead of squared distances.
 */
function edt(f: Float32Array, w: number, h: number, sqrt: boolean): Float32Array {
  const n = Math.max(w, h), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n);
  const pass = (len: number, get: (i: number) => number, set: (i: number, val: number) => void) => {
    for (let i = 0; i < len; i++) g[i] = get(i);
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + g[v[k]]; }
    for (let i = 0; i < len; i++) set(i, d[i]);
  };
  const out = Float32Array.from(f);
  for (let x = 0; x < w; x++) pass(h, i => out[i * w + x], (i, val) => { out[i * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, i => out[y * w + i], (i, val) => { out[y * w + i] = val; });
  if (sqrt) for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i]);
  return out;
}
