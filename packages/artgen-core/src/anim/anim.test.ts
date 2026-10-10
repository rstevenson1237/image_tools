// P6c: t-driven tracks, the pose rig with 2-bone IK, spring chains, sub-frame timing, particles (deterministic, seamless
// streams, palette-exact), palette cycling, animation QA (frames, attack, solid fill), onion skin, GIF / APNG.
import { describe, expect, test } from 'vitest';
import { dirContext, kindPalette, parseDirection, type Direction } from '../direction.ts';
import { encodeGIF } from '../lib/gif.ts';
import { Grid } from '../lib/grid.ts';
import { encodeAPNG } from '../lib/png.ts';
import { animChecks, fillQA, frameQA, onionSkin } from '../qa/anim.ts';
import { conformance } from '../qa/conformance.ts';
import { renderAsset, type AssetModule } from '../render.ts';
import { paletteCycle, particles, preset, PRESET_NAMES, simulate } from '../fx/particles.ts';
import { blend, cellTiming, rig, solveTwoBone, spring, sweep, track } from './anim.ts';

const RAMPS = { skin: ['#e0c0a0', '#a07858', '#604030'], cloth: ['#80a0d0', '#4060a0', '#203060'], accent: ['#ffc060', '#e07020', '#802010'], glow: ['#fff0a0', '#ffc040'] };
const dir: Direction = parseDirection({
  id: 'fx', version: 1, status: 'locked', camera: { view: 'side' }, scale: { character: [32, 32], effect: [32, 32] },
  palette: { ramps: RAMPS, outline: '#101014', perKind: { effect: ['glow', 'accent'] } }, effects: { fps: 12, maxFrames: 8, palette: ['glow', 'accent'] },
});
const dc = dirContext(dir);
const close = (a: number[], b: number[], d = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < d);

describe('tracks', () => {
  test('keys interpolate, loop back to the first key, and blend poses field by field', () => {
    expect(track([[0, 0], [0.5, 10]], 0.25)).toBe(5);
    expect(track([[0, 0], [0.5, 10]], 0.75)).toBe(5); // looping: 10 → 0 over the second half
    expect(track([[0, 0], [0.5, 10]], 0.75, { loop: false })).toBe(10);
    expect(track([[0, [0, 0]], [1, [4, 8]]], 0.5, { loop: false })).toEqual([2, 4]);
    expect(blend({ 0: { arm: 0, leg: 10 }, 0.5: { arm: 90, leg: 10 } }, 0.25)).toEqual({ arm: 45, leg: 10 });
  });
});

describe('pose rig', () => {
  const r = rig({ root: [16, 16], bones: { spine: { len: 8, angle: 180 }, upper: { parent: 'spine', len: 5, angle: 90 }, fore: { parent: 'upper', len: 5 } } });
  test('forward kinematics: angles relative to the parent, 0 = down, 180 = up', () => {
    const p = r.pose();
    expect(close(p.end('spine'), [16, 8])).toBe(true);
    expect(close(p.end('upper'), [11, 8])).toBe(true); // 180 + 90 points along −x
    expect(close(p.end('fore'), [6, 8])).toBe(true);
  });
  test('2-bone IK puts the hand on the target, the elbow bends to the chosen side, out of reach stretches toward it', () => {
    for (const bend of [1, -1] as const) {
      const p = r.pose({}, { ik: { fore: { target: [22, 12], bend } } });
      expect(Math.hypot(p.end('fore')[0] - 22, p.end('fore')[1] - 12)).toBeLessThan(1e-6);
      expect(Math.hypot(...([0, 1].map(i => p.end('upper')[i] - p.start('upper')[i]) as [number, number]))).toBeCloseTo(5, 6);
    }
    const up = r.pose({}, { ik: { fore: { target: [22, 12], bend: 1 } } }).end('upper'), down = r.pose({}, { ik: { fore: { target: [22, 12], bend: -1 } } }).end('upper');
    expect(up[1]).not.toBeCloseTo(down[1], 1);
    const far = r.pose({}, { ik: { fore: { target: [60, 8] } } }).end('fore');
    expect(far[0]).toBeCloseTo(26, 3);
    const [a1, a2] = solveTwoBone([0, 0], 3, 4, [0, 5]);
    expect(Math.abs(a1 - a2)).toBeGreaterThan(10);
  });
});

