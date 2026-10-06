// wheelchair base.v3 (r3) — v2 + a frame tube from the seat to the wheel hub (the seat floated). v2: v1 with a thinner tyre, 1px dark spokes and a smaller wheel, and the wicker seat raised
// clear of it so the weave shows. v1: written for the brief: an old wheelchair seen from the side (billboard). A big spoked wheel
// (ring + spokes), a small front caster, a wicker seat and back (wood with a grid weave), push handles and a footrest.
export const meta = { brief: 'wheelchair', pass: 'r3', notes: 'big spoked wheel, caster, wicker seat + back' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const wx = X(12), wy = Y(22), R = X(7);
  s.add({ type: 'group', name: 'chair', underlay: true, children: [
    { type: 'rect', name: 'back', x: X(6), y: Y(3), w: X(3.5), h: Y(12), mat: pal.wood, shade: 'flat', band: 1 },
    { type: 'rect', name: 'seat', x: X(6), y: Y(12), w: X(15), h: Y(3), mat: pal.wood, shade: 'flat', band: 0 },
    { type: 'rect', name: 'handle', x: X(3), y: Y(3), w: X(4), h: Y(1.4), mat: pal.metal, shade: 'flat', band: 1 },
    { type: 'tube', name: 'leg', d: `M${X(20)} ${Y(14)} L${X(24)} ${Y(26)} L${X(27)} ${Y(26)}`, w: X(1.3), mat: pal.metal, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'ring', name: 'tyre', cx: wx, cy: wy, r: R, w: X(1), mat: pal.metal, shade: 'flat', band: 2, underlay: true });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; s.add({ type: 'tube', name: 'spoke', d: `M${wx - Math.cos(a) * R} ${wy - Math.sin(a) * R} L${wx + Math.cos(a) * R} ${wy + Math.sin(a) * R}`, w: 0.6, mat: pal.metal, shade: 'flat', band: 2 }); }
  s.add({ type: 'tube', name: 'frame', d: `M${X(9)} ${Y(15)} L${wx} ${wy}`, w: X(1.1), mat: pal.metal, shade: 'flat', band: 1 });
  s.add({ type: 'circle', name: 'hub', cx: wx, cy: wy, r: X(1.3), mat: pal.metal, shade: 'flat', band: 0 });
  s.add({ type: 'circle', name: 'caster', cx: X(25), cy: Y(27.5), r: X(1.8), mat: pal.metal, shade: 'flat', band: 2 });
  return ctx.lib.proc(s).add('pattern', { part: ['seat', 'back'], type: 'grid', period: 2, step: 1 }).render();
}
