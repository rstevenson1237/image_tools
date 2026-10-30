// {{ID}} base.v1 (r1) — template: serpent (snake, eel, naga tail, worm) with four facings and a slither over ctx.t
// (iso camera: a 2D sprite per facing on a 2:1 ground shadow), on the shared serpent rig (`ctx.lib.rigs.body`: a chain of eight segments, a wave travelling headward
// while it moves, the head end rearing). The body is a chain of discs along that wave on the ground; the head rises from the
// front end — at the side in profile (e/w), towards the viewer (s), hidden behind the coils from the back (n). It lies
// on the `ground` anchor: length and girth come from the brief (`height` is how high the head rears), not the frame.
// For a naga, put a humanoid torso on the head end. Adapt the head, the frill or fins, the pattern; role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso serpent rig' };

export const params = {
  scales: { type: 'swap', options: ['grass', 'skin', 'leather', 'cloth'], default: 'grass' },
  girth: { type: 'range', min: 0.7, max: 1.4, default: 1 },
  belly: { type: 'toggle', default: true },
};

// Geometry shared by render() and anchors(): the rig's joints for this state and phase (joint j is the start of segment j,
// joint 0 the head end), the discs resting on the ground and the head at the front end.
function layout(ctx) {
  const [w, h] = ctx.size, X = v => (v * w) / 32, rig = ctx.lib.rigs.body('serpent', ctx, { height: X(7) });
  const { sx, front, side } = rig, P = rig.pose(ctx.state, ctx.t), r = X(2.6) * (ctx.params?.girth ?? 1), headR = r * 1.25;
  const joint = j => (j < 8 ? P.start(`seg${j}`) : P.end('seg7')), head = P.at('seg0', 0, headR * 0.3, 0, headR * 0.1);
  const showFace = front > -0.3, eyePts = !showFace ? [] : (side > 0.9 ? [Math.sign(sx)] : [-1, 1]).map(k => P.at('seg0', 0, headR * 0.65, k * headR * 0.45, headR * 0.15));
  const eyes = eyePts.map(p => Math.round(p[0])).sort((a, b) => a - b), eyeY = Math.round(eyePts.length ? eyePts[0][1] : head[1]);
  const mouth = showFace ? P.at('seg0', 0, headR * 0.6, 0, -headR * 0.4).map(Math.round) : null;
  return { w, h, X, rig, P, sx, front, side, r, headR, joint, head, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), skin = pal[P.scales];
  const { X, P: pose, sx, side, r, headR, joint, head } = L, rest = p => [p[0], p[1] - r];
  const pieces = [];
  // coils: discs on the joints from the tail end up to where the neck lifts, far to near
  for (let j = 3; j <= 8; j++) {
    const c = rest(joint(j));
    pieces.push({ z: pose.depth(`seg${Math.min(j, 7)}`), g: { type: 'group', name: 'body', underlay: true, children: [{ type: 'circle', name: 'coil', cx: c[0], cy: c[1], r: r * (0.7 + 0.3 * (1 - (j - 3) / 5)), mat: skin, shade: 'sphere' }] } });
  }
  const n1 = rest(joint(1)), n2 = rest(joint(2)), n3 = rest(joint(3));
  if (P.belly) pieces.push({ z: pose.depth('seg2'), g: { type: 'group', name: 'body', underlay: true, children: [{ type: 'ellipse', name: 'belly', cx: n3[0], cy: n3[1] + r * 0.35, rx: r * 0.7, ry: r * 0.3, mat: skin, shade: 'flat', band: 0 }] } });
  pieces.push({ z: pose.depth('seg0') + 0.01, g: { type: 'group', name: 'head', underlay: true, children: [
    { type: 'capsule', name: 'neck', a: n3, b: n2, r: r * 0.85, mat: skin, shade: 'cyl' },
    { type: 'capsule', name: 'neck', a: n2, b: n1, r: r * 0.85, mat: skin, shade: 'cyl' },
    { type: 'capsule', name: 'neck', a: n1, b: head, r: r * 0.85, mat: skin, shade: 'cyl' },
    { type: 'ellipse', name: 'skull', cx: head[0] + sx * headR * 0.2, cy: head[1], rx: headR * (1 + 0.3 * side), ry: headR * 0.85, mat: skin, shade: 'sphere' },
  ] } });
  for (const p of pieces.sort((a, b) => a.z - b.z)) s.add(p.g);
  for (const ex of L.eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: L.eyeY, w: 1, h: Math.max(1, Math.round(X(1.2))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'coil', amount: 0.2 }).add('groundShadow', {}).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ...L.rig.anchors(L.P), head: L.head.map(Math.round) };
  delete a.tail;
  a.hand = a.head;
  if (L.front > -0.2) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.2) a.mouth = L.mouth;
  return a;
};
