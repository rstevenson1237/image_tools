/**
 * L-systems (SPEC §6.4 `detail`, §9; PLAN P6b): seeded rewriting + a turtle, for branching growth — cracks, roots,
 * vines, twigs, coral, lightning. The turtle returns segments; `lsystemSpecs` turns them into T2+ `tube` shapes
 * (R4: a shape, not a stroke) so they shade, ink and lint like any part.
 *
 * Symbols: `F` / `G` draw forward, `f` moves without drawing, `+` / `-` turn by `angle` (± `jitter`), `[` / `]` push /
 * pop the turtle (branches get thinner by `taper`), anything else is a placeholder for rules. Rules may be stochastic:
 * `{ F: [['F[+F]F', 2], ['F[-F]F', 1]] }` picks by weight from the seeded RNG (R9).
 */
import { rng as mulberry } from '../lib/rng.ts';

export type Rule = string | [string, number][];

export function lsystem(axiom: string, rules: Record<string, Rule>, iterations: number, seed = 1): string {
  const r = mulberry(seed);
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let out = '';
    for (const ch of s) {
      const rule = rules[ch];
      if (rule === undefined) { out += ch; continue; }
      if (typeof rule === 'string') { out += rule; continue; }
      const total = rule.reduce((a, [, w]) => a + w, 0);
      let pick = r() * total, chosen = rule[rule.length - 1][0];
      for (const [t, w] of rule) { pick -= w; if (pick <= 0) { chosen = t; break; } }
      out += chosen;
    }
    s = out;
    if (s.length > 200_000) throw new Error('lsystem: string grew past 200k symbols — fewer iterations');
  }
  return s;
}

export interface Segment { a: [number, number]; b: [number, number]; depth: number; width: number }

export interface TurtleOptions {
  start: [number, number];
  /** Heading in degrees (0 = +x, 90 = down the screen; default -90 = up). */
  heading?: number;
  /** Turn per `+`/`-` in degrees. */
  angle: number;
  /** Step length in px (default 2); each branch level multiplies it by `shrink` (default 0.8). */
  step?: number;
  shrink?: number;
  /** Width of the trunk in px (default 1.5); each branch level multiplies it by `taper` (default 0.7). */
  width?: number;
  taper?: number;
  /** Random turn added per turn, degrees (seeded). */
  jitter?: number;
  seed?: number;
}

export function turtle(program: string, o: TurtleOptions): Segment[] {
  const r = mulberry(o.seed ?? 1), out: Segment[] = [], stack: { x: number; y: number; h: number; d: number }[] = [];
  let x = o.start[0], y = o.start[1], h = o.heading ?? -90, d = 0;
  const step = o.step ?? 2, shrink = o.shrink ?? 0.8, width = o.width ?? 1.5, taper = o.taper ?? 0.7, jit = o.jitter ?? 0;
  for (const ch of program) {
    if (ch === 'F' || ch === 'G' || ch === 'f') {
      const len = step * shrink ** d, nx = x + Math.cos((h * Math.PI) / 180) * len, ny = y + Math.sin((h * Math.PI) / 180) * len;
      if (ch !== 'f') out.push({ a: [x, y], b: [nx, ny], depth: d, width: Math.max(0.6, width * taper ** d) });
      x = nx; y = ny;
    } else if (ch === '+') h += o.angle + (r() - 0.5) * 2 * jit;
    else if (ch === '-') h -= o.angle + (r() - 0.5) * 2 * jit;
    else if (ch === '[') { stack.push({ x, y, h, d }); d++; }
    else if (ch === ']') { const s = stack.pop(); if (s) ({ x, y, h, d } = s); }
  }
  return out;
}

/** Segments as T2+ tube specs (one per segment, tapered by depth) for `scene.add(...)`. */
export function lsystemSpecs(segs: Segment[], style: { name?: string; mat?: string | string[]; color?: string; shade?: string; underlay?: boolean }): Record<string, unknown>[] {
  return segs.map(s => ({ type: 'tube', pts: [s.a, s.b], w: s.width, w1: Math.max(0.6, s.width * 0.85), ...style }));
}
