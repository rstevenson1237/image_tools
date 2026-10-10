// finish.v1 (f) on base.v3 — the eye row lifted to the hottest accent at the eye anchors, a glint on the abdomen's lit
// side, orphan cleanup on the legs.
export const base = 'base.v3';
export const meta = { notes: 'hot eyes, abdomen glint, orphans' };

export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g);
  for (const a of ['eye', 'eye2']) px.set(g, ctx.at(a), 'accent.0');
  px.light.highlight(g, [14, 21]);
  return g;
}
