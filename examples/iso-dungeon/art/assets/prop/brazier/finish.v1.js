// finish.v1 (f) on base.v3 — three embers rising above the coal heap (accent.0 over empty pixels), lit coal top.
export const base = 'base.v3';
export const meta = { notes: 'embers, coal top light' };

export function finish(g, ctx) {
  const { px } = ctx.lib, coal = px.color('accent.1');
  let top = g.h, cx = g.w >> 1;
  for (let y = 0; y < g.h && top === g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === coal || g.get(x, y) === px.color('accent.0')) { top = y; cx = x; break; }
  for (const [dx, dy] of [[-2, -3], [1, -5], [3, -2]]) if (!g.alpha(cx + dx, top + dy)) px.set(g, [cx + dx, top + dy], 'accent.0');
  return g;
}
