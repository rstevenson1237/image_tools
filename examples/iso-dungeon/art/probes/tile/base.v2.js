// probe-tile base.v2 (r2) — from v1 (template iso ground): crypt flagstones. The diamond is cut into four flags by
// two dark joints along the iso axes, all one stone step (a lighter/darker flag checker turned into a loud argyle
// across the floor); a crack and a moss tuft. Low contrast so units read on it (direction rule).
export const meta = { brief: 'probe-tile', pass: 'r2', notes: 'crypt flagstones: four flags, joints on the iso axes, crack, moss' };

export const params = {
  moss: { type: 'toggle', default: true, p: 0.5 },
  crack: { type: 'toggle', default: true, p: 0.6 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 16;
  const diamond = `M${w / 2} 1 L${w - 1} ${h / 2} L${w / 2} ${h - 1} L1 ${h / 2} Z`;
  s.add({ type: 'path', name: 'flags', d: diamond, mat: pal.stone, shade: 'flat', band: 1 });
  const bits = [
    // joints along the two iso axes
    { type: 'path', name: 'joint', d: `M${w * 0.25} ${h * 0.25} L${w * 0.75} ${h * 0.75} L${w * 0.75 - X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.25 - X(1)} ${h * 0.25 + Y(0.3)} Z`, color: 'outline' },
    { type: 'path', name: 'joint', d: `M${w * 0.75} ${h * 0.25} L${w * 0.25} ${h * 0.75} L${w * 0.25 + X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.75 + X(1)} ${h * 0.25 + Y(0.3)} Z`, color: 'outline' },
  ];
  if (P.crack) bits.push({ type: 'path', name: 'crack', d: `M${X(20)} ${Y(9)} L${X(22)} ${Y(10)} L${X(21)} ${Y(11)} L${X(23)} ${Y(12.5)} L${X(22.5)} ${Y(12.5)} L${X(20.5)} ${Y(11)} L${X(21.3)} ${Y(10.2)} Z`, color: 'outline' });
  if (P.moss) bits.push({ type: 'ellipse', name: 'moss', cx: X(8), cy: Y(8.5), rx: X(2.5), ry: Y(1.2), mat: pal.grass, shade: 'flat', band: 2 });
  s.add({ type: 'group', name: 'surface', clip: { type: 'path', d: diamond }, children: bits });
  return ctx.lib.proc(s).noDefaults().render();
}
