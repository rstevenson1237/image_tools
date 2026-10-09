// isohero-toon base.v3 (r3) — from v2 (5.5; best v1 6, R12 keeps v2's boots and smoothing): no hood-rim slab (it
// recoloured the face); the face sits deeper in a wider opening so the hood frames it, a fringe of hair across the brow.
// v2 — from v1 (6): toon normals over a 3-voxel radius (the cloak shell's band specks merge),
// boots split with a gap and toes forward, a hood rim slab in the dark green so the face opening reads, face anchors
// (`eye`, `eye2`) projected from the model for the finish. v1: artlab's T4 rogue rebuilt for the raster renderer, k = 3,
// toon on every organic part.
export const meta = { brief: 'isohero-toon', pass: 'r3', notes: 'face recessed in a wider opening, brow fringe; v2 boots + smoothing', mirror: false };
const VIEW = { renderer: 'raster', view: 'iso', scale: 1, at: [16, 43], pivot: [0, 0, 0], smooth: 3 };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), T = { shade: 'toon' };
  for (const x of [-1, 1]) {
    m.add({ type: 'box', name: 'boot', x: x * 1.1 - 0.6, y: -0.4, z: 0, w: 1.2, d: 2, h: 1.2, mat: 'leather' });
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
    { type: 'ellipsoid', cx: 0, cy: 2.3, cz: 13.6, rx: 1.9, ry: 1.9, rz: 2 },
  ] });
  m.add({ type: 'ellipsoid', name: 'fringe', cx: 0, cy: 1.1, cz: 14.9, rx: 1.4, ry: 0.7, rz: 0.5, mat: 'hair', ...T });
  m.add({ type: 'ellipsoid', name: 'face', cx: 0, cy: 0.4, cz: 13.5, rx: 1.5, ry: 1.3, rz: 1.6, mat: 'skin', ...T });
  return m.render(32, 48, { ...VIEW, facing: ctx.facing });
}

export const anchors = ctx => {
  if (ctx.facing !== 's') return {};
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: ctx.facing }, out = {};
  for (const [n, p] of [['eye', [-0.6, 1.7, 13.9]], ['eye2', [0.6, 1.7, 13.9]]]) { const a = m.screen(32, 48, o, p); if (a) out[n] = a; }
  return out;
};
