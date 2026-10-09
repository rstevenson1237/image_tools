/**
 * Effects (P6c, SPEC §6.4 `particles` / `cycle`, §10): deterministic particle emitters drawn straight onto direction
 * colours, 11 presets, palette cycling, and the swept-trail helper. Every particle's start (time, place, velocity,
 * size, life) comes from a seeded generator by its index, and its state at a frame is simulated in fixed steps from
 * its own birth — so any frame renders on its own (R9) and a `stream` emitter loops seamlessly by construction:
 * birth times wrap around the loop period.
 *
 * Angles follow the rig's convention (degrees, 0 = down the screen, 180 = up, positive toward +x).
 * Colours run hottest → coolest over a particle's life: by default the direction's `effects.palette` ramps, lightest
 * step of the first ramp first, darkest step of the last ramp last.
 */
import type { DirContext } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { rng } from '../lib/rng.ts';
import { pValue } from '../tex/noise.ts';

export type P2 = [number, number];
type Range = number | [number, number];

export interface Emitter {
  /** Spawn point in px (default: the frame centre). */
  origin?: P2;
  /** Spawn area: a radius, or [rx, ry] half-extents of an ellipse. */
  area?: number | P2;
  /** Spawn along a polyline instead (trails): births spread along it, oldest at its start. */
  path?: P2[];
  count: number;
  /** `burst`: everything at t = 0 (+ `delay`); `stream`: births spread evenly over `period` and wrap (a loop). */
  mode?: 'burst' | 'stream';
  /** Direction of travel (degrees) and the cone's full width (360 = every way). */
  angle?: number;
  spread?: number;
  /** px per second. */
  speed?: Range;
  /** Lifetime in ms. */
  life?: Range;
  /** Burst stagger in ms. */
  delay?: Range;
  /** Velocity lost per second (exponential). */
  drag?: number;
  /** px/s² down the screen (negative: heat rises). */
  gravity?: number;
  /** Sideways wander, px/s (seeded per particle). */
  turbulence?: number;
  /** Turn rate of the velocity, degrees per second (magic spirals). */
  swirl?: number;
  /** Radius in px at birth and at death (sizes vary ±`sizeJitter`). */
  size?: [number, number];
  sizeJitter?: number;
  shape?: 'disc' | 'pixel' | 'streak' | 'diamond' | 'plus' | 'ring';
  /**
   * Merge this layer's particles into one banded shape (metaballs): where they overlap they fuse, the edge takes the
   * coolest colour and dense young cores the hottest — nested flame and smoke shapes instead of stacked discs.
   * `blob` is the field threshold for a pixel to show (default 0.5 when `true`).
   */
  blob?: boolean | number;
  /** blob: field heat that reaches the hottest colour (default 1.6; lower = more of the hot colours). */
  heat?: number;
  /** streak: tail length in seconds of travel. */
  streak?: number;
  /** streak: also draw a head disc of the particle's size (bright sparks that read at 1×). */
  head?: boolean;
  /** streak: the tail follows the path actually flown over the last `streak` seconds (never back past the birth point). */
  streakPath?: boolean;
  /** Colour tokens hottest → coolest (`glow.0`, `accent.2`), or ramp names. Default: the effects palette. */
  colors?: string[];
  /** Use only part of the colour run: [from, to] as fractions (sparks stay hot: [0, 0.5]). */
  band?: [number, number];
  /** Life fraction → colour exponent (> 1 stays hot longer). */
  curve?: number;
  /** stream: the loop period in ms (default: the effect's duration). */
  period?: number;
  seed?: number;
}

export interface ParticleOptions {
  w: number;
  h: number;
  /** Position in the effect, 0–1 (`ctx.t`). */
  t: number;
  /** Effect length in ms (`ctx.duration`). */
  duration: number;
  layers: Emitter[];
  seed?: number;
  /** Apply the direction's outer line (default: the direction's line pass, when given). */
  line?: ((g: Grid) => Grid) | false;
  /** Fixed simulation step in ms. */
  step?: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; color: string; rank: number; tail?: P2; shape: NonNullable<Emitter['shape']>;
  /** Layer index, life fraction left (1 at birth), and for blob layers the layer's colour run and field settings. */
  layer: number; life: number; blob?: { run: string[]; threshold: number; heat: number }; head?: boolean;
}

