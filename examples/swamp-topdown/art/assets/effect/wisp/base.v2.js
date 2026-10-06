// wisp base.v2 (r2) — v1 reworked: a small pale core (glow.0) inside a broken ring halo instead of a filled amber
// drop, a thinner tongue, sparks orbiting close enough to stay inside the frame. Loops over the 6 idle frames.
export const meta = { brief: 'wisp', pass: 'r2', notes: 'pale core, broken ring halo, sparks inside' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), ph = t * Math.PI * 2;
  const cx = w / 2, cy = h * 0.56, R = Math.min(w, h) * 0.13 * (1 + 0.15 * Math.sin(ph));
  s.add({ type: 'arc', name: 'halo', cx, cy, r: R * 2.1, w: 1, a0: ph * 57.3, a1: ph * 57.3 + 250, mat: pal.accent, shade: 'flat', band: 1 });
  s.add({ type: 'path', name: 'tongue', d: `M${cx - R * 0.7} ${cy - R * 0.2} Q${cx + Math.sin(ph) * R * 0.8} ${cy - R * 2.4} ${cx + Math.sin(ph + 1) * R * 0.5} ${cy - R * 3.2} Q${cx + R * 0.2} ${cy - R * 1.5} ${cx + R * 0.7} ${cy - R * 0.2} Z`, mat: pal.glow, shade: 'flat', band: 1 });
  s.add({ type: 'circle', name: 'core', cx, cy, r: R, mat: pal.glow, shade: 'flat', band: 0 });
  for (let i = 0; i < 3; i++) {
    const a = -ph * 1.5 + (i * Math.PI * 2) / 3;
    s.add({ type: 'rect', name: 'spark', x: Math.round(cx + Math.cos(a) * R * 2.9), y: Math.round(cy + Math.sin(a) * R * 1.8), w: 1, h: 1, mat: pal.glow, shade: 'flat', band: 0 });
  }
  return ctx.lib.proc(s).noDefaults().render();
}
