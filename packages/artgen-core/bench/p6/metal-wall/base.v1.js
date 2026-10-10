// metal-wall base.v1 (r1) — from the fp/texture template: the `metal` recipe at 64 px (16 px riveted plates, rust).
export const meta = { brief: 'metal-wall', pass: 'r1', notes: 'metal recipe' };

export function render(ctx) {
  return ctx.lib.tex.material('metal', { size: ctx.size, seed: ctx.seed });
}
