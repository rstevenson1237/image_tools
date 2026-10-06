// bone-pile base.v2 (r2) — v1 with the bones laid out around the skull (not under it), flat-lit, a bigger skull.
// v1: written for the brief: bleached bones scattered on a mud patch, a skull on top. Bones are
// capsules with knobbed ends (stone ramp: the palette has no white, by rule), the skull a dome + jaw + dark sockets.
export const meta = { brief: 'bone-pile', pass: 'r2', notes: 'capsule bones, skull on top' };

export const params = {
  bones: { type: 'range', min: 3, max: 5, step: 1, default: 4 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32, r = ctx.rng;
  s.add({ type: 'ellipse', name: 'mud', cx: X(16), cy: Y(23), rx: X(13), ry: Y(5), mat: pal.dirt, shade: 'flat', band: 1 });
  for (let i = 0; i < P.bones; i++) {
    const side = i % 2 ? 1 : -1, a = side * (0.3 + 0.5 * r()), cx = X(16) + side * X(8 + 2 * r()), cy = Y(20 + 2 * i + r()), L = X(3.5 + r() * 1.5);
    const p0 = [cx - Math.cos(a) * L, cy - Math.sin(a) * L * 0.5], p1 = [cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.5];
    s.add({ type: 'group', name: `bone${i}`, underlay: true, mat: pal.stone, children: [
      { type: 'capsule', a: p0, b: p1, r: X(0.9), shade: 'flat', band: 0 },
      { type: 'circle', cx: p0[0], cy: p0[1], r: X(1.4), shade: 'flat', band: 0 },
      { type: 'circle', cx: p1[0], cy: p1[1], r: X(1.4), shade: 'flat', band: 1 },
    ] });
  }
  s.add({ type: 'group', name: 'skull', underlay: true, mat: pal.stone, children: [
    { type: 'ellipse', name: 'dome', cx: X(16), cy: Y(15), rx: X(6), ry: Y(5.5), shade: 'linear' },
    { type: 'rect', name: 'jaw', x: X(12.5), y: Y(19), w: X(7), h: Y(3.5), r: 1, shade: 'flat', band: 1 },
  ] });
  for (const dx of [-2.3, 2.3]) s.add({ type: 'ellipse', name: 'socket', cx: X(16 + dx), cy: Y(16.5), rx: X(1.5), ry: Y(1.6), color: 'outline' });
  s.add({ type: 'rect', name: 'nose', x: X(15.5), y: Y(18.5), w: 1, h: 1, color: 'outline' });
  return ctx.lib.proc(s).render();
}
