/**
 * Animation library (P6c, SPEC §10): `t`-driven params, a pose rig with 2-bone IK and spring chains — so an asset
 * animates intent (where the hand goes, where the feet plant) and secondary motion comes from simulation, not keys.
 *
 *   ease(name, u) / track(keys, t) / blend(keyPoses, t)     keyframed numbers, arrays and poses over t in [0, 1)
 *   rig({ root, bones }).pose(angles, { ik })               forward kinematics + 2-bone IK from hand / foot targets
 *   spring({ n, len, … }).at(ms, rootAt)                    hair, cloth and tails: seeded fixed-step simulation (R9)
 *   sweep(fn, t, span, n)                                   where a point was over the last `span` of t (motion trails)
 *
 * Angles are degrees in screen space (x right, y down): 0 points straight down (+y), positive turns toward +x, so a
 * spine pointing up is 180. Bone angles are relative to the parent bone (root bones: absolute).
 */
import { rng } from '../lib/rng.ts';

export type P2 = [number, number];
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'step' | 'smooth';

/** Easing over u in [0, 1]. `step` holds the start value; `smooth` is smoothstep. */
export function ease(name: Ease = 'linear', u: number): number {
  u = Math.max(0, Math.min(1, u));
  switch (name) {
    case 'in': return u * u;
    case 'out': return 1 - (1 - u) * (1 - u);
    case 'inOut': return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    case 'smooth': return u * u * (3 - 2 * u);
    case 'step': return 0;
    default: return u;
  }
}

type Val = number | number[] | Record<string, unknown>;

function lerpVal(a: Val, b: Val, u: number): Val {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v + ((b[i] ?? v) - v) * u);
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = (a as Record<string, unknown>)[k], y = (b as Record<string, unknown>)[k];
      out[k] = x === undefined ? y : y === undefined ? x : lerpVal(x as Val, y as Val, u);
    }
    return out;
  }
  return u < 1 ? a : b;
}

export interface TrackOptions {
  ease?: Ease;
  /** Wrap from the last key back to the first at t = 1 (looping states). Default true. */
  loop?: boolean;
}

/**
 * Keyframed value at `t` in [0, 1): keys `[[t0, v0], [t1, v1], …]` sorted by t, values numbers, number arrays or
 * plain objects of those (poses). Looping tracks run from the last key back to the first one at t = 1.
 */
export function track<T extends Val>(keys: [number, T][], t: number, o: TrackOptions = {}): T {
  if (!keys.length) throw new Error('track: no keys');
  const ks = [...keys].sort((a, b) => a[0] - b[0]), loop = o.loop ?? true;
  if (ks.length === 1) return ks[0][1];
  const tt = loop ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));
  for (let i = 0; i < ks.length; i++) {
    const [ta, va] = ks[i], next = ks[i + 1] ?? (loop ? [ks[0][0] + 1, ks[0][1]] as [number, T] : undefined);
    if (!next) return va;
    if (tt < ta && i === 0) {
      if (!loop) return va;
      const [tl, vl] = ks[ks.length - 1], span = ta + 1 - tl;
      return lerpVal(vl, va, ease(o.ease, (tt + 1 - tl) / span)) as T;
    }
    if (tt >= ta && tt < next[0]) return lerpVal(va, next[1], ease(o.ease, (tt - ta) / (next[0] - ta))) as T;
  }
  return ks[ks.length - 1][1];
}

/** Key poses blended over t: `blend({ 0: rest, 0.4: windup, 0.6: strike }, t)`. */
export const blend = <T extends Val>(keys: Record<number, T>, t: number, o: TrackOptions = {}): T =>
  track(Object.entries(keys).map(([k, v]) => [+k, v] as [number, T]), t, o);

/** 0 → 1 → 0 over one period. */
export const pingpong = (t: number): number => { const u = ((t % 1) + 1) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; };

// ---------------------------------------------------------------------------------------------------------------
// pose rig

const RAD = Math.PI / 180;
const dirOf = (deg: number): P2 => [Math.sin(deg * RAD), Math.cos(deg * RAD)];
const angOf = (v: P2): number => Math.atan2(v[0], v[1]) / RAD;
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const len2 = (v: P2) => Math.hypot(v[0], v[1]);

export interface BoneDef {
  /** Parent bone (absent: hangs from the rig root). */
  parent?: string;
  /** Where on the parent it starts: 0 = the parent's start, 1 = its end (default). */
  at?: number;
  /** Offset of the start from that point, px (shoulders sideways from the spine top, hips from the pelvis). */
  offset?: P2;
  len: number;
  /** Rest angle (degrees, relative to the parent; absolute for root bones). */
  angle?: number;
}

export interface RigDef {
  /** Root position in px (pelvis). */
  root: P2;
  bones: Record<string, BoneDef>;
}

