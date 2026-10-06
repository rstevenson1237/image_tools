// lantern-post base.v3 (r3) — v2 with a wide hot core (the bar sits on it), no dotted light ring, a lighter mud mound.
// v2: v1 + a thicker post, a mud mound instead of crumbs, a hot lantern core with cage bars
// and light pixels around it. v1: written for the brief (the crate template doesn't fit): a leaning waymarker post
// driven into the mud, a crossarm with a lantern on a hook. The lantern is accent (the warm light allowed on props).
export const meta = { brief: 'lantern-post', pass: 'r3', notes: 'post, crossarm, hanging lantern' };

export const params = {
  lean: { type: 'range', min: -1.5, max: 1.5, default: 0.8 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 32;
  const bx = X(12), by = Y(29), tx = bx + X(P.lean), ty = Y(3);
  s.add({ type: 'ellipse', name: 'mud', cx: bx, cy: by, rx: X(7), ry: Y(2.4), mat: pal.grass, shade: 'flat', band: 1 });
  s.add({ type: 'tube', name: 'post', d: `M${bx} ${by} L${tx} ${ty}`, w: X(4.2), w1: X(3.2), mat: pal.wood, shade: 'cyl', underlay: true });
  s.add({ type: 'tube', name: 'arm', d: `M${tx - X(1)} ${ty + Y(3)} L${tx + X(11)} ${ty + Y(4)}`, w: X(1.8), mat: pal.wood, shade: 'flat', band: 1, underlay: true });
  const lx = tx + X(9.5), ly = ty + Y(12);
  s.add({ type: 'rect', name: 'hook', x: lx - 0.5, y: ty + Y(4.5), w: 1, h: Y(3), mat: pal.metal, shade: 'flat', band: 2 });
  s.add({ type: 'group', name: 'lantern', underlay: true, children: [
    { type: 'rect', name: 'cap', x: lx - X(2.5), y: ly - Y(5), w: X(5), h: Y(1.5), mat: pal.metal, shade: 'flat', band: 1 },
    { type: 'rect', name: 'glass', x: lx - X(2.5), y: ly - Y(3.5), w: X(5), h: Y(6), mat: pal.accent, shade: 'sphere' },
    { type: 'rect', name: 'core', x: lx - X(1.8), y: ly - Y(2.5), w: X(3.6), h: Y(4.5), mat: pal.accent, shade: 'flat', band: 0 },
    { type: 'rect', name: 'bar', x: lx - 0.5, y: ly - Y(3.5), w: 1, h: Y(6), mat: pal.metal, shade: 'flat', band: 2 },
    { type: 'rect', name: 'base', x: lx - X(3), y: ly + Y(2.5), w: X(6), h: Y(1.2), mat: pal.metal, shade: 'flat', band: 1 },
  ] });
  return ctx.lib.proc(s).add('materialNoise', { part: 'post', amount: 0.25, scale: 2 }).render();
}

export const anchors = ctx => ({ flame: [Math.round(ctx.size[0] * 0.67), Math.round(ctx.size[1] * 0.45)] });
