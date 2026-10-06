// mud base.v2 (r2) — v1 with puddles as wet green-grey pools (were near-black holes) and noise across the ground to
// hide the repeat. v1: from the ground-tile template: wet bog mud. Dirt base with wrapped puddles (dark pool, one lit
// edge pixel row for the wet shine), a couple of grass tufts and specks; seamless by drawing wrapped copies.
export const meta = { brief: 'mud', pass: 'r2', notes: 'dirt + wrapped puddles + tufts' };

export const params = {
  puddles: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  tufts: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'ground', x: 0, y: 0, w, h, mat: pal.dirt, shade: 'flat', band: 1 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  for (let i = 0; i < P.puddles; i++) {
    const x = r() * w, y = r() * h, rx = X(2.5 + r() * 1.5), ry = X(1.2 + r() * 0.6);
    wrapped({ type: 'ellipse', name: 'puddle', cx: 0, cy: 0, rx, ry, mat: pal.grass, shade: 'flat', band: 1 }, x, y);
    wrapped({ type: 'rect', name: 'shine', x: -rx * 0.3, y: -ry * 0.5, w: Math.max(1, rx * 0.5), h: 1, mat: pal.grass, shade: 'flat', band: 0 }, x, y);
  }
  for (let i = 0; i < P.tufts; i++) wrapped({ type: 'path', name: 'tuft', d: `M0 ${X(2)} L${X(0.6)} 0 L${X(1.2)} ${X(1.4)} L${X(2)} ${-X(0.4)} L${X(2.4)} ${X(2)} Z`, mat: pal.grass, shade: 'flat', band: 1 }, r() * w, r() * h);
  for (let i = 0; i < 5; i++) wrapped({ type: 'rect', name: 'speck', x: 0, y: 0, w: 1, h: 1, mat: pal.dirt, shade: 'flat', band: i % 2 ? 0 : 2 }, Math.floor(r() * w), Math.floor(r() * h));
  return ctx.lib.proc(s).noDefaults().add('materialNoise', { part: 'ground', amount: 0.35, scale: 2 }).render();
}
