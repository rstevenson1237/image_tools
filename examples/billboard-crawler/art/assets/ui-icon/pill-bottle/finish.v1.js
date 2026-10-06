// finish.v1 (f) on base.v3 — a glint on the cap's lit corner and on the bottle's shoulder (pickups should sparkle).
export const base = 'base.v3';
export const meta = { notes: 'cap + shoulder glints' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 16);
  px.set(g, [X(4), X(2)], 'metal.0');
  px.set(g, [X(4), X(4.5)], 'accent.0');
  return g;
}
