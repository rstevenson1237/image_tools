// PLAN P6a runtime: sprite stacks (rotated slices stepped up), parallax tiling, normal-map atlases.
import { describe, expect, test } from 'vitest';
import { createPack, parallaxTiles, type RuntimeAdapter } from './index.js';
import { cellAt, synthPack } from './testkit.js';

interface Rec { frame?: { x: number; y: number }; pos?: number[]; rot?: number; blend?: string; tex?: unknown; disposed?: boolean }
const adapter = (rotate = true): RuntimeAdapter<{ atlas: number; name: string }, Rec, Rec[]> => ({
  id: 'record',
  loadTexture: a => ({ atlas: a.index, name: a.name }),
  createNode: tex => ({ tex }),
  setFrame(n, f) { n.frame = { x: f.x, y: f.y }; n.tex = f.tex; },
  setAnchor() {},
  setPosition(n, x, y, z) { n.pos = [x, y, z ?? 0]; },
  ...(rotate && { setRotation(n: Rec, r: number) { n.rot = r; } }),
  setBlend(n, m) { n.blend = m; },
  attach(p, n) { p.push(n); },
  dispose(n) { n.disposed = true; },
});

describe('sprite stacks', () => {
  test('one node per slice, bottom first; rotation turns every slice; slices step up by spacing and sort above each other', async () => {
    const { manifest, images } = synthPack(), pack = await createPack(manifest, images, adapter()), parent: Rec[] = [];
    const st = pack.stack('car', { parent, spacing: 2 }).at(10, 20, 5);
    expect(st.nodes).toHaveLength(3);
    expect(parent).toHaveLength(3);
    const cells = st.nodes.map(n => cellAt(n.frame!.x, n.frame!.y));
    expect(cells[1]).toBe(cells[0] + 1);
    expect(st.nodes.map(n => n.pos)).toEqual([[10, 20, 5], [10, 18, 5.001], [10, 16, 5.002]]);
    st.rotate(Math.PI / 4);
    for (const n of st.nodes) expect(n.rot).toBeCloseTo(Math.PI / 4);
    st.dispose();
    expect(parent.every(n => n.disposed)).toBe(true);
  });

  test('an adapter that cannot rotate is refused with a clear message', async () => {
    const { manifest, images } = synthPack(), pack = await createPack(manifest, images, adapter(false));
    expect(() => pack.stack('car')).toThrow('setRotation');
  });
});

describe('parallax', () => {
  test('copies cover the view; depth 0 stays put, depth 1 moves with the camera; positions wrap by the layer width', () => {
    expect(parallaxTiles(0, 100, 64, 1)).toEqual([0, 64]);
    expect(parallaxTiles(10, 100, 64, 1)).toEqual([-10, 54]);
    expect(parallaxTiles(1000, 100, 64, 0)).toEqual([0, 64]);
    expect(parallaxTiles(32, 100, 64, 0.5)).toEqual([-16, 48]);
    for (const cam of [0, 7, 123, 999]) { const xs = parallaxTiles(cam, 100, 64, 0.3); expect(xs[0]).toBeLessThanOrEqual(0); expect(xs[xs.length - 1] + 64).toBeGreaterThanOrEqual(100); }
  });
});

describe('normal maps', () => {
  test('loaded normal atlases give the frame rect at the same position on the normal texture', async () => {
    const { manifest, images } = synthPack();
    const m = { ...manifest, normals: ['synth-0.n.png'] }, n = [{ ...images[0], data: new Uint8ClampedArray(images[0].data.length).fill(128) }];
    const pack = await createPack(m, images, adapter(), n);
    const c = pack.frame('walker', { state: 'walk', frame: 2 }), nf = pack.normalFrame('walker', { state: 'walk', frame: 2 })!;
    expect([nf.x, nf.y, nf.w, nf.h]).toEqual([c.x, c.y, c.w, c.h]);
    expect((nf.tex as { name: string }).name).toBe('synth-0.n.png');
    const plain = await createPack(manifest, images, adapter());
    expect(plain.normalFrame('walker')).toBeUndefined();
  });
});
