// isospider base.v2 (r2) — from v1 (6.5): heavier legs (wider tubes on the darker purple steps, knee joints),
// highlight crescents on abdomen and head and a shaded crescent on the abdomen's far side, as in the brief's
// "glossy carapace".
export const meta = { brief: 'isospider', pass: 'r2', notes: 'heavier legs + knees, highlight and shade crescents' };

const LEGS = [['M12 14 Q6 6 3 11', [6.5, 8.5]], ['M11 17 Q4 12 1 18', [5, 14.5]], ['M11 19 Q4 19 2 25', [4.5, 20.5]], ['M12 21 Q8 23 7 29', [8.5, 24]]];

export function render(ctx) {
  const { pal } = ctx.dir, P = pal.purple, s = ctx.lib.t2.scene(32, 32);
  s.add({ type: 'group', name: 'legs', underlay: true, mirrorX: 16, children: [
    ...LEGS.map(([d]) => ({ type: 'tube', name: 'leg', d, w: 2.6, w1: 1.4, mat: P, shade: 'flat', band: 1 })),
    ...LEGS.map(([, [x, y]]) => ({ type: 'circle', name: 'knee', cx: x, cy: y, r: 1.2, mat: P, shade: 'flat', band: 0 })),
  ] });
  s.add({ type: 'group', name: 'abdomen', underlay: true, children: [
    { type: 'ellipse', name: 'abdomen', cx: 16, cy: 10, rx: 8, ry: 6.5, mat: P, shade: 'flat', band: 1 },
    { type: 'path', name: 'gloss', d: 'M10 8 Q12 4.5 17 4.2 Q12 6 11 10 Z', mat: P, shade: 'flat', band: 0 },
    { type: 'path', name: 'shade', d: 'M18 15.5 Q23 15 23.5 10 Q24 15 18 16.5 Z', mat: P, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'path', name: 'hourglass', d: 'M14 7 H18 L16 10 L18 13 H14 L16 10 Z', mat: pal.red, shade: 'flat', band: 0 });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'ellipse', cx: 16, cy: 19, rx: 5, ry: 3.8, mat: P, shade: 'flat', band: 1 },
    { type: 'path', name: 'gloss', d: 'M12 18 Q13 15.8 16 15.6 Q13 17 13 19 Z', mat: P, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 18, w: 2, h: 2, mat: pal.red, shade: 'flat', band: 0, mirrorX: 16 });
  s.add({ type: 'rect', name: 'fang', x: 14, y: 22.5, w: 1, h: 2, mat: pal.steel, shade: 'flat', band: 0, mirrorX: 16 });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 22, rx: 10 }).render();
}
