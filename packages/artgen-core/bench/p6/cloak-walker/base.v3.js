// cloak-walker base.v3 (r3) — from v2 (6): the cape was a heavy blob touching the left edge, no hem, hood and cape one
// red mass. Now the figure stands further right (room for the trailing cape), the cape is narrower at the neck and
// flares to a ragged hem (alternate hem links pulled short), a darker lining shows on its inner edge, the hood is
// cloth (not the cape's red) with the face in shadow under it.
// v2, from v1 (4.5): the cape hung from the front of the chest (hidden behind the torso) and
// barely trailed. Now it hangs from the back of the neck, longer (6 links), with more air drag and less gravity so it
// streams back while walking; a longer stride with a visible knee lift, a narrower torso with a belt.
// v1: side view, facing right. Legs by IK from foot targets on a stride cycle (stance slides
// back, swing lifts forward), arms counter-swing, a 1 px bob. The cape is a spring chain hung from the shoulder and
// simulated in world space: walking, the shoulder moves right at walking speed, so the cape trails and ripples
// behind; `stop` replays the walk before t = 0 and then holds the shoulder still, so the cape swings forward past
// the body and settles over the eight frames. Nothing about the cape is keyed.
export const meta = { brief: 'cloak-walker', pass: 'r3', notes: 'room behind, flared ragged cape with lining, cloth hood' };

const HIP = [19, 26], GROUND = 38, STRIDE = 9, SPEED = 0.03; // px per ms of world motion
const PERIOD = 800;

/** Walk phase pose at time ms (any ms; periodic). */
function body(ctx, ms, walking) {
  const ph = (((ms / PERIOD) % 1) + 1) % 1, bob = walking ? (Math.cos(ph * Math.PI * 4) > 0.5 ? -1 : 0) : 0;
  const foot = (o) => { // stance: forward → back on the ground; swing: back → forward, lifted
    const q = (ph + o) % 1;
    return q < 0.5 ? [STRIDE / 2 - (q / 0.5) * STRIDE, 0] : [-STRIDE / 2 + ((q - 0.5) / 0.5) * STRIDE, -Math.sin(((q - 0.5) / 0.5) * Math.PI) * 3.5];
  };
  const fF = walking ? foot(0) : [1.5, 0], fB = walking ? foot(0.5) : [-1.5, 0], swing = walking ? Math.sin(ph * Math.PI * 2) : 0;
  const root = [HIP[0], HIP[1] + bob];
  const rig = ctx.lib.anim.rig({ root, bones: {
    spine: { len: 9, angle: 180 + (walking ? 6 : 2) }, neck: { parent: 'spine', len: 2.5, angle: 0 },
    armF: { parent: 'spine', at: 0.9, len: 5, angle: 180 - swing * 25 }, foreF: { parent: 'armF', len: 4.5, angle: -15 },
    armB: { parent: 'spine', at: 0.9, len: 5, angle: 180 + swing * 25 }, foreB: { parent: 'armB', len: 4.5, angle: -15 },
    thighF: { offset: [0.5, 0], len: 6.5 }, shinF: { parent: 'thighF', len: 6.5 },
    thighB: { offset: [-0.5, 0], len: 6.5 }, shinB: { parent: 'thighB', len: 6.5 },
  } });
  return rig.pose({}, { ik: { shinF: { target: [HIP[0] + fF[0] + 1, GROUND - 1 + fF[1]], bend: 1 }, shinB: { target: [HIP[0] + fB[0] + 1, GROUND - 1 + fB[1]], bend: 1 } } });
}

function cape(ctx) {
  const walking = ctx.state === 'walk';
  const chain = ctx.lib.anim.spring({ n: 6, len: 3, rest: 0, stiffness: 0.05, damping: 0.14, gravity: 260, seed: 2 });
  // world position of the shoulder: walking moves it right; `stop` walks until 0 ms, then stands
  const rootAt = ms => {
    const walk = walking || ms < 0, p = body(ctx, walking ? ms : Math.min(ms, 0), walk).along('spine', 0.95, -1.6);
    return { pos: [p[0] + SPEED * (walking ? ms : Math.min(ms, 0)), p[1]], angle: 0 };
  };
  return chain.at(ctx.ms, rootAt, { warm: 2400 });
}

