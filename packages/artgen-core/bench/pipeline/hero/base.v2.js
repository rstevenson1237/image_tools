// hero base.v2 (r2) — from v1 (5.5): face shading rounded only at the edges (no "beard"), one smooth hair
// silhouette with the fringe inside it, blush, sleeves + hands so the arms read, slimmer tunic with a hem.
export const meta = { brief: 'hero', pass: 'r2', notes: 'face round 2px, hair one shape, blush, sleeves/hands, tunic hem' };

export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(32, 32);
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: 12, y: 24, w: 3, h: 3 }, { type: 'rect', x: 17, y: 24, w: 3, h: 3 },
    { type: 'rect', x: 11.5, y: 27, w: 4, h: 2, r: 0.5, mat: pal.leather.slice(1) }, { type: 'rect', x: 16.5, y: 27, w: 4, h: 2, r: 0.5, mat: pal.leather.slice(1) },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'tunic', d: 'M11 16 H21 L22 24.5 H10 Z', mat: pal.blue, shade: 'normal', round: 3 },
    { type: 'rect', name: 'belt', x: 10, y: 21, w: 12, h: 1, mat: pal.gold, shade: 'flat', band: 1 },
    { type: 'rect', name: 'buckle', x: 15, y: 21, w: 2, h: 1, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: 16, children: [
    { type: 'capsule', a: [9.5, 17.5], b: [8.5, 20.5], r: 1.6, mat: pal.blue, shade: 'cyl' },
    { type: 'circle', cx: 8.5, cy: 22.5, r: 1.4, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'path', name: 'hair', d: 'M8 12 Q7.5 3 16 3 Q24.5 3 24 12 L22 14 H10 Z', mat: pal.hair, shade: 'sphere' },
    { type: 'path', name: 'face', d: 'M10 10 Q11 8 13 8.5 Q16 6.5 19 8.5 Q21 8 22 10 V13 Q21 15.5 16 15.5 Q11 15.5 10 13 Z', mat: pal.skin, shade: 'normal', round: 2, gain: 1 },
  ] });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 10.5, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  s.add({ type: 'rect', name: 'blush', x: 11, y: 12.5, w: 1.5, h: 1, color: 'blush.0', mirrorX: 16 });
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'path', d: 'M24 18 V5 L25 3.5 L26 5 V18 Z', mat: pal.steel, shade: 'bevel' },
    { type: 'rect', x: 22, y: 18, w: 6, h: 1.5, mat: pal.gold, shade: 'flat' },
    { type: 'rect', x: 24, y: 19.5, w: 2, h: 3, mat: pal.leather, shade: 'flat' },
  ] });
  s.add({ type: 'group', name: 'shield', underlay: true, children: [
    { type: 'path', d: 'M2.5 18 H9.5 V23 Q9.5 26.5 6 28.5 Q2.5 26.5 2.5 23 Z', mat: pal.red, shade: 'normal', round: 2 },
    { type: 'rect', x: 5.5, y: 19, w: 1, h: 8, mat: pal.gold, shade: 'flat', band: 0 },
    { type: 'rect', x: 3.5, y: 21, w: 5, h: 1, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  return ctx.lib.proc(s).render();
}
