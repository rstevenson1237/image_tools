// skeleton base.v2 (r2) — from v1 (4.5: read as a mummy): bones thinned to r 0.32–0.38 so limbs are 1–2 px with air
// between them; the ribcage is open rings (hollow ellipsoids) on a visible spine; a bigger skull with dark sockets
// carved deep and a small ember in each; pelvis smaller; the sword hand slightly out from the body.
export const meta = { brief: 'skeleton', pass: 'r2', notes: 'thin bones, hollow rib rings, big skull with dark sockets', mirror: false };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), walk = ctx.state === 'walk', ph = walk ? Math.sin(ctx.t * Math.PI * 2) : 0;
  const bone = 'skin', P = (x, y, z) => [x, y, z], cap = (name, a, b, r, mat = bone) => m.add({ type: 'capsule', name, a, b, r, mat, shade: 'toon' });
  for (const [side, s] of [[-1, ph], [1, -ph]]) {
    const hip = P(side * 1, 0, 8.6), knee = P(side * 1.1, 1.1 * s + 0.2, 4.7), foot = P(side * 1.1, 2 * s, 0.7);
    cap('leg', hip, knee, 0.38); cap('shin', knee, foot, 0.34);
    m.add({ type: 'box', name: 'foot', x: side * 1.1 - 0.5, y: 2 * s - 0.2, z: 0, w: 1, d: 1.6, h: 0.5, mat: bone });
  }
  m.add({ type: 'ellipsoid', name: 'pelvis', cx: 0, cy: 0, cz: 8.9, rx: 1.4, ry: 0.8, rz: 0.6, mat: bone, shade: 'toon' });
  cap('spine', P(0, -0.4, 9), P(0, -0.4, 14.6), 0.32);
  // ribs: open rings around the spine
  for (let i = 0; i < 3; i++) m.add({ type: 'subtract', name: 'rib', mat: bone, shade: 'toon', shapes: [
    { type: 'ellipsoid', cx: 0, cy: 0, cz: 11.2 + i * 1.1, rx: 1.9 - i * 0.1, ry: 1.25, rz: 0.4 },
    { type: 'ellipsoid', cx: 0, cy: 0.1, cz: 11.2 + i * 1.1, rx: 1.35 - i * 0.1, ry: 0.75, rz: 0.6 },
  ] });
  cap('shoulders', P(-2.1, -0.3, 14.7), P(2.1, -0.3, 14.7), 0.36);
  const le = P(-2.5, 0.4 * -ph, 12.2), lh = P(-2.6, 1.3 * -ph + 0.3, 9.8), re = P(2.6, 0.6, 12.3), rh = P(2.8, 1.8 + 0.6 * ph, 10.6);
  cap('arm', P(-2.2, -0.3, 14.6), le, 0.32); cap('forearm', le, lh, 0.3);
  cap('arm', P(2.2, -0.3, 14.6), re, 0.32); cap('forearm', re, rh, 0.3);
  cap('sword', P(rh[0], rh[1] + 0.3, rh[2] + 0.5), P(rh[0], rh[1] + 2.6, rh[2] + 7.2), 0.3, 'metal');
  cap('guard', P(rh[0] - 0.9, rh[1] + 0.4, rh[2] + 0.9), P(rh[0] + 0.9, rh[1] + 0.4, rh[2] + 0.9), 0.26, 'leather');
  cap('neck', P(0, -0.2, 14.6), P(0, 0, 15.6), 0.3);
  // skull: big, sockets carved deep and filled dark at the back, an ember in each
  m.add({ type: 'subtract', name: 'skull', mat: bone, shade: 'toon', shapes: [
    { type: 'ellipsoid', cx: 0, cy: 0.2, cz: 17.3, rx: 1.9, ry: 2, rz: 2 },
    { type: 'ellipsoid', cx: -0.75, cy: 2.1, cz: 17.4, rx: 0.6, ry: 0.8, rz: 0.6 },
    { type: 'ellipsoid', cx: 0.75, cy: 2.1, cz: 17.4, rx: 0.6, ry: 0.8, rz: 0.6 },
  ] });
  for (const x of [-0.75, 0.75]) {
    m.add({ type: 'ellipsoid', name: 'socket', cx: x, cy: 1.4, cz: 17.4, rx: 0.55, ry: 0.4, rz: 0.55, mat: 'hair' });
    m.add({ type: 'ellipsoid', name: 'ember', cx: x, cy: 1.6, cz: 17.4, rx: 0.25, mat: 'accent' });
  }
  m.add({ type: 'box', name: 'jaw', x: -0.8, y: 0.7, z: 15.3, w: 1.6, d: 1.1, h: 0.6, mat: bone });
  return m.render(32, 48, { renderer: 'raster', facing: ctx.facing, view: 'iso', scale: 0.78, at: [16, 43], pivot: [0, 0, 0] });
}
