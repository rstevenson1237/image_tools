// pill-bottle base.v2 (r2) — v1 + the pill moved clear of the bottle (it fused into a lump) and two text dashes on the
// label. v1: written for the brief: a 16x16 pickup icon. An amber pill bottle (accent ramp) with a
// pale label band (skin's lightest step) and a grey cap, a lit stripe down the glass, one pill beside it.
export const meta = { brief: 'pill-bottle', pass: 'r2', notes: 'amber bottle, label, cap, pill' };

export function render(ctx) {
  const { pal } = ctx.dir, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { mode: 'direct' }), X = v => (v * w) / 16;
  s.add({ type: 'rect', name: 'cap', x: X(3.5), y: X(1.5), w: X(6), h: X(2.5), r: 0.5, mat: pal.metal, shade: 'flat', band: 1, underlay: true });
  s.add({ type: 'rect', name: 'bottle', x: X(3), y: X(4), w: X(7), h: X(10), r: 1, mat: pal.accent, shade: 'cyl', underlay: true });
  s.add({ type: 'rect', name: 'label', x: X(3), y: X(7), w: X(7), h: X(4), mat: pal.skin, shade: 'flat', band: 0 });
  s.add({ type: 'rect', name: 'shine', x: X(4), y: X(5), w: 1, h: X(8), mat: pal.accent, shade: 'flat', band: 0 });
  s.add({ type: 'capsule', name: 'pill', a: [X(12.5), X(14)], b: [X(14.2), X(12.3)], r: X(1), mat: pal.skin, shade: 'flat', band: 0, underlay: true });
  for (const [y, len] of [[8, 4], [9.5, 3]]) s.add({ type: 'rect', name: 'text', x: X(4.5), y: X(y), w: X(len), h: 1, mat: pal.skin, shade: 'flat', band: 2 });
  return ctx.lib.proc(s).noDefaults().render();
}
