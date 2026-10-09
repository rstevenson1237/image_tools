// forest base.v1 (r1) — three parallax layers in T2+ 2D, each seamless left to right: every feature is drawn at x and
// at x ± w. far: rolling hills (stone, light); mid: a pine tree line (grass) on a ground band; near: three big trunks
// (wood) with foliage clumps hanging into the frame and ferns at the bottom. Back layers lighter (aerial perspective).
export const meta = { brief: 'forest', pass: 'r1', notes: 'far hills, mid pines, near trunks + ferns; seamless in x' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), r = ctx.rng;
  const wrap = spec => { for (const dx of [-w, 0, w]) s.add({ ...spec, translate: [(spec.translate?.[0] ?? 0) + dx, spec.translate?.[1] ?? 0] }); };
  if (ctx.state === 'far') {
    // hills: a smooth ridge line through seeded heights, repeated so it closes at the wrap
    const n = 6, ys = Array.from({ length: n }, () => h * (0.45 + r() * 0.2));
    let d = `M0 ${h} L0 ${ys[0]}`;
    for (let i = 0; i < n; i++) { const x0 = (i * w) / n, x1 = ((i + 1) * w) / n, y1 = ys[(i + 1) % n]; d += ` Q${(x0 + x1) / 2} ${Math.min(ys[i], y1) - h * 0.12} ${x1} ${y1}`; }
    wrap({ type: 'path', name: 'hills', d: d + ` L${w} ${h} Z`, mat: pal.stone, shade: 'flat', band: 0 });
  } else if (ctx.state === 'mid') {
    wrap({ type: 'rect', name: 'ground', x: 0, y: h - 8, w, h: 8, mat: pal.grass, shade: 'flat', band: 1 });
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.3 + r() * 0.4) * (w / 9), th = h * (0.35 + r() * 0.25), base = h - 6;
      wrap({ type: 'poly', name: 'pine', pts: [[x, base - th], [x - th * 0.28, base], [x + th * 0.28, base]], mat: pal.grass, shade: 'linear', gain: 0.7 });
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.2 + r() * 0.5) * (w / 3), tw = 5 + r() * 3;
      wrap({ type: 'rect', name: 'trunk', x: x - tw / 2, y: 0, w: tw, h, mat: pal.wood, shade: 'cyl', axis: 'x', underlay: true });
      wrap({ type: 'ellipse', name: 'leaves', cx: x + (r() - 0.5) * 10, cy: 3, rx: 12 + r() * 6, ry: 7, mat: pal.grass, shade: 'sphere', underlay: true });
    }
    for (let i = 0; i < 7; i++) wrap({ type: 'path', name: 'fern', d: `M${(i * w) / 7} ${h} q2 -10 7 -12 q-3 6 -1 12 Z`, mat: pal.grass, shade: 'flat', band: i % 2 });
  }
  return ctx.lib.proc(s).noDefaults().render();
}
