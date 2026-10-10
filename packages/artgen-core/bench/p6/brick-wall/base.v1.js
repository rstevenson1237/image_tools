// brick-wall base.v1 (r1) — from the fp/texture template: the `brick` recipe (P6d) at 64 px on the accent ramp
// (the direction's brick-red), running bond, normal map from the height field.
export const meta = { brief: 'brick-wall', pass: 'r1', notes: 'brick recipe' };

export function render(ctx) {
  return ctx.lib.tex.material('brick', { size: ctx.size, seed: ctx.seed });
}
