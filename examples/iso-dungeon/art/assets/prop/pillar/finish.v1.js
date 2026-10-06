// finish.v1 (f) on base.v3 — the chip the model can't show at this size: knock two pixels out of the capital's front
// corner (clear + outline), and a lit rim along the capital top.
export const base = 'base.v3';
export const meta = { notes: 'capital chip, top rim' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.light.rim(g, { ramps: ['stone'], region: [0, 0, g.w, Math.round(g.h * 0.35)] });
  // front corner of the capital: the lowest opaque pixel of the capital band on the centre column
  const cx = g.w >> 1;
  let y = 0;
  for (let j = 0; j < Math.round(g.h * 0.45); j++) if (g.alpha(cx, j) === 255) y = j;
  if (y) { g.clear(cx, y - 1); px.set(g, [cx, y - 2], 'outline'); px.set(g, [cx + 1, y - 1], 'outline'); }
  return g;
}
