// warden base.v3 (r3) — from v2 (6): a dark collar round the neck and a line of brass buttons down the coat front, so
// the coat reads as a uniform from the front facings.
// v2 — from v1 (4.5: the template, nothing said "night warden"): a long blue-grey coat (torso and a
// skirt to mid-thigh on the hip bone, so the legs swing inside it), dark trousers, a flat cap with a brim, a ring of keys
// at the right hip. Still built along the 3D biped rig: every part names its bone, so `artgen rig` skins it the same way.
// v1: the rigged 3D template (R7b).
export const meta = { brief: 'warden', pass: 'r3', notes: 'v2 + collar and brass buttons', mirror: false };

/** Body height in model units, and limb lengths as shares of it (game proportions: a head about a sixth). */
const H = 18;
const BUILD = { head: 0.17, neck: 0.03, leg_up: 0.23, leg_lo: 0.22, arm_up: 0.16, arm_lo: 0.15, armSep: 0.19, legSep: 0.07 };

function view(ctx) {
  const [w, h] = ctx.size, tall = Math.min(h * 0.9, ctx.brief.height ? ctx.brief.height * ctx.lib.pxPerMetre : h * 0.85);
  // the rig's origin (between the feet) at the frame's foot line; the body as tall as the brief's height says (else 85 % of the frame)
  return { renderer: 'raster', view: ctx.brief.view, scale: tall / (2 * H), at: [w / 2, Math.round(h * 0.95)], pivot: [0, 0, 0], smooth: 3 };
}

function model(ctx) {
  const rig = ctx.lib.rigs.body3d('biped', { height: H, proportions: BUILD }), P = rig.pose(ctx.state, ctx.t);
  const m = ctx.lib.t2.scene3d({ k: 3, pose: P }), T = { shade: 'toon' };
  const limb = (bone, name, r, mat) => m.add({ type: 'capsule', name, a: P.start(bone), b: P.end(bone), r, mat, bone, ...T });
  for (const s of ['L', 'R']) {
    limb(`leg${s}_up`, 'trousers', 0.75, 'hair');
    limb(`leg${s}_lo`, 'trousers', 0.65, 'hair');
    m.add({ type: 'capsule', name: 'boot', a: P.at(`leg${s}_lo`, 1, -0.3, 0, 0.45), b: P.at(`leg${s}_lo`, 1, 1.1, 0, 0.4), r: 0.6, mat: 'leather', bone: `leg${s}_lo`, ...T });
    limb(`arm${s}_up`, 'sleeve', 0.72, 'cloth');
    limb(`arm${s}_lo`, 'sleeve', 0.6, 'cloth');
    const [cx, cy, cz] = P.end(`arm${s}_lo`);
    m.add({ type: 'ellipsoid', name: 'hand', cx, cy, cz, rx: 0.65, mat: 'skin', bone: `arm${s}_lo`, ...T });
  }
  // the coat: the chest on the spine, the skirt on the hip, its hem near the hip joints (a longer one bridges to the swinging thighs: skin-stretch)
  m.add({ type: 'capsule', name: 'coat', a: P.along('spine', 0.18), b: P.along('spine', 0.82), r: 1.95, mat: 'cloth', bone: 'spine', ...T });
  const [px, py, pz] = P.start('spine'), skirt = 1.5;
  m.add({ type: 'sdf', name: 'coat', mat: 'cloth', bone: 'hip', ...T, bbox: [px - 2.6, py - 2.2, pz - skirt, px + 2.6, py + 2.2, pz + 0.6], fn: (x, y, z) => {
    const u = Math.min(1, Math.max(0, (pz + 0.6 - z) / (skirt + 0.6))), r = 1.75 + 0.3 * u;
    return Math.max(Math.hypot(x - px, y - py) - r, pz - skirt - z, z - pz - 0.6);
  } });
  m.add({ type: 'slab', name: 'belt', ...box(P.along('spine', 0.06), 4.8, 4.6, 0.5), mat: 'leather' });
  m.add({ type: 'slab', name: 'collar', ...box(P.along('spine', 0.86), 4.2, 4.2, 0.9), mat: 'hair' });
  // buttons: a narrow strip down the coat's front (+y), recoloured where it meets the surface
  const [bx, by, bz] = P.along('spine', 0.2);
  m.add({ type: 'slab', name: 'buttons', x: bx - 0.25, y: by + 1.2, z: bz, w: 0.5, d: 1.2, h: P.along('spine', 0.78)[2] - bz, mat: 'accent' });
  // a ring of keys behind the right hip (clear of the swinging hand; the body's right is −x)
  m.add({ type: 'ellipsoid', name: 'keys', ...pt(P.at('hip', 0, -1.9, 1.3, -0.6)), rx: 0.45, ry: 0.3, rz: 0.55, mat: 'metal', bone: 'hip' });
  m.add({ type: 'capsule', name: 'neck', a: P.start('neck'), b: P.end('neck'), r: 0.7, mat: 'skin', bone: 'neck', ...T });
  const [hx, hy, hz] = P.along('head', 0.5), hr = rig.lengths.head / 2;
  m.add({ type: 'ellipsoid', name: 'head', cx: hx, cy: hy, cz: hz, rx: hr * 0.82, ry: hr * 0.85, rz: hr, mat: 'skin', bone: 'head', ...T });
  // a flat cap with a brim over the eyes
  m.add({ type: 'ellipsoid', name: 'cap', cx: hx, cy: hy - 0.1, cz: hz + hr * 0.55, rx: hr * 0.95, ry: hr * 0.95, rz: hr * 0.45, mat: 'hair', bone: 'head', ...T });
  m.add({ type: 'ellipsoid', name: 'brim', cx: hx, cy: hy + hr * 0.55, cz: hz + hr * 0.4, rx: hr * 0.7, ry: hr * 0.45, rz: hr * 0.12, mat: 'hair', bone: 'head' });
  return { m, P, hr };
}

/** A point as an ellipsoid's centre. */
function pt([cx, cy, cz]) { return { cx, cy, cz }; }

/** A slab's box centred on a point (w across, d deep, h tall, its bottom at the point's z). */
function box([x, y, z], w, d, h) { return { x: x - w / 2, y: y - d / 2, z, w, d, h }; }

export function render(ctx) {
  return model(ctx).m.render(...ctx.size, { ...view(ctx), facing: ctx.facing });
}

export const anchors = ctx => {
  const { m, P, hr } = model(ctx), o = { ...view(ctx), facing: ctx.facing }, out = {};
  const put = (n, p) => { const a = m.screen(...ctx.size, o, p); if (a) out[n] = a; };
  put('head', P.along('head', 0.5)); put('hand', P.end('armR_lo'));
  // the face only where it is seen
  if (ctx.facing === 's') { put('eye', P.at('head', 0.55, hr * 0.85, 0.55, 0)); put('eye2', P.at('head', 0.55, hr * 0.85, -0.55, 0)); }
  return out;
};
