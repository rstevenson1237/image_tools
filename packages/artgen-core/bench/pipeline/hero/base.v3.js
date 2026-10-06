// hero base.v3 (r3) — from v2 (6.5): fringe locks inside the hair (lighter band + a parting), tunic centre seam
// and collar, steel rim on the shield, longer boots, sword fuller line; params for variants (hair, tunic, shield
// emblem, weapon, helmet).
export const meta = { brief: 'hero', pass: 'r3', notes: 'fringe locks, tunic seam/collar, shield rim, params for variants' };

export const params = {
  tunic: { type: 'swap', options: ['blue', 'red', 'green', 'purple'], default: 'blue' },
  hair: { type: 'swap', options: ['hair', 'gold', 'leather', 'steel'], default: 'hair' },
  emblem: { type: 'choice', options: ['cross', 'bar', 'none'], default: 'cross' },
  weapon: { type: 'choice', options: ['sword', 'axe'], default: 'sword' },
  helmet: { type: 'toggle', default: false, p: 0.35 },
  width: { type: 'range', min: -1, max: 1, step: 1, default: 0 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(32, 32), cloth = pal[P.tunic], hair = pal[P.hair], k = P.width;
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: 12, y: 24, w: 3, h: 2.5 }, { type: 'rect', x: 17, y: 24, w: 3, h: 2.5 },
    { type: 'rect', x: 11.5, y: 26.5, w: 4, h: 2.5, r: 0.5, mat: pal.leather.slice(1) }, { type: 'rect', x: 16.5, y: 26.5, w: 4, h: 2.5, r: 0.5, mat: pal.leather.slice(1) },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'tunic', d: `M${11 - k} 16 H${21 + k} L${22 + k} 24.5 H${10 - k} Z`, mat: cloth, shade: 'normal', round: 3 },
    { type: 'rect', name: 'seam', x: 15.5, y: 17, w: 1, h: 4, mat: cloth, shade: 'flat', band: cloth.length - 1 },
    { type: 'path', name: 'collar', d: 'M13 16 H19 L16 18.5 Z', mat: pal.skin, shade: 'flat', band: 1 },
    { type: 'rect', name: 'belt', x: 10 - k, y: 21, w: 12 + 2 * k, h: 1, mat: pal.gold, shade: 'flat', band: 1 },
    { type: 'rect', name: 'buckle', x: 15, y: 21, w: 2, h: 1, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: 16, children: [
    { type: 'capsule', a: [9.5 - k, 17.5], b: [8.5 - k, 20.5], r: 1.6, mat: cloth, shade: 'cyl' },
    { type: 'circle', cx: 8.5 - k, cy: 22.5, r: 1.4, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'path', name: 'hair', d: 'M8 12 Q7.5 3 16 3 Q24.5 3 24 12 L22 14 H10 Z', mat: hair, shade: 'sphere' },
    { type: 'path', name: 'face', d: 'M10 10 Q11 8 13 8.5 Q16 6.5 19 8.5 Q21 8 22 10 V13 Q21 15.5 16 15.5 Q11 15.5 10 13 Z', mat: pal.skin, shade: 'normal', round: 2, gain: 1 },
    // fringe locks: lighter strands over the forehead line, parting slightly off-centre
    { type: 'path', name: 'lock', d: 'M10 9.5 Q11 6 14.5 5.5 L13 8.5 Z', mat: hair, shade: 'flat', band: 0 },
    { type: 'path', name: 'lock', d: 'M17 5.5 Q21 5.5 22 9.5 L19.5 8.2 Z', mat: hair, shade: 'flat', band: 1 },
    ...(P.helmet ? [{ type: 'path', name: 'helmet', d: 'M7.5 10 Q7.5 2.5 16 2.5 Q24.5 2.5 24.5 10 Z', mat: pal.steel, shade: 'sphere' },
      { type: 'rect', name: 'helmet-band', x: 7.5, y: 9, w: 17, h: 1.5, mat: pal.steel, shade: 'flat', band: 2 }] : []),
  ] });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 10.5, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  s.add({ type: 'rect', name: 'blush', x: 11, y: 12.5, w: 1.5, h: 1, color: 'blush.0', mirrorX: 16 });
  s.add(P.weapon === 'sword'
    ? { type: 'group', name: 'sword', underlay: true, children: [
      { type: 'path', d: 'M24 18 V5 L25 3.5 L26 5 V18 Z', mat: pal.steel, shade: 'bevel' },
      { type: 'rect', x: 24.5, y: 6, w: 1, h: 11, mat: pal.steel, shade: 'flat', band: 0 },
      { type: 'rect', x: 22, y: 18, w: 6, h: 1.5, mat: pal.gold, shade: 'bevel' },
      { type: 'rect', x: 24, y: 19.5, w: 2, h: 3, mat: pal.leather, shade: 'flat' },
    ] }
    : { type: 'group', name: 'axe', underlay: true, children: [
      { type: 'rect', x: 24.5, y: 6, w: 1.5, h: 17, mat: pal.leather, shade: 'flat' },
      { type: 'path', d: 'M25 6 Q30 5 29.5 10 Q29 13 25 12 Z', mat: pal.steel, shade: 'normal', round: 1.5 },
    ] });
  s.add({ type: 'group', name: 'shield', underlay: true, children: [
    { type: 'path', d: 'M2 17.5 H10 V23 Q10 27 6 29 Q2 27 2 23 Z', mat: pal.steel, shade: 'bevel' },
    { type: 'path', d: 'M3 18.5 H9 V23 Q9 26.3 6 27.8 Q3 26.3 3 23 Z', mat: pal.red, shade: 'normal', round: 2 },
    ...(P.emblem === 'cross' ? [{ type: 'rect', x: 5.5, y: 19, w: 1, h: 7.5, mat: pal.gold, shade: 'flat', band: 0 }, { type: 'rect', x: 3.5, y: 21, w: 5, h: 1, mat: pal.gold, shade: 'flat', band: 0 }]
      : P.emblem === 'bar' ? [{ type: 'path', d: 'M3 20 L9 25 V26 L3 21 Z', mat: pal.gold, shade: 'flat', band: 0 }] : []),
  ] });
  return ctx.lib.proc(s).render();
}
