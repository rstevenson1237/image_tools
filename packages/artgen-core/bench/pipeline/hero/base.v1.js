// hero base.v1 (r1) — first T2+ build from the brief: chibi front view; hair dome over a face, blue tunic with a
// gold belt, leather legs, sword on the right, kite shield on the left. Every part group has an underlay for
// internal outlines. No procedural layers beyond the direction defaults.
export const meta = { brief: 'hero', pass: 'r1', notes: 'first build from the brief' };

export function render(ctx) {
  const { pal } = ctx.dir, s = ctx.lib.t2.scene(32, 32);
  s.add({ type: 'group', name: 'legs', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: 12, y: 24, w: 3, h: 5 }, { type: 'rect', x: 17, y: 24, w: 3, h: 5 },
  ] });
  s.add({ type: 'path', name: 'tunic', d: 'M10 16 H22 L23 25 H9 Z', mat: pal.blue, shade: 'normal', underlay: true });
  s.add({ type: 'rect', name: 'belt', x: 9, y: 22, w: 14, h: 1, mat: pal.gold, shade: 'flat', band: 1 });
  s.add({ type: 'capsule', name: 'arm', a: [9, 18], b: [8.5, 23], r: 1.5, mat: pal.skin, shade: 'cyl', underlay: true, mirrorX: 16 });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', name: 'hair', cx: 16, cy: 10, rx: 8, ry: 7.5, mat: pal.hair, shade: 'sphere' },
    { type: 'path', name: 'face', d: 'M10 11 Q10 7.5 16 7.5 Q22 7.5 22 11 L21.5 14 Q16 17 10.5 14 Z', mat: pal.skin, shade: 'normal' },
    { type: 'path', name: 'fringe', d: 'M9 11 Q10 4 16 4.5 Q22 4 23 11 Q20 7 16 8 Q12 7 9 11 Z', mat: pal.hair, shade: 'bevel' },
  ] });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 11, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'rect', x: 24, y: 4, w: 2, h: 14, mat: pal.steel, shade: 'bevel' },
    { type: 'rect', x: 22, y: 18, w: 6, h: 1.5, mat: pal.gold, shade: 'flat' },
    { type: 'rect', x: 24, y: 19.5, w: 2, h: 3, mat: pal.leather, shade: 'flat' },
  ] });
  s.add({ type: 'group', name: 'shield', underlay: true, children: [
    { type: 'path', d: 'M2.5 18 H9.5 V23 Q9.5 26.5 6 28.5 Q2.5 26.5 2.5 23 Z', mat: pal.red, shade: 'normal' },
    { type: 'rect', x: 5.5, y: 19, w: 1, h: 8, mat: pal.gold, shade: 'flat', band: 0 },
    { type: 'rect', x: 3.5, y: 21, w: 5, h: 1, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  return ctx.lib.proc(s).render();
}
