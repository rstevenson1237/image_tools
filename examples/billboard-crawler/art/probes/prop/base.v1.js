// probe-prop base.v1 (r1) — template: a banded crate seen from the 3/4 top-down camera (top face + front face),
// metal bands and an accent lock. Adapt to the brief (barrel, chest, sign, altar…): keep the two-face read and
// the light-side top. Coordinates are fractions of ctx.size; colours are role ramps (R11).
export const meta = { brief: 'probe-prop', pass: 'r1', notes: 'template crate' };

export const params = {
  body: { type: 'swap', options: ['wood', 'stone', 'leather'], default: 'wood' },
  bands: { type: 'choice', options: [1, 2], default: 2 },
  lock: { type: 'toggle', default: true },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const x0 = X(5), x1 = X(27), topY = Y(7), midY = Y(14), botY = Y(28), body = pal[P.body];
  s.add({ type: 'group', name: 'crate', underlay: true, children: [
    { type: 'rect', name: 'front', x: x0, y: midY, w: x1 - x0, h: botY - midY, mat: body, shade: 'linear' },
    { type: 'path', name: 'top', d: `M${x0 + X(2)} ${topY} H${x1 - X(2)} L${x1} ${midY} H${x0} Z`, mat: body, shade: 'flat', band: 0 },
  ] });
  const bandXs = P.bands === 2 ? [x0 + X(3), x1 - X(5)] : [(x0 + x1) / 2 - X(1)];
  for (const bx of bandXs) s.add({ type: 'rect', name: 'band', x: bx, y: midY, w: X(2), h: botY - midY, mat: pal.metal, shade: 'bevel' });
  s.add({ type: 'rect', name: 'lip', x: x0, y: midY, w: x1 - x0, h: Math.max(1, Y(1.2)), mat: body, shade: 'flat', band: 2 });
  if (P.lock) s.add({ type: 'rect', name: 'lock', x: (x0 + x1) / 2 - X(1.5), y: midY + Y(2), w: X(3), h: Y(4), r: 0.5, mat: pal.accent, shade: 'bevel' });
  return ctx.lib.proc(s)
    .add('pattern', { part: 'front', type: 'planks', period: Math.max(3, Math.round(Y(5))), axis: 'x', length: 64 })
    .add('groundShadow', {})
    .render();
}

export const anchors = ctx => ({ lock: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.56)] });
