// isohero base.v2 (r2) — from v1 (5.5): the cloak opens at the front (two panels) over a short leather jerkin
// with a belt, legs and boots below it, green sleeves with hands, a bigger face in a deeper hood opening.
export const meta = { brief: 'isohero', pass: 'r2', notes: 'open cloak panels, short jerkin, legs, sleeves + hands, bigger face' };

export function render(ctx) {
  const { pal } = ctx.dir, G = pal.green, L = pal.leather, s = ctx.lib.t2.scene(32, 48);
  s.add({ type: 'group', name: 'legs', underlay: true, children: [
    { type: 'rect', x: 12.5, y: 30, w: 3, h: 7, mat: L, shade: 'flat', band: 1 }, { type: 'rect', x: 16.5, y: 30, w: 3, h: 7, mat: L, shade: 'flat', band: 1 },
    { type: 'rect', x: 12, y: 37, w: 3.5, h: 5, r: 0.5, mat: L.slice(1), shade: 'bevel' }, { type: 'rect', x: 16.5, y: 37, w: 3.5, h: 5, r: 0.5, mat: L.slice(1), shade: 'bevel' },
  ] });
  s.add({ type: 'group', name: 'jerkin', underlay: true, children: [
    { type: 'path', d: 'M12 20 H20 L20.5 31 H11.5 Z', mat: L, shade: 'normal', round: 2 },
    { type: 'rect', name: 'belt', x: 11.5, y: 27, w: 9, h: 1.5, mat: L, shade: 'flat', band: 2 },
    { type: 'rect', name: 'buckle', x: 15, y: 27, w: 2, h: 1.5, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'path', name: 'cloak', underlay: true, mirrorX: 16, d: 'M16 6 Q8 6 8 14 L7 22 Q4 31 4 36 Q8 38.5 11.5 38 L12.5 22 Q13 20 16 20 Z', mat: G, shade: 'normal', round: 3 });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: 16, children: [
    { type: 'capsule', a: [10.5, 21], b: [11.5, 26], r: 1.7, mat: G, shade: 'cyl' },
    { type: 'circle', cx: 11.8, cy: 27.6, r: 1.3, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'ellipse', name: 'opening', cx: 16, cy: 15, rx: 5.5, ry: 6, mat: G, shade: 'flat', band: 2 });
  s.add({ type: 'ellipse', name: 'face', cx: 16, cy: 16, rx: 4.3, ry: 4, mat: pal.skin, shade: 'normal', round: 1.5, underlay: true });
  s.add({ type: 'path', name: 'hood-rim', d: 'M10.5 13 Q11 8.5 16 8.5 Q21 8.5 21.5 13 Q20 10.5 16 10.5 Q12 10.5 10.5 13 Z', mat: G, shade: 'flat', band: 0 });
  s.add({ type: 'rect', name: 'eye', x: 14, y: 15, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  s.add({ type: 'group', name: 'dagger', underlay: true, children: [
    { type: 'rect', x: 20.5, y: 21, w: 1.5, h: 5, mat: pal.steel, shade: 'bevel' },
    { type: 'rect', x: 19.5, y: 26, w: 3.5, h: 1.2, mat: pal.gold, shade: 'flat' },
  ] });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 42, rx: 9 }).render();
}
