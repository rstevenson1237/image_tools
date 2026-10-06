// tank base.v2 (r2) — from v1 (6.5): hull gets a linear light gradient (lit corner to shaded corner) instead of
// the dark normal rim; dome on the four lighter armour steps with a softer gain; tracks flat with strong tread
// segments (dark seams every 4 px) and a lit inner rail; barrels get muzzle caps.
export const meta = { brief: 'tank', pass: 'r2', notes: 'linear hull, lighter dome, tread segments, muzzles' };

export function render(ctx) {
  const { pal } = ctx.dir, A = pal.armor, s = ctx.lib.t2.scene(64, 64, { shadow: [2, 2] });
  s.add({ type: 'group', name: 'track', underlay: true, mirrorX: 32, children: [
    { type: 'rect', name: 'track', x: 7, y: 10, w: 10, h: 48, r: 2, mat: A.slice(2), shade: 'flat', band: 1 },
    { type: 'rect', name: 'rail', x: 15, y: 12, w: 1, h: 44, mat: A, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'path', name: 'hull', d: 'M24 8 H40 L48 16 V55 L44 59 H20 L16 55 V16 Z', mat: A.slice(0, 4), shade: 'linear', underlay: true });
  s.add({ type: 'group', name: 'barrel', underlay: true, mirrorX: 32, children: [
    { type: 'rect', x: 26.5, y: 3, w: 4, h: 22, mat: A, shade: 'cyl' },
    { type: 'rect', x: 26.5, y: 2, w: 4, h: 2, mat: A, shade: 'flat', band: 3 },
  ] });
  s.add({ type: 'circle', name: 'dome', cx: 32, cy: 34, r: 11, mat: A.slice(0, 4), shade: 'sphere', gain: 1, underlay: true });
  s.add({ type: 'circle', name: 'sensor', cx: 32, cy: 31, r: 2, mat: pal.cyan, shade: 'flat', band: 1 });
  s.add({ type: 'rect', name: 'lights', x: 18, y: 20, w: 1, h: 28, mat: pal.cyan, shade: 'flat', band: 1, mirrorX: 32 });
  s.add({ type: 'rect', name: 'stripe', x: 24, y: 53, w: 16, h: 3, mat: pal.orange, shade: 'flat', band: 1 });
  return ctx.lib.proc(s).add('pattern', { part: 'track', type: 'stripes', axis: 'x', period: 4, offset: 1, step: 2 }).render();
}
