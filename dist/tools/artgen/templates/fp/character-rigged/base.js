// {{ID}} base.v1 (r1) — template: a rigged 3D-mode biped (R7b). One voxel model built along the bones of the shared
// biped rig in 3D (`ctx.lib.rigs.body3d`): every state and facing of the sprites is the rig's pose at ctx.t, and
// `artgen rig` skins the mesh of the bind pose (idle, t = 0) to the same bones and exports the clips, so the sprites and
// the game's .glb move alike. Each part names the `bone` it moves with; a part along a bone runs from `P.start` to
// `P.end`, and `P.at(bone, u, fwd, side, up)` places things in the body's own frame (eyes, a held item). Change the
// costume freely; keep the parts on their bones and don't resize bones per state (the `rig-lengths` check).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template rigged 3D biped', mirror: false };

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
    limb(`leg${s}_up`, 'thigh', 0.95, 'cloth');
    limb(`leg${s}_lo`, 'shin', 0.75, 'leather');
    m.add({ type: 'capsule', name: 'boot', a: P.at(`leg${s}_lo`, 1, -0.3, 0, 0.45), b: P.at(`leg${s}_lo`, 1, 1.1, 0, 0.4), r: 0.6, mat: 'leather', bone: `leg${s}_lo`, ...T });
    limb(`arm${s}_up`, 'sleeve', 0.75, 'cloth');
    limb(`arm${s}_lo`, 'forearm', 0.6, 'skin');
    const [cx, cy, cz] = P.end(`arm${s}_lo`);
    m.add({ type: 'ellipsoid', name: 'hand', cx, cy, cz, rx: 0.65, mat: 'skin', bone: `arm${s}_lo`, ...T });
  }
  m.add({ type: 'capsule', name: 'hips', a: P.start('legL_up'), b: P.start('legR_up'), r: 1.0, mat: 'cloth', bone: 'hip', ...T });
  m.add({ type: 'capsule', name: 'torso', a: P.along('spine', 0.2), b: P.along('spine', 0.82), r: 2.1, mat: 'cloth', bone: 'spine', ...T });
  m.add({ type: 'slab', name: 'belt', ...box(P.along('spine', 0.08), 2.4, 2.4, 0.5), mat: 'leather' });
  m.add({ type: 'capsule', name: 'neck', a: P.start('neck'), b: P.end('neck'), r: 0.7, mat: 'skin', bone: 'neck', ...T });
  const [hx, hy, hz] = P.along('head', 0.5), hr = rig.lengths.head / 2;
  m.add({ type: 'ellipsoid', name: 'head', cx: hx, cy: hy, cz: hz, rx: hr * 0.82, ry: hr * 0.85, rz: hr, mat: 'skin', bone: 'head', ...T });
  m.add({ type: 'slab', name: 'hair', ...box([hx, hy - 0.4, hz + hr * 0.25], hr * 1.8, hr * 1.6, hr), mat: 'hair' });
  return { m, P, hr };
}

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
