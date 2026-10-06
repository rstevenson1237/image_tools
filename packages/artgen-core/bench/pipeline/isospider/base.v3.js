// isospider base.v3 (r3) — from v1 (6.5, R12; v2 regressed): every leg gets its own underlay so legs stay
// separated by ink, leg cores on the mid purple with a darker far half, abdomen keeps v1's normal shading plus a
// gloss crescent; params for variants (body colour, marking, eyes, leg weight, abdomen size).
export const meta = { brief: 'isospider', pass: 'r3', notes: 'per-leg underlay, two-tone legs, gloss crescent; variant params' };

const LEGS = ['M12 14 Q6 6 3 11', 'M11 17 Q4 12 1 18', 'M11 19 Q4 19 2 25', 'M12 21 Q8 23 7 29'];

export const params = {
  body: { type: 'swap', options: ['purple', 'green', 'red', 'leather'], default: 'purple' },
  marking: { type: 'choice', options: ['hourglass', 'stripes', 'spots'], default: 'hourglass' },
  eyes: { type: 'choice', options: [2, 4], default: 2 },
  legs: { type: 'range', min: 1.8, max: 2.6, step: 0.4, default: 2.2 },
  abdomen: { type: 'range', min: 7, max: 9, step: 1, default: 8 },
};

export function render(ctx) {
  const { pal } = ctx.dir, Pr = ctx.params, P = pal[Pr.body], mark = Pr.body === 'red' ? pal.gold : pal.red, s = ctx.lib.t2.scene(32, 32), ar = Pr.abdomen;
  for (const d of LEGS) s.add({ type: 'tube', name: 'leg', d, w: Pr.legs, w1: 1.1, mat: P, shade: 'bevel', underlay: true, mirrorX: 16 });
  s.add({ type: 'group', name: 'abdomen', underlay: true, children: [
    { type: 'ellipse', name: 'abdomen', cx: 16, cy: 10, rx: ar, ry: ar * 0.8, mat: P, shade: 'normal' },
    { type: 'path', name: 'gloss', d: `M${16 - ar + 2} 8 Q12 ${10 - ar * 0.8 + 0.5} 17 ${10 - ar * 0.8 + 0.2} Q12 6 11 10 Z`, mat: P, shade: 'flat', band: 0 },
  ] });
  if (Pr.marking === 'hourglass') s.add({ type: 'path', name: 'marking', d: 'M14 7 H18 L16 10 L18 13 H14 L16 10 Z', mat: mark, shade: 'flat', band: 0 });
  else if (Pr.marking === 'stripes') s.add({ type: 'group', name: 'marking', repeat: { n: 3, dy: 2.5 }, children: [{ type: 'rect', x: 13, y: 7, w: 6, h: 1, mat: mark, shade: 'flat', band: 0 }] });
  else s.add({ type: 'circle', name: 'marking', cx: 13.5, cy: 9, r: 1.2, mat: mark, shade: 'flat', band: 0, mirrorX: 16 });
  s.add({ type: 'ellipse', name: 'head', cx: 16, cy: 19, rx: 5, ry: 3.8, mat: P, shade: 'normal', underlay: true });
  s.add({ type: 'rect', name: 'eye', x: 13, y: 18, w: 2, h: 2, mat: pal.red, shade: 'flat', band: 0, mirrorX: 16 });
  if (Pr.eyes === 4) s.add({ type: 'rect', name: 'eye', x: 14.5, y: 16.5, w: 1, h: 1, mat: pal.red, shade: 'flat', band: 0, mirrorX: 16 });
  s.add({ type: 'rect', name: 'fang', x: 14, y: 22.5, w: 1, h: 2, mat: pal.steel, shade: 'flat', band: 0, mirrorX: 16 });
  return ctx.lib.proc(s).add('groundShadow', { cx: 16, cy: 22, rx: 10 }).render();
}
