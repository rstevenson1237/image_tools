// bog-water base.v2 (r2) — v1 with pads placed apart (fixed spread, seeded jitter), bigger with a lit edge, and
// smaller scum, so the tiled field stops reading as one stamped blob. v1: from the ground-tile template: dark still water (stone's deepest step: the palette has no
// blue, by rule), green scum patches, two lily pads with a notch, and short pale ripple dashes. Seamless by wrapping.
export const meta = { brief: 'bog-water', pass: 'r2', notes: 'dark water, scum, lily pads, ripples' };

export const params = {
  pads: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  scum: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'water', x: 0, y: 0, w, h, mat: pal.stone, shade: 'flat', band: 2 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  for (let i = 0; i < P.scum; i++) wrapped({ type: 'ellipse', name: 'scum', cx: 0, cy: 0, rx: X(2 + r()), ry: X(1 + r() * 0.5), mat: pal.grass, shade: 'flat', band: 2 }, ((i + 0.6) / P.scum) * w, r() * h);
  for (let i = 0; i < 4; i++) wrapped({ type: 'rect', name: 'ripple', x: 0, y: 0, w: Math.max(2, X(2)), h: 1, mat: pal.stone, shade: 'flat', band: 1 }, Math.floor(r() * w), Math.floor(r() * h));
  for (let i = 0; i < P.pads; i++) {
    const px = ((i + 0.1 + r() * 0.3) / P.pads) * w, py = ((i * 0.55 + 0.2 + r() * 0.2) % 1) * h;
    wrapped({ type: 'subtract', name: 'pad', mat: pal.grass, shade: 'linear', shapes: [
      { type: 'circle', cx: 0, cy: 0, r: X(2.4) },
      { type: 'path', d: `M0 0 L${X(2.6)} ${-X(1)} L${X(2.6)} ${X(0.5)} Z` },
    ] }, px, py);
  }
  return ctx.lib.proc(s).noDefaults().render();
}
