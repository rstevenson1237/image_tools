// lamp-flicker base.v3 (r3) — v2 + a dark wick under the flame (it floated). v2: v1 narrowed to a wick flame (widths 0.6x, taller) with a sparser, wider halo. v1: reuses Torchdeep's torch-flame base.v3 approach (three layers, a second tongue, sway),
// smaller and calmer for an oil-lamp wick, plus a broken amber halo ring of single pixels around it.
export const meta = { brief: 'lamp-flicker', pass: 'r3', notes: 'lamp flame + halo ring' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), ph = t * Math.PI * 2;
  const cx = w / 2, base = h * 0.7, sway = Math.sin(ph) * w * 0.08, tall = h * (0.5 + 0.06 * Math.sin(ph * 2));
  const drop = (name, ox, rw, ht, sw, mat, band) => s.add({ type: 'path', name, d: `M${cx + ox - rw} ${base - rw * 0.6} Q${cx + ox - rw} ${base + rw * 0.2} ${cx + ox} ${base + rw * 0.2} Q${cx + ox + rw} ${base + rw * 0.2} ${cx + ox + rw} ${base - rw * 0.6} Q${cx + ox + rw * 0.6} ${base - ht * 0.55} ${cx + ox + sw} ${base - ht} Q${cx + ox - rw * 0.7} ${base - ht * 0.5} ${cx + ox - rw} ${base - rw * 0.6} Z`, mat, shade: 'flat', band });
  s.add({ type: 'rect', name: 'wick', x: Math.round(cx) - 1, y: Math.round(base), w: 2, h: Math.max(2, Math.round(h * 0.08)), mat: pal.accent, shade: 'flat', band: 2 });
  drop('outer', 0, w * 0.15, tall, sway, pal.accent, 1);
  drop('tongue', w * 0.1, w * 0.06, tall * (0.7 + 0.2 * Math.cos(ph)), -sway * 0.8, pal.accent, 0);
  drop('middle', 0, w * 0.1, tall * 0.75, sway * 0.7, pal.accent, 0);
  drop('core', 0, w * 0.055, tall * 0.45, sway * 0.4, pal.glow, 0);
  const ey = base - tall - (t * h * 0.25), ex = cx + Math.sin(ph + 2) * w * 0.15;
  if (ey > 1) s.add({ type: 'rect', name: 'ember', x: Math.round(ex), y: Math.round(ey), w: 1, h: 1, mat: pal.glow, shade: 'flat', band: 1 });
  // halo: a broken ring of single amber pixels, turning a step each frame
  const R = w * 0.44;
  for (let i = 0; i < 8; i++) if ((i + ctx.frame) % 4 === 0) {
    const a = (i / 8) * Math.PI * 2 + ctx.frame * 0.3;
    s.add({ type: 'rect', name: 'halo', x: Math.round(cx + Math.cos(a) * R), y: Math.round(base - tall * 0.4 + Math.sin(a) * R * 0.8), w: 1, h: 1, mat: pal.accent, shade: 'flat', band: 1 });
  }
  return ctx.lib.proc(s).noDefaults().render();
}
