// car base.v3 (r3) — from v2 (6.5): a dark roof panel on the cabin and a sill line along the lower body so the
// stack reads as body / glass / roof in three layers. v2: wheels wider and poking out past the body so they show at every angle; bumpers in
// metal front and back; headlights as the lightest metal step on the nose corners; a dark leather stripe over the
// bonnet so the long axis reads when it turns.
export const meta = { brief: 'car', pass: 'r3', notes: 'roof panel, sill line (v2: wheels, bumpers, headlights, stripe)', mirror: false };

export function model(ctx) {
  const m = ctx.lib.t2.scene3d();
  // wheels (dark rubber) at the corners, body over them, cabin on top
  for (const x of [2, 12]) for (const y of [-0.5, 7.5]) m.add({ type: 'box', name: 'wheel', x, y, z: 0, w: 4, d: 2, h: 3, mat: 'leather' });
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
  for (const x of [-0.5, 17.5]) m.add({ type: 'box', name: 'bumper', x, y: 1.5, z: 1, w: 1, d: 6, h: 1, mat: 'metal' });
  m.add({ type: 'slab', name: 'roof', x: 6, y: 3, z: 6, w: 5, d: 3, h: 1, mat: 'leather' });
  m.add({ type: 'slab', name: 'sill', x: -1, y: -1, z: 2, w: 20, d: 11, h: 1, mat: 'leather' });
  m.add({ type: 'slab', name: 'stripe', x: 13, y: 4, z: 4, w: 5, d: 1, h: 1.2, mat: 'leather' });
  for (const y of [1.5, 6.5]) m.add({ type: 'slab', name: 'lamp', x: 17, y, z: 2.5, w: 1.2, d: 1, h: 1.5, mat: 'metal' });
  return m;
}

export function render(ctx) {
  const sl = model(ctx).slices(24, 24);
  return sl[ctx.frame] ?? new ctx.lib.Grid(24, 24);
}
