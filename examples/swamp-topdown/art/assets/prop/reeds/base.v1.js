// reeds base.v1 (r1) — written for the brief: a clump of reeds and bulrushes. Tapered blades (tubes) fan out from a
// tuft at the foot; a few stems carry brown cattail heads. Seeded params give each variant its own clump.
export const meta = { brief: 'reeds', pass: 'r1', notes: 'fan of tapered blades + cattails' };

export const params = {
  blades: { type: 'range', min: 6, max: 10, step: 1, default: 8 },
  heads: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  spread: { type: 'range', min: 0.7, max: 1.2, default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const bx = X(16), by = Y(29), n = P.blades;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1), a = (u - 0.5) * 1.6 * P.spread, len = Y(20 + 6 * Math.sin(u * Math.PI)) * (i % 3 === 1 ? 0.8 : 1);
    const tx = bx + Math.sin(a) * len, ty = by - Math.cos(a) * len, mx = bx + Math.sin(a) * len * 0.5 + (u - 0.5) * X(2);
    s.add({ type: 'tube', name: `blade${i}`, d: `M${bx + (u - 0.5) * X(6)} ${by} Q${mx} ${by - len * 0.5} ${tx} ${ty}`, w: X(2), w1: 0.6, mat: pal.grass, shade: 'flat', band: i % 2, underlay: true });
    if (i % Math.max(2, Math.floor(n / P.heads)) === 1 && i < n - 1)
      s.add({ type: 'capsule', name: `head${i}`, a: [tx * 0.7 + bx * 0.3, ty * 0.7 + by * 0.3], b: [tx * 0.8 + bx * 0.2, ty * 0.8 + by * 0.2], r: X(1.4), mat: pal.wood, shade: 'cyl', underlay: true });
  }
  s.add({ type: 'ellipse', name: 'tuft', cx: bx, cy: by, rx: X(5), ry: Y(1.8), mat: pal.grass, shade: 'flat', band: 2 });
  return ctx.lib.proc(s).render();
}
