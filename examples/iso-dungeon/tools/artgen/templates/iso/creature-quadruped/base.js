// {{ID}} base.v1 (r1) — template: low quadruped (wolf, rat, lizard, boar, hound) with four facings and a walk cycle
// (iso camera: a 2D sprite per facing on a 2:1 ground shadow), built on the shared quadruped rig (`ctx.lib.rigs.body`). In profile (e/w) the body is a long barrel
// on four legs, the head forward; facing the viewer (s) or away (n) it foreshortens to a short wide mass with the head (or
// the tail) in front. The rig walks the legs in diagonal pairs and keeps the bone lengths fixed in every cell; this file
// only dresses it. It stands on the `ground` anchor (bottom centre): scale it to the brief's height, not to the frame.
// Adapt the head (snout length, ears, horns), the tail and the coat; role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso quadruped rig' };

export const params = {
  coat: { type: 'swap', options: ['hair', 'leather', 'skin', 'grass'], default: 'hair' },
  snout: { type: 'range', min: 0.6, max: 1.4, default: 1 },
  ears: { type: 'toggle', default: true },
};

// Geometry shared by render() and anchors(): the rig's pose for this state and phase, then the body, head and eyes on it.
function layout(ctx) {
  const [w, h] = ctx.size, X = v => (v * w) / 32, rig = ctx.lib.rigs.body('quadruped', ctx, { height: X(12) });
  const { sx, front, side } = rig, P = rig.pose(ctx.state, ctx.t), headR = X(3.9), snout = X(3) * (ctx.params?.snout ?? 1);
  const skull = P.at('head', 0.25), spine = rig.lengths.spine, showFace = front > -0.3;
  // eyes on whole pixels, the near one only in profile; the mouth under the snout
  const eyePts = !showFace ? [] : (side > 0.9 ? [Math.sign(sx)] : [-1, 1]).map(k => P.at('head', 0.25, headR * 0.45, k * headR * 0.45, headR * 0.1));
  const eyes = eyePts.map(p => Math.round(p[0])).sort((a, b) => a - b), eyeY = Math.round(eyePts.length ? eyePts[0][1] : skull[1]);
  const mouth = showFace ? P.at('head', 0.55, headR * 0.3, 0, -headR * 0.55).map(Math.round) : null;
  return { w, h, X, rig, P, sx, front, side, headR, snout, skull, spine, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), coat = pal[P.coat];
  const { X, rig, P: pose, sx, front, side, headR, snout, skull, spine, showFace, eyes, eyeY } = L, barrel = X(8), r = Math.max(1, X(1.4));
  const limb = n => ({ type: 'capsule', a: pose.start(n), b: pose.end(n), r, mat: coat, shade: 'cyl' });
  const pieces = [];
  // every part is painted far to near, so the legs on the far side sit behind the barrel and the head in front facing the viewer
  for (const e of ['FL', 'FR', 'BL', 'BR']) pieces.push({ z: pose.depth(`leg${e}_up`), g: { type: 'group', name: 'legs', underlay: true, children: [limb(`leg${e}_up`), limb(`leg${e}_lo`)] } });
  pieces.push({ z: pose.depth('tail') - 0.01, g: { type: 'group', name: 'tail', underlay: true, children: [{ type: 'capsule', name: 'tail', a: pose.start('tail'), b: pose.end('tail'), r: Math.max(0.8, X(1.2)), mat: coat, shade: 'cyl' }] } });
  const mid = pose.at('spine', 0.5), rx = X(6) * (1 - side) + (spine / 2 + X(1.5)) * side, ry = barrel / 2 + (1 - side) * spine * 0.15;
  pieces.push({ z: 0, g: { type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx: mid[0], cy: mid[1], rx, ry, mat: coat, shade: 'normal' },
    { type: 'ellipse', name: 'belly', cx: mid[0], cy: mid[1] + ry * 0.55, rx: rx * 0.65, ry: ry * 0.3, mat: coat, shade: 'flat', band: 0 },
  ] } });
  const nose = pose.at('head', 0.6, 0, 0, -headR * 0.2), sn = side > 0.5 ? pose.at('head', 0.6, snout * 0.3, 0, -headR * 0.15) : pose.at('head', 0.5, headR * 0.2, 0, -headR * 0.55);
  pieces.push({ z: pose.depth('head') + 0.01, g: { type: 'group', name: 'head', underlay: true, children: [
    ...(P.ears ? [-1, 1].map(k => { const e = pose.at('head', 0.2, 0, k * headR * 0.6, headR * 0.5); return { type: 'path', name: 'ear', d: `M${e[0]} ${e[1]} L${e[0] + k * headR * 0.3} ${e[1] - headR} L${e[0] - k * headR * 0.45} ${e[1] - headR * 0.25} Z`, mat: coat, shade: 'flat', band: 2 }; }) : []),
    { type: 'circle', name: 'skull', cx: skull[0], cy: skull[1], r: headR, mat: coat, shade: 'sphere' },
    ...(side > 0.5 ? [{ type: 'ellipse', name: 'snout', cx: sn[0], cy: sn[1], rx: snout / 2 + headR * 0.35, ry: headR * 0.5, mat: coat, shade: 'normal' }]
      : showFace ? [{ type: 'ellipse', name: 'snout', cx: sn[0], cy: sn[1], rx: headR * 0.55, ry: headR * 0.45, mat: coat, shade: 'normal' }] : []),
  ] } });
  for (const p of pieces.sort((a, b) => a.z - b.z)) s.add(p.g);
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: eyeY, w: 1, h: Math.max(1, Math.round(X(1.5))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).add('groundShadow', {}).render();
}

// Named points per frame: `ground` (where it stands — the export anchor for depth sorting), `head` (effects, bites),
// and the face anchors the finishing pass paints at (only on facings that show the face).
export const anchors = ctx => {
  const L = layout(ctx), a = { ...L.rig.anchors(L.P), head: L.skull.map(Math.round) };
  delete a.tail;
  a.hand = a.head;
  if (L.front > -0.6) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.6) a.mouth = L.mouth;
  return a;
};
