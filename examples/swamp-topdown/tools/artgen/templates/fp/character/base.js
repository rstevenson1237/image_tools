// {{ID}} base.v1 (r1) — template: an 8-direction first-person billboard (P6d) from one voxel model (T2+ 3D mode,
// raster renderer, `billboard` camera): one model gives all eight facings, the walk swings the limbs over ctx.t,
// and the voxel normal buffer becomes the sprite's normal map (lit billboards in the `three` adapter). Build the
// silhouette from capsules and ellipsoids (toon shading for organic parts), decoration as slabs (R5). Anchors are
// projected from model points with `m.screen`, so they follow every facing.
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template voxel billboard', mirror: false };

const VIEW = { renderer: 'raster', view: 'billboard', scale: 0.8, at: [16, 45] };

function pose(ctx) {
  const ph = ctx.state === 'walk' ? Math.sin(ctx.t * Math.PI * 2) : 0;
  return { ph };
}

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), { ph } = pose(ctx), cap = (name, a, b, r, mat) => m.add({ type: 'capsule', name, a, b, r, mat, shade: 'toon' });
  for (const [x, s] of [[-1, ph], [1, -ph]]) { cap('thigh', [x, 0, 9], [x, s * 1.5, 5], 0.8, 'cloth'); cap('shin', [x, s * 1.5, 5], [x, s * 2.4, 1], 0.7, 'leather'); }
  m.add({ type: 'ellipsoid', name: 'torso', cx: 0, cy: 0, cz: 12.5, rx: 2.4, ry: 1.5, rz: 3.6, mat: 'cloth', shade: 'toon' });
  for (const [x, s] of [[-1, -ph], [1, ph]]) cap('arm', [x * 2.6, 0, 15], [x * 2.9, s * 1.6, 9.5], 0.65, 'skin');
  m.add({ type: 'ellipsoid', name: 'head', cx: 0, cy: 0.2, cz: 18, rx: 1.8, ry: 1.8, rz: 2, mat: 'skin', shade: 'toon' });
  m.add({ type: 'slab', name: 'hair', x: -2, y: -2, z: 18.6, w: 4, d: 3.4, h: 2, mat: 'hair' });
  return m.render(...ctx.size, { ...VIEW, facing: ctx.facing });
}

export const anchors = ctx => {
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: ctx.facing }, out = {};
  const put = (n, p) => { const a = m.screen(...ctx.size, o, p); if (a) out[n] = a; };
  put('head', [0, 0.2, 18]); put('hand', [2.9, pose(ctx).ph * 1.6, 9.5]);
  return out;
};
