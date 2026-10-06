// isochest base.v1 (r1) — first T2+ 3D-mode build from the brief: wooden chest body, gold straps and a steel lock
// as surface slabs (R5), lid closed on top or standing open at the back over a heap of gold; cubes iso renderer.
export const meta = { brief: 'isochest', pass: 'r1', notes: 'first build from the brief (3D mode)', mirror: false };

export function render(ctx) {
  const open = ctx.state === 'open', m = ctx.lib.t2.scene3d();
  m.add({ type: 'box', name: 'body', x: 0, y: 0, z: 0, w: 7, d: 4, h: 3, mat: 'wood' });
  if (open) {
    m.add({ type: 'box', name: 'gold', x: 1, y: 1, z: 2, w: 5, d: 2, h: 1, mat: 'gold', hi: 'white.0' });
    m.add({ type: 'box', name: 'lid', x: 0, y: -1, z: 3, w: 7, d: 1, h: 4, mat: 'wood' });
  } else m.add({ type: 'box', name: 'lid', x: 0, y: 0, z: 3, w: 7, d: 4, h: 1, mat: 'wood' });
  for (const x of [1, 5]) m.add({ type: 'slab', name: 'strap', x, y: open ? -1 : 0, z: 0, w: 1, d: open ? 5 : 4, h: open ? 7 : 4, mat: 'gold', hi: 'white.0' });
  m.add({ type: 'slab', name: 'lock', x: 3, y: 3, z: open ? 1 : 2, w: 1, d: 1, h: 1, mat: 'steel' });
  return m.render(32, 32, { ox: 13, oy: 17 });
}
