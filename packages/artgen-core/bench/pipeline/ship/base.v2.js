// ship base.v2 (r2) — from v1 (6): turrets on the three lighter navy steps (bevel lit top, dark bottom) and spaced
// apart, barrels lighter and drawn under the housing with their own underlay, bridge gets the light front block
// and lighter funnels, hull rim lighter.
export const meta = { brief: 'ship', pass: 'r2', notes: 'lighter spaced turrets, lighter barrels, bridge front block, funnels' };

const HULL = 'M7 12.5 Q3.5 20.5 7 28.5 L95 31 Q140 26.5 156 20.5 Q140 14.5 95 10 Z';

export function render(ctx) {
  const { pal } = ctx.dir, N = pal.navy, s = ctx.lib.t2.scene(160, 41, { shadow: [2, 2] });
  const turret = (x, dir, big) => ({ type: 'group', name: 'turret', translate: [x, 20.5], scale: [dir, 1], children: [
    { type: 'group', name: 'barrels', underlay: true, children: [-2, 0, 2].map(y => ({ type: 'rect', x: 4, y: y - 0.5, w: 12, h: 1, mat: N, shade: 'flat', band: 2 })) },
    { type: 'path', name: 'housing', underlay: true, d: 'M-6 0 A6 6 0 0 1 0 -6 H3 L5 -4 V4 L3 6 H0 A6 6 0 0 1 -6 0 Z', mat: big ? N.slice(0, 3) : N.slice(1, 4), shade: 'bevel' },
  ] });
  s.add({ type: 'path', name: 'hull', d: HULL, mat: N.slice(0, 4), shade: 'bevel' });
  s.add({ type: 'path', name: 'deck', d: HULL, translate: [4, 2.1], scale: [0.96, 0.9], mat: pal.teak, shade: 'flat', band: 0 });
  s.add({ type: 'group', name: 'superstructure', underlay: true, children: [
    { type: 'rect', x: 57, y: 14, w: 35, h: 13, mat: N.slice(1), shade: 'bevel' },
    { type: 'rect', x: 62, y: 16, w: 25, h: 9, mat: N, shade: 'flat', band: 1 },
    { type: 'rect', x: 85, y: 17, w: 6, h: 7, mat: N, shade: 'flat', band: 0 },
    { type: 'circle', cx: 70, cy: 20.5, r: 2.5, mat: N.slice(2), shade: 'sphere', underlay: true },
    { type: 'circle', cx: 77, cy: 20.5, r: 2.5, mat: N.slice(2), shade: 'sphere', underlay: true },
  ] });
  s.add(turret(43, -1), turret(103, 1, true), turret(120, 1));
  return ctx.lib.proc(s).add('pattern', { part: 'deck', type: 'planks', axis: 'x', period: 4, offset: 3, length: 16, step: 1 }).render();
}
