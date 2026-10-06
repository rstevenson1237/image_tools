// isohero base.v3 (r3) — from v2 (6): hood is one shape (no ink seam), cloak panels below it, a V collar on the
// jerkin, lighter legs with dark boots, dagger held low at the side; params for variants (cloak colour, hood
// down, weapon, jerkin material).
export const meta = { brief: 'isohero', pass: 'r3', notes: 'single hood, V collar, legs/boots contrast, dagger at side; variant params' };

export const params = {
  cloak: { type: 'swap', options: ['green', 'blue', 'red', 'purple'], default: 'green' },
  hood: { type: 'toggle', default: true, p: 0.7 },
  weapon: { type: 'choice', options: ['dagger', 'none', 'staff'], default: 'dagger' },
  jerkin: { type: 'swap', options: ['leather', 'steel'], default: 'leather' },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, G = pal[P.cloak], J = pal[P.jerkin], L = pal.leather, s = ctx.lib.t2.scene(32, 48);
  s.add({ type: 'group', name: 'legs', underlay: true, children: [
    { type: 'rect', x: 12.5, y: 30, w: 3, h: 7, mat: L, shade: 'flat', band: 0 }, { type: 'rect', x: 16.5, y: 30, w: 3, h: 7, mat: L, shade: 'flat', band: 1 },
    { type: 'rect', x: 12, y: 37, w: 3.5, h: 5, r: 0.5, mat: L.slice(1), shade: 'bevel' }, { type: 'rect', x: 16.5, y: 37, w: 3.5, h: 5, r: 0.5, mat: L.slice(1), shade: 'bevel' },
  ] });
  s.add({ type: 'group', name: 'jerkin', underlay: true, children: [
    { type: 'path', d: 'M12 20 H20 L20.5 31 H11.5 Z', mat: J, shade: 'normal', round: 2 },
    { type: 'path', name: 'collar', d: 'M13.5 20 H18.5 L16 24 Z', mat: pal.skin, shade: 'flat', band: 1 },
    { type: 'rect', name: 'belt', x: 11.5, y: 27, w: 9, h: 1.5, mat: L, shade: 'flat', band: 2 },
    { type: 'rect', name: 'buckle', x: 15, y: 27, w: 2, h: 1.5, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'path', name: 'cloak', underlay: true, mirrorX: 16, d: 'M10 16 L7 22 Q4 31 4 36 Q8 38.5 11.5 38 L12.5 22 Q12.5 20 14 19 Z', mat: G, shade: 'normal', round: 3 });
  if (P.hood) s.add({ type: 'path', name: 'hood', underlay: true, d: 'M16 5.5 Q8 5.5 8 14 L9 19 Q12 21 16 21 Q20 21 23 19 L24 14 Q24 5.5 16 5.5 Z', mat: G, shade: 'normal', round: 3 });
  else s.add({ type: 'group', name: 'hair', underlay: true, children: [
    { type: 'ellipse', cx: 16, cy: 13, rx: 6, ry: 6, mat: pal.hair, shade: 'sphere' },
    { type: 'path', name: 'hood-down', d: 'M9 19 Q16 23 23 19 L22 21.5 Q16 24 10 21.5 Z', mat: G, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'group', name: 'arm', underlay: true, mirrorX: 16, children: [
    { type: 'capsule', a: [10.5, 21], b: [11.5, 26], r: 1.7, mat: G, shade: 'cyl' },
    { type: 'circle', cx: 11.8, cy: 27.6, r: 1.3, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  if (P.hood) s.add({ type: 'ellipse', name: 'opening', cx: 16, cy: 15, rx: 5.5, ry: 6, mat: G, shade: 'flat', band: 2 });
  s.add({ type: 'ellipse', name: 'face', cx: 16, cy: 16, rx: 4.3, ry: 4, mat: pal.skin, shade: 'normal', round: 1.5, underlay: true });
  if (P.hood) s.add({ type: 'path', name: 'hood-rim', d: 'M10.5 13 Q11 8.5 16 8.5 Q21 8.5 21.5 13 Q20 10.5 16 10.5 Q12 10.5 10.5 13 Z', mat: G, shade: 'flat', band: 0 });
  else s.add({ type: 'path', name: 'fringe', d: 'M11 14 Q11 9 16 9.5 Q21 9 21 14 Q19 11.5 16 12 Q13 11.5 11 14 Z', mat: pal.hair, shade: 'flat', band: 0 });
  s.add({ type: 'rect', name: 'eye', x: 14, y: 15, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  if (P.weapon === 'dagger') s.add({ type: 'group', name: 'dagger', underlay: true, children: [
    { type: 'rect', x: 21, y: 29, w: 1.5, h: 5, mat: pal.steel, shade: 'bevel' },
    { type: 'rect', x: 20, y: 28, w: 3.5, h: 1.2, mat: pal.gold, shade: 'flat' },
  ] });
  else if (P.weapon === 'staff') s.add({ type: 'group', name: 'staff', underlay: true, children: [
    { type: 'rect', x: 22, y: 14, w: 1.5, h: 27, mat: pal.wood, shade: 'cyl' },
    { type: 'circle', cx: 22.75, cy: 13, r: 2, mat: pal.cyan, shade: 'sphere' },
  ] });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 42, rx: 9 }).render();
}
