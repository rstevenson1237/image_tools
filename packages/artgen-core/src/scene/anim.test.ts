// P6c: t-driven tracks, the pose rig with 2-bone IK, spring chains, sub-frame timing, particles (deterministic, seamless
// streams, palette-exact), palette cycling, animation QA (frames, attack, solid fill), onion skin, GIF / APNG.
import { describe, expect, test } from 'vitest';
import { dirContext, parseDirection, type Direction } from 'artgen-scene/direction.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { animChecks, fillQA, frameQA, onionSkin } from '../qa/anim.ts';
import { conformance } from '../qa/conformance.ts';
import { renderAsset, type AssetModule } from '../render.ts';
import { particles, preset } from 'artgen-scene/fx/particles.ts';
import { cellTiming } from 'artgen-scene/anim/anim.ts';

const RAMPS = { skin: ['#e0c0a0', '#a07858', '#604030'], cloth: ['#80a0d0', '#4060a0', '#203060'], accent: ['#ffc060', '#e07020', '#802010'], glow: ['#fff0a0', '#ffc040'] };
const dir: Direction = parseDirection({
  id: 'fx', version: 1, status: 'locked', camera: { view: 'side' }, scale: { character: [32, 32], effect: [32, 32] },
  palette: { ramps: RAMPS, outline: '#101014', perKind: { effect: ['glow', 'accent'] } }, effects: { fps: 12, maxFrames: 8, palette: ['glow', 'accent'] },
});
const dc = dirContext(dir);

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
