// rat base.v3 (r3) — v2 with a longer tail that sweeps well up on the flick frame (it barely moved). v2: v1 rebuilt: a round back with a raised rump (ellipse body), a separate head (circle + pointed snout
// path) so the profile reads as a rat, a long tail in a darker step that curls up on the flick frame.
export const meta = { brief: 'rat', pass: 'r3', notes: 'round body, separate head + snout, long tail' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, up = ctx.frame % 2;
  const gy = h * 0.82, cx = X(13);
  s.add({ type: 'tube', name: 'tail', d: `M${cx - X(6)} ${gy - X(2)} Q${cx - X(12)} ${gy - X(up ? 3 : -1)} ${up ? cx - X(12) : cx - X(13)} ${gy - X(up ? 12 : 0)}`, w: X(1.5), w1: 0.6, mat: pal.skin, shade: 'flat', band: 2, underlay: true });
  for (const fx of [cx - X(4), cx + X(3)]) s.add({ type: 'rect', name: 'foot', x: fx, y: gy - X(1), w: X(2), h: X(1.5), mat: pal.skin, shade: 'flat', band: 1 });
  s.add({ type: 'ellipse', name: 'body', cx, cy: gy - X(5), rx: X(7.5), ry: X(5), mat: pal.hair, shade: 'normal', underlay: true });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'circle', cx: cx + X(7), cy: gy - X(5), r: X(3.2), mat: pal.hair, shade: 'sphere' },
    { type: 'path', d: `M${cx + X(8)} ${gy - X(7.5)} L${cx + X(14)} ${gy - X(4)} L${cx + X(8)} ${gy - X(2.5)} Z`, mat: pal.hair, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'circle', name: 'ear', cx: cx + X(6), cy: gy - X(8.5), r: X(1.8), mat: pal.skin, shade: 'flat', band: 1, underlay: true });
  s.add({ type: 'rect', name: 'eye', x: Math.round(cx + X(9)), y: Math.round(gy - X(6)), w: 1, h: 1, mat: pal.accent, shade: 'flat', band: 1 });
  s.add({ type: 'rect', name: 'nose', x: Math.round(cx + X(13.5)), y: Math.round(gy - X(4)), w: 1, h: 1, mat: pal.skin, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).render();
}
