// skeleton base.v3 (r3) — from v2 (6): ribs as four thin rings with a dark chest cavity behind them (cloth's darkest
// step reads as shadow through the gaps) so the front stops reading as a vest; arms held out from the ribs; a broader
// rusty blade (metal edge on a leather-dark core); anchors `eye`/`eye2`/`blade` projected from the model for the finish.
export const meta = { brief: 'skeleton', pass: 'r3', notes: 'rib rings over a dark cavity, arms out, broad blade, model-projected anchors', mirror: false };

const VIEW = { renderer: 'raster', view: 'iso', scale: 0.78, at: [16, 43], pivot: [0, 0, 0] };
const pose = ctx => { const ph = ctx.state === 'walk' ? Math.sin(ctx.t * Math.PI * 2) : 0; return { ph, rh: [2.9, 1.8 + 0.6 * ph, 10.6] }; };

export function render(ctx) {
  const m = ctx.lib.t2.scene3d({ k: 3 }), { ph, rh } = pose(ctx);
  const bone = 'skin', P = (x, y, z) => [x, y, z], cap = (name, a, b, r, mat = bone) => m.add({ type: 'capsule', name, a, b, r, mat, shade: 'toon' });
  for (const [side, s] of [[-1, ph], [1, -ph]]) {
    const hip = P(side * 1, 0, 8.6), knee = P(side * 1.1, 1.1 * s + 0.2, 4.7), foot = P(side * 1.1, 2 * s, 0.7);
    cap('leg', hip, knee, 0.38); cap('shin', knee, foot, 0.34);
    m.add({ type: 'box', name: 'foot', x: side * 1.1 - 0.5, y: 2 * s - 0.2, z: 0, w: 1, d: 1.6, h: 0.5, mat: bone });
  }
  m.add({ type: 'ellipsoid', name: 'pelvis', cx: 0, cy: 0, cz: 8.9, rx: 1.4, ry: 0.8, rz: 0.6, mat: bone, shade: 'toon' });
  cap('spine', P(0, -0.4, 9), P(0, -0.4, 14.6), 0.32);
  // chest cavity: a dark core the rings sit around, seen through the gaps
  m.add({ type: 'ellipsoid', name: 'cavity', cx: 0, cy: -0.1, cz: 12.4, rx: 1.2, ry: 0.7, rz: 1.8, mat: 'cloth', shade: 'flat' });
  for (let i = 0; i < 4; i++) m.add({ type: 'subtract', name: 'rib', mat: bone, shade: 'toon', shapes: [
    { type: 'ellipsoid', cx: 0, cy: 0, cz: 10.8 + i * 0.95, rx: 1.95 - i * 0.08, ry: 1.3, rz: 0.3 },
    { type: 'ellipsoid', cx: 0, cy: 0.05, cz: 10.8 + i * 0.95, rx: 1.45 - i * 0.08, ry: 0.85, rz: 0.5 },
  ] });
  cap('shoulders', P(-2.1, -0.3, 14.7), P(2.1, -0.3, 14.7), 0.36);
  const le = P(-2.8, 0.4 * -ph, 12.2), lh = P(-3, 1.3 * -ph + 0.3, 9.8), re = P(2.9, 0.6, 12.3);
  cap('arm', P(-2.2, -0.3, 14.6), le, 0.32); cap('forearm', le, lh, 0.3);
  cap('arm', P(2.2, -0.3, 14.6), re, 0.32); cap('forearm', re, rh, 0.3);
  m.add({ type: 'capsule', name: 'blade', a: P(rh[0], rh[1] + 0.3, rh[2] + 0.6), b: P(rh[0], rh[1] + 2.7, rh[2] + 7.6), r: 0.42, r1: 0.2, mat: 'metal', shade: 'toon' });
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
  return m.render(32, 48, { ...VIEW, facing: ctx.facing });
}

// eyes only where the face is toward the viewer; the blade tip always
export const anchors = ctx => {
  const m = ctx.lib.t2.scene3d({ k: 3 }), o = { ...VIEW, facing: ctx.facing }, { rh } = pose(ctx), front = ['s', 'sw', 'se'].includes(ctx.facing);
  const out = {}, put = (n, p) => { const a = m.screen(32, 48, o, p); if (a) out[n] = a; };
  if (front) { put('eye', [-0.75, 2.1, 17.4]); put('eye2', [0.75, 2.1, 17.4]); }
  put('blade', [rh[0], rh[1] + 2.7, rh[2] + 7.6]);
  return out;
};
