// {{ID}} base.v1 (r1) — template: low quadruped (wolf, rat, lizard, boar, hound) with four facings and a walk cycle
// (3/4 top-down camera). In profile (e/w) the body is a long barrel on four legs, the head forward; facing the viewer
// (s) or away (n) it foreshortens to a short wide mass with the head (or the tail) in front. The walk moves the legs in
// diagonal pairs over ctx.t. It stands on the `ground` anchor (bottom centre): scale it to the brief's height, not to
// the frame. Adapt the head (snout length, ears, horns), the tail and the coat; role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template quadruped rig' };

export const params = {
  coat: { type: 'swap', options: ['hair', 'leather', 'skin', 'grass'], default: 'hair' },
  snout: { type: 'range', min: 0.6, max: 1.4, default: 1 },
  ears: { type: 'toggle', default: true },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

// Geometry shared by render() and anchors(): body, legs, head and eyes per facing and walk phase.
function layout(ctx) {
  const [w, h] = ctx.size, yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const X = v => (v * w) / 32, cx = w / 2, ground = Math.round(h * 0.95);
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0, bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  // body: long in profile, short and wide end-on
  const legH = X(5), bodyH = X(7), bodyW = X(12) + side * X(12), back = ground - legH - bodyH + bob;
  const headR = X(4.2), headX = cx + sx * (bodyW / 2 + headR * 0.4), headY = back + (side > 0.5 ? X(1) : front > 0 ? bodyH * 0.55 : -X(1));
  const showFace = front > -0.3, snout = X(3) * (ctx.params?.snout ?? 1);
  const eyeY = Math.round(headY - headR * 0.15);
  const eyes = !showFace ? [] : side > 0.9 ? [Math.round(headX + sx * headR * 0.25)] : [Math.round(headX - headR * 0.45), Math.round(headX + headR * 0.35)];
  const mouth = showFace ? [Math.round(side > 0.9 ? headX + sx * (headR * 0.4 + snout * 0.8) : headX - 0.5), Math.round(headY + headR * 0.55)] : null;
  return { w, h, X, cx, ground, sx, front, side, swing, bob, legH, bodyH, bodyW, back, headR, headX, headY, showFace, snout, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), coat = pal[P.coat];
  const { X, cx, ground, sx, front, side, swing, legH, bodyH, bodyW, back, headR, headX, headY, showFace, snout, eyes, eyeY } = L;
  // legs in diagonal pairs: front-left with back-right
  const legW = Math.max(1, X(2.4)), xs = side > 0.5 ? [-0.38, -0.2, 0.2, 0.38] : [-0.34, -0.12, 0.12, 0.34];
  const legs = xs.map((f, i) => {
    const pair = i % 2 ? 1 : -1, lift = pair * swing > 0.3 ? 1 : 0, stride = side > 0.5 ? pair * swing * X(2) : 0;
    return { type: 'rect', x: cx + f * bodyW - legW / 2 + stride, y: ground - legH - 0.5, w: legW, h: legH + 0.5 - lift };
  });
  s.add({ type: 'group', name: 'legs', underlay: true, mat: coat, shade: 'bevel', children: legs });
  // tail behind the body (on top when seen from behind)
  const tail = { type: 'capsule', name: 'tail', a: [cx - sx * bodyW * 0.45, back + bodyH * 0.3], b: [cx - sx * (bodyW * 0.45 + X(5)), back - X(1) + swing], r: Math.max(0.8, X(1.2)), mat: coat, shade: 'cyl' };
  if (front >= -0.2) s.add({ type: 'group', name: 'tail', underlay: true, children: [tail] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx, cy: back + bodyH / 2, rx: bodyW / 2, ry: bodyH / 2, mat: coat, shade: 'normal' },
    { type: 'ellipse', name: 'belly', cx, cy: back + bodyH * 0.75, rx: bodyW * 0.32, ry: bodyH * 0.2, mat: coat, shade: 'flat', band: 0 },
  ] });
  if (front < -0.2) s.add({ type: 'group', name: 'tail', underlay: true, children: [tail] });
  // the head: hidden behind the body from the back, forward in profile, in front facing the viewer
  if (front > -0.6) s.add({ type: 'group', name: 'head', underlay: true, children: [
    ...(P.ears ? [-1, 1].map(k => ({ type: 'path', name: 'ear', d: `M${headX + k * headR * 0.6} ${headY - headR * 0.5} L${headX + k * headR * 0.9} ${headY - headR * 1.5} L${headX + k * headR * 0.15} ${headY - headR * 0.8} Z`, mat: coat, shade: 'flat', band: 2 })) : []),
    { type: 'circle', name: 'skull', cx: headX, cy: headY, r: headR, mat: coat, shade: 'sphere' },
    ...(side > 0.5 ? [{ type: 'ellipse', name: 'snout', cx: headX + sx * (headR * 0.4 + snout / 2), cy: headY + headR * 0.3, rx: snout / 2 + headR * 0.35, ry: headR * 0.5, mat: coat, shade: 'normal' }]
      : showFace ? [{ type: 'ellipse', name: 'snout', cx: headX, cy: headY + headR * 0.45, rx: headR * 0.55, ry: headR * 0.45, mat: coat, shade: 'normal' }] : []),
  ] });
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: eyeY, w: 1, h: Math.max(1, Math.round(X(1.5))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.15 }).render();
}

// Named points per frame: `ground` (where it stands — the export anchor for depth sorting), `head` (effects, bites),
// and the face anchors the finishing pass paints at (only on facings that show the face).
export const anchors = ctx => {
  const L = layout(ctx), a = { ground: [Math.round(L.cx), L.ground], head: [Math.round(L.headX), Math.round(L.headY)], hand: [Math.round(L.headX), Math.round(L.headY)] };
  if (L.front > -0.6) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.6) a.mouth = L.mouth;
  return a;
};
