// floor base.v5 (u1) — redo for P6b (blind review 5.5: heavy black grout lattice, worn-flag variants not evident).
// Crypt flagstones from the stone recipe laid on the diamond (`isoFloor`), so joints are the recipe's cracks between
// slabs — one step darker, never black — and the tile has no rim of its own: neighbouring diamonds continue the same
// flags (the texture wraps). Low contrast (the two lighter stone steps, low relief) so units read on it. Each variant
// is another slab layout, so a floor laid with `tiles.pick` doesn't repeat one diamond. The texture is w/2 square: one
// texel per diamond pixel along the iso axes, so 1 px cracks stay unbroken.
export const meta = { brief: 'floor', pass: 'u1', notes: 'stone recipe on the diamond, no rim, two light steps; variant = slab layout' };

export function render(ctx) {
  const { tex } = ctx.lib, [w, h] = ctx.size;
  const flags = tex.material('stone', { size: [w / 2, w / 2], scale: 0.6, relief: 0.6, range: [0, 1], params: { variety: 0.08 }, seed: ctx.seed + 11 * ctx.variant });
  return tex.isoFloor(flags, w, h);
}
