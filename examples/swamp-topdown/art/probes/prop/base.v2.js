// probe-prop base.v2 (r2) — from v1 (template crate): a rotten crate half-sunk in the bog. Tilted top, a broken
// plank, one corroded band, moss creeping up from the waterline, a dark wet line where it meets the mud.
export const meta = { brief: 'probe-prop', pass: 'r2', notes: 'half-sunk rotten crate: tilt, broken plank, moss, waterline' };

export const params = {
  moss: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  broken: { type: 'toggle', default: true },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const x0 = X(5), x1 = X(27), water = Y(25);
  s.add({ type: 'group', name: 'crate', underlay: true, children: [
    { type: 'path', name: 'front', d: `M${x0} ${Y(13)} L${x1} ${Y(15)} V${water} H${x0} Z`, mat: pal.wood, shade: 'linear' },
    { type: 'path', name: 'top', d: `M${x0 + X(2)} ${Y(7)} L${x1 - X(1)} ${Y(9)} L${x1} ${Y(15)} L${x0} ${Y(13)} Z`, mat: pal.wood, shade: 'flat', band: 0 },
  ] });
  if (P.broken) s.add({ type: 'path', name: 'gap', d: `M${X(15)} ${Y(14)} L${X(19)} ${Y(14.6)} L${X(18)} ${Y(18)} L${X(15.5)} ${Y(17)} Z`, color: 'outline' });
  s.add({ type: 'path', name: 'band', d: `M${X(8)} ${Y(13.5)} L${X(10)} ${Y(13.8)} V${water} H${X(8)} Z`, mat: pal.metal, shade: 'flat', band: 2 });
  for (let i = 0; i < P.moss; i++) {
    const mx = x0 + X(2 + i * 7);
    s.add({ type: 'path', name: 'moss', d: `M${mx} ${water} Q${mx + X(1.5)} ${water - Y(4 + (i % 2) * 2)} ${mx + X(3)} ${water} Z`, mat: pal.grass, shade: 'flat', band: i % 2 });
  }
  s.add({ type: 'rect', name: 'waterline', x: x0 - X(1), y: water, w: x1 - x0 + X(2), h: Math.max(1, Y(1.5)), r: 0.5, mat: pal.dirt, shade: 'flat', band: 2 });
  return ctx.lib.proc(s)
    .add('pattern', { part: 'front', type: 'planks', period: Math.max(3, Math.round(Y(4))), axis: 'x', length: 64 })
    .add('materialNoise', { part: 'front', amount: 0.15 })
    .render();
}

export const anchors = ctx => ({ gap: [Math.round(ctx.size[0] * 0.53), Math.round(ctx.size[1] * 0.48)] });
