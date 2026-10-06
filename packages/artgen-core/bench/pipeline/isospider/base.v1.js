// isospider base.v1 (r1) — first T2+ build from the brief: cave spider seen from the iso camera; abdomen with a
// red hourglass, smaller head with two red eyes and steel fangs, eight curved legs as tapered tubes with
// underlay ink, 2:1 ground shadow.
export const meta = { brief: 'isospider', pass: 'r1', notes: 'first build from the brief' };

const LEGS = ['M12 14 Q6 6 3 11', 'M11 17 Q4 12 1 18', 'M11 19 Q4 19 2 25', 'M12 21 Q8 23 7 29'];

export function render(ctx) {
  const { pal } = ctx.dir, P = pal.purple, s = ctx.lib.t2.scene(32, 32);
  s.add({ type: 'group', name: 'legs', underlay: true, mirrorX: 16, children: LEGS.map(d => ({ type: 'tube', name: 'leg', d, w: 2, w1: 1.2, mat: P, shade: 'flat', band: 1 })) });
  s.add({ type: 'ellipse', name: 'abdomen', cx: 16, cy: 10, rx: 8, ry: 6.5, mat: P, shade: 'normal', underlay: true });
  s.add({ type: 'path', name: 'hourglass', d: 'M14 7 H18 L16 10 L18 13 H14 L16 10 Z', mat: pal.red, shade: 'flat', band: 0 });
  s.add({ type: 'ellipse', name: 'head', cx: 16, cy: 19, rx: 5, ry: 3.8, mat: P, shade: 'normal', underlay: true });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 18, w: 2, h: 2, mat: pal.red, shade: 'flat', band: 0, mirrorX: 16 });
  s.add({ type: 'rect', name: 'fang', x: 14, y: 22.5, w: 1, h: 2, mat: pal.steel, shade: 'flat', band: 0, mirrorX: 16 });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 22, rx: 10 }).render();
}
