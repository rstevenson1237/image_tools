// slime base.v2 (r2) — v1 with a lumpy base that spreads onto the floor (side bulges + a drip), a rounder top, and a
// clearer skull (bigger, jaw, lit step) and bone so they stop reading as a face. v1: written for the brief (the humanoid template doesn't fit): a grey-green crypt ooze squashing
// and stretching over the 4 idle frames (width and height trade off around a fixed floor line), a skull and a bone
// floating inside it (skin ramp, one step dark: seen through the ooze), a wet highlight, ground shadow.
export const meta = { brief: 'slime', pass: 'r2', notes: 'squash/stretch dome, bones inside, highlight' };

export const params = {
  size: { type: 'range', min: 0.85, max: 1.1, default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 24, Y = v => (v * h) / 32;
  const q = Math.sin(ctx.t * Math.PI * 2), floor = Y(28), rx = X(9) * P.size * (1 + 0.12 * q), ry = Y(8) * P.size * (1 - 0.12 * q), cx = w / 2, cy = floor - ry;
  s.add({ type: 'union', name: 'ooze', mat: pal.grass, shade: 'normal', underlay: true, shapes: [
    { type: 'ellipse', cx, cy: cy + ry * 0.15, rx: rx * 0.85, ry: ry * 1.1 },
    { type: 'ellipse', cx: cx - rx * 0.6, cy: floor - Y(2), rx: rx * 0.45, ry: Y(2.2) },
    { type: 'ellipse', cx: cx + rx * 0.55, cy: floor - Y(1.8), rx: rx * 0.5, ry: Y(2) },
    { type: 'rect', x: cx - rx, y: floor - Y(3), w: rx * 2, h: Y(3) },
    { type: 'capsule', a: [cx + rx * 0.2, floor - Y(1)], b: [cx + rx * 0.25, floor + Y(1)], r: X(0.9) },
  ] });
  const sx = cx - X(2), sy = cy + ry * 0.25;
  s.add({ type: 'ellipse', name: 'skull', cx: sx, cy: sy, rx: X(2.6), ry: Y(2.3), mat: pal.skin, shade: 'flat', band: 0 });
  s.add({ type: 'rect', name: 'jaw', x: sx - X(1.6), y: sy + Y(1.8), w: X(3.2), h: Y(1.4), mat: pal.skin, shade: 'flat', band: 1 });
  for (const dx of [-1.2, 0.6]) s.add({ type: 'rect', name: 'socket', x: Math.round(sx + X(dx)), y: Math.round(sy - Y(0.3)), w: Math.max(1, Math.round(X(1))), h: Math.max(1, Math.round(Y(1.2))), color: 'outline' });
  s.add({ type: 'capsule', name: 'bone', a: [cx + X(2), cy + ry * 0.5], b: [cx + X(5), cy + ry * 0.1], r: Math.max(0.8, X(0.8)), mat: pal.skin, shade: 'flat', band: 0 });
  s.add({ type: 'ellipse', name: 'shine', cx: cx - rx * 0.45, cy: cy - ry * 0.45, rx: X(1.5), ry: Y(1), mat: pal.grass, shade: 'flat', band: 0 });
  return ctx.lib.proc(s).add('groundShadow', {}).render();
}
