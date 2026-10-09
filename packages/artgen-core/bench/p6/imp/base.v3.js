// imp base.v3 (r3) — from v2 (6): blank red face, wings blocking the shoulders from the front. Now a dark mouth slot
// with two pale fangs under a heavy brow ridge, the eye points deeper and paler, wings swept further back and up
// (they frame the head from the front instead of hiding the shoulders).
// v2, from v1 (5.5): built like a man (long legs, boxy torso, small head). Now imp proportions: short
// crooked legs, a pot belly hunched forward, a big head pushed forward and low between the shoulders with a jaw, long
// arms reaching the knees, wider wings with a lit leading edge (finger bones as ribs), pale eye points.
// v1, from the fp/character template: one toon-shaded voxel model rendered by the raster renderer's
// billboard camera in 8 facings. A hunched red imp (accent skin), big head with dark horns and pointed ears, leather
// bat wings off the shoulder blades, a tail with a barb, clawed hands hanging low; the walk swings legs and arms.
export const meta = { brief: 'imp', pass: 'r3', notes: 'mouth + fangs, brow, swept-back wings', mirror: false };

const VIEW = { renderer: 'raster', view: 'billboard', scale: 0.9, at: [16, 38] };
const pose = ctx => ({ ph: ctx.state === 'walk' ? Math.sin(ctx.t * Math.PI * 2) : 0 });

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), { ph } = pose(ctx), cap = (name, a, b, r, mat, r1) => m.add({ type: 'capsule', name, a, b, r, ...(r1 && { r1 }), mat, shade: 'toon' });
  for (const [x, s] of [[-1.3, ph], [1.3, -ph]]) { cap('thigh', [x, 0, 5], [x * 1.3, s * 1.2 + 1.2, 2.8], 1, 'accent'); cap('shin', [x * 1.3, s * 1.2 + 1.2, 2.8], [x * 1.1, s * 1.4 - 0.2, 0.6], 0.75, 'accent'); }
  m.add({ type: 'ellipsoid', name: 'belly', cx: 0, cy: 1.4, cz: 6.8, rx: 2.5, ry: 2.2, rz: 2.4, mat: 'accent', shade: 'toon' });
  m.add({ type: 'ellipsoid', name: 'chest', cx: 0, cy: 0.6, cz: 9.4, rx: 2.4, ry: 2, rz: 2.2, mat: 'accent', shade: 'toon' });
  cap('tail', [0, -1.6, 5.5], [0, -4.4, 3], 0.45, 'accent', 0.3);
  m.add({ type: 'ellipsoid', name: 'barb', cx: 0, cy: -4.8, cz: 2.6, rx: 0.7, ry: 0.7, rz: 0.7, mat: 'hair', shade: 'toon' });
  for (const x of [-1, 1]) {
    m.add({ type: 'subtract', name: 'wing', mat: 'leather', shade: 'toon', shapes: [
      { type: 'ellipsoid', cx: x * 3.6, cy: -2.6, cz: 12.2, rx: 3.4, ry: 0.5, rz: 2.8 },
      { type: 'ellipsoid', cx: x * 4.2, cy: -2.6, cz: 9.8, rx: 1.6, ry: 0.8, rz: 1.4 },
      { type: 'ellipsoid', cx: x * 6.2, cy: -2.6, cz: 11, rx: 1, ry: 0.8, rz: 1.4 },
    ] });
    cap('wingbone', [x * 1.6, -1.8, 10.4], [x * 6.6, -2.6, 14.4], 0.32, 'skin', 0.2);
  }
  for (const [x, s] of [[-1, -ph], [1, ph]]) { cap('arm', [x * 2.4, 1.2, 10.4], [x * 3, s * 1.2 + 2.2, 7], 0.6, 'accent'); cap('fore', [x * 3, s * 1.2 + 2.2, 7], [x * 2.8, s * 1.2 + 2.8, 3.8], 0.55, 'accent'); cap('claw', [x * 2.8, s * 1.2 + 2.8, 3.8], [x * 2.9, s * 1.2 + 3.4, 2.8], 0.45, 'hair', 0.2); }
  m.add({ type: 'ellipsoid', name: 'head', cx: 0, cy: 2.4, cz: 12.2, rx: 2.6, ry: 2.4, rz: 2.3, mat: 'accent', shade: 'toon' });
  m.add({ type: 'ellipsoid', name: 'jaw', cx: 0, cy: 3.4, cz: 10.9, rx: 1.8, ry: 1.4, rz: 0.9, mat: 'accent', shade: 'toon' });
  m.add({ type: 'slab', name: 'mouth', x: -1.2, y: 4.2, z: 10.8, w: 2.4, d: 0.8, h: 0.5, mat: 'hair' });
  m.add({ type: 'ellipsoid', name: 'brow', cx: 0, cy: 3.6, cz: 13.2, rx: 2, ry: 0.9, rz: 0.5, mat: 'accent', shade: 'toon' });
  for (const x of [-1, 1]) {
    m.add({ type: 'slab', name: 'fang', x: x * 0.7 - 0.25, y: 4.3, z: 10.4, w: 0.5, d: 0.6, h: 0.5, add: true, mat: 'skin' });
    cap('horn', [x * 1.4, 2, 13.8], [x * 2.6, 1.2, 16.4], 0.55, 'hair', 0.15);
    cap('ear', [x * 2.4, 2, 12.6], [x * 4, 1.4, 13.6], 0.45, 'accent', 0.12);
    m.add({ type: 'ellipsoid', name: 'eye', cx: x * 0.95, cy: 4.3, cz: 12.5, rx: 0.55, ry: 0.4, rz: 0.45, mat: 'skin', shade: 'flat' });
  }
  return m.render(...ctx.size, { ...VIEW, facing: ctx.facing });
}

export const anchors = ctx => {
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: ctx.facing }, out = {}, { ph } = pose(ctx);
  const put = (n, p) => { const a = m.screen(...ctx.size, o, p); if (a) out[n] = a; };
  put('head', [0, 2.4, 12.2]); put('hand', [2.9, ph * 1.2 + 3.4, 2.8]);
  if (['s', 'se', 'sw'].includes(ctx.facing)) { put('eye', [-0.95, 4.7, 12.6]); put('eye2', [0.95, 4.7, 12.6]); }
  return out;
};
