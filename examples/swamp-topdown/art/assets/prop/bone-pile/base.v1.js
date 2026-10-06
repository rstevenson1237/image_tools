// bone-pile base.v1 (r1) — written for the brief: bleached bones scattered on a mud patch, a skull on top. Bones are
// capsules with knobbed ends (stone ramp: the palette has no white, by rule), the skull a dome + jaw + dark sockets.
export const meta = { brief: 'bone-pile', pass: 'r1', notes: 'capsule bones, skull on top' };

export const params = {
  bones: { type: 'range', min: 3, max: 5, step: 1, default: 4 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32, r = ctx.rng;
  s.add({ type: 'ellipse', name: 'mud', cx: X(16), cy: Y(23), rx: X(13), ry: Y(5), mat: pal.dirt, shade: 'flat', band: 1 });
  for (let i = 0; i < P.bones; i++) {
    const a = (i / P.bones) * Math.PI + r() * 0.5, cx = X(16) + (r() - 0.5) * X(12), cy = Y(22) + (r() - 0.5) * Y(5), L = X(5 + r() * 3);
    const p0 = [cx - Math.cos(a) * L, cy - Math.sin(a) * L * 0.5], p1 = [cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.5];
    s.add({ type: 'group', name: `bone${i}`, underlay: true, mat: pal.stone, children: [
      { type: 'capsule', a: p0, b: p1, r: X(0.9), shade: 'cyl' },
      { type: 'circle', cx: p0[0], cy: p0[1], r: X(1.5), shade: 'sphere' },
      { type: 'circle', cx: p1[0], cy: p1[1], r: X(1.5), shade: 'sphere' },
    ] });
  }
  s.add({ type: 'group', name: 'skull', underlay: true, mat: pal.stone, children: [
    { type: 'ellipse', name: 'dome', cx: X(15), cy: Y(15), rx: X(5), ry: Y(4.5), shade: 'sphere' },
    { type: 'rect', name: 'jaw', x: X(12), y: Y(18), w: X(6), h: Y(3), r: 1, shade: 'flat', band: 1 },
  ] });
  for (const dx of [-2, 2]) s.add({ type: 'ellipse', name: 'socket', cx: X(15 + dx), cy: Y(16), rx: X(1.3), ry: Y(1.4), color: 'outline' });
  return ctx.lib.proc(s).render();
}
