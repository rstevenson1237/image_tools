// brazier base.v1 (r1) — from the iso prop template (3D mode): an iron bowl (half ellipsoid) on three legs, a heap of
// glowing coals filling it (accent slab added on top, lit edge). Prop palette has no glow ramp, so coals are accent.
export const meta = { brief: 'brazier', pass: 'r1', notes: 'bowl on three legs, coals', mirror: false };

export function render(ctx) {
  const [w, h] = ctx.size, m = ctx.lib.t2.scene3d();
  const R = Math.max(3, Math.round(w / 9)), L = 3, c = R;
  for (const [x, y] of [[1, 1], [2 * R - 2, 1], [R, 2 * R - 2]]) m.add({ type: 'box', name: 'leg', x, y, z: 0, w: 1, d: 1, h: L, mat: 'metal' });
  m.add({ type: 'sdf', name: 'bowl', mat: 'metal', bbox: [0, 0, L, 2 * R, 2 * R, L + R],
    fn: (x, y, z) => Math.max(Math.hypot(x - c, y - c, (z - (L + R)) * 1.4) - R, z - (L + R - 1)) });
  m.add({ type: 'slab', name: 'coals', x: 1, y: 1, z: L + R - 1, w: 2 * R - 2, d: 2 * R - 2, h: 1, mat: 'accent', add: true, hi: 'accent.0' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 4 - 4 * R) });
}
