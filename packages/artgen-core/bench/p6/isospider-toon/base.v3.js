// isospider-toon base.v3 (r3) — from v2 (6.5): dark leg tips (the last voxel layer of every foot recoloured ink) so
// the feet plant on the floor, and `eye`/`eye2` anchors projected from the head front for the finish. v2 — from v1 (6): inner lines only at real depth steps (innerDepth 5: crossing legs stop
// inking each other into a dark mesh), legs a touch thicker at the femur so they hold their light side, eyes as two
// pairs of dots instead of a bar, fangs. v1: artlab's T4 spider rebuilt for the raster renderer: k = 3, toon abdomen and head,
// eight legs as two capsules each (femur up to a high knee, tibia down to a spread foot), the hourglass a slab on the
// abdomen's back, eyes a slab cluster on the head front. Front (+y) faces the viewer at `s`.
export const meta = { brief: 'isospider-toon', pass: 'r3', notes: 'dark leg tips, eye anchors (v2: less ink, eye pairs, fangs)', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), T = { shade: 'toon' };
  // legs: for each side four legs fanning from front to back
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = (-50 + i * 33) * Math.PI / 180, hip = [sx * 1.2, 1.2 - i * 0.5, 2.6];
    const knee = [sx * (3 + Math.cos(a) * 0.8), hip[1] + Math.sin(-a) * 2.4, 4.4], foot = [sx * (5.4 + Math.cos(a) * 0.8), hip[1] + Math.sin(-a) * 4.2, 0.3];
    m.add({ type: 'capsule', name: 'femur', a: hip, b: knee, r: 0.5, r1: 0.4, mat: 'purple', ...T });
    m.add({ type: 'capsule', name: 'tibia', a: knee, b: foot, r: 0.35, mat: 'purple', ...T });
  }
  m.add({ type: 'slab', name: 'tips', x: -8, y: -8, z: 0, w: 16, d: 16, h: 0.7, mat: 'ink' });
  m.add({ type: 'ellipsoid', name: 'abdomen', cx: 0, cy: -2.6, cz: 3.2, rx: 2.5, ry: 2.9, rz: 2.1, mat: 'purple', ...T });
  m.add({ type: 'ellipsoid', name: 'head', cx: 0, cy: 1.2, cz: 2.4, rx: 1.6, ry: 1.7, rz: 1.3, mat: 'purple', ...T });
  m.add({ type: 'slab', name: 'hourglass', x: -0.5, y: -4, z: 4.4, w: 1, d: 3, h: 1.2, mat: 'red' });
  for (const x of [-0.7, 0.4]) m.add({ type: 'slab', name: 'eyes', x, y: 2.4, z: 2.7, w: 0.4, d: 0.6, h: 0.4, mat: 'red' });
  for (const x of [-0.5, 0.3]) m.add({ type: 'capsule', name: 'fang', a: [x + 0.1, 2.6, 1.9], b: [x + 0.1, 2.9, 1.1], r: 0.25, mat: 'steel' });
  return m.render(32, 32, { ...VIEW, facing: ctx.facing });
}

const VIEW = { renderer: 'raster', view: 'iso', scale: 0.8, at: [16, 21], pivot: [0, 0, 0], innerDepth: 5 };

export const anchors = ctx => {
  if (ctx.facing !== 's') return {};
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: 's' }, out = {};
  for (const [n, p] of [['eye', [-0.6, 2.8, 2.9]], ['eye2', [0.6, 2.8, 2.9]]]) { const a = m.screen(32, 32, o, p); if (a) out[n] = a; }
  return out;
};
