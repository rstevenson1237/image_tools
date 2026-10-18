// {{ID}} base.v1 (r1) — template: very large creature (dragon, giant beast, golem on all fours, ogre-sized brute) with
// four facings and a heavy walk over ctx.t (iso camera: a 2D sprite per facing on a 2:1 ground shadow). A massive body low on four thick legs, a long neck
// raising the head above the shoulders, a tail and optional wings folded on the back. Brief it on a large frame
// (`--size large` or WxH) with its real height: a 4 m dragon must come out at 4 m × px per metre — the height check
// fails characters and creatures more than 15 % off. `ground` is where it stands. Role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso large-creature rig' };

export const params = {
  hide: { type: 'swap', options: ['accent', 'leather', 'grass', 'hair'], default: 'accent' },
  belly: { type: 'swap', options: ['skin', 'leather', 'dirt'], default: 'skin' },
  wings: { type: 'toggle', default: true },
  neck: { type: 'range', min: 0.6, max: 1.4, default: 1 },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

function layout(ctx) {
  const [w, h] = ctx.size, yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const U = v => (v * Math.min(w, h)) / 64, cx = w / 2, ground = Math.round(h * 0.96);
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0, bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  // heavy proportions: legs short and thick, the body a wide barrel, the neck long
  const legH = U(10), legW = U(6), bodyH = U(18), bodyW = U(26) + side * U(16), back = ground - legH - bodyH + bob;
  const neckLen = U(16) * (ctx.params?.neck ?? 1), headR = U(6);
  const shoulder = [cx + sx * bodyW * 0.38, back + bodyH * 0.25];
  const headX = shoulder[0] + sx * neckLen * 0.55, headY = Math.max(headR + 1, back - neckLen * (side > 0.5 ? 0.6 : 0.75));
  const showFace = front > -0.3, eyeY = Math.round(headY - headR * 0.15);
  const eyes = !showFace ? [] : side > 0.9 ? [Math.round(headX + sx * headR * 0.3)] : [Math.round(headX - headR * 0.45), Math.round(headX + headR * 0.35)];
  const mouth = showFace ? [Math.round(side > 0.9 ? headX + sx * headR * 1.1 : headX - 0.5), Math.round(headY + headR * 0.55)] : null;
  return { w, h, U, cx, ground, sx, front, side, swing, legH, legW, bodyH, bodyW, back, neckLen, headR, shoulder, headX, headY, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), hide = pal[P.hide];
  const { U, cx, ground, sx, front, side, swing, legH, legW, bodyH, bodyW, back, headR, shoulder, headX, headY, eyes, eyeY } = L;
  const xs = side > 0.5 ? [-0.36, -0.18, 0.2, 0.38] : [-0.36, -0.14, 0.14, 0.36];
  s.add({ type: 'group', name: 'legs', underlay: true, mat: hide, shade: 'bevel', children: xs.map((f, i) => {
    const pair = i % 2 ? 1 : -1, lift = pair * swing > 0.3 ? 1 : 0, stride = side > 0.5 ? pair * swing * U(3) : 0;
    return { type: 'rect', x: cx + f * bodyW - legW / 2 + stride, y: ground - legH - 1, w: legW, h: legH + 1 - lift, round: U(1.5) };
  }) });
  const tail = { type: 'capsule', name: 'tail', a: [cx - sx * bodyW * 0.4, back + bodyH * 0.45], b: [cx - sx * (bodyW * 0.4 + U(18)), ground - U(4) + swing], r: U(3), mat: hide, shade: 'cyl' };
  const wings = P.wings ? [-1, 1].map(k => ({ type: 'path', name: 'wing', d: `M${cx + k * U(4)} ${back + U(2)} L${cx + k * (bodyW * 0.3 + U(8))} ${back - U(14)} L${cx + k * (bodyW * 0.3 + U(4))} ${back + U(4)} Z`, mat: pal.leather, shade: 'flat', band: 1 })) : [];
  const neckHead = { type: 'group', name: 'head', underlay: true, children: [
    { type: 'capsule', name: 'neck', a: shoulder, b: [headX, headY + headR * 0.4], r: U(4), mat: hide, shade: 'cyl' },
    { type: 'ellipse', name: 'skull', cx: headX + sx * headR * 0.4, cy: headY, rx: headR * (1 + 0.5 * side), ry: headR * 0.8, mat: hide, shade: 'sphere' },
    ...[-1, 1].map(k => ({ type: 'path', name: 'horn', d: `M${headX + k * headR * 0.5} ${headY - headR * 0.5} L${headX + k * headR * 0.9 - sx * U(3)} ${headY - headR * 1.6} L${headX + k * headR * 0.1} ${headY - headR * 0.7} Z`, mat: pal[P.belly], shade: 'flat', band: 0 })),
  ] };
  if (front < -0.2) s.add({ type: 'group', name: 'front', underlay: true, children: [neckHead] });
  else s.add({ type: 'group', name: 'tail', underlay: true, children: [tail] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx, cy: back + bodyH / 2, rx: bodyW / 2, ry: bodyH / 2, mat: hide, shade: 'normal' },
    { type: 'ellipse', name: 'belly', cx: cx + sx * U(2), cy: back + bodyH * 0.72, rx: bodyW * 0.3, ry: bodyH * 0.22, mat: pal[P.belly], shade: 'normal' },
    ...wings,
  ] });
  if (front < -0.2) s.add({ type: 'group', name: 'tail', underlay: true, children: [tail] });
  else s.add(neckHead);
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: eyeY, w: 1, h: Math.max(1, Math.round(U(2))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.2 }).add('groundShadow', {}).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ground: [Math.round(L.cx), L.ground], head: [Math.round(L.headX), Math.round(L.headY)], hand: [Math.round(L.headX), Math.round(L.headY)] };
  if (L.front > -0.2) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.2) a.mouth = L.mouth;
  return a;
};
