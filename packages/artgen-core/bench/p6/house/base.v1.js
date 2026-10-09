// house base.v1 (r1) — oblique cottage in 3D mode, raster renderer, flat faces: stone footing, timber walls with
// darker posts (slabs), a gabled roof as an sdf prism with shingle rows, door and a warm window (accent), chimney.
export const meta = { brief: 'house', pass: 'r1', notes: 'oblique cottage: footing, timber walls, gable roof, door, window, chimney', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 2 }), W = 14, D = 8, H = 6;
  m.add({ type: 'box', name: 'footing', x: -0.5, y: -0.5, z: 0, w: W + 1, d: D + 1, h: 1.5, mat: 'stone' });
  m.add({ type: 'box', name: 'walls', x: 0, y: 0, z: 1.5, w: W, d: D, h: H - 1.5, mat: 'wood' });
  for (const x of [0, W / 2 - 0.5, W - 1]) m.add({ type: 'slab', name: 'post', x, y: D - 0.5, z: 1.5, w: 1, d: 0.5, h: H - 1.5, mat: 'leather' });
  m.add({ type: 'slab', name: 'beam', x: 0, y: D - 0.5, z: H - 1, w: W, d: 0.5, h: 0.5, mat: 'leather' });
  m.add({ type: 'slab', name: 'door', x: 2, y: D - 0.5, z: 1.5, w: 2.5, d: 0.5, h: 3.5, mat: 'leather' });
  m.add({ type: 'slab', name: 'window', x: 9, y: D - 0.5, z: 3, w: 2.5, d: 0.5, h: 1.5, mat: 'accent' });
  // gabled roof along x: ridge over the middle of the depth, eaves overhanging
  const rz = H, ridge = 4.5, half = D / 2 + 1;
  m.add({ type: 'sdf', name: 'roof', mat: 'stone', shade: 'toon', bbox: [-1, -1, rz, W + 1, D + 1, rz + ridge + 0.5], fn: (x, y, z) => (z - rz) - ridge * (1 - Math.abs(y - D / 2) / half) });
  m.add({ type: 'box', name: 'chimney', x: W - 4, y: 2, z: rz, w: 1.5, d: 1.5, h: ridge + 1.5, mat: 'stone' });
  return m.render(48, 48, { renderer: 'raster', view: 'oblique', scale: 1, at: [24, 40], shadowShape: 'footprint' });
}