describe('spring chains', () => {
  const chain = spring({ n: 4, len: 3, stiffness: 0.15, damping: 0.06, gravity: 300, seed: 3 });
  // walking right at 40 px/s until t = 0, then standing still
  const walkThenStop = (ms: number) => ({ pos: [Math.min(0, ms) * 0.04, Math.sin(Math.min(0, ms) / 80)] as [number, number], angle: 0 });
  test('deterministic: the same frame twice gives the same points', () => {
    expect(chain.at(120, walkThenStop)).toEqual(chain.at(120, walkThenStop));
  });
  test('secondary motion: the chain keeps swinging after its root stops, then settles back to rest', () => {
    const tip = (ms: number) => chain.at(ms, walkThenStop)[4];
    const early = [0, 60, 120, 180, 240].map(ms => tip(ms)[0]);
    expect(Math.max(...early) - Math.min(...early)).toBeGreaterThan(0.5);
    const late = [3000, 3060, 3120].map(ms => tip(ms));
    expect(Math.max(...late.map(p => Math.abs(p[0])))).toBeLessThan(0.3);
    expect(late[0][1]).toBeCloseTo(12, 0);
  });
  test('sweep samples a path backwards in time (trails)', () => {
    expect(sweep(t => [t * 10, 0], 1, 0.5, 3)).toEqual([[5, 0], [7.5, 0], [10, 0]]);
  });
});

describe('sub-frames and timing', () => {
  test('cellTiming: logical frames keep their durations, sub-frames split them', () => {
    expect(cellTiming(3, 2, 2, [100, 300])).toEqual({ logical: 1, sub: 1, ms: 250, duration: 400 });
  });
  test('a render with sub-frames has frames × sub cells; ctx carries logical, sub and ms', () => {
    const seen: string[] = [];
    const mod: AssetModule = { render(ctx) { seen.push(`${ctx.frame}:${ctx.logical}.${ctx.sub}@${ctx.ms}`); return new Grid(32, 32); } };
    const r = renderAsset(mod, { dir, brief: { id: 'a', kind: 'character', states: ['attack'], anims: { attack: { frames: 2, durations: [100, 300], sub: 2 } } } });
    expect(r.frames.attack).toBe(4);
    expect(seen).toEqual(['0:0.0@0', '1:0.1@50', '2:1.0@100', '3:1.1@250']);
    expect(r.cells.map(c => [c.logical, c.sub])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });
});

describe('particles', () => {
  const pal = new Set(kindPalette(dir, 'effect'));
  test('every preset renders palette-exact, deterministic frames that change over t', () => {
    for (const name of PRESET_NAMES) {
      const layers = preset(name, { w: 32, h: 32, duration: 666 }), at = (t: number) => particles(dc, { w: 32, h: 32, t, duration: 666, layers, seed: 4 });
      const a = at(0.25);
      expect(a.hash(), name).toBe(at(0.25).hash());
      expect(a.hash(), name).not.toBe(at(0.5).hash());
      let n = 0;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (a.alpha(x, y)) { n++; expect(pal.has(a.get(x, y)!), `${name} ${x},${y}`).toBe(true); }
      expect(n, name).toBeGreaterThan(0);
    }
  });
  test('streams loop seamlessly: t = 1 is t = 0', () => {
    const layers = preset('fire', { w: 24, h: 32, duration: 666 });
    const at = (t: number) => simulate(dc, { w: 24, h: 32, t, duration: 666, layers }).map(p => [p.x, p.y].map(v => Math.round(v * 1e6) / 1e6).join()).sort();
    expect(at(1)).toEqual(at(0));
  });
  test('bursts: nothing before the delay, nothing after the last life ends', () => {
    expect(simulate(dc, { w: 32, h: 32, t: 0.5, duration: 1000, layers: [{ count: 5, delay: [600, 700], life: 100 }] })).toHaveLength(0);
    expect(simulate(dc, { w: 32, h: 32, t: 0.99, duration: 1000, layers: [{ count: 5, life: 200 }] })).toHaveLength(0);
  });
  test('palette cycling moves colours along the run and wraps', () => {
    const g = new Grid(2, 1);
    g.set(0, 0, RAMPS.glow[0]); g.set(1, 0, RAMPS.accent[2]);
    const c = paletteCycle(dc, g, ['glow', 'accent'], 1);
    expect([c.get(0, 0), c.get(1, 0)]).toEqual([RAMPS.glow[1], RAMPS.glow[0]]);
    expect(paletteCycle(dc, g, ['glow', 'accent'], 5).hash()).toBe(g.hash());
  });
});

describe('animation QA', () => {
  const box = (x: number, y: number, c = RAMPS.skin[1]) => { const g = new Grid(32, 32); g.fill(x, y, 8, 12, c); return g; };
  test('frame QA: feet jumps, colour drift and loop seams', () => {
    const q = frameQA({ name: 'walk', loop: true, logical: 4, frames: [box(10, 10), box(10, 11), box(11, 10), box(10, 14, RAMPS.cloth[1])] });
    expect(q.feetJump).toBe(4);
    expect(q.drift).toBe(1);
    expect(q.seam).toBeGreaterThan(0);
  });
  test('attack QA: ≥ 4 frames and one held contact frame', () => {
    const fr = [box(10, 10), box(11, 10), box(12, 10), box(11, 10)];
    const check = (durations?: number[], frames = fr) => animChecks({ states: [{ name: 'attack', loop: false, logical: frames.length, durations, frames }] }, dir, 'character').find(c => c.id === 'attack')!;
    expect(check([80, 80, 200, 80]).status).toBe('pass');
    expect(check([80, 80, 200, 80]).detail).toContain('contact frame 2 held 200 ms');
    expect(check(undefined).status).toBe('flag');
    expect(check([80, 200, 200, 80]).status).toBe('flag');
    expect(check([80, 80, 200], fr.slice(0, 3)).detail).toContain('3 frames');
  });
  test('solid fill: a disc of the lightest colour flags, scattered particles pass', () => {
    const disc = new Grid(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x - 16) ** 2 + (y - 16) ** 2 < 100) disc.set(x, y, RAMPS.glow[0]);
    expect(fillQA([disc], dir).interior[0]).toBeGreaterThan(0.8);
    const fill = (frames: Grid[]) => animChecks({ states: [{ name: 'idle', loop: false, logical: frames.length, frames }] }, dir, 'effect').find(c => c.id === 'fill')!.status;
    expect(fill([disc, disc, disc])).toBe('flag');
    const layers = preset('sparks', { w: 32, h: 32, duration: 666 });
    expect(fill([0, 0.25, 0.5].map(t => particles(dc, { w: 32, h: 32, t, duration: 666, layers })))).toBe('pass');
    const rep = conformance({ frames: [disc], dir, kind: 'effect', anim: { states: [{ name: 'idle', loop: false, logical: 1, frames: [disc] }] } });
    expect(rep.checks.map(c => c.id)).toEqual(expect.arrayContaining(['frames', 'attack', 'fill']));
  });
  test('onion skin: one panel per frame, the previous frame ghosted under the current one', () => {
    const o = onionSkin([box(2, 2), box(14, 2)]);
    expect(o.w).toBe(65);
    expect(o.alpha(33 + 3, 3)).toBeGreaterThan(0); // frame 0 ghosted in panel 1
    expect(o.alpha(33 + 3, 3)).toBeLessThan(255);
  });
});

