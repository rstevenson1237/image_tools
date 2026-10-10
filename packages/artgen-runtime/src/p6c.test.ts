// PLAN P6c runtime: smoothing sub-frames under logical frames (R13 counts logical frames), additive blend for effects.
import { describe, expect, test } from 'vitest';
import { createPack, type RuntimeAdapter } from './index.js';
import { cellAt, synthPack } from './testkit.js';

interface Rec { frame?: { x: number; y: number }; blend?: string }
const adapter: RuntimeAdapter<number, Rec, Rec[]> = {
  id: 'record', loadTexture: a => a.index, createNode: () => ({}), setFrame(n, f) { n.frame = { x: f.x, y: f.y }; },
  setAnchor() {}, setPosition() {}, setBlend(n, m) { n.blend = m; }, dispose() {},
};

describe('P6c', () => {
  test('sub-frames: sprite.frame stays logical while the displayed frame steps through the sub-frames', async () => {
    const { manifest, images } = synthPack();
    // swing's 4 exported attack frames become 2 logical frames × 2 sub-frames, the second held 300 ms
    manifest.assets.swing.states.attack = { frames: 2, fps: 10, loop: false, durations: [100, 300], sub: 2 };
    const pack = await createPack(manifest, images, adapter), s = pack.sprite('swing'), cell0 = cellAt(s.node.frame!.x, s.node.frame!.y);
    const seen: [number, number, number][] = [];
    for (const dt of [0, 60, 50, 150, 200]) { s.update(dt); seen.push([s.frame, s.sub, cellAt(s.node.frame!.x, s.node.frame!.y) - cell0]); }
    expect(seen).toEqual([[0, 0, 0], [0, 1, 1], [1, 0, 2], [1, 1, 3], [1, 1, 3]]);
    expect(s.done).toBe(true);
    expect(pack.frameIndex('swing', { state: 'attack', frame: 1, sub: 1 })).toBe(3);
    expect(pack.anchor('swing', 'hand', { state: 'attack', frame: 1, sub: 0 })).toEqual([6, 2]); // displayed frame 2
  });

  test('additive effects: sprites of a `blend: add` asset ask the adapter for additive blending', async () => {
    const { manifest, images } = synthPack();
    manifest.assets.boom.blend = 'add';
    const pack = await createPack(manifest, images, adapter);
    expect(pack.effect('boom').spawn(0, 0).node.blend).toBe('add');
    expect(pack.sprite('walker').node.blend).toBeUndefined();
  });
});