export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(...ctx.size), walking = ctx.state === 'walk', p = body(ctx, walking ? ctx.ms : 0, walking);
  const sh = p.along('spine', 0.95, -1.6), pts = cape(ctx).map(([x, y]) => [sh[0] + x, sh[1] + y]);
  // cape: a band along the chain, widening toward the hem
  const left = [], right = [];
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = 0.8 + i * 0.6;
    left.push([q[0] - (dy / l) * w, q[1] + (dx / l) * w]); right.push([q[0] + (dy / l) * w, q[1] - (dx / l) * w]);
  });
  // ragged hem: the hem edge zig-zags between the two sides
  const hem = pts[pts.length - 1], hl = left[left.length - 1], hr = right[right.length - 1];
  const rag = [[hl[0] + (hem[0] - hl[0]) * 0.33, hl[1] + (hem[1] - hl[1]) * 0.33 - 1.2], hem, [hr[0] + (hem[0] - hr[0]) * 0.33, hr[1] + (hem[1] - hr[1]) * 0.33 - 1.2]];
  s.add({ type: 'poly', name: 'cape', pts: [...left, ...rag, ...[...right].reverse()], mat: pal.accent, shade: 'normal', underlay: true });
  s.add({ type: 'tube', name: 'lining', pts: right.slice(1), w: 0.9, w1: 1.4, mat: pal.accent, shade: 'flat', band: 2 });
  const cap = (name, bone, r, mat, r1 = r) => s.add({ type: 'capsule', name, a: p.start(bone), b: p.end(bone), r, r1, mat, shade: 'normal' });
  cap('legB', 'thighB', 1.6, pal.leather); cap('shinB', 'shinB', 1.5, pal.leather, 1.4);
  cap('armB', 'armB', 1.3, pal.cloth); cap('foreB', 'foreB', 1.2, pal.skin);
  s.add({ type: 'capsule', name: 'torso', a: p.along('spine', 0), b: p.along('spine', 0.9), r: 2.6, r1: 2.9, mat: pal.cloth, shade: 'normal', underlay: true });
  s.add({ type: 'capsule', name: 'belt', a: p.along('spine', 0.15, -2.4), b: p.along('spine', 0.15, 2.4), r: 0.7, mat: pal.leather, shade: 'flat', band: 2 });
  const head = p.end('neck');
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'circle', name: 'face', cx: head[0] + 0.8, cy: head[1] + 0.6, r: 2.6, mat: pal.skin, shade: 'sphere', band: 2 },
    { type: 'path', name: 'hood', d: `M${head[0] - 3.6} ${head[1] + 3} Q${head[0] - 3.8} ${head[1] - 4.2} ${head[0] + 1} ${head[1] - 3.6} Q${head[0] + 3.6} ${head[1] - 3} ${head[0] + 2.6} ${head[1] - 0.5} L${head[0] + 0.5} ${head[1] - 1} L${head[0] - 0.5} ${head[1] + 3.5} Z`, mat: pal.cloth, shade: 'normal' },
  ] });
  cap('legF', 'thighF', 1.7, pal.leather); cap('shinF', 'shinF', 1.6, pal.leather, 1.5);
  cap('armF', 'armF', 1.4, pal.cloth); cap('foreF', 'foreF', 1.3, pal.skin);
  return ctx.lib.proc(s).render();
}

export const anchors = ctx => {
  const walking = ctx.state === 'walk', p = body(ctx, walking ? ctx.ms : 0, walking), pts = cape(ctx), sh = p.along('spine', 0.95, -1.6), hem = pts[pts.length - 1];
  return { hand: p.end('foreF').map(Math.round), hem: [Math.round(sh[0] + hem[0]), Math.round(sh[1] + hem[1])] };
};
