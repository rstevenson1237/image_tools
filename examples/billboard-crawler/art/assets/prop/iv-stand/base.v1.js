// iv-stand base.v1 (r1) — written for the brief (the crate template doesn't fit): a rusty IV drip stand, front view.
// A thin pole on a splayed three-wheel base, a hook crossbar at the top, a sagging empty bag (stone, pale) with a drip
// line hanging down; rust specks (accent's darkest step) on the pole.
export const meta = { brief: 'iv-stand', pass: 'r1', notes: 'pole, wheeled base, hook bar, empty bag, drip line' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32, cx = X(15);
  const top = Y(3), floor = Y(29);
  for (const dx of [-6, 0, 6]) {
    s.add({ type: 'tube', name: 'foot', d: `M${cx} ${floor - Y(3)} L${cx + X(dx)} ${floor - Y(dx ? 1 : 0)}`, w: X(1.4), mat: pal.metal, shade: 'flat', band: 1, underlay: true });
    s.add({ type: 'circle', name: 'wheel', cx: cx + X(dx), cy: floor, r: X(1.2), mat: pal.metal, shade: 'flat', band: 2 });
  }
  s.add({ type: 'rect', name: 'pole', x: cx - X(0.7), y: top, w: X(1.4), h: floor - Y(3) - top, mat: pal.metal, shade: 'cyl', axis: 'y', underlay: true });
  s.add({ type: 'rect', name: 'bar', x: cx - X(5), y: top, w: X(10), h: Y(1.2), mat: pal.metal, shade: 'flat', band: 0, underlay: true });
  s.add({ type: 'path', name: 'bag', d: `M${cx + X(2)} ${top + Y(1.5)} H${cx + X(7)} L${cx + X(7.5)} ${top + Y(8)} Q${cx + X(4.5)} ${top + Y(10)} ${cx + X(1.5)} ${top + Y(8)} Z`, mat: pal.stone, shade: 'linear', underlay: true });
  s.add({ type: 'tube', name: 'line', d: `M${cx + X(4.5)} ${top + Y(9.5)} Q${cx + X(6)} ${top + Y(15)} ${cx + X(3)} ${top + Y(19)}`, w: 1, mat: pal.leather, shade: 'flat', band: 1 });
  for (const yy of [10, 15, 19]) s.add({ type: 'rect', name: 'rust', x: Math.round(cx - X(0.7)), y: Math.round(Y(yy)), w: 1, h: Math.max(1, Math.round(Y(1.5))), mat: pal.accent, shade: 'flat', band: 2 });
  return ctx.lib.proc(s).render();
}