describe('GIF and APNG previews', () => {
  const frames = [0, 1, 2].map(i => { const g = new Grid(5, 4); g.fill(i, 1, 2, 2, RAMPS.accent[i]); return g; });
  test('GIF: header, loop extension, one image per frame, and the LZW stream decodes back to the pixels', () => {
    const b = encodeGIF(frames, [100, 200, 100]);
    expect(String.fromCharCode(...b.slice(0, 6))).toBe('GIF89a');
    const decoded = decodeGif(b);
    expect(decoded.delays).toEqual([10, 20, 10]);
    decoded.frames.forEach((idx, k) => {
      for (let i = 0; i < 20; i++) {
        const want = frames[k].d[i * 4 + 3] ? frames[k].get(i % 5, (i / 5) | 0) : null;
        expect(idx[i] === 0 ? null : decoded.palette[idx[i]]).toBe(want);
      }
    });
  });
  test('APNG: acTL with the frame count, an fcTL per frame', () => {
    const b = encodeAPNG(frames, [100, 200, 100]), s = String.fromCharCode(...b);
    expect(s.includes('acTL')).toBe(true);
    expect(s.split('fcTL').length - 1).toBe(3);
    expect(s.split('fdAT').length - 1).toBe(2);
  });
});

/** Minimal GIF decoder for the round trip (global palette, full frames). */
function decodeGif(b: Uint8Array): { palette: string[]; frames: Uint8Array[]; delays: number[] } {
  const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8), size = 2 << (b[10] & 7), palette: string[] = [];
  let o = 13;
  for (let i = 0; i < size; i++, o += 3) palette.push('#' + [b[o], b[o + 1], b[o + 2]].map(v => v.toString(16).padStart(2, '0')).join(''));
  const frames: Uint8Array[] = [], delays: number[] = [];
  while (b[o] !== 0x3b) {
    if (b[o] === 0x21) {
      if (b[o + 1] === 0xf9) delays.push(b[o + 4] | (b[o + 5] << 8));
      o += 2;
      while (b[o]) o += b[o] + 1;
      o++;
      continue;
    }
    o += 10;
    const min = b[o++], data: number[] = [];
    while (b[o]) { data.push(...b.slice(o + 1, o + 1 + b[o])); o += b[o] + 1; }
    o++;
    const clear = Math.pow(2, min);
    const out: number[] = [];
    let size = min + 1, dict: number[][] = [], prev: number[] | null = null, acc = 0, bits = 0, p = 0;
    const reset = () => { dict = Array.from({ length: clear + 2 }, (_, i) => [i]); size = min + 1; prev = null; };
    reset();
    for (;;) {
      while (bits < size) { acc |= data[p++] << bits; bits += 8; }
      const code = acc & ((1 << size) - 1);
      acc >>>= size; bits -= size;
      if (code === clear) { reset(); continue; }
      if (code === clear + 1) break;
      const entry: number[] = code < dict.length ? dict[code] : [...prev!, prev![0]];
      out.push(...entry);
      if (prev) dict.push([...prev, entry[0]]);
      prev = entry;
      if (dict.length === 1 << size && size < 12) size++;
    }
    frames.push(Uint8Array.from(out.slice(0, w * h)));
  }
  return { palette, frames, delays };
}