const RAD = Math.PI / 180;
const pick = (r: () => number, v: Range | undefined, d: number) => (v === undefined ? d : typeof v === 'number' ? v : v[0] + r() * (v[1] - v[0]));

/** Colour run for an emitter: tokens / ramp names → hexes, hottest first. */
export function colorRun(dir: DirContext, colors?: string[]): string[] {
  const names = colors?.length ? colors : dir.effects.palette.length ? dir.effects.palette : ['accent'];
  const out: string[] = [];
  for (const n of names) {
    const [name, idx] = n.split('.'), ramp = dir.pal[name] ?? dir.pal[dir.palette.materials[name]];
    if (!ramp) throw new Error(`particles: unknown colour ${JSON.stringify(n)}`);
    if (idx === undefined) out.push(...ramp);
    else { const i = idx === 'last' ? ramp.length - 1 : +idx; if (!ramp[i]) throw new Error(`particles: colour out of range ${n}`); out.push(ramp[i]); }
  }
  return out;
}

/** Live particles of every layer at time t (simulated from each particle's birth). */
export function simulate(dir: DirContext, o: ParticleOptions): Particle[] {
  const T = o.t * o.duration, step = o.step ?? 1000 / 60, out: Particle[] = [];
  o.layers.forEach((L, li) => {
    const run = colorRun(dir, L.colors), [b0, b1] = L.band ?? [0, 1];
    const lo = Math.floor(b0 * (run.length - 1) + 1e-9), hi = Math.max(lo, Math.ceil(b1 * (run.length - 1) - 1e-9));
    const cols = run.slice(lo, hi + 1), period = L.period ?? o.duration, origin = L.origin ?? [o.w / 2, o.h / 2];
    for (let i = 0; i < L.count; i++) {
      const r = rng(((o.seed ?? 1) * 7919 + (L.seed ?? 0) * 104729 + li * 1543 + i * 31) >>> 0);
      r(); // decorrelate neighbouring seeds
      const life = Math.max(1, pick(r, L.life, o.duration * 0.6));
      // birth: bursts at 0 (+ delay); streams evenly over the period with a little jitter, wrapping
      const birth0 = L.mode === 'stream' ? ((i + r() * 0.8) / L.count) * period : pick(r, L.delay, 0);
      const ang = (L.angle ?? 180) + ((r() - 0.5) * (L.spread ?? 360)), sp = pick(r, L.speed, 20);
      let sx: number, sy: number;
      if (L.path?.length) {
        const u = (i + 0.5) / L.count, seg = u * (L.path.length - 1), k = Math.min(L.path.length - 2, Math.floor(seg)), f = seg - k;
        const a = L.path[k], b = L.path[k + 1] ?? a;
        sx = a[0] + (b[0] - a[0]) * f; sy = a[1] + (b[1] - a[1]) * f;
      } else {
        const ar = L.area ?? 0, [ax, ay] = typeof ar === 'number' ? [ar, ar] : ar, th = r() * Math.PI * 2, rr = Math.sqrt(r());
        sx = origin[0] + Math.cos(th) * ax * rr; sy = origin[1] + Math.sin(th) * ay * rr;
      }
      const jit = 1 + ((r() - 0.5) * 2) * (L.sizeJitter ?? 0.25), turb = (r() - 0.5) * 2 * (L.turbulence ?? 0), phase = r() * Math.PI * 2;
      // ages alive now: a stream particle reborn every period (all of them, if life outlasts the period)
      const ages: number[] = [];
      if (L.mode === 'stream') { for (let k = 0; ; k++) { const a = ((T - birth0) % period + period) % period + k * period; if (a >= life) break; ages.push(a); } }
      else if (T - birth0 >= 0 && T - birth0 < life) ages.push(T - birth0);
      for (const age of ages) {
        let x = sx, y = sy, vx = Math.sin(ang * RAD) * sp, vy = Math.cos(ang * RAD) * sp;
        const n = Math.round(age / step), dt = step / 1000, keep = Math.exp(-(L.drag ?? 0) * dt), sw = (L.swirl ?? 0) * RAD * dt;
        const back = L.streakPath ? Math.round((L.streak ?? 0.08) * 1000 / step) : -1;
        let pathTail: P2 = [x, y];
        for (let s = 0; s < n; s++) {
          if (s === n - back) pathTail = [x, y];
          if (sw) { const c = Math.cos(sw), sn = Math.sin(sw), nx = vx * c - vy * sn; vy = vx * sn + vy * c; vx = nx; }
          vx *= keep; vy = vy * keep + (L.gravity ?? 0) * dt;
          const wob = turb ? turb * Math.sin(phase + s * dt * 9) : 0;
          x += (vx + wob) * dt; y += vy * dt;
        }
        const u = age / life, [s0, s1] = L.size ?? [1.5, 0.5], rad = Math.max(0, (s0 + (s1 - s0) * u) * jit);
        const ci = Math.min(cols.length - 1, Math.floor(Math.pow(u, L.curve ?? 1) * cols.length));
        const tail: P2 | undefined = L.shape !== 'streak' ? undefined : L.streakPath ? pathTail : [x - vx * (L.streak ?? 0.08), y - vy * (L.streak ?? 0.08)];
        out.push({
          x, y, vx, vy, r: rad, color: cols[ci], rank: lo + ci, shape: L.shape ?? 'disc', ...(tail && { tail }), ...(L.head && { head: true }), layer: li, life: 1 - u,
          ...(L.blob && { blob: { run: cols, threshold: typeof L.blob === 'number' ? L.blob : 0.5, heat: L.heat ?? 1.6 } }),
        });
      }
    }
  });
  return out;
}

