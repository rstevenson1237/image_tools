// iron-bed base.v2 (r2) — v1 + a pillow at the head end, a sag line across the mattress, the stain moved into view.
// v1: starts from the W1 probe (art/probes/prop base.v2), written for this bed: an iron asylum bed,
// rails, a stained mattress (stone ramp), leather restraint straps across it, legs to the floor.
export const meta = { brief: 'iron-bed', pass: 'r2', notes: 'iron bed: rails, stained mattress, straps' };

export const params = {
  straps: { type: 'range', min: 1, max: 2, step: 1, default: 2 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const x0 = X(3), x1 = X(29), deck = Y(17), floor = Y(28);
  s.add({ type: 'group', name: 'frame', underlay: true, mat: pal.metal, shade: 'cyl', children: [
    { type: 'rect', name: 'post', x: x0, y: Y(6), w: X(2), h: floor - Y(6), axis: 'y' },
    { type: 'rect', name: 'post', x: x1 - X(2), y: Y(10), w: X(2), h: floor - Y(10), axis: 'y' },
    { type: 'rect', name: 'rail', x: x0, y: Y(6), w: X(9), h: Y(1.6), axis: 'x' },
    { type: 'rect', name: 'rail', x: x0 + X(7), y: Y(6), w: X(2), h: deck - Y(6), axis: 'y' },
    { type: 'rect', name: 'leg', x: x0 + X(9), y: deck, w: X(1.5), h: floor - deck, axis: 'y' },
  ] });
  s.add({ type: 'group', name: 'mattress', underlay: true, children: [
    { type: 'path', name: 'top', d: `M${x0 + X(2)} ${deck - Y(3)} L${x1 - X(2)} ${deck - Y(1)} L${x1 - X(2)} ${deck + Y(1)} L${x0 + X(2)} ${deck} Z`, mat: pal.stone, shade: 'flat', band: 0 },
    { type: 'path', name: 'side', d: `M${x0 + X(2)} ${deck} L${x1 - X(2)} ${deck + Y(1)} V${deck + Y(4)} L${x0 + X(2)} ${deck + Y(3)} Z`, mat: pal.stone, shade: 'flat', band: 1 },
    { type: 'ellipse', name: 'stain', cx: X(21.5), cy: deck - Y(0.5), rx: X(2.5), ry: Y(0.9), mat: pal.wood, shade: 'flat', band: 2 },
    { type: 'path', name: 'pillow', d: `M${x0 + X(2.5)} ${deck - Y(4.5)} Q${x0 + X(5)} ${deck - Y(5.5)} ${x0 + X(7)} ${deck - Y(4)} L${x0 + X(7)} ${deck - Y(1.5)} Q${x0 + X(5)} ${deck - Y(1)} ${x0 + X(2.5)} ${deck - Y(2)} Z`, mat: pal.stone, shade: 'sphere' },
    { type: 'rect', name: 'sag', x: X(14), y: deck - Y(1.5), w: X(4), h: 1, mat: pal.stone, shade: 'flat', band: 1 },
  ] });
  for (let i = 0; i < P.straps; i++) {
    const sx = X(12 + i * 8);
    s.add({ type: 'path', name: 'strap', d: `M${sx} ${deck - Y(2.4) + i * Y(0.6)} H${sx + X(2)} V${deck + Y(3.3) + i * Y(0.6)} H${sx} Z`, mat: pal.leather, shade: 'flat', band: 1 });
  }
  return ctx.lib.proc(s).add('groundShadow', {}).render();
}
