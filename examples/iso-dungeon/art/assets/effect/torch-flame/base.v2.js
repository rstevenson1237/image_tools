// torch-flame base.v2 (r2) — v1 with a stronger sway (the tip leans a quarter of the width), a second smaller tongue
// that flickers out of phase, and three layers (accent.1 outer, accent.0 middle, glow core) instead of two.
export const meta = { brief: 'torch-flame', pass: 'r2', notes: 'stronger sway, second tongue, three layers' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), ph = t * Math.PI * 2;
  const cx = w / 2, base = h * 0.85, sway = Math.sin(ph) * w * 0.16, tall = h * (0.62 + 0.1 * Math.sin(ph * 2));
  const drop = (name, ox, rw, ht, sw, mat, band) => s.add({ type: 'path', name, d: `M${cx + ox - rw} ${base - rw * 0.6} Q${cx + ox - rw} ${base + rw * 0.5} ${cx + ox} ${base + rw * 0.5} Q${cx + ox + rw} ${base + rw * 0.5} ${cx + ox + rw} ${base - rw * 0.6} Q${cx + ox + rw * 0.6} ${base - ht * 0.55} ${cx + ox + sw} ${base - ht} Q${cx + ox - rw * 0.7} ${base - ht * 0.5} ${cx + ox - rw} ${base - rw * 0.6} Z`, mat, shade: 'flat', band });
  drop('outer', 0, w * 0.27, tall, sway, pal.accent, 1);
  drop('tongue', w * 0.12, w * 0.1, tall * (0.7 + 0.2 * Math.cos(ph)), -sway * 0.8, pal.accent, 1);
  drop('middle', 0, w * 0.19, tall * 0.75, sway * 0.7, pal.accent, 0);
  drop('core', 0, w * 0.1, tall * 0.45, sway * 0.4, pal.glow, 0);
  const ey = base - tall - (t * h * 0.25), ex = cx + Math.sin(ph + 2) * w * 0.15;
  if (ey > 1) s.add({ type: 'rect', name: 'ember', x: Math.round(ex), y: Math.round(ey), w: 1, h: 1, mat: pal.glow, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).noDefaults().render();
}
