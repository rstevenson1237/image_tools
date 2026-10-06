// orderly base.v3 (r3) — v2 with the reach redrawn: forearms point at the viewer, so they are short sleeve cuffs with
// big hands at shoulder height in front of the chest (v2's arms were ink lines). v2: v1 with the coat in the grey-white metal ramp (head, coat and hands were one skin blob), skin
// only on face and hands, a dark hair cap, a collar gap under the chin. v1: from the humanoid template, as the front billboard: a sleepwalking orderly. Pale coat (skin
// ramp: the palette's whites), dark trousers, both arms raised straight toward the viewer (foreshortened: forearms
// and hands at chest height), head tilted to one side, eyes closed as two dark dashes.
export const meta = { brief: 'orderly', pass: 'r3', notes: 'pale coat, arms out, tilted head, closed eyes' };

export const params = {
  tilt: { type: 'range', min: -2, max: 2, default: 1.5 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), cx = w / 2, X = v => (v * w) / 32;
  const top = h * 0.08, headW = X(9), headH = X(9), neck = top + headH + 1, hip = h * 0.66, foot = h * 0.96, bodyW = X(12);
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.cloth, shade: 'flat', band: 2, children: [
    { type: 'rect', x: cx - X(4.5), y: hip, w: X(3.5), h: foot - hip },
    { type: 'rect', x: cx + X(1), y: hip, w: X(3.5), h: foot - hip },
  ] });
  s.add({ type: 'path', name: 'coat', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + bodyW / 2 + X(1)} ${hip + X(2)} H${cx - bodyW / 2 - X(1)} Z`, mat: pal.metal, shade: 'linear', round: X(2), underlay: true });
  s.add({ type: 'rect', name: 'placket', x: cx - 0.5, y: neck + X(1), w: 1, h: hip - neck, mat: pal.metal, shade: 'flat', band: 2 });
  s.add({ type: 'rect', name: 'collar', x: cx - X(2), y: neck - 1, w: X(4), h: 2, mat: pal.hair, shade: 'flat', band: 2 });
  // arms reaching at the viewer: upper arms out from the shoulders, forearms + hands foreshortened at chest height
  for (const k of [-1, 1]) {
    s.add({ type: 'circle', name: 'cuff', cx: cx + k * X(4), cy: neck + X(3.5), r: X(2.6), mat: pal.metal, shade: 'sphere', underlay: true });
    s.add({ type: 'group', name: 'hand', underlay: true, children: [
      { type: 'ellipse', cx: cx + k * X(4), cy: neck + X(3), rx: X(2.2), ry: X(2.4), mat: pal.skin, shade: 'flat', band: 0 },
      { type: 'rect', x: cx + k * X(4) - X(1.6), y: neck + X(0.5), w: X(3.2), h: X(1.5), mat: pal.skin, shade: 'flat', band: 1 },
    ] });
  }
  const hx = cx + P.tilt;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'face', cx: hx, cy: top + headH / 2, rx: headW / 2, ry: headH / 2, mat: pal.skin, shade: 'sphere' },
    { type: 'intersect', name: 'hair', mat: pal.hair, shade: 'flat', band: 2, shapes: [
      { type: 'ellipse', cx: hx, cy: top + headH / 2, rx: headW / 2 + 0.5, ry: headH / 2 + 0.5 },
      { type: 'rect', x: hx - headW, y: top - X(2), w: headW * 2, h: headH * 0.38 + X(2) },
    ] },
  ] });
  for (const dx of [-2, 1.5]) s.add({ type: 'rect', name: 'eye', x: Math.round(hx + X(dx)), y: Math.round(top + headH * 0.55), w: Math.max(1, Math.round(X(1.5))), h: 1, color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'coat', amount: 0.15 }).render();
}

export const anchors = ctx => ({ head: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.2)] });
