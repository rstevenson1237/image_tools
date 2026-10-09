// isohero-toon base.v1 (r1) — artlab's T4 rogue rebuilt for the raster renderer: k = 3 voxels (sub-pixel), toon
// shading on every organic part (hood, cloak, head, hands) so the ellipsoid stair-steps that speckled T4 v3 shade as
// smooth bands; flat boots and belt. Facings from the one model (s, w, n, e here).
export const meta = { brief: 'isohero-toon', pass: 'r1', notes: 'T4 rogue in raster toon, k=3', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), T = { shade: 'toon' };
  for (const x of [-1, 1]) {
    m.add({ type: 'box', name: 'boot', x: x - 0.7, y: -0.6, z: 0, w: 1.4, d: 1.8, h: 1.2, mat: 'leather' });
    m.add({ type: 'capsule', name: 'leg', a: [x, 0, 1], b: [x, 0, 6], r: 0.75, mat: 'leather', ...T });
  }
  m.add({ type: 'capsule', name: 'tunic', a: [0, 0, 6.5], b: [0, 0, 11.5], r: 2, mat: 'leather', ...T });
  m.add({ type: 'slab', name: 'belt', x: -2.2, y: -2.2, z: 7.2, w: 4.4, d: 4.4, h: 0.6, mat: 'gold' });
  // cloak: a flared shell behind and around the shoulders
  m.add({ type: 'sdf', name: 'cloak', mat: 'green', ...T, bbox: [-4, -4, 2, 4, 2, 13], fn: (x, y, z) => {
    const r = 1.8 + (13 - z) * 0.18, d = Math.hypot(x, y + 0.3);
    return y > 0.4 ? 1 : Math.max(d - r, 1.7 + (13 - z) * 0.1 - d);
  } });
  for (const x of [-2.3, 2.3]) m.add({ type: 'capsule', name: 'arm', a: [x, 0, 11.2], b: [x * 1.05, 0.6, 8], r: 0.65, mat: 'green', ...T });
  m.add({ type: 'ellipsoid', name: 'hand', cx: 2.5, cy: 1.2, cz: 7.8, rx: 0.6, mat: 'skin', ...T });
  m.add({ type: 'capsule', name: 'dagger', a: [2.5, 1.4, 7.4], b: [2.5, 2.4, 5], r: 0.3, mat: 'steel' });
  // hood with the face set into its opening
  m.add({ type: 'subtract', name: 'hood', mat: 'green', ...T, shapes: [
    { type: 'ellipsoid', cx: 0, cy: -0.2, cz: 14, rx: 2.6, ry: 2.5, rz: 2.9 },
    { type: 'ellipsoid', cx: 0, cy: 2.2, cz: 13.6, rx: 1.7, ry: 1.6, rz: 1.8 },
  ] });
  m.add({ type: 'ellipsoid', name: 'face', cx: 0, cy: 0.6, cz: 13.5, rx: 1.5, ry: 1.3, rz: 1.6, mat: 'skin', ...T });
  return m.render(32, 48, { renderer: 'raster', facing: ctx.facing, view: 'iso', scale: 1, at: [16, 43], pivot: [0, 0, 0] });
}
