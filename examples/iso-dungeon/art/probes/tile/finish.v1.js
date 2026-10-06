// probe-tile finish.v1 (f) on base.v2 — nothing to fix at the pixel level beyond stray single pixels in the moss.
export const base = 'base.v2';
export const meta = { notes: 'moss orphans' };

export function finish(g, ctx) {
  ctx.lib.px.fix.orphans(g, { ramps: ['grass'] });
  return g;
}
