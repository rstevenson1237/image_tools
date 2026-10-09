// imp base.v1 (r1) — from the fp/character template: one toon-shaded voxel model rendered by the raster renderer's
// billboard camera in 8 facings. A hunched red imp (accent skin), big head with dark horns and pointed ears, leather
// bat wings off the shoulder blades, a tail with a barb, clawed hands hanging low; the walk swings legs and arms.
export const meta = { brief: 'imp', pass: 'r1', notes: 'voxel imp, 8 facings', mirror: false };

const VIEW = { renderer: 'raster', view: 'billboard', scale: 0.9, at: [16, 38] };
const pose = ctx => ({ ph: ctx.state === 'walk' ? Math.sin(ctx.t * Math.PI * 2) : 0 });

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), { ph } = pose(ctx), cap = (name, a, b, r, mat, r1) => m.add({ type: 'capsule', name, a, b, r, ...(r1 && { r1 }), mat, shade: 'toon' });
  for (const [x, s] of [[-1.2, ph], [1.2, -ph]]) { cap('thigh', [x, 0.3, 6.5], [x * 1.1, s * 1.4 + 0.8, 3.8], 0.9, 'accent'); cap('shin', [x * 1.1, s * 1.4 + 0.8, 3.8], [x, s * 1.6 - 0.4, 0.6], 0.7, 'accent'); }
  m.add({ type: 'ellipsoid', name: 'body', cx: 0, cy: 0.6, cz: 9, rx: 2.4, ry: 2, rz: 3, mat: 'accent', shade: 'toon' });
  cap('tail', [0, -1.6, 7], [0, -4, 4], 0.4, 'accent', 0.3);
  m.add({ type: 'ellipsoid', name: 'barb', cx: 0, cy: -4.4, cz: 3.6, rx: 0.6, ry: 0.6, rz: 0.6, mat: 'hair', shade: 'toon' });
  for (const x of [-1, 1]) m.add({ type: 'subtract', name: 'wing', mat: 'leather', shade: 'toon', shapes: [
    { type: 'ellipsoid', cx: x * 3, cy: -1.6, cz: 12, rx: 2.6, ry: 0.5, rz: 2.4 },
    { type: 'ellipsoid', cx: x * 3.4, cy: -1.6, cz: 10.2, rx: 1.4, ry: 0.8, rz: 1.2 },
  ] });
  for (const [x, s] of [[-1, -ph], [1, ph]]) { cap('arm', [x * 2.4, 1, 11], [x * 2.9, s * 1.4 + 1.6, 7], 0.6, 'accent'); cap('claw', [x * 2.9, s * 1.4 + 1.6, 7], [x * 3, s * 1.4 + 2.2, 6], 0.45, 'hair', 0.2); }
  m.add({ type: 'ellipsoid', name: 'head', cx: 0, cy: 1.6, cz: 13.6, rx: 2.2, ry: 2, rz: 2, mat: 'accent', shade: 'toon' });
  for (const x of [-1, 1]) {
    cap('horn', [x * 1.2, 1.2, 15], [x * 2, 0.6, 17.4], 0.5, 'hair', 0.15);
    cap('ear', [x * 2, 1.4, 14], [x * 3.4, 1, 14.8], 0.4, 'accent', 0.12);
    m.add({ type: 'ellipsoid', name: 'eye', cx: x * 0.8, cy: 3.4, cz: 13.9, rx: 0.45, ry: 0.4, rz: 0.4, mat: 'skin', shade: 'flat' });
  }
  return m.render(...ctx.size, { ...VIEW, facing: ctx.facing });
}

export const anchors = ctx => {
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: ctx.facing }, out = {}, { ph } = pose(ctx);
  const put = (n, p) => { const a = m.screen(...ctx.size, o, p); if (a) out[n] = a; };
  put('head', [0, 1.6, 13.6]); put('hand', [2.9, ph * 1.4 + 1.6, 7]);
  if (['s', 'se', 'sw'].includes(ctx.facing)) { put('eye', [-0.8, 3.6, 13.9]); put('eye2', [0.8, 3.6, 13.9]); }
  return out;
};
