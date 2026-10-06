// rubble base.v4 (u1) — user feedback on base.v3 ("too small and lumpy; a bigger spill of distinct cut blocks"): a
// wider spill (5x4 footprint) of separate blocks with gaps between them, two of them stacked, one tipped block lying
// on its side. Blocks sit on a grid with one-unit gaps (the cubes renderer merges touching boxes of one material, so
// a first try with jitter fused them into one slab); dust is a few low scattered cells between them.
export const meta = { brief: 'rubble', pass: 'u1', notes: 'wide spill of distinct blocks, two stacked', mirror: false };

export const params = {
  seed: { type: 'range', min: 1, max: 99, step: 1, default: 7 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d(), r = ctx.lib.rng(P.seed);
  const S = Math.max(6, Math.round(w / 4.4));
  const cells = [[0, 0, 2, 2, 2], [3, 0, 2, 1, 1], [0, 3, 1, 2, 1], [3, 2, 2, 2, 1], [6, 1, 1, 1, 1]];
  cells.forEach(([x, y, bw, bd, bh], i) => m.add({ type: 'box', name: `block${i}`, x, y, z: 0, w: bw, d: bd, h: bh, mat: 'stone', hi: 'stone.0' }));
  m.add({ type: 'box', name: 'stacked', x: 3, y: 2, z: 1, w: 1, d: 1, h: 1, mat: 'stone', hi: 'stone.0' });
  for (let i = 0; i < 5; i++) m.add({ type: 'box', name: 'dust', x: Math.floor(r() * 6), y: Math.floor(r() * 5), z: 0, w: 1, d: 1, h: 1, mat: 'leather' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 6 - 7) });
}
