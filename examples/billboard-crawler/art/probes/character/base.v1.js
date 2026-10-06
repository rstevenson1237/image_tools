// probe-character base.v1 (r1) — template: front-facing humanoid (head, torso, arms, legs, one held item).
// Adapt it to the brief: silhouette first (what reads at 1x?), then costume, gear and face. Coordinates are
// fractions of ctx.size so the same file renders at 16, 24 or 32 px; the head size follows
// direction.scale.proportions.headRatio. Colours come from role ramps only (R11).
export const meta = { brief: 'probe-character', pass: 'r1', notes: 'template humanoid' };

export const params = {
  cloth: { type: 'swap', options: ['cloth', 'leather', 'accent'], default: 'cloth' },
  item: { type: 'choice', options: ['blade', 'staff', 'none'], default: 'blade' },
  hood: { type: 'toggle', default: false, p: 0.35 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32;
  const top = h * 0.06, headH = h * hr * 0.92, headW = Math.min(w * 0.62, headH * 1.2);
  const neck = top + headH * 0.92, foot = h * 0.95, legH = (foot - neck) * 0.32, hip = foot - legH;
  const bodyW = Math.max(X(10), headW * 0.82), cloth = pal[P.cloth];
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: cx - bodyW * 0.36, y: hip - 0.5, w: bodyW * 0.3, h: legH + 0.5 },
    { type: 'rect', x: cx + bodyW * 0.06, y: hip - 0.5, w: bodyW * 0.3, h: legH + 0.5 },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'torso', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + bodyW / 2 + X(1)} ${hip + X(1)} H${cx - bodyW / 2 - X(1)} Z`, mat: cloth, shade: 'normal', round: X(3) },
    { type: 'rect', name: 'belt', x: cx - bodyW / 2 - X(0.5), y: hip - X(2), w: bodyW + X(1), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
    { type: 'rect', name: 'buckle', x: cx - X(1), y: hip - X(2), w: X(2), h: Math.max(1, X(1.2)), mat: pal.accent, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: cx, children: [
    { type: 'capsule', a: [cx - bodyW / 2 - X(1), neck + X(2)], b: [cx - bodyW / 2 - X(2), hip - X(1)], r: Math.max(1, X(1.6)), mat: cloth, shade: 'cyl' },
    { type: 'circle', cx: cx - bodyW / 2 - X(2), cy: hip, r: Math.max(0.8, X(1.4)), mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  const hx = cx - headW / 2, hy = top;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hair', cx, cy: hy + headH * 0.48, rx: headW / 2, ry: headH * 0.5, mat: pal.hair, shade: 'sphere' },
    { type: 'path', name: 'face', d: `M${hx + headW * 0.14} ${hy + headH * 0.45} Q${cx} ${hy + headH * 0.25} ${hx + headW * 0.86} ${hy + headH * 0.45} V${hy + headH * 0.72} Q${cx} ${hy + headH * 1.02} ${hx + headW * 0.14} ${hy + headH * 0.72} Z`, mat: pal.skin, shade: 'normal', round: X(2) },
    ...(P.hood ? [{ type: 'path', name: 'hood', d: `M${hx - X(1)} ${hy + headH * 0.75} Q${hx - X(1)} ${hy - X(1)} ${cx} ${hy - X(1)} Q${hx + headW + X(1)} ${hy - X(1)} ${hx + headW + X(1)} ${hy + headH * 0.75} L${hx + headW * 0.86} ${hy + headH * 0.45} Q${cx} ${hy + headH * 0.2} ${hx + headW * 0.14} ${hy + headH * 0.45} Z`, mat: cloth, shade: 'sphere' }] : []),
  ] });
  s.add({ type: 'rect', name: 'eye', x: cx - headW * 0.22, y: hy + headH * 0.52, w: 1, h: Math.max(1, X(2)), color: 'outline', mirrorX: cx });
  // facing the viewer, the right hand is on the viewer's left — the lit side for the usual upper-left light
  const hand = cx - bodyW / 2 - X(3);
  if (P.item === 'blade') s.add({ type: 'group', name: 'blade', underlay: true, children: [
    { type: 'path', d: `M${hand - X(1)} ${hip} V${neck - X(4)} L${hand} ${neck - X(6)} L${hand + X(1)} ${neck - X(4)} V${hip} Z`, mat: pal.metal, shade: 'bevel' },
    { type: 'rect', x: hand - X(2.5), y: hip, w: X(5), h: Math.max(1, X(1.4)), mat: pal.accent, shade: 'flat', band: 1 },
  ] });
  else if (P.item === 'staff') s.add({ type: 'group', name: 'staff', underlay: true, children: [
    { type: 'rect', x: hand - X(0.75), y: top + X(2), w: Math.max(1, X(1.5)), h: foot - top - X(3), mat: pal.wood, shade: 'cyl', axis: 'y' },
    { type: 'circle', cx: hand, cy: top + X(2), r: Math.max(1, X(2)), mat: pal.glow, shade: 'sphere' },
  ] });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).render();
}

export const anchors = ctx => ({ head: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.06 + ctx.size[1] * (ctx.dir.scale.proportions?.headRatio ?? 0.4) * 0.5)] });
