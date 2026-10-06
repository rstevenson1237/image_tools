// ship base.v1 (r1) — first T2+ build from the brief: top-down WWII battleship, bow to the right; grey hull
// with a teak deck (planks from the procedural pattern), central superstructure with two funnels, three turrets
// (one aft facing astern, two forward), drop shadow on the water.
export const meta = { brief: 'ship', pass: 'r1', notes: 'first build from the brief' };

const HULL = 'M7 12.5 Q3.5 20.5 7 28.5 L95 31 Q140 26.5 156 20.5 Q140 14.5 95 10 Z';

export function render(ctx) {
  const { pal } = ctx.dir, N = pal.navy, s = ctx.lib.t2.scene(160, 41, { shadow: [2, 2] });
  const turret = (x, dir, big) => ({ type: 'group', name: 'turret', underlay: true, translate: [x, 20.5], scale: [dir, 1], children: [
    { type: 'group', name: 'barrels', children: [-2, 0, 2].map(y => ({ type: 'rect', x: 5, y: y - 0.5, w: 12, h: 1, mat: N, shade: 'flat', band: 3 })) },
    { type: 'path', name: 'housing', d: 'M-6.5 0 A6.5 6.5 0 0 1 0 -6.5 H3.5 L5.5 -4.5 V4.5 L3.5 6.5 H0 A6.5 6.5 0 0 1 -6.5 0 Z', mat: N, shade: 'bevel', band: big ? 0 : 1 },
  ] });
  s.add({ type: 'path', name: 'hull', d: HULL, mat: N, shade: 'bevel' });
  s.add({ type: 'path', name: 'deck', d: HULL, translate: [4, 2.1], scale: [0.96, 0.9], mat: pal.teak, shade: 'flat', band: 0 });
  s.add({ type: 'group', name: 'superstructure', underlay: true, children: [
    { type: 'rect', x: 57, y: 14, w: 35, h: 13, mat: N, shade: 'bevel' },
    { type: 'rect', x: 62, y: 16, w: 25, h: 9, mat: N, shade: 'flat', band: 1 },
    { type: 'circle', cx: 70, cy: 20.5, r: 2.5, mat: N, shade: 'flat', band: 3, underlay: true },
    { type: 'circle', cx: 78, cy: 20.5, r: 2.5, mat: N, shade: 'flat', band: 3, underlay: true },
  ] });
  s.add(turret(42.5, -1), turret(105, 1, true), turret(119, 1));
  return ctx.lib.proc(s).add('pattern', { part: 'deck', type: 'planks', axis: 'x', period: 4, offset: 3, length: 16, step: 1 }).render();
}
