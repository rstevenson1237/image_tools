// isohero base.v1 (r1) — first T2+ build from the brief: hooded rogue facing the iso camera; green hood and cloak
// with a shadowed face opening, leather tunic with a gold buckle, boots, dagger in the right hand, 2:1 ground shadow.
export const meta = { brief: 'isohero', pass: 'r1', notes: 'first build from the brief' };

export function render(ctx) {
  const { pal } = ctx.dir, G = pal.green, s = ctx.lib.t2.scene(32, 48);
  s.add({ type: 'group', name: 'boots', underlay: true, mat: pal.leather, shade: 'bevel', children: [
    { type: 'rect', x: 12, y: 37, w: 3, h: 5 }, { type: 'rect', x: 17, y: 37, w: 3, h: 5 },
  ] });
  s.add({ type: 'path', name: 'cloak', d: 'M16 6 Q8 6 8 14 L7 22 Q4 32 4 37 Q10 39.5 16 39.5 Q22 39.5 28 37 Q28 32 25 22 L24 14 Q24 6 16 6 Z', mat: G, shade: 'normal', round: 4, underlay: true });
  s.add({ type: 'group', name: 'front', underlay: true, children: [
    { type: 'path', name: 'tunic', d: 'M12.5 21 H19.5 L20.5 37 H11.5 Z', mat: pal.leather, shade: 'normal', round: 2 },
    { type: 'rect', name: 'belt', x: 12, y: 27, w: 8, h: 1.5, mat: pal.leather, shade: 'flat', band: 2 },
    { type: 'rect', name: 'buckle', x: 15, y: 27, w: 2, h: 1.5, mat: pal.gold, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'ellipse', name: 'opening', cx: 16, cy: 15.5, rx: 5, ry: 5.5, mat: G, shade: 'flat', band: 2 });
  s.add({ type: 'ellipse', name: 'face', cx: 16, cy: 16.5, rx: 3.8, ry: 3.6, mat: pal.skin, shade: 'normal', round: 1.5, underlay: true });
  s.add({ type: 'rect', name: 'eye', x: 14, y: 15.5, w: 1, h: 2, color: 'outline', mirrorX: 16 });
  s.add({ type: 'group', name: 'dagger', underlay: true, children: [
    { type: 'rect', x: 24, y: 28, w: 1.5, h: 5, mat: pal.steel, shade: 'bevel' },
    { type: 'rect', x: 23, y: 26.5, w: 3.5, h: 1.5, mat: pal.gold, shade: 'flat' },
    { type: 'circle', cx: 24.75, cy: 25.5, r: 1.3, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 42, rx: 9 }).render();
}