/** Blob layers: a density field (smooth kernels) and a heat field (density × life left), banded to the run. */
function drawBlobs(g: Grid, ps: Particle[]) {
  const { run, threshold, heat } = ps[0].blob!, n = run.length, D = new Float32Array(g.w * g.h), H = new Float32Array(g.w * g.h);
  for (const p of ps) {
    const R = Math.max(0.8, p.r) * 1.35;
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(g.h - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(g.w - 1, p.x + R); x++) {
      const q = ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2) / (R * R);
      if (q >= 1) continue;
      const k = (1 - q) * (1 - q), i = y * g.w + x;
      D[i] += k; H[i] += k * (0.25 + 0.75 * p.life);
    }
  }
  for (let i = 0; i < D.length; i++) {
    if (D[i] < threshold) continue;
    const idx = Math.max(0, Math.min(n - 1, n - 1 - Math.floor((H[i] / heat) * n)));
    g.set(i % g.w, (i / g.w) | 0, run[idx]);
  }
}

/** Draw particles: blob layers first (in layer order), then the rest coolest first, so hot cores sit on top. */
export function drawParticles(g: Grid, ps: Particle[]): Grid {
  const blobs = new Map<number, Particle[]>();
  for (const p of ps) if (p.blob) { if (!blobs.has(p.layer)) blobs.set(p.layer, []); blobs.get(p.layer)!.push(p); }
  for (const k of [...blobs.keys()].sort((a, b) => a - b)) drawBlobs(g, blobs.get(k)!);
  const order = ps.filter(p => !p.blob).sort((a, b) => b.rank - a.rank || b.r - a.r);
  for (const p of order) {
    const { x, y, r, color: c } = p;
    if (p.shape === 'pixel' || r < 0.6) { g.set(Math.floor(x), Math.floor(y), c); continue; }
    if (p.shape === 'streak' && p.tail) {
      const [tx, ty] = p.tail, n = Math.max(1, Math.ceil(Math.hypot(x - tx, y - ty)));
      for (let k = 0; k <= n; k++) g.set(Math.floor(tx + ((x - tx) * k) / n), Math.floor(ty + ((y - ty) * k) / n), c);
      if (!p.head || r < 0.6) continue;
    }
    if (p.shape === 'plus') {
      const R = Math.max(1, Math.round(r)), cx = Math.floor(x), cy = Math.floor(y);
      for (let k = -R; k <= R; k++) { g.set(cx + k, cy, c); g.set(cx, cy + k, c); }
      continue;
    }
    for (let py = Math.floor(y - r - 1); py <= y + r + 1; py++) for (let px = Math.floor(x - r - 1); px <= x + r + 1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y;
      const inside = p.shape === 'diamond' ? Math.abs(dx) + Math.abs(dy) <= r : dx * dx + dy * dy <= r * r;
      if (!inside) continue;
      if (p.shape === 'ring' && dx * dx + dy * dy < (r - 1.2) * (r - 1.2)) continue;
      g.set(px, py, c);
    }
  }
  return g;
}

