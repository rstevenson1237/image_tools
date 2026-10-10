// fire-loop base.v1 (r1) — the `fire` preset: a stream emitter, so the loop is seamless by construction (births wrap
// around the loop period); tongues as one blob layer banded hot core → dark tips, embers on top.
export const meta = { brief: 'fire-loop', pass: 'r1', notes: 'fire preset' };

export function render(ctx) {
  const [w, h] = ctx.size, { fx } = ctx.lib;
  return fx.particles(fx.preset('fire', { w, h, duration: ctx.duration }), { w, h, t: ctx.t, duration: ctx.duration });
}
