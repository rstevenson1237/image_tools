// {{ID}} base.v1 (r1) — template: an effect from deterministic particles: the `sparks` preset — a flash, then
// streaks thrown out that cool along the direction's effect ramps. Swap the preset for the brief (`artgen fx --list`:
// explosion smoke fire sparks magic heal muzzle impact splash dust trail), or compose your own emitter layers
// (count, angle/spread, speed, life, drag, gravity, size, shape, blob, band), and for flames start from `fx.flame`.
// Streams loop seamlessly; bursts play once. Keep it in the frame and break it up (the `fill` check flags solid blobs).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template effect: particle preset' };

export function render(ctx) {
  const [w, h] = ctx.size, { fx } = ctx.lib;
  return fx.particles(fx.preset('sparks', { w, h, duration: ctx.duration }), { w, h, t: ctx.t, duration: ctx.duration });
}