/** Render emitters into a frame (then the direction's outer line, unless `line: false`). */
export function particles(dir: DirContext, o: ParticleOptions): Grid {
  const g = drawParticles(new Grid(o.w, o.h), simulate(dir, o));
  return o.line ? o.line(g) : g;
}

export interface PresetOptions {
  w: number;
  h: number;
  /** Centre of the effect (default: frame centre; fire, smoke and dust: bottom centre). */
  origin?: P2;
  /** Overall scale, 1 = sized to fill about 80 % of the frame at its peak. */
  scale?: number;
  /** Direction the effect travels (muzzle flash, splash, sparks), degrees; default per preset. */
  angle?: number;
  /** Particle count multiplier. */
  density?: number;
  colors?: string[];
  /** Effect length in ms (stream periods). */
  duration: number;
  path?: P2[];
}

/** The 11 presets (SPEC §10): emitter layers sized to the frame. */
export const PRESETS: Record<string, (o: PresetOptions) => Emitter[]> = {
  explosion(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], d = o.density ?? 1, D = o.duration;
    return [
      // the flash: one hot core for the first frames
      { origin: c, count: 1, speed: 0, life: D * 0.2, size: [R * 0.55, R * 0.4], band: [0, 0.25], colors: o.colors },
      // fireballs flung out, cooling from the edge in
      { origin: c, count: Math.round(14 * d), area: R * 0.2, speed: [R * 3, R * 6], drag: 4.5, life: [D * 0.4, D * 0.85], size: [R * 0.36, R * 0.1], curve: 0.9, blob: true, colors: o.colors, seed: 1 },
      { origin: c, count: Math.round(8 * d), area: R * 0.1, speed: [R * 5, R * 9], drag: 2.5, gravity: R * 3, life: [D * 0.3, D * 0.6], shape: 'streak', streak: 0.04, band: [0, 0.45], colors: o.colors, seed: 2 },
      // smoke rising late
      { origin: c, count: Math.round(5 * d), area: R * 0.45, speed: [R * 0.3, R * 0.8], drag: 2, gravity: -R * 1.2, delay: [D * 0.3, D * 0.45], life: [D * 0.4, D * 0.55], size: [R * 0.12, R * 0.22], band: [0.75, 1], colors: o.colors, seed: 3 },
    ];
  },
  smoke(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.88], D = o.duration;
    return [{ origin: c, mode: 'stream', count: Math.round(9 * (o.density ?? 1)), area: [R * 0.2, R * 0.06], angle: 180, spread: 26, speed: [R * 2.6, R * 3.4], turbulence: R * 0.8, drag: 0.8, life: [D * 0.7, D * 0.95], size: [R * 0.14, R * 0.34], band: [0.6, 1], blob: true, heat: 2.2, colors: o.colors }];
  },
  fire(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.9], D = o.duration;
    return [
      // tongues: born wide at the base, rising fast and thinning to dark tips
      { origin: c, mode: 'stream', count: Math.round(26 * (o.density ?? 1)), area: [R * 0.5, R * 0.05], angle: 180, spread: 12, speed: [R * 2.6, R * 3.8], gravity: -R, turbulence: R * 0.9, drag: 0.3, life: [D * 0.45, D * 0.95], size: [R * 0.42, R * 0.16], blob: 0.4, heat: 3, colors: o.colors },
      // embers
      { origin: [c[0], c[1] - R * 0.5], mode: 'stream', count: Math.round(3 * (o.density ?? 1)), area: R * 0.3, angle: 180, spread: 40, speed: [R * 3.5, R * 5], turbulence: R * 1.5, life: [D * 0.4, D * 0.6], shape: 'pixel', band: [0, 0.5], colors: o.colors, seed: 4 },
    ];
  },
  sparks(o) {
    const R = Math.min(o.w, o.h) * 0.45 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
    return [{ origin: c, count: Math.round(12 * (o.density ?? 1)), area: 0.5, angle: o.angle ?? 180, spread: o.angle === undefined ? 360 : 110, speed: [R * 2.5, R * 5], drag: 2.2, gravity: R * 4, life: [D * 0.35, D * 0.9], shape: 'streak', streak: 0.045, band: [0, 0.6], curve: 1.6, colors: o.colors }];
  },
  magic(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
    return [
      { origin: c, mode: 'stream', count: Math.round(12 * (o.density ?? 1)), area: R * 0.9, angle: 90, spread: 360, speed: [R * 0.8, R * 1.2], swirl: 300, gravity: -R * 0.6, life: [D * 0.5, D * 0.9], shape: 'diamond', size: [R * 0.14, R * 0.04], colors: o.colors },
      { origin: c, mode: 'stream', count: Math.round(5 * (o.density ?? 1)), area: R * 0.3, speed: [0, R * 0.2], life: [D * 0.3, D * 0.6], size: [R * 0.2, R * 0.05], band: [0, 0.4], colors: o.colors, seed: 5 },
    ];
  },
  heal(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.8], D = o.duration;
    return [
      { origin: c, mode: 'stream', count: Math.round(7 * (o.density ?? 1)), area: [R * 0.8, R * 0.15], angle: 180, spread: 8, speed: [R * 1.2, R * 1.8], life: [D * 0.6, D * 0.9], shape: 'plus', size: [R * 0.14, R * 0.08], curve: 0.7, colors: o.colors },
      { origin: c, mode: 'stream', count: Math.round(8 * (o.density ?? 1)), area: [R * 0.9, R * 0.2], angle: 180, spread: 10, speed: [R * 1.5, R * 2.4], life: [D * 0.3, D * 0.6], shape: 'pixel', band: [0, 0.5], colors: o.colors, seed: 7 },
    ];
  },
  muzzle(o) {
    const R = Math.min(o.w, o.h) * 0.45 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], a = o.angle ?? 180, D = o.duration;
    return [
      { origin: c, count: 1, speed: 0, life: D * 0.34, size: [R * 0.42, R * 0.3], band: [0, 0.3], colors: o.colors },
      { origin: c, count: Math.round(7 * (o.density ?? 1)), angle: a, spread: 50, speed: [R * 5, R * 9], drag: 6, life: [D * 0.25, D * 0.5], size: [R * 0.24, R * 0.06], curve: 0.8, colors: o.colors, seed: 9 },
      { origin: c, count: Math.round(5 * (o.density ?? 1)), angle: a, spread: 110, speed: [R * 6, R * 10], drag: 5, life: [D * 0.2, D * 0.4], shape: 'streak', streak: 0.03, band: [0, 0.5], colors: o.colors, seed: 10 },
    ];
  },
  impact(o) {
    const R = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h / 2], D = o.duration;
    return [
      { origin: c, count: 1, speed: 0, life: D * 0.75, shape: 'ring', size: [R * 0.3, R * 1.05], curve: 0.9, colors: o.colors },
      { origin: c, count: 1, speed: 0, life: D * 0.3, size: [R * 0.38, R * 0.12], band: [0, 0.3], colors: o.colors, seed: 11 },
      { origin: c, count: Math.round(8 * (o.density ?? 1)), speed: [R * 3, R * 5], drag: 4, life: [D * 0.3, D * 0.6], shape: 'streak', streak: 0.04, band: [0, 0.6], colors: o.colors, seed: 12 },
    ];
  },
  splash(o) {
    const R = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.8], D = o.duration;
    return [
      { origin: c, count: Math.round(12 * (o.density ?? 1)), area: [R * 0.3, 0.5], angle: o.angle ?? 180, spread: 100, speed: [R * 2.5, R * 4.2], gravity: R * 9, life: [D * 0.6, D * 0.95], size: [R * 0.16, R * 0.07], curve: 1.3, colors: o.colors },
      { origin: c, count: 1, speed: 0, life: D * 0.6, shape: 'ring', size: [R * 0.3, R * 0.9], colors: o.colors, seed: 13 },
    ];
  },
  dust(o) {
    const R = Math.min(o.w, o.h) * 0.42 * (o.scale ?? 1), c = o.origin ?? [o.w / 2, o.h * 0.85], D = o.duration;
    return [
      { origin: c, count: Math.round(8 * (o.density ?? 1)), area: [R * 0.4, R * 0.08], angle: 90, spread: 360, speed: [R * 1.2, R * 2], drag: 3, gravity: -R * 0.4, life: [D * 0.6, D], size: [R * 0.14, R * 0.3], band: [0.5, 1], colors: o.colors },
    ];
  },
  trail(o) {
    const R = Math.min(o.w, o.h) * 0.4 * (o.scale ?? 1), D = o.duration, path = o.path ?? [[o.w * 0.1, o.h / 2], [o.w * 0.9, o.h / 2]];
    return [{ path, mode: 'stream', count: Math.round(14 * (o.density ?? 1)), speed: [0, R * 0.25], life: [D * 0.5, D], size: [R * 0.16, 0.2], curve: 0.9, colors: o.colors }];
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/** A preset's layers, with emitter fields overridden (`count`, `life`, …) on every layer. */
export function preset(name: string, o: PresetOptions, override: Partial<Emitter> = {}): Emitter[] {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown particle preset ${JSON.stringify(name)} (have: ${PRESET_NAMES.join(', ')})`);
  return p(o).map(l => ({ ...l, ...override }));
}

/**
 * Palette cycling (SPEC §6.4 `cycle`): every pixel whose colour is in the cycle moves `shift` places along it,
 * wrapping. `colors` is a colour run (ramp names or tokens, as `colorRun`); one turn per loop is
 * `shift = round(t × length)`. Water, lava and lights animate without redrawing.
 */
export function paletteCycle(dir: DirContext, g: Grid, colors: string[], shift: number): Grid {
  const run = colorRun(dir, colors), n = run.length, at = new Map(run.map((c, i) => [c, i]));
  const out = g.clone(), s = ((Math.round(shift) % n) + n) % n;
  if (!s) return out;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) !== 255) continue;
    const i = at.get(g.get(x, y)!);
    if (i !== undefined) out.set(x, y, run[(i + s) % n]);
  }
  if (g.normal) out.normal = g.normal;
  return out;
}

export interface FlameOptions {
  w: number;
  h: number;
  /** Position in the loop, 0–1. */
  t: number;
  /** Bottom centre of the flame, px (default: centre, 2 px above the frame bottom). */
  base?: P2;
  /** Half-width at the base and height, px. */
  width?: number;
  height?: number;
  /** Noise lattice cells across the frame (more = more, smaller tongues). */
  cells?: number;
  /** How hard the noise bites into the shape (0.6–1.2). */
  lick?: number;
  /** Sideways sway of the upper flame, px. */
  sway?: number;
  colors?: string[];
  seed?: number;
}

/**
 * Flame body (P6c): a teardrop field disturbed by periodic value noise that scrolls up exactly one noise period per
 * loop — tongues lick upward and the loop is seamless by construction (t = 1 is t = 0). The field is banded to the
 * colour run: hottest innermost and low, coolest on the rim and the tips. Pair it with ember particles.
 */
export function flame(dir: DirContext, o: FlameOptions): Grid {
  const { w, h } = o, g = new Grid(w, h), run = colorRun(dir, o.colors), n = run.length, [bx, by] = o.base ?? [w / 2, h - 2];
  const W = o.width ?? w * 0.32, H = o.height ?? h * 0.8, cells = o.cells ?? 3, lick = o.lick ?? 0.9, sway = o.sway ?? W * 0.25, seed = o.seed ?? 1;
  const tau = o.t * Math.PI * 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (by - (y + 0.5)) / H; // 0 at the base, 1 at the top
    if (v < -0.25 || v > 1.2) continue;
    // rounded bottom, then a taper to a point
    const hw = v < 0 ? W * Math.sqrt(Math.max(0, 1 - (v / 0.25) ** 2)) : W * Math.pow(Math.max(0, 1 - v), 0.75);
    const cx = bx + Math.sin(v * 3.2 - tau) * sway * Math.max(0, v);
    const d = hw > 0 ? Math.abs(x + 0.5 - cx) / hw : 9;
    const nz = pValue(x, y + o.t * h, { w, h, cells, cellsY: cells, octaves: 2, seed }) - 0.5;
    // the silhouette takes the full noise (tongues); the inner bands a calmer share of it, so they nest
    const S = 1 - d - Math.max(0, v) * 0.45 + nz * lick * (0.35 + Math.max(0, v));
    if (S <= 0) continue;
    const B = 1 - d * 1.15 - Math.max(0, v) * 0.75 + nz * lick * 0.25;
    const idx = S < 0.14 ? n - 1 : Math.max(0, Math.min(n - 1, n - 1 - Math.floor(Math.max(0, B) * n * 1.05)));
    g.set(x, y, run[idx]);
  }
  return g;
}
