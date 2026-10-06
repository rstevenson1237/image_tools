// probe-tile base.v2 (r2) — from v1 (template ground): Bogwatch mud. Dark wet mud, still puddles that catch the
// sky (stone ramp, lightest edge on the lit side), reed clumps, no pebbles. Features wrap, so the tile is seamless.
export const meta = { brief: 'probe-tile', pass: 'r2', notes: 'bog mud: puddles, reeds' };

export const params = {
  reeds: { type: 'range', min: 1, max: 3, step: 1, default: 2 },
  puddles: { type: 'range', min: 1, max: 2, step: 1, default: 2 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'mud', x: 0, y: 0, w, h, mat: pal.dirt, shade: 'flat', band: 1 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  for (let i = 0; i < P.puddles; i++) {
    const px = r() * w, py = r() * h;
    wrapped({ type: 'ellipse', name: 'puddle', cx: 0, cy: 0, rx: X(2.6), ry: X(1.3), mat: pal.stone, shade: 'flat', band: 1 }, px, py);
    wrapped({ type: 'rect', name: 'glint', x: -X(1.5), y: -X(0.8), w: X(1.5), h: 1, mat: pal.stone, shade: 'flat', band: 0 }, px, py);
  }
  for (let i = 0; i < P.reeds; i++) wrapped({ type: 'path', name: 'reed', d: `M0 ${X(2.5)} L${X(0.4)} ${-X(1)} L${X(0.8)} ${X(1.6)} L${X(1.3)} ${-X(1.8)} L${X(1.8)} ${X(2.5)} Z`, mat: pal.grass, shade: 'flat', band: i % 2 }, r() * w, r() * h);
  for (let i = 0; i < 5; i++) wrapped({ type: 'rect', name: 'speck', x: 0, y: 0, w: X(1.5), h: 1, mat: pal.dirt, shade: 'flat', band: 2 }, Math.floor(r() * w), Math.floor(r() * h));
  return ctx.lib.proc(s).noDefaults().render();
}
