// knight-attack base.v1 (r1) — a side-view knight posed by intent: per key frame a hand target, a blade angle, a
// lean and a lunge; 2-bone IK solves the sword arm and both legs (feet planted on the ground line). Attack =
// anticipation, raise, swing, contact (held 220 ms in the brief), recovery. On swing and contact a slash trail is
// swept along the blade tip's path over the last part of the move (`anim.sweep`), drawn behind the knight.
export const meta = { brief: 'knight-attack', pass: 'r1', notes: 'IK-posed knight, overhead slash, swept trail' };

const KEYS = {
  idle: [{ hand: [5, -8], blade: 165, lean: 0, lunge: 0 }],
  attack: [
    { hand: [-5, -12], blade: 200, lean: -8, lunge: -1 },
    { hand: [0, -19], blade: 250, lean: -4, lunge: 0 },
    { hand: [9, -15], blade: 120, lean: 6, lunge: 2 },
    { hand: [12, -8], blade: 70, lean: 12, lunge: 4 },
    { hand: [7, -9], blade: 50, lean: 6, lunge: 2 },
  ],
};
const GROUND = 38, HIP = [18, 24], BLADE = 14;

/** Pose at a fractional key position f (0 … frames-1) of a state. */
function poseAt(ctx, state, f) {
  const keys = KEYS[state], i = Math.max(0, Math.min(keys.length - 1, Math.floor(f))), j = Math.min(keys.length - 1, i + 1), u = Math.max(0, Math.min(1, f - i));
  const k = ctx.lib.anim.track([[0, keys[i]], [1, keys[j]]], u, { loop: false });
  const root = [HIP[0] + k.lunge, HIP[1] + Math.abs(k.lunge) * 0.25];
  const rig = ctx.lib.anim.rig({ root, bones: {
    spine: { len: 9, angle: 180 + k.lean }, neck: { parent: 'spine', len: 2.5, angle: 0 },
    armF: { parent: 'spine', at: 0.85, len: 5.5, angle: 0 }, foreF: { parent: 'armF', len: 5.5, angle: 0 },
    armB: { parent: 'spine', at: 0.85, len: 5.5, angle: -20 }, foreB: { parent: 'armB', len: 5, angle: 40 },
    thighF: { offset: [1, 0], len: 7, angle: 0 }, shinF: { parent: 'thighF', len: 7, angle: 0 },
    thighB: { offset: [-1, 0], len: 7, angle: 0 }, shinB: { parent: 'thighB', len: 7, angle: 0 },
  } });
  const p = rig.pose({}, { ik: {
    foreF: { target: [HIP[0] + k.hand[0], HIP[1] + k.hand[1]], bend: -1 },
    shinF: { target: [HIP[0] + 6 + Math.max(0, k.lunge) * 1.2, GROUND - 1], bend: 1 },
    shinB: { target: [HIP[0] - 5, GROUND - 1], bend: 1 },
  } });
  const hand = p.end('foreF'), a = k.blade * Math.PI / 180, dir = [Math.sin(a), Math.cos(a)];
  return { p, hand, dir, tip: [hand[0] + dir[0] * BLADE, hand[1] + dir[1] * BLADE] };
}

const keyOf = ctx => ({ state: ctx.state, f: ctx.state === 'attack' ? ctx.logical : 0 });

export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(...ctx.size), { state, f } = keyOf(ctx), { p, hand, dir, tip } = poseAt(ctx, state, f);
  const cap = (name, bone, r, mat, r1 = r) => s.add({ type: 'capsule', name, a: p.start(bone), b: p.end(bone), r, r1, mat, shade: 'normal' });
  // slash trail: the tip's path over the last ~1.2 key frames, a tapered band behind everything
  if (state === 'attack' && (f === 2 || f === 3)) {
    const pts = ctx.lib.anim.sweep(x => poseAt(ctx, state, x).tip, f, f === 3 ? 1.6 : 1.1, 7);
    s.add({ type: 'tube', name: 'trail', pts, w: 1, w1: 3.5, mat: pal.metal, shade: 'flat', band: 0 });
  }
  cap('legB', 'thighB', 1.6, pal.leather); cap('shinB', 'shinB', 1.5, pal.metal, 1.3);
  cap('armB', 'armB', 1.4, pal.metal); cap('foreB', 'foreB', 1.3, pal.metal);
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'capsule', name: 'cuirass', a: p.start('spine'), b: p.along('spine', 0.85), r: 3.6, r1: 3.9, mat: pal.metal, shade: 'normal' },
    { type: 'capsule', name: 'tabard', a: p.along('spine', 0.1, -0.2), b: p.along('spine', 0.55), r: 3.2, r1: 3, mat: pal.cloth, shade: 'normal' },
  ] });
  const head = p.end('neck');
  s.add({ type: 'group', name: 'helm', underlay: true, children: [
    { type: 'circle', name: 'helmet', cx: head[0], cy: head[1], r: 3.6, mat: pal.metal, shade: 'sphere' },
    { type: 'rect', name: 'visor', x: head[0] + 0.5, y: head[1] - 0.5, w: 3.2, h: 1, color: 'hair.2' },
    { type: 'capsule', name: 'plume', a: [head[0] - 1, head[1] - 3.2], b: [head[0] - 4.5, head[1] - 1.5], r: 1.1, r1: 0.6, mat: pal.accent, shade: 'flat', band: 1 },
  ] });
  cap('legF', 'thighF', 1.7, pal.leather); cap('shinF', 'shinF', 1.6, pal.metal, 1.4);
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'tube', name: 'blade', pts: [[hand[0] + dir[0] * 1.5, hand[1] + dir[1] * 1.5], tip], w: 2, w1: 1, mat: pal.metal, shade: 'flat', band: 0 },
    { type: 'capsule', name: 'guard', a: [hand[0] + dir[0] * 1.5 - dir[1] * 2, hand[1] + dir[1] * 1.5 + dir[0] * 2], b: [hand[0] + dir[0] * 1.5 + dir[1] * 2, hand[1] + dir[1] * 1.5 - dir[0] * 2], r: 0.7, mat: pal.accent, shade: 'flat', band: 1 },
  ] });
  cap('armF', 'armF', 1.5, pal.metal); cap('foreF', 'foreF', 1.4, pal.metal, 1.5);
  return ctx.lib.proc(s).render();
}

export const anchors = ctx => {
  const { state, f } = keyOf(ctx), { hand, tip } = poseAt(ctx, state, f);
  return { hand: hand.map(Math.round), tip: tip.map(Math.round) };
};
