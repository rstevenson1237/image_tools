// leech base.v1 (r1) — written for the brief (the character template doesn't fit a worm): a fat segmented bog
// leech seen from above, lying across the tile; the body is a chain of overlapping segments on a sine wave whose
// phase follows ctx.t, so the 4 idle frames wriggle. Sucker mouth at the head end.
export const meta = { brief: 'leech', pass: 'r1', notes: 'segment chain on a travelling sine wave' };

export const params = {
  segments: { type: 'range', min: 6, max: 9, step: 1, default: 7 },
  hide: { type: 'swap', options: ['leather', 'grass'], default: 'leather' },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32;
  const n = P.segments, ph = ctx.t * Math.PI * 2, hide = pal[P.hide];
  const x0 = X(5), x1 = X(27), cy = h * 0.55;
  const pts = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1), x = x0 + (x1 - x0) * u, y = cy + Math.sin(u * Math.PI * 1.6 - ph) * X(2.5);
    const r = X(2.2 + 2.2 * Math.sin(Math.PI * (0.15 + 0.75 * u))); // thin tail, fat middle-front
    return { x, y, r };
  });
  s.add({ type: 'group', name: 'body', underlay: true, children: pts.map((p, i) => ({ type: 'ellipse', name: `seg${i}`, cx: p.x, cy: p.y, rx: p.r * 0.85, ry: p.r, mat: hide, shade: 'sphere' })) });
  const head = pts[n - 1];
  s.add({ type: 'ring', name: 'sucker', cx: head.x + X(1), cy: head.y, r: X(1.8), w: X(0.9), mat: pal.skin, shade: 'flat', band: 1 });
  s.add({ type: 'circle', name: 'maw', cx: head.x + X(1), cy: head.y, r: X(0.9), color: 'outline' });
  return ctx.lib.proc(s).add('groundShadow', {}).render();
}

export const anchors = ctx => ({ head: [Math.round(ctx.size[0] * 0.87), Math.round(ctx.size[1] * 0.55)] });
