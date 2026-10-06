// barrel base.v2 (r2) — v1 taller (height 3.2 radii) with less bulge and three hoops, so it reads as a barrel. v1: from the iso prop template (3D mode): an oak barrel as a bulging cylinder (sdf), two iron hoops
// as surface slabs (R5: they recolour the staves instead of poking out), a darker lid. Size from ctx.size.
export const meta = { brief: 'barrel', pass: 'r2', notes: 'sdf cylinder, slab hoops', mirror: false };

export const params = {
  bulge: { type: 'range', min: 0.05, max: 0.2, default: 0.06 },
  hoops: { type: 'choice', options: [2, 3], default: 3 },
};

export function render(ctx) {
  const [w, h] = ctx.size, P = ctx.params, m = ctx.lib.t2.scene3d();
  const R = Math.max(2, Math.round(w / 11)), H = Math.round(R * 3.2), c = R - 0.5;
  m.add({ type: 'sdf', name: 'staves', mat: 'wood', bbox: [0, 0, 0, 2 * R, 2 * R, H],
    fn: (x, y, z) => Math.hypot(x - c, y - c) - R * (1 - P.bulge + P.bulge * Math.sin(Math.PI * z / H) * 1.6) });
  m.add({ type: 'slab', name: 'lid', x: 0, y: 0, z: H - 1, w: 2 * R, d: 2 * R, h: 1, mat: 'wood', hi: 'wood.0' });
  const zs = P.hoops === 3 ? [1, Math.round(H / 2), H - 2] : [1, H - 2];
  for (const z of zs) m.add({ type: 'slab', name: 'hoop', x: 0, y: 0, z, w: 2 * R, d: 2 * R, h: 1, mat: 'metal' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 3 - 4 * R) });
}
