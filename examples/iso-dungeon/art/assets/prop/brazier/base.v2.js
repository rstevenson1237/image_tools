// brazier base.v2 (r2) — v1 rebuilt: a deep iron bowl (ellipsoid with its top cut off by a subtracted box), a small
// mound of coals inside it (accent ellipsoid, lit edge), short stubby legs. v1 read as a red table.
export const meta = { brief: 'brazier', pass: 'r2', notes: 'deep bowl, coal mound, short legs', mirror: false };

export function render(ctx) {
  const [w, h] = ctx.size, m = ctx.lib.t2.scene3d();
  const R = Math.max(3, Math.round(w / 9)), L = 2, top = L + R;
  for (const [x, y] of [[1, 1], [2 * R - 2, 1], [R - 1, 2 * R - 2]]) m.add({ type: 'box', name: 'leg', x, y, z: 0, w: 1, d: 1, h: L + 1, mat: 'metal' });
  m.add({ type: 'subtract', name: 'bowl', mat: 'metal', hi: 'metal.0', shapes: [
    { type: 'ellipsoid', cx: R - 0.5, cy: R - 0.5, cz: top, rx: R, ry: R, rz: R },
    { type: 'box', x: -1, y: -1, z: top, w: 2 * R + 2, d: 2 * R + 2, h: R + 1 },
  ] });
  m.add({ type: 'ellipsoid', name: 'coals', cx: R - 0.5, cy: R - 0.5, cz: top - 0.5, rx: R - 1.2, ry: R - 1.2, rz: 1.2, mat: 'accent', hi: 'accent.0' });
  return m.render(w, h, { ox: Math.round(w / 2), oy: Math.round(h - 4 - 3 * R) });
}