export interface Bone { name: string; a: P2; b: P2; /** absolute angle */ angle: number; len: number }

export interface PoseOptions {
  /** Move the root (bob, lunge). */
  root?: P2;
  /**
   * 2-bone IK on the named end bone (a shin, a forearm): its parent and itself turn so its end reaches `target`;
   * `bend` +1 / −1 picks which way the middle joint (knee, elbow) points. Out-of-reach targets stretch toward them.
   */
  ik?: Record<string, { target: P2; bend?: 1 | -1 }>;
}

export interface Pose {
  bones: Record<string, Bone>;
  /** Relative angles after IK (what was solved), per bone. */
  angles: Record<string, number>;
  /** End point of a bone (a hand, a foot, the head top). */
  end(name: string): P2;
  start(name: string): P2;
  bone(name: string): Bone;
  /** A point along a bone (0 = start, 1 = end) pushed `side` px perpendicular to it. */
  along(name: string, u: number, side?: number): P2;
}

export interface Rig {
  def: RigDef;
  /** Bone names, parents before children. */
  order: string[];
  /** Pose from relative angles (missing = rest) plus IK targets. */
  pose(angles?: Record<string, number>, o?: PoseOptions): Pose;
}

/** 2-bone IK: absolute angles of the upper and lower bone reaching from `s` to `target`. */
export function solveTwoBone(s: P2, l1: number, l2: number, target: P2, bend: 1 | -1 = 1): [number, number] {
  const v = sub(target, s), d = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min(l1 + l2 - 1e-6, len2(v) || 1e-6));
  const theta = angOf(len2(v) ? v : [0, 1]);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) / RAD;
  const a1 = theta + bend * alpha, joint = add(s, dirOf(a1), l1);
  const toT = sub(add(s, dirOf(theta), d), joint);
  return [a1, angOf(toT)];
}

