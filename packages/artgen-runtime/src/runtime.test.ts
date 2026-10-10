/// <reference types="node" />
// Runtime core: facing math, frame selection and the state machine, autotile masks, effects, coordinates, palette
// swaps, manifest checks — on a synthetic pack, then on the three fixture packs exported in P3.
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { decodePNG, type PackManifest as CorePackManifest } from 'artgen-core';
import {
  BLOB47, E, N, NE, NW, S, SE, SW, W as WEST, blob47, chooseFacing, createPack, depthKey, facingAngle, frameAt, isoToScreen, loadPack,
  neighbourMask, obliqueToScreen, reduceCorners, screenToIso, screenToOblique, wang16, type PackManifest, type RuntimeAdapter,
} from './index.js';
import { cellAt, synthPack } from './testkit.js';

/** Minimal adapter recording what the core asks for. */
interface Rec { frame?: { x: number; y: number; w: number; h: number; tex: unknown }; flipX?: boolean; anchor?: readonly number[]; pos?: number[]; parent?: Rec[]; disposed?: boolean; sets: number }
const recAdapter = (): RuntimeAdapter<{ atlas: number; swap?: string }, Rec, Rec[]> => ({
  id: 'record',
  loadTexture: a => ({ atlas: a.index, swap: a.swap }),
  createNode: () => ({ sets: 0 }),
  setFrame(n, f, flipX) { n.frame = { x: f.x, y: f.y, w: f.w, h: f.h, tex: f.tex }; n.flipX = flipX; n.sets++; },
  setAnchor(n, a) { n.anchor = a; },
  setPosition(n, x, y, z) { n.pos = [x, y, z ?? 0]; },
  attach(parent, n) { parent.push(n); n.parent = parent; },
  dispose(n) { n.disposed = true; n.parent?.splice(n.parent.indexOf(n), 1); },
});
const synth = () => { const { manifest, images } = synthPack(); return createPack(manifest, images, recAdapter()); };
const cellOf = (n: Rec) => cellAt(n.frame!.x, n.frame!.y);

describe('facing (screen angles: e = 0, s = π/2)', () => {
  test('compass names map to angles', () => {
    expect(facingAngle('e')).toBe(0);
    expect(facingAngle('s')).toBeCloseTo(Math.PI / 2);
    expect(facingAngle('n')).toBeCloseTo((3 * Math.PI) / 2);
    expect(facingAngle('sse')).toBeCloseTo((3 * Math.PI) / 8);
    expect(() => facingAngle('up')).toThrow(/unknown facing/);
  });

  const eight = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
  test('8 facings: nearest one, no flips', () => {
    for (const [ang, want] of [[0, 'e'], [Math.PI / 2, 's'], [Math.PI, 'w'], [-Math.PI / 2, 'n'], [Math.PI / 4 + 0.3, 'se'], [-3 * Math.PI / 4 + 0.2, 'nw'], [2 * Math.PI + 0.1, 'e']] as const)
      expect(chooseFacing(eight, ang), `${ang}`).toEqual({ index: eight.indexOf(want), flipX: false });
  });

  test('mirror-aware: east-side facings show west by flipping; an exported facing beats its mirror', () => {
    const east = ['s', 'se', 'e', 'ne', 'n'];
    expect(chooseFacing(east, Math.PI)).toEqual({ index: east.indexOf('e'), flipX: true });
    expect(chooseFacing(east, (3 * Math.PI) / 4)).toEqual({ index: east.indexOf('se'), flipX: true }); // sw
    expect(chooseFacing(east, -(3 * Math.PI) / 4)).toEqual({ index: east.indexOf('ne'), flipX: true }); // nw
    expect(chooseFacing(east, Math.PI / 2)).toEqual({ index: 0, flipX: false });
    expect(chooseFacing(['s'], 0)).toEqual({ index: 0, flipX: false }); // a single facing never flips
    expect(chooseFacing(['e'], Math.PI)).toEqual({ index: 0, flipX: true }); // a side-on sprite turns around
  });
});

