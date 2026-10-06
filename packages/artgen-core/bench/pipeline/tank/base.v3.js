// tank base.v3 (r3) — from v2 (7.5): engine deck vents behind the dome, a hatch ring on the dome, inked panel
// seams on the glacis, sensor in a dark socket; params for variants (barrels, light colour, dome size, vents,
// track width, rear stripe).
export const meta = { brief: 'tank', pass: 'r3', notes: 'vents, dome hatch, glacis seams, sensor socket; variant params' };

export const params = {
  barrels: { type: 'choice', options: ['twin', 'single', 'quad'], default: 'twin' },
  lights: { type: 'swap', options: ['cyan', 'orange', 'green', 'red'], default: 'cyan' },
  dome: { type: 'range', min: 9, max: 12, step: 1, default: 11 },
  vents: { type: 'range', min: 2, max: 4, step: 1, default: 3 },
  track: { type: 'range', min: 9, max: 11, step: 1, default: 10 },
  stripe: { type: 'toggle', default: true, p: 0.7 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, A = pal.armor, Lc = pal[P.lights], s = ctx.lib.t2.scene(64, 64, { shadow: [2, 2] });
  const tw = P.track, barrels = { twin: [28.5], single: [32], quad: [26, 30] }[P.barrels], bw = P.barrels === 'single' ? 5 : P.barrels === 'quad' ? 3 : 4;
  s.add({ type: 'group', name: 'track', underlay: true, mirrorX: 32, children: [
    { type: 'rect', name: 'track', x: 17 - tw, y: 10, w: tw, h: 48, r: 2, mat: A.slice(2), shade: 'flat', band: 1 },
    { type: 'rect', name: 'rail', x: 15, y: 12, w: 1, h: 44, mat: A, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'group', name: 'hull', underlay: true, children: [
    { type: 'path', name: 'hull', d: 'M24 8 H40 L48 16 V55 L44 59 H20 L16 55 V16 Z', mat: A.slice(0, 4), shade: 'linear' },
    { type: 'line', name: 'seam', x0: 20, y0: 17, x1: 24, y1: 13, color: A[3] },
    { type: 'line', name: 'seam', x0: 43, y0: 17, x1: 39, y1: 13, color: A[3] },
    { type: 'group', name: 'vents', repeat: { n: P.vents, dy: 3 }, children: [{ type: 'rect', x: 26, y: 47, w: 12, h: 1, color: A[3] }] },
  ] });
  for (const bx of barrels) s.add({ type: 'group', name: 'barrel', underlay: true, ...(bx !== 32 && { mirrorX: 32 }), children: [
    { type: 'rect', x: bx - bw / 2, y: 3, w: bw, h: 22, mat: A, shade: 'cyl' },
    { type: 'rect', x: bx - bw / 2, y: 2, w: bw, h: 2, mat: A, shade: 'flat', band: 3 },
  ] });
  s.add({ type: 'group', name: 'dome', underlay: true, children: [
    { type: 'circle', name: 'dome', cx: 32, cy: 34, r: P.dome, mat: A.slice(0, 4), shade: 'sphere', gain: 1 },
    { type: 'ring', name: 'hatch', cx: 33.5, cy: 36.5, r: P.dome * 0.45, w: 1, color: A[3] },
    { type: 'circle', name: 'socket', cx: 32, cy: 31, r: 3, color: A[4] },
    { type: 'circle', name: 'sensor', cx: 32, cy: 31, r: 2, mat: Lc, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'rect', name: 'lights', x: 18, y: 20, w: 1, h: 26, mat: Lc, shade: 'flat', band: 1, mirrorX: 32 });
  if (P.stripe) s.add({ type: 'rect', name: 'stripe', x: 24, y: 55, w: 16, h: 2, mat: pal.orange, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).add('pattern', { part: 'track', type: 'stripes', axis: 'x', period: 4, offset: 1, step: 2 }).render();
}
