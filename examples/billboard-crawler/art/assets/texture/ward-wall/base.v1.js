// ward-wall base.v1 (r1) — from the ground-tile template, as a wall texture: grimy square ward tiles (stone's light
// step) on grout lines (a grid pattern that divides 32, so it tiles), a dark damp stain that wraps across the bottom
// edge, wear noise. Seamless by construction (wrapped copies).
export const meta = { brief: 'ward-wall', pass: 'r1', notes: 'tile grid, grout, wrapped stain, noise' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 32;
  s.add({ type: 'rect', name: 'wall', x: 0, y: 0, w, h, mat: pal.stone, shade: 'flat', band: 0 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  wrapped({ type: 'ellipse', name: 'stain', cx: 0, cy: 0, rx: X(6), ry: X(4), mat: pal.grass, shade: 'flat', band: 1 }, Math.floor(r() * w), h - X(2));
  wrapped({ type: 'rect', name: 'drip', x: 0, y: 0, w: X(1), h: X(9), mat: pal.grass, shade: 'flat', band: 1 }, Math.floor(r() * w), h - X(12));
  return ctx.lib.proc(s).noDefaults()
    .add('pattern', { part: 'wall', type: 'grid', period: Math.round(w / 4), width: 1, step: 1 })
    .add('materialNoise', { part: 'wall', amount: 0.2, scale: 2 })
    .render();
}
