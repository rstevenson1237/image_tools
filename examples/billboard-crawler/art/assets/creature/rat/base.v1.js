// rat base.v1 (r1) — written for the brief: a ward rat side-on (billboard), body a fat teardrop (hair ramp), pointed
// snout to the right, round ear, beady amber eye, pink-skin feet and a long tail that flicks between the two frames.
export const meta = { brief: 'rat', pass: 'r1', notes: 'side-on rat, tail flick' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, up = ctx.frame % 2;
  const gy = h * 0.82, cx = X(15);
  s.add({ type: 'tube', name: 'tail', d: `M${cx - X(7)} ${gy - X(2)} Q${cx - X(12)} ${gy - X(up ? 7 : 1)} ${cx - X(14)} ${gy - X(up ? 3 : 0)}`, w: X(1.4), w1: 0.6, mat: pal.skin, shade: 'flat', band: 1, underlay: true });
  for (const fx of [cx - X(4), cx + X(4)]) s.add({ type: 'rect', name: 'foot', x: fx, y: gy - X(1), w: X(2), h: X(1.5), mat: pal.skin, shade: 'flat', band: 1 });
  s.add({ type: 'path', name: 'body', d: `M${cx - X(8)} ${gy - X(2)} Q${cx - X(8)} ${gy - X(10)} ${cx} ${gy - X(9)} Q${cx + X(6)} ${gy - X(8)} ${cx + X(11)} ${gy - X(2.5)} L${cx + X(9)} ${gy - X(1)} H${cx - X(7)} Z`, mat: pal.hair, shade: 'normal', round: X(2), underlay: true });
  s.add({ type: 'circle', name: 'ear', cx: cx + X(4), cy: gy - X(8.5), r: X(2), mat: pal.skin, shade: 'flat', band: 1, underlay: true });
  s.add({ type: 'rect', name: 'eye', x: Math.round(cx + X(7)), y: Math.round(gy - X(6)), w: 1, h: 1, mat: pal.accent, shade: 'flat', band: 1 });
  s.add({ type: 'rect', name: 'nose', x: Math.round(cx + X(10.5)), y: Math.round(gy - X(3)), w: 1, h: 1, mat: pal.skin, shade: 'flat', band: 0 });
  return ctx.lib.proc(s).render();
}
