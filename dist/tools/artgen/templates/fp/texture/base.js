// {{ID}} base.v1 (r1) — template: a first-person surface — wall, floor or ceiling by the brief's `surface` —
// from a material recipe at 64 px, banded to the direction's ramps, with the normal map the runtime lights (`three`
// lit billboards and wall materials). Walls read best with clear courses or panels (brick, stone, metal, wood); floors
// and ceilings with a quieter recipe, darker for ceilings (`range` keeps them off the lightest steps). The review sheet
// shows the tile 3×3 and a raycaster corridor shot with the texture in place.
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template fp surface: material recipe' };

export const params = {
  recipe: { type: 'choice', options: ['brick', 'stone', 'metal', 'wood', 'cobble', 'tech'], default: 'brick' },
  scale: { type: 'range', min: 0.75, max: 1.5, step: 0.25, default: 1 },
};

export function render(ctx) {
  const P = ctx.params, surface = ctx.brief.surface ?? 'wall';
  // ceilings stay off the lightest step; floors and walls use the whole ramp
  return ctx.lib.tex.material(P.recipe, { size: ctx.size, scale: P.scale, seed: ctx.seed + ctx.variant, ...(surface === 'ceiling' && { range: [1, 2] }) });
}
