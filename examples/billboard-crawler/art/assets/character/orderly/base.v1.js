// orderly base.v1 (r1) — from the humanoid template, as the front billboard: a sleepwalking orderly. Pale coat (skin
// ramp: the palette's whites), dark trousers, both arms raised straight toward the viewer (foreshortened: forearms
// and hands at chest height), head tilted to one side, eyes closed as two dark dashes.
export const meta = { brief: 'orderly', pass: 'r1', notes: 'pale coat, arms out, tilted head, closed eyes' };

export const params = {
  tilt: { type: 'range', min: -2, max: 2, default: 1.5 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), cx = w / 2, X = v => (v * w) / 32;
  const top = h * 0.08, headW = X(9), headH = X(9), neck = top + headH, hip = h * 0.66, foot = h * 0.96, bodyW = X(12);
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.cloth, shade: 'flat', band: 2, children: [
    { type: 'rect', x: cx - X(4.5), y: hip, w: X(3.5), h: foot - hip },
    { type: 'rect', x: cx + X(1), y: hip, w: X(3.5), h: foot - hip },
  ] });
  s.add({ type: 'path', name: 'coat', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + bodyW / 2 + X(1)} ${hip + X(2)} H${cx - bodyW / 2 - X(1)} Z`, mat: pal.skin, shade: 'linear', round: X(2), underlay: true });
  s.add({ type: 'rect', name: 'placket', x: cx - 0.5, y: neck + X(1), w: 1, h: hip - neck, mat: pal.skin, shade: 'flat', band: 1 });
  // arms reaching at the viewer: upper arms out from the shoulders, forearms + hands foreshortened at chest height
  for (const k of [-1, 1]) s.add({ type: 'group', name: 'arm', underlay: true, children: [
    { type: 'capsule', a: [cx + k * (bodyW / 2 - X(1)), neck + X(2)], b: [cx + k * (bodyW / 2 + X(1)), neck + X(5)], r: X(1.8), mat: pal.skin, shade: 'cyl' },
    { type: 'circle', cx: cx + k * (bodyW / 2 + X(1)), cy: neck + X(5.5), r: X(1.9), mat: pal.skin, shade: 'flat', band: 1 },
  ] });
  const hx = cx + P.tilt;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'face', cx: hx, cy: top + headH / 2, rx: headW / 2, ry: headH / 2, mat: pal.skin, shade: 'sphere' },
    { type: 'path', name: 'hair', d: `M${hx - headW / 2} ${top + headH * 0.45} Q${hx} ${top - X(1)} ${hx + headW / 2} ${top + headH * 0.45} L${hx + headW * 0.3} ${top + headH * 0.25} H${hx - headW * 0.3} Z`, mat: pal.hair, shade: 'flat', band: 1 },
  ] });
  for (const dx of [-2, 1.5]) s.add({ type: 'rect', name: 'eye', x: Math.round(hx + X(dx)), y: Math.round(top + headH * 0.55), w: Math.max(1, Math.round(X(1.5))), h: 1, color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'coat', amount: 0.15 }).render();
}

export const anchors = ctx => ({ head: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.2)] });
