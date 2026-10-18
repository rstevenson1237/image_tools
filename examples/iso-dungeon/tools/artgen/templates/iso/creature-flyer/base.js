// {{ID}} base.v1 (r1) — template: flyer (bat, wasp, bird, imp, small drake) with four facings and a wingbeat over ctx.t
// (iso camera: a 2D sprite per facing). A small body hovers above its ground shadow; two wings beat on every state (flyers never
// stand still), a bob follows the beat. Seen from the front (s) or back (n) the wings spread to both sides; in profile
// (e/w) the near wing sweeps over the body and the far one shows behind it. `ground` is the shadow under it, `head` the
// head. For a swarm, draw three to five small bodies at offsets instead of one. Role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso flyer rig' };

export const params = {
  body: { type: 'swap', options: ['hair', 'leather', 'skin', 'accent'], default: 'hair' },
  wing: { type: 'swap', options: ['leather', 'cloth', 'skin', 'glow'], default: 'leather' },
  span: { type: 'range', min: 0.7, max: 1.3, default: 1 },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

function layout(ctx) {
  const [w, h] = ctx.size, yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const X = v => (v * w) / 32, cx = w / 2, ground = Math.round(h * 0.95), ph = ctx.t * Math.PI * 2, beat = Math.sin(ph);
  const lift = X(9) + Math.round(beat * X(1)), bodyR = X(3.2), cy = ground - lift - bodyR, span = X(12) * (ctx.params?.span ?? 1);
  const headR = bodyR * 0.75, headX = cx + sx * bodyR * 0.9, headY = cy - bodyR * (side > 0.5 ? 0.4 : 0.9);
  const showFace = front > -0.3, eyeY = Math.round(headY);
  const eyes = !showFace ? [] : side > 0.9 ? [Math.round(headX + sx * headR * 0.35)] : [Math.round(headX - headR * 0.45), Math.round(headX + headR * 0.35)];
  const mouth = showFace ? [Math.round(side > 0.9 ? headX + sx * headR * 0.6 : headX - 0.5), Math.round(headY + headR * 0.6)] : null;
  return { w, h, X, cx, cy, ground, sx, front, side, beat, bodyR, span, headR, headX, headY, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx);
  const { X, cx, cy, sx, front, side, beat, bodyR, span, headR, headX, headY, eyes, eyeY } = L;
  // wing tips swing from up (beat 1) to down (beat -1)
  const tipY = cy - beat * X(6), wing = (k, reach) => ({ type: 'path', name: 'wing', d: `M${cx + k * bodyR * 0.4} ${cy - bodyR * 0.3} L${cx + k * reach} ${tipY} L${cx + k * reach * 0.7} ${cy + X(2)} L${cx + k * reach * 0.35} ${cy + X(0.5)} Z`, mat: pal[P.wing], shade: 'flat', band: 1 });
  const wings = side > 0.5 ? [wing(-Math.sign(sx), span * 0.45), wing(Math.sign(sx) * -1, span * 0.25)] : [wing(-1, span), wing(1, span)];
  s.add({ type: 'group', name: 'wings', underlay: true, children: side > 0.5 ? [wings[0]] : wings });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx, cy, rx: bodyR * (1 + 0.3 * side), ry: bodyR, mat: pal[P.body], shade: 'sphere' },
    ...(front > -0.6 ? [{ type: 'circle', name: 'head', cx: headX, cy: headY, r: headR, mat: pal[P.body], shade: 'sphere' }] : []),
  ] });
  if (side > 0.5) s.add({ type: 'group', name: 'near-wing', underlay: true, children: [wings[1]] });
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: eyeY, w: 1, h: 1, color: 'outline' });
  // the shadow on the ground under it says how high it flies
  return ctx.lib.proc(s).add('groundShadow', { cx, cy: L.ground - 1, rx: Math.max(2, X(4)) }).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ground: [Math.round(L.cx), L.ground], head: [Math.round(L.headX), Math.round(L.headY)], hand: [Math.round(L.headX), Math.round(L.headY)] };
  if (L.front > -0.6) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.6) a.mouth = L.mouth;
  return a;
};
