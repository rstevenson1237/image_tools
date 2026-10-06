// reeds base.v4 (u1) — user feedback on base.v3 ("a green blob — fewer, taller blades with gaps, brown cattail pods
// standing above"): five thin blades spaced apart, curving out from the tuft, two tall straight stems whose brown
// pods stand clear above the blade tips. Still lit left / dark right for the light gate.
export const meta = { brief: 'reeds', pass: 'u1', notes: 'fewer spaced blades, cattails above' };

export const params = {
  blades: { type: 'range', min: 4, max: 6, step: 1, default: 5 },
  heads: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  spread: { type: 'range', min: 0.8, max: 1.2, default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const bx = X(16), by = Y(30), n = P.blades;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1), lean = (u - 0.5) * 2 * P.spread, len = Y(14 + 4 * Math.sin(u * Math.PI));
    const foot = bx + (u - 0.5) * X(7), tx = foot + lean * X(7), ty = by - len, cx = foot + lean * X(1.5);
    s.add({ type: 'tube', name: `blade${i}`, d: `M${foot} ${by} Q${cx} ${by - len * 0.6} ${tx} ${ty}`, w: X(1.6), w1: 0.6, mat: pal.grass, shade: 'flat', band: u < 0.4 ? 0 : u < 0.7 ? 1 : 2, underlay: true });
  }
  for (let k = 0; k < P.heads; k++) {
    const hx = bx + (k - (P.heads - 1) / 2) * X(5), top = Y(3 + 2 * k);
    s.add({ type: 'rect', name: `stem${k}`, x: Math.round(hx), y: top, w: 1, h: by - top, mat: pal.grass, shade: 'flat', band: 1 });
    s.add({ type: 'capsule', name: `pod${k}`, a: [hx + 0.5, top + Y(1.5)], b: [hx + 0.5, top + Y(6)], r: X(1.7), mat: pal.wood, shade: 'cyl', underlay: true });
  }
  s.add({ type: 'ellipse', name: 'tuft', cx: bx, cy: by, rx: X(5), ry: Y(1.5), mat: pal.grass, shade: 'flat', band: 2 });
  return ctx.lib.proc(s).render();
}
