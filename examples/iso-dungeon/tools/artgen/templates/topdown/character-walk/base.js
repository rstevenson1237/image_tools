// {{ID}} base.v1 (r1) — template: humanoid with facings and a walk cycle (3/4 top-down camera). Facings s, se, e,
// ne, n are drawn here; the engine mirrors the west ones. `yaw` turns the figure (0 = facing the viewer, 90 = east,
// 180 = back): the face slides toward the facing side and disappears from behind, the body narrows in profile.
// The walk swings the legs (and the free arm) over ctx.t with a 1 px bob on the passing frames. Adapt it to the brief:
// silhouette first, then costume, gear and face; keep every size relative to ctx.size and colours to role ramps (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template walker' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather', 'accent'], default: 'cloth' },
  item: { type: 'choice', options: ['blade', 'staff', 'none'], default: 'blade' },
  hood: { type: 'toggle', default: false, p: 0.35 },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

// Geometry shared by render() and anchors() (facing, walk phase and bob included), so the face and hand anchors sit
// exactly on the drawn pixels in every cell.
function layout(ctx) {
  const [w, h] = ctx.size, yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32;
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0;
  const bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  const top = h * 0.06 + bob, headH = h * hr * 0.92, headW = Math.min(w * 0.62, headH * 1.2) * (1 - 0.12 * side);
  const neck = top + headH * 0.92, foot = h * 0.95, legH = (foot - neck - bob) * 0.32, hip = foot - legH + bob;
  const bodyW = Math.max(X(8), headW * 0.82) * (1 - 0.3 * side);
  const profile = side > 0.9, legW = bodyW * (profile ? 0.42 : 0.3);
  const hand = cx + (profile ? sx * (headW / 2 + X(1.5)) : -(bodyW / 2 + X(3)) * front);
  const fx = sx * headW * 0.24, fw = headW * (0.72 - 0.3 * side);
  // the face is seen from the front and in profile, not from behind; eyes on whole pixels (the finish repaints them)
  const showFace = front > -0.3, ey = Math.round(top + headH * 0.52), eh = Math.max(1, Math.round(X(2)));
  const eyes = !showFace ? [] : (profile ? [cx + fx + fw * 0.15] : [cx + fx - fw * 0.28, cx + fx + fw * 0.2]).map(Math.round);
  const mouth = showFace ? [Math.round(profile ? cx + fx + Math.sign(sx) * fw * 0.3 : cx + fx - 0.5), ey + eh] : null;
  return { w, h, sx, front, side, cx, X, swing, top, headH, headW, neck, foot, legH, hip, bodyW, profile, legW, hand, fx, fw, showFace, eyes, ey, eh, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size);
  const { sx, front, cx, X, swing, top, headH, headW, neck, foot, legH, hip, bodyW, profile, legW, hand, fx, fw, showFace, eyes, ey, eh } = layout(ctx), cloth = pal[P.cloth];
  // legs: side-by-side lift facing the viewer or away; a stride in profile
  const legs = profile
    ? [-1, 1].map(k => ({ type: 'rect', x: cx - legW / 2 + k * swing * X(2.5), y: hip - 0.5, w: legW, h: legH + 0.5 - (k * swing > 0.3 ? 1 : 0) }))
    : [-1, 1].map(k => ({ type: 'rect', x: cx + (k < 0 ? -bodyW * 0.36 : bodyW * 0.06) + sx * X(1), y: hip - 0.5, w: legW, h: legH + 0.5 - (k * swing > 0.3 ? 1 : 0) }));
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: legs });
  const item = () => {
    if (P.item === 'blade') s.add({ type: 'group', name: 'blade', underlay: true, children: [
      { type: 'path', d: `M${hand - X(1)} ${hip} V${neck - X(4)} L${hand} ${neck - X(6)} L${hand + X(1)} ${neck - X(4)} V${hip} Z`, mat: pal.metal, shade: 'bevel' },
      { type: 'rect', x: hand - X(2.5), y: hip, w: X(5), h: Math.max(1, X(1.4)), mat: pal.accent, shade: 'flat', band: 1 },
    ] });
    else if (P.item === 'staff') s.add({ type: 'group', name: 'staff', underlay: true, children: [
      { type: 'rect', x: hand - X(0.75), y: top + X(2), w: Math.max(1, X(1.5)), h: foot - top - X(3), mat: pal.wood, shade: 'cyl', axis: 'y' },
      { type: 'circle', cx: hand, cy: top + X(2), r: Math.max(1, X(2)), mat: pal.glow, shade: 'sphere' },
    ] });
  };
  if (front < -0.2) item(); // carried in front of the body: hidden behind it from the back
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'torso', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + bodyW / 2 + X(1)} ${hip + X(1)} H${cx - bodyW / 2 - X(1)} Z`, mat: cloth, shade: 'normal', round: X(3) },
    { type: 'rect', name: 'belt', x: cx - bodyW / 2 - X(0.5), y: hip - X(2), w: bodyW + X(1), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
    ...(front > 0.2 ? [{ type: 'rect', name: 'buckle', x: cx - X(1) + sx * bodyW * 0.3, y: hip - X(2), w: X(2), h: Math.max(1, X(1.2)), mat: pal.accent, shade: 'flat', band: 0 }] : []),
  ] });
  // arms: both sides facing the viewer or away, the near arm swinging in profile
  const armX = cx - bodyW / 2 - X(1), arm = (dx, sw) => ({ type: 'group', name: 'arm', underlay: true, children: [
    { type: 'capsule', a: [armX + dx, neck + X(2)], b: [armX + dx - X(1) + sw, hip - X(1)], r: Math.max(1, X(1.6)), mat: cloth, shade: 'cyl' },
    { type: 'circle', cx: armX + dx - X(1) + sw, cy: hip, r: Math.max(0.8, X(1.4)), mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  if (profile) s.add(arm(bodyW / 2 + X(1), -swing * X(2) * Math.sign(sx)));
  else s.add({ ...arm(0, 0), mirrorX: cx });
  const hy = top;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hair', cx, cy: hy + headH * 0.48, rx: headW / 2, ry: headH * 0.5, mat: pal.hair, shade: 'sphere' },
    ...(showFace ? [{ type: 'path', name: 'face', d: `M${cx + fx - fw / 2} ${hy + headH * 0.45} Q${cx + fx} ${hy + headH * 0.25} ${cx + fx + fw / 2} ${hy + headH * 0.45} V${hy + headH * 0.72} Q${cx + fx} ${hy + headH * 1.02} ${cx + fx - fw / 2} ${hy + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) }] : []),
    ...(P.hood ? [{ type: 'ellipse', name: 'hood', cx: cx - fx * 0.5, cy: hy + headH * 0.42, rx: headW / 2 + X(1), ry: headH * 0.48, mat: cloth, shade: 'sphere' }] : []),
  ] });
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: ey, w: 1, h: eh, color: 'outline' });
  if (front >= -0.2) item();
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).render();
}

// Named points per frame: the finishing pass paints the face at eye/eye2/mouth (only where the face is visible);
// `hand` is exported in pack.json so effects and held props follow it in game (sprite.anchor('hand')).
export const anchors = ctx => {
  const L = layout(ctx), a = { head: [Math.round(L.cx + L.sx * L.w * 0.08), Math.round(L.top + L.headH * 0.5)], hand: [Math.round(L.hand), Math.round(L.hip)] };
  L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.ey]; });
  if (L.mouth) a.mouth = L.mouth;
  return a;
};
