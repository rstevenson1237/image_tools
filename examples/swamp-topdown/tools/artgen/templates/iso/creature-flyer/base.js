// {{ID}} base.v1 (r1) — template: flyer (bat, wasp, bird, imp, small drake) with four facings and a wingbeat over ctx.t
// (iso camera: a 2D sprite per facing), on the shared flyer rig (`ctx.lib.rigs.body`: body, head, tail and two two-bone wings that beat on
// every state). A small body hovers above its ground shadow; two wings beat on every state (flyers never stand still), a bob
// follows the beat. Seen from the front (s) or back (n) the wings spread to both sides; in profile (e/w) the near wing
// sweeps over the body and the far one shows behind it. `ground` is the shadow under it, `head` the head. For a swarm,
// draw three to five small bodies at offsets instead of one. Role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso flyer rig' };

export const params = {
  body: { type: 'swap', options: ['hair', 'leather', 'skin', 'accent'], default: 'hair' },
  wing: { type: 'swap', options: ['leather', 'cloth', 'skin', 'glow'], default: 'leather' },
  span: { type: 'range', min: 0.7, max: 1.3, default: 1 },
};

// Geometry shared by render() and anchors(): the rig's pose for this phase of the beat, the head and the eyes on it.
function layout(ctx) {
  const [w, h] = ctx.size, X = v => (v * w) / 32, span = ctx.params?.span ?? 1;
  const rig = ctx.lib.rigs.body('flyer', ctx, { height: X(8), tilt: 0.55, proportions: { wing: 0.75 * span, wing_tip: 0.75 * span } });
  const { sx, front, side } = rig, P = rig.pose(ctx.state, ctx.t), bodyR = X(3.2), headR = bodyR * 0.75, head = P.at('head', 0.5), showFace = front > -0.3;
  const eyePts = !showFace ? [] : (side > 0.9 ? [Math.sign(sx)] : [-1, 1]).map(k => P.at('head', 0.5, headR * 0.5, k * headR * 0.45, headR * 0.1));
  const eyes = eyePts.map(p => Math.round(p[0])).sort((a, b) => a - b), eyeY = Math.round(eyePts.length ? eyePts[0][1] : head[1]);
  const mouth = showFace ? P.at('head', 0.5, headR * 0.5, 0, -headR * 0.6).map(Math.round) : null;
  return { w, h, X, rig, P, sx, front, side, bodyR, headR, head, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx);
  const { X, rig, P: pose, side, bodyR, headR, head } = L, body = pose.at('body', 0.5);
  const pieces = [];
  // wings: shoulder, elbow, tip, and a trailing edge behind and below them
  for (const k of ['L', 'R']) {
    const a = pose.start(`wing${k}`), m = pose.end(`wing${k}`), t = pose.end(`wing${k}_tip`), wd = (k === 'L' ? 1 : -1) * X(2.6) * Math.abs(L.front), prof = side > 0.5;
    const b = prof ? pose.at(`wing${k}_tip`, 0.5, -X(3.2), 0, -X(1)) : pose.along(`wing${k}_tip`, 0.5, wd), c = prof ? pose.at(`wing${k}`, 0.5, -X(2.4), 0, -X(0.6)) : pose.along(`wing${k}`, 0.5, wd);
    pieces.push({ z: pose.depth(`wing${k}`), g: { type: 'group', name: 'wings', underlay: true, children: [{ type: 'path', name: 'wing', d: `M${a[0]} ${a[1]} L${m[0]} ${m[1]} L${t[0]} ${t[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]} Z`, mat: pal[P.wing], shade: 'flat', band: 1 }] } });
  }
  pieces.push({ z: 0, g: { type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx: body[0], cy: body[1], rx: bodyR * (1 + 0.3 * side), ry: bodyR, mat: pal[P.body], shade: 'sphere' },
    ...(L.front > -0.6 ? [{ type: 'circle', name: 'head', cx: head[0], cy: head[1], r: headR, mat: pal[P.body], shade: 'sphere' }] : []),
  ] } });
  for (const p of pieces.sort((a, b) => a.z - b.z)) s.add(p.g);
  for (const ex of L.eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: L.eyeY, w: 1, h: 1, color: 'outline' });
  // the shadow on the ground under it says how high it flies
  return ctx.lib.proc(s).add('groundShadow', { cx: ctx.size[0] / 2, cy: rig.ground - 1, rx: Math.max(2, X(4)) }).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ...L.rig.anchors(L.P), head: L.head.map(Math.round) };
  a.hand = a.head;
  if (L.front > -0.6) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.6) a.mouth = L.mouth;
  return a;
};
