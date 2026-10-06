// floor base.v3 (r3) — v2 without the outline pass (tiles have no silhouette): the diamond's edge is a darker stone
// border inside the tile, so neighbours meet stone-to-stone. v2: v1 with joints one stone step darker (not outline black), a lighter moss patch, and noise on the
// flags, so the floor stays low-contrast under units (direction rule). v1: starts from the W1 probe (art/probes/tile base.v2), written for this floor: crypt flagstones. The
// two dark joints along the iso axes, all one stone step (a lighter/darker flag checker turned into a loud argyle
// across the floor); a crack and a moss tuft. Low contrast so units read on it (direction rule).
export const meta = { brief: 'floor', pass: 'r3', notes: 'crypt flagstones: four flags, joints on the iso axes, crack, moss' };

export const params = {
  moss: { type: 'toggle', default: true, p: 0.5 },
  crack: { type: 'toggle', default: true, p: 0.6 },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h, { outline: false }), X = v => (v * w) / 32, Y = v => (v * h) / 16;
  const diamond = `M${w / 2} 1 L${w - 1} ${h / 2} L${w / 2} ${h - 1} L1 ${h / 2} Z`;
  s.add({ type: 'path', name: 'border', d: diamond, mat: pal.stone, shade: 'flat', band: 2 });
  s.add({ type: 'path', name: 'flags', d: `M${w / 2} 2 L${w - 3} ${h / 2} L${w / 2} ${h - 2} L3 ${h / 2} Z`, mat: pal.stone, shade: 'flat', band: 1 });
  const bits = [
    // joints along the two iso axes
    { type: 'path', name: 'joint', d: `M${w * 0.25} ${h * 0.25} L${w * 0.75} ${h * 0.75} L${w * 0.75 - X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.25 - X(1)} ${h * 0.25 + Y(0.3)} Z`, mat: pal.stone, shade: 'flat', band: 2 },
    { type: 'path', name: 'joint', d: `M${w * 0.75} ${h * 0.25} L${w * 0.25} ${h * 0.75} L${w * 0.25 + X(1)} ${h * 0.75 + Y(0.3)} L${w * 0.75 + X(1)} ${h * 0.25 + Y(0.3)} Z`, mat: pal.stone, shade: 'flat', band: 2 },
  ];
  if (P.crack) bits.push({ type: 'path', name: 'crack', d: `M${X(20)} ${Y(9)} L${X(22)} ${Y(10)} L${X(21)} ${Y(11)} L${X(23)} ${Y(12.5)} L${X(22.5)} ${Y(12.5)} L${X(20.5)} ${Y(11)} L${X(21.3)} ${Y(10.2)} Z`, mat: pal.stone, shade: 'flat', band: 2 });
  if (P.moss) bits.push({ type: 'ellipse', name: 'moss', cx: X(8), cy: Y(8.5), rx: X(2.5), ry: Y(1.2), mat: pal.grass, shade: 'flat', band: 1 });
  s.add({ type: 'group', name: 'surface', clip: { type: 'path', d: diamond }, children: bits });
  return ctx.lib.proc(s).noDefaults().add('materialNoise', { part: 'flags', amount: 0.2, scale: 2 }).render();
}
