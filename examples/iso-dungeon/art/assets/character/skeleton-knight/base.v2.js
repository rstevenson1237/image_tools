// skeleton-knight base.v2 (r2) — v1 + bony legs (thin bones with knee knobs instead of greaves), a teeth line and red
// eye glints in the sockets, so it reads as undead. v1: starts from the W1 probe (art/probes/character base.v2), which was written for this enemy:
// bone-grey skull (two dark sockets), rusted mail torso under a torn tabard, bony forearms, a notched sword held on
// the lit side and a round leather shield on the other; stands on the 2:1 ground shadow.
export const meta = { brief: 'skeleton-knight', pass: 'r2', notes: 'skeleton knight: helm, skull, tabard, sword + shield' };

export const params = {
  tabard: { type: 'swap', options: ['cloth', 'leather'], default: 'cloth' },
  shield: { type: 'toggle', default: true, p: 0.7 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h);
  const hr = ctx.dir.scale.proportions?.headRatio ?? 0.4, cx = w / 2, X = v => (v * w) / 24, Y = v => (v * h) / 32;
  const top = Y(2), headH = Math.min(h * hr * 0.8, X(11)), neck = top + headH, foot = Y(29.5), hip = Y(20), bodyW = X(9);
  for (const lx of [cx - X(2.5), cx + X(2)]) s.add({ type: 'group', name: 'leg', underlay: true, mat: pal.skin, children: [
    { type: 'rect', x: lx - X(0.6), y: hip, w: Math.max(1, X(1.2)), h: foot - hip - Y(1), shade: 'flat', band: 1 },
    { type: 'circle', cx: lx, cy: (hip + foot) / 2, r: Math.max(1, X(1.1)), shade: 'flat', band: 0 },
    { type: 'rect', x: lx - X(1.2), y: foot - Y(1.5), w: X(2.4), h: Y(1.5), mat: pal.metal, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'path', name: 'mail', d: `M${cx - bodyW / 2} ${neck} H${cx + bodyW / 2} L${cx + bodyW / 2 + X(0.5)} ${hip + Y(1)} H${cx - bodyW / 2 - X(0.5)} Z`, mat: pal.metal, shade: 'cyl' },
    { type: 'path', name: 'tabard', d: `M${cx - X(2.5)} ${neck + Y(1)} H${cx + X(2.5)} L${cx + X(2)} ${hip + Y(4)} L${cx + X(0.5)} ${hip + Y(2.5)} L${cx - X(0.5)} ${hip + Y(4)} L${cx - X(2)} ${hip + Y(3)} Z`, mat: pal[P.tabard], shade: 'flat', band: 1 },
    { type: 'rect', name: 'belt', x: cx - bodyW / 2, y: hip - Y(1), w: bodyW, h: Math.max(1, Y(1.2)), mat: pal.leather, shade: 'flat', band: 2 },
  ] });
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'path', name: 'helm', d: `M${cx - headH * 0.5} ${neck - Y(1)} V${top + headH * 0.35} Q${cx} ${top - Y(1)} ${cx + headH * 0.5} ${top + headH * 0.35} V${neck - Y(1)} Z`, mat: pal.metal, shade: 'sphere' },
    { type: 'rect', name: 'skull', x: cx - headH * 0.3, y: top + headH * 0.4, w: headH * 0.6, h: headH * 0.5, r: 1, mat: pal.skin, shade: 'flat', band: 0 },
  ] });
  s.add({ type: 'rect', name: 'socket', x: cx - X(2), y: top + headH * 0.5, w: Math.max(1, X(1.2)), h: Math.max(1, Y(1.6)), color: 'outline', mirrorX: cx });
  s.add({ type: 'rect', name: 'glint', x: Math.round(cx - X(2)), y: Math.round(top + headH * 0.5), w: 1, h: 1, mat: pal.accent, shade: 'flat', band: 0, mirrorX: cx });
  s.add({ type: 'rect', name: 'teeth', x: cx - headH * 0.2, y: top + headH * 0.78, w: headH * 0.4, h: 1, color: 'outline' });
  const hand = cx - bodyW / 2 - X(2);
  s.add({ type: 'capsule', name: 'arm', a: [cx - bodyW / 2, neck + Y(1.5)], b: [hand, hip - Y(1)], r: Math.max(1, X(1.1)), mat: pal.skin, shade: 'cyl', underlay: true });
  s.add({ type: 'group', name: 'sword', underlay: true, children: [
    { type: 'path', d: `M${hand - X(0.8)} ${hip - Y(1)} V${top + Y(4)} L${hand} ${top + Y(2)} L${hand + X(0.8)} ${top + Y(4)} V${hip - Y(1)} Z`, mat: pal.metal, shade: 'bevel' },
    { type: 'rect', x: hand - X(2), y: hip - Y(1.5), w: X(4), h: Math.max(1, Y(1.2)), mat: pal.leather, shade: 'flat', band: 1 },
  ] });
  if (P.shield) s.add({ type: 'group', name: 'shield', underlay: true, children: [
    { type: 'circle', cx: cx + bodyW / 2 + X(1), cy: neck + Y(5), r: X(3.6), mat: pal.leather, shade: 'sphere' },
    { type: 'circle', cx: cx + bodyW / 2 + X(1), cy: neck + Y(5), r: X(1.2), mat: pal.metal, shade: 'flat', band: 0 },
  ] });
  return ctx.lib.proc(s).add('materialNoise', { part: 'mail', amount: 0.3, scale: 1.5 }).add('groundShadow', {}).render();
}

export const anchors = ctx => ({ blade: [Math.round(ctx.size[0] / 2 - (ctx.size[0] * 6.5) / 24), Math.round(ctx.size[1] * 0.12)] });
