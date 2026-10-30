// {{ID}} base.v1 (r1) — template: very large creature (dragon, giant beast, golem on all fours, ogre-sized brute) with
// four facings and a heavy walk over ctx.t (3/4 top-down camera), on the shared quadruped rig with the `large` proportions
// (`ctx.lib.rigs.body`). A massive body low on four thick legs, a long neck raising the head above the shoulders, a tail and
// optional wings folded on the back. Brief it on a large frame (`--size large` or WxH) with its real height: a 4 m dragon
// must come out at 4 m × px per metre — the height check fails characters and creatures more than 15 % off. `ground` is
// where it stands. Role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template large-creature rig' };

export const params = {
  hide: { type: 'swap', options: ['accent', 'leather', 'grass', 'hair'], default: 'accent' },
  belly: { type: 'swap', options: ['skin', 'leather', 'dirt'], default: 'skin' },
  wings: { type: 'toggle', default: true },
  neck: { type: 'range', min: 0.6, max: 1.4, default: 1 },
};

// Geometry shared by render() and anchors(): the rig's pose for this state and phase, the head at the neck's end, the eyes.
function layout(ctx) {
  const [w, h] = ctx.size, U = v => (v * Math.min(w, h)) / 64, ground = Math.round(h * 0.96);
  // the neck parameter is the drawn neck's length: it changes the proportion of the whole asset, so it is fixed per asset, not per cell
  const rig = ctx.lib.rigs.body('large', ctx, { height: U(28), ground, proportions: { neck: 0.55 * (ctx.params?.neck ?? 1) } });
  const { sx, front, side } = rig, P = rig.pose(ctx.state, ctx.t), headR = U(6), showFace = front > -0.3;
  const skull = P.at('head', 0.3), eyePts = !showFace ? [] : (side > 0.9 ? [Math.sign(sx)] : [-1, 1]).map(k => P.at('head', 0.3, headR * 0.45, k * headR * 0.45, headR * 0.1));
  const eyes = eyePts.map(p => Math.round(p[0])).sort((a, b) => a - b), eyeY = Math.round(eyePts.length ? eyePts[0][1] : skull[1]);
  const mouth = showFace ? P.at('head', 0.6, headR * 0.3, 0, -headR * 0.6).map(Math.round) : null;
  return { w, h, U, rig, P, sx, front, side, ground, headR, skull, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), hide = pal[P.hide];
  const { U, rig, P: pose, sx, side, headR, skull } = L, bodyH = U(18), r = U(3);
  const limb = (n, k = 1) => ({ type: 'capsule', a: pose.start(n), b: pose.end(n), r: r * k, mat: hide, shade: 'cyl' });
  const pieces = [];
  for (const e of ['FL', 'FR', 'BL', 'BR']) pieces.push({ z: pose.depth(`leg${e}_up`), g: { type: 'group', name: 'legs', underlay: true, children: [limb(`leg${e}_up`), limb(`leg${e}_lo`, 0.95)] } });
  pieces.push({ z: pose.depth('tail') - 0.01, g: { type: 'group', name: 'tail', underlay: true, children: [{ type: 'capsule', name: 'tail', a: pose.start('tail'), b: pose.end('tail'), r, mat: hide, shade: 'cyl' }] } });
  const mid = pose.at('spine', 0.5), rx = U(13) * (1 - side) + (rig.lengths.spine / 2 + U(7)) * side, ry = bodyH / 2 + (1 - side) * rig.lengths.spine * 0.15;
  const wings = P.wings ? [-1, 1].map(k => { const b = pose.at('spine', 0.5, 0, k * U(4), bodyH * 0.4), t = pose.at('spine', 0.5, -U(1), k * (U(9) + side * 0), bodyH * 0.4 + U(14)); return { type: 'path', name: 'wing', d: `M${b[0] - U(3)} ${b[1]} L${t[0]} ${t[1]} L${b[0] + U(5)} ${b[1] + U(2)} Z`, mat: pal.leather, shade: 'flat', band: 1 }; }) : [];
  pieces.push({ z: 0, g: { type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx: mid[0], cy: mid[1], rx, ry, mat: hide, shade: 'normal' },
    { type: 'ellipse', name: 'belly', cx: mid[0] + sx * U(2), cy: mid[1] + ry * 0.45, rx: rx * 0.6, ry: ry * 0.4, mat: pal[P.belly], shade: 'normal' },
    ...wings,
  ] } });
  const horns = [-1, 1].map(k => { const a = pose.at('head', 0.2, 0, k * headR * 0.5, headR * 0.6); return { type: 'path', name: 'horn', d: `M${a[0]} ${a[1]} L${a[0] + k * headR * 0.45 - sx * U(3)} ${a[1] - headR * 1.1} L${a[0] - k * headR * 0.4} ${a[1] - headR * 0.2} Z`, mat: pal[P.belly], shade: 'flat', band: 0 }; });
  const sn = pose.at('head', 0.55, 0, 0, -headR * 0.2);
  pieces.push({ z: pose.depth('head') + 0.01, g: { type: 'group', name: 'head', underlay: true, children: [
    { type: 'capsule', name: 'neck', a: pose.start('neck'), b: pose.end('neck'), r: U(4), mat: hide, shade: 'cyl' },
    { type: 'ellipse', name: 'skull', cx: skull[0], cy: skull[1], rx: headR * (1 + 0.5 * side), ry: headR * 0.8, mat: hide, shade: 'sphere' },
    ...(side > 0.5 ? [{ type: 'ellipse', name: 'snout', cx: sn[0], cy: sn[1], rx: headR * 0.8, ry: headR * 0.45, mat: hide, shade: 'normal' }] : []),
    ...horns,
  ] } });
  for (const p of pieces.sort((a, b) => a.z - b.z)) s.add(p.g);
  for (const ex of L.eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: L.eyeY, w: 1, h: Math.max(1, Math.round(U(2))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.2 }).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ...L.rig.anchors(L.P), head: L.skull.map(Math.round) };
  delete a.tail;
  a.hand = a.head;
  if (L.front > -0.2) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.2) a.mouth = L.mouth;
  return a;
};
