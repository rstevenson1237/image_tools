// hero base.v1 (r1) — from the walker template: the party's knight. Kettle helm (metal) with a brim instead of hair,
// blue-grey tabard (cloth) over mail, sword on the lit side, a kite shield on the off arm (behind the body when it
// faces away from the viewer's side), ground shadow for the iso floor. Template notes: humanoid with facings and a walk cycle (3/4 top-down camera). Facings s, se, e,
// ne, n are drawn here; the engine mirrors the west ones. `yaw` turns the figure (0 = facing the viewer, 90 = east,
// 180 = back): the face slides toward the facing side and disappears from behind, the body narrows in profile.
// The walk swings the legs (and the free arm) over ctx.t with a 1 px bob on the passing frames. Adapt it to the brief:
// silhouette first, then costume, gear and face; keep every size relative to ctx.size and colours to role ramps (R11).
export const meta = { brief: 'hero', pass: 'r1', notes: 'knight: kettle helm, tabard, sword, kite shield' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather', 'accent'], default: 'cloth' },
  item: { type: 'choice', options: ['blade', 'none'], default: 'blade' },
  hood: { type: 'toggle', default: false, p: 0 },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32;
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0;
  const bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  const top = h * 0.06 + bob, headH = h * hr * 0.92, headW = Math.min(w * 0.62, headH * 1.2) * (1 - 0.12 * side);
  const neck = top + headH * 0.92, foot = h * 0.95, legH = (foot - neck - bob) * 0.32, hip = foot - legH + bob;
  const bodyW = Math.max(X(8), headW * 0.82) * (1 - 0.3 * side), cloth = pal[P.cloth];
  const profile = side > 0.9, legW = bodyW * (profile ? 0.42 : 0.3);
  // legs: side-by-side lift facing the viewer or away; a stride in profile
  const legs = profile
    ? [-1, 1].map(k => ({ type: 'rect', x: cx - legW / 2 + k * swing * X(2.5), y: hip - 0.5, w: legW, h: legH + 0.5 - (k * swing > 0.3 ? 1 : 0) }))
    : [-1, 1].map(k => ({ type: 'rect', x: cx + (k < 0 ? -bodyW * 0.36 : bodyW * 0.06) + sx * X(1), y: hip - 0.5, w: legW, h: legH + 0.5 - (k * swing > 0.3 ? 1 : 0) }));
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: legs });
  const hand = cx + (profile ? sx * (headW / 2 + X(1.5)) : -(bodyW / 2 + X(3)) * front);
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
  // kite shield on the off arm: viewer's right facing the viewer, the far side in profile
  const shX = cx + (profile ? -sx * bodyW * 0.15 : (bodyW / 2 + X(1.5)) * front), shY = neck + X(1);
  const shield = () => s.add({ type: 'path', name: 'shield', d: `M${shX - X(3)} ${shY} H${shX + X(3)} V${shY + X(5)} L${shX} ${shY + X(10)} L${shX - X(3)} ${shY + X(5)} Z`, mat: pal.metal, shade: 'bevel', underlay: true });
  const shieldFront = !profile && front > 0.2;
  if (!shieldFront) shield();
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
  const hx = cx - headW / 2, hy = top, fx = sx * headW * 0.24, fw = headW * (0.72 - 0.3 * side);
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'helm', cx, cy: hy + headH * 0.42, rx: headW / 2, ry: headH * 0.46, mat: pal.metal, shade: 'sphere' },
    { type: 'rect', name: 'brim', x: cx - headW / 2 - X(1), y: hy + headH * 0.42, w: headW + X(2), h: Math.max(1, X(1.3)), mat: pal.metal, shade: 'flat', band: 1 },
    ...(front > -0.3 ? [{ type: 'path', name: 'face', d: `M${cx + fx - fw / 2} ${hy + headH * 0.45} Q${cx + fx} ${hy + headH * 0.25} ${cx + fx + fw / 2} ${hy + headH * 0.45} V${hy + headH * 0.72} Q${cx + fx} ${hy + headH * 1.02} ${cx + fx - fw / 2} ${hy + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) }] : []),
    ...(P.hood ? [{ type: 'ellipse', name: 'hood', cx: cx - fx * 0.5, cy: hy + headH * 0.42, rx: headW / 2 + X(1), ry: headH * 0.48, mat: cloth, shade: 'sphere' }] : []),
  ] });
  if (front > -0.3) {
    const eyes = profile ? [cx + fx + fw * 0.15] : [cx + fx - fw * 0.28, cx + fx + fw * 0.2];
    for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: Math.round(ex), y: hy + headH * 0.52, w: 1, h: Math.max(1, X(2)), color: 'outline' });
  }
  if (front >= -0.2) item();
  if (shieldFront) { shield(); s.add({ type: 'rect', name: 'boss', x: shX - X(1), y: shY + X(3), w: X(2), h: X(2), mat: pal.accent, shade: 'flat', band: 1 }); }
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).add('groundShadow', {}).render();
}

export const anchors = ctx => {
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, [w, h] = ctx.size;
  return { head: [Math.round(w / 2 + Math.sin(yaw) * w * 0.08), Math.round(h * 0.06 + h * hr * 0.5)] };
};
