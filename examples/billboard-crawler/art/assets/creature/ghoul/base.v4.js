// ghoul base.v4 (u1) — user feedback on base.v3 ("the head is a plain dome — a gaunt face: sunken cheeks, a jaw that
// hangs open"): a longer jaw below the skull, dark cheek hollows either side, an open mouth slot with a lit chin under it.
// v3: v2 with amber eye-points (accent.1; accent.0 was as pale as the skin) under a dark brow.
// v2: v1 with a small head sunk between raised shoulders (the direction's headRatio made a bulb), wider
// hunched shoulders, a torn gown hem and 2px eye-points. v1: from the walker template, as an 8-direction billboard: a hunched ghoul — head pushed low and
// forward between the shoulders, torn hospital gown (cloth), pale bony arms hanging past the knees with claws,
// glowing eye-points (accent.0) that read in a dark corridor. No held item. Template notes: humanoid with facings and a walk cycle (3/4 top-down camera). Facings s, se, e,
// ne, n are drawn here; the engine mirrors the west ones. `yaw` turns the figure (0 = facing the viewer, 90 = east,
// 180 = back): the face slides toward the facing side and disappears from behind, the body narrows in profile.
// The walk swings the legs (and the free arm) over ctx.t with a 1 px bob on the passing frames. Adapt it to the brief:
// silhouette first, then costume, gear and face; keep every size relative to ctx.size and colours to role ramps (R11).
export const meta = { brief: 'ghoul', pass: 'u1', notes: 'hunched ghoul billboard: gown, long arms, eye-points' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather'], default: 'cloth' },
  item: { type: 'choice', options: ['none'], default: 'none' },
  hood: { type: 'toggle', default: false, p: 0 },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32;
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0;
  const bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  const top = h * 0.2 + bob, headH = h * hr * 0.55, headW = Math.min(w * 0.62, headH * 1.2) * (1 - 0.12 * side);
  const neck = top + headH * 0.92, foot = h * 0.95, legH = (foot - neck - bob) * 0.32, hip = foot - legH + bob;
  const bodyW = Math.max(X(12), headW * 1.5) * (1 - 0.3 * side), cloth = pal[P.cloth];
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
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'torso', d: `M${cx - bodyW / 2} ${neck - X(2)} Q${cx} ${neck - X(4)} ${cx + bodyW / 2} ${neck - X(2)} L${cx + bodyW / 2 - X(1)} ${hip + X(2)} L${cx + X(2)} ${hip + X(0.5)} L${cx} ${hip + X(2.5)} L${cx - X(2)} ${hip + X(0.5)} L${cx - bodyW / 2 + X(1)} ${hip + X(2)} Z`, mat: cloth, shade: 'normal', round: X(3) },
    { type: 'rect', name: 'belt', x: cx - bodyW / 2 - X(0.5), y: hip - X(2), w: bodyW + X(1), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
    ...(front > 0.2 ? [{ type: 'rect', name: 'buckle', x: cx - X(1) + sx * bodyW * 0.3, y: hip - X(2), w: X(2), h: Math.max(1, X(1.2)), mat: pal.accent, shade: 'flat', band: 0 }] : []),
  ] });
  // arms: both sides facing the viewer or away, the near arm swinging in profile
  const armX = cx - bodyW / 2 - X(1), arm = (dx, sw) => ({ type: 'group', name: 'arm', underlay: true, children: [
    { type: 'capsule', a: [armX + dx, neck + X(1)], b: [armX + dx - X(1.5) + sw, hip + X(4)], r: Math.max(1, X(1.2)), mat: pal.skin, shade: 'cyl' },
    { type: 'path', name: 'claw', d: `M${armX + dx - X(3) + sw} ${hip + X(4)} L${armX + dx - X(3.5) + sw} ${hip + X(7)} L${armX + dx - X(1.5) + sw} ${hip + X(5)} L${armX + dx + sw} ${hip + X(7)} L${armX + dx + sw} ${hip + X(4)} Z`, mat: pal.skin, shade: 'flat', band: 1 },
  ] });
  if (profile) s.add(arm(bodyW / 2 + X(1), -swing * X(2) * Math.sign(sx)));
  else s.add({ ...arm(0, 0), mirrorX: cx });
  const hx = cx - headW / 2, hy = top, fx = sx * headW * 0.24, fw = headW * (0.72 - 0.3 * side);
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'scalp', cx, cy: hy + headH * 0.48, rx: headW / 2, ry: headH * 0.5, mat: pal.skin, shade: 'sphere' },
    { type: 'path', name: 'hair', d: `M${cx - headW / 2} ${hy + headH * 0.5} Q${cx} ${hy - headH * 0.1} ${cx + headW / 2} ${hy + headH * 0.5} L${cx + headW * 0.3} ${hy + headH * 0.25} L${cx} ${hy + headH * 0.35} L${cx - headW * 0.3} ${hy + headH * 0.2} Z`, mat: pal.hair, shade: 'flat', band: 1 },
    ...(front > -0.3 ? [{ type: 'path', name: 'face', d: `M${cx + fx - fw / 2} ${hy + headH * 0.45} Q${cx + fx} ${hy + headH * 0.25} ${cx + fx + fw / 2} ${hy + headH * 0.45} V${hy + headH * 0.72} Q${cx + fx} ${hy + headH * 1.02} ${cx + fx - fw / 2} ${hy + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) }] : []),
    ...(P.hood ? [{ type: 'ellipse', name: 'hood', cx: cx - fx * 0.5, cy: hy + headH * 0.42, rx: headW / 2 + X(1), ry: headH * 0.48, mat: cloth, shade: 'sphere' }] : []),
  ] });
  if (front > -0.3) {
    const eyes = profile ? [cx + fx + fw * 0.15] : [cx + fx - fw * 0.28, cx + fx + fw * 0.2];
    // gaunt face: jaw hanging below the dome, hollow cheeks, open mouth
    const jy = Math.round(hy + headH * 0.75);
    s.add({ type: 'rect', name: 'jaw', x: cx + fx - fw * 0.35, y: jy, w: fw * 0.7, h: Math.max(3, Math.round(headH * 0.45)), r: 1, mat: pal.skin, shade: 'flat', band: 1, underlay: true });
    s.add({ type: 'rect', name: 'mouth', x: Math.round(cx + fx - fw * 0.18), y: jy + 1, w: Math.max(2, Math.round(fw * 0.36)), h: Math.max(2, Math.round(headH * 0.25)), color: 'outline' });
    if (!profile) for (const k of [-1, 1]) s.add({ type: 'rect', name: 'cheek', x: Math.round(cx + fx + k * fw * 0.38 - 0.5), y: jy - 1, w: 1, h: 2, mat: pal.skin, shade: 'flat', band: 2 });
    s.add({ type: 'rect', name: 'brow', x: cx + fx - fw / 2, y: Math.round(hy + headH * 0.55) - 1, w: fw, h: 1, mat: pal.hair, shade: 'flat', band: 2 });
    for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: Math.round(ex), y: Math.round(hy + headH * 0.55), w: 2, h: Math.max(1, Math.round(X(1.2))), mat: pal.accent, shade: 'flat', band: 1 });
  }
  if (front >= -0.2) item();
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).render();
}

export const anchors = ctx => {
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, [w, h] = ctx.size;
  return { head: [Math.round(w / 2 + Math.sin(yaw) * w * 0.08), Math.round(h * 0.06 + h * hr * 0.5)] };
};
