// skeleton base.v1 (r1) — one voxel model, rendered by the raster renderer at every 8 facings (iso facings are screen
// directions). Bones are thin capsules at k=3 (sub-pixel voxels, the ss vote keeps them 1–2 px), the skull and ribcage
// toon-shaded, a rusty sword in the right hand. Walk: legs swing about the hips, arms counter-swing.
export const meta = { brief: 'skeleton', pass: 'r1', notes: 'voxel raster 8-dir, capsule bones, toon skull', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), walk = ctx.state === 'walk', ph = walk ? Math.sin(ctx.t * Math.PI * 2) : 0;
  const bone = 'skin', P = (x, y, z) => [x, y, z];
  // legs: hip → knee → foot, swinging along y (front = +y)
  for (const [side, s] of [[-1, ph], [1, -ph]]) {
    const hip = P(side * 1.2, 0, 9), knee = P(side * 1.3, 1.2 * s, 5 - Math.abs(s) * 0.3), foot = P(side * 1.3, 2.2 * s, 0.8);
    m.add({ type: 'capsule', name: 'leg', a: hip, b: knee, r: 0.55, mat: bone, shade: 'toon' });
    m.add({ type: 'capsule', name: 'shin', a: knee, b: foot, r: 0.5, mat: bone, shade: 'toon' });
    m.add({ type: 'box', name: 'foot', x: side * 1.3 - 0.6, y: 2.2 * s - 0.4, z: 0, w: 1.2, d: 1.8, h: 0.7, mat: bone });
  }
  m.add({ type: 'ellipsoid', name: 'pelvis', cx: 0, cy: 0, cz: 9.3, rx: 1.9, ry: 1.1, rz: 0.8, mat: bone, shade: 'toon' });
  m.add({ type: 'capsule', name: 'spine', a: P(0, -0.3, 9.5), b: P(0, -0.3, 15), r: 0.45, mat: bone, shade: 'toon' });
  for (let i = 0; i < 4; i++) m.add({ type: 'ellipsoid', name: 'rib', cx: 0, cy: 0.1, cz: 11.4 + i * 0.95, rx: 2.1 - i * 0.1, ry: 1.3, rz: 0.38, mat: bone, shade: 'toon' });
  m.add({ type: 'capsule', name: 'shoulders', a: P(-2.4, -0.2, 15.2), b: P(2.4, -0.2, 15.2), r: 0.5, mat: bone, shade: 'toon' });
  // arms: left swings, right holds the sword forward
  const lh = P(-2.8, 1.2 * -ph, 10.5), rh = P(2.6, 1.6 + 0.8 * ph, 11);
  m.add({ type: 'capsule', name: 'arm', a: P(-2.5, -0.2, 15), b: P(-2.8, 0.4 * -ph, 12.8), r: 0.42, mat: bone, shade: 'toon' });
  m.add({ type: 'capsule', name: 'forearm', a: P(-2.8, 0.4 * -ph, 12.8), b: lh, r: 0.38, mat: bone, shade: 'toon' });
  m.add({ type: 'capsule', name: 'arm', a: P(2.5, -0.2, 15), b: P(2.7, 0.8, 12.8), r: 0.42, mat: bone, shade: 'toon' });
  m.add({ type: 'capsule', name: 'forearm', a: P(2.7, 0.8, 12.8), b: rh, r: 0.38, mat: bone, shade: 'toon' });
  // sword: grip in the right hand, blade up and forward
  m.add({ type: 'capsule', name: 'sword', a: P(rh[0], rh[1] + 0.2, rh[2] + 0.6), b: P(rh[0], rh[1] + 2.4, rh[2] + 7), r: 0.35, mat: 'metal' });
  m.add({ type: 'capsule', name: 'guard', a: P(rh[0] - 1, rh[1] + 0.3, rh[2] + 0.9), b: P(rh[0] + 1, rh[1] + 0.3, rh[2] + 0.9), r: 0.3, mat: 'leather' });
  // skull with sockets carved
  m.add({ type: 'subtract', name: 'skull', mat: bone, shade: 'toon', shapes: [
    { type: 'ellipsoid', cx: 0, cy: 0.3, cz: 17.4, rx: 1.6, ry: 1.7, rz: 1.8 },
    { type: 'ellipsoid', cx: -0.6, cy: 1.9, cz: 17.5, rx: 0.45, ry: 0.5, rz: 0.45 },
    { type: 'ellipsoid', cx: 0.6, cy: 1.9, cz: 17.5, rx: 0.45, ry: 0.5, rz: 0.45 },
  ] });
  m.add({ type: 'box', name: 'jaw', x: -0.9, y: 0.6, z: 15.6, w: 1.8, d: 1.2, h: 0.6, mat: bone });
  m.add({ type: 'ellipsoid', name: 'eye', cx: -0.6, cy: 1.6, cz: 17.5, rx: 0.3, mat: 'accent' });
  m.add({ type: 'ellipsoid', name: 'eye', cx: 0.6, cy: 1.6, cz: 17.5, rx: 0.3, mat: 'accent' });
  return m.render(32, 48, { renderer: 'raster', facing: ctx.facing, view: 'iso', scale: 0.9, at: [16, 43], pivot: [0, 0, 0] });
}

export const anchors = ctx => ({});
