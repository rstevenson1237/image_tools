// wisp base.v1 (r1) — from the spark template, rewritten as a loop: a will-o'-wisp orb that pulses over the 6 idle
// frames, a flame tongue flickering upward and three sparks orbiting it. Colours: glow core, accent halo (effect ramps).
export const meta = { brief: 'wisp', pass: 'r1', notes: 'pulsing orb, flame tongue, orbiting sparks' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), ph = t * Math.PI * 2;
  const cx = w / 2, cy = h * 0.58, R = Math.min(w, h) * 0.2 * (1 + 0.12 * Math.sin(ph));
  s.add({ type: 'circle', name: 'halo', cx, cy, r: R * 1.45, mat: pal.accent, shade: 'flat', band: 1 });
  s.add({ type: 'path', name: 'tongue', d: `M${cx - R * 0.8} ${cy - R * 0.3} Q${cx + Math.sin(ph) * R * 0.6} ${cy - R * 2.6} ${cx + Math.sin(ph + 1) * R * 0.4} ${cy - R * 2.9} Q${cx + R * 0.3} ${cy - R * 1.4} ${cx + R * 0.8} ${cy - R * 0.3} Z`, mat: pal.accent, shade: 'flat', band: 0 });
  s.add({ type: 'circle', name: 'core', cx, cy, r: R, mat: pal.glow, shade: 'sphere' });
  for (let i = 0; i < 3; i++) {
    const a = ph + (i * Math.PI * 2) / 3;
    s.add({ type: 'rect', name: 'spark', x: Math.round(cx + Math.cos(a) * R * 2.3), y: Math.round(cy + Math.sin(a) * R * 1.2), w: 1, h: 1, mat: pal.glow, shade: 'flat', band: i ? 1 : 0 });
  }
  return ctx.lib.proc(s).noDefaults().render();
}
