// isospider-toon base.v1 (r1) — artlab's T4 spider rebuilt for the raster renderer: k = 3, toon abdomen and head,
// eight legs as two capsules each (femur up to a high knee, tibia down to a spread foot), the hourglass a slab on the
// abdomen's back, eyes a slab cluster on the head front. Front (+y) faces the viewer at `s`.
export const meta = { brief: 'isospider-toon', pass: 'r1', notes: 'T4 spider in raster toon, high knees, spread feet', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), T = { shade: 'toon' };
  // legs: for each side four legs fanning from front to back
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const a = (-50 + i * 33) * Math.PI / 180, hip = [sx * 1.2, 1.2 - i * 0.5, 2.6];
    const knee = [sx * (3 + Math.cos(a) * 0.8), hip[1] + Math.sin(-a) * 2.4, 4.4], foot = [sx * (5.4 + Math.cos(a) * 0.8), hip[1] + Math.sin(-a) * 4.2, 0.3];
    m.add({ type: 'capsule', name: 'femur', a: hip, b: knee, r: 0.42, mat: 'purple', ...T });
    m.add({ type: 'capsule', name: 'tibia', a: knee, b: foot, r: 0.35, mat: 'purple', ...T });
  }
  m.add({ type: 'ellipsoid', name: 'abdomen', cx: 0, cy: -2.6, cz: 3.2, rx: 2.5, ry: 2.9, rz: 2.1, mat: 'purple', ...T });
  m.add({ type: 'ellipsoid', name: 'head', cx: 0, cy: 1.2, cz: 2.4, rx: 1.6, ry: 1.7, rz: 1.3, mat: 'purple', ...T });
  m.add({ type: 'slab', name: 'hourglass', x: -0.5, y: -4, z: 4.4, w: 1, d: 3, h: 1.2, mat: 'red' });
  m.add({ type: 'slab', name: 'eyes', x: -0.8, y: 2.4, z: 2.6, w: 1.6, d: 0.6, h: 0.7, mat: 'red' });
  return m.render(32, 32, { renderer: 'raster', facing: ctx.facing, view: 'iso', scale: 0.8, at: [16, 21], pivot: [0, 0, 0] });
}