describe('sprite state machine', () => {
  test('frame selection: state × facing × frame, timing by fps, looping', async () => {
    const pack = await synth(), s = pack.sprite('walker');
    expect(s.state).toBe('idle');
    const idle = cellOf(s.node);
    s.play('walk');
    const walk0 = cellOf(s.node);
    expect(walk0).not.toBe(idle);
    s.update(99); expect(s.frame).toBe(0);
    s.update(1); expect(s.frame).toBe(1); // 10 fps → 100 ms per frame
    expect(cellOf(s.node)).toBe(walk0 + 1);
    s.update(300); expect(s.frame).toBe(0); // 400 ms = 4 frames → wraps
    expect(s.done).toBe(false);
    s.play('walk'); expect(s.frame).toBe(0); // same state keeps time unless restarted
    s.update(150); s.play('walk'); expect(s.frame).toBe(1);
    s.play('walk', true); expect(s.frame).toBe(0);
  });

  test('facing changes the strip; mirrored facings flip the node; nodes are only touched on change', async () => {
    const pack = await synth(), s = pack.sprite('walker', { state: 'walk' }), w0 = cellOf(s.node);
    s.setFacing('e');
    expect(cellOf(s.node)).toBe(w0 + 2 * 4); // facing 2 of the walk strips (4 frames each)
    expect(s.node.flipX).toBe(false);
    s.faceToward(-1, 0); // west → mirrored east
    expect([s.facingName, s.node.flipX]).toEqual(['e', true]);
    const sets = s.node.sets;
    s.face(Math.PI); s.update(10);
    expect(s.node.sets).toBe(sets);
    s.faceToward(0, 0);
    expect(s.facingName).toBe('e');
    expect(() => s.play('run' as 'walk')).toThrow(/no state "run"/);
  });

  test('anchor, position and typed refs', async () => {
    const pack = await synth(), s = pack.sprite({ id: 'walker', states: ['idle', 'walk'], variants: ['base'] } as const).at(5, 6, 2);
    expect(s.node.anchor).toEqual([3, 7]);
    expect(s.node.pos).toEqual([5, 6, 2]);
    expect(() => pack.sprite('nope')).toThrow(/has no asset "nope"/);
  });

  test('non-looping states finish and hold their last frame', async () => {
    const pack = await synth(), s = pack.sprite('boom');
    expect(s.update(150)).toBe(true);
    expect(s.update(200)).toBe(false);
    expect([s.done, s.frame]).toEqual([true, 2]);
    s.loop = true; s.play('idle', true); s.update(350);
    expect([s.done, s.frame]).toEqual([false, 0]);
  });
});

describe('held frames and anchors', () => {
  test('per-frame durations: a held contact frame, then done', () => {
    const st = { frames: 4, fps: 10, loop: false, durations: [50, 50, 200, 50] };
    expect([0, 49, 50, 100, 299, 300, 349].map(ms => frameAt(st, ms).frame)).toEqual([0, 0, 1, 2, 2, 3, 3]);
    expect(frameAt(st, 350)).toEqual({ frame: 3, sub: 0, done: true });
    expect(frameAt(st, 360, true)).toEqual({ frame: 0, sub: 0, done: false }); // looping wraps on the summed length
    expect(frameAt({ frames: 4, fps: 10, loop: true }, 250)).toEqual({ frame: 2, sub: 0, done: false }); // no durations: fps
  });

  test('sub-frames (P6c): the logical frame follows the contract, sub-frames split its time', () => {
    const st = { frames: 3, fps: 10, loop: true, durations: [100, 300, 100], sub: 2 };
    expect([0, 49, 50, 100, 249, 250, 399, 400, 450].map(ms => { const r = frameAt(st, ms); return [r.frame, r.sub]; }))
      .toEqual([[0, 0], [0, 0], [0, 1], [1, 0], [1, 0], [1, 1], [1, 1], [2, 0], [2, 1]]);
    expect(frameAt({ ...st, loop: false }, 500)).toEqual({ frame: 2, sub: 1, done: true });
  });

  test('a sprite plays the durations and reports anchors relative to its position, mirrored when flipped', async () => {
    const pack = await synth(), s = pack.sprite('swing').at(100, 50);
    expect(s.anchor('hand')).toEqual({ x: 1.5, y: -4.5 }); // pixel (4, 2) centre − anchor (3, 7)
    s.update(120);
    expect([s.frame, s.anchor('hand')]).toEqual([2, { x: 3.5, y: -4.5 }]);
    s.update(150); expect(s.frame).toBe(2); // still holding the contact frame at 270 ms
    s.update(50); expect([s.frame, s.anchor('hand')]).toEqual([3, undefined]); // the south frame 3 has no hand
    expect(s.update(100)).toBe(false);
    s.faceToward(-1, 0); // west = mirrored east: the hand swaps sides
    expect([s.facingName, s.node.flipX, s.anchor('hand')]).toEqual(['e', true, { x: -4.5, y: -4.5 }]);
    expect(pack.anchor('swing', 'hand', { state: 'attack', facing: 1, frame: 1 })).toEqual([5, 2]);
    expect(() => pack.anchor('walker', 'hand')).toThrow(/no anchor "hand" \(has: none\)/);
  });
});

