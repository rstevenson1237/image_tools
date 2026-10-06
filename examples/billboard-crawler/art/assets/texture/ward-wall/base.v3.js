// ward-wall base.v3 (r3) — v2 + a lit bevel on each tile's top-left edge (a second grid pattern, offset one pixel,
// stepping lighter). v2: v1 one step darker (night ward), grime as irregular soft green-grey patches (two small
// overlapping blobs + a drip) instead of a dark oval stamp. v1: from the ground-tile template, as a wall texture: grimy square ward tiles (stone's light
// step) on grout lines (a grid pattern that divides 32, so it tiles), a dark damp stain that wraps across the bottom
// edge, wear noise. Seamless by construction (wrapped copies).
export const meta = { brief: 'ward-wall', pass: 'r3', notes: 'tile grid, grout, wrapped stain, noise' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 32;
  s.add({ type: 'rect', name: 'wall', x: 0, y: 0, w, h, mat: pal.stone, shade: 'flat', band: 1 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  const sx = Math.floor(r() * w);
  wrapped({ type: 'ellipse', name: 'stain', cx: 0, cy: 0, rx: X(3.5), ry: X(2), mat: pal.grass, shade: 'flat', band: 0 }, sx, h - X(2));
  wrapped({ type: 'ellipse', name: 'stain', cx: 0, cy: 0, rx: X(2.5), ry: X(1.5), mat: pal.grass, shade: 'flat', band: 0 }, sx + X(4), h - X(4));
  wrapped({ type: 'rect', name: 'drip', x: 0, y: 0, w: 1, h: X(7), mat: pal.grass, shade: 'flat', band: 0 }, sx + X(2), h - X(10));
  return ctx.lib.proc(s).noDefaults()
    .add('pattern', { part: 'wall', type: 'grid', period: Math.round(w / 4), width: 1, step: 1 })
    .add('pattern', { part: 'wall', type: 'grid', period: Math.round(w / 4), width: 1, offset: 1, step: -1 })
    .add('materialNoise', { part: 'wall', amount: 0.2, scale: 2 })
    .render();
}
