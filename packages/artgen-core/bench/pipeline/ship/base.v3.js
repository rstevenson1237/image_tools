// ship base.v3 (r3) — from v2 (6.5): barrels as thin dark lines on the deck (no ink), every turret on the light
// navy steps, deck inset further so the grey hull rim shows along both sides, light catwalk blocks along the
// bridge; params for variants (turret layout, funnels, deck wood, bridge length, hull tone).
export const meta = { brief: 'ship', pass: 'r3', notes: 'thin barrels, light turrets, hull rim both sides, catwalks; variant params' };

const HULL = 'M7 12.5 Q3.5 20.5 7 28.5 L95 31 Q140 26.5 156 20.5 Q140 14.5 95 10 Z';

export const params = {
  turrets: { type: 'choice', options: ['1+2', '2+2', '1+1'], default: '1+2' },
  funnels: { type: 'range', min: 1, max: 2, step: 1, default: 2 },
  deck: { type: 'swap', options: ['teak', 'wood', 'leather'], default: 'teak' },
  bridge: { type: 'range', min: 29, max: 37, step: 4, default: 33 },
  hull: { type: 'swap', options: ['navy', 'armor'], default: 'navy' },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, N = pal[P.hull], s = ctx.lib.t2.scene(160, 41, { shadow: [2, 2] });
  const turret = (x, dir) => ({ type: 'group', name: 'turret', translate: [x, 20.5], scale: [dir, 1], children: [
    ...[-2, 0, 2].map(y => ({ type: 'rect', name: 'barrel', x: 4, y: y - 0.5, w: 12, h: 1, mat: N, shade: 'flat', band: 3 })),
    { type: 'path', name: 'housing', underlay: true, d: 'M-6 0 A6 6 0 0 1 0 -6 H3 L5 -4 V4 L3 6 H0 A6 6 0 0 1 -6 0 Z', mat: N.slice(0, 3), shade: 'bevel' },
  ] });
  s.add({ type: 'path', name: 'hull', d: HULL, mat: N.slice(0, 4), shade: 'bevel' });
  s.add({ type: 'path', name: 'deck', d: HULL, translate: [5, 3.2], scale: [0.95, 0.84], mat: pal[P.deck], shade: 'flat', band: 0 });
  const bx = 57 + (33 - P.bridge) / 2, bw = P.bridge + 2;
  s.add({ type: 'group', name: 'superstructure', underlay: true, children: [
    ...[0, 1, 2, 3].map(i => ({ type: 'rect', name: 'catwalk', x: bx + 4 + i * 8, y: 12.5, w: 4, h: 16, mat: N, shade: 'flat', band: 0 })),
    { type: 'rect', x: bx, y: 14, w: bw, h: 13, mat: N.slice(1), shade: 'bevel' },
    { type: 'rect', x: bx + 5, y: 16, w: bw - 10, h: 9, mat: N, shade: 'flat', band: 1 },
    { type: 'rect', x: bx + bw - 7, y: 17, w: 6, h: 7, mat: N, shade: 'flat', band: 0 },
    ...Array.from({ length: P.funnels }, (_, i) => ({ type: 'circle', name: 'funnel', cx: bx + 13 + i * 7 + (P.funnels === 1 ? 3.5 : 0), cy: 20.5, r: 2.5, mat: N.slice(2), shade: 'sphere', underlay: true })),
  ] });
  const [aft, fwd] = P.turrets.split('+').map(Number);
  for (let i = 0; i < aft; i++) s.add(turret(43 - i * 14, -1));
  for (let i = 0; i < fwd; i++) s.add(turret(103 + i * 17, 1));
  return ctx.lib.proc(s).add('pattern', { part: 'deck', type: 'planks', axis: 'x', period: 4, offset: 3, length: 16, step: 1 }).render();
}
