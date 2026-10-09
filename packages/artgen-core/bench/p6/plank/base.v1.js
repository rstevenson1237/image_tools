// plank base.v1 (r1) — template: seamless texture from a material recipe (P6b), banded to the direction's ramps,
// lit from its own height field, with a normal map. Recipes: stone cobble wood metal grass dirt sand snow water lava
// tech carpet (`artgen texture --list`; try one with `artgen texture <name>`). Pick the recipe and ramps for the
// brief, then add detail with the procedural pass (cracks, moss, puddles) — and keep the repetition flag clear: no
// single mark or blotch that lands on the same spot every tile.
export const meta = { brief: 'plank', pass: 'r1', notes: 'template texture: material recipe' };

export const params = {
  recipe: { type: 'choice', options: ['stone', 'cobble', 'dirt', 'grass', 'wood'], default: 'wood' },
  scale: { type: 'range', min: 0.75, max: 1.5, step: 0.25, default: 1 },
};

export function render(ctx) {
  const P = ctx.params;
  // ramps: { base: 'stone', mortar: 'dirt' } picks other direction ramps for the recipe's roles
  return ctx.lib.tex.material(P.recipe, { size: ctx.size, scale: P.scale, seed: ctx.seed + ctx.variant });
}
