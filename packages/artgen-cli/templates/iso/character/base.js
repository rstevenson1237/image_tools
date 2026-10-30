// {{ID}} base.v1 (r1) — template: iso humanoid — a front-facing 2D sprite standing on a 2:1 ground shadow (the iso hero approach; use 3D mode when every facing must come from one model).
// (`ctx.lib.rigs.body`: idle breath, `attack` swings the right arm, `hurt` recoils).
// Adapt it to the brief: silhouette first (what reads at 1x?), then costume, gear and face. Coordinates are
// fractions of ctx.size so the same file renders at 16, 24 or 32 px; the head size follows
// direction.scale.proportions.headRatio. Colours come from role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template humanoid' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather', 'accent'], default: 'cloth' },
  item: { type: 'choice', options: ['blade', 'staff', 'none'], default: 'blade' },
  hood: { type: 'toggle', default: false, p: 0.35 },
};

// Geometry shared by render() and anchors(), so the face and hand anchors sit exactly on the drawn pixels.
function layout(ctx) {
  const [w, h] = ctx.size, X = v => (v * w) / 32, hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, ground = Math.round(h * 0.95);
  const rig = ctx.lib.rigs.body('biped', ctx, { ground, height: ground - Math.round(h * 0.06), proportions: { head: hr * 0.951 } });
  const P = rig.pose(ctx.state, ctx.t), headH = rig.lengths.head / 0.92, headW = Math.min(w * 0.62, headH * 1.2), bodyW = Math.max(X(10), headW * 0.82);
  const cx = P.at('head', 0.5)[0], top = P.end('head')[1];
  // eyes on whole pixels (the finishing pass repaints them at the face anchors), mirrored about the centre; the mouth
  // anchor is the skin row right under them (lower rows are the face's shaded edge)
  const ex = Math.round(cx - headW * 0.22), ey = Math.round(top + headH * 0.52), eh = Math.max(1, Math.round(X(2)));
  // facing the viewer, the right hand is on the viewer's left — the lit side for the usual upper-left light
  return { w, h, X, rig, P, cx, top, headH, headW, bodyW, ground, hand: P.end('armR_lo'), eyes: [ex, w - 1 - ex], ey, eh, mouth: [(w - 1) >> 1, ey + eh] };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), cloth = pal[P.cloth];
  const { X, P: pose, cx, top, headH, headW, bodyW, ground, hand, eyes, ey, eh } = L, neck = pose.start('neck'), hip = pose.start('spine');
  const cap = (n, r, mat) => ({ type: 'capsule', a: pose.start(n), b: pose.end(n), r, mat, shade: 'cyl' });
  s.add({ type: 'group', name: 'legs', underlay: true, children: ['L', 'R'].flatMap(k => [cap(`leg${k}_up`, bodyW * 0.15, pal.leather), cap(`leg${k}_lo`, bodyW * 0.15, pal.leather)]) });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'torso', d: `M${neck[0] - bodyW / 2} ${neck[1]} H${neck[0] + bodyW / 2} L${hip[0] + bodyW / 2 + X(1)} ${hip[1] + X(1)} H${hip[0] - bodyW / 2 - X(1)} Z`, mat: cloth, shade: 'normal', round: X(3) },
    { type: 'rect', name: 'belt', x: hip[0] - bodyW / 2 - X(0.5), y: hip[1] - X(2), w: bodyW + X(1), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
    { type: 'rect', name: 'buckle', x: hip[0] - X(1), y: hip[1] - X(2), w: X(2), h: Math.max(1, X(1.2)), mat: pal.accent, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'arm', underlay: true, children: ['L', 'R'].flatMap(k => [cap(`arm${k}_up`, Math.max(1, X(1.6)), cloth), cap(`arm${k}_lo`, Math.max(1, X(1.6)), cloth), { type: 'circle', cx: pose.end(`arm${k}_lo`)[0], cy: pose.end(`arm${k}_lo`)[1], r: Math.max(0.8, X(1.4)), mat: pal.skin, shade: 'flat', band: 0 }]) });
  const hx = cx - headW / 2, hy = top;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hair', cx, cy: hy + headH * 0.48, rx: headW / 2, ry: headH * 0.5, mat: pal.hair, shade: 'sphere' },
    { type: 'path', name: 'face', d: `M${hx + headW * 0.14} ${hy + headH * 0.45} Q${cx} ${hy + headH * 0.25} ${hx + headW * 0.86} ${hy + headH * 0.45} V${hy + headH * 0.72} Q${cx} ${hy + headH * 1.02} ${hx + headW * 0.14} ${hy + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) },
    ...(P.hood ? [{ type: 'path', name: 'hood', d: `M${hx - X(1)} ${hy + headH * 0.75} Q${hx - X(1)} ${hy - X(1)} ${cx} ${hy - X(1)} Q${hx + headW + X(1)} ${hy - X(1)} ${hx + headW + X(1)} ${hy + headH * 0.75} L${hx + headW * 0.86} ${hy + headH * 0.45} Q${cx} ${hy + headH * 0.2} ${hx + headW * 0.14} ${hy + headH * 0.45} Z`, mat: cloth, shade: 'sphere' }] : []),
  ] });
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: ey, w: 1, h: eh, color: 'outline' });
  if (P.item === 'blade') {
    // the blade turns with the hand
    const a = pose.angles.armR_up - 180 + pose.angles.armR_lo + pose.angles.spine, k = (180 - (ctx.state === 'walk' || ctx.state === 'idle' ? 0 : 0.4 * a)) * Math.PI / 180, len = X(15), tip = pose.at('armR_lo', 1, len * Math.sin(k), 0, -len * Math.cos(k));
    const dx = tip[0] - hand[0], dy = tip[1] - hand[1], l = Math.hypot(dx, dy) || 1, d = [dx / l, dy / l], n = [-d[1], d[0]], hw = X(1.1), gw = X(2.5), g = Math.max(1, X(1.4));
    const at = (u, m) => `${hand[0] + d[0] * u + n[0] * m} ${hand[1] + d[1] * u + n[1] * m}`;
    s.add({ type: 'group', name: 'blade', underlay: true, children: [
      { type: 'path', d: `M${at(0, -hw)} L${at(l - X(3), -hw)} L${at(l, 0)} L${at(l - X(3), hw)} L${at(0, hw)} Z`, mat: pal.metal, shade: 'bevel' },
      { type: 'path', d: `M${at(0, -gw)} L${at(g, -gw)} L${at(g, gw)} L${at(0, gw)} Z`, mat: pal.accent, shade: 'flat', band: 1 },
    ] });
  } else if (P.item === 'staff') s.add({ type: 'group', name: 'staff', underlay: true, children: [
    { type: 'rect', x: hand[0] - X(0.75), y: top + X(2), w: Math.max(1, X(1.5)), h: ground - top - X(3), mat: pal.wood, shade: 'cyl', axis: 'y' },
    { type: 'circle', cx: hand[0], cy: top + X(2), r: Math.max(1, X(2)), mat: pal.glow, shade: 'sphere' },
  ] });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).add('groundShadow', {}).render();
}

// Named points per frame: the finishing pass paints the face at eye/eye2/mouth; `hand` is exported in pack.json so
// effects and held props attach to it in game (sprite.anchor('hand')).
export const anchors = ctx => {
  const L = layout(ctx), a = L.rig.anchors(L.P);
  return { head: [L.w >> 1, Math.round(L.top + L.headH * 0.5)], eye: [L.eyes[0], L.ey], eye2: [L.eyes[1], L.ey], mouth: L.mouth, hand: a.hand };
};