describe('variants and palette swaps', () => {
  test('param variants pick their own frames; swaps reuse variant 0 frames on a recoloured atlas', async () => {
    const pack = await synth();
    expect(pack.paramVariants('gob')).toBe(2);
    const base = pack.sprite('gob'), v1 = pack.sprite('gob', { variant: 'v1' }), red = pack.sprite('gob', { variant: 'red' });
    expect(cellOf(v1.node)).toBe(cellOf(base.node) + 1);
    expect([red.node.frame!.x, red.node.frame!.y]).toEqual([base.node.frame!.x, base.node.frame!.y]);
    expect(red.node.frame!.tex).toEqual({ atlas: 0, swap: 'red' });
    const px = (v: string) => Array.from(pack.pixels('gob', { variant: v }).data.subarray(4, 8));
    expect(px('base')).toEqual([0, 0x40, 0x80, 255]);
    expect(px('red')).toEqual([255, 0, 0, 255]);
    expect(() => pack.sprite('gob', { variant: 'blue' })).toThrow(/unknown variant/);
  });
});

describe('autotile', () => {
  test('neighbour masks are clockwise from north', () => {
    const map = ['.#.', '###', '...'], same = (x: number, y: number) => map[y]?.[x] === '#';
    expect(neighbourMask(1, 1, same)).toBe(N | E | WEST);
    expect(neighbourMask(0, 1, same)).toBe(NE | E);
  });

  test('wang16: edges only', () => {
    expect(wang16(0)).toBe(0);
    expect(wang16(N | E | S | WEST)).toBe(15);
    expect(wang16(E | NE | SE)).toBe(2);
  });

  test('blob47: 47 tiles, corners only behind both edges', () => {
    expect(BLOB47).toHaveLength(47);
    expect(BLOB47[0]).toBe(0);
    expect(blob47(255)).toBe(46);
    expect(reduceCorners(NE | SE | SW | NW)).toBe(0);
    expect(blob47(NE)).toBe(blob47(0));
    expect(blob47(N | E | NE)).not.toBe(blob47(N | E));
    for (let m = 0; m < 256; m++) expect(BLOB47[blob47(m)]).toBe(reduceCorners(m));
  });

  test('tileset resolves masks to frames and picks variants deterministically', async () => {
    const pack = await synth(), t = pack.tiles('wall');
    expect(t.resolve(N | S)).toBe(5);
    const f5 = t.frame(5), f0 = t.frame(0);
    expect(cellAt(f5.x, f5.y) - cellAt(f0.x, f0.y)).toBe(5);
    expect(t.pick(3, 4)).toBe(t.pick(3, 4));
    const parent: Rec[] = [], n = t.node(10, 20, { index: 5, parent });
    expect([parent.length, n.pos, n.anchor]).toEqual([1, [10, 20, 0], [4, 4]]);
  });
});

describe('effects', () => {
  test('spawn → attached and positioned; finished one-shots are disposed', async () => {
    const pack = await synth(), parent: Rec[] = [], fx = pack.effect('boom', { parent });
    const a = fx.spawn(1, 2);
    fx.update(100); fx.spawn(3, 4);
    expect([parent.length, a.node.pos]).toEqual([2, [1, 2, 0]]);
    fx.update(250);
    expect([fx.active.length, parent.length, a.node.disposed]).toEqual([1, 1, true]);
    fx.update(1000);
    expect(fx.active.length).toBe(0);
  });

  test('loop override keeps a one-shot effect alive until cleared', async () => {
    const pack = await synth(), parent: Rec[] = [], fx = pack.effect('boom', { parent, loop: true });
    fx.spawn(0, 0); fx.update(10_000);
    expect(fx.active.length).toBe(1);
    fx.clear();
    expect(parent.length).toBe(0);
  });
});

