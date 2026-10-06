// probe-character base.v2 (r2) — from v1 (template humanoid): Hollow Ward's ghoul, as the front billboard. Hunched:
// the head sits low between raised shoulders, long arms hang past the knees with clawed hands, a torn hospital
// gown, two accent eye-points that read in a dark corridor at 1x.
export const meta = { brief: 'probe-character', pass: 'r2', notes: 'ghoul: hunch, low head, long arms, torn gown, eye-points' };

export const params = {
  gown: { type: 'swap', options: ['cloth', 'leather'], default: 'cloth' },
  reach: { type: 'range', min: 0, max: 2, step: 1, default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), cx = w / 2, X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const sh = Y(11), hip = Y(22), foot = Y(30.5), gown = pal[P.gown], reach = X(P.reach);
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.skin, shade: 'cyl', axis: 'y', children: [
    { type: 'capsule', a: [cx - X(3), hip], b: [cx - X(4), foot - X(1)], r: X(1.5) },
    { type: 'capsule', a: [cx + X(3), hip], b: [cx + X(4), foot - X(1)], r: X(1.5) },
  ] });
  s.add({ type: 'path', name: 'gown', d: `M${cx - X(7)} ${sh} Q${cx} ${sh - Y(3)} ${cx + X(7)} ${sh} L${cx + X(6)} ${hip + Y(2)} L${cx + X(3)} ${hip} L${cx + X(1)} ${hip + Y(3)} L${cx - X(2)} ${hip + Y(1)} L${cx - X(6)} ${hip + Y(2.5)} Z`, mat: gown, shade: 'normal', round: X(4), underlay: true });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: cx, children: [
    { type: 'capsule', name: 'arm-upper', a: [cx - X(6.5), sh + Y(1)], b: [cx - X(9) - reach, hip], r: X(1.6), r1: X(1.3), mat: pal.skin, shade: 'cyl' },
    { type: 'capsule', name: 'arm-lower', a: [cx - X(9) - reach, hip], b: [cx - X(8.5) - reach, Y(27)], r: X(1.3), r1: X(1.1), mat: pal.skin, shade: 'cyl' },
    { type: 'path', name: 'claw', d: `M${cx - X(10) - reach} ${Y(27)} L${cx - X(10.5) - reach} ${Y(29.5)} L${cx - X(9) - reach} ${Y(28)} L${cx - X(8.5) - reach} ${Y(30)} L${cx - X(7.5) - reach} ${Y(27)} Z`, mat: pal.skin, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'ellipse', name: 'head', cx, cy: sh + Y(0.5), rx: X(4.2), ry: Y(4.5), mat: pal.skin, shade: 'sphere', underlay: true });
  s.add({ type: 'rect', name: 'eye', x: cx - X(2.2), y: sh + Y(0.5), w: Math.max(1, X(1.2)), h: 1, color: 'accent.0', mirrorX: cx });
  s.add({ type: 'rect', name: 'mouth', x: cx - X(1.5), y: sh + Y(3), w: X(3), h: 1, color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'gown', amount: 0.25 }).add('groundShadow', {}).render();
}

export const anchors = ctx => ({ eyes: [Math.round(ctx.size[0] / 2), Math.round((ctx.size[1] * 11.5) / 32)] });
