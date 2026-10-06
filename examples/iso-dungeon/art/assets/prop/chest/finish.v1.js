// finish.v1 (f) on base.v3 — glints: the lit edge of the lock plate and sparkle pixels on the open hoard (accent.0: glow is not
// in the prop palette — the gate caught that on the first try).
export const base = 'base.v3';
export const meta = { notes: 'lock rim, hoard glints' };

export function finish(g, ctx) {
  const { px } = ctx.lib, hoard = [px.color('accent.1')];
  px.light.rim(g, { ramps: ['accent'] });
  if (ctx.state === 'open') {
    let n = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (hoard.includes(g.get(x, y)) && (x * 7 + y * 3) % 11 === 0 && n++ < 4) px.set(g, [x, y], 'accent.0');
  }
  return g;
}