describe('coordinates', () => {
  test('iso round-trips and orders by depth', () => {
    expect(isoToScreen(1, 0)).toEqual([16, 8]);
    expect(isoToScreen(0, 1)).toEqual([-16, 8]);
    expect(isoToScreen(1, 1, 10)).toEqual([0, 6]);
    for (const [x, y] of [[0, 0], [3, 5], [-2, 7.5]]) {
      const [sx, sy] = isoToScreen(x, y, 0, { w: 64, h: 32 });
      const [ix, iy] = screenToIso(sx, sy, { w: 64, h: 32 });
      expect(ix).toBeCloseTo(x); expect(iy).toBeCloseTo(y);
    }
    expect(depthKey(1, 1)).toBeGreaterThan(depthKey(0, 1));
    expect(depthKey(1, 1, 5)).toBeGreaterThan(depthKey(1, 1));
    expect(depthKey(2, 1)).toBeGreaterThan(depthKey(1, 1, 500));
  });

  test('oblique round-trips', () => {
    const [sx, sy] = obliqueToScreen(2, 3);
    expect(screenToOblique(sx, sy)).toEqual([2, 3]);
    expect(obliqueToScreen(0, 0, 4)).toEqual([0, -4]);
  });
});

describe('manifest checks and loading', () => {
  test('rejects other formats and other runtime majors', async () => {
    const { manifest, images } = synthPack();
    await expect(createPack({ ...manifest, format: 2 } as unknown as PackManifest, images, recAdapter())).rejects.toThrow(/format 1/);
    await expect(createPack({ ...manifest, runtime: '2.0.0' }, images, recAdapter())).rejects.toThrow(/re-run `artgen export --runtime`/);
    await expect(createPack({ ...manifest, runtime: null }, images, recAdapter())).resolves.toBeTruthy();
  });

  test('the runtime manifest type accepts what artgen-core writes', () => {
    const fromCore = (m: CorePackManifest): PackManifest => m;
    expect(typeof fromCore).toBe('function');
  });

  test('loadPack warns about draft assets (unless told not to); a pack without drafts loads quietly', async () => {
    const { manifest, images } = synthPack(), [img] = images;
    const load = (m: PackManifest, opts: Parameters<typeof loadPack>[2] = {}) =>
      loadPack('/p/pack.json', recAdapter(), { fetchJson: async () => m, decode: async () => img, ...opts });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await load(manifest);
      expect(warn).not.toHaveBeenCalled();
      const drafty: PackManifest = { ...manifest, drafts: ['walker'], assets: { ...manifest.assets, walker: { ...manifest.assets.walker, draft: true } } };
      await load(drafty);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/1 unapproved draft asset \(walker\)/);
      const seen: string[][] = [];
      await load(drafty, { onDrafts: ids => seen.push(ids) });
      await load(drafty, { onDrafts: false });
      expect([seen, warn.mock.calls.length]).toEqual([[['walker']], 1]);
    } finally { warn.mockRestore(); }
  });

  const root = new URL('../../../examples/', import.meta.url);
  describe.each(['swamp-topdown', 'iso-dungeon', 'billboard-crawler'])('fixture pack %s', name => {
    test('loads with a custom decoder; every asset, state, facing and variant resolves to a frame inside its atlas', async () => {
      const dir = new URL(`${name}/public/assets/main/`, root);
      const pack = await loadPack('/assets/main/pack.json', recAdapter(), {
        fetchJson: async () => JSON.parse(readFileSync(new URL('pack.json', dir), 'utf8')),
        decode: async url => { const g = decodePNG(new Uint8Array(readFileSync(new URL(url.split('/').pop()!, dir)))); return { width: g.w, height: g.h, data: g.d }; },
      });
      let n = 0;
      for (const id of pack.ids) {
        const a = pack.asset(id);
        for (const variant of a.variants) for (const state of Object.keys(a.states)) a.facings.forEach((_, facing) => {
          for (let frame = 0; frame < a.states[state].frames; frame++) {
            const f = pack.frame(id, { state, facing, frame, variant });
            expect(f.x + f.w <= f.atlas.width && f.y + f.h <= f.atlas.height).toBe(true);
            expect([f.w, f.h]).toEqual(a.size);
            n++;
          }
        });
      }
      expect(n).toBeGreaterThanOrEqual(50);
      // the 8-facing walker: every facing shows its own pixels (no mirroring needed in exported packs)
      const walker = pack.ids.find(id => pack.asset(id).facings.length === 8)!, s = pack.sprite(walker, { state: 'walk' });
      const seen = new Set<string>();
      for (let k = 0; k < 8; k++) { s.face((k * Math.PI) / 4); expect(s.flipX).toBe(false); seen.add(`${s.rect.x},${s.rect.y}`); }
      expect(seen.size).toBe(8);
    });
  });
});
