// probe-effect base.v1 (r1) — template: spark burst, t-driven over the frames (placeholder until the effects track,
// P6c, adds particles and palette cycling). Frame 0 is a bright core, later frames expand a ring and scatter
// rays. Colours come from the direction's effect ramps (glow, accent).
export const meta = { brief: 'probe-effect', pass: 'r1', notes: 'template spark burst' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, t = ctx.t, s = ctx.lib.t2.scene(w, h), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 1.5;
  const core = R * (0.55 - 0.4 * t), ring = R * (0.35 + 0.65 * t);
  if (t < 0.75) s.add({ type: 'star', name: 'core', cx, cy, r: core, r2: core * 0.45, n: 4, rot: -90 + 45 * t, mat: pal.glow, shade: 'sphere' });
  if (t > 0) s.add({ type: 'ring', name: 'ring', cx, cy, r: ring, w: Math.min(ring, Math.max(1, R * 0.18 * (1 - t) + 0.6)), mat: pal.accent, shade: 'flat', band: t > 0.6 ? 1 : 0 });
  for (let i = 0; i < 6 && t > 0; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4, d = ring + R * 0.15 + (i % 2) * R * 0.1;
    if (d < R) s.add({ type: 'rect', name: 'ray', x: cx + Math.cos(a) * d - 0.5, y: cy + Math.sin(a) * d - 0.5, w: 1, h: 1, mat: pal.glow, shade: 'flat', band: 0 });
  }
  return ctx.lib.proc(s).noDefaults().render();
}
