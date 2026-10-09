// pistol base.v1 (r1) — from the fp/viewmodel template: a first-person view-model (P6d): the weapon and the hand holding it, seen from behind
// the player, anchored to the bottom of the frame (the runtime draws it over the bottom centre of the screen).
// `idle` breathes (a 1 px bob); `fire` = muzzle flash on frame 0 (the `muzzle` particle preset at the `muzzle`
// anchor), recoil kick up and back on frames 1-2, settle on frame 3. Draw it large and simple — it fills a third of
// the screen — with the light from above.
export const meta = { brief: 'pistol', pass: 'r1', notes: 'template view-model: pistol in hand' };

function layout(ctx) {
  const [w, h] = ctx.size, kick = ctx.state === 'fire' ? [0, 4, 2, 0.5][ctx.frame] ?? 0 : 0, bob = ctx.state === 'idle' ? ctx.frame : 0;
  const x = w / 2 + 2, y = h * 0.42 + kick * 0.6 + bob, tilt = -kick * 3;
  return { w, h, x, y, kick, tilt, muzzle: [x, y - h * 0.16] };
}

export function render(ctx) {
  const { pal } = ctx.dir, L = layout(ctx), { w, h, x, y } = L, s = ctx.lib.t2.scene(w, h);
  s.add({ type: 'group', name: 'gun', underlay: true, rotate: L.tilt, origin: [x, y + h * 0.3], children: [
    { type: 'rect', name: 'slide', x: x - 3, y: y - h * 0.16, w: 6, h: h * 0.3, mat: pal.metal, shade: 'cyl', axis: 'y' },
    { type: 'rect', name: 'sight', x: x - 0.5, y: y - h * 0.16 - 1, w: 1, h: 1.5, mat: pal.metal, shade: 'flat', band: 0 },
    { type: 'path', name: 'grip', d: `M${x - 3.5} ${y + h * 0.1} H${x + 3.5} L${x + 4.5} ${h} H${x - 4.5} Z`, mat: pal.wood, shade: 'normal' },
  ] });
  s.add({ type: 'path', name: 'hand', d: `M${x - 9} ${h} Q${x - 9} ${y + h * 0.12} ${x - 3} ${y + h * 0.16} L${x + 4} ${y + h * 0.2} Q${x + 9} ${y + h * 0.3} ${x + 9} ${h} Z`, mat: pal.skin, shade: 'normal' });
  let g = ctx.lib.proc(s).render();
  if (ctx.state === 'fire' && ctx.frame === 0) {
    const fl = ctx.lib.fx.particles(ctx.lib.fx.preset('muzzle', { w, h, duration: 200, origin: L.muzzle, angle: 180, colors: ['glow', 'accent'] }), { w, h, t: 0.15, duration: 200 });
    g = fl.stamp(g);
  }
  return g;
}

export const anchors = ctx => ({ muzzle: layout(ctx).muzzle.map(Math.round) });
