// finish.v1 (f) on base.v3 — moonlit rim down the pole's lit side; a drop of light at the end of the drip line.
export const base = 'base.v3';
export const meta = { notes: 'pole rim, drip highlight' };

export function finish(g, ctx) {
  const { px } = ctx.lib, Y = v => Math.round((v * g.h) / 32), X = v => Math.round((v * g.w) / 32);
  px.light.rim(g, { ramps: ['metal'], region: [0, Y(4), X(16), Y(22)] });
  px.set(g, [X(18), Y(22) + 1], 'stone.0');
  return g;
}
