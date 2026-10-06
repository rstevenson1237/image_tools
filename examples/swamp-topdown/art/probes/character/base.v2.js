// probe-character base.v2 (r2) — from v1 (template humanoid): Bogwatch's lantern-bearer. Hooded cloak that widens to
// the hem (the silhouette reads as a cloaked wader at 1x), face lost in the hood's shadow, two eye glints catching the lantern, the lantern
// held out on the lit side (accent frame, glow glass), wading boots, a wet hem band.
export const meta = { brief: 'probe-character', pass: 'r2', notes: 'lantern-bearer: hood, flared cloak, held lantern, wet hem' };

export const params = {
  cloak: { type: 'swap', options: ['cloth', 'leather'], default: 'cloth' },
  hood: { type: 'toggle', default: true, p: 0.8 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const top = Y(2), headH = h * hr * 0.85, neck = top + headH * 0.9, foot = Y(30.5), hem = Y(26), cloak = pal[P.cloak];
  const half = Math.max(X(6), headH * 0.55);
  s.add({ type: 'group', name: 'boots', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: cx - X(4.5), y: hem - Y(1), w: X(3.5), h: foot - hem + Y(1) },
    { type: 'rect', x: cx + X(1), y: hem - Y(1), w: X(3.5), h: foot - hem + Y(1) },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'cloak', d: `M${cx - half * 0.8} ${neck} H${cx + half * 0.8} L${cx + half + X(1.5)} ${hem} Q${cx} ${hem + Y(1.5)} ${cx - half - X(1.5)} ${hem} Z`, mat: cloak, shade: 'cyl', axis: 'y' },
    { type: 'rect', name: 'hem', x: cx - half - X(1), y: hem - Y(1.5), w: 2 * half + X(2), h: Math.max(1, Y(1.2)), mat: pal.dirt, shade: 'flat', band: 1 },
    { type: 'rect', name: 'clasp', x: cx - X(1), y: neck + Y(0.5), w: X(2), h: Math.max(1, Y(1.2)), mat: pal.metal, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'capsule', name: 'arm', a: [cx + half * 0.8, neck + Y(2)], b: [cx + half + X(0.5), neck + Y(7)], r: Math.max(1, X(1.6)), mat: cloak, shade: 'cyl', underlay: true });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hood', cx, cy: top + headH * 0.5, rx: headH * 0.55, ry: headH * 0.52, mat: P.hood ? cloak : pal.hair, shade: 'sphere' },
    { type: 'ellipse', name: 'face', cx, cy: top + headH * 0.66, rx: headH * 0.24, ry: headH * 0.2, mat: pal.hair, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'rect', name: 'eye', x: cx - X(1.6), y: top + headH * 0.62, w: 1, h: 1, color: 'glow.0', mirrorX: cx });
  // the lantern: held out on the viewer's left (the lit side), hanging from a short pole
  const lx = cx - half - X(3.5), ly = neck + Y(5);
  s.add({ type: 'capsule', name: 'arm-l', a: [cx - half * 0.8, neck + Y(2)], b: [lx + X(1.5), ly - Y(2.5)], r: Math.max(1, X(1.6)), mat: cloak, shade: 'cyl', underlay: true });
  s.add({ type: 'group', name: 'lantern', underlay: true, children: [
    { type: 'rect', name: 'lantern-frame', x: lx - X(2), y: ly - Y(1.5), w: X(4), h: Y(5.5), r: 0.5, mat: pal.metal, shade: 'flat', band: 2 },
    { type: 'rect', name: 'lantern-glass', x: lx - X(1.2), y: ly - Y(0.5), w: X(2.4), h: Y(3.5), mat: pal.glow, shade: 'sphere' },
    { type: 'rect', name: 'lantern-cap', x: lx - X(1.5), y: ly - Y(2.5), w: X(3), h: Math.max(1, Y(1.2)), mat: pal.accent, shade: 'flat', band: 1 },
  ] });
  return ctx.lib.proc(s).add('materialNoise', { part: 'cloak', amount: 0.18 }).add('groundShadow', {}).render();
}

export const anchors = ctx => ({ lantern: [Math.round(ctx.size[0] / 2 - ctx.size[0] * 0.33), Math.round(ctx.size[1] * 0.5)] });
