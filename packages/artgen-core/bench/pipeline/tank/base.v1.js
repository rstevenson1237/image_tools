// tank base.v1 (r1) — first T2+ build from the brief: top-down sci-fi tank; two tracks with tread stripes, chamfered
// hull, twin barrels, domed turret with a sensor light, side light strips, rear warning stripe, drop shadow.
export const meta = { brief: 'tank', pass: 'r1', notes: 'first build from the brief' };

export function render(ctx) {
  const { pal } = ctx.dir, A = pal.armor, s = ctx.lib.t2.scene(64, 64, { shadow: [2, 2] });
  s.add({ type: 'rect', name: 'track', x: 7, y: 10, w: 10, h: 48, r: 2, mat: A.slice(2), shade: 'cyl', underlay: true, mirrorX: 32 });
  s.add({ type: 'path', name: 'hull', d: 'M24 8 H40 L48 16 V55 L44 59 H20 L16 55 V16 Z', mat: A, shade: 'normal', round: 6, underlay: true });
  s.add({ type: 'rect', name: 'barrel', x: 26.5, y: 3, w: 4, h: 22, mat: A, shade: 'cyl', underlay: true, mirrorX: 32 });
  s.add({ type: 'circle', name: 'dome', cx: 32, cy: 34, r: 11, mat: A, shade: 'sphere', underlay: true });
  s.add({ type: 'circle', name: 'sensor', cx: 32, cy: 31, r: 2, mat: pal.cyan, shade: 'flat', band: 1 });
  s.add({ type: 'rect', name: 'lights', x: 18, y: 20, w: 1, h: 28, mat: pal.cyan, shade: 'flat', band: 1, mirrorX: 32 });
  s.add({ type: 'rect', name: 'stripe', x: 24, y: 53, w: 16, h: 3, mat: pal.orange, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).add('pattern', { part: 'track', type: 'stripes', axis: 'x', period: 4, offset: 1, step: 1 }).render();
}
