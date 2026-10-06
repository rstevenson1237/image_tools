// slime base.v1 (r1) — written for the brief (the humanoid template doesn't fit): a grey-green crypt ooze squashing
// and stretching over the 4 idle frames (width and height trade off around a fixed floor line), a skull and a bone
// floating inside it (skin ramp, one step dark: seen through the ooze), a wet highlight, ground shadow.
export const meta = { brief: 'slime', pass: 'r1', notes: 'squash/stretch dome, bones inside, highlight' };

export const params = {
  size: { type: 'range', min: 0.85, max: 1.1, default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 24, Y = v => (v * h) / 32;
  const q = Math.sin(ctx.t * Math.PI * 2), floor = Y(28), rx = X(9) * P.size * (1 + 0.12 * q), ry = Y(8) * P.size * (1 - 0.12 * q), cx = w / 2, cy = floor - ry;
  s.add({ type: 'path', name: 'ooze', d: `M${cx - rx} ${floor} Q${cx - rx} ${cy - ry * 0.9} ${cx} ${cy - ry} Q${cx + rx} ${cy - ry * 0.9} ${cx + rx} ${floor} Z`, mat: pal.grass, shade: 'normal', round: X(2), underlay: true });
  s.add({ type: 'ellipse', name: 'skull', cx: cx - X(1.5), cy: cy + ry * 0.2, rx: X(2.2), ry: Y(2), mat: pal.skin, shade: 'flat', band: 1 });
  s.add({ type: 'rect', name: 'socket', x: cx - X(2.5), y: cy + ry * 0.15, w: 1, h: 1, color: 'outline' });
  s.add({ type: 'rect', name: 'socket2', x: cx - X(0.8), y: cy + ry * 0.15, w: 1, h: 1, color: 'outline' });
  s.add({ type: 'capsule', name: 'bone', a: [cx + X(2), cy + ry * 0.5], b: [cx + X(5), cy + ry * 0.1], r: Math.max(0.8, X(0.7)), mat: pal.skin, shade: 'flat', band: 1 });
  s.add({ type: 'ellipse', name: 'shine', cx: cx - rx * 0.45, cy: cy - ry * 0.45, rx: X(1.5), ry: Y(1), mat: pal.grass, shade: 'flat', band: 0 });
  return ctx.lib.proc(s).add('groundShadow', {}).render();
}
