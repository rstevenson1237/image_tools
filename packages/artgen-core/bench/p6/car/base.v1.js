// car base.v1 (r1) — sprite stack: a small rounded car modelled once in 3D mode (k = 1, one voxel per slice pixel),
// cut into 9 z-slices; frame i of the `stack` state is slice i (bottom first). Faces +x (east = angle 0 in the runtime).
export const meta = { brief: 'car', pass: 'r1', notes: 'rounded body, cabin with glass, wheels, lamps', mirror: false };

export function model(ctx) {
  const m = ctx.lib.t2.scene3d();
  // wheels (dark rubber) at the corners, body over them, cabin on top
  for (const x of [2, 12]) for (const y of [0, 7]) m.add({ type: 'box', name: 'wheel', x, y, z: 0, w: 4, d: 2, h: 3, mat: 'leather' });
  m.add({ type: 'sdf', name: 'body', mat: 'accent', shade: 'toon', bbox: [0, 1, 1, 18, 8, 5], fn: (x, y, z) => {
    const dx = Math.max(0, Math.abs(x - 9) - 7), dy = Math.max(0, Math.abs(y - 4.5) - 2.5), dz = Math.max(0, Math.abs(z - 3) - 1);
    return Math.hypot(dx, dy, dz) - 1.2;
  } });
  m.add({ type: 'sdf', name: 'cabin', mat: 'accent', shade: 'toon', bbox: [5, 2, 5, 13, 7, 8], fn: (x, y, z) => {
    const dx = Math.max(0, Math.abs(x - 8.5) - 2.5), dy = Math.max(0, Math.abs(y - 4.5) - 1.2), dz = Math.max(0, z - 6);
    return Math.hypot(dx, dy, dz) - 1.1;
  } });
  m.add({ type: 'slab', name: 'glass', x: 11, y: 2, z: 5, w: 2, d: 5, h: 2, mat: 'metal' });
  m.add({ type: 'slab', name: 'glass', x: 5, y: 2, z: 5, w: 1, d: 5, h: 2, mat: 'metal' });
  for (const y of [2, 6]) m.add({ type: 'slab', name: 'lamp', x: 17, y, z: 3, w: 1, d: 1, h: 1, mat: 'metal' });
  return m;
}

export function render(ctx) {
  const sl = model(ctx).slices(24, 24);
  return sl[ctx.frame] ?? new ctx.lib.Grid(24, 24);
}
