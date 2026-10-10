// knight-attack base.v3 (r3) — from v2 (6): the legs crouched deeply in every frame, the helm merged with the
// pauldron and the trail was one flat grey. Now the hips sit higher (legs nearly straight at rest, bending only
// into the lunge), a taller helm with a dark gap under it (gorget), the pauldron lower on the shoulder, and a
// two-tone trail: a pale leading edge over a darker tail band. v2's key poses, armour and shield stay.
export const meta = { brief: 'knight-attack', pass: 'r3', notes: 'straighter legs, gorget gap, two-tone trail' };

const KEYS = {
  idle: [{ hand: [5, -8], blade: 165, lean: 0, lunge: 0 }],
  attack: [
    { hand: [-5, -10], blade: 205, lean: -8, lunge: -1 },
    { hand: [-1, -12], blade: 240, lean: -4, lunge: 0 },
    { hand: [9, -11], blade: 125, lean: 6, lunge: 2 },
    { hand: [12, -8], blade: 70, lean: 12, lunge: 4 },
    { hand: [7, -9], blade: 50, lean: 6, lunge: 2 },
  ],
};
const GROUND = 38, HIP = [19, 25], BLADE = 13;

/** Pose at a fractional key position f (0 … frames-1) of a state. */
function poseAt(ctx, state, f) {
  const keys = KEYS[state], i = Math.max(0, Math.min(keys.length - 1, Math.floor(f))), j = Math.min(keys.length - 1, i + 1), u = Math.max(0, Math.min(1, f - i));
  const k = ctx.lib.anim.track([[0, keys[i]], [1, keys[j]]], u, { loop: false });
  const root = [HIP[0] + k.lunge, HIP[1] + Math.abs(k.lunge) * 0.25];
  const rig = ctx.lib.anim.rig({ root, bones: {
    spine: { len: 9, angle: 180 + k.lean }, neck: { parent: 'spine', len: 3.2, angle: 0 },
    armF: { parent: 'spine', at: 0.85, len: 5.5, angle: 0 }, foreF: { parent: 'armF', len: 5.5, angle: 0 },
    armB: { parent: 'spine', at: 0.85, len: 5.5, angle: 165 }, foreB: { parent: 'armB', len: 5, angle: -50 },
    thighF: { offset: [1, 0], len: 6.5, angle: 0 }, shinF: { parent: 'thighF', len: 6.5, angle: 0 },
    thighB: { offset: [-1, 0], len: 6.5, angle: 0 }, shinB: { parent: 'thighB', len: 6.5, angle: 0 },
  } });
  const p = rig.pose({}, { ik: {
    foreF: { target: [HIP[0] + k.hand[0], HIP[1] + k.hand[1]], bend: -1 },
    shinF: { target: [HIP[0] + 3 + Math.max(0, k.lunge) * 1.6, GROUND - 1], bend: 1 },
    shinB: { target: [HIP[0] - 3 - Math.max(0, k.lunge) * 0.5, GROUND - 1], bend: 1 },
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
    const pts = ctx.lib.anim.sweep(x => poseAt(ctx, state, x).tip, f, f === 3 ? 1.25 : 1.1, 7);
    s.add({ type: 'tube', name: 'trail', pts, w: 1, w1: 5, mat: pal.metal, shade: 'flat', band: 1 });
    s.add({ type: 'tube', name: 'trailEdge', pts: pts.slice(2), w: 0.8, w1: 2, mat: pal.metal, shade: 'flat', band: 0 });
  }
  const sab = (bone, k) => { const e = p.end(bone); s.add({ type: 'ellipse', name: 'sabaton', cx: e[0] + 1.2, cy: e[1] + 0.2, rx: 2.4, ry: 1.2, mat: pal.metal, shade: 'normal', z: k }); };
  cap('legB', 'thighB', 2, pal.leather); cap('shinB', 'shinB', 1.9, pal.metal, 1.6); sab('shinB');
  cap('armB', 'armB', 1.6, pal.metal); cap('foreB', 'foreB', 1.5, pal.metal);
  const sh = p.end('foreB');
  s.add({ type: 'path', name: 'shield', d: `M${sh[0] - 3.5} ${sh[1] - 4} H${sh[0] + 3.5} V${sh[1] + 1} L${sh[0]} ${sh[1] + 5.5} L${sh[0] - 3.5} ${sh[1] + 1} Z`, mat: pal.cloth, shade: 'normal', underlay: true });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'capsule', name: 'cuirass', a: p.along('spine', 0.05), b: p.along('spine', 0.8), r: 4.2, r1: 4.6, mat: pal.metal, shade: 'normal' },
    { type: 'capsule', name: 'tabard', a: p.along('spine', 0.02, -0.3), b: p.along('spine', 0.45), r: 3.9, r1: 3.6, mat: pal.cloth, shade: 'normal' },
    { type: 'rect', name: 'belt', x: p.along('spine', 0.4)[0] - 4, y: p.along('spine', 0.4)[1] - 0.5, w: 8, h: 1.2, mat: pal.leather, shade: 'flat', band: 1 },
  ] });
  const head = p.end('neck');
  s.add({ type: 'group', name: 'helm', underlay: true, children: [
    { type: 'capsule', name: 'crest', a: [head[0] + 1, head[1] - 3.6], b: [head[0] - 3.5, head[1] - 3.2], r: 1.2, r1: 0.8, mat: pal.accent, shade: 'flat', band: 1 },
    { type: 'rect', name: 'gorget', x: head[0] - 2.2, y: head[1] + 2.4, w: 4.4, h: 1.6, mat: pal.leather, shade: 'flat', band: 2 },
    { type: 'capsule', name: 'helmet', a: [head[0], head[1] - 1], b: [head[0], head[1] + 1.2], r: 3.6, mat: pal.metal, shade: 'normal' },
    { type: 'rect', name: 'visor', x: head[0] + 0.8, y: head[1] - 0.5, w: 3, h: 1.2, color: 'hair.2' },
  ] });
  cap('legF', 'thighF', 2.1, pal.leather); cap('shinF', 'shinF', 2, pal.metal, 1.7); sab('shinF');
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'tube', name: 'blade', pts: [[hand[0] + dir[0] * 1.5, hand[1] + dir[1] * 1.5], tip], w: 2.6, w1: 1.2, mat: pal.metal, shade: 'bevel' },
    { type: 'capsule', name: 'guard', a: [hand[0] + dir[0] * 1.5 - dir[1] * 2, hand[1] + dir[1] * 1.5 + dir[0] * 2], b: [hand[0] + dir[0] * 1.5 + dir[1] * 2, hand[1] + dir[1] * 1.5 - dir[0] * 2], r: 0.7, mat: pal.accent, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'circle', name: 'pauldron', cx: p.start('armF')[0], cy: p.start('armF')[1] + 1.4, r: 2.4, mat: pal.metal, shade: 'sphere', underlay: true });
  cap('armF', 'armF', 1.7, pal.metal); cap('foreF', 'foreF', 1.6, pal.metal, 1.8);
  return ctx.lib.proc(s).render();
}

export const anchors = ctx => {
  const { state, f } = keyOf(ctx), { hand, tip } = poseAt(ctx, state, f);
  return { hand: hand.map(Math.round), tip: tip.map(Math.round) };
};
