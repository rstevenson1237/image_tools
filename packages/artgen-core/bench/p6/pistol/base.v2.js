// pistol base.v2 (r2) — from v1 (4): the template's peg of a gun. Now a pistol seen from behind and above, drawn big:
// a slide in perspective (wide at the rear, narrowing toward the muzzle up the screen) with its right flank in shade,
// rear sight notch and front blade, the dark muzzle hole at the front; a gloved hand wrapped round the grip, thumb
// over the left, a sleeve cuff at the bottom edge. Fire: a big muzzle flash on frame 0 (the `muzzle` preset at the
// `muzzle` anchor, scaled to the gun), kick up and back on 1–2, settle on 3; idle bobs 1 px.
export const meta = { brief: 'pistol', pass: 'r2', notes: 'big perspective slide, gloved hand, bigger flash' };

function layout(ctx) {
  const [w, h] = ctx.size, kick = ctx.state === 'fire' ? [1, 5, 3, 1][ctx.frame] ?? 0 : 0, bob = ctx.state === 'idle' ? ctx.frame : 0;
  const cx = w / 2 + 3, top = 10 - kick + bob, rear = 30 - kick * 0.6 + bob;
  return { w, h, cx, top, rear, kick, muzzle: [cx, top - 1] };
}

export function render(ctx) {
  const { pal } = ctx.dir, L = layout(ctx), { w, h, cx, top, rear } = L, s = ctx.lib.t2.scene(w, h);
  s.add({ type: 'group', name: 'gun', underlay: true, rotate: -L.kick * 2, origin: [cx, h], children: [
    // slide: top face (lit) and right flank (shade)
    { type: 'poly', name: 'slideTop', pts: [[cx - 4, top], [cx + 4, top], [cx + 7, rear], [cx - 7, rear]], mat: pal.metal, shade: 'linear' },
    { type: 'poly', name: 'slideSide', pts: [[cx + 4, top], [cx + 5.5, top + 2], [cx + 8.5, rear + 3], [cx + 7, rear]], mat: pal.metal, shade: 'flat', band: 2 },
    { type: 'rect', name: 'rib', x: cx - 1, y: top + 2, w: 2, h: rear - top - 3, mat: pal.metal, shade: 'flat', band: 1 },
    { type: 'ellipse', name: 'muzzle', cx, cy: top + 0.8, rx: 1.6, ry: 1, color: 'hair.2' },
    { type: 'rect', name: 'frontSight', x: cx - 0.5, y: top - 1.5, w: 1, h: 2, mat: pal.metal, shade: 'flat', band: 0 },
    { type: 'path', name: 'rearSight', d: `M${cx - 5} ${rear - 3} H${cx - 1.2} V${rear - 1.5} H${cx + 1.2} V${rear - 3} H${cx + 5} V${rear} H${cx - 5} Z`, mat: pal.metal, shade: 'flat', band: 2 },
    { type: 'path', name: 'grip', d: `M${cx - 6} ${rear} H${cx + 7} L${cx + 9} ${h} H${cx - 5} Z`, mat: pal.wood, shade: 'normal' },
  ] });
  // gloved hand round the grip: palm and fingers on the right, thumb over the left of the frame
  s.add({ type: 'group', name: 'hand', underlay: true, children: [
    { type: 'path', name: 'glove', d: `M${cx - 9} ${h} Q${cx - 11} ${rear + 4} ${cx - 6} ${rear + 1} L${cx + 6} ${rear + 3} Q${cx + 12} ${rear + 6} ${cx + 12} ${h} Z`, mat: pal.leather, shade: 'normal' },
    { type: 'capsule', name: 'thumb', a: [cx - 7, rear + 4], b: [cx - 2, rear - 1], r: 1.8, r1: 1.4, mat: pal.leather, shade: 'normal' },
    ...[0, 1, 2].map(i => ({ type: 'capsule', name: 'finger', a: [cx + 9.5, rear + 4 + i * 3], b: [cx + 5, rear + 5 + i * 3], r: 1.3, mat: pal.leather, shade: 'normal' })),
    { type: 'rect', name: 'cuff', x: cx - 11, y: h - 4, w: 24, h: 4, mat: pal.cloth, shade: 'cyl', axis: 'x' },
  ] });
  let g = ctx.lib.proc(s).render();
  if (ctx.state === 'fire' && ctx.frame <= 1) {
    const fl = ctx.lib.fx.particles(ctx.lib.fx.preset('muzzle', { w, h, duration: 200, origin: L.muzzle, angle: 180, scale: ctx.frame ? 0.55 : 0.9, colors: ['glow', 'accent'] }), { w, h, t: ctx.frame ? 0.45 : 0.12, duration: 200 });
    g = g.stamp(fl);
  }
  return g;
}

export const anchors = ctx => ({ muzzle: layout(ctx).muzzle.map(Math.round) });
