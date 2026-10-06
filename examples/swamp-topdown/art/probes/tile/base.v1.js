// probe-tile base.v1 (r1) — template: seamless ground tile (dirt with grass tufts and pebbles). Seamless by
// construction: every feature is drawn at its seeded position and at the wrapped copies one tile away, so the
// 3x3 review shows no seams. Adapt the material mix to the game's ground (mud, sand, floor stones…).
export const meta = { brief: 'probe-tile', pass: 'r1', notes: 'template ground tile' };

export const params = {
  ground: { type: 'swap', options: ['dirt', 'grass', 'stone'], default: 'dirt' },
  tufts: { type: 'range', min: 2, max: 6, step: 1, default: 4 },
  pebbles: { type: 'range', min: 0, max: 4, step: 1, default: 2 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), r = ctx.rng, X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'ground', x: 0, y: 0, w, h, mat: pal[P.ground], shade: 'flat', band: 1 });
  const wrapped = (spec, x, y) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) s.add({ ...spec, translate: [x + dx, y + dy] }); };
  for (let i = 0; i < P.pebbles; i++) wrapped({ type: 'ellipse', name: 'pebble', cx: 0, cy: 0, rx: Math.max(1, X(1.3)), ry: Math.max(0.8, X(0.9)), mat: pal.stone, shade: 'sphere' }, r() * w, r() * h);
  for (let i = 0; i < P.tufts; i++) wrapped({ type: 'path', name: 'tuft', d: `M0 ${X(2)} L${X(0.6)} 0 L${X(1.2)} ${X(1.4)} L${X(2)} ${-X(0.4)} L${X(2.4)} ${X(2)} Z`, mat: pal.grass, shade: 'flat', band: i % 2 }, r() * w, r() * h);
  for (let i = 0; i < 6; i++) wrapped({ type: 'rect', name: 'speck', x: 0, y: 0, w: 1, h: 1, mat: pal[P.ground], shade: 'flat', band: i % 2 ? 0 : 2 }, Math.floor(r() * w), Math.floor(r() * h));
  return ctx.lib.proc(s).noDefaults().render();
}
