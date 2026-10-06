// sunk-crate base.v1 (r1) — from the crate template: a crate half sunk in bog water. Top + front faces as the
// template, cut at a waterline by a dark water pool with a pale ripple; rotten plank gaps on the front.
export const meta = { brief: 'sunk-crate', pass: 'r1', notes: 'crate cut by a waterline, ripple ring' };

export const params = {
  body: { type: 'swap', options: ['wood', 'leather'], default: 'wood' },
  bands: { type: 'choice', options: [1, 2], default: 2 },
  sink: { type: 'range', min: 0.35, max: 0.6, default: 0.45 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const x0 = X(6), x1 = X(26), topY = Y(6), midY = Y(13), botY = Y(28), body = pal[P.body];
  const water = midY + (botY - midY) * (1 - P.sink);
  s.add({ type: 'ellipse', name: 'pool', cx: X(16), cy: water + Y(2), rx: X(15), ry: Y(5), mat: pal.grass, shade: 'flat', band: 2 });
  s.add({ type: 'group', name: 'crate', underlay: true, children: [
    { type: 'rect', name: 'front', x: x0, y: midY, w: x1 - x0, h: water - midY, mat: body, shade: 'linear' },
    { type: 'path', name: 'top', d: `M${x0 + X(2)} ${topY} H${x1 - X(2)} L${x1} ${midY} H${x0} Z`, mat: body, shade: 'flat', band: 0 },
  ] });
  const bandXs = P.bands === 2 ? [x0 + X(3), x1 - X(5)] : [(x0 + x1) / 2 - X(1)];
  for (const bx of bandXs) s.add({ type: 'rect', name: 'band', x: bx, y: midY, w: X(2), h: water - midY, mat: pal.metal, shade: 'bevel' });
  s.add({ type: 'ring', name: 'ripple', cx: X(16), cy: water + Y(1), r: X(13), w: 1, mat: pal.grass, shade: 'flat', band: 0, sy: 0.3 });
  return ctx.lib.proc(s)
    .add('pattern', { part: 'front', type: 'planks', period: Math.max(3, Math.round(Y(4))), axis: 'x', length: 64 })
    .add('materialNoise', { part: 'top', amount: 0.3 })
    .render();
}

export const anchors = ctx => ({ lid: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.3)] });
