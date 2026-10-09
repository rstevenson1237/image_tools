// forest base.v3 (r3) — from v2 (5.5): trunks shaded across their width (cyl axis y: lit left edge, dark right),
// bark as short vertical streaks; the canopy gets a dark underside band so it sits in front of the trunks' tops; pines
// in two tones so neighbours separate. v2: from v1 (4): aerial perspective the night way — the far ridges sit just above the background
// (stone's darkest step, a second ridge one step lighter in front); the mid pines are tiered (three stacked
// triangles on a trunk) in grass's middle step; the near trunks run the full height with bark stripes and the canopy is a
// lumpy band of overlapping circles along the top edge; ferns low and sparse so the scene stays open.
export const meta = { brief: 'forest', pass: 'r3', notes: 'trunks lit across, vertical bark, canopy underside, two-tone pines' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), r = ctx.rng;
  const wrap = spec => { for (const dx of [-w, 0, w]) s.add({ ...spec, translate: [(spec.translate?.[0] ?? 0) + dx, spec.translate?.[1] ?? 0] }); };
  const ridge = (n, y0, amp, band, name) => {
    const ys = Array.from({ length: n }, () => h * (y0 + r() * amp));
    let d = `M0 ${h} L0 ${ys[0]}`;
    for (let i = 0; i < n; i++) { const x0 = (i * w) / n, x1 = ((i + 1) * w) / n, y1 = ys[(i + 1) % n]; d += ` Q${(x0 + x1) / 2} ${Math.min(ys[i], y1) - h * 0.1} ${x1} ${y1}`; }
    wrap({ type: 'path', name, d: d + ` L${w} ${h} Z`, mat: pal.stone, shade: 'flat', band });
  };
  if (ctx.state === 'far') {
    ridge(4, 0.35, 0.15, 2, 'ridge-back');
    ridge(6, 0.55, 0.15, 1, 'ridge');
  } else if (ctx.state === 'mid') {
    wrap({ type: 'rect', name: 'ground', x: 0, y: h - 6, w, h: 6, mat: pal.grass, shade: 'flat', band: 2 });
    for (let i = 0; i < 8; i++) {
      const x = (i + 0.25 + r() * 0.5) * (w / 8), th = h * (0.4 + r() * 0.25), base = h - 5;
      wrap({ type: 'rect', name: 'pine-trunk', x: x - 0.5, y: base - 4, w: 1.5, h: 5, mat: pal.wood, shade: 'flat', band: 2 });
      for (let t = 0; t < 3; t++) {
        const top = base - 3 - th * (0.35 + 0.32 * t), bw = th * (0.3 - 0.06 * t);
        wrap({ type: 'poly', name: 'pine', pts: [[x, top - th * 0.3], [x - bw, top + th * 0.12], [x + bw, top + th * 0.12]], mat: pal.grass, shade: 'flat', band: (i + t) % 2 });
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i + 0.2 + r() * 0.5) * (w / 3), tw = 6 + r() * 3;
      wrap({ type: 'path', name: 'trunk', d: `M${x - tw / 2} 0 L${x + tw / 2} 0 L${x + tw / 2 + 1.5} ${h} L${x - tw / 2 - 1.5} ${h} Z`, mat: pal.wood, shade: 'cyl', axis: 'y', underlay: true,
        pattern: (px, py, b) => ((Math.floor(py / 3) * 5 + px * 3) % 11 === 0 ? Math.min(2, b + 1) : undefined) });
    }
    wrap({ type: 'rect', name: 'canopy-shade', x: 0, y: 0, w, h: 9, mat: pal.grass, shade: 'flat', band: 2 });
    for (let i = 0; i < 12; i++) wrap({ type: 'circle', name: 'canopy', cx: (i + r() * 0.6) * (w / 12), cy: -2 + r() * 5, r: 6 + r() * 4, mat: pal.grass, shade: 'sphere', underlay: true });
    for (let i = 0; i < 4; i++) { const x = (i + r() * 0.6) * (w / 4); wrap({ type: 'path', name: 'fern', d: `M${x} ${h} q2 -6 6 -7 q-2 4 -1 7 Z M${x + 2} ${h} q-3 -5 -6 -5 q3 2 3 5 Z`, mat: pal.grass, shade: 'flat', band: 1 }); }
  }
  return ctx.lib.proc(s).noDefaults().render();
}
