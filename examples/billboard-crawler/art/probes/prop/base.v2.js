// probe-prop base.v2 (r2) — from v1 (template crate): an iron asylum bed, front 3/4 view. Tubular head and foot
// rails, a stained mattress (stone ramp), leather restraint straps across it, legs to the floor.
export const meta = { brief: 'probe-prop', pass: 'r2', notes: 'iron bed: rails, stained mattress, straps' };

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
    { type: 'ellipse', name: 'stain', cx: X(17), cy: deck - Y(1), rx: X(3), ry: Y(1), mat: pal.wood, shade: 'flat', band: 2 },
  ] });
  for (let i = 0; i < P.straps; i++) {
    const sx = X(12 + i * 8);
    s.add({ type: 'path', name: 'strap', d: `M${sx} ${deck - Y(2.4) + i * Y(0.6)} H${sx + X(2)} V${deck + Y(3.3) + i * Y(0.6)} H${sx} Z`, mat: pal.leather, shade: 'flat', band: 1 });
  }
  return ctx.lib.proc(s).add('groundShadow', {}).render();
}
