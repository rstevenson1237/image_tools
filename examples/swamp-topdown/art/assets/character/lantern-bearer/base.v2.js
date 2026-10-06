// lantern-bearer base.v2 (r2) — v1 + a lantern that reads (bigger cage, hot core, glow pixels around it); coat seam removed.
// From the walker template: the player, a hooded wader in a long oilcloth coat
// holding a lantern out on a pole. Facings s, se, e, ne, n (west mirrored); walk swings legs and coat hem.
export const meta = { brief: 'lantern-bearer', pass: 'r2', notes: 'hooded wader, coat to the knee, lantern pole' };

export const params = {
  coat: { type: 'swap', options: ['cloth', 'leather'], default: 'cloth' },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180 };

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx), profile = side > 0.9;
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32;
  const walk = ctx.state === 'walk', ph = ctx.t * Math.PI * 2, swing = walk ? Math.sin(ph) : 0;
  const bob = walk && Math.abs(Math.cos(ph)) > 0.7 ? -1 : 0;
  const top = h * 0.08 + bob, headH = h * hr * 0.85, headW = Math.min(w * 0.55, headH * 1.15) * (1 - 0.1 * side);
  const neck = top + headH * 0.9, foot = h * 0.95, hem = foot - h * 0.14 + bob, coat = pal[P.coat];
  const bodyW = Math.max(X(8), headW * 0.9) * (1 - 0.28 * side);
  // boots under the coat hem
  const legW = bodyW * (profile ? 0.4 : 0.28);
  const legs = profile
    ? [-1, 1].map(k => ({ type: 'rect', x: cx - legW / 2 + k * swing * X(2.5), y: hem - 1, w: legW, h: foot - hem + 1 - (k * swing > 0.3 ? 1 : 0) }))
    : [-1, 1].map(k => ({ type: 'rect', x: cx + (k < 0 ? -bodyW * 0.32 : bodyW * 0.04) + sx * X(1), y: hem - 1, w: legW, h: foot - hem + 1 - (k * swing > 0.3 ? 1 : 0) }));
  s.add({ type: 'group', name: 'boots', underlay: true, mat: pal.leather, shade: 'bevel', children: legs });
  // the lantern pole: held forward on the lit side facing the viewer, leaning ahead in profile
  const handX = cx + (profile ? sx * (bodyW / 2 + X(2)) : -(bodyW / 2 + X(2.5)) * (front >= 0 ? 1 : -1)), handY = neck + (hem - neck) * 0.45;
  const tipX = handX + (profile ? sx * X(4) : -X(1) * Math.sign(front || 1)), tipY = top - X(1);
  const lanternX = tipX + (profile ? sx * X(1.5) : 0), lanternY = tipY + X(3.5);
  const pole = () => {
    s.add({ type: 'tube', name: 'pole', d: `M${handX} ${handY + X(2)} L${tipX} ${tipY}`, w: Math.max(1, X(1.2)), w1: Math.max(1, X(1)), mat: pal.leather, shade: 'flat', band: 1 });
    s.add({ type: 'group', name: 'lantern', underlay: true, children: [
      { type: 'rect', name: 'cap', x: lanternX - X(2), y: lanternY - X(3.5), w: X(4), h: X(1.4), mat: pal.metal, shade: 'flat', band: 1 },
      { type: 'rect', name: 'cage', x: lanternX - X(2.5), y: lanternY - X(2.5), w: X(5), h: X(5.5), r: 0.8, mat: pal.accent, shade: 'sphere' },
      { type: 'rect', name: 'flame', x: lanternX - X(1.2), y: lanternY - X(1.5), w: X(2.4), h: X(3), mat: pal.glow, shade: 'flat', band: 0 },
    ] });
  };
  if (front < -0.2) pole();
  // coat: a trapezoid from shoulders to the hem, the hem swinging with the stride
  const hemW = bodyW * 1.25, hs = swing * X(1) * (profile ? Math.sign(sx) : 0);
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'coat', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + hemW / 2 + hs} ${hem} H${cx - hemW / 2 + hs} Z`, mat: coat, shade: 'linear', round: X(2) },
    { type: 'rect', name: 'belt', x: cx - bodyW / 2 - X(0.3), y: neck + (hem - neck) * 0.42, w: bodyW + X(0.6), h: Math.max(1, X(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
  ] });
  // arms: the pole arm reaches forward; the free arm hangs and swings
  const armX = cx - bodyW / 2 - X(0.5);
  if (profile) s.add({ type: 'capsule', name: 'arm', a: [cx + sx * X(1), neck + X(2)], b: [handX, handY], r: Math.max(1, X(1.5)), mat: coat, shade: 'cyl', underlay: true });
  else s.add({ type: 'group', name: 'arms', underlay: true, mirrorX: cx, children: [
    { type: 'capsule', a: [armX, neck + X(2)], b: [armX - X(0.5), handY], r: Math.max(1, X(1.5)), mat: coat, shade: 'cyl' },
  ] });
  // hooded head: hood mass, a shadowed face opening toward the facing side
  const fx = sx * headW * 0.2, fw = headW * (0.6 - 0.25 * side);
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'path', name: 'hood', d: `M${cx - headW / 2 - X(0.5)} ${neck + X(1)} Q${cx - headW / 2 - X(1)} ${top} ${cx - fx * 0.3} ${top - X(0.5)} Q${cx + headW / 2 + X(1)} ${top} ${cx + headW / 2 + X(0.5)} ${neck + X(1)} Z`, mat: coat, shade: 'sphere' },
    ...(front > -0.3 ? [{ type: 'ellipse', name: 'face', cx: cx + fx, cy: top + headH * 0.58, rx: fw / 2, ry: headH * 0.27, mat: pal.skin, shade: 'flat', band: 1 }] : []),
  ] });
  if (front > -0.3) {
    const eyes = profile ? [cx + fx + fw * 0.15] : [cx + fx - fw * 0.25, cx + fx + fw * 0.18];
    for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: Math.round(ex), y: Math.round(top + headH * 0.55), w: 1, h: 1, color: 'outline' });
  }
  if (front >= -0.2) pole();
  const g = ctx.lib.proc(s).add('materialNoise', { part: 'coat', amount: 0.15 }).render();
  // the lantern's light: glow pixels on the empty cells around the cage (the one warm light in the scene)
  const gx = Math.round(lanternX), gy = Math.round(lanternY), c = ctx.dir.pal.glow[1];
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -5], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]]) if (!g.get(gx + dx, gy + dy)) g.set(gx + dx, gy + dy, c);
  return g;
}

export const anchors = ctx => {
  const yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, [w, h] = ctx.size;
  return { head: [Math.round(w / 2 + Math.sin(yaw) * w * 0.07), Math.round(h * 0.2)] };
};
