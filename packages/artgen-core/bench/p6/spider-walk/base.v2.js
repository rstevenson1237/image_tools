// spider-walk base.v2 (r2) — from v1 (5.5): the front feet clipped the top, the legs were pale sticks brighter than the
// body and every leg was one tone. Now the body sits 2 px lower, front legs reach less far, legs are thin and dark
// (hair ramp) with the lifted ones a step lighter so the alternating gait reads, the knees carry a light joint pixel,
// and four ember eyes sit at the front of the thorax.
// v1: top-down cave spider walking north. Each leg is a femur + tibia solved by 2-bone IK to a
// foot target: in stance the foot is planted and slides back (the body moves forward over it), in swing it lifts
// (drawn a little shorter and lighter) and reaches forward. Alternating tetrapod gait: L1 R2 L3 R4 swing together,
// then the other four. Knees bend outward. Body: cephalothorax + abdomen with a light marking, two eye pixels.
export const meta = { brief: 'spider-walk', pass: 'r2', notes: 'lower body, dark thin legs, lifted legs lighter, eyes' };

const C = [16, 14], STRIDE = 4;
// hip offset from the cephalothorax centre and the foot's rest position (left side; right mirrors x)
const LEGS = [
  { hip: [-2, -2], foot: [-8, -9] },
  { hip: [-2.5, -0.5], foot: [-12, -3] },
  { hip: [-2.5, 1], foot: [-12, 5] },
  { hip: [-2, 2.5], foot: [-9, 12] },
];

function legs(ctx) {
  const out = [];
  LEGS.forEach((L, i) => [-1, 1].forEach(side => {
    const group = (i + (side > 0 ? 1 : 0)) % 2, q = (ctx.t + group * 0.5) % 1;
    const stance = q < 0.5, u = stance ? q / 0.5 : (q - 0.5) / 0.5;
    const dy = stance ? -STRIDE / 2 + u * STRIDE : STRIDE / 2 - u * STRIDE;
    const hip = [C[0] - side * L.hip[0] * -1 * -1 + (side > 0 ? -2 * L.hip[0] : 0), C[1] + L.hip[1]];
    const hx = side < 0 ? C[0] + L.hip[0] : C[0] - L.hip[0], foot = [side < 0 ? C[0] + L.foot[0] : C[0] - L.foot[0], C[1] + L.foot[1] + dy];
    const rig = ctx.lib.anim.rig({ root: [hx, hip[1]], bones: { fem: { len: 6.5 }, tib: { parent: 'fem', len: 7.5 } } });
    const p = rig.pose({}, { ik: { tib: { target: stance ? foot : [foot[0] + side * 1, foot[1]], bend: side < 0 ? 1 : -1 } } });
    out.push({ p, lifted: !stance && u > 0.15 && u < 0.85 });
  }));
  return out;
}

export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(...ctx.size), bob = ctx.t * 2 % 1 < 0.5 ? 0 : 0.5;
  for (const { p, lifted } of legs(ctx)) s.add({ type: 'group', name: 'leg', underlay: true, children: [
    { type: 'capsule', a: p.start('fem'), b: p.end('fem'), r: 0.75, r1: 0.65, mat: pal.hair, shade: 'flat', band: lifted ? 0 : 1 },
    { type: 'capsule', a: p.start('tib'), b: p.end('tib'), r: 0.6, r1: 0.45, mat: pal.hair, shade: 'flat', band: lifted ? 0 : 1 },
    { type: 'circle', cx: p.end('fem')[0], cy: p.end('fem')[1], r: 0.6, mat: pal.leather, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'abdomen', cx: C[0], cy: C[1] + 9 + bob, rx: 5, ry: 6, mat: pal.hair, shade: 'normal' },
    { type: 'ellipse', name: 'marking', cx: C[0], cy: C[1] + 8.5 + bob, rx: 1.5, ry: 2.5, mat: pal.accent, shade: 'flat', band: 2 },
    { type: 'ellipse', name: 'thorax', cx: C[0], cy: C[1], rx: 3.6, ry: 4, mat: pal.hair, shade: 'normal' },
    ...[[-1.4, -3], [1.4, -3], [-0.6, -2.2], [0.6, -2.2]].map(([x, y]) => ({ type: 'rect', name: 'eye', x: C[0] + x - 0.5, y: C[1] + y - 0.5, w: 1, h: 1, color: 'accent.0' })),
  ] });
  return ctx.lib.proc(s).render();
}

export const anchors = () => ({ eye: [14, 11], eye2: [17, 11] });