export function rig(def: RigDef): Rig {
  const names = Object.keys(def.bones), order: string[] = [], seen = new Set<string>();
  const visit = (n: string, path: string[] = []) => {
    if (seen.has(n)) return;
    if (path.includes(n)) throw new Error(`rig: bone cycle ${[...path, n].join(' → ')}`);
    const p = def.bones[n].parent;
    if (p !== undefined) { if (!def.bones[p]) throw new Error(`rig: bone ${n} has unknown parent ${p}`); visit(p, [...path, n]); }
    seen.add(n); order.push(n);
  };
  names.forEach(n => visit(n));

  const fk = (rel: Record<string, number>, root: P2): Record<string, Bone> => {
    const out: Record<string, Bone> = {};
    for (const n of order) {
      const b = def.bones[n], par = b.parent ? out[b.parent] : undefined;
      const base: P2 = par ? add(par.a, sub(par.b, par.a), b.at ?? 1) : root;
      const a = b.offset ? add(base, b.offset) : base, angle = (par?.angle ?? 0) + rel[n];
      out[n] = { name: n, a, b: add(a, dirOf(angle), b.len), angle, len: b.len };
    }
    return out;
  };

  return {
    def, order,
    pose(angles = {}, o = {}) {
      const rel: Record<string, number> = {};
      for (const n of order) rel[n] = angles[n] ?? def.bones[n].angle ?? 0;
      const root = o.root ?? def.root;
      let bones = fk(rel, root);
      for (const [end, { target, bend = 1 }] of Object.entries(o.ik ?? {})) {
        const lo = def.bones[end], up = lo?.parent;
        if (!lo || !up) throw new Error(`rig: IK needs an end bone with a parent (${end})`);
        if ((lo.at ?? 1) !== 1 || lo.offset) throw new Error(`rig: IK bone ${end} must start at its parent's end`);
        const gp = def.bones[up].parent, s = bones[up].a, [a1, a2] = solveTwoBone(s, def.bones[up].len, lo.len, target, bend);
        rel[up] = a1 - (gp ? bones[gp].angle : 0);
        rel[end] = a2 - a1;
        bones = fk(rel, root);
      }
      const get = (n: string) => { const b = bones[n]; if (!b) throw new Error(`rig: no bone ${n}`); return b; };
      return {
        bones, angles: rel,
        end: n => get(n).b, start: n => get(n).a, bone: get,
        along(n, u, side = 0) {
          const b = get(n), d = sub(b.b, b.a), l = len2(d) || 1;
          return [b.a[0] + d[0] * u + (-d[1] / l) * side, b.a[1] + d[1] * u + (d[0] / l) * side];
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// spring chains

export interface SpringOptions {
  /** Segments (points after the root). */
  n: number;
  /** Segment length in px (or one per segment). */
  len: number | number[];
  /** Rest angle of each segment relative to the one before (the first: relative to the root's angle), degrees. */
  rest?: number | number[];
  /** Pull toward the rest shape per step, 0–1 (0.15 cloth, 0.4 a stiff tail). */
  stiffness?: number;
  /** Velocity lost per step, 0–1. */
  damping?: number;
  /** px/s² downward. */
  gravity?: number;
  /** Mean wind px/s² along +x, with seeded gusts of ±`gust` × wind. */
  wind?: number;
  gust?: number;
  seed?: number;
  /** Fixed step in ms (default 1000/60). */
  step?: number;
}

/** Where the chain hangs from at time `ms`: a world position (px) and the angle (degrees) its rest shape hangs at. */
export type RootAt = (ms: number) => { pos: P2; angle?: number };

export interface SpringChain {
  /**
   * Points of the chain at `ms` (root first), relative to the root's position then — add the screen point the chain
   * hangs from. The simulation starts at `-warm` ms (default one second) from the rest shape and runs in fixed steps
   * up to `ms`, so every frame is reproducible on its own and a looping root gives a near-seamless loop.
   */
  at(ms: number, rootAt: RootAt, o?: { warm?: number }): P2[];
}

export function spring(o: SpringOptions): SpringChain {
  const n = o.n, L = (i: number) => (Array.isArray(o.len) ? o.len[i] ?? o.len[o.len.length - 1] : o.len);
  const R = (i: number) => (Array.isArray(o.rest) ? o.rest[i] ?? 0 : i === 0 ? o.rest ?? 0 : 0);
  const k = o.stiffness ?? 0.2, damp = o.damping ?? 0.08, g = o.gravity ?? 400, wind = o.wind ?? 0, gust = o.gust ?? 0.5, step = o.step ?? 1000 / 60;
  return {
    at(ms, rootAt, opt = {}) {
      const warm = opt.warm ?? 1000, steps = Math.max(0, Math.round((ms + warm) / step)), t0 = ms - steps * step, dt = step / 1000;
      const r0 = rootAt(t0), pts: P2[] = [r0.pos], prev: P2[] = [r0.pos];
      let a = r0.angle ?? 0;
      for (let i = 0; i < n; i++) { a += R(i); const p = add(pts[i], dirOf(a), L(i)); pts.push(p); prev.push(p); }
      // gusts: a seeded random walk sampled per step, the same sequence for every frame (R9)
      const r = rng(o.seed ?? 1);
      let w = 0;
      for (let s = 1; s <= steps; s++) {
        const t = t0 + s * step, root = rootAt(t);
        w += (r() - 0.5) * 0.3; w *= 0.97;
        const fx = wind * (1 + gust * w * 2);
        pts[0] = root.pos; prev[0] = root.pos;
        let ang = root.angle ?? 0;
        for (let i = 1; i <= n; i++) {
          const p = pts[i], v = sub(p, prev[i]);
          prev[i] = p;
          let q: P2 = [p[0] + v[0] * (1 - damp) + fx * dt * dt, p[1] + v[1] * (1 - damp) + g * dt * dt];
          // angular spring toward the rest shape, then the length constraint
          ang += R(i - 1);
          const want = add(pts[i - 1], dirOf(ang), L(i - 1));
          q = [q[0] + (want[0] - q[0]) * k, q[1] + (want[1] - q[1]) * k];
          const d = sub(q, pts[i - 1]), l = len2(d) || 1;
          q = add(pts[i - 1], d, L(i - 1) / l);
          pts[i] = q;
          ang = angOf(sub(q, pts[i - 1]));
        }
      }
      const base = pts[0];
      return pts.map(p => [p[0] - base[0], p[1] - base[1]] as P2);
    },
  };
}

/** Samples of `fn` over the last `span` of t up to `t` (oldest first): the path a hand or blade tip swept (trails). */
export function sweep(fn: (t: number) => P2, t: number, span: number, n = 6): P2[] {
  return Array.from({ length: n }, (_, i) => fn(t - span + (span * i) / Math.max(1, n - 1)));
}

/** State timing for a render cell (see `cellTiming`). */
export interface CellTiming {
  /** Logical frame (what the animation contract counts) and smoothing sub-frame within it. */
  logical: number;
  sub: number;
  /** Start of this displayed frame, ms into the state, and the state's length in ms. */
  ms: number;
  duration: number;
}

/**
 * Timing of displayed frame `d` of a state with `frames` logical frames, `sub` sub-frames each (display-only smoothing)
 * and per-logical-frame durations in ms (sub-frames split their frame's time evenly).
 */
export function cellTiming(d: number, frames: number, sub: number, durations: number[]): CellTiming {
  const logical = Math.floor(d / sub), s = d % sub;
  let ms = 0;
  for (let i = 0; i < logical; i++) ms += durations[i];
  ms += (durations[logical] * s) / sub;
  return { logical, sub: s, ms, duration: durations.slice(0, frames).reduce((a, b) => a + b, 0) };
}
