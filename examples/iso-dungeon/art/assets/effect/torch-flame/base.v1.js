// torch-flame base.v1 (r1) — from the spark template, rewritten as a loop: a wall-torch flame in 4 frames. Outer
// flame (accent) and inner core (glow) are teardrops whose tips sway and stretch with ctx.t; one ember rises.
export const meta = { brief: 'torch-flame', pass: 'r1', notes: 'two teardrops swaying, rising ember' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), ph = t * Math.PI * 2;
  const cx = w / 2, base = h * 0.85, sway = Math.sin(ph) * w * 0.08, tall = h * (0.62 + 0.08 * Math.sin(ph * 2));
  const drop = (name, rw, ht, mat, band) => s.add({ type: 'path', name, d: `M${cx - rw} ${base - rw * 0.6} Q${cx - rw} ${base + rw * 0.5} ${cx} ${base + rw * 0.5} Q${cx + rw} ${base + rw * 0.5} ${cx + rw} ${base - rw * 0.6} Q${cx + rw * 0.6} ${base - ht * 0.55} ${cx + sway} ${base - ht} Q${cx - rw * 0.7} ${base - ht * 0.5} ${cx - rw} ${base - rw * 0.6} Z`, mat, shade: 'flat', band });
  drop('outer', w * 0.26, tall, pal.accent, 1);
  drop('inner', w * 0.15, tall * 0.62, pal.glow, 0);
  const ey = base - tall - (t * h * 0.25), ex = cx + Math.sin(ph + 2) * w * 0.15;
  if (ey > 1) s.add({ type: 'rect', name: 'ember', x: Math.round(ex), y: Math.round(ey), w: 1, h: 1, mat: pal.glow, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).noDefaults().render();
}
