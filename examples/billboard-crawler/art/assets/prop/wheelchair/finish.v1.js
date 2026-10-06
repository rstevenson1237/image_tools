// finish.v1 (f) on base.v3 — a lit arc on the tyre's upper-left (moonlight) and the hub glint.
export const base = 'base.v3';
export const meta = { notes: 'tyre rim light' };

export function finish(g, ctx) {
  const { px } = ctx.lib, X = v => Math.round((v * g.w) / 32), Y = v => Math.round((v * g.h) / 32);
  px.light.rim(g, { ramps: ['metal'], region: [X(4), Y(14), X(9), Y(9)] });
  px.set(g, [X(12), Y(22)], 'metal.0');
  return g;
}
