// floor base.v4 (u1) — user feedback on base.v2 ("too uniform; vary the flags, drop the dark dots"): one of the four flags
// is worn and mottled (heavy noise on the mid stone; a first try with the lightest step made a loud argyle again) (a param, so the 4 brief variants each wear a different flag and a tiled floor mixes them),
// the crack and the moss (the dark dots) are off by default. v2: v1 with joints one stone step darker (not outline black), a lighter moss patch, and noise on the
// flags, so the floor stays low-contrast under units (direction rule). v1: starts from the W1 probe (art/probes/tile base.v2), written for this floor: crypt flagstones. The
// two dark joints along the iso axes, all one stone step (a lighter/darker flag checker turned into a loud argyle
// across the floor); a crack and a moss tuft. Low contrast so units read on it (direction rule).
export const meta = { brief: 'floor', pass: 'u1', notes: 'crypt flagstones: four flags, joints on the iso axes, crack, moss' };

export const params = {
  moss: { type: 'toggle', default: false, p: 0.3 },
  crack: { type: 'toggle', default: false, p: 0.3 },
  worn: { type: 'choice', options: [0, 1, 2, 3], default: 1 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), X = v => (v * w) / 32, Y = v => (v * h) / 16;
  const diamond = `M${w / 2} 1 L${w - 1} ${h / 2} L${w / 2} ${h - 1} L1 ${h / 2} Z`;
  s.add({ type: 'path', name: 'flags', d: diamond, mat: pal.stone, shade: 'flat', band: 1 });
  // the four flags are the diamond's quadrants between the two joints; one is worn lighter
  const q = [[w / 2, 1, w * 0.75, h * 0.25 + 0.5, w / 2, h / 2, w * 0.25, h * 0.25 + 0.5], [w * 0.75, h * 0.25, w - 1, h / 2, w * 0.75, h * 0.75, w / 2, h / 2],
    [w / 2, h / 2, w * 0.75, h * 0.75, w / 2, h - 1, w * 0.25, h * 0.75], [w * 0.25, h * 0.25, w / 2, h / 2, w * 0.25, h * 0.75, 1, h / 2]][P.worn];
  const bits = [
    { type: 'path', name: 'worn', d: `M${q[0]} ${q[1]} L${q[2]} ${q[3]} L${q[4]} ${q[5]} L${q[6]} ${q[7]} Z`, mat: pal.stone, shade: 'flat', band: 1 },
    // joints along the two iso axes
    { type: 'path', name: 'joint', d: `M${w * 0.25} ${h * 0.25} L${w * 0.75} ${h * 0.75} L${w * 0.75 - X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.25 - X(1)} ${h * 0.25 + Y(0.3)} Z`, mat: pal.stone, shade: 'flat', band: 2 },
    { type: 'path', name: 'joint', d: `M${w * 0.75} ${h * 0.25} L${w * 0.25} ${h * 0.75} L${w * 0.25 + X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.75 + X(1)} ${h * 0.25 + Y(0.3)} Z`, mat: pal.stone, shade: 'flat', band: 2 },
  ];
  if (P.crack) bits.push({ type: 'path', name: 'crack', d: `M${X(20)} ${Y(9)} L${X(22)} ${Y(10)} L${X(21)} ${Y(11)} L${X(23)} ${Y(12.5)} L${X(22.5)} ${Y(12.5)} L${X(20.5)} ${Y(11)} L${X(21.3)} ${Y(10.2)} Z`, mat: pal.stone, shade: 'flat', band: 2 });
  if (P.moss) bits.push({ type: 'ellipse', name: 'moss', cx: X(8), cy: Y(8.5), rx: X(2.5), ry: Y(1.2), mat: pal.grass, shade: 'flat', band: 1 });
  s.add({ type: 'group', name: 'surface', clip: { type: 'path', d: diamond }, children: bits });
  return ctx.lib.proc(s).noDefaults().add('materialNoise', { part: 'flags', amount: 0.2, scale: 2 }).add('materialNoise', { part: 'worn', amount: 0.7, scale: 1.5, seed: 3 }).render();
}
