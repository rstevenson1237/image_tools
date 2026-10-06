// probe-tile base.v1 (r1) — template: 2:1 iso floor tile (a diamond filling the tile frame) with grass patches and
// pebbles clipped to the diamond; the direction's outer line marks the tile seam. Adapt the surface to the game
// (flagstones, mud, planks…).
export const meta = { brief: 'probe-tile', pass: 'r1', notes: 'template iso floor tile' };

export const params = {
  ground: { type: 'swap', options: ['dirt', 'grass', 'stone'], default: 'dirt' },
  patches: { type: 'range', min: 1, max: 4, step: 1, default: 3 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), r = ctx.rng, X = v => (v * w) / 32;
  const diamond = `M${w / 2} 1 L${w - 1} ${h / 2} L${w / 2} ${h - 1} L1 ${h / 2} Z`;
  s.add({ type: 'path', name: 'ground', d: diamond, mat: pal[P.ground], shade: 'flat', band: 1 });
  const bits = [];
  for (let i = 0; i < P.patches; i++) bits.push({ type: 'ellipse', name: 'patch', cx: X(6) + r() * X(20), cy: h * 0.3 + r() * h * 0.4, rx: X(3), ry: X(1.5), mat: pal.grass, shade: 'flat', band: i % 2 });
  for (let i = 0; i < 3; i++) bits.push({ type: 'rect', name: 'pebble', x: X(6) + r() * X(20), y: h * 0.3 + r() * h * 0.4, w: Math.max(1, X(1.5)), h: 1, mat: pal.stone, shade: 'flat', band: 0 });
  s.add({ type: 'group', name: 'surface', clip: { type: 'path', d: diamond }, children: bits });
  return ctx.lib.proc(s).noDefaults().render();
}
