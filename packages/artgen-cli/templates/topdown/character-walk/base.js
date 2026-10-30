// {{ID}} base.v1 (r1) — template: humanoid with facings and a walk cycle (3/4 top-down camera), on the shared biped rig
// (`ctx.lib.rigs.body`). Facings s, se, e, ne, n are drawn here; the engine mirrors the west ones. The rig turns the figure
// (`yaw`: 0 = facing the viewer, 90 = east, 180 = back): the face slides toward the facing side and disappears from behind,
// the body narrows in profile. Its walk steps the feet on the ground with a 1 px bob on the contact frames and swings the
// arms against the legs; `attack` swings the right arm, `hurt` recoils. This file only dresses the skeleton: silhouette
// first, then costume, gear and face; keep every size relative to ctx.size and colours to role ramps (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template walker' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather', 'accent'], default: 'cloth' },
  item: { type: 'choice', options: ['blade', 'staff', 'none'], default: 'blade' },
  hood: { type: 'toggle', default: false, p: 0.35 },
};

// Geometry shared by render() and anchors(): the rig's pose for this state and phase, then head, face and hand on it, so the
// face and hand anchors sit exactly on the drawn pixels in every cell.
function layout(ctx) {
  const [w, h] = ctx.size, X = v => (v * w) / 32, hr = ctx.dir.scale.proportions?.headRatio ?? 0.4;
  const ground = Math.round(h * 0.95), rig = ctx.lib.rigs.body('biped', ctx, { ground, height: ground - Math.round(h * 0.06), proportions: { head: hr * 0.951 } });
  const { sx, front, side } = rig, P = rig.pose(ctx.state, ctx.t), headH = rig.lengths.head / 0.92;
  const headW = Math.min(w * 0.62, headH * 1.2) * (1 - 0.12 * side), bodyW = Math.max(X(8), headW * 0.82) * (1 - 0.3 * side);
  const profile = side > 0.9, hcx = P.at('head', 0.5)[0], top = P.end('head')[1], hand = P.end('armR_lo');
  const fx = sx * headW * 0.24, fw = headW * (0.72 - 0.3 * side);
  // the face is seen from the front and in profile, not from behind; eyes on whole pixels (the finish repaints them)
  const showFace = front > -0.3, ey = Math.round(top + headH * 0.52), eh = Math.max(1, Math.round(X(2)));
  const eyes = !showFace ? [] : (profile ? [hcx + fx + fw * 0.15] : [hcx + fx - fw * 0.28, hcx + fx + fw * 0.2]).map(Math.round);
  const mouth = showFace ? [profile ? eyes[0] : Math.round(hcx + fx - 0.5), ey + eh] : null;
  return { w, h, X, rig, P, sx, front, side, ground, headH, headW, bodyW, profile, hcx, top, hand, fx, fw, showFace, eyes, ey, eh, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), cloth = pal[P.cloth];
  const { X, P: pose, sx, front, ground, headH, headW, bodyW, profile, hcx, top, hand, fx, fw, showFace, eyes, ey, eh } = L;
  const neck = pose.start('neck'), hip = pose.start('spine');
  const limb = (a, b, r) => ({ type: 'capsule', a: pose.start(a), b: pose.end(b), r, mat: cloth, shade: 'cyl' });
  // legs, far side first: side by side facing the viewer or away, a stride in profile
  const legR = (profile ? 0.5 : 0.3) * bodyW / 2;
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: pose.far(['legL_up', 'legR_up']).flatMap(n => [{ ...limb(n, n, legR), mat: pal.leather }, { ...limb(n.replace('_up', '_lo'), n.replace('_up', '_lo'), legR), mat: pal.leather }]) });
  // the held item: a blade turns with the hand, a staff stands beside it
  const item = () => {
    if (P.item === 'blade') {
      const a = pose.angles.armR_up - 180 + pose.angles.armR_lo + pose.angles.spine, dir = (180 - (ctx.state === 'walk' || ctx.state === 'idle' ? 0 : 0.4 * a)) * Math.PI / 180, len = X(15);
      const tip = pose.at('armR_lo', 1, len * Math.sin(dir), 0, -len * Math.cos(dir)), dx = tip[0] - hand[0], dy = tip[1] - hand[1], l = Math.hypot(dx, dy) || 1, d = [dx / l, dy / l], n = [-d[1], d[0]], hw = X(1.1), gw = X(1.2 + 1.3 * Math.abs(front));
      const at = (k, m) => `${hand[0] + d[0] * k + n[0] * m} ${hand[1] + d[1] * k + n[1] * m}`;
      s.add({ type: 'group', name: 'blade', underlay: true, children: [
        { type: 'path', d: `M${at(0, -hw)} L${at(l - X(3), -hw)} L${at(l, 0)} L${at(l - X(3), hw)} L${at(0, hw)} Z`, mat: pal.metal, shade: 'bevel' },
        { type: 'path', d: `M${at(0, -gw)} L${at(Math.max(1, X(1.4)), -gw)} L${at(Math.max(1, X(1.4)), gw)} L${at(0, gw)} Z`, mat: pal.accent, shade: 'flat', band: 1 },
      ] });
    } else if (P.item === 'staff') s.add({ type: 'group', name: 'staff', underlay: true, children: [
      { type: 'rect', x: hand[0] - X(0.75), y: top + X(2), w: Math.max(1, X(1.5)), h: ground - top - X(3), mat: pal.wood, shade: 'cyl', axis: 'y' },
      { type: 'circle', cx: hand[0], cy: top + X(2), r: Math.max(1, X(2)), mat: pal.glow, shade: 'sphere' },
    ] });
  };
  if (front < -0.2) item(); // carried in front of the body: hidden behind it from the back
  const arm = n => ({ type: 'group', name: 'arm', underlay: true, children: [limb(`arm${n}_up`, `arm${n}_up`, Math.max(1, X(1.6))), limb(`arm${n}_lo`, `arm${n}_lo`, Math.max(1, X(1.6))), { type: 'circle', cx: pose.end(`arm${n}_lo`)[0], cy: pose.end(`arm${n}_lo`)[1], r: Math.max(0.8, X(1.4)), mat: pal.skin, shade: 'flat', band: 0 }] });
  const arms = pose.far(['armL_up', 'armR_up']).map(n => n[3]);
  if (profile) s.add(arm(arms[0]));
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'torso', d: `M${neck[0] - bodyW / 2} ${neck[1]} H${neck[0] + bodyW / 2} L${hip[0] + bodyW / 2 + X(1)} ${hip[1] + X(1)} H${hip[0] - bodyW / 2 - X(1)} Z`, mat: cloth, shade: 'normal', round: X(3) },
    { type: 'rect', name: 'belt', x: hip[0] - bodyW / 2 - X(0.5), y: hip[1] - X(2), w: bodyW + X(1), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
    ...(front > 0.2 ? [{ type: 'rect', name: 'buckle', x: hip[0] - X(1) + sx * bodyW * 0.3, y: hip[1] - X(2), w: X(2), h: Math.max(1, X(1.2)), mat: pal.accent, shade: 'flat', band: 0 }] : []),
  ] });
  // arms: both sides facing the viewer or away, the near arm swinging in profile; the hand closes over the item's grip
  if (front >= -0.2) item();
  s.add(arm(profile ? arms[1] : arms[0]));
  if (!profile) s.add(arm(arms[1]));
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hair', cx: hcx, cy: top + headH * 0.48, rx: headW / 2, ry: headH * 0.5, mat: pal.hair, shade: 'sphere' },
    ...(showFace ? [{ type: 'path', name: 'face', d: `M${hcx + fx - fw / 2} ${top + headH * 0.45} Q${hcx + fx} ${top + headH * 0.25} ${hcx + fx + fw / 2} ${top + headH * 0.45} V${top + headH * 0.72} Q${hcx + fx} ${top + headH * 1.02} ${hcx + fx - fw / 2} ${top + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) }] : []),
    ...(P.hood ? [{ type: 'ellipse', name: 'hood', cx: hcx - fx * 0.5, cy: top + headH * 0.42, rx: headW / 2 + X(1), ry: headH * 0.48, mat: cloth, shade: 'sphere' }] : []),
  ] });
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: ey, w: 1, h: eh, color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).render();
}

// Named points per frame: the finishing pass paints the face at eye/eye2/mouth (only where the face is visible);
// `hand` is exported in pack.json so effects and held props follow it in game (sprite.anchor('hand')).
export const anchors = ctx => {
  const L = layout(ctx), a = { ...L.rig.anchors(L.P), head: [Math.round(L.hcx + L.sx * L.w * 0.08), Math.round(L.top + L.headH * 0.5)] };
  delete a.ground;
  L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.ey]; });
  if (L.mouth) a.mouth = L.mouth;
  return a;
};
